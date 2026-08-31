import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  db, 
  handleFirestoreError, 
  OperationType, 
  auth, 
  isFirestoreQuotaExhausted, 
  markFirestoreQuotaExhausted 
} from './firebaseService';
import { Question, QuestionCategory, QuestionOptionDetail } from '../types';
import { ImportBatch } from '../types/pyqImport';
import { formatExamTag, normalizeExamDate } from './jsonPyqParser';

export const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';

/**
 * Remove undefined values recursively so Firestore setDoc/writeBatch never fails
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && data.constructor === Object) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  return norm === ADMIN_EMAIL.toLowerCase();
}

/**
 * Fetch all published questions from Firestore `question_bank` collection
 */
export async function fetchPublishedQuestionBank(): Promise<Question[]> {
  const path = 'question_bank';
  try {
    if (isFirestoreQuotaExhausted()) {
      return [];
    }

    const qCol = collection(db, path);
    const snapshot = await getDocs(qCol);
    const questions: Question[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.category && data.wordOrPhrase && Array.isArray(data.options)) {
        let validOptionDetails: QuestionOptionDetail[] | undefined = undefined;
        if (Array.isArray(data.optionDetails) && data.optionDetails.length === 4) {
          validOptionDetails = data.optionDetails.map((od: any) => ({
            option: String(od.option || ''),
            englishMeaning: String(od.englishMeaning || od.meaning || ''),
            hindiMeaning: String(od.hindiMeaning || od.hindi || ''),
            shortExplanation: od.shortExplanation ? String(od.shortExplanation) : undefined,
            mnemonicHook: od.mnemonicHook ? String(od.mnemonicHook) : undefined,
          }));
        }

        questions.push({
          id: docSnap.id,
          category: data.category as QuestionCategory,
          wordOrPhrase: data.wordOrPhrase,
          instruction: data.instruction || `Select the most appropriate ${String(data.category).toUpperCase()} of the given word:`,
          options: data.options,
          correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
          meaning: data.meaning || '',
          hindiMeaning: data.hindiMeaning || '',
          exampleSentence: data.exampleSentence || '',
          mnemonic: data.mnemonic || '',
          rootWordInfo: data.rootWordInfo || '',
          explanation: data.explanation || '',
          optionDetails: validOptionDetails,
          enrichment: data.enrichment || undefined,
          examHistory: Array.isArray(data.examHistory) ? data.examHistory : ['Govt Exam PYQ Bank'],
          repeatCount: typeof data.repeatCount === 'number' ? data.repeatCount : 1,
          importanceLevel: data.importanceLevel || 'ultra-high',
          difficulty: data.difficulty || 'medium',
          isPYQ: true,
          verified: true,
          examFamily: data.examFamily || 'SSC',
          exam: data.exam || 'SSC CGL',
          year: data.year || 2024,
          shift: data.shift || null,
          examDate: data.examDate || null,
          questionNumber: data.questionNumber || undefined,
        });
      }
    });

    return questions;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

/**
 * Publish approved questions to Firestore in batches (with quota limit detection)
 */
