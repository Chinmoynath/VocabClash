export type QualityStatus = 'valid' | 'suspicious' | 'critical';

export type QualityIssueCode =
  | 'TARGET_EQUALS_OPTION'
  | 'DUPLICATE_OPTIONS'
  | 'INVALID_CORRECT_ANSWER'
  | 'MALFORMED_OPTIONS'
  | 'SUSPICIOUS_CATEGORY_MISMATCH'
  | 'QUESTION_TEXT_AS_OPTION'
  | 'DUPLICATE_QUESTION'
  | 'USER_REPORTED';

export interface QualityIssueDetail {
  code: QualityIssueCode;
  severity: 'suspicious' | 'critical';
  title: string;
  description: string;
  offendingValues?: string[];
}

export interface QuestionQualityResult {
  questionId: string;
  status: QualityStatus;
  issues: QualityIssueDetail[];
  scannedAt: number;
}

export interface UserQuestionReport {
  reportId: string;
  questionId: string;
  category?: string;
  wordOrPhrase?: string;
  reason: string;
  notes?: string;
  userEmail?: string;
  userName?: string;
  reportedAt: number;
  status: 'open' | 'reviewed' | 'dismissed' | 'resolved';
}

export interface QualityAuditStats {
  totalScanned: number;
  validCount: number;
  suspiciousCount: number;
  criticalCount: number;
  reportedCount: number;
  lastScannedAt: number | null;
}
