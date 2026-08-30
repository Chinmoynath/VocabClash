import { QuestionCategory } from '../types';
import { ExtractedQuestion, ImportBatch, ReviewStatus } from '../types/pyqImport';
import { questionBankEngine } from './questionBankEngine';

export interface SkippedQuestionItem {
  index: number;
  rawCategory: string;
  question: string;
  reason: string;
}

export interface ParseJSONResult {
  batch: ImportBatch;
  eligibleQuestions: ExtractedQuestion[];
  skippedItems: SkippedQuestionItem[];
  totalInputCount: number;
  duplicateCount: number;
  answerRequiredCount: number;
  approvedCount: number;
}

// Map various raw category strings to canonical VocabClash categories
export function normalizeCategory(raw: any): QuestionCategory | null {
  if (!raw || typeof raw !== 'string') return null;
  const c = raw.trim().toLowerCase().replace(/[-_]/g, ' ');

  if (c === 'synonym' || c === 'synonyms' || c === 'syn') {
    return 'synonyms';
  }
  if (c === 'antonym' || c === 'antonyms' || c === 'ant') {
    return 'antonyms';
  }
  if (
    c === 'ows' || 
    c.includes('one word') || 
    c.includes('oneword') || 
    c.includes('substitution')
  ) {
    return 'ows';
  }
  if (
    c === 'idiom' || 
    c === 'idioms' || 
    c.includes('idiom') || 
    c.includes('phrase')
  ) {
    return 'idioms';
  }

  return null;
}

// Clean option string from leading "A)", "(1)", "B.", etc.
export function cleanOptionText(opt: any): string {
  if (typeof opt !== 'string') {
    return String(opt || '').trim();
  }
  return opt
    .trim()
    .replace(/^(\([a-dA-D1-4]\)|\[[a-dA-D1-4]\]|[a-dA-D1-4][\.\)\:\-]\s*)/, '')
    .trim();
}

// Extract correct index (0-3) from various representations
export function resolveCorrectIndex(
  rawAnswer: any, 
  options: string[]
): number | null {
  if (rawAnswer === null || rawAnswer === undefined || rawAnswer === '') {
    return null;
  }

  // If already a number 0..3
  if (typeof rawAnswer === 'number' && rawAnswer >= 0 && rawAnswer <= 3) {
    return rawAnswer;
  }
  // If 1..4 numeric index
  if (typeof rawAnswer === 'number' && rawAnswer >= 1 && rawAnswer <= 4) {
    return rawAnswer - 1;
  }

  const str = String(rawAnswer).trim();

  // "1", "2", "3", "4"
  if (/^[1-4]$/.test(str)) {
    return parseInt(str, 10) - 1;
  }

  // "0", "1", "2", "3"
  if (/^[0-3]$/.test(str)) {
    return parseInt(str, 10);
  }

  // Single letter "A", "B", "C", "D" or "(A)", "Option A"
  const letterMatch = str.match(/^(?:option\s+)?\(?([a-dA-D])\)?$/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    return letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
  }

  // Check if string matches one of the options text directly
  const cleanAns = cleanOptionText(str).toLowerCase();
  for (let i = 0; i < options.length; i++) {
    const cleanOpt = cleanOptionText(options[i]).toLowerCase();
    if (cleanOpt === cleanAns || cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt)) {
      return i;
    }
  }

  return null;
}

