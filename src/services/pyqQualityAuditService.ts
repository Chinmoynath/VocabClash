import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, isFirestoreQuotaExhausted } from './firebaseService';
import { Question } from '../types';
import { QuestionQualityResult, QualityAuditStats, UserQuestionReport } from '../types/pyqQuality';
import { validateQuestionBatchQuality } from './pyqQualityValidator';
import { fetchPublishedQuestionBank, sanitizeForFirestore, deleteQuestionFromFirestore } from './pyqFirestoreService';
import { questionBankEngine } from './questionBankEngine';
import { generateCanonicalQuestionId } from '../utils/questionFingerprint';

const AUDIT_STORAGE_KEY = 'vocabclash_pyq_quality_audit_cache_v1';
const USER_REPORTS_STORAGE_KEY = 'vocabclash_user_question_reports_cache_v2';

function loadReportsLocally(): UserQuestionReport[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(USER_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveReportLocally(report: UserQuestionReport): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = loadReportsLocally();
    const filtered = existing.filter(r => r.reportId !== report.reportId);
    filtered.unshift(report);
    localStorage.setItem(USER_REPORTS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 500)));
  } catch (e) {}
}

function saveAllReportsLocally(reports: UserQuestionReport[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_REPORTS_STORAGE_KEY, JSON.stringify(reports.slice(0, 500)));
  } catch (e) {}
}

/**
 * Submit a user discrepancy report from PYQ drill into Firestore `question_reports`
 */
export async function submitQuestionReport(report: Omit<UserQuestionReport, 'reportId' | 'reportedAt' | 'status'>): Promise<{ success: boolean; error?: string }> {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload: UserQuestionReport = {
    ...report,
    reportId,
    reportedAt: Date.now(),
    status: 'open',
  };

  // 1. Immediately cache locally so admin panel sees it right away
  saveReportLocally(payload);
  pyqQualityAuditService.addReportLocally(payload);

  try {
    const docRef = doc(db, 'question_reports', reportId);
    
    // Firestore setDoc returns a Promise that waits for server write acknowledgement.
    // In web browsers/iframes, this can take a long time or stall even though the write
    // was already queued and sent to the server. We race it with a 2.5s timeout.
    const writePromise = setDoc(docRef, sanitizeForFirestore(payload));
    const timeoutPromise = new Promise<{ timeout: boolean }>(resolve => 
      setTimeout(() => resolve({ timeout: true }), 2500)
    );
    await Promise.race([writePromise, timeoutPromise]);
    return { success: true };
  } catch (err) {
    console.warn('Could not write question report to Firestore, saved locally:', err);
    return { success: true };
  }
}

/**
 * Fetch all open user question reports from Firestore `question_reports`
 */
export async function fetchUserQuestionReports(): Promise<UserQuestionReport[]> {
  const localReports = loadReportsLocally().filter(r => r.status !== 'resolved' && r.status !== 'dismissed');
  try {
    if (isFirestoreQuotaExhausted()) return localReports;
    const colRef = collection(db, 'question_reports');
    const q = query(colRef, orderBy('reportedAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    const serverReports: UserQuestionReport[] = [];
    snap.forEach(d => {
      const data = d.data() as UserQuestionReport;
      if (data.status !== 'resolved' && data.status !== 'dismissed') {
        serverReports.push(data);
      }
    });

    // Unify by reportId
    const reportMap = new Map<string, UserQuestionReport>();
    serverReports.forEach(r => reportMap.set(r.reportId, r));
    localReports.forEach(r => {
      if (!reportMap.has(r.reportId) && r.status !== 'resolved' && r.status !== 'dismissed') {
        reportMap.set(r.reportId, r);
      }
    });

    const unified = Array.from(reportMap.values()).sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0));
    saveAllReportsLocally(unified);
    return unified;
  } catch (err) {
    console.warn('Could not fetch question reports from Firestore, using local cache:', err);
    return localReports;
  }
}

