// Polyfill ReadableStream async iterator for browser engines (Safari, WebKit, mobile webviews)
if (typeof ReadableStream !== 'undefined' && !(Symbol.asyncIterator in ReadableStream.prototype)) {
  (ReadableStream.prototype as any)[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

import * as pdfjsLib from 'pdfjs-dist';
import { ExtractedQuestion, ExtractionProgress, ReviewStatus, ImportBatch } from '../types/pyqImport';
import { Question, QuestionCategory } from '../types';
import { questionBankEngine } from './questionBankEngine';

// Set up pdf.js worker URL from unpkg or cdnjs
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Worker configuration notice:', e);
  }
}

export interface PDFMetadataInput {
  examFamily: string;
  exam: string;
  year: number;
  tier?: string;
  shift?: string;
  paper?: string;
  sourceUrl?: string;
}

// Clean and normalize text strings for matching
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Category classification heuristics for English exams
export function detectCategoryFromText(questionText: string): QuestionCategory {
  const lower = questionText.toLowerCase();

  if (
    lower.includes('synonym') ||
    lower.includes('closest in meaning') ||
    lower.includes('similar in meaning') ||
    lower.includes('same meaning') ||
    lower.includes('best expresses the meaning')
  ) {
    return 'synonyms';
  }

  if (
    lower.includes('antonym') ||
    lower.includes('opposite in meaning') ||
    lower.includes('opposite of') ||
    lower.includes('contrary in meaning')
  ) {
    return 'antonyms';
  }

  if (
    lower.includes('one word') ||
    lower.includes('substituted for') ||
    lower.includes('substitute for the given') ||
    lower.includes('phrase can be replaced by') ||
    lower.includes('single word for')
  ) {
    return 'ows';
  }

  if (
    lower.includes('idiom') ||
    lower.includes('phrase') ||
    lower.includes('meaning of the given idiom') ||
    lower.includes('idiomatic expression') ||
    lower.includes('underlined idiom')
  ) {
    return 'idioms';
  }

  // Default fallback
  return 'synonyms';
}

