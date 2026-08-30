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
import { db, handleFirestoreError, OperationType, auth } from './firebaseService';
import { Question, QuestionCategory } from '../types';
import { ImportBatch } from '../types/pyqImport';

export const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';

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
    const qCol = collection(db, path);
    const snapshot = await getDocs(qCol);
    const questions: Question[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.category && data.wordOrPhrase && Array.isArray(data.options)) {
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
          examHistory: Array.isArray(data.examHistory) ? data.examHistory : ['Govt Exam PYQ Bank'],
          repeatCount: typeof data.repeatCount === 'number' ? data.repeatCount : 1,
          importanceLevel: data.importanceLevel || 'ultra-high',
          difficulty: data.difficulty || 'medium',
          isPYQ: true,
          verified: true,
        });
      }
    });

    return questions;
  } catch (err) {
    console.warn('Unable to load questions from Firestore question_bank (using local fallback):', err);
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

/**
 * Publish approved questions to Firestore in batches (max 400 writes per batch)
 */
export async function publishApprovedQuestionsToFirestore(
  batch: ImportBatch,
  questions: Question[]
): Promise<{ success: boolean; publishedCount: number; error?: string }> {
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

  const CHUNK_SIZE = 400;
  let totalPublished = 0;

  try {
    // 1. Record batch metadata in `pyq_import_batches`
    const batchDocRef = doc(db, 'pyq_import_batches', batch.batchId);
    await setDoc(batchDocRef, {
      ...batch,
      status: 'completed',
      publishedCount: questions.length,
      updatedAt: Date.now(),
    }, { merge: true });

    // 2. Commit questions to `question_bank` in safe chunks with stream drain delay
    const CHUNK_SIZE = 20; // Safe chunk size to avoid write stream queue exhaustion
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const writeBatchInstance = writeBatch(db);

      for (const q of chunk) {
        const docRef = doc(db, 'question_bank', q.id);
        const payload = {
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
          examHistory: q.examHistory || [],
          repeatCount: q.repeatCount || 1,
          importanceLevel: q.importanceLevel || 'ultra-high',
          difficulty: q.difficulty || 'medium',
          isPYQ: true,
          verified: true,
          sourceBatchId: batch.batchId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
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
    console.error('Error publishing approved questions to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, 'question_bank');
    return { 
      success: false, 
      publishedCount: totalPublished, 
      error: err?.message || 'Failed to commit questions to Firestore.' 
    };
  }
}

/**
 * Fetch recent import batches for admin review history
 */
export async function fetchRecentBatches(limitCount: number = 20): Promise<ImportBatch[]> {
  const path = 'pyq_import_batches';
  try {
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
