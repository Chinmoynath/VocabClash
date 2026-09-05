import { db } from './firebaseService';
import { doc, getDoc, setDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { generateSmartAnalysis, AiAnalysisResult } from '../utils/aiTutorEngine';

export interface CachedWordRecord extends AiAnalysisResult {
  word: string;
  wordOrPhrase: string;
  category?: string;
  updatedAt?: number;
  cachedAt?: number;
  source?: 'gemini' | 'curated';
}

export interface ExplanationResponse {
  analysis: AiAnalysisResult;
  fromCache: boolean;
  limitReached?: boolean;
  remainingDailyGenerations: number;
  isFreeTier: boolean;
}

const STORAGE_KEY_DAILY_AI_USAGE = 'vocabclash_ai_daily_gen_v2';
const FREE_TIER_DAILY_LIMIT = 5;

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
 * Retrieves explanation for a vocabulary term:
 * 1. Checks local memory / curated knowledge base.
 * 2. Checks Firestore `ai_tutor_cache` (never costs quota, never regenerates).
 * 3. If missing: checks daily quota (Free 5/day, Pro unlimited).
 * 4. Calls Gemini server endpoint if quota available.
 * 5. Saves result to Firestore `ai_tutor_cache`.
 * 6. Gracefully falls back to smart engine if offline / quota exceeded / error.
 */
export async function getWordExplanationWithCache(
  wordOrPhrase: string,
  category: string = 'synonyms',
  isPremium: boolean = false,
  examHistory?: string[]
): Promise<ExplanationResponse> {
  const cleanKey = wordOrPhrase.trim().toLowerCase();
  const usage = getDailyAiGenerationStatus(isPremium);

  // 1. Check local curated knowledge base
  const localCurated = generateSmartAnalysis(cleanKey, category);
  const isDirectCurated = localCurated.mnemonicHook && !localCurated.mnemonicHook.startsWith('Memory Hook for');
  if (isDirectCurated) {
    return {
      analysis: localCurated,
      fromCache: true,
      remainingDailyGenerations: usage.remaining,
      isFreeTier: !isPremium,
    };
  }

  // 2. Check Firestore collection `ai_tutor_cache`
  try {
    const cacheDocRef = doc(db, 'ai_tutor_cache', cleanKey);
    const snap = await getDoc(cacheDocRef);
    if (snap.exists()) {
      const data = snap.data() as CachedWordRecord;
      if (data && (data.meaning || data.mnemonicHook)) {
        return {
          analysis: {
            meaning: data.meaning,
            hindiMeaning: data.hindiMeaning,
            partOfSpeech: data.partOfSpeech,
            rootEtymology: data.rootEtymology,
            mnemonicHook: data.mnemonicHook,
            examTrapTip: data.examTrapTip,
            sampleUsage: data.sampleUsage,
            relatedWords: data.relatedWords || [],
          },
          fromCache: true,
          remainingDailyGenerations: usage.remaining,
          isFreeTier: !isPremium,
        };
      }
    }
  } catch (err) {
    console.warn('[AI Tutor Cache] Firestore cache read error:', err);
  }

  // 3. If word is NOT in cache, check Free vs Pro generation quota
  if (!isPremium && usage.remaining <= 0) {
    // Quota reached: provide deterministic smart analysis with limitReached flag
    return {
      analysis: localCurated,
      fromCache: false,
      limitReached: true,
      remainingDailyGenerations: 0,
      isFreeTier: true,
    };
  }

  // 4. Word is not cached and user has remaining generations: Call server-side Gemini
  try {
    const res = await fetch('/api/gemini/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wordOrPhrase: wordOrPhrase.trim(),
        category,
        meaning: 'Exam vocabulary term',
        examHistory: examHistory || ['SSC CGL', 'SSC CHSL', 'RRB NTPC'],
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.analysis && (json.analysis.mnemonicHook || json.analysis.rootEtymology)) {
        const generatedAnalysis: AiAnalysisResult = json.analysis;

        // Record usage for free users
        let newRemaining = usage.remaining;
        if (!isPremium) {
          newRemaining = recordAiGenerationUsed();
        }

        // 5. Store into Firestore collection `ai_tutor_cache` asynchronously
        try {
          const cacheDocRef = doc(db, 'ai_tutor_cache', cleanKey);
          await setDoc(
            cacheDocRef,
            {
              ...generatedAnalysis,
              word: cleanKey,
              wordOrPhrase: wordOrPhrase.trim(),
              category: category || 'synonyms',
              cachedAt: Date.now(),
              updatedAt: Date.now(),
              source: 'gemini',
            },
            { merge: true }
          );
        } catch (saveErr) {
          console.warn('[AI Tutor Cache] Could not write to Firestore cache:', saveErr);
        }

        return {
          analysis: generatedAnalysis,
          fromCache: false,
          remainingDailyGenerations: newRemaining,
          isFreeTier: !isPremium,
        };
      }
    }
  } catch (apiErr) {
    console.warn('[AI Tutor Cache] Gemini explain fetch error, falling back:', apiErr);
  }

  // 6. Graceful degradation: Fallback to smart analysis
  return {
    analysis: localCurated,
    fromCache: false,
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
        if (data && data.wordOrPhrase) {
          items.push({
            word: data.wordOrPhrase.toUpperCase(),
            category: data.category || 'synonyms',
            tag: 'Cached',
          });
        }
      });
      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn('[AI Tutor Cache] Failed to load recent cached words from Firestore:', err);
  }

  // Fallback curated words
  return [
    { word: 'TACITURN', category: 'antonyms', tag: 'High-Frequency' },
    { word: 'EPHEMERAL', category: 'synonyms', tag: 'Repeated 6x' },
    { word: 'OBSEQUIOUS', category: 'synonyms', tag: 'Bank PO' },
    { word: 'METICULOUS', category: 'synonyms', tag: 'SSC CHSL' },
    { word: 'LACONIC', category: 'antonyms', tag: 'CPO SI' },
    { word: 'BELLIGERENT', category: 'synonyms', tag: 'CDS Exam' },
    { word: 'UBIQUITOUS', category: 'synonyms', tag: 'SSC CGL 2024' },
    { word: 'CANDID', category: 'antonyms', tag: 'Top PYQ' },
  ];
}