/**
 * Admin action: Resolve / dismiss all user discrepancy reports for a given question in Firestore
 */
export async function resolveUserReportsForQuestion(questionId: string, alternateIds: string[] = []): Promise<boolean> {
  const allIds = new Set([questionId, ...alternateIds].filter(Boolean));
  // Clean up local storage cache
  const local = loadReportsLocally();
  const matchingReportIds: string[] = [];
  const updatedLocal = local.filter(r => {
    const matches = allIds.has(r.questionId) || 
      (r.questionData && (allIds.has(r.questionData.canonicalQuestionId || '') || allIds.has(r.questionData.id || '')));
    if (matches) {
      matchingReportIds.push(r.reportId);
      return false;
    }
    return true;
  });
  saveAllReportsLocally(updatedLocal);

  try {
    const currentUser = auth.currentUser;
    if (currentUser && matchingReportIds.length > 0) {
      const idToken = await currentUser.getIdToken();
      await fetch('/api/admin/resolve-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reportIds: matchingReportIds }),
      }).catch(console.warn);
    }

    const colRef = collection(db, 'question_reports');
    const snap = await getDocs(query(colRef, limit(500)));
    const batch = writeBatch(db);
    let count = 0;
    
    snap.forEach(d => {
      const data = d.data() as UserQuestionReport;
      const matches = allIds.has(data.questionId) || 
        (data.questionData && (allIds.has(data.questionData.canonicalQuestionId || '') || allIds.has(data.questionData.id || '')));
      if (matches && data.status !== 'resolved') {
        batch.delete(d.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit().catch(e => console.warn('Firestore report batch deletion warning:', e));
    }
    return true;
  } catch (e) {
    console.warn('Failed to resolve question reports in Firestore:', e);
    return true;
  }
}

/**
 * Admin action: Delete a single user discrepancy report by reportId
 */
export async function deleteSingleUserReport(reportId: string): Promise<boolean> {
  // Clean local cache
  const local = loadReportsLocally();
  saveAllReportsLocally(local.filter(r => r.reportId !== reportId));

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      await fetch('/api/admin/resolve-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reportIds: [reportId] }),
      }).catch(console.warn);
    }

    const docRef = doc(db, 'question_reports', reportId);
    await deleteDoc(docRef).catch(e => console.warn('Could not delete report doc:', e));
    return true;
  } catch (e) {
    console.warn('Delete report error:', e);
    return true;
  }
}

/**
 * Audit scanner service that performs deterministic quality analysis on question bank.
 * Pure read-only operation; never modifies production data during scan.
 */
class PyqQualityAuditService {
  private auditResults: Map<string, QuestionQualityResult> = new Map();
  private userReports: UserQuestionReport[] = [];
  private lastScannedAt: number | null = null;
  private isScanning: boolean = false;

  constructor() {
    this.loadCachedAudit();
  }

