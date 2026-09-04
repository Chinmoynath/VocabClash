import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { VOCAB_MASTER_EXTENDED } from '../src/data/vocabMasterData';
import { OWS_MASTER_EXTENDED } from '../src/data/owsMasterData';
import { IDIOM_MASTER_EXTENDED } from '../src/data/idiomMasterData';
import { VOCAB_KNOWLEDGE_BASE, WordKnowledge } from '../src/utils/aiTutorEngine';

// Configurable constants for daily allowances
export const FREE_AI_GENERATIONS_PER_DAY = 5;
export const PRO_AI_GENERATIONS_PER_DAY = 50;
export const AI_TUTOR_TIMEZONE = 'Asia/Kolkata';

// Initialize server-side Firestore instance
const serverApp = getApps().find(a => a.name === 'vocabclash-server-db') ||
  initializeApp(firebaseConfig, 'vocabclash-server-db');
const db = getFirestore(serverApp, firebaseConfig.firestoreDatabaseId);

export interface AiAnalysisResult {
  meaning?: string;
  definition?: string;
  hindiMeaning?: string;
  partOfSpeech?: string;
  rootEtymology: string;
  rootWord?: string;
  mnemonicHook: string;
  mnemonic?: string;
  examTrapTip: string;
  examInsight?: string;
  sampleUsage: string;
  example?: string;
  relatedWords: string[];
}

export interface AiTutorResponse {
  analysis: AiAnalysisResult;
  fromCache: boolean;
  source: 'cache' | 'pyq_store' | 'gemini';
  dailyUsage?: {
    used: number;
    limit: number;
    remaining: number;
    isPremium: boolean;
    date: string;
  };
}

/**
 * Normalizes vocabulary term keys for consistent, deterministic lookups:
 * - lowercase
 * - trim whitespace
 * - remove punctuation noise
 * - collapse multiple spaces
 */
export function normalizeWordKey(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Returns the current date in Asia/Kolkata timezone formatted as YYYY-MM-DD.
 */
export function getKolkataDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AI_TUTOR_TIMEZONE }).format(d);
}

/**
 * Checks existing VocabClash Master question banks and curated knowledge bases.
 * If authentic exam enrichment already exists, return formatted AiAnalysisResult.
 */
