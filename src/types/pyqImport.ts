import { Question, QuestionCategory } from './index';

export type ReviewStatus = 'approved' | 'needs_review' | 'answer_required' | 'duplicate' | 'rejected';

export interface ExtractedQuestion {
  tempId: string;
  question: string;
  wordOrPhrase: string;
  options: string[];
  correctIndex: number | null; // 0-3 or null if answer missing
  category: QuestionCategory;
  meaning?: string;
  hindiMeaning?: string;
  examFamily: string; // e.g. "SSC", "Banking", "Defence", "Railways"
  exam: string;       // e.g. "SSC CGL", "IBPS PO", "CDS"
  year: number;
  tier?: string;      // e.g. "Tier 1", "Prelims", "Shift 2"
  shift?: string;
  paper?: string;
  reviewStatus: ReviewStatus;
  duplicateConfidence?: 'exact' | 'high' | 'none';
  duplicateOfId?: string;
  duplicateOfQuestion?: string;
  sourceType: 'pdf_import' | 'manual_text' | 'json_import';
  sourceFileName?: string;
  pageNumber?: number;
  rawText?: string;
  isOCR?: boolean;
}

export interface ImportBatch {
  batchId: string;
  sourceFileName: string;
  examFamily: string;
  exam: string;
  year: number;
  tier?: string;
  shift?: string;
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
