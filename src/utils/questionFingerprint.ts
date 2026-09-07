import { QuestionCategory, ExamType, ImportanceLevel, ExamAppearance } from '../types';
import { formatExamTag } from '../services/jsonPyqParser';

export type { ExamAppearance };

/**
 * Normalizes text for deterministic fingerprinting by lowercasing,
 * converting smart quotes/symbols, stripping non-alphanumerics, and collapsing extra whitespace.
 */
export function normalizeTextForFingerprint(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a deterministic question fingerprint.
 * 
 * Rules:
 * - Differentiates between Synonyms and Antonyms of the same word (category is included).
 * - Differentiates questions that have different answer options or correct answers.
 * - Ignores exam, year, tier, appearances, date, and shift metadata.
 */
export function computeQuestionFingerprint(
  category: string,
  wordOrPhrase: string,
  options: string[],
  correctIndexOrAnswer: number | string | null | undefined,
  _questionPrompt?: string
): string {
  const normCat = (category || '').toLowerCase().trim();
  const normWord = normalizeTextForFingerprint(wordOrPhrase);

  let correctAnswerText = '';
  if (typeof correctIndexOrAnswer === 'number' && correctIndexOrAnswer >= 0 && correctIndexOrAnswer < options.length) {
    correctAnswerText = options[correctIndexOrAnswer] || '';
  } else if (typeof correctIndexOrAnswer === 'string') {
    correctAnswerText = correctIndexOrAnswer;
  }
  const normCorrectAnswer = normalizeTextForFingerprint(correctAnswerText);

  // Normalize and sort options to detect canonical equivalence even if option positions shift
  const normOptions = options
    .map(opt => normalizeTextForFingerprint(opt))
    .filter(Boolean)
    .sort()
    .join('|');

  return `${normCat}:::${normWord}:::${normCorrectAnswer}:::${normOptions}`;
}

/**
 * Computes a question identity key that excludes the correct answer.
 * Used to detect answer conflicts (i.e. identical category, prompt, and options,
 * but conflicting correct answer keys).
 */
export function computeQuestionIdentityKey(
  category: string,
  wordOrPhrase: string,
  options: string[],
  _questionPrompt?: string
): string {
  const normCat = (category || '').toLowerCase().trim();
  const normWord = normalizeTextForFingerprint(wordOrPhrase);

  const normOptions = options
    .map(opt => normalizeTextForFingerprint(opt))
    .filter(Boolean)
    .sort()
    .join('|');

  return `${normCat}:::${normWord}:::${normOptions}`;
}

/**
 * Fast deterministic hash for generating canonical Firestore document IDs
 */
function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Generates a stable canonical question document ID from a fingerprint.
 */
export function generateCanonicalQuestionId(
  category: string,
  wordOrPhrase: string,
  options: string[],
  correctIndexOrAnswer: number | string | null | undefined
): string {
  const fp = computeQuestionFingerprint(category, wordOrPhrase, options, correctIndexOrAnswer);
  const normWord = normalizeTextForFingerprint(wordOrPhrase).replace(/\s+/g, '_').slice(0, 24);
  const catPrefix = (category || 'pyq').toLowerCase().slice(0, 3);
  const hash = fnv1a32(fp);
  return `pyq_${catPrefix}_${normWord || 'item'}_${hash}`;
}

/**
 * Generates a unique key for an individual exam appearance (exam + year + tier).
 */
export function getAppearanceKey(app: ExamAppearance): string {
  const normEx = (app.exam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const yr = app.year || 0;
  const normTr = (app.tier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normShift = (app.shift || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normDate = (app.examDate || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normShift || normDate) {
    return `${normEx}_${yr}_${normTr}_${normShift}_${normDate}`;
  }
  return `${normEx}_${yr}_${normTr}`;
}

/**
 * Generates a coarse exam key (exam + year + tier) for deduplicating repeated batch occurrences.
 */
export function getCoarseAppearanceKey(app: ExamAppearance): string {
  const normEx = (app.exam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const yr = app.year || 0;
  const normTr = (app.tier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normEx}_${yr}_${normTr}`;
}

/**
 * Sorts appearances deterministically:
 * 1. Newest year first
 * 2. Exam name alphabetically
 * 3. Tier/stage name
 * 4. Shift/Date
 */
export function sortAppearances(appearances: ExamAppearance[]): ExamAppearance[] {
  return [...appearances].sort((a, b) => {
    const yearDiff = (b.year || 0) - (a.year || 0);
    if (yearDiff !== 0) return yearDiff;
    const examDiff = (a.exam || '').localeCompare(b.exam || '');
    if (examDiff !== 0) return examDiff;
    const tierDiff = (a.tier || '').localeCompare(b.tier || '');
    if (tierDiff !== 0) return tierDiff;
    return (a.shift || '').localeCompare(b.shift || '');
  });
}

/**
 * Merges new appearances into an existing appearance array without duplicates.
 */
export function mergeAppearances(
  existingList: ExamAppearance[] | undefined,
  incoming: ExamAppearance[] | ExamAppearance
): { merged: ExamAppearance[]; addedCount: number } {
  const existingMap = new Map<string, ExamAppearance>();
  
  if (Array.isArray(existingList)) {
    for (const app of existingList) {
      if (app && app.exam) {
        existingMap.set(getAppearanceKey(app), { ...app });
      }
    }
  }

  const incomingArray = Array.isArray(incoming) ? incoming : [incoming];
  let addedCount = 0;

  for (const inc of incomingArray) {
    if (!inc || !inc.exam) continue;
    const key = getAppearanceKey(inc);
    if (!existingMap.has(key)) {
      existingMap.set(key, { ...inc });
      addedCount++;
    }
  }

  const merged = sortAppearances(Array.from(existingMap.values()));
  return { merged, addedCount };
}

/**
 * Computes the dynamic importance level based on verified appearances count:
 * - 1 appearance: high
 * - 2-3 appearances: very-high
 * - 4+ appearances: ultra-high
 */
export function computeImportanceLevel(repeatCount: number): ImportanceLevel {
  if (repeatCount >= 4) return 'ultra-high';
  if (repeatCount >= 2) return 'very-high';
  return 'high';
}

/**
 * Computes repeat count based on actual appearances and optional base repeats.
 */
export function computeRepeatCount(
  appearances?: ExamAppearance[], 
  baseRepeatCount?: number
): number {
  const appCount = Array.isArray(appearances) ? appearances.length : 0;
  return Math.max(appCount, baseRepeatCount || 1, 1);
}

/**
 * Formats repeat count for UI displays:
 * If the number is greater than 5 (e.g. 6, 21), returns '>5x'.
 * If 5 or below (e.g. 2, 3, 4, 5), returns `${count}x`.
 */
export function formatRepeatCount(count?: number | null): string {
  const num = typeof count === 'number' ? count : Number(count) || 0;
  if (num > 5) {
    return '>5x';
  }
  if (num >= 2) {
    return `${num}x`;
  }
  return `${Math.max(1, num)}x`;
}

/**
 * Formats full repeated badge label:
 * If count > 5, returns 'Repeated >5x'.
 * If count <= 5, returns 'Repeated ${count}x'.
 */
export function formatRepeatedText(count?: number | null): string {
  return `Repeated ${formatRepeatCount(count)}`;
}

/**
 * Format a single appearance tag
 */
export function formatAppearanceTag(app: ExamAppearance): string {
  return formatExamTag(app.exam, app.year, app.tier);
}

import { 
  matchesExamFamilyFilter, 
  normalizeExamFamily, 
  normalizeFilterToFamily, 
  CanonicalExamFamily 
} from './examFamilyUtils';

export { 
  matchesExamFamilyFilter, 
  normalizeExamFamily, 
  normalizeFilterToFamily, 
};
export type { CanonicalExamFamily };

/**
 * Checks if a question matches a selected exam filter.
 * Uses centralized exam family normalization.
 */
export function matchesExamFilter(
  question: {
    exam?: string;
    examFamily?: string;
    examHistory?: string[];
    appearances?: ExamAppearance[];
  },
  filter: ExamType | string
): boolean {
  return matchesExamFamilyFilter(question, filter);
}

