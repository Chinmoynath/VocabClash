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
import { Question, QuestionCategory, QuestionOptionDetail, ExamAppearance } from '../types';
import { ImportBatch } from '../types/pyqImport';
import { formatExamTag, normalizeExamDate } from './jsonPyqParser';
import { 
  computeQuestionFingerprint, 
  sortAppearances 
} from '../utils/questionFingerprint';

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

        const category = data.category as QuestionCategory;
        const wordOrPhrase = data.wordOrPhrase;
        const options = data.options;
        const correctIndex = typeof data.correctIndex === 'number' ? data.correctIndex : 0;
        const instruction = data.instruction || `Select the most appropriate ${String(category).toUpperCase()} of the given word:`;

        const fingerprint = data.fingerprint || computeQuestionFingerprint(
          category,
          wordOrPhrase,
          options,
          correctIndex,
          instruction
        );

        // Resolve appearances list
        const rawAppearances: ExamAppearance[] = Array.isArray(data.appearances) && data.appearances.length > 0
          ? data.appearances.map((a: any) => ({
              examFamily: a.examFamily || data.examFamily || 'SSC',
              exam: a.exam || data.exam || 'SSC CGL',
              year: typeof a.year === 'number' ? a.year : (data.year || 2024),
              tier: a.tier !== undefined ? a.tier : (data.tier || ''),
              shift: a.shift || null,
              examDate: a.examDate || null,
              questionNumber: a.questionNumber,
            }))
          : [
              {
                examFamily: data.examFamily || 'SSC',
                exam: data.exam || 'SSC CGL',
                year: data.year || 2024,
                tier: data.tier || '',
                shift: data.shift || null,
                examDate: data.examDate || null,
                questionNumber: data.questionNumber,
              }
            ];

        const appearances = sortAppearances(rawAppearances);
        const primaryApp = appearances[0];

        // Format dynamic exam history tags from appearances
        const examHistory = Array.isArray(data.examHistory) && data.examHistory.length > 0
          ? data.examHistory
          : appearances.map(app => formatExamTag(app.exam, app.year, app.tier));

        const repeatCount = Math.max(
          typeof data.repeatCount === 'number' ? data.repeatCount : 1,
          appearances.length
        );

        questions.push({
          id: docSnap.id,
          category,
          wordOrPhrase,
          instruction,
          options,
          correctIndex,
          meaning: data.meaning || '',
          hindiMeaning: data.hindiMeaning || '',
          exampleSentence: data.exampleSentence || '',
          mnemonic: data.mnemonic || '',
          rootWordInfo: data.rootWordInfo || '',
          explanation: data.explanation || '',
          optionDetails: validOptionDetails,
          enrichment: data.enrichment || undefined,
          fingerprint,
          appearances,
          examHistory,
          repeatCount,
          importanceLevel: data.importanceLevel || 'ultra-high',
          difficulty: data.difficulty || 'medium',
          isPYQ: data.isPYQ !== undefined ? Boolean(data.isPYQ) : true,
          verified: data.verified !== undefined ? Boolean(data.verified) : true,
          sourceType: data.sourceType || 'verified_pyq',
          examFamily: primaryApp.examFamily || data.examFamily || 'SSC',
          exam: primaryApp.exam || data.exam || 'SSC CGL',
          year: primaryApp.year || data.year || 2024,
          tier: primaryApp.tier !== undefined ? primaryApp.tier : (data.tier || ''),
          shift: primaryApp.shift || data.shift || null,
          examDate: primaryApp.examDate || data.examDate || null,
          questionNumber: primaryApp.questionNumber || data.questionNumber || undefined,
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

        const defaultApp: ExamAppearance = {
          examFamily: q.examFamily || batch.examFamily || 'SSC',
          exam: q.exam || batch.exam || 'SSC CGL',
          year: q.year || batch.year || 2024,
          tier: q.tier || batch.tier || '',
          shift: resolvedShift,
          examDate: resolvedExamDate,
          questionNumber: q.questionNumber !== undefined && q.questionNumber !== null ? q.questionNumber : null,
        };

        // Determine canonical appearances
        const appearances: ExamAppearance[] = Array.isArray(q.appearances) && q.appearances.length > 0
          ? sortAppearances(q.appearances)
          : [defaultApp];

        const primaryApp = appearances[0] || defaultApp;
        const validOptionDetails = (Array.isArray(q.optionDetails) && q.optionDetails.length === 4)
          ? q.optionDetails
          : null;

        const fingerprint = q.fingerprint || computeQuestionFingerprint(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.correctIndex,
          q.instruction || q.question
        );

        const examHistoryTags = appearances.map(app => formatExamTag(app.exam, app.year, app.tier));
        const repeatCount = Math.max(q.repeatCount || 1, appearances.length);

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
          fingerprint,
          appearances,
          examFamily: primaryApp.examFamily || 'SSC',
          exam: primaryApp.exam || 'SSC CGL',
          year: primaryApp.year || 2024,
          tier: primaryApp.tier || '',
          shift: primaryApp.shift || resolvedShift,
          examDate: primaryApp.examDate || resolvedExamDate,
          questionNumber: primaryApp.questionNumber || (q.questionNumber !== undefined ? q.questionNumber : null),
          examHistory: examHistoryTags,
          repeatCount,
          importanceLevel: q.importanceLevel || 'ultra-high',
          difficulty: q.difficulty || 'medium',
          isPYQ: q.isPYQ !== undefined ? q.isPYQ : true,
          verified: q.verified !== undefined ? q.verified : true,
          sourceType: q.sourceType || (q.isPYQ === false ? 'generated_practice' : 'verified_pyq'),
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
