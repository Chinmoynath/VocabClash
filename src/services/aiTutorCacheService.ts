import { db } from './firebaseService';
import { doc, getDoc, setDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { generateSmartAnalysis, AiAnalysisResult } from '../utils/aiTutorEngine';
import { HIGH_YIELD_EXAM_VOCAB } from '../utils/questionEducationResolver';
import { fetchFreeDictionaryEntry, DictionaryEntry } from './freeDictionaryService';

export interface CachedWordRecord {
  word: string;
  wordOrPhrase: string;
  category?: string;
  partOfSpeech?: string;
  meaning?: string;
  definition?: string;
  hindiMeaning?: string;
  rootEtymology?: string;
  rootWord?: string;
  mnemonicHook?: string;
  mnemonic?: string;
  examTrapTip?: string;
  sampleUsage?: string;
  example?: string;
  relatedWords?: string[];
  synonyms?: string[];
  antonyms?: string[];
  phonetic?: string;
  source?: {
    dictionary: boolean;
    geminiEnrichment: boolean;
  };
  sourceType?: 'cache' | 'dictionary' | 'gemini_enriched' | 'curated';
  cachedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ExplanationResponse {
  analysis: AiAnalysisResult;
  fromCache: boolean;
  source?: 'cache' | 'dictionary' | 'gemini' | 'curated';
  aiEnrichmentAvailable?: boolean;
  limitReached?: boolean;
  remainingDailyGenerations: number;
  isFreeTier: boolean;
  notFound?: boolean;
  message?: string;
}

const STORAGE_KEY_DAILY_AI_USAGE = 'vocabclash_ai_daily_gen_v2';
const FREE_TIER_DAILY_LIMIT = 100;

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns current day usage of AI generations for free users.
 */
export function getDailyAiGenerationStatus(isPremium: boolean = false): {
  count: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
  date: string;
} {
  if (isPremium) {
    return { count: 0, limit: Infinity, remaining: Infinity, isPremium: true, date: getTodayKey() };
  }

  const today = getTodayKey();
  let count = 0;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DAILY_AI_USAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today && typeof parsed.count === 'number') {
          count = parsed.count;
        }
      }
    } catch {}
  }

  const remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - count);
  return {
    count,
    limit: FREE_TIER_DAILY_LIMIT,
    remaining,
    isPremium: false,
    date: today,
  };
}

/**
 * Increments the local usage count for a new AI word generation.
 * ONLY called after a genuinely successful Gemini generation.
 */
export function recordAiGenerationUsed(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  const today = getTodayKey();
  const current = getDailyAiGenerationStatus(false);
  const nextCount = current.count + 1;
  try {
    localStorage.setItem(
      STORAGE_KEY_DAILY_AI_USAGE,
      JSON.stringify({ date: today, count: nextCount })
    );
  } catch {}
  return Math.max(0, FREE_TIER_DAILY_LIMIT - nextCount);
}

/**
 * Normalizes searched word string: trims, lowercases, removes extra internal spaces.
 */
