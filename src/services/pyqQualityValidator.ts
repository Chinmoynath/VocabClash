import { Question, QuestionCategory } from '../types';
import { QualityIssueDetail, QuestionQualityResult, QualityStatus } from '../types/pyqQuality';

/**
 * Clean and normalize a string for deterministic comparison:
 * - lowercase
 * - trim whitespace
 * - strip outer quotation marks and punctuation
 * - collapse multiple spaces
 */
export function normalizeText(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/^[“”"''`«»\s\.\,\;\:\-\(\)]+|[“”"''`«»\s\.\,\;\:\-\(\)]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known grammar / sentence improvement phrase fragments that indicate a question
 * or its options were misclassified under a vocabulary category (synonym/antonym/idiom/ows).
 */
const GRAMMAR_IMPROVEMENT_FRAGMENTS = [
  'no substitution required',
  'no improvement required',
  'no improvement',
  'no correction required',
  'no error',
  'underlined segment',
  'underlined phrase',
  'underlined word',
  'substitute the underlined',
  'the three families',
  'of the three families',
  'in the three families',
  'among the three families',
];

/**
 * Validates a single question deterministically against high-confidence data quality rules.
 * Never modifies or mutates the question object.
 */
export function validateQuestionQuality(
  question: Question | (Partial<Question> & { wordOrPhrase?: string; options?: string[]; correctIndex?: number | null; category?: any }),
  duplicateIdSet?: Set<string>,
  reportedCountMap?: Map<string, number>
): QuestionQualityResult {
  const issues: QualityIssueDetail[] = [];
  const qId = question.id || question.canonicalQuestionId || 'unknown_id';
  const category = (question.category || '').toLowerCase() as QuestionCategory;
  const wordOrPhrase = question.wordOrPhrase || '';
  const options = Array.isArray(question.options) ? question.options : [];
  const correctIndex = question.correctIndex;
  const instruction = question.instruction || question.question || '';

  const normTarget = normalizeText(wordOrPhrase);
  const normOptions = options.map(opt => normalizeText(opt));

  // ==========================================
  // Check A: TARGET_EQUALS_OPTION
  // ==========================================
  // In synonyms, antonyms, and idioms, the tested target word/phrase must not appear as an option.
  // Example: target "breathed his last" appearing as option "breathed his last".
  if (normTarget.length > 0 && (category === 'synonyms' || category === 'antonyms' || category === 'idioms')) {
    const matchingOptionIndices: number[] = [];
    normOptions.forEach((normOpt, idx) => {
      if (normOpt.length > 0 && normOpt === normTarget) {
        matchingOptionIndices.push(idx);
      }
    });

    if (matchingOptionIndices.length > 0) {
      const offendingOptions = matchingOptionIndices.map(i => `[${String.fromCharCode(65 + i)}] "${options[i]}"`);
      issues.push({
        code: 'TARGET_EQUALS_OPTION',
        severity: 'critical',
        title: 'Target Appears as Answer Option',
        description: `The prompt word/phrase "${wordOrPhrase}" appears verbatim as option ${offendingOptions.join(', ')}. Target words must not be their own answer options in ${category.toUpperCase()}.`,
        offendingValues: offendingOptions,
      });
    }
  }

  // ==========================================
  // Check B: DUPLICATE_OPTIONS
  // ==========================================
  // Two or more options are identical after basic normalization.
  const seenNormOptions = new Map<string, number>();
  const duplicatePairs: string[] = [];

  normOptions.forEach((normOpt, idx) => {
    if (normOpt.length > 0) {
      if (seenNormOptions.has(normOpt)) {
        const firstIdx = seenNormOptions.get(normOpt)!;
        duplicatePairs.push(`Option ${String.fromCharCode(65 + firstIdx)} & Option ${String.fromCharCode(65 + idx)}: "${options[idx]}"`);
      } else {
        seenNormOptions.set(normOpt, idx);
      }
    }
  });

  if (duplicatePairs.length > 0) {
    issues.push({
      code: 'DUPLICATE_OPTIONS',
      severity: 'critical',
      title: 'Duplicate Options Detected',
      description: `Identical or redundant options found: ${duplicatePairs.join('; ')}.`,
      offendingValues: duplicatePairs,
    });
  }

  // ==========================================
  // Check C: INVALID_CORRECT_ANSWER
  // ==========================================
  // Missing, NaN, out-of-range, or referencing empty option string.
  let isAnswerInvalid = false;
  let answerReason = '';

  if (correctIndex === undefined || correctIndex === null || typeof correctIndex !== 'number' || isNaN(correctIndex)) {
    isAnswerInvalid = true;
    answerReason = `Missing or non-numeric correctIndex (${String(correctIndex)})`;
  } else if (correctIndex < 0 || correctIndex >= options.length) {
    isAnswerInvalid = true;
    answerReason = `correctIndex ${correctIndex} is out of bounds (options count: ${options.length})`;
  } else if (!options[correctIndex] || options[correctIndex].trim() === '') {
    isAnswerInvalid = true;
    answerReason = `correctIndex ${correctIndex} points to an empty option`;
  }

  if (isAnswerInvalid) {
    issues.push({
      code: 'INVALID_CORRECT_ANSWER',
      severity: 'critical',
      title: 'Invalid Correct Answer Key',
      description: answerReason,
      offendingValues: [String(correctIndex)],
    });
  }

  // ==========================================
  // Check D: EMPTY_OR_MALFORMED_OPTIONS
  // ==========================================
  // Missing options, fewer than 4 options, empty strings, or GS statement numbers.
  const emptyIndices: number[] = [];
  const gsArtifacts: string[] = [];

  if (options.length < 4) {
    issues.push({
      code: 'MALFORMED_OPTIONS',
      severity: 'critical',
      title: 'Insufficient Options',
      description: `Question has ${options.length} options (standard schema requires 4).`,
      offendingValues: options,
    });
  }

  options.forEach((opt, idx) => {
    if (opt === undefined || opt === null || typeof opt !== 'string' || opt.trim() === '') {
      emptyIndices.push(idx);
    } else {
      const s = opt.trim().toLowerCase();
      if (
        s === '1 only' || s === '2 only' || s === '3 only' || s === '4 only' ||
        s.startsWith('both 1') || s.startsWith('neither 1') ||
        /^\d\s*,\s*\d\s*,\s*\d/.test(s)
      ) {
        gsArtifacts.push(`[${String.fromCharCode(65 + idx)}] "${opt}"`);
      }
    }
  });

  if (emptyIndices.length > 0) {
    issues.push({
      code: 'MALFORMED_OPTIONS',
      severity: 'critical',
      title: 'Empty Options Found',
      description: `Option(s) ${emptyIndices.map(i => String.fromCharCode(65 + i)).join(', ')} are empty or null.`,
      offendingValues: emptyIndices.map(i => `Option ${String.fromCharCode(65 + i)}`),
    });
  }

  if (gsArtifacts.length > 0) {
    issues.push({
      code: 'MALFORMED_OPTIONS',
      severity: 'critical',
      title: 'Numbered Statement Artifacts',
      description: `Options contain GS statement numbers: ${gsArtifacts.join(', ')}.`,
      offendingValues: gsArtifacts,
    });
  }

  // ==========================================
  // Check E: SUSPICIOUS_CATEGORY_MISMATCH
  // ==========================================
  // Detects grammar/sentence improvement fragments in vocabulary categories
  // (e.g., target "charming" with options "in the three families", "No substitution required").
  const grammarHits: string[] = [];
  for (const opt of options) {
    const normOpt = normalizeText(opt);
    for (const fragment of GRAMMAR_IMPROVEMENT_FRAGMENTS) {
      if (normOpt.includes(fragment)) {
        grammarHits.push(`"${opt}" (matches "${fragment}")`);
        break;
      }
    }
  }

  // Also check if wordOrPhrase is a single vocabulary word while all 4 options are long sentences or clauses
  const isSingleWordTarget = wordOrPhrase.trim().split(/\s+/).length <= 2;
  const isAllOptionsLongClauses = options.length >= 4 && options.every(opt => opt.trim().split(/\s+/).length >= 7);

  if (grammarHits.length > 0) {
    issues.push({
      code: 'SUSPICIOUS_CATEGORY_MISMATCH',
      severity: 'critical',
      title: 'Grammar / Sentence Improvement Mismatch',
      description: `Question under category "${category.toUpperCase()}" contains sentence-improvement or grammar options: ${grammarHits.join('; ')}.`,
      offendingValues: grammarHits,
    });
  } else if ((category === 'synonyms' || category === 'antonyms') && isSingleWordTarget && isAllOptionsLongClauses) {
    issues.push({
      code: 'SUSPICIOUS_CATEGORY_MISMATCH',
      severity: 'suspicious',
      title: 'Vocabulary vs Full-Sentence Option Mismatch',
      description: `Target word "${wordOrPhrase}" is a single word, but all options are full sentences/clauses.`,
      offendingValues: options,
    });
  }

  // ==========================================
  // Check F: QUESTION_TEXT_AS_OPTION / INSTRUCTION EMBEDDED
  // ==========================================
  // Stem or instruction accidentally stored as an option or inside target word
  if (normTarget.includes('select the most appropriate') || normTarget.includes('given word')) {
    issues.push({
      code: 'QUESTION_TEXT_AS_OPTION',
      severity: 'critical',
      title: 'Instruction Text Embedded in Target Word',
      description: `The target word/phrase contains full instruction text: "${wordOrPhrase}".`,
      offendingValues: [wordOrPhrase],
    });
  }

  if (instruction.length > 20) {
    const normInstruction = normalizeText(instruction);
    options.forEach((opt, idx) => {
      const normOpt = normalizeText(opt);
      if (normOpt.length > 25 && normInstruction.includes(normOpt)) {
        issues.push({
          code: 'QUESTION_TEXT_AS_OPTION',
          severity: 'suspicious',
          title: 'Question Instruction Stored as Option',
          description: `Option ${String.fromCharCode(65 + idx)} contains question instruction text: "${opt}".`,
          offendingValues: [opt],
        });
      }
    });
  }

  // ==========================================
  // Check G: DUPLICATE QUESTION / IDENTICAL CONTENT
  // ==========================================
  if (duplicateIdSet && duplicateIdSet.has(qId)) {
    issues.push({
      code: 'DUPLICATE_QUESTION',
      severity: 'suspicious',
      title: 'Duplicate Question Record',
      description: `Multiple documents share the exact same question identity or fingerprint.`,
      offendingValues: [qId],
    });
  }

  // ==========================================
  // Check H: USER_REPORTED
  // ==========================================
  const userReports = reportedCountMap?.get(qId) || 0;
  if (userReports > 0) {
    issues.push({
      code: 'USER_REPORTED',
      severity: 'suspicious',
      title: 'Aspirant Discrepancy Reports',
      description: `This question has received ${userReports} user discrepancy report(s) from the PYQ Drill.`,
      offendingValues: [`${userReports} report(s)`],
    });
  }

  // ==========================================
  // Determine Overall Quality Status
  // ==========================================
  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasSuspicious = issues.some(i => i.severity === 'suspicious');

  const status: QualityStatus = hasCritical ? 'critical' : (hasSuspicious ? 'suspicious' : 'valid');

  return {
    questionId: qId,
    status,
    issues,
    scannedAt: Date.now(),
  };
}

/**
 * Validates an entire batch of questions deterministically and flags duplicates/conflicts.
 */
export function validateQuestionBatchQuality(
  questions: Question[],
  reportedCountMap?: Map<string, number>
): QuestionQualityResult[] {
  // Identify exact duplicate question content
  const contentMap = new Map<string, string[]>();
  questions.forEach(q => {
    const normTarget = normalizeText(q.wordOrPhrase);
    const normOptions = (q.options || []).map(o => normalizeText(o)).sort().join('|');
    const contentKey = `${q.category || ''}::${normTarget}::${normOptions}`;

    if (!contentMap.has(contentKey)) {
      contentMap.set(contentKey, []);
    }
    contentMap.get(contentKey)!.push(q.id || q.canonicalQuestionId || '');
  });

  const duplicateIdSet = new Set<string>();
  contentMap.forEach(ids => {
    if (ids.length > 1) {
      ids.forEach(id => {
        if (id) duplicateIdSet.add(id);
      });
    }
  });

  return questions.map(q => validateQuestionQuality(q, duplicateIdSet, reportedCountMap));
}
