export interface QuestionMasteryRecord {
  word: string;
  correctCount: number;
  incorrectCount: number;
  consecutiveCorrect: number;
  lastAttemptTimestamp: number;
  mastered: boolean; // true when correctCount >= 10
}

const STORAGE_KEY_MASTERY = 'vocabclash_pyq_mastery_v2';

export function getMasteryMap(): Record<string, QuestionMasteryRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MASTERY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveMasteryMap(map: Record<string, QuestionMasteryRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY_MASTERY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function recordQuestionAttempt(word: string, isCorrect: boolean): QuestionMasteryRecord {
  const normalized = word.trim().toUpperCase();
  const map = getMasteryMap();
  const existing = map[normalized] || {
    word: normalized,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveCorrect: 0,
    lastAttemptTimestamp: 0,
    mastered: false,
  };

  if (isCorrect) {
    existing.correctCount += 1;
    existing.consecutiveCorrect += 1;
  } else {
    existing.incorrectCount += 1;
    existing.consecutiveCorrect = 0;
  }

  existing.lastAttemptTimestamp = Date.now();
  // Mastered if answered correctly 10 or more times
  existing.mastered = existing.correctCount >= 10;

  map[normalized] = existing;
  saveMasteryMap(map);
  return existing;
}

export function getWordMastery(word: string): QuestionMasteryRecord | null {
  const normalized = word.trim().toUpperCase();
  const map = getMasteryMap();
  return map[normalized] || null;
}

export function getOverallMasteryStats(): {
  totalPracticed: number;
  masteredCount: number;
  learningCount: number;
} {
  const map = getMasteryMap();
  const entries = Object.values(map);
  const totalPracticed = entries.length;
  const masteredCount = entries.filter(e => e.mastered || e.correctCount >= 10).length;
  const learningCount = totalPracticed - masteredCount;

  return { totalPracticed, masteredCount, learningCount };
}
