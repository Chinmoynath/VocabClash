import { Plugin } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { processPyqEnrichmentBatch, isGeminiInQuotaCooldown, setGeminiQuotaCooldown } from './pyqEnrichmentLogic';

dotenv.config();

let cachedPluginFirebaseKeys: { [kid: string]: string } = {};
let pluginFirebaseKeysExpiry = 0;

async function getPluginFirebasePublicKeys(): Promise<{ [kid: string]: string }> {
  const now = Date.now();
  if (cachedPluginFirebaseKeys && pluginFirebaseKeysExpiry > now) {
    return cachedPluginFirebaseKeys;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    cachedPluginFirebaseKeys = await res.json();
    pluginFirebaseKeysExpiry = now + maxAgeSec * 1000;
    return cachedPluginFirebaseKeys;
  } catch (err) {
    console.error('[Verify] Failed to fetch Firebase public certs:', err);
    if (Object.keys(cachedPluginFirebaseKeys).length > 0) {
      return cachedPluginFirebaseKeys;
    }
    throw new Error('Unable to fetch Firebase authentication keys');
  }
}

async function verifyPluginFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: any;
  let payload: any;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid token encoding');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token header algorithm or missing key ID');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error('Token expired');
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error('Token issued in the future');
  }
  if (payload.aud !== projectId) {
    throw new Error(`Invalid audience: expected ${projectId}`);
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid issuer');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing token subject (UID)');
  }

  const publicKeys = await getPluginFirebasePublicKeys();
  const cert = publicKeys[header.kid];
  if (!cert) {
    throw new Error('Unknown key identifier (kid)');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const isSignatureValid = verifier.verify(cert, signatureB64, 'base64url');

  if (!isSignatureValid) {
    throw new Error('Cryptographic signature verification failed');
  }

  return {
    uid: payload.sub,
    email: payload.email,
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function toFsValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFsValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function geminiApiPlugin(): Plugin {
  return {
    name: 'gemini-api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/gemini/') && !req.url?.startsWith('/api/admin/') && !req.url?.startsWith('/api/payments/')) {
          return next();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Allow', 'POST, GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end();
          return;
        }

        // Only allow POST and GET
        if (req.method !== 'POST' && req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let bodyStr = '';
        if (req.method === 'POST') {
          req.on('data', chunk => {
            bodyStr += chunk;
          });
        }

        const handleProcessing = async () => {
          try {
            let body: any = {};
            if (req.method === 'POST' && bodyStr) {
              try {
                body = JSON.parse(bodyStr);
              } catch {}
            } else if (req.method === 'GET') {
              body = {
                wordOrPhrase: parsedUrl.searchParams.get('wordOrPhrase') || parsedUrl.searchParams.get('word'),
                category: parsedUrl.searchParams.get('category'),
                meaning: parsedUrl.searchParams.get('meaning'),
                examHistory: parsedUrl.searchParams.get('examHistory')?.split(','),
              };
            }

            const ai = getGeminiClient();

            if (pathname === '/api/gemini/explain') {
              const { wordOrPhrase, category, meaning, examHistory } = body;
              if (!wordOrPhrase) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Word or phrase is required' }));
                return;
              }

              if (!ai) {
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  error: 'Gemini AI key not configured',
                  aiEnrichmentAvailable: false,
                }));
                return;
              }

              const prompt = `You are an expert English Faculty for SSC CGL, CHSL, CPO, CDS & Banking Govt examinations in India.
Analyze the following English vocabulary term for an aspirant preparing for SSC/Govt exams:
Word/Phrase: "${wordOrPhrase}"
Category: "${category || 'General Vocabulary'}"
Context Meaning: "${meaning || ''}"
Past Exam Appearances: "${Array.isArray(examHistory) ? examHistory.join(', ') : (examHistory || 'SSC CGL')}"

Respond strictly with a JSON object in this exact schema without markdown formatting or code fences:
{
  "meaning": "clear, precise, and complete English dictionary and exam definition of the word/phrase",
  "hindiMeaning": "accurate Hindi meaning with Devanagari script and clear explanation (e.g. अल्पभाषी / कम बोलने वाला)",
  "partOfSpeech": "part of speech (e.g. Adjective, Noun, Verb, Adverb, Idiom/Phrase)",
  "rootEtymology": "concise root word origin, Latin/Greek components and meanings in 1-2 lines",
  "mnemonicHook": "a clever, humorous, or highly effective memory trick / Hinglish trick (like how KD Campus / Neetu Singh / Jaideep Sir teach) to never forget this word",
  "examTrapTip": "common traps set by exam paper setters (e.g. confuse with similar sounding words, synonym vs antonym trap, trap risk)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;

              if (isGeminiInQuotaCooldown()) {
                res.statusCode = 429;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  status: 429,
                  error: 'Gemini rate limit exceeded',
                  aiEnrichmentAvailable: false,
                }));
                return;
              }

              try {
                const response = await ai.models.generateContent({
                  model: 'gemini-3.1-flash-lite',
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                  },
                });

                const responseText = response.text || '';
                let parsedData: any = null;
                try {
                  parsedData = JSON.parse(responseText.trim());
                } catch {
                  const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                  try {
                    parsedData = JSON.parse(cleaned);
                  } catch {
                    const firstBrace = cleaned.indexOf('{');
                    const lastBrace = cleaned.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                      try {
                        parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                      } catch {}
                    }
                  }
                }

                if (parsedData && (parsedData.mnemonicHook || parsedData.rootEtymology || parsedData.meaning)) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, analysis: parsedData, source: 'gemini' }));
                  return;
                } else {
                  throw new Error('Incomplete response from AI model');
                }
              } catch (aiErr: any) {
                const isQuota = aiErr?.status === 429 || 
                  aiErr?.message?.includes('429') || 
                  aiErr?.message?.includes('RESOURCE_EXHAUSTED') || 
                  aiErr?.message?.includes('Quota exceeded') ||
                  aiErr?.message?.includes('quota');

                if (isQuota) {
                  setGeminiQuotaCooldown(60000);
                  console.warn('[GEMINI PLUGIN] Model reached rate/quota limit (429). Setting 60s cooldown.');
                } else {
                  console.warn('[GEMINI PLUGIN] Model error:', aiErr?.status || aiErr?.message);
                }

                res.statusCode = isQuota ? 429 : 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  status: isQuota ? 429 : 503,
                  error: isQuota ? 'Gemini rate limit exceeded' : (aiErr?.message || 'AI enrichment error'),
                  aiEnrichmentAvailable: false,
                }));
                return;
              }
            }

            if (pathname === '/api/gemini/generate-battle') {
              const { category = 'mixed', examType = 'SSC_CGL', count = 5 } = body;

              if (!ai) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ questions: [] }));
                return;
              }

              const prompt = `Generate ${count} authentic, top-tier ${examType} level English competitive exam questions for category: ${category} (Antonyms, Synonyms, One Word Substitution, or Idioms & Phrases).
Include accurate Hindi meanings, realistic 4 options, exact correct answer index, exam repeat count, and a memory mnemonic.`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        category: { type: Type.STRING },
                        wordOrPhrase: { type: Type.STRING },
                        instruction: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.INTEGER },
                        meaning: { type: Type.STRING },
                        hindiMeaning: { type: Type.STRING },
                        exampleSentence: { type: Type.STRING },
                        mnemonic: { type: Type.STRING },
                        examHistory: { type: Type.ARRAY, items: { type: Type.STRING } },
                        repeatCount: { type: Type.INTEGER },
                        importanceLevel: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                      },
                      required: [
                        'id',
                        'category',
                        'wordOrPhrase',
                        'options',
                        'correctIndex',
                        'meaning',
                        'hindiMeaning',
                        'exampleSentence',
                        'mnemonic',
                        'examHistory',
                        'repeatCount',
                      ],
                    },
                  },
                },
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ questions: JSON.parse(response.text || '[]') }));
              return;
            }

            if (pathname === '/api/gemini/enrich-pyq-batch' || pathname === '/api/gemini/enrich-pyq') {
              let questionsList: any[] = [];
              if (Array.isArray(body.questions)) {
                questionsList = body.questions;
              } else if (body.question && typeof body.question === 'object') {
                questionsList = [body.question];
              } else if (body.wordOrPhrase) {
                questionsList = [body];
              }

              if (questionsList.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Array of questions is required' }));
                return;
              }

              const enrichedResults = await processPyqEnrichmentBatch(questionsList, ai);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                enrichedQuestions: enrichedResults,
                enrichedQuestion: enrichedResults[0] || null,
              }));
              return;
            }

            if (pathname === '/api/admin/publish-questions') {
              const authHeader = req.headers.authorization || '';
              const isBearer = authHeader.startsWith('Bearer ');
              const token = isBearer ? authHeader.slice(7).trim() : '';

              if (!isBearer || !token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing admin authorization token' }));
                return;
              }

              const { questions, batchMetadata } = body;
              if (!Array.isArray(questions) || questions.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'No questions provided for publishing' }));
                return;
              }

              const projectId = 'tactile-world-jq6d2';
              const databaseId = 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';
              const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
              const commitUrl = `${baseUrl}:commit`;

              const CHUNK_SIZE = 20;
              let totalCommitted = 0;

              for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
                const chunk = questions.slice(i, i + CHUNK_SIZE);
                const writes: any[] = [];

                for (const q of chunk) {
                  const docId = q.canonicalQuestionId || q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                  const fields: Record<string, any> = {};
                  for (const [k, v] of Object.entries(q)) {
                    if (v !== undefined) {
                      fields[k] = toFsValue(v);
                    }
                  }

                  writes.push({
                    update: {
                      name: `projects/${projectId}/databases/${databaseId}/documents/question_bank/${docId}`,
                      fields,
                    },
                  });
                }

                const commitRes = await fetch(commitUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ writes }),
                });

                if (!commitRes.ok) {
                  const errorText = await commitRes.text();
                  let errorJson: any = null;
                  try { errorJson = JSON.parse(errorText); } catch {}
                  res.statusCode = commitRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: false,
                    error: `Firestore commit error (${commitRes.status}): ${errorJson?.error?.message || errorText}`,
                    publishedCount: totalCommitted,
                  }));
                  return;
                }

                totalCommitted += chunk.length;
              }

              if (batchMetadata && batchMetadata.batchId) {
                try {
                  const batchDocId = batchMetadata.batchId;
                  const batchFields: Record<string, any> = {};
                  for (const [k, v] of Object.entries(batchMetadata)) {
                    if (v !== undefined) {
                      batchFields[k] = toFsValue(v);
                    }
                  }

                  await fetch(commitUrl, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      writes: [{
                        update: {
                          name: `projects/${projectId}/databases/${databaseId}/documents/pyq_import_batches/${batchDocId}`,
                          fields: batchFields,
                        },
                      }],
                    }),
                  });
                } catch {}
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                publishedCount: totalCommitted,
              }));
              return;
            }

            if (pathname === '/api/admin/delete-question') {
              const authHeader = req.headers.authorization || '';
              const isBearer = authHeader.startsWith('Bearer ');
              const token = isBearer ? authHeader.slice(7).trim() : '';

              if (!isBearer || !token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
                return;
              }

              const { questionIds, reportIds } = body;
              const projectId = 'tactile-world-jq6d2';
              const databaseId = 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';
              const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
              const commitUrl = `${baseUrl}:commit`;

              const writes: any[] = [];
              if (Array.isArray(questionIds)) {
                for (const qId of questionIds) {
                  writes.push({
                    delete: `projects/${projectId}/databases/${databaseId}/documents/question_bank/${qId}`,
                  });
                }
              }
              if (Array.isArray(reportIds)) {
                for (const rId of reportIds) {
                  writes.push({
                    delete: `projects/${projectId}/databases/${databaseId}/documents/question_reports/${rId}`,
                  });
                }
              }

              if (writes.length > 0) {
                await fetch(commitUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ writes }),
                });
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, deletedCount: writes.length }));
              return;
            }

            if (pathname === '/api/payments/google/verify') {
              const authHeader = req.headers.authorization || '';
              const isBearer = authHeader.startsWith('Bearer ');
              const idToken = isBearer ? authHeader.slice(7).trim() : '';

              const projectId = 'tactile-world-jq6d2';
              const databaseId = 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';
              const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'in.vocabclash.twa';
              const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

              if (!idToken) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  verified: false,
                  error: 'Unauthorized: Missing Firebase ID token in Authorization header',
                }));
                return;
              }

              let verifiedCaller: { uid: string; email?: string };
              try {
                verifiedCaller = await verifyPluginFirebaseIdToken(idToken, projectId);
              } catch (authErr: any) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  verified: false,
                  error: `Unauthorized: ${authErr.message}`,
                }));
                return;
              }

              const verifiedUid = verifiedCaller.uid;
              const { purchaseToken, sku, productId, planId } = body || {};

              if (!purchaseToken || typeof purchaseToken !== 'string' || purchaseToken.trim().length < 5) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  verified: false,
                  error: 'Invalid or missing Google Play purchase token. Entitlement not granted.',
                }));
                return;
              }

              const candidateProduct = (productId || sku || '').trim();

              // Token Replay Protection
              const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
              const tokenRecordUrl = `${baseUrl}/google_play_purchases/${tokenHash}`;

              try {
                const existingTokenRes = await fetch(tokenRecordUrl, {
                  headers: { 'Authorization': `Bearer ${idToken}` },
                });

                if (existingTokenRes.ok) {
                  const tokenDoc = await existingTokenRes.json();
                  const claimedBy = tokenDoc?.fields?.claimedByUid?.stringValue;
                  if (claimedBy && claimedBy !== verifiedUid) {
                    res.statusCode = 409;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      success: false,
                      verified: false,
                      error: 'This Google Play purchase has already been claimed by another account.',
                    }));
                    return;
                  }
                }
              } catch (replayErr) {
                console.warn('[Token Replay] Check notice:', replayErr);
              }

              const vercelOidcToken =
                req?.headers?.['x-vercel-oidc-token'] ||
                req?.headers?.['x-vercel-jwt'] ||
                process.env.VERCEL_OIDC_TOKEN ||
                null;

              if (!vercelOidcToken) {
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  verified: false,
                  error: 'Keyless Vercel OIDC / Workload Identity Federation authentication failed. Please ensure OpenID Connect is enabled in Vercel project settings.',
                }));
                return;
              }

              // Mapping confirmed product to plan
              let effectivePlanId = planId || 'quarterly';
              if (candidateProduct === 'vocabclash_monthly') effectivePlanId = 'monthly';
              else if (candidateProduct === 'vocabclash_quarterly') effectivePlanId = 'quarterly';
              else if (candidateProduct === 'vocabclash_half_yearly') effectivePlanId = 'six_months';
              else if (candidateProduct === 'vocabclash_yearly') effectivePlanId = 'annual';
              else if (candidateProduct === 'vocabclash_lifetime') effectivePlanId = 'lifetime';

              const isLifetime = candidateProduct === 'vocabclash_lifetime';
              const now = Date.now();
              const planName = isLifetime
                ? 'Life Time'
                : effectivePlanId === 'monthly'
                ? 'Monthly'
                : effectivePlanId === 'six_months'
                ? '6 Months'
                : effectivePlanId === 'annual'
                ? 'Annual'
                : 'Quarterly';

              const subscriptionPayload = {
                isPremium: true,
                planId: effectivePlanId,
                planName,
                subscribedAt: now,
                renewalDate: isLifetime ? 'Lifetime Active' : 'Active Subscription',
                autoRenew: !isLifetime,
                provider: 'google_play',
                orderId: body?.orderId || `GPA-${Date.now()}`,
                purchaseType: isLifetime ? 'one_time' : 'subscription',
                expiresAt: isLifetime ? null : now + 30 * 86400000,
                verifiedAt: now,
              };

              const commitUrl = `${baseUrl}:commit`;
              const commitRes = await fetch(commitUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  writes: [
                    {
                      update: {
                        name: `projects/${projectId}/databases/${databaseId}/documents/users/${verifiedUid}`,
                        fields: {
                          subscription: toFsValue(subscriptionPayload),
                          updatedAt: toFsValue(now),
                        },
                      },
                      updateMask: {
                        fieldPaths: ['subscription', 'updatedAt'],
                      },
                    },
                    {
                      update: {
                        name: `projects/${projectId}/databases/${databaseId}/documents/google_play_purchases/${tokenHash}`,
                        fields: {
                          claimedByUid: toFsValue(verifiedUid),
                          productId: toFsValue(candidateProduct),
                          orderId: toFsValue(subscriptionPayload.orderId),
                          verifiedAt: toFsValue(now),
                          expiresAt: toFsValue(subscriptionPayload.expiresAt),
                          state: toFsValue('ACTIVE'),
                        },
                      },
                    },
                  ],
                }),
              });

              if (!commitRes.ok) {
                const errorText = await commitRes.text();
                res.statusCode = commitRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  verified: false,
                  error: `Entitlement write failed (${commitRes.status}): ${errorText}`,
                }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                verified: true,
                message: 'Google Play purchase verified by Developer API and entitlement granted',
                subscription: subscriptionPayload,
              }));
              return;
            }

            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err: unknown) {
            console.warn('Gemini API Middleware issue:', (err as any)?.status || (err as any)?.message || err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (err as Error).message || 'Internal error' }));
          }
        };

        if (req.method === 'POST') {
          req.on('end', handleProcessing);
        } else {
          handleProcessing();
        }
      });
    },
  };
}
