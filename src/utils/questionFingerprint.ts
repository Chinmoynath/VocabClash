import { QuestionCategory, ExamType } from '../types';
import { formatExamTag } from '../services/jsonPyqParser';

export interface ExamAppearance {
  examFamily?: string;
  exam: string;
  year: number;
  tier?: string;
  shift?: string | null;
  examDate?: string | null;
  questionNumber?: number | string;
}

/**
 * Normalizes text for deterministic fingerprinting by lowercasing,
 * converting smart quotes/symbols, and collapsing extra whitespace.
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
 * - Ignores exam, year, tier, appearances, and shift metadata.
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
 * Generates a unique key for an individual exam appearance (exam + year + tier).
 */
export function getAppearanceKey(app: ExamAppearance): string {
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
 */
export function sortAppearances(appearances: ExamAppearance[]): ExamAppearance[] {
  return [...appearances].sort((a, b) => {
    const yearDiff = (b.year || 0) - (a.year || 0);
    if (yearDiff !== 0) return yearDiff;
    const examDiff = (a.exam || '').localeCompare(b.exam || '');
    if (examDiff !== 0) return examDiff;
    return (a.tier || '').localeCompare(b.tier || '');
  });
}

/**
 * Merges new appearances into an existing appearance array without duplicate (exam + year + tier).
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
 * Format a single appearance tag
 */
export function formatAppearanceTag(app: ExamAppearance): string {
  return formatExamTag(app.exam, app.year, app.tier);
}

/**
 * Helper to match an exam name string against an ExamType filter
 */
function matchSingleExamName(examName: string, filter: ExamType | string): boolean {
  if (filter === 'ALL' || !filter) return true;

  const target = examName.toLowerCase();
  
  switch (filter) {
    case 'SSC_CGL':
      return target.includes('cgl') || target.includes('combined graduate level');
    case 'SSC_CHSL':
      return target.includes('chsl') || target.includes('combined higher secondary') || target.includes('10+2');
    case 'SSC_CPO':
      return target.includes('cpo') || target.includes('central police') || target.includes('sub-inspector') || target.includes('si');
    case 'SSC_MTS':
      return target.includes('mts') || target.includes('multi tasking') || target.includes('multitasking') || target.includes('havaldar');
    case 'RRB_NTPC':
      return target.includes('ntpc') || target.includes('rrb ntpc');
    case 'RRB_GROUP_D':
      return target.includes('group d') || target.includes('group-d') || target.includes('rrc');
    case 'BANK_PO':
      return target.includes('ibps') || target.includes('sbi') || target.includes('bank') || target.includes('po') || target.includes('clerk') || target.includes('rbi');
    case 'CDS_NDA':
      return target.includes('cds') || target.includes('nda') || target.includes('afcat') || target.includes('capf') || target.includes('defence');
    default: {
      const filterLower = String(filter).toLowerCase();
      return target.includes(filterLower) || filterLower.includes(target);
    }
  }
}

/**
 * Checks if a question matches a selected exam filter.
 * Inspects all appearances, the top-level exam field, and exam history tags.
 */
export function matchesExamFilter(
  question: {
    exam?: string;
    examHistory?: string[];
    appearances?: ExamAppearance[];
  },
  filter: ExamType | string
): boolean {
  if (filter === 'ALL' || !filter) return true;

  // 1. Check appearances array (canonical source)
  if (Array.isArray(question.appearances) && question.appearances.length > 0) {
    if (question.appearances.some(app => app.exam && matchSingleExamName(app.exam, filter))) {
      return true;
    }
  }

  // 2. Check top-level exam field
  if (question.exam && matchSingleExamName(question.exam, filter)) {
    return true;
  }

  // 3. Check legacy examHistory tags
  if (Array.isArray(question.examHistory) && question.examHistory.length > 0) {
    if (question.examHistory.some(tag => matchSingleExamName(tag, filter))) {
      return true;
    }
  }

  return false;
}