// Extract word or target phrase from common question patterns
export function extractTargetWord(questionText: string): string {
  // Check for quoted strings: "ABATE" or 'ABATE' or capitalized word at end
  const quoteMatch = questionText.match(/["']([a-zA-Z\s\-']+)["']/);
  if (quoteMatch && quoteMatch[1].trim().length > 1) {
    return quoteMatch[1].trim();
  }

  // Check for capitalized word sequence: e.g. "Select the synonym of METICULOUS"
  const capMatch = questionText.match(/\b([A-Z]{3,})\b/);
  if (capMatch && capMatch[1].length > 2) {
    return capMatch[1].trim();
  }

  // Fallback to first 4 words of the question
  const words = questionText.split(/\s+/).filter(Boolean);
  return words.slice(0, 4).join(' ');
}

// Extract raw text from PDF ArrayBuffer page by page
export async function extractTextFromPDF(
  fileBuffer: ArrayBuffer,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{ textByPage: { pageNumber: number; text: string }[]; totalPages: number }> {
  try {
    const uint8Array = new Uint8Array(fileBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const textByPage: { pageNumber: number; text: string }[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress({
          currentPage: pageNum,
          totalPages,
          stage: 'extracting_text',
          message: `Reading PDF page ${pageNum} of ${totalPages}...`,
          extractedCount: 0
        });
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');

      textByPage.push({
        pageNumber: pageNum,
        text: pageText
      });
    }

    // Check if entire PDF yielded virtually no text (scanned PDF)
    const totalChars = textByPage.reduce((acc, p) => acc + p.text.trim().length, 0);
    if (totalChars < 50 && totalPages > 0) {
      throw new Error('This PDF appears to be a scanned image document without selectable text. An OCR layer is required to extract questions.');
    }

    return { textByPage, totalPages };
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to extract text from PDF: ${err?.message || 'Invalid or encrypted PDF'}`);
  }
}

// Parse continuous English text into structured question blocks
export function parseQuestionsFromRawText(
  rawText: string,
  metadata: PDFMetadataInput,
  sourceFileName: string,
  pageNumber: number = 1
): ExtractedQuestion[] {
  const extracted: ExtractedQuestion[] = [];

  // Standardize whitespace
  const clean = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ');

  // Look for question delimiters: "Q.1", "Q1.", "1.", "Question 1:", "Q. 23"
  const questionPattern = /(?:(?:^|\n)\s*(?:Q\.?\s*(\d+)[:.]?|Question\s*(\d+)[:.]?|(\d+)[\.\)]\s+))([\s\S]*?)(?=(?:(?:^|\n)\s*(?:Q\.?\s*\d+[:.]?|Question\s*\d+[:.]?|\d+[\.\)]\s+))|$)/gi;

  let match;
  while ((match = questionPattern.exec(clean)) !== null) {
    const qNum = match[1] || match[2] || match[3] || `${extracted.length + 1}`;
    const block = match[4]?.trim();

    if (!block || block.length < 15) continue;

    // Detect options format: (A)/(B)/(C)/(D) or A)/B)/C)/D) or 1./2./3./4. or (1)/(2)/(3)/(4)
    // Option regex
    const optionMatches = parseOptionsFromBlock(block);

    if (optionMatches && optionMatches.options.length === 4) {
      const qText = optionMatches.questionText.trim();
      const detectedCat = detectCategoryFromText(qText);
      const targetWord = extractTargetWord(qText);

      // Detect answer key if marked like [Ans: B] or "Answer: (2)" or (Correct: A)
      const detectedAnswer = detectAnswerKeyFromBlock(block);
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);

      extracted.push({
        tempId: `extracted_p${pageNumber}_${extracted.length}_${Date.now()}_${uniqueSuffix}`,
        question: qText,
        wordOrPhrase: targetWord,
        options: optionMatches.options,
        correctIndex: detectedAnswer,
        category: detectedCat,
        examFamily: metadata.examFamily,
        exam: metadata.exam,
        year: metadata.year,
        tier: metadata.tier,
        shift: metadata.shift,
        paper: metadata.paper,
        reviewStatus: detectedAnswer !== null ? 'approved' : 'answer_required',
        sourceType: 'pdf_import',
        sourceFileName,
        pageNumber,
        rawText: block
      });
    }
  }

  // Fallback: If no standard numbered questions found, try splitting by option clusters (A)/(B)/(C)/(D)
  if (extracted.length === 0) {
    const fallbackList = parseQuestionsByOptionClusters(clean, metadata, sourceFileName, pageNumber);
    extracted.push(...fallbackList);
  }

  return extracted;
}

// Helper to isolate 4 options from a question block
function parseOptionsFromBlock(block: string): { questionText: string; options: string[] } | null {
  // Pattern 1: (A)... (B)... (C)... (D)... or A)... B)...
  const letterPattern = /(?:(?:\([A-Da-d]\)|[A-Da-d][\.\)]))\s*([^(\n\r]+)/g;
  let matches = [...block.matchAll(letterPattern)];

  if (matches.length >= 4) {
    // Pick the last 4 option matches
    const optionMatches = matches.slice(matches.length - 4);
    const options = optionMatches.map(m => m[1].trim());

    // Question text is everything before the first option match
    const firstOptionIndex = block.indexOf(optionMatches[0][0]);
    const questionText = firstOptionIndex > 0 ? block.substring(0, firstOptionIndex).trim() : block;

    return { questionText, options };
  }

  // Pattern 2: (1)... (2)... (3)... (4)... or 1)... 2)...
  const numberOptionPattern = /(?:(?:\([1-4]\)|(?:\n|^)\s*[1-4][\.\)]))\s*([^(\n\r]+)/g;
  matches = [...block.matchAll(numberOptionPattern)];

  if (matches.length >= 4) {
    const optionMatches = matches.slice(matches.length - 4);
    const options = optionMatches.map(m => m[1].trim());

    const firstOptionIndex = block.indexOf(optionMatches[0][0]);
    const questionText = firstOptionIndex > 0 ? block.substring(0, firstOptionIndex).trim() : block;

    return { questionText, options };
  }

  return null;
}

// Fallback option cluster parser
function parseQuestionsByOptionClusters(
  text: string,
  metadata: PDFMetadataInput,
  sourceFileName: string,
  pageNumber: number
): ExtractedQuestion[] {
  const list: ExtractedQuestion[] = [];
  const segments = text.split(/(?=\n\s*(?:Select|Choose|Find|In the following|Identify|Direction|What is))/gi);

  for (const seg of segments) {
    if (seg.length < 20) continue;
    const parsed = parseOptionsFromBlock(seg);
    if (parsed && parsed.options.length === 4 && parsed.questionText.length > 5) {
      const qText = parsed.questionText.trim();
      const detectedCat = detectCategoryFromText(qText);
      const targetWord = extractTargetWord(qText);
      const detectedAnswer = detectAnswerKeyFromBlock(seg);
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);

      list.push({
        tempId: `extracted_fb_p${pageNumber}_${list.length}_${Date.now()}_${uniqueSuffix}`,
        question: qText,
        wordOrPhrase: targetWord,
        options: parsed.options,
        correctIndex: detectedAnswer,
        category: detectedCat,
        examFamily: metadata.examFamily,
        exam: metadata.exam,
        year: metadata.year,
        tier: metadata.tier,
        shift: metadata.shift,
        paper: metadata.paper,
        reviewStatus: detectedAnswer !== null ? 'approved' : 'answer_required',
        sourceType: 'pdf_import',
        sourceFileName,
        pageNumber,
        rawText: seg
      });
    }
  }

  return list;
}

// Helper to look for answer notations like [Ans: C], "Answer: 3", "(Key: A)"
function detectAnswerKeyFromBlock(block: string): number | null {
  const ansRegex = /(?:Ans(?:wer)?|Key|Correct(?:\s*Option)?)\s*[:=\-]?\s*[\(\[]?\s*([1-4A-Da-d])\s*[\)\]]?/i;
  const match = block.match(ansRegex);
  if (!match) return null;

  const val = match[1].toUpperCase();
  if (val === 'A' || val === '1') return 0;
  if (val === 'B' || val === '2') return 1;
  if (val === 'C' || val === '3') return 2;
  if (val === 'D' || val === '4') return 3;

  return null;
}

// 3-Level Deduplication against the existing VocabClash question bank
export function checkDuplicateAgainstExistingBank(
  extractedQuestion: ExtractedQuestion,
  existingQuestions: Question[]
): { isDuplicate: boolean; duplicateConfidence: 'exact' | 'high' | 'none'; matchedQuestion?: Question } {
  const normExtractedQ = normalizeText(extractedQuestion.question);
  const normExtractedWord = normalizeText(extractedQuestion.wordOrPhrase);

  // Level 1: Exact Normalized Text Match
  for (const eq of existingQuestions) {
    const normEqQ = normalizeText(eq.instruction ? `${eq.instruction} ${eq.wordOrPhrase}` : eq.wordOrPhrase);
    const normEqWord = normalizeText(eq.wordOrPhrase);

    if (normExtractedQ === normEqQ || (normExtractedWord === normEqWord && eq.category === extractedQuestion.category)) {
      // Check options overlap
      const eqNormOptions = eq.options.map(normalizeText);
      const extNormOptions = extractedQuestion.options.map(normalizeText);

      const matchingOptions = extNormOptions.filter(o => eqNormOptions.includes(o)).length;
      if (matchingOptions >= 3) {
        return {
          isDuplicate: true,
          duplicateConfidence: 'exact',
          matchedQuestion: eq
        };
      }
    }
  }

  // Level 2: High Semantic / Target Word overlap
  for (const eq of existingQuestions) {
    if (eq.category === extractedQuestion.category && normalizeText(eq.wordOrPhrase) === normExtractedWord) {
      return {
        isDuplicate: true,
        duplicateConfidence: 'high',
        matchedQuestion: eq
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateConfidence: 'none'
  };
}

// Full PDF Processing Pipeline
export async function processPDFIntoQuestions(
  file: File,
  metadata: PDFMetadataInput,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{ questions: ExtractedQuestion[]; batch: ImportBatch }> {
  const fileBuffer = await file.arrayBuffer();

  // 1. Extract raw text page by page
  const { textByPage, totalPages } = await extractTextFromPDF(fileBuffer, onProgress);

  // 2. Detect questions
  if (onProgress) {
    onProgress({
      currentPage: totalPages,
      totalPages,
      stage: 'detecting_questions',
      message: 'Detecting English questions, option choices, and answer keys...',
      extractedCount: 0
    });
  }

  const allExtracted: ExtractedQuestion[] = [];
  for (const page of textByPage) {
    const pageQuestions = parseQuestionsFromRawText(page.text, metadata, file.name, page.pageNumber);
    allExtracted.push(...pageQuestions);
  }

  // 3. Deduplicate against existing question bank
  if (onProgress) {
    onProgress({
      currentPage: totalPages,
      totalPages,
      stage: 'deduplicating',
      message: 'Running 3-level duplicate detection against VocabClash question bank...',
      extractedCount: allExtracted.length
    });
  }

  const existingBank = questionBankEngine.getAllAvailableQuestions();

  let duplicatesCount = 0;
  let answerRequiredCount = 0;

  for (const eq of allExtracted) {
    const dupCheck = checkDuplicateAgainstExistingBank(eq, existingBank);
    if (dupCheck.isDuplicate) {
      eq.reviewStatus = 'duplicate';
      eq.duplicateConfidence = dupCheck.duplicateConfidence;
      eq.duplicateOfId = dupCheck.matchedQuestion?.id;
      eq.duplicateOfQuestion = dupCheck.matchedQuestion?.wordOrPhrase;
      duplicatesCount++;
    } else if (eq.correctIndex === null) {
      eq.reviewStatus = 'answer_required';
      answerRequiredCount++;
    }
  }

  const approvedInitial = allExtracted.filter(q => q.reviewStatus === 'approved').length;

  const batch: ImportBatch = {
    batchId: `BATCH_${metadata.exam.replace(/\s+/g, '_')}_${metadata.year}_${Date.now()}`,
    sourceFileName: file.name,
    examFamily: metadata.examFamily,
    exam: metadata.exam,
    year: metadata.year,
    tier: metadata.tier,
    shift: metadata.shift,
    paper: metadata.paper,
    dateImported: Date.now(),
    totalDetected: allExtracted.length,
    approvedCount: approvedInitial,
    needsReviewCount: answerRequiredCount,
    duplicateCount: duplicatesCount,
    rejectedCount: 0,
    status: 'pending_review'
  };

  if (onProgress) {
    onProgress({
      currentPage: totalPages,
      totalPages,
      stage: 'completed',
      message: `Extraction complete: ${allExtracted.length} questions detected.`,
      extractedCount: allExtracted.length
    });
  }

  return { questions: allExtracted, batch };
}