// Extract word or phrase if not explicitly provided
export function extractTargetWordOrPhrase(
  item: any, 
  category: QuestionCategory
): string {
  if (item.wordOrPhrase && typeof item.wordOrPhrase === 'string' && item.wordOrPhrase.trim()) {
    return item.wordOrPhrase.trim();
  }
  if (item.targetWord && typeof item.targetWord === 'string' && item.targetWord.trim()) {
    return item.targetWord.trim();
  }
  if (item.word && typeof item.word === 'string' && item.word.trim()) {
    return item.word.trim();
  }

  const qText = String(item.question || item.questionText || item.prompt || '').trim();

  // Check for quoted word: "WORD" or 'WORD'
  const quoteMatch = qText.match(/['"“]([a-zA-Z\s\-]+)['"”]/);
  if (quoteMatch && quoteMatch[1].trim()) {
    return quoteMatch[1].trim().toUpperCase();
  }

  // For OWS, question is usually the descriptive phrase itself
  if (category === 'ows') {
    return qText.replace(/^select the correct one word for\s*:?/i, '').trim();
  }

  // For Idiom, check for bold or highlighted idiom
  if (category === 'idioms') {
    return qText.replace(/^select the meaning of the idiom\s*:?/i, '').trim();
  }

  return qText || 'PYQ WORD';
}

/**
 * Parse and validate JSON input
 */
export function parseAndValidatePyqJSON(
  jsonContent: string,
  fileName: string = 'import.json',
  metadataOverride?: {
    examFamily?: string;
    exam?: string;
    year?: number;
    tier?: string;
    shift?: string;
    paper?: string;
  }
): ParseJSONResult {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: any) {
    throw new Error(`Invalid JSON syntax: ${err.message || 'Unable to parse file'}`);
  }

  // Detect items array
  let rawList: any[] = [];
  let metaFromFile: any = {};

  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    metaFromFile = parsed.metadata || {};
    if (Array.isArray(parsed.questions)) {
      rawList = parsed.questions;
    } else if (Array.isArray(parsed.items)) {
      rawList = parsed.items;
    } else if (Array.isArray(parsed.data)) {
      rawList = parsed.data;
    } else {
      throw new Error('No questions array found in JSON (expected "questions", "items", or array).');
    }
  } else {
    throw new Error('Unsupported JSON root format. Expected an array or object with questions.');
  }

  const examFamily = metadataOverride?.examFamily || metaFromFile.examFamily || 'SSC';
  const exam = metadataOverride?.exam || metaFromFile.exam || 'SSC CGL';
  const year = metadataOverride?.year || metaFromFile.year || 2024;
  const tier = metadataOverride?.tier || metaFromFile.tier || 'Tier 1';
  const shift = metadataOverride?.shift || metaFromFile.shift || 'Shift 1';
  const paper = metadataOverride?.paper || metaFromFile.paper || 'English';

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Existing questions for deduplication check
  const existingQuestions = questionBankEngine.getAllAvailableQuestions();
  const existingMap = new Map<string, string>(); // key -> question id/word
  existingQuestions.forEach(q => {
    const key = `${q.category}:${q.wordOrPhrase.trim().toUpperCase()}`;
    existingMap.set(key, q.id);
  });

  const eligibleQuestions: ExtractedQuestion[] = [];
  const skippedItems: SkippedQuestionItem[] = [];

  let duplicateCount = 0;
  let answerRequiredCount = 0;
  let approvedCount = 0;

  rawList.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      skippedItems.push({
        index: index + 1,
        rawCategory: 'unknown',
        question: 'Invalid item structure',
        reason: 'Skipped — item is not an object',
      });
      return;
    }

    const rawCategory = String(item.category || item.type || item.section || '').trim();
    const category = normalizeCategory(rawCategory);

    // If category is not in the 4 allowed categories (synonyms, antonyms, ows, idioms)
    if (!category) {
      skippedItems.push({
        index: index + 1,
        rawCategory: rawCategory || 'unspecified',
        question: String(item.question || item.questionText || item.prompt || `Item #${index + 1}`),
        reason: 'Skipped — unsupported category (VocabClash only accepts Synonyms, Antonyms, OWS, and Idioms)',
      });
      return;
    }

    // Extract options
    let rawOptions: any[] = [];
    if (Array.isArray(item.options)) {
      rawOptions = item.options;
    } else if (item.optionA || item.optionB || item.optionC || item.optionD) {
      rawOptions = [item.optionA, item.optionB, item.optionC, item.optionD];
    } else if (item.a || item.b || item.c || item.d) {
      rawOptions = [item.a, item.b, item.c, item.d];
    }

    const cleanedOptions = rawOptions.map(cleanOptionText).filter(opt => Boolean(opt));

    if (cleanedOptions.length < 2) {
      skippedItems.push({
        index: index + 1,
        rawCategory: rawCategory,
        question: String(item.question || `Item #${index + 1}`),
        reason: 'Skipped — insufficient answer options (minimum 4 required)',
      });
      return;
    }

    // Ensure 4 options (pad if 2 or 3)
    while (cleanedOptions.length < 4) {
      cleanedOptions.push(`Option ${cleanedOptions.length + 1}`);
    }
    const finalOptions = cleanedOptions.slice(0, 4);

    const questionPrompt = String(item.question || item.questionText || item.prompt || `Select the correct ${category} option:`).trim();
    const targetWord = extractTargetWordOrPhrase(item, category);

    // Resolve correct answer index
    const correctIdx = resolveCorrectIndex(
      item.correctIndex ?? item.correctAnswer ?? item.answer ?? item.key ?? item.ans,
      finalOptions
    );

    // Deduplication check
    const dedupKey = `${category}:${targetWord.toUpperCase()}`;
    const duplicateOfId = existingMap.get(dedupKey);

    let reviewStatus: ReviewStatus = 'approved';
    let duplicateConfidence: 'exact' | 'high' | 'none' = 'none';

    if (duplicateOfId) {
      reviewStatus = 'duplicate';
      duplicateConfidence = 'exact';
      duplicateCount++;
    } else if (correctIdx === null) {
      reviewStatus = 'answer_required';
      answerRequiredCount++;
    } else {
      reviewStatus = 'approved';
      approvedCount++;
    }

    const tempId = `json_${batchId}_${index + 1}`;

    eligibleQuestions.push({
      tempId,
      question: questionPrompt,
      wordOrPhrase: targetWord,
      options: finalOptions,
      correctIndex: correctIdx,
      category,
      meaning: item.meaning || '',
      hindiMeaning: item.hindiMeaning || '',
      examFamily: item.examFamily || examFamily,
      exam: item.exam || exam,
      year: parseInt(item.year, 10) || year,
      tier: item.tier || tier,
      shift: item.shift || shift,
      paper: item.paper || paper,
      reviewStatus,
      duplicateConfidence,
      duplicateOfId,
      duplicateOfQuestion: duplicateOfId ? targetWord : undefined,
      sourceType: 'json_import',
      sourceFileName: fileName,
      rawText: JSON.stringify(item),
    });
  });

  const batch: ImportBatch = {
    batchId,
    sourceFileName: fileName,
    examFamily,
    exam,
    year,
    tier,
    shift,
    paper,
    dateImported: Date.now(),
    totalDetected: eligibleQuestions.length,
    approvedCount,
    needsReviewCount: answerRequiredCount,
    duplicateCount,
    rejectedCount: 0,
    status: 'pending_review',
  };

  return {
    batch,
    eligibleQuestions,
    skippedItems,
    totalInputCount: rawList.length,
    duplicateCount,
    answerRequiredCount,
    approvedCount,
  };
}
