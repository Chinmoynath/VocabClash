import { Plugin } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { processPyqEnrichmentBatch } from './pyqEnrichmentLogic';

dotenv.config();

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

export function geminiApiPlugin(): Plugin {
  return {
    name: 'gemini-api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/gemini/')) {
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

              try {
                const response = await ai.models.generateContent({
                  model: 'gemini-3.5-flash-lite',
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
                const isQuota = aiErr?.status === 429 || aiErr?.message?.includes('429') || aiErr?.message?.includes('RESOURCE_EXHAUSTED');
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

            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err: unknown) {
            console.error('Gemini API Middleware Error:', err);
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