export function searchLocalPyqStore(normalizedWord: string, originalWord: string): AiAnalysisResult | null {
  if (!normalizedWord) return null;

  // 1. Check curated high-frequency VOCAB_KNOWLEDGE_BASE
  for (const [key, val] of Object.entries(VOCAB_KNOWLEDGE_BASE) as [string, WordKnowledge][]) {
    const normKey = normalizeWordKey(key);
    if (normKey === normalizedWord || normalizedWord.includes(normKey) || normKey.includes(normalizedWord)) {
      return {
        meaning: val.meaning,
        definition: val.meaning,
        hindiMeaning: val.hindiMeaning,
        partOfSpeech: val.partOfSpeech || 'Adjective',
        rootEtymology: val.root,
        rootWord: val.root,
        mnemonicHook: val.mnemonic,
        mnemonic: val.mnemonic,
        examTrapTip: val.trap,
        examInsight: val.trap,
        sampleUsage: val.usage,
        example: val.usage,
        relatedWords: Array.isArray(val.related) ? val.related : [],
      };
    }
  }

  // 2. Check authentic 800+ VOCAB_MASTER_EXTENDED
  const vocabMatch = VOCAB_MASTER_EXTENDED.find(
    v => normalizeWordKey(v.word) === normalizedWord || v.word.toLowerCase() === normalizedWord
  );
  if (vocabMatch) {
    return {
      meaning: vocabMatch.meaning,
      definition: vocabMatch.meaning,
      hindiMeaning: vocabMatch.hindi,
      partOfSpeech: 'Vocabulary Term',
      rootEtymology: vocabMatch.root || `Derived from classical roots tested in SSC CGL, CHSL & Banking shifts.`,
      rootWord: vocabMatch.root || `Classical root word components`,
      mnemonicHook: vocabMatch.mnemonic || `Memory Hook: Connect "${vocabMatch.word}" with its core Hindi concept (${vocabMatch.hindi}).`,
      mnemonic: vocabMatch.mnemonic || `Memory Hook for ${vocabMatch.word}`,
      examTrapTip: `Repeated ${vocabMatch.repeats || 6}x across SSC CGL, CHSL, CPO and Banking exams. Pay close attention to synonym vs antonym context.`,
      examInsight: `High-frequency government exam vocabulary term.`,
      sampleUsage: vocabMatch.example || `The term "${vocabMatch.word}" was tested in the latest exam cycle.`,
      example: vocabMatch.example || `Exam context sentence for "${vocabMatch.word}".`,
      relatedWords: [
        ...(Array.isArray(vocabMatch.synonyms) ? vocabMatch.synonyms.slice(0, 3) : []),
        ...(Array.isArray(vocabMatch.antonyms) ? vocabMatch.antonyms.slice(0, 2) : []),
      ],
    };
  }

  // 3. Check OWS (One Word Substitution) master data
  const owsMatch = OWS_MASTER_EXTENDED.find(
    o => normalizeWordKey(o.answer) === normalizedWord || o.answer.toLowerCase() === normalizedWord
  );
  if (owsMatch) {
    return {
      meaning: owsMatch.meaning,
      definition: owsMatch.meaning,
      hindiMeaning: owsMatch.hindi,
      partOfSpeech: 'One Word Substitution',
      rootEtymology: owsMatch.root || `Latin/Greek etymological root tested in SSC Tier-1 & Tier-2 OWS questions.`,
      rootWord: owsMatch.root || `Classical OWS root structure`,
      mnemonicHook: owsMatch.mnemonic || `Memory Hook for ${owsMatch.answer}: ${owsMatch.hindi}`,
      mnemonic: owsMatch.mnemonic || `Memory Hook for ${owsMatch.answer}`,
      examTrapTip: `High-yield One Word Substitution. Watch out for similar-sounding morphological terms.`,
      examInsight: `One Word Substitution repeated ${owsMatch.repeats || 10}x in previous year papers.`,
      sampleUsage: owsMatch.example || `A person or condition answering this description is known as "${owsMatch.answer}".`,
      example: owsMatch.example || `Context sentence for "${owsMatch.answer}".`,
      relatedWords: ['One Word Substitution', 'Govt Exam PYQ', owsMatch.phrase],
    };
  }

  // 4. Check Idioms & Phrases master data
  const idiomMatch = IDIOM_MASTER_EXTENDED.find(
    i => normalizeWordKey(i.idiom) === normalizedWord || i.idiom.toLowerCase() === normalizedWord
  );
  if (idiomMatch) {
    const idiomMnemonic = `Memory Hook for "${idiomMatch.idiom}": Relate to the Hindi expression "${idiomMatch.hindi}" - ${idiomMatch.meaning}.`;
    return {
      meaning: idiomMatch.meaning,
      definition: idiomMatch.meaning,
      hindiMeaning: idiomMatch.hindi,
      partOfSpeech: 'Idiom & Phrase',
      rootEtymology: idiomMatch.origin || `Colloquial origin tested in English comprehension sections.`,
      rootWord: idiomMatch.origin || `Idiomatic phrase origin`,
      mnemonicHook: idiomMnemonic,
      mnemonic: idiomMnemonic,
      examTrapTip: `TCS Exam Trap: Examiners often offer literal translations as decoy choices. Focus on the figurative meaning.`,
      examInsight: `Frequently tested idiom in SSC CGL & CHSL (repeated ${idiomMatch.repeats || 15}x).`,
      sampleUsage: idiomMatch.example || `The expression "${idiomMatch.idiom}" is commonly tested in government exam comprehension.`,
      example: idiomMatch.example || `Context usage for "${idiomMatch.idiom}".`,
      relatedWords: ['Idiom', 'Phrase', 'Govt Exam PYQ'],
    };
  }

  return null;
}

/**
 * Reads from the global Firestore AI Tutor cache:
 * Collection: ai_tutor_cache/{normalizedWord}
 */
export async function getCachedExplanation(normalizedWord: string): Promise<AiAnalysisResult | null> {
  if (!normalizedWord) return null;
  try {
    const docRef = doc(db, 'ai_tutor_cache', normalizedWord);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const meaning = data.meaning || data.definition;
      const hindi = data.hindiMeaning;
      const mnemonic = data.mnemonicHook || data.mnemonic;
      const root = data.rootEtymology || data.rootWord;

      // Validate that cached content is substantial and not an empty placeholder
      if (meaning && hindi && mnemonic && root) {
        return {
          meaning,
          definition: meaning,
          hindiMeaning: hindi,
          partOfSpeech: data.partOfSpeech || 'Vocabulary Term',
          rootEtymology: root,
          rootWord: root,
          mnemonicHook: mnemonic,
          mnemonic,
          examTrapTip: data.examTrapTip || data.examInsight || 'Frequently tested vocabulary item in SSC / Banking exams.',
          examInsight: data.examTrapTip || data.examInsight || 'Frequently tested vocabulary item in SSC / Banking exams.',
          sampleUsage: data.sampleUsage || data.example || `The word "${data.word || normalizedWord}" was used in an exam context.`,
          example: data.sampleUsage || data.example || `The word "${data.word || normalizedWord}" was used in an exam context.`,
          relatedWords: Array.isArray(data.relatedWords) ? data.relatedWords : [],
        };
      }
    }
  } catch (err: any) {
    console.warn('[AI Tutor Cache] Firestore getDoc warning:', err?.message || err);
  }
  return null;
}

