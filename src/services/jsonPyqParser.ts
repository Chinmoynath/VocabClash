import { Question, QuestionCategory } from '../types';
import { ExtractedQuestion, ImportBatch, ReviewStatus } from '../types/pyqImport';
import { questionBankEngine } from './questionBankEngine';
import { normalizeTier } from '../config/examMetadataConfig';
import { 
  computeQuestionFingerprint, 
  computeQuestionIdentityKey,
  generateCanonicalQuestionId,
  getAppearanceKey, 
  getCoarseAppearanceKey,
  mergeAppearances, 
  ExamAppearance 
} from '../utils/questionFingerprint';

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
  examDate?: string | null;
  tier?: string;
  paper?: string;
}

export function normalizeExamDate(rawDate: any): string | null {
  if (!rawDate && rawDate !== 0) return null;
  const str = String(rawDate).trim();
  if (!str || str === 'null' || str === 'undefined' || str === 'Not Specified') return null;

  const monthMap: Record<string, string> = {
    '1': 'Jan', '01': 'Jan', 'jan': 'Jan', 'january': 'Jan',
    '2': 'Feb', '02': 'Feb', 'feb': 'Feb', 'february': 'Feb',
    '3': 'Mar', '03': 'Mar', 'mar': 'Mar', 'march': 'Mar',
    '4': 'Apr', '04': 'Apr', 'apr': 'Apr', 'april': 'Apr',
    '5': 'May', '05': 'May', 'may': 'May',
    '6': 'Jun', '06': 'Jun', 'jun': 'Jun', 'june': 'Jun',
    '7': 'Jul', '07': 'Jul', 'jul': 'Jul', 'july': 'Jul',
    '8': 'Aug', '08': 'Aug', 'aug': 'Aug', 'august': 'Aug',
    '9': 'Sept', '09': 'Sept', 'sep': 'Sept', 'sept': 'Sept', 'september': 'Sept',
    '10': 'Oct', 'oct': 'Oct', 'october': 'Oct',
    '11': 'Nov', 'nov': 'Nov', 'november': 'Nov',
    '12': 'Dec', 'dec': 'Dec', 'december': 'Dec',
  };

  // Match "19 Sept" or "19 September" or "19-Sept" or "19 Sept 2024"
  const wordMatch = str.match(/^(\d{1,2})[\s\-\/\.]+([A-Za-z]+)(?:[\s\-\/\.]+\d{2,4})?$/);
  if (wordMatch) {
    const day = parseInt(wordMatch[1], 10);
    const rawMonth = wordMatch[2].toLowerCase();
    const mon = monthMap[rawMonth] || (wordMatch[2].charAt(0).toUpperCase() + wordMatch[2].slice(1, 4).toLowerCase());
    return `${day} ${mon}`;
  }

  // Match "Sept 19" or "September 19"
  const revWordMatch = str.match(/^([A-Za-z]+)[\s\-\/\.]+(\d{1,2})(?:[\s\-\/\.]+\d{2,4})?$/);
  if (revWordMatch) {
    const day = parseInt(revWordMatch[2], 10);
    const rawMonth = revWordMatch[1].toLowerCase();
    const mon = monthMap[rawMonth] || (revWordMatch[1].charAt(0).toUpperCase() + revWordMatch[1].slice(1, 4).toLowerCase());
    return `${day} ${mon}`;
  }

  // Match "19/09" or "19-09-2024" or "19/09/2024" (DD/MM/YYYY or DD/MM)
  const numericMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.]\d{2,4})?$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const monthNum = numericMatch[2];
    const mon = monthMap[monthNum] || monthMap[String(parseInt(monthNum, 10))] || monthNum;
    return `${day} ${mon}`;
  }

  // Match ISO "2024-09-19"
  const isoMatch = str.match(/^\d{4}[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const day = parseInt(isoMatch[2], 10);
    const monthNum = isoMatch[1];
    const mon = monthMap[monthNum] || monthMap[String(parseInt(monthNum, 10))] || monthNum;
    return `${day} ${mon}`;
  }

  return str;
}

