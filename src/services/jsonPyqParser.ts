import { QuestionCategory } from '../types';
import { ExtractedQuestion, ImportBatch, ReviewStatus } from '../types/pyqImport';
import { questionBankEngine } from './questionBankEngine';

export interface SkippedQuestionItem {
  index: number;
  rawCategory: string;
  question: string;
  reason: string;
}

export interface ExtractedJsonMetadata {
  examFamily?: string;
  exam?: string;
  year?: number;
  shift?: string | null;
  tier?: string;
  paper?: string;
}

export function extractJsonMetadata(jsonContent: string): ExtractedJsonMetadata | null {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') return null;
    const meta = parsed.metadata || (Array.isArray(parsed) ? null : parsed);
    if (!meta || typeof meta !== 'object') return null;

    const result: ExtractedJsonMetadata = {};
    if (meta.examFamily && typeof meta.examFamily === 'string') result.examFamily = meta.examFamily.trim();
    if (meta.exam && typeof meta.exam === 'string') result.exam = meta.exam.trim();
    if (meta.year && !isNaN(parseInt(meta.year, 10))) result.year = parseInt(meta.year, 10);
    if (meta.shift !== undefined) {
      const s = String(meta.shift).trim();
      result.shift = (s && s !== 'Not Specified' && s !== 'null' && s !== 'undefined') ? s : null;
    }
    if (meta.tier && typeof meta.tier === 'string') result.tier = meta.tier.trim();
    if (meta.paper && typeof meta.paper === 'string') result.paper = meta.paper.trim();

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
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

  const fallbackExamFamily = 'SSC';
  const fallbackExam = 'SSC CGL';
  const fallbackYear = 2024;
  const fallbackTier = 'Tier 1';
  const fallbackPaper = 'English';

  const defaultExamFamily = metadataOverride?.examFamily || metaFromFile.examFamily || fallbackExamFamily;
  const defaultExam = metadataOverride?.exam || metaFromFile.exam || fallbackExam;
  const defaultYear = metadataOverride?.year || (metaFromFile.year ? parseInt(metaFromFile.year, 10) : undefined) || fallbackYear;
  const defaultTier = metadataOverride?.tier || metaFromFile.tier || fallbackTier;
  
  // Shift priority: override -> file metadata -> null (do NOT invent a shift)
  const resolveShift = (val?: any): string | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (!str || str === 'Not Specified' || str === 'null' || str === 'undefined') return null;
    return str;
  };

  const defaultShift = resolveShift(metadataOverride?.shift ?? metaFromFile.shift);
  const defaultPaper = metadataOverride?.paper || metaFromFile.paper || fallbackPaper;

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

    // Metadata Priority: QUESTION-LEVEL VALUE -> JSON METADATA VALUE -> ADMIN FORM VALUE
    const itemExamFamily = item.examFamily || metaFromFile.examFamily || metadataOverride?.examFamily || fallbackExamFamily;
    const itemExam = item.exam || metaFromFile.exam || metadataOverride?.exam || fallbackExam;
    const itemYear = (item.year !== undefined && !isNaN(parseInt(item.year, 10))) 
      ? parseInt(item.year, 10) 
      : ((metaFromFile.year !== undefined && !isNaN(parseInt(metaFromFile.year, 10)))
        ? parseInt(metaFromFile.year, 10)
        : (metadataOverride?.year || fallbackYear));
    const itemShift = resolveShift(item.shift) ?? resolveShift(metaFromFile.shift) ?? resolveShift(metadataOverride?.shift);
    const itemTier = item.tier || metaFromFile.tier || metadataOverride?.tier || fallbackTier;
    const itemPaper = item.paper || metaFromFile.paper || metadataOverride?.paper || fallbackPaper;
    const itemQuestionNumber = item.questionNumber ?? item.qNo ?? item.qNumber ?? item.questionNo ?? item.number ?? (index + 1);

    // Validate and preserve incoming optionDetails if 4 valid items provided
    let incomingOptionDetails: any = undefined;
    if (Array.isArray(item.optionDetails) && item.optionDetails.length === 4) {
      const isValid = item.optionDetails.every((od: any) => od && typeof od === 'object' && (od.option !== undefined || od.text !== undefined));
      if (isValid) {
        incomingOptionDetails = item.optionDetails.map((od: any, odIdx: number) => ({
          option: String(od.option || od.text || finalOptions[odIdx] || '').trim(),
          englishMeaning: String(od.englishMeaning || od.meaning || od.definition || '').trim(),
          hindiMeaning: String(od.hindiMeaning || od.hindi || od.hindiTranslation || '').trim(),
          explanation: od.explanation ? String(od.explanation).trim() : (od.shortExplanation ? String(od.shortExplanation).trim() : undefined),
          shortExplanation: od.shortExplanation ? String(od.shortExplanation).trim() : (od.explanation ? String(od.explanation).trim() : undefined),
          mnemonicHook: od.mnemonicHook ? String(od.mnemonicHook).trim() : (od.mnemonic ? String(od.mnemonic).trim() : undefined),
          isCorrect: od.isCorrect !== undefined ? Boolean(od.isCorrect) : (odIdx === correctIdx),
        }));
      }
    }

    const itemMeaning = String(item.meaning || item.englishMeaning || item.definition || item.wordMeaning || '').trim();
    const itemHindiMeaning = String(item.hindiMeaning || item.hindi || item.hindiDefinition || item.hindiTranslation || '').trim();
    const itemMnemonic = String(item.mnemonic || item.mnemonicHook || item.memoryHook || item.trick || '').trim();
    const itemExampleSentence = String(item.exampleSentence || item.example || item.sentence || item.usage || '').trim();
    const itemRootWordInfo = String(item.rootWordInfo || item.root || item.etymology || item.rootEtymology || '').trim();
    const itemExplanation = String(item.explanation || item.solution || item.examRationale || item.rationale || '').trim();

    // Determine initial enrichment status if pre-populated
    let incomingEnrichment = item.enrichment;
    if (!incomingEnrichment && itemMeaning && itemHindiMeaning && itemMnemonic && itemExampleSentence && incomingOptionDetails) {
      incomingEnrichment = {
        status: 'complete',
        version: 'json-provided',
        enrichedAt: Date.now(),
        provider: 'json_source'
      };
    }

    eligibleQuestions.push({
      tempId,
      question: questionPrompt,
      wordOrPhrase: targetWord,
      options: finalOptions,
      correctIndex: correctIdx,
      category,
      instruction: item.instruction ? String(item.instruction).trim() : undefined,
      meaning: itemMeaning,
      hindiMeaning: itemHindiMeaning,
      mnemonic: itemMnemonic,
      exampleSentence: itemExampleSentence,
      rootWordInfo: itemRootWordInfo,
      explanation: itemExplanation,
      optionDetails: incomingOptionDetails,
      enrichment: incomingEnrichment,
      examFamily: itemExamFamily,
      exam: itemExam,
      year: itemYear,
      tier: itemTier,
      shift: itemShift,
      questionNumber: itemQuestionNumber,
      paper: itemPaper,
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
    examFamily: defaultExamFamily,
    exam: defaultExam,
    year: defaultYear,
    tier: defaultTier,
    shift: defaultShift || undefined,
    paper: defaultPaper,
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