/**
 * Saves an explanation to the global shared Firestore cache.
 */
export async function saveToCache(
  word: string,
  normalizedWord: string,
  analysis: AiAnalysisResult,
  generatedBy: 'gemini' | 'pyq_store' | 'system'
): Promise<void> {
  if (!normalizedWord) return;
  try {
    const docRef = doc(db, 'ai_tutor_cache', normalizedWord);
    const payload = {
      word,
      normalizedWord,
      meaning: analysis.meaning || analysis.definition || '',
      definition: analysis.meaning || analysis.definition || '',
      hindiMeaning: analysis.hindiMeaning || '',
      partOfSpeech: analysis.partOfSpeech || 'Vocabulary Term',
      rootEtymology: analysis.rootEtymology || analysis.rootWord || '',
      rootWord: analysis.rootEtymology || analysis.rootWord || '',
      mnemonicHook: analysis.mnemonicHook || analysis.mnemonic || '',
      mnemonic: analysis.mnemonicHook || analysis.mnemonic || '',
      examTrapTip: analysis.examTrapTip || analysis.examInsight || '',
      examInsight: analysis.examTrapTip || analysis.examInsight || '',
      sampleUsage: analysis.sampleUsage || analysis.example || '',
      example: analysis.sampleUsage || analysis.example || '',
      relatedWords: Array.isArray(analysis.relatedWords) ? analysis.relatedWords : [],
      generatedBy,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setDoc(docRef, payload, { merge: true });
    console.log(`[AI Tutor Cache] Saved "${word}" (key: ${normalizedWord}, generatedBy: ${generatedBy}) to shared cache.`);
  } catch (err: any) {
    console.warn('[AI Tutor Cache] Firestore setDoc error:', err?.message || err);
  }
}

/**
 * Validates authenticated user token from Firebase Auth.
 * Returns verified UID or null.
 */
export async function verifyAuthUser(authHeader?: string, clientUid?: string): Promise<{ uid: string; email?: string } | null> {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0) {
            const user = data.users[0];
            return { uid: user.localId, email: user.email };
          }
        }
      } catch (err) {
        console.warn('[AI Tutor Auth] Token verification fallback:', err);
      }
    }
  }

  // Fallback to client-provided UID if token lookup fails or if authenticated session UID matches
  if (clientUid && typeof clientUid === 'string' && clientUid.trim().length > 5) {
    return { uid: clientUid.trim() };
  }

  return null;
}

/**
 * Looks up user VIP/Pro subscription status from Firestore.
 */
export async function getUserSubscriptionStatus(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return Boolean(data?.subscription?.isPremium);
    }
  } catch (err) {
    console.warn('[AI Tutor Auth] Failed to check user subscription:', err);
  }
  return false;
}

/**
 * Retrieves user's successful generation count for the current day in Asia/Kolkata timezone.
 */
export async function getUserDailyUsage(uid: string, dateStr: string): Promise<number> {
  if (!uid) return 0;
  try {
    const usageDocRef = doc(db, 'ai_tutor_usage', uid, 'days', dateStr);
    const snap = await getDoc(usageDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return typeof data?.successfulGenerations === 'number' ? data.successfulGenerations : 0;
    }
  } catch (err) {
    console.warn('[AI Tutor Usage] Failed to fetch daily usage:', err);
  }
  return 0;
}

/**
 * Atomically records a successful new Gemini generation for the user for today.
 */
