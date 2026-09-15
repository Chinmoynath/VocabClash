import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
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
import { ImportBatch, AnswerConflictDetails } from '../types/pyqImport';
import { formatExamTag, normalizeExamDate } from './jsonPyqParser';
import { 
  computeQuestionFingerprint, 
  computeQuestionIdentityKey,
  generateCanonicalQuestionId,
  computeImportanceLevel,
  computeRepeatCount,
  mergeAppearances,
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
            explanation: od.explanation ? String(od.explanation) : undefined,
            shortExplanation: od.shortExplanation ? String(od.shortExplanation) : undefined,
            mnemonicHook: od.mnemonicHook ? String(od.mnemonicHook) : undefined,
          }));
        }

        const category = data.category as QuestionCategory;
        const wordOrPhrase = data.wordOrPhrase;
        const options = data.options;

        // Skip any malformed or statement-numbered questions (e.g., "1 only", "2 only", "Both 1 and 2", "1,2,3,4")
        const hasNumberedOptions = Array.isArray(options) && options.some((opt: any) => {
          const s = String(opt || '').trim().toLowerCase();
          return s === '1 only' || s === '2 only' || s === '3 only' || s === '4 only' ||
                 s.startsWith('both 1') || s.startsWith('neither 1') ||
                 /^\d\s*,\s*\d\s*,\s*\d/.test(s);
        });
        if (hasNumberedOptions) {
          return;
        }

        const correctIndex = typeof data.correctIndex === 'number' ? data.correctIndex : 0;
        const instruction = data.instruction || `Select the most appropriate ${String(category).toUpperCase()} of the given word:`;

        const fingerprint = data.fingerprint || computeQuestionFingerprint(
          category,
          wordOrPhrase,
          options,
          correctIndex,
          instruction
        );

        const identityKey = data.identityKey || computeQuestionIdentityKey(
          category,
          wordOrPhrase,
          options,
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

        const repeatCount = computeRepeatCount(appearances, typeof data.repeatCount === 'number' ? data.repeatCount : 1);
        const importanceLevel = computeImportanceLevel(repeatCount);

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
          identityKey,
          appearances,
          examHistory,
          repeatCount,
          importanceLevel: data.importanceLevel || importanceLevel,
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
 * Record answer key conflicts to Firestore `pyq_import_conflicts` collection
 */
export async function recordAnswerConflicts(
  batchId: string,
  conflicts: {
    questionPrompt: string;
    targetWord: string;
    category: string;
    details: AnswerConflictDetails;
    sourceFileName?: string;
  }[]
): Promise<void> {
  if (conflicts.length === 0) return;
  try {
    const batchInstance = writeBatch(db);
    for (const conf of conflicts) {
      const conflictDocId = `conflict_${batchId}_${Math.random().toString(36).substring(2, 8)}`;
      const docRef = doc(db, 'pyq_import_conflicts', conflictDocId);
      batchInstance.set(docRef, sanitizeForFirestore({
        conflictId: conflictDocId,
        batchId,
        questionPrompt: conf.questionPrompt,
        targetWord: conf.targetWord,
        category: conf.category,
        existingQuestionId: conf.details.existingQuestionId,
        existingCorrectAnswer: conf.details.existingCorrectAnswer,
        incomingCorrectAnswer: conf.details.incomingCorrectAnswer,
        existingOptions: conf.details.existingOptions,
        incomingOptions: conf.details.incomingOptions,
        sourceFileName: conf.sourceFileName,
        status: 'unresolved',
        detectedAt: Date.now(),
      }));
    }
    await batchInstance.commit();
  } catch (err) {
    console.warn('Could not record import conflicts to Firestore:', err);
  }
}

/**
 * Publish approved questions to Firestore in batches (with cross-exam appearance merging and quota limit detection)
 */
export async function publishApprovedQuestionsToFirestore(
  batch: ImportBatch,
  questions: Question[],
  conflictsToRecord?: {
    questionPrompt: string;
    targetWord: string;
    category: string;
    details: AnswerConflictDetails;
    sourceFileName?: string;
  }[]
): Promise<{ success: boolean; publishedCount: number; isQuotaExhausted?: boolean; error?: string }> {
  if (questions.length === 0 && (!conflictsToRecord || conflictsToRecord.length === 0)) {
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

    // 2. Record any detected answer conflicts
    if (conflictsToRecord && conflictsToRecord.length > 0) {
      await recordAnswerConflicts(batch.batchId, conflictsToRecord);
    }

    // 3. Commit questions to `question_bank` in safe chunks with stream drain delay
    const CHUNK_SIZE = 20;
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const writeBatchInstance = writeBatch(db);

      for (const q of chunk) {
        const targetDocId = q.canonicalQuestionId || q.id || generateCanonicalQuestionId(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.correctIndex
        );
        const docRef = doc(db, 'question_bank', targetDocId);

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

        const identityKey = q.identityKey || computeQuestionIdentityKey(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.instruction || q.question
        );

        const examHistoryTags = appearances.map(app => formatExamTag(app.exam, app.year, app.tier));
        const repeatCount = computeRepeatCount(appearances, q.repeatCount);
        const importanceLevel = computeImportanceLevel(repeatCount);

        const payload: any = sanitizeForFirestore({
          id: targetDocId,
          canonicalQuestionId: targetDocId,
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
          identityKey,
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
          importanceLevel,
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

export interface DeduplicationResult {
  totalScanned: number;
  originalCount: number;
  canonicalCount: number;
  duplicateGroupsFound: number;
  mergedCount: number;
  deletedDocCount: number;
  conflictsFound: number;
  conflictCount: number;
  sampleMerged: { targetWord: string; category: string; appearancesCount: number; docIds: string[] }[];
}

/**
 * Migration Tool: Scans existing question bank, merges redundant duplicate documents
 * into canonical records with consolidated appearances, and cleans up redundant duplicates.
 */
export async function deduplicateAndMigrateQuestionBank(
  onProgress?: (progress: { current: number; total: number; stage: string }) => void,
  dryRun: boolean = false
): Promise<DeduplicationResult> {
  onProgress?.({ current: 0, total: 100, stage: 'Fetching published questions...' });
  const questions = await fetchPublishedQuestionBank();
  const fingerprintGroups = new Map<string, Question[]>();
  const identityGroups = new Map<string, Question[]>();

  onProgress?.({ current: 20, total: 100, stage: `Analyzing ${questions.length} questions across exams...` });

  questions.forEach(q => {
    const fp = q.fingerprint || computeQuestionFingerprint(
      q.category,
      q.wordOrPhrase,
      q.options,
      q.correctIndex,
      q.instruction || q.question
    );
    const idKey = q.identityKey || computeQuestionIdentityKey(
      q.category,
      q.wordOrPhrase,
      q.options,
      q.instruction || q.question
    );

    if (!fingerprintGroups.has(fp)) fingerprintGroups.set(fp, []);
    fingerprintGroups.get(fp)!.push(q);

    if (!identityGroups.has(idKey)) identityGroups.set(idKey, []);
    identityGroups.get(idKey)!.push(q);
  });

  let duplicateGroupsFound = 0;
  let mergedCount = 0;
  let deletedDocCount = 0;
  let conflictsFound = 0;
  const sampleMerged: { targetWord: string; category: string; appearancesCount: number; docIds: string[] }[] = [];

  // Check identity conflicts
  identityGroups.forEach((group) => {
    const answers = new Set(group.map(q => q.options[q.correctIndex]));
    if (answers.size > 1) {
      conflictsFound += group.length;
    }
  });

  const totalGroups = fingerprintGroups.size;
  let processedGroups = 0;

  for (const [fp, group] of fingerprintGroups.entries()) {
    processedGroups++;
    if (processedGroups % 20 === 0 || processedGroups === totalGroups) {
      onProgress?.({
        current: processedGroups,
        total: totalGroups,
        stage: `Consolidating group ${processedGroups}/${totalGroups} (${group[0]?.wordOrPhrase})...`,
      });
    }

    if (group.length <= 1) continue;

    duplicateGroupsFound++;
    mergedCount += group.length;

    // Consolidate appearances across all questions in the group
    let consolidatedAppearances: ExamAppearance[] = [];
    let bestOptionDetails = group.find(q => Array.isArray(q.optionDetails) && q.optionDetails.length === 4)?.optionDetails;
    let bestEnrichment = group.find(q => q.enrichment?.status === 'complete')?.enrichment;
    let bestMeaning = group.find(q => q.meaning && q.meaning.trim() !== '')?.meaning || group[0].meaning;
    let bestHindi = group.find(q => q.hindiMeaning && q.hindiMeaning.trim() !== '')?.hindiMeaning || group[0].hindiMeaning;
    let bestMnemonic = group.find(q => q.mnemonic && q.mnemonic.trim() !== '')?.mnemonic || group[0].mnemonic;
    let bestSentence = group.find(q => q.exampleSentence && q.exampleSentence.trim() !== '')?.exampleSentence || group[0].exampleSentence;
    let bestRoot = group.find(q => q.rootWordInfo && q.rootWordInfo.trim() !== '')?.rootWordInfo || group[0].rootWordInfo;
    let bestExpl = group.find(q => q.explanation && q.explanation.trim() !== '')?.explanation || group[0].explanation;

    for (const q of group) {
      if (Array.isArray(q.appearances) && q.appearances.length > 0) {
        const { merged } = mergeAppearances(consolidatedAppearances, q.appearances);
        consolidatedAppearances = merged;
      } else {
        const { merged } = mergeAppearances(consolidatedAppearances, {
          examFamily: q.examFamily || 'SSC',
          exam: q.exam || 'SSC CGL',
          year: q.year || 2024,
          tier: q.tier || '',
          shift: q.shift || null,
          examDate: q.examDate || null,
          questionNumber: q.questionNumber,
        });
        consolidatedAppearances = merged;
      }
    }

    const primaryDoc = group[0];
    const canonicalId = generateCanonicalQuestionId(
      primaryDoc.category,
      primaryDoc.wordOrPhrase,
      primaryDoc.options,
      primaryDoc.correctIndex
    );

    const docIds = group.map(g => g.id);
    if (sampleMerged.length < 10) {
      sampleMerged.push({
        targetWord: primaryDoc.wordOrPhrase,
        category: primaryDoc.category,
        appearancesCount: consolidatedAppearances.length,
        docIds,
      });
    }

    if (!dryRun) {
      const repeatCount = computeRepeatCount(consolidatedAppearances);
      const importanceLevel = computeImportanceLevel(repeatCount);
      const examHistoryTags = consolidatedAppearances.map(a => formatExamTag(a.exam, a.year, a.tier));
      const primaryApp = consolidatedAppearances[0];

      // 1. Write the consolidated canonical document
      const canonicalDocRef = doc(db, 'question_bank', canonicalId);
      const canonicalPayload = sanitizeForFirestore({
        ...primaryDoc,
        id: canonicalId,
        canonicalQuestionId: canonicalId,
        meaning: bestMeaning,
        hindiMeaning: bestHindi,
        mnemonic: bestMnemonic,
        exampleSentence: bestSentence,
        rootWordInfo: bestRoot,
        explanation: bestExpl,
        optionDetails: bestOptionDetails,
        enrichment: bestEnrichment || null,
        appearances: consolidatedAppearances,
        repeatCount,
        importanceLevel,
        examHistory: examHistoryTags,
        examFamily: primaryApp?.examFamily || primaryDoc.examFamily || 'SSC',
        exam: primaryApp?.exam || primaryDoc.exam || 'SSC CGL',
        year: primaryApp?.year || primaryDoc.year || 2024,
        tier: primaryApp?.tier || primaryDoc.tier || '',
        shift: primaryApp?.shift || primaryDoc.shift || null,
        examDate: primaryApp?.examDate || primaryDoc.examDate || null,
        updatedAt: Date.now(),
      });

      await setDoc(canonicalDocRef, canonicalPayload, { merge: true });

      // 2. Delete redundant duplicate docs if different from canonicalId
      for (const oldDoc of group) {
        if (oldDoc.id !== canonicalId) {
          try {
            await deleteDoc(doc(db, 'question_bank', oldDoc.id));
            deletedDocCount++;
          } catch (e) {
            console.warn(`Failed to delete redundant duplicate doc ${oldDoc.id}:`, e);
          }
        }
      }
    }
  }

  const canonicalCount = fingerprintGroups.size;

  return {
    totalScanned: questions.length,
    originalCount: questions.length,
    canonicalCount,
    duplicateGroupsFound,
    mergedCount,
    deletedDocCount,
    conflictsFound,
    conflictCount: conflictsFound,
    sampleMerged,
  };
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
 * Delete a single question from Firestore question_bank (Admin only)
 */
export async function deleteQuestionFromFirestore(questionId: string): Promise<boolean> {
  const path = `question_bank/${questionId}`;
  try {
    const docRef = doc(db, 'question_bank', questionId);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    console.error('[PYQ Admin Delete]', err);
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Delete a batch of question IDs from Firestore question_bank
 */
export async function deleteQuestionsBatch(
  questionIds: string[],
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<{ deletedCount: number; failedCount: number }> {
  let deletedCount = 0;
  let failedCount = 0;
  const CHUNK_SIZE = 25;

  for (let i = 0; i < questionIds.length; i += CHUNK_SIZE) {
    const chunk = questionIds.slice(i, i + CHUNK_SIZE);
    const batchInstance = writeBatch(db);

    for (const qId of chunk) {
      const docRef = doc(db, 'question_bank', qId);
      batchInstance.delete(docRef);
    }

    try {
      await batchInstance.commit();
      deletedCount += chunk.length;
      onProgress?.({
        current: deletedCount,
        total: questionIds.length,
        stage: `Deleted ${deletedCount}/${questionIds.length} questions...`
      });
      if (i + CHUNK_SIZE < questionIds.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.error('Batch deletion error:', e);
      failedCount += chunk.length;
    }
  }

  return { deletedCount, failedCount };
}

export interface PurgeExamResult {
  success: boolean;
  examTarget: string;
  totalScanned: number;
  deletedDocCount: number;
  updatedDocCount: number;
  deletedBatchesCount: number;
  error?: string;
}

/**
 * Permanently purge all questions associated with a specific exam (e.g. "SSC CPO") from Firestore question_bank.
 * Also cleans up corresponding pyq_import_batches.
 */
export async function purgeQuestionsByExam(
  examName: string = 'SSC CPO',
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<PurgeExamResult> {
  const targetNorm = examName.trim().toLowerCase();
  onProgress?.({ current: 0, total: 100, stage: `Scanning Firestore question_bank for ${examName} questions...` });

  try {
    const qCol = collection(db, 'question_bank');
    const snapshot = await getDocs(qCol);
    const docsToDelete: string[] = [];
    const docsToUpdate: { id: string; appearances: ExamAppearance[]; examHistory: string[]; repeatCount: number; importanceLevel: any; primaryApp: ExamAppearance }[] = [];

    onProgress?.({ current: 20, total: 100, stage: `Analyzing ${snapshot.size} total questions...` });

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;

      const primaryExam = String(data.exam || '').toLowerCase();
      const rawApps: ExamAppearance[] = Array.isArray(data.appearances) ? data.appearances : [];
      const examHistory: string[] = Array.isArray(data.examHistory) ? data.examHistory : [];
      const wordOrPhrase = String(data.wordOrPhrase || '');

      // Check if primary exam matches target
      const isPrimaryMatch = primaryExam.includes(targetNorm);

      // Check if any appearance matches target
      const hasTargetApp = rawApps.some(a => String(a.exam || '').toLowerCase().includes(targetNorm));
      const hasTargetHistory = examHistory.some(tag => tag.toLowerCase().includes(targetNorm));

      // Check if question has the instruction text embedded into wordOrPhrase (corrupted instruction artifact)
      const isCorruptedInstruction = 
        wordOrPhrase.toLowerCase().includes('select the most appropriate') ||
        wordOrPhrase.toLowerCase().includes('underlined word') ||
        wordOrPhrase.toLowerCase().includes('given word');

      if (isPrimaryMatch || (rawApps.length === 1 && hasTargetApp) || isCorruptedInstruction) {
        // Solely an SSC CPO question or corrupted instruction doc -> Full Delete
        docsToDelete.push(docSnap.id);
      } else if (rawApps.length > 1 && hasTargetApp) {
        // Multi-exam question -> Strip SSC CPO from appearances and preserve other exams
        const remainingApps = rawApps.filter(a => !String(a.exam || '').toLowerCase().includes(targetNorm));
        if (remainingApps.length === 0) {
          docsToDelete.push(docSnap.id);
        } else {
          const sorted = sortAppearances(remainingApps);
          const primaryApp = sorted[0];
          const newTags = sorted.map(a => formatExamTag(a.exam, a.year, a.tier));
          const repeatCount = computeRepeatCount(sorted);
          const importanceLevel = computeImportanceLevel(repeatCount);
          docsToUpdate.push({
            id: docSnap.id,
            appearances: sorted,
            examHistory: newTags,
            repeatCount,
            importanceLevel,
            primaryApp,
          });
        }
      }
    });

    onProgress?.({
      current: 40,
      total: 100,
      stage: `Found ${docsToDelete.length} documents to delete and ${docsToUpdate.length} to update. Processing deletions...`
    });

    // 1. Process deletions in chunks
    let deletedDocCount = 0;
    const CHUNK_SIZE = 25;
    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      const writeBatchInstance = writeBatch(db);
      for (const docId of chunk) {
        writeBatchInstance.delete(doc(db, 'question_bank', docId));
      }
      await writeBatchInstance.commit();
      deletedDocCount += chunk.length;
      onProgress?.({
        current: 40 + Math.floor((deletedDocCount / Math.max(docsToDelete.length, 1)) * 30),
        total: 100,
        stage: `Deleted ${deletedDocCount}/${docsToDelete.length} ${examName} questions from Firestore...`
      });
      if (i + CHUNK_SIZE < docsToDelete.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // 2. Process updates in chunks
    let updatedDocCount = 0;
    for (let i = 0; i < docsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = docsToUpdate.slice(i, i + CHUNK_SIZE);
      const writeBatchInstance = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, 'question_bank', item.id);
        writeBatchInstance.set(docRef, sanitizeForFirestore({
          appearances: item.appearances,
          examHistory: item.examHistory,
          repeatCount: item.repeatCount,
          importanceLevel: item.importanceLevel,
          exam: item.primaryApp.exam,
          examFamily: item.primaryApp.examFamily || 'SSC',
          year: item.primaryApp.year || 2024,
          tier: item.primaryApp.tier || '',
          shift: item.primaryApp.shift || null,
          examDate: item.primaryApp.examDate || null,
          updatedAt: Date.now(),
        }), { merge: true });
      }
      await writeBatchInstance.commit();
      updatedDocCount += chunk.length;
      if (i + CHUNK_SIZE < docsToUpdate.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // 3. Clean up pyq_import_batches matching examName
    onProgress?.({ current: 85, total: 100, stage: `Cleaning up import batch records for ${examName}...` });
    let deletedBatchesCount = 0;
    try {
      const batchCol = collection(db, 'pyq_import_batches');
      const batchSnap = await getDocs(batchCol);
      const batchDeletes: string[] = [];
      batchSnap.forEach(bSnap => {
        const bData = bSnap.data();
        if (bData && String(bData.exam || '').toLowerCase().includes(targetNorm)) {
          batchDeletes.push(bSnap.id);
        }
      });

      if (batchDeletes.length > 0) {
        const batchWrite = writeBatch(db);
        for (const bId of batchDeletes) {
          batchWrite.delete(doc(db, 'pyq_import_batches', bId));
        }
        await batchWrite.commit();
        deletedBatchesCount = batchDeletes.length;
      }
    } catch (bErr) {
      console.warn('Could not clean import batches:', bErr);
    }

    onProgress?.({
      current: 100,
      total: 100,
      stage: `Completed! Deleted ${deletedDocCount} questions, updated ${updatedDocCount}, and deleted ${deletedBatchesCount} batches.`
    });

    return {
      success: true,
      examTarget: examName,
      totalScanned: snapshot.size,
      deletedDocCount,
      updatedDocCount,
      deletedBatchesCount,
    };
  } catch (err: any) {
    console.error(`Error purging ${examName} questions:`, err);
    return {
      success: false,
      examTarget: examName,
      totalScanned: 0,
      deletedDocCount: 0,
      updatedDocCount: 0,
      deletedBatchesCount: 0,
      error: err?.message || 'Failed to purge exam questions.',
    };
  }
}

/**
 * Convenience helper to purge all uploaded SSC CPO questions specifically
 */
export async function purgeAllSscCpoQuestions(
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<PurgeExamResult> {
  return purgeQuestionsByExam('SSC CPO', onProgress);
}