function extractRawTier(obj: any): any {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj.tier !== undefined
    ? obj.tier
    : obj.stage !== undefined
    ? obj.stage
    : obj.phase !== undefined
    ? obj.phase
    : obj.examStage !== undefined
    ? obj.examStage
    : obj.exam_stage !== undefined
    ? obj.exam_stage
    : undefined;
}

export function formatExamTag(
  exam?: string, 
  year?: number | string, 
  tierOrDate?: string | null, 
  shiftLegacy?: string | null,
  tierLegacy?: string | null
): string {
  const parts: string[] = [];
  if (exam && exam.trim() && exam !== 'null' && exam !== 'undefined') {
    parts.push(exam.trim());
  }
  if (year && String(year).trim() && String(year) !== 'null' && String(year) !== 'undefined') {
    parts.push(String(year).trim());
  }

  let resolvedTier = '';
  if (tierLegacy && tierLegacy.trim()) {
    resolvedTier = tierLegacy.trim();
  } else if (tierOrDate && tierOrDate.trim()) {
    resolvedTier = tierOrDate.trim();
  }

  if (
    resolvedTier &&
    resolvedTier !== 'Not Specified' &&
    resolvedTier !== 'null' &&
    resolvedTier !== 'undefined' &&
    resolvedTier !== '-'
  ) {
    parts.push(resolvedTier);
  }

  return parts.join(' ') || 'Govt Exam PYQ';
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
    const rawDate = meta.examDate || meta.date || meta.examDateMonth || meta.dateMonth || meta.exam_date || meta.monthDate;
    if (rawDate !== undefined) {
      const norm = normalizeExamDate(rawDate);
      if (norm) result.examDate = norm;
    }
    const rawTier = extractRawTier(meta);
    if (rawTier !== undefined && rawTier !== null) {
      const norm = normalizeTier(rawTier);
      if (norm) result.tier = norm;
    }
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
    examDate?: string | null;
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
  const fallbackTier = '';
  const fallbackPaper = 'English';

  const defaultExamFamily = metadataOverride?.examFamily || metaFromFile.examFamily || fallbackExamFamily;
  const defaultExam = metadataOverride?.exam || metaFromFile.exam || fallbackExam;
  const defaultYear = (metadataOverride?.year !== undefined && !isNaN(parseInt(String(metadataOverride.year), 10)))
    ? parseInt(String(metadataOverride.year), 10)
    : (metaFromFile.year && !isNaN(parseInt(metaFromFile.year, 10)))
    ? parseInt(metaFromFile.year, 10)
    : fallbackYear;

  const rawFileTier = extractRawTier(metaFromFile);
  const defaultTier = normalizeTier(
    (metadataOverride?.tier && metadataOverride.tier.trim())
      ? metadataOverride.tier
      : (rawFileTier ?? fallbackTier)
  );
  
  // Shift priority: override -> file metadata -> null (do NOT invent a shift)
  const resolveShift = (val?: any): string | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (!str || str === 'Not Specified' || str === 'null' || str === 'undefined') return null;
    return str;
  };

  const defaultShift = resolveShift(metadataOverride?.shift ?? metaFromFile.shift);
  const defaultExamDate = normalizeExamDate(metadataOverride?.examDate ?? metaFromFile.examDate ?? metaFromFile.date ?? metaFromFile.examDateMonth ?? metaFromFile.dateMonth ?? metaFromFile.exam_date ?? metaFromFile.monthDate);
  const defaultPaper = metadataOverride?.paper || metaFromFile.paper || fallbackPaper;

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Existing questions indexed by deterministic fingerprint & identity key for canonical matching
  const existingQuestions = questionBankEngine.getAllAvailableQuestions();
  const existingFingerprintMap = new Map<string, Question>();
  const existingIdentityMap = new Map<string, Question>();

  existingQuestions.forEach(q => {
    const fp = q.fingerprint || computeQuestionFingerprint(
      q.category,
      q.wordOrPhrase,
      q.options,
      q.correctIndex,
      q.instruction || q.question
    );
    const idKey = q.identityKey || computeQuestionIdentityKey(
      q.category,
      q.wordOrPhrase,
      q.options,
      q.instruction || q.question
    );
    if (!existingFingerprintMap.has(fp)) {
      existingFingerprintMap.set(fp, q);
    }
    if (!existingIdentityMap.has(idKey)) {
      existingIdentityMap.set(idKey, q);
    }
  });

  // Track questions within the current batch to merge multiple appearances within the same JSON file
  const inBatchFingerprintMap = new Map<string, ExtractedQuestion>();
  const inBatchIdentityMap = new Map<string, ExtractedQuestion>();

  const eligibleQuestions: ExtractedQuestion[] = [];
  const skippedItems: SkippedQuestionItem[] = [];

  let duplicateCount = 0;
  let answerRequiredCount = 0;
  let approvedCount = 0;
  let mergedAppearancesCount = 0;
  let conflictsCount = 0;
  let newQuestionsCount = 0;

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

    // Reject unsupported statement-numbered options ("1 only", "2 only", "Both 1 and 2", "1,2,3,4", etc.)
    const isMalformedNumbered = finalOptions.some(opt => {
      const s = String(opt || '').trim().toLowerCase();
      return s === '1 only' || s === '2 only' || s === '3 only' || s === '4 only' ||
             s.startsWith('both 1') || s.startsWith('neither 1') ||
             /^\d\s*,\s*\d\s*,\s*\d/.test(s);
    });
    if (isMalformedNumbered) {
      skippedItems.push({
        index: index + 1,
        rawCategory: rawCategory,
        question: String(item.question || `Item #${index + 1}`),
        reason: 'Skipped — unsupported statement/permutation numbered options (e.g. 1 only, Both 1 and 2, 1,2,3,4)',
      });
      return;
    }

    const questionPrompt = String(item.question || item.questionText || item.prompt || `Select the correct ${category} option:`).trim();
    const targetWord = extractTargetWordOrPhrase(item, category);

    // Resolve correct answer index
    const correctIdx = resolveCorrectIndex(
      item.correctIndex ?? item.correctAnswer ?? item.answer ?? item.key ?? item.ans,
      finalOptions
    );

    const tempId = `json_${batchId}_${index + 1}`;

    // Metadata Priority:
    // 1. Explicit question-level value
    // 2. Admin-selected value (metadataOverride)
    // 3. JSON metadata value (metaFromFile)
    // 4. Default / Blank fallback
    const itemExamFamily = item.examFamily || metadataOverride?.examFamily || metaFromFile.examFamily || fallbackExamFamily;
    const itemExam = item.exam || metadataOverride?.exam || metaFromFile.exam || fallbackExam;
    
    // Resolve year
    const itemYear = (item.year !== undefined && !isNaN(parseInt(String(item.year), 10))) 
      ? parseInt(String(item.year), 10) 
      : (metadataOverride?.year !== undefined && !isNaN(parseInt(String(metadataOverride.year), 10)))
      ? parseInt(String(metadataOverride.year), 10)
      : ((metaFromFile.year !== undefined && !isNaN(parseInt(String(metaFromFile.year), 10)))
        ? parseInt(String(metaFromFile.year), 10)
        : fallbackYear);

    // Resolve tier
    const rawItemTier = extractRawTier(item);
    const itemTier = (rawItemTier !== undefined && rawItemTier !== null && String(rawItemTier).trim() !== '')
      ? (normalizeTier(rawItemTier) || '')
      : (metadataOverride?.tier !== undefined && metadataOverride.tier.trim() !== '')
      ? normalizeTier(metadataOverride.tier)
      : (rawFileTier !== undefined && rawFileTier !== null && String(rawFileTier).trim() !== '')
      ? (normalizeTier(rawFileTier) || '')
      : '';

    const itemShift = resolveShift(item.shift) ?? resolveShift(metadataOverride?.shift) ?? resolveShift(metaFromFile.shift);
    const rawItemDate = item.examDate ?? item.date ?? item.examDateMonth ?? item.dateMonth ?? item.exam_date ?? item.monthDate;
    const itemExamDate = normalizeExamDate(rawItemDate) ?? defaultExamDate;
    const itemPaper = item.paper || metadataOverride?.paper || metaFromFile.paper || fallbackPaper;
    const itemQuestionNumber = item.questionNumber ?? item.qNo ?? item.qNumber ?? item.questionNo ?? item.number ?? (index + 1);

    // Build incoming exam appearance object
    const currentAppearance: ExamAppearance = {
      examFamily: itemExamFamily,
      exam: itemExam,
      year: itemYear,
      tier: itemTier,
      shift: itemShift,
      examDate: itemExamDate,
      questionNumber: itemQuestionNumber,
    };

    // Calculate deterministic canonical fingerprint & identity key
    const fingerprint = computeQuestionFingerprint(
      category,
      targetWord,
      finalOptions,
      correctIdx,
      questionPrompt
    );

    const identityKey = computeQuestionIdentityKey(
      category,
      targetWord,
      finalOptions,
      questionPrompt
    );

    const canonicalQuestionId = generateCanonicalQuestionId(
      category,
      targetWord,
      finalOptions,
      correctIdx
    );

    // Deduplication and Multiple Appearances Matching
    let reviewStatus: ReviewStatus = 'approved';
    let duplicateConfidence: 'exact' | 'high' | 'none' = 'none';
    let duplicateOfId: string | undefined = undefined;
    let duplicateOfQuestion: string | undefined = undefined;
    let isNewAppearance: boolean = false;
    let isAnswerConflict: boolean = false;
    let conflictDetails: any = undefined;
    let importAction: 'create' | 'merge_appearance' | 'answer_conflict' | 'identical_skip' = 'create';
    let matchedExistingQuestion: Question | undefined = undefined;
    let appearances: ExamAppearance[] = [currentAppearance];

    const matchedExisting = existingFingerprintMap.get(fingerprint);
    const matchedExistingIdentity = existingIdentityMap.get(identityKey);
    const matchedInBatch = inBatchFingerprintMap.get(fingerprint);
    const matchedInBatchIdentity = inBatchIdentityMap.get(identityKey);

    if (matchedExisting) {
      // 1. Exact canonical question match in question_bank
      matchedExistingQuestion = matchedExisting;
      duplicateOfId = matchedExisting.id;

      // Extract existing appearances from matched question
      const existingApps: ExamAppearance[] = Array.isArray(matchedExisting.appearances) && matchedExisting.appearances.length > 0
        ? matchedExisting.appearances
        : [
            {
              examFamily: matchedExisting.examFamily || 'SSC',
              exam: matchedExisting.exam || 'SSC CGL',
              year: matchedExisting.year || 2024,
              tier: matchedExisting.tier || '',
              shift: matchedExisting.shift || null,
              examDate: matchedExisting.examDate || null,
              questionNumber: matchedExisting.questionNumber,
            },
          ];

      const currentAppKey = getAppearanceKey(currentAppearance);
      const currentCoarseKey = getCoarseAppearanceKey(currentAppearance);
      const isAlreadyContained = existingApps.some(app => 
        getAppearanceKey(app) === currentAppKey || 
        (getCoarseAppearanceKey(app) === currentCoarseKey && (!app.shift || app.shift === currentAppearance.shift))
      );

      if (isAlreadyContained) {
        // Exact duplicate occurrence already published
        reviewStatus = 'duplicate';
        duplicateConfidence = 'exact';
        isNewAppearance = false;
        importAction = 'identical_skip';
        duplicateOfQuestion = `Exact Duplicate (${formatExamTag(currentAppearance.exam, currentAppearance.year, currentAppearance.tier)})`;
        duplicateCount++;
        appearances = existingApps;
      } else {
        // Canonical question matches, but this is a NEW cross-exam appearance!
        reviewStatus = 'approved';
        duplicateConfidence = 'high';
        isNewAppearance = true;
        importAction = 'merge_appearance';
        duplicateOfQuestion = `Cross-Exam Appearance Merged (${formatExamTag(currentAppearance.exam, currentAppearance.year, currentAppearance.tier)})`;
        const { merged } = mergeAppearances(existingApps, currentAppearance);
        appearances = merged;
        approvedCount++;
        mergedAppearancesCount++;
      }
    } else if (matchedExistingIdentity && correctIdx !== null) {
      // 2. Question Prompt + Options match, but Answer Conflicts with Firestore question!
      isAnswerConflict = true;
      importAction = 'answer_conflict';
      reviewStatus = 'needs_review';
      duplicateConfidence = 'none';
      duplicateOfId = matchedExistingIdentity.id;
      duplicateOfQuestion = `Answer Key Conflict with existing question (${matchedExistingIdentity.id})`;
      conflictsCount++;

      const existingCorrectAns = typeof matchedExistingIdentity.correctIndex === 'number' 
        ? matchedExistingIdentity.options[matchedExistingIdentity.correctIndex] 
        : 'Unknown';
      const incomingCorrectAns = finalOptions[correctIdx] || 'Unknown';

      conflictDetails = {
        existingQuestionId: matchedExistingIdentity.id,
        existingCorrectAnswer: existingCorrectAns,
        incomingCorrectAnswer: incomingCorrectAns,
        existingOptions: matchedExistingIdentity.options,
        incomingOptions: finalOptions,
      };
    } else if (matchedInBatch) {
      // 3. Duplicate occurrence within the same JSON file
      duplicateOfId = matchedInBatch.tempId;
      const inBatchApps = matchedInBatch.appearances || [];
      const currentAppKey = getAppearanceKey(currentAppearance);
      const currentCoarseKey = getCoarseAppearanceKey(currentAppearance);
      const isAlreadyInBatch = inBatchApps.some(app => 
        getAppearanceKey(app) === currentAppKey || 
        (getCoarseAppearanceKey(app) === currentCoarseKey && (!app.shift || app.shift === currentAppearance.shift))
      );

      if (isAlreadyInBatch) {
        reviewStatus = 'duplicate';
        duplicateConfidence = 'exact';
        isNewAppearance = false;
        importAction = 'identical_skip';
        duplicateOfQuestion = `Exact Duplicate in File (${formatExamTag(currentAppearance.exam, currentAppearance.year, currentAppearance.tier)})`;
        duplicateCount++;
      } else {
        // Merge appearance onto earlier batch item and mark current item as merged
        const { merged } = mergeAppearances(inBatchApps, currentAppearance);
        matchedInBatch.appearances = merged;
        reviewStatus = 'duplicate';
        duplicateConfidence = 'high';
        isNewAppearance = true;
        importAction = 'merge_appearance';
        duplicateOfQuestion = `Merged into earlier item #${matchedInBatch.tempId}`;
        duplicateCount++;
        mergedAppearancesCount++;
      }
      appearances = inBatchApps;
    } else if (matchedInBatchIdentity && correctIdx !== null) {
      // 4. In-file answer conflict
      isAnswerConflict = true;
      importAction = 'answer_conflict';
      reviewStatus = 'needs_review';
      duplicateConfidence = 'none';
      duplicateOfId = matchedInBatchIdentity.tempId;
      duplicateOfQuestion = `In-file answer conflict with item #${matchedInBatchIdentity.tempId}`;
      conflictsCount++;

      const existingCorrectAns = typeof matchedInBatchIdentity.correctIndex === 'number' 
        ? matchedInBatchIdentity.options[matchedInBatchIdentity.correctIndex] 
        : 'Unknown';
      const incomingCorrectAns = finalOptions[correctIdx] || 'Unknown';

      conflictDetails = {
        existingQuestionId: matchedInBatchIdentity.tempId,
        existingCorrectAnswer: existingCorrectAns,
        incomingCorrectAnswer: incomingCorrectAns,
        existingOptions: matchedInBatchIdentity.options,
        incomingOptions: finalOptions,
      };
    } else {
      // 5. Brand new question
      importAction = 'create';
      newQuestionsCount++;
      if (correctIdx === null) {
        reviewStatus = 'answer_required';
        answerRequiredCount++;
      } else {
        reviewStatus = 'approved';
        approvedCount++;
      }
    }

    // Similar Paper & Flag Integrity
    const itemIsPYQ = typeof item.isPYQ === 'boolean'
      ? item.isPYQ
      : (item.is_pyq !== undefined ? Boolean(item.is_pyq) : true);
    const itemVerified = typeof item.verified === 'boolean'
      ? item.verified
      : (item.is_verified !== undefined ? Boolean(item.is_verified) : true);
    const itemSourceType = (item.sourceType || item.source_type || (itemIsPYQ === false ? 'generated_practice' : 'json_import')) as any;

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

    const extractedItem: ExtractedQuestion = {
      tempId,
      canonicalQuestionId,
      question: questionPrompt,
      wordOrPhrase: targetWord,
      options: finalOptions,
      correctIndex: correctIdx,
      category,
      instruction: item.instruction ? String(item.instruction).trim() : undefined,
      meaning: itemMeaning || (matchedExisting?.meaning || ''),
      hindiMeaning: itemHindiMeaning || (matchedExisting?.hindiMeaning || ''),
      mnemonic: itemMnemonic || (matchedExisting?.mnemonic || ''),
      exampleSentence: itemExampleSentence || (matchedExisting?.exampleSentence || ''),
      rootWordInfo: itemRootWordInfo || (matchedExisting?.rootWordInfo || ''),
      explanation: itemExplanation || (matchedExisting?.explanation || ''),
      optionDetails: incomingOptionDetails || matchedExisting?.optionDetails,
      enrichment: incomingEnrichment || matchedExisting?.enrichment,
      examFamily: itemExamFamily,
      exam: itemExam,
      year: itemYear,
      tier: itemTier,
      shift: itemShift,
      examDate: itemExamDate,
      questionNumber: itemQuestionNumber,
      paper: itemPaper,
      fingerprint,
      identityKey,
      appearances,
      isNewAppearance,
      isAnswerConflict,
      conflictDetails,
      importAction,
      matchedExistingQuestion,
      reviewStatus,
      duplicateConfidence,
      duplicateOfId,
      duplicateOfQuestion,
      sourceType: itemSourceType,
      isPYQ: itemIsPYQ,
      verified: itemVerified,
      sourceFileName: fileName,
      rawText: JSON.stringify(item),
    };

    if (!matchedExisting && !matchedInBatch) {
      inBatchFingerprintMap.set(fingerprint, extractedItem);
      inBatchIdentityMap.set(identityKey, extractedItem);
    }

    eligibleQuestions.push(extractedItem);
  });

  const batch: ImportBatch = {
    batchId,
    sourceFileName: fileName,
    examFamily: defaultExamFamily,
    exam: defaultExam,
    year: defaultYear,
    tier: defaultTier || undefined,
    shift: defaultShift || undefined,
    examDate: defaultExamDate || undefined,
    paper: defaultPaper,
    dateImported: Date.now(),
    totalDetected: eligibleQuestions.length,
    approvedCount,
    needsReviewCount: answerRequiredCount + conflictsCount,
    duplicateCount,
    rejectedCount: 0,
    mergedAppearancesCount,
    conflictsCount,
    newQuestionsCount,
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