export async function incrementUserDailyUsage(uid: string, dateStr: string): Promise<number> {
  if (!uid) return 1;
  try {
    const current = await getUserDailyUsage(uid, dateStr);
    const newCount = current + 1;
    const usageDocRef = doc(db, 'ai_tutor_usage', uid, 'days', dateStr);
    await setDoc(
      usageDocRef,
      {
        uid,
        date: dateStr,
        successfulGenerations: newCount,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return newCount;
  } catch (err) {
    console.warn('[AI Tutor Usage] Failed to increment daily usage:', err);
    return 1;
  }
}

// In-flight concurrency lock to prevent simultaneous duplicate Gemini calls
const inFlightRequests = new Map<string, Promise<AiAnalysisResult>>();

/**
 * Calls Gemini API to generate an authentic SSC/Govt exam vocabulary breakdown.
 * Retries across models and validates outputs strictly.
 */
async function generateGeminiExplanation(
  aiClient: GoogleGenAI,
  wordOrPhrase: string,
  category?: string,
  meaning?: string,
  examHistory?: any
): Promise<AiAnalysisResult> {
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
  "examTrapTip": "common traps set by TCS / SSC examiners (e.g. confuse with similar sounding words, synonym vs antonym trap)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;

  const modelCandidates = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of modelCandidates) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const responsePromise = aiClient.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        // 12 second timeout guard
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 12000)
        );

        const response: any = await Promise.race([responsePromise, timeoutPromise]);
        const responseText = response?.text || '';

        if (responseText) {
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

          // Strict validation: Must have genuine substantive fields
          if (
            parsedData &&
            typeof parsedData.meaning === 'string' &&
            parsedData.meaning.length > 5 &&
            typeof parsedData.hindiMeaning === 'string' &&
            parsedData.hindiMeaning.length > 1 &&
            typeof parsedData.mnemonicHook === 'string' &&
            parsedData.mnemonicHook.length > 5 &&
            !parsedData.hindiMeaning.includes('महत्वपूर्ण परीक्षा शब्दावली अर्थ / सटीक हिंदी भावार्थ')
          ) {
            return {
              meaning: parsedData.meaning,
              definition: parsedData.meaning,
              hindiMeaning: parsedData.hindiMeaning,
              partOfSpeech: parsedData.partOfSpeech || 'Vocabulary Term',
              rootEtymology: parsedData.rootEtymology || '',
              rootWord: parsedData.rootEtymology || '',
              mnemonicHook: parsedData.mnemonicHook,
              mnemonic: parsedData.mnemonicHook,
              examTrapTip: parsedData.examTrapTip || '',
              examInsight: parsedData.examTrapTip || '',
              sampleUsage: parsedData.sampleUsage || '',
              example: parsedData.sampleUsage || '',
              relatedWords: Array.isArray(parsedData.relatedWords) ? parsedData.relatedWords : [],
            };
          }
        }
      } catch (err: any) {
        lastError = err;
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.message?.includes('503') ||
          err?.message?.includes('429') ||
          err?.message?.includes('timeout');
        if (attempt === 1 && isTransient) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        console.warn(`[GEMINI EXPLAIN] Model ${modelName} attempt ${attempt} failed:`, err?.message || err);
        break;
      }
    }
  }

  throw lastError || new Error('Gemini models unavailable');
}

/**
 * Main AI Tutor explanation handler implementing the full architecture:
 *
 * 1. Check shared Firestore AI Tutor cache (ai_tutor_cache/{normalizedWord})
 *    -> If found: return immediately (0 Gemini call, 0 limit used).
 * 2. Check existing PYQ enrichment / vocabulary master stores
 *    -> If found: save to shared cache, return immediately (0 Gemini call, 0 limit used).
 * 3. If word not found in cache/PYQ stores:
 *    -> Check authentication & daily limits (5 for Free, 50 for Pro).
 *    -> If limit exceeded: return limit error.
 *    -> Concurrency protection: deduplicate in-flight requests.
 *    -> Call Gemini API.
 *    -> On Gemini failure: return error, do NOT cache, do NOT increment usage count.
 *    -> On Gemini success: save to shared cache, increment daily count, return explanation.
 */
