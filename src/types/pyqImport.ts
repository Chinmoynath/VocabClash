import { Question, QuestionCategory, QuestionOptionDetail, ExamAppearance } from './index';
import { QualityIssueDetail, QualityStatus } from './pyqQuality';

export type ReviewStatus = 'approved' | 'needs_review' | 'answer_required' | 'duplicate' | 'rejected';

export type ImportAction = 'create' | 'merge_appearance' | 'answer_conflict' | 'identical_skip';

export interface AnswerConflictDetails {
  existingQuestionId: string;
  existingCorrectAnswer: string;
  incomingCorrectAnswer: string;
  existingOptions: string[];
  incomingOptions: string[];
}

export interface ExtractedQuestion {
  tempId: string;
  canonicalQuestionId?: string;
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
    warnings?: string;
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
  fingerprint?: string; // includes correct answer
  identityKey?: string; // excludes correct answer
  appearances?: ExamAppearance[];
  isNewAppearance?: boolean;
  isAnswerConflict?: boolean;
  conflictDetails?: AnswerConflictDetails;
  importAction?: ImportAction;
  matchedExistingQuestion?: Question;
  reviewStatus: ReviewStatus;
  duplicateConfidence?: 'exact' | 'high' | 'none';
  duplicateOfId?: string;
  duplicateOfQuestion?: string;
  qualityAuditIssues?: QualityIssueDetail[];
  qualityStatus?: QualityStatus;
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
  mergedAppearancesCount?: number;
  conflictsCount?: number;
  newQuestionsCount?: number;
  qualityFlaggedCount?: number;
  status: 'pending_review' | 'completed' | 'discarded';
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  stage: 'reading_pdf' | 'extracting_text' | 'detecting_questions' | 'deduplicating' | 'completed' | 'error';
  message: string;
  extractedCount: number;
}