  private loadCachedAudit() {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.results)) {
          this.auditResults = new Map(parsed.results.map((r: QuestionQualityResult) => [r.questionId, r]));
          this.lastScannedAt = parsed.lastScannedAt || null;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached quality audit:', e);
    }
  }

  private saveCachedAudit() {
    try {
      if (typeof window === 'undefined') return;
      const payload = {
        results: Array.from(this.auditResults.values()),
        lastScannedAt: this.lastScannedAt,
      };
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to cache quality audit:', e);
    }
  }

  public getAuditResults(): Map<string, QuestionQualityResult> {
    return this.auditResults;
  }

  public getLastScannedAt(): number | null {
    return this.lastScannedAt;
  }

  public getUserReports(): UserQuestionReport[] {
    return this.userReports;
  }

  public addReportLocally(report: UserQuestionReport): void {
    if (!this.userReports.some(r => r.reportId === report.reportId)) {
      this.userReports.unshift(report);
    }
  }

  /**
   * Admin Action: PUSH QUESTION TO FIRESTORE
   * Commits/publishes a question document directly into Firestore `question_bank`
   * via high-speed server REST publishing pipeline, resolves linked user discrepancy reports
   * (preserving audit history by updating status to 'resolved'), updates QuestionBankEngine runtime,
   * and refreshes the audit status to valid.
   */
  public async pushQuestionToFirestore(
    question: Question,
    resolveReportIds?: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const targetDocId = question.id || question.canonicalQuestionId || generateCanonicalQuestionId(
        question.category,
        question.wordOrPhrase,
        question.options,
        question.correctIndex
      );

      const payload: any = sanitizeForFirestore({
        ...question,
        id: targetDocId,
        canonicalQuestionId: question.canonicalQuestionId || targetDocId,
        verified: true,
        isPYQ: true,
        updatedAt: Date.now(),
      });

      // Use authoritative server REST publish endpoint (same pipeline as repaired JSON publisher)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Admin authentication required to push to Firestore question bank.');
      }

      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('/api/admin/publish-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          questions: [payload],
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error || `Publish failed with HTTP status ${response.status}`);
      }

      // Update linked user reports in Firestore by updating status to 'resolved' (preserving history)
      const reportsToResolve = resolveReportIds && resolveReportIds.length > 0 
        ? resolveReportIds 
        : this.userReports.filter(r => r.questionId === targetDocId || r.questionId === question.id).map(r => r.reportId);

      if (reportsToResolve.length > 0) {
        await fetch('/api/admin/resolve-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ 
            reportIds: reportsToResolve, 
            status: 'resolved',
            resolutionNotes: 'Fixed and verified in question bank by admin' 
          }),
        }).catch(console.warn);
      }

      // Update runtime QuestionBankEngine
      questionBankEngine.registerApprovedQuestions([payload as Question], true);

      // Remove from in-memory open user reports
      this.userReports = this.userReports.filter(r => 
        r.questionId !== targetDocId && 
        r.questionId !== question.id &&
        !reportsToResolve.includes(r.reportId)
      );

      // Mark valid in auditResults
      this.auditResults.set(targetDocId, {
        questionId: targetDocId,
        status: 'valid',
        issues: [],
        scannedAt: Date.now(),
      });
      if (question.id && question.id !== targetDocId) {
        this.auditResults.delete(question.id);
      }
      this.saveCachedAudit();

      return { success: true };
    } catch (err: any) {
      console.error('Failed to push question to Firestore:', err);
      return { success: false, error: err?.message || 'Failed to push question to Firestore.' };
    }
  }

  /**
   * Run full or batch scan across questions.
   * Pure deterministic read-only pass.
   */
  public async runScan(
    questionsToScan?: Question[],
    onProgress?: (progress: { current: number; total: number; stage: string }) => void
  ): Promise<{ stats: QualityAuditStats; results: QuestionQualityResult[] }> {
    if (this.isScanning) {
      throw new Error('Scan already in progress.');
    }

    this.isScanning = true;
    try {
      onProgress?.({ current: 0, total: 100, stage: 'Fetching questions and user reports...' });

      // 1. Fetch user reports from Firestore
      this.userReports = await fetchUserQuestionReports();
      const reportedCountMap = new Map<string, number>();
      this.userReports.forEach(r => {
        if (r.status === 'open' && r.questionId) {
          reportedCountMap.set(r.questionId, (reportedCountMap.get(r.questionId) || 0) + 1);
        }
      });

      // 2. Fetch questions if not passed
      let questions = questionsToScan;
      if (!questions || questions.length === 0) {
        onProgress?.({ current: 15, total: 100, stage: 'Loading published questions from Firestore...' });
        questions = await fetchPublishedQuestionBank();
      }

      onProgress?.({ current: 40, total: 100, stage: `Validating ${questions.length} questions deterministically...` });

      // 3. Run deterministic validator batch
      const results = validateQuestionBatchQuality(questions, reportedCountMap);

      // 4. Update audit map
      this.auditResults.clear();
      results.forEach(r => {
        this.auditResults.set(r.questionId, r);
      });
      this.lastScannedAt = Date.now();
      this.saveCachedAudit();

      // 5. Compute stats
      let validCount = 0;
      let suspiciousCount = 0;
      let criticalCount = 0;

      results.forEach(r => {
        if (r.status === 'valid') validCount++;
        else if (r.status === 'suspicious') suspiciousCount++;
        else if (r.status === 'critical') criticalCount++;
      });

      onProgress?.({ current: 100, total: 100, stage: 'Quality scan completed!' });

      const stats: QualityAuditStats = {
        totalScanned: results.length,
        validCount,
        suspiciousCount,
        criticalCount,
        reportedCount: reportedCountMap.size,
        lastScannedAt: this.lastScannedAt,
      };

      return { stats, results };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Admin Action: KEEP / ACKNOWLEDGE
   * Marks question audit status as valid / reviewed, and updates any associated user reports to resolved (preserving history).
   */
  public async markAsKeep(questionId: string): Promise<{ success: boolean }> {
    const existing = this.auditResults.get(questionId);
    this.auditResults.set(questionId, {
      questionId,
      status: 'valid',
      issues: [],
      scannedAt: Date.now(),
      ...(existing || {}),
    });
    this.saveCachedAudit();

    // Mark matching reports as resolved
    const matchingReportIds = this.userReports.filter(r => r.questionId === questionId).map(r => r.reportId);
    this.userReports = this.userReports.filter(r => r.questionId !== questionId);

    if (matchingReportIds.length > 0) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          await fetch('/api/admin/resolve-reports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ 
              reportIds: matchingReportIds, 
              status: 'resolved',
              resolutionNotes: 'Acknowledged as valid authentic PYQ by admin'
            }),
          });
        } catch (err) {
          console.warn('Background resolve question reports warning:', err);
        }
      }
    }

    return { success: true };
  }

  /**
   * Admin Action: DISMISS SINGLE REPORT
   * Dismisses a specific report from memory and updates Firestore status to 'dismissed' (preserving history).
   */
  public async deleteSingleReport(reportId: string, questionId: string): Promise<{ success: boolean }> {
    this.userReports = this.userReports.filter(r => r.reportId !== reportId);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        await fetch('/api/admin/resolve-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ 
            reportIds: [reportId], 
            status: 'dismissed',
            resolutionNotes: 'Dismissed by admin in quality review'
          }),
        });
      } catch (err) {
        console.warn('Background dismiss report warning:', err);
      }
    }

    const remainingReports = this.userReports.filter(r => r.questionId === questionId);
    if (remainingReports.length === 0) {
      const existing = this.auditResults.get(questionId);
      if (existing) {
        const nonReportIssues = existing.issues.filter(i => i.code !== 'USER_REPORTED');
        this.auditResults.set(questionId, {
          ...existing,
          issues: nonReportIssues,
          status: nonReportIssues.length === 0 ? 'valid' : (nonReportIssues.some(i => i.severity === 'critical') ? 'critical' : 'suspicious'),
        });
        this.saveCachedAudit();
      }
    }

    return { success: true };
  }

  /**
   * Admin Action: EDIT QUESTION SAFELY
   * Updates question in Firestore while strictly preserving ID, appearances, and metadata.
   */
  public async updateQuestionSafely(
    questionId: string,
    updatedFields: Partial<Question>,
    originalQuestion: Question
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!questionId || typeof questionId !== 'string' || questionId.trim() === '') {
        return { success: false, error: 'Cannot update: Invalid question document ID' };
      }

      const cleanId = questionId.trim();
      const mergedPayload = sanitizeForFirestore({
        ...originalQuestion,
        ...updatedFields,
        id: cleanId,
        canonicalQuestionId: originalQuestion.canonicalQuestionId || cleanId,
        appearances: originalQuestion.appearances,
        examHistory: originalQuestion.examHistory,
        repeatCount: originalQuestion.repeatCount,
        importanceLevel: originalQuestion.importanceLevel,
        difficulty: updatedFields.difficulty || originalQuestion.difficulty || 'medium',
        updatedAt: Date.now(),
      });

      // Use REST pipeline with admin ID token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Admin authentication required to save question edits to Firestore.');
      }

      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('/api/admin/publish-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          questions: [mergedPayload],
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error || `Failed to update question with HTTP ${response.status}`);
      }

      // Re-validate single question
      const revalidatedQuestion: Question = {
        ...originalQuestion,
        ...updatedFields,
      };
      const newAudit = validateQuestionBatchQuality([revalidatedQuestion]);
      if (newAudit.length > 0) {
        this.auditResults.set(cleanId, newAudit[0]);
        this.saveCachedAudit();
      }

      return { success: true };
    } catch (err: any) {
      console.error('Failed to safely edit question:', err);
      return { success: false, error: err?.message || 'Failed to update question in Firestore.' };
    }
  }

  /**
   * Admin Action: DELETE QUESTION
   * Safely deletes ONLY the exact resolved production question document from Firestore question_bank,
   * updates any linked user reports to status='resolved' (preserving audit history),
   * and removes audit entry and runtime memory caches.
   */
  public async deleteQuestionSafely(
    exactDocId: string, 
    originalQuestion?: Question
  ): Promise<{ success: boolean; error?: string }> {
    if (!exactDocId || typeof exactDocId !== 'string' || exactDocId.trim() === '') {
      console.error('[Quality Delete] failed: Missing exact Firestore document ID');
      return { success: false, error: 'Cannot delete: Question does not have a unique Firestore document ID.' };
    }

    const cleanDocId = exactDocId.trim();

    try {
      // 1. Delete ONLY the exact production document from Firestore question_bank
      const ok = await deleteQuestionFromFirestore(cleanDocId);
      if (!ok) {
        return { success: false, error: `Could not delete document ${cleanDocId} from Firestore.` };
      }

      // 2. Resolve linked user discrepancy reports in Firestore (preserving history)
      const linkedReports = this.userReports.filter(r => 
        r.questionId === cleanDocId || 
        (originalQuestion && (r.questionId === originalQuestion.id || r.questionId === originalQuestion.canonicalQuestionId))
      );
      const linkedReportIds = linkedReports.map(r => r.reportId);

      if (linkedReportIds.length > 0) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const idToken = await currentUser.getIdToken();
            await fetch('/api/admin/resolve-reports', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                reportIds: linkedReportIds,
                status: 'resolved',
                resolutionNotes: 'Question permanently deleted from question bank by admin',
              }),
            });
          } catch (repErr) {
            console.warn('[Quality Delete] Report status update notice:', repErr);
          }
        }
      }

      // 3. Clean up runtime engine and quality audit memory
      questionBankEngine.deleteQuestionById(cleanDocId);
      if (originalQuestion?.id && originalQuestion.id !== cleanDocId) {
        questionBankEngine.deleteQuestionById(originalQuestion.id);
      }
      if (originalQuestion?.canonicalQuestionId) {
        questionBankEngine.deleteQuestionById(originalQuestion.canonicalQuestionId);
      }

      this.auditResults.delete(cleanDocId);
      if (originalQuestion?.id) this.auditResults.delete(originalQuestion.id);

      this.userReports = this.userReports.filter(r => 
        r.questionId !== cleanDocId && 
        !linkedReportIds.includes(r.reportId) &&
        (!originalQuestion || (r.questionId !== originalQuestion.id && r.questionId !== originalQuestion.canonicalQuestionId))
      );
      this.saveCachedAudit();

      console.log('[Quality Delete] reports_updated');
      console.log('[Quality Delete] ui_refreshed');

      return { success: true };
    } catch (err: any) {
      console.error(`[Quality Delete] failed code=${err?.code || 'DELETE_ERROR'} message=${err?.message || 'Delete error'}`);
      return { success: false, error: err?.message || 'Delete operation failed' };
    }
  }
}

export const pyqQualityAuditService = new PyqQualityAuditService();