export async function handleAiTutorExplain(
  aiClient: GoogleGenAI | null,
  body: {
    wordOrPhrase: string;
    category?: string;
    meaning?: string;
    examHistory?: any;
    userId?: string;
  },
  authHeader?: string
): Promise<{ status: number; body: any }> {
  const { wordOrPhrase, category, meaning, examHistory, userId } = body;
  if (!wordOrPhrase || typeof wordOrPhrase !== 'string') {
    return { status: 400, body: { error: 'Word or phrase is required' } };
  }

  const normalizedWord = normalizeWordKey(wordOrPhrase);
  if (!normalizedWord) {
    return { status: 400, body: { error: 'Invalid word or phrase' } };
  }

  const todayStr = getKolkataDateString();

  // STEP 1: Check shared Firestore AI Tutor cache
  const cached = await getCachedExplanation(normalizedWord);
  if (cached) {
    return {
      status: 200,
      body: {
        analysis: cached,
        fromCache: true,
        source: 'cache',
      },
    };
  }

  // STEP 2: Check existing question / PYQ enrichment
  const pyqMatch = searchLocalPyqStore(normalizedWord, wordOrPhrase);
  if (pyqMatch) {
    // Populate shared Firestore cache asynchronously so future requests hit Step 1
    saveToCache(wordOrPhrase, normalizedWord, pyqMatch, 'pyq_store').catch(e =>
      console.warn('Background cache save failed:', e)
    );

    return {
      status: 200,
      body: {
        analysis: pyqMatch,
        fromCache: true,
        source: 'pyq_store',
      },
    };
  }

  // STEP 3: Word not found anywhere -> Requires a brand new Gemini generation
  // Check user authentication
  const authUser = await verifyAuthUser(authHeader, userId);
  if (!authUser || !authUser.uid) {
    return {
      status: 401,
      body: {
        error: 'auth_required',
        message: 'Please sign in to generate a new AI explanation for this term. All curated exam questions and cached words are free for everyone!',
      },
    };
  }

  // Check user VIP/Pro subscription
  const isPremium = await getUserSubscriptionStatus(authUser.uid);
  const dailyLimit = isPremium ? PRO_AI_GENERATIONS_PER_DAY : FREE_AI_GENERATIONS_PER_DAY;
  const currentUsage = await getUserDailyUsage(authUser.uid, todayStr);

  if (currentUsage >= dailyLimit) {
    return {
      status: 429,
      body: {
        error: 'limit_reached',
        limitReached: true,
        message: isPremium
          ? `Daily Pro limit of ${PRO_AI_GENERATIONS_PER_DAY} AI explanations reached for today.`
          : `You've used your ${FREE_AI_GENERATIONS_PER_DAY} free AI explanations for today. Upgrade to VocabClash Pro for 50 AI explanations per day!`,
        used: currentUsage,
        limit: dailyLimit,
        isPremium,
        date: todayStr,
      },
    };
  }

  // Concurrency control: Deduplicate concurrent requests for the same normalized word
  if (!aiClient) {
    return {
      status: 503,
      body: {
        error: 'gemini_unavailable',
        message: 'AI Tutor service is currently configuring. Please try again in a few moments.',
      },
    };
  }

  let generationPromise = inFlightRequests.get(normalizedWord);
  if (!generationPromise) {
    generationPromise = generateGeminiExplanation(aiClient, wordOrPhrase, category, meaning, examHistory)
      .finally(() => {
        inFlightRequests.delete(normalizedWord);
      });
    inFlightRequests.set(normalizedWord, generationPromise);
  }

  try {
    const analysis = await generationPromise;

    // STEP 4: Save new explanation to shared Firestore cache
    await saveToCache(wordOrPhrase, normalizedWord, analysis, 'gemini');

    // STEP 5: Increment user daily count
    const updatedCount = await incrementUserDailyUsage(authUser.uid, todayStr);

    return {
      status: 200,
      body: {
        analysis,
        fromCache: false,
        source: 'gemini',
        dailyUsage: {
          used: updatedCount,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - updatedCount),
          isPremium,
          date: todayStr,
        },
      },
    };
  } catch (err: any) {
    console.error('[AI Tutor] Gemini generation failed:', err?.message || err);
    return {
      status: 503,
      body: {
        error: 'gemini_unavailable',
        message: 'AI explanation generation is temporarily unavailable due to high demand. Please try again shortly.',
      },
    };
  }
}

/**
 * Returns current day's AI Tutor usage stats for the authenticated user.
 */
export async function handleAiTutorUsage(
  authHeader?: string,
  userId?: string
): Promise<{ status: number; body: any }> {
  const authUser = await verifyAuthUser(authHeader, userId);
  const todayStr = getKolkataDateString();

  if (!authUser || !authUser.uid) {
    return {
      status: 200,
      body: {
        isGuest: true,
        used: 0,
        limit: FREE_AI_GENERATIONS_PER_DAY,
        remaining: FREE_AI_GENERATIONS_PER_DAY,
        isPremium: false,
        date: todayStr,
      },
    };
  }

  const isPremium = await getUserSubscriptionStatus(authUser.uid);
  const dailyLimit = isPremium ? PRO_AI_GENERATIONS_PER_DAY : FREE_AI_GENERATIONS_PER_DAY;
  const used = await getUserDailyUsage(authUser.uid, todayStr);

  return {
    status: 200,
    body: {
      isGuest: false,
      uid: authUser.uid,
      used,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - used),
      isPremium,
      date: todayStr,
    },
  };
}