export async function publishApprovedQuestionsToFirestore(
  batch: ImportBatch,
  questions: Question[]
): Promise<{ success: boolean; publishedCount: number; isQuotaExhausted?: boolean; error?: string }> {
  if (questions.length === 0) {
    return { success: true, publishedCount: 0 };
  }

  const currentUser = auth.currentUser;
  if (!currentUser || !isUserAdmin(currentUser.email)) {
    return { 
      success: false, 
      publishedCount: 0, 
      error: 'Unauthorized: Only authorized admin account can publish questions.' 
    };
  }

  if (isFirestoreQuotaExhausted()) {
    return {
      success: false,
      isQuotaExhausted: true,
      publishedCount: 0,
      error: 'Firestore Free Tier daily write quota is currently reached (20,000 writes/day). The questions have been registered to your local runtime question bank and are 100% playable in-game!'
    };
  }

  let totalPublished = 0;

  try {
    // 1. Record batch metadata in `pyq_import_batches`
    const batchDocRef = doc(db, 'pyq_import_batches', batch.batchId);
    const resolvedBatchShift = (batch.shift && batch.shift !== 'Not Specified' && batch.shift !== 'null' && batch.shift !== 'undefined')
      ? batch.shift
      : null;
    const resolvedBatchExamDate = batch.examDate ? normalizeExamDate(batch.examDate) : null;

    const sanitizedBatch = sanitizeForFirestore({
      ...batch,
      shift: resolvedBatchShift,
      examDate: resolvedBatchExamDate,
      status: 'completed',
      publishedCount: questions.length,
      updatedAt: Date.now(),
    });

    await setDoc(batchDocRef, sanitizedBatch, { merge: true });

    // 2. Commit questions to `question_bank` in safe chunks with stream drain delay
    const CHUNK_SIZE = 20; // Safe chunk size to avoid write stream queue exhaustion
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const writeBatchInstance = writeBatch(db);

      for (const q of chunk) {
        const docRef = doc(db, 'question_bank', q.id);
        const resolvedShift = (q.shift && q.shift !== 'Not Specified' && q.shift !== 'null' && q.shift !== 'undefined') 
          ? q.shift 
          : resolvedBatchShift;
        const resolvedExamDate = q.examDate ? (normalizeExamDate(q.examDate) || q.examDate) : resolvedBatchExamDate;

        const examFamily = q.examFamily || batch.examFamily || 'SSC';
        const exam = q.exam || batch.exam || 'SSC CGL';
        const year = q.year || batch.year || 2024;
        const questionNumber = q.questionNumber !== undefined && q.questionNumber !== null ? q.questionNumber : null;

        const validOptionDetails = (Array.isArray(q.optionDetails) && q.optionDetails.length === 4)
          ? q.optionDetails
          : null;

        const dynamicExamTag = formatExamTag(exam, year, resolvedExamDate, resolvedShift);

        const payload: any = sanitizeForFirestore({
          id: q.id,
          category: q.category,
          wordOrPhrase: q.wordOrPhrase,
          instruction: q.instruction || `Select the most appropriate ${q.category.toUpperCase()} of the given word:`,
          options: q.options,
          correctIndex: q.correctIndex,
          meaning: q.meaning || '',
          hindiMeaning: q.hindiMeaning || '',
          exampleSentence: q.exampleSentence || '',
          mnemonic: q.mnemonic || '',
          rootWordInfo: q.rootWordInfo || '',
          explanation: q.explanation || '',
          optionDetails: validOptionDetails,
          enrichment: q.enrichment || null,
          examFamily,
          exam,
          year,
          shift: resolvedShift,
          examDate: resolvedExamDate,
          questionNumber,
          appearances: [
            {
              examFamily,
              exam,
              year,
              shift: resolvedShift,
              examDate: resolvedExamDate,
              questionNumber,
            }
          ],
          examHistory: q.examHistory && q.examHistory.length > 0 ? q.examHistory : [
            dynamicExamTag
          ],
          repeatCount: q.repeatCount || 1,
          importanceLevel: q.importanceLevel || 'ultra-high',
          difficulty: q.difficulty || 'medium',
          isPYQ: true,
          verified: true,
          sourceBatchId: batch.batchId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        writeBatchInstance.set(docRef, payload, { merge: true });
      }

      await writeBatchInstance.commit();
      totalPublished += chunk.length;

      // Allow Firestore WebChannel write stream to drain and acknowledge
      if (i + CHUNK_SIZE < questions.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return { success: true, publishedCount: totalPublished };
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isQuota = 
      errMsg.includes('resource-exhausted') || 
      errMsg.includes('Quota limit exceeded') || 
      errMsg.includes('Quota exceeded') ||
      errMsg.includes('Free daily write units');

    if (isQuota) {
      markFirestoreQuotaExhausted();
      return { 
        success: false, 
        isQuotaExhausted: true,
        publishedCount: totalPublished, 
        error: 'Firestore Free Tier daily write quota is currently reached (20,000 writes/day). The questions have been registered to your local runtime question bank and are 100% playable in-game!' 
      };
    }

    console.error('Error publishing approved questions to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, 'question_bank');
    return { 
      success: false, 
      publishedCount: totalPublished, 
      error: errMsg || 'Failed to commit questions to Firestore.' 
    };
  }
}

/**
 * Update learning enrichment fields for a specific question in Firestore
 */
export async function updateQuestionEnrichment(
  questionId: string,
  enrichmentFields: {
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
  }
): Promise<boolean> {
  const path = `question_bank/${questionId}`;
  try {
    if (isFirestoreQuotaExhausted()) return false;
    const docRef = doc(db, 'question_bank', questionId);
    const sanitized = sanitizeForFirestore({
      ...enrichmentFields,
      updatedAt: Date.now(),
    });
    await setDoc(docRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Backfill batches of questions in Firestore
 */
export async function backfillBatchEnrichments(
  updates: { id: string; fields: Partial<Question> }[]
): Promise<{ updatedCount: number; failedCount: number }> {
  let updatedCount = 0;
  let failedCount = 0;
  const CHUNK_SIZE = 15;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const batchInstance = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, 'question_bank', item.id);
      const sanitized = sanitizeForFirestore({
        ...item.fields,
        updatedAt: Date.now(),
      });
      batchInstance.set(docRef, sanitized, { merge: true });
    }

    try {
      await batchInstance.commit();
      updatedCount += chunk.length;
      if (i + CHUNK_SIZE < updates.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.error('Batch enrichment commit error:', e);
      failedCount += chunk.length;
    }
  }

  return { updatedCount, failedCount };
}

/**
 * Fetch recent import batches for admin review history
 */
export async function fetchRecentBatches(limitCount: number = 20): Promise<ImportBatch[]> {
  const path = 'pyq_import_batches';
  try {
    if (isFirestoreQuotaExhausted()) {
      return [];
    }

    const colRef = collection(db, path);
    const q = query(colRef, orderBy('dateImported', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const list: ImportBatch[] = [];
    snap.forEach(docSnap => {
      list.push(docSnap.data() as ImportBatch);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

/**
 * Delete a question from Firestore question_bank (Admin only)
 */
export async function deleteQuestionFromFirestore(questionId: string): Promise<boolean> {
  const path = `question_bank/${questionId}`;
  try {
    const docRef = doc(db, 'question_bank', questionId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
}
