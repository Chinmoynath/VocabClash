import { Question, QuestionCategory, QuestionOptionDetail, ExamAppearance } from './index';

export type ReviewStatus = 'approved' | 'needs_review' | 'answer_required' | 'duplicate' | 'rejected';

export interface ExtractedQuestion {
  tempId: string;
  question: string;
  wordOrPhrase: string;
  options: string[];
  correctIndex: number | null; // 0-3 or null if answer missing
  category: QuestionCategory;
  instruction?: string;
  meaning?: string;
  hindiMeaning?: string;
  mnemonic?: string;
  exampleSentence?: string;
  rootWordInfo?: string;
  explanation?: string;
  optionDetails?: QuestionOptionDetail[];
  enrichment?: {
    status: 'complete' | 'partial' | 'failed';
    version: string;
    enrichedAt?: number;
    provider?: string;
  };
  enrichmentWarning?: string;
  examFamily: string; // e.g. "SSC", "Banking", "Defence", "Railways"
  exam: string;       // e.g. "SSC CGL", "IBPS PO", "CDS"
  year: number;
  tier?: string;      // e.g. "Tier-I", "Mains", "CBT-1"
  shift?: string | null;
  examDate?: string | null; // e.g. "19 Sept", "18 Oct"
  questionNumber?: number | string;
  paper?: string;
  fingerprint?: string;
  appearances?: ExamAppearance[];
  isNewAppearance?: boolean;
  matchedExistingQuestion?: Question;
  reviewStatus: ReviewStatus;
  duplicateConfidence?: 'exact' | 'high' | 'none';
  duplicateOfId?: string;
  duplicateOfQuestion?: string;
  sourceType: 'pdf_import' | 'manual_text' | 'json_import' | 'verified_pyq' | 'generated_practice';
  sourceFileName?: string;
  pageNumber?: number;
  rawText?: string;
  isOCR?: boolean;
  isPYQ?: boolean;
  verified?: boolean;
}

export interface ImportBatch {
  batchId: string;
  sourceFileName: string;
  examFamily: string;
  exam: string;
  year: number;
  tier?: string;
  shift?: string;
  examDate?: string;
  paper?: string;
  dateImported: number;
  totalDetected: number;
  approvedCount: number;
  needsReviewCount: number;
  duplicateCount: number;
  rejectedCount: number;
  status: 'pending_review' | 'completed' | 'discarded';
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  stage: 'reading_pdf' | 'extracting_text' | 'detecting_questions' | 'deduplicating' | 'completed' | 'error';
  message: string;
  extractedCount: number;
}