export function normalizeWordKey(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Robust Word Search & AI Tutor Explanation Pipeline:
 *
 * STEP 1: Normalize word.
 * STEP 2: Check global Firestore `ai_tutor_cache`. If HIT -> return immediately (no Gemini call).
 * STEP 3: Free Dictionary lookup (`https://api.dictionaryapi.dev/api/v2/entries/en/{word}`).
 * STEP 4: If dictionary succeeds, attempt optional Gemini enrichment.
 * STEP 5: If Gemini fails (405, 429, 500, timeout), fallback gracefully to dictionary result.
 * STEP 6: Save valid results to Firestore `ai_tutor_cache` (never save placeholders or errors).
 * STEP 7: If word is not found anywhere, return clear notFound state without breaking UI.
 */
export async function getWordExplanationWithCache(
  wordOrPhrase: string,
  category: string = 'synonyms',
  isPremium: boolean = false,
  examHistory?: string[]
): Promise<ExplanationResponse> {
  const cleanKey = normalizeWordKey(wordOrPhrase);
  const usage = getDailyAiGenerationStatus(isPremium);

  if (!cleanKey) {
    return {
      analysis: {
        rootEtymology: '',
        mnemonicHook: '',
        examTrapTip: '',
        sampleUsage: '',
        relatedWords: [],
      },
      fromCache: false,
      notFound: true,
      message: "We couldn't find this word. Check the spelling and try again.",
      remainingDailyGenerations: usage.remaining,
      isFreeTier: !isPremium,
    };
  }

  // =========================================================================
  // STEP 2: Check existing global Firestore cache (ai_tutor_cache)
  // =========================================================================
  try {
    const cacheDocRef = doc(db, 'ai_tutor_cache', cleanKey);
    const snap = await getDoc(cacheDocRef);
    if (snap.exists()) {
      const data = snap.data() as CachedWordRecord;
      const validDefinition = data.meaning || data.definition;
      if (data && validDefinition && !validDefinition.startsWith('Primary exam definition and context for')) {
        console.log(`Word lookup: ${cleanKey}\nCache: HIT\nReturned: CACHE HIT`);
        const isEnriched = data.source?.geminiEnrichment ?? (data.sourceType === 'gemini_enriched' || !!data.mnemonicHook);
        return {
          analysis: {
            meaning: validDefinition,
            hindiMeaning: data.hindiMeaning || '',
            partOfSpeech: data.partOfSpeech || 'Vocabulary Term',
            rootEtymology: data.rootEtymology || data.rootWord || '',
            mnemonicHook: data.mnemonicHook || data.mnemonic || '',
            examTrapTip: data.examTrapTip || '',
            sampleUsage: data.sampleUsage || data.example || '',
            relatedWords: data.relatedWords || data.synonyms || [],
            phonetic: data.phonetic,
            synonyms: data.synonyms,
            antonyms: data.antonyms,
          },
          fromCache: true,
          source: 'cache',
          aiEnrichmentAvailable: isEnriched,
          remainingDailyGenerations: usage.remaining,
          isFreeTier: !isPremium,
        };
      }
    }
  } catch (err) {
    console.warn('[AI Tutor Cache] Firestore cache read error:', err);
  }

  console.log(`Word lookup: ${cleanKey}\nCache: MISS`);

  // =========================================================================
  // STEP 3: Free Dictionary Fallback
  // =========================================================================
  const dictEntry: DictionaryEntry | null = await fetchFreeDictionaryEntry(cleanKey);
  if (dictEntry) {
    console.log('Dictionary: SUCCESS');
  } else {
    console.log('Dictionary: NOT_FOUND');
  }

  // Check local curated knowledge base if dictionary did not have it
  const localCurated = generateSmartAnalysis(cleanKey, category);
  const highYieldRecord = HIGH_YIELD_EXAM_VOCAB[cleanKey];

  // Baseline dictionary analysis if available
  let baseAnalysis: AiAnalysisResult | null = null;
  if (dictEntry) {
    baseAnalysis = {
      meaning: dictEntry.definition,
      partOfSpeech: dictEntry.partOfSpeech,
      sampleUsage: dictEntry.example || '',
      rootEtymology: '',
      mnemonicHook: '',
      examTrapTip: '',
      relatedWords: dictEntry.synonyms || [],
      phonetic: dictEntry.phonetic,
      synonyms: dictEntry.synonyms,
      antonyms: dictEntry.antonyms,
    };
  } else if (localCurated) {
    baseAnalysis = localCurated;
  } else if (highYieldRecord) {
    baseAnalysis = {
      meaning: highYieldRecord.english,
      hindiMeaning: highYieldRecord.hindi,
      partOfSpeech: 'Exam Vocabulary',
      rootEtymology: highYieldRecord.root || '',
      mnemonicHook: highYieldRecord.mnemonic || '',
      examTrapTip: 'High-frequency PYQ term. Verify synonym vs antonym requirement in the question statement.',
      sampleUsage: highYieldRecord.example || `The term "${cleanKey}" is frequently tested in SSC and Banking exams.`,
      relatedWords: [cleanKey, 'High-Yield PYQ', 'Exam Essential'],
    };
  }

  // =========================================================================
  // STEP 4: Optional Gemini Enrichment
  // =========================================================================
  const canAttemptGemini = isPremium || usage.remaining > 0;
  let geminiSuccess = false;
  let enrichedAnalysis: AiAnalysisResult | null = null;

  if (canAttemptGemini) {
    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordOrPhrase: cleanKey,
          category,
          meaning: baseAnalysis?.meaning || 'Exam vocabulary term',
          examHistory: examHistory || ['SSC CGL', 'SSC CHSL', 'RRB NTPC'],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const geminiAnalysis = json?.analysis;
        // Verify genuine response
        if (
          geminiAnalysis &&
          (geminiAnalysis.mnemonicHook || geminiAnalysis.rootEtymology || geminiAnalysis.meaning) &&
          !geminiAnalysis.meaning?.startsWith('Primary definition and competitive exam usage context')
        ) {
          console.log('Gemini: SUCCESS');
          geminiSuccess = true;

          enrichedAnalysis = {
            meaning: geminiAnalysis.meaning || baseAnalysis?.meaning || '',
            hindiMeaning: geminiAnalysis.hindiMeaning || baseAnalysis?.hindiMeaning || '',
            partOfSpeech: geminiAnalysis.partOfSpeech || baseAnalysis?.partOfSpeech || 'Vocabulary Term',
            rootEtymology: geminiAnalysis.rootEtymology || baseAnalysis?.rootEtymology || '',
            mnemonicHook: geminiAnalysis.mnemonicHook || baseAnalysis?.mnemonicHook || '',
            examTrapTip: geminiAnalysis.examTrapTip || baseAnalysis?.examTrapTip || '',
            sampleUsage: geminiAnalysis.sampleUsage || baseAnalysis?.sampleUsage || '',
            relatedWords: geminiAnalysis.relatedWords?.length
              ? geminiAnalysis.relatedWords
              : (baseAnalysis?.relatedWords || []),
            phonetic: baseAnalysis?.phonetic,
            synonyms: baseAnalysis?.synonyms,
            antonyms: baseAnalysis?.antonyms,
          };

          // Increment generation count ONLY on genuine Gemini success
          if (!isPremium) {
            recordAiGenerationUsed();
          }
        }
      } else {
        console.log(`Gemini: ${res.status}`);
      }
    } catch (apiErr: any) {
      console.log(`Gemini: ${apiErr?.message || 'FAILED'}`);
    }
  }

  // =========================================================================
  // STEP 5: Final Result Selection & Valid Firestore Cache Saving
  // =========================================================================

  // Scenario A: Gemini Enriched Result
  if (geminiSuccess && enrichedAnalysis) {
    try {
      const cacheDocRef = doc(db, 'ai_tutor_cache', cleanKey);
      await setDoc(
        cacheDocRef,
        {
          word: cleanKey,
          wordOrPhrase: cleanKey,
          meaning: enrichedAnalysis.meaning,
          definition: enrichedAnalysis.meaning,
          partOfSpeech: enrichedAnalysis.partOfSpeech,
          hindiMeaning: enrichedAnalysis.hindiMeaning,
          rootEtymology: enrichedAnalysis.rootEtymology,
          rootWord: enrichedAnalysis.rootEtymology,
          mnemonicHook: enrichedAnalysis.mnemonicHook,
          mnemonic: enrichedAnalysis.mnemonicHook,
          examTrapTip: enrichedAnalysis.examTrapTip,
          sampleUsage: enrichedAnalysis.sampleUsage,
          example: enrichedAnalysis.sampleUsage,
          relatedWords: enrichedAnalysis.relatedWords,
          synonyms: enrichedAnalysis.synonyms || [],
          antonyms: enrichedAnalysis.antonyms || [],
          phonetic: enrichedAnalysis.phonetic || '',
          source: {
            dictionary: !!dictEntry,
            geminiEnrichment: true,
          },
          sourceType: 'gemini_enriched',
          cachedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      console.log('Cache write: SUCCESS\nReturned: GEMINI ENRICHED RESULT');
    } catch (saveErr) {
      console.warn('[AI Tutor Cache] Firestore cache write warning:', saveErr);
    }

    return {
      analysis: enrichedAnalysis,
      fromCache: false,
      source: 'gemini',
      aiEnrichmentAvailable: true,
      remainingDailyGenerations: getDailyAiGenerationStatus(isPremium).remaining,
      isFreeTier: !isPremium,
    };
  }

  // Scenario B: Dictionary / Curated Result (Gemini failed or was bypassed)
  if (baseAnalysis && baseAnalysis.meaning) {
    console.log('Returned: DICTIONARY FALLBACK');
    // Save clean verified dictionary definition to Firestore cache so subsequent lookups are instant
    try {
      const cacheDocRef = doc(db, 'ai_tutor_cache', cleanKey);
      await setDoc(
        cacheDocRef,
        {
          word: cleanKey,
          wordOrPhrase: cleanKey,
          meaning: baseAnalysis.meaning,
          definition: baseAnalysis.meaning,
          partOfSpeech: baseAnalysis.partOfSpeech || 'Vocabulary Term',
          hindiMeaning: baseAnalysis.hindiMeaning || '',
          rootEtymology: baseAnalysis.rootEtymology || '',
          rootWord: baseAnalysis.rootEtymology || '',
          mnemonicHook: baseAnalysis.mnemonicHook || '',
          mnemonic: baseAnalysis.mnemonicHook || '',
          examTrapTip: baseAnalysis.examTrapTip || '',
          sampleUsage: baseAnalysis.sampleUsage || '',
          example: baseAnalysis.sampleUsage || '',
          relatedWords: baseAnalysis.relatedWords || [],
          synonyms: baseAnalysis.synonyms || [],
          antonyms: baseAnalysis.antonyms || [],
          phonetic: baseAnalysis.phonetic || '',
          source: {
            dictionary: !!dictEntry,
            geminiEnrichment: false,
          },
          sourceType: dictEntry ? 'dictionary' : 'curated',
          cachedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      console.log('Cache write: SUCCESS');
    } catch (saveErr) {
      console.warn('[AI Tutor Cache] Firestore cache write warning:', saveErr);
    }

    return {
      analysis: baseAnalysis,
      fromCache: false,
      source: dictEntry ? 'dictionary' : 'curated',
      aiEnrichmentAvailable: false,
      remainingDailyGenerations: usage.remaining,
      isFreeTier: !isPremium,
    };
  }

  // Scenario C: Word Not Found (Neither in Dictionary, Curated, nor Gemini)
  console.log(`Word lookup: ${cleanKey}\nReturned: WORD NOT FOUND`);
  return {
    analysis: {
      rootEtymology: '',
      mnemonicHook: '',
      examTrapTip: '',
      sampleUsage: '',
      relatedWords: [],
    },
    fromCache: false,
    notFound: true,
    message: "We couldn't find this word. Check the spelling and try again.",
    remainingDailyGenerations: usage.remaining,
    isFreeTier: !isPremium,
  };
}

/**
 * Fetches recent cached explanations from `ai_tutor_cache` for quick discovery.
 */
export async function getRecentCachedWords(limitCount: number = 8): Promise<{ word: string; category?: string; tag?: string }[]> {
  try {
    const q = query(collection(db, 'ai_tutor_cache'), limit(limitCount));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: { word: string; category?: string; tag?: string }[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && (data.wordOrPhrase || data.word)) {
          const w = (data.wordOrPhrase || data.word).toUpperCase();
          items.push({
            word: w,
            category: data.category || 'synonyms',
            tag: data.source?.geminiEnrichment ? 'AI Enriched' : 'Cached',
          });
        }
      });
      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn('[AI Tutor Cache] Failed to load recent cached words from Firestore:', err);
  }

  // Fallback curated high-yield exam words
  return [
    { word: 'ABERRATION', category: 'synonyms', tag: 'High-Yield' },
    { word: 'TACITURN', category: 'antonyms', tag: 'SSC CGL' },
    { word: 'EPHEMERAL', category: 'synonyms', tag: 'Repeated 6x' },
    { word: 'OBSEQUIOUS', category: 'synonyms', tag: 'Bank PO' },
    { word: 'METICULOUS', category: 'synonyms', tag: 'SSC CHSL' },
    { word: 'LACONIC', category: 'antonyms', tag: 'CPO SI' },
    { word: 'BELLIGERENT', category: 'synonyms', tag: 'CDS Exam' },
    { word: 'UBIQUITOUS', category: 'synonyms', tag: 'Tier-1 PYQ' },
  ];
}
