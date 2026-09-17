import { Question, QuestionCategory } from '../types';
import { db, auth } from './firebaseService';
import { collection, doc, writeBatch, getDocs, query, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { syncHistoryWithReviewStates, setHistoryAuthUid } from '../utils/questionHistoryManager';

export type ReviewLevel = 'new' | 'learning' | 'familiar' | 'strong' | 'mastered';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  memoryKey: string;
  category: QuestionCategory;
  conceptDisplay: string;
  firstSeenAt: number;
  lastSeenAt: number;
  lastReviewedAt?: number;
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  lapseCount: number;
  lastResult: ReviewGrade;
  lastSeenOrdinal: number;
  dueAt: number;
  nextReviewAt?: number; // Alias/synonym for dueAt to ensure full cross-service compatibility
  dueAfterOrdinal: number | null;
  level: ReviewLevel;
  easeFactor?: number;
  averageResponseMs?: number;
  recentQuestionIds: string[];
  distinctDaysCount: number;
  lastDayStr: string;
  isSaved?: boolean;
  updatedAt?: number;
}

const STORAGE_KEY_REVIEWS_PREFIX = 'vocabclash_review_states_v3';
const STORAGE_KEY_MIGRATION = 'vocabclash_v3_migration_done';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function applyFuzz(baseDays: number, fuzzRatio: number = 0.18): number {
  const variation = (Math.random() * 2 - 1) * fuzzRatio;
  return Math.max(0.2, baseDays * (1 + variation));
}

class QuestionReviewScheduler {
  private reviewStates: Map<string, ReviewState> = new Map();
  private sessionOrdinal: number = 0;
  private recentMemoryKeys: string[] = []; // Last ~100
  private recentQuestionIds: string[] = []; // Last ~200
  private pendingSyncKeys: Set<string> = new Set();
  private syncTimer: any = null;
  private initialized: boolean = false;
  private currentAuthUid: string | null = null;
  private lastReconcileTime: number = 0;
  private isReconciling: boolean = false;
  private listenersAttached: boolean = false;

  public init() {
    if (this.initialized) return;
    this.loadFromLocalStorage();
    this.performLegacyMigration();
    this.setupLifecycleListeners();
    this.initialized = true;
  }

  private getStorageKey(): string {
    return this.currentAuthUid ? `${STORAGE_KEY_REVIEWS_PREFIX}_${this.currentAuthUid}` : STORAGE_KEY_REVIEWS_PREFIX;
  }

  private setupLifecycleListeners() {
    if (this.listenersAttached || typeof window === 'undefined') return;
    this.listenersAttached = true;

    // 1. Visibility change: flush pending on hide, throttled reconcile on show
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushCloudSync().catch(() => {});
      } else if (document.visibilityState === 'visible') {
        if (this.currentAuthUid) {
          this.reconcileWithCloud(this.currentAuthUid).catch(() => {});
        }
      }
    });

    // 2. Page / App hide
    window.addEventListener('pagehide', () => {
      this.flushCloudSync().catch(() => {});
    });

    // 3. Window focus (returning to tab)
    window.addEventListener('focus', () => {
      if (this.currentAuthUid) {
        this.reconcileWithCloud(this.currentAuthUid).catch(() => {});
      }
    });

    // 4. Online event (network reconnection)
    window.addEventListener('online', () => {
      this.flushCloudSync().catch(() => {});
      if (this.currentAuthUid) {
        this.reconcileWithCloud(this.currentAuthUid, true).catch(() => {});
      }
    });
  }

  // Current session ordinal for relative in-session spacing
  public getSessionOrdinal(): number {
    return this.sessionOrdinal;
  }

  public incrementSessionOrdinal(): number {
    this.sessionOrdinal += 1;
    return this.sessionOrdinal;
  }

  public getRecentMemoryKeys(): string[] {
    return this.recentMemoryKeys;
  }

  public getRecentQuestionIds(): string[] {
    return this.recentQuestionIds;
  }

  public getReviewState(memoryKey: string): ReviewState | undefined {
    this.init();
    return this.reviewStates.get(memoryKey.toLowerCase().trim());
  }

  public getAllReviewStates(): ReviewState[] {
    this.init();
    return Array.from(this.reviewStates.values());
  }

  // Check if a concept is due for review
  public isConceptDue(memoryKey: string, now: number = Date.now()): boolean {
    const state = this.reviewStates.get(memoryKey.toLowerCase().trim());
    if (!state || state.seenCount === 0) return false;

    // 1. In-session ordinal check
    if (state.dueAfterOrdinal !== null && this.sessionOrdinal >= state.dueAfterOrdinal) {
      return true;
    }

    // 2. Long-term timestamp check (using dueAt or nextReviewAt)
    const effectiveDueAt = state.nextReviewAt || state.dueAt;
    if (effectiveDueAt && effectiveDueAt <= now) {
      return true;
    }

    return false;
  }

  // Automatic result grading from response behavior
  public inferGrade(isCorrect: boolean, responseTimeMs?: number, previousConsecutive: number = 0): ReviewGrade {
    if (!isCorrect) return 'again';
    if (responseTimeMs !== undefined && responseTimeMs > 10000) return 'hard';
    if (responseTimeMs !== undefined && responseTimeMs < 3500 && previousConsecutive >= 1) return 'easy';
    return 'good';
  }

  // Record an attempt on a question concept
  public recordAttempt(
    question: Question,
    isCorrect: boolean,
    responseTimeMs?: number
  ): ReviewState {
    this.init();
    const memoryKey = (question.memoryKey || question.conceptKey || question.wordOrPhrase).toLowerCase().trim();
    const category = question.category;
    const now = Date.now();
    const today = getTodayStr();

    this.sessionOrdinal += 1;

    // Track recency (~25-30 concepts, ~75-80 question IDs)
    this.recentMemoryKeys = [
      ...this.recentMemoryKeys.filter(k => k !== memoryKey),
      memoryKey
    ].slice(-30);

    if (question.id) {
      this.recentQuestionIds = [
        ...this.recentQuestionIds.filter(id => id !== question.id),
        question.id
      ].slice(-80);
    }

    const existing: ReviewState = this.reviewStates.get(memoryKey) || {
      memoryKey,
      category,
      conceptDisplay: question.wordOrPhrase,
      firstSeenAt: now,
      lastSeenAt: now,
      lastReviewedAt: now,
      seenCount: 0,
      correctCount: 0,
      wrongCount: 0,
      consecutiveCorrect: 0,
      lapseCount: 0,
      lastResult: 'good' as ReviewGrade,
      lastSeenOrdinal: this.sessionOrdinal,
      dueAt: now,
      nextReviewAt: now,
      dueAfterOrdinal: null,
      level: 'new' as ReviewLevel,
      easeFactor: 2.5,
      averageResponseMs: responseTimeMs || 4000,
      recentQuestionIds: [],
      distinctDaysCount: 1,
      lastDayStr: today,
      updatedAt: now,
    };

    const grade = this.inferGrade(isCorrect, responseTimeMs, existing.consecutiveCorrect);

    existing.seenCount += 1;
    existing.lastSeenAt = now;
    existing.lastReviewedAt = now;
    existing.lastSeenOrdinal = this.sessionOrdinal;
    existing.lastResult = grade;
    existing.updatedAt = now;

    if (existing.lastDayStr !== today) {
      existing.distinctDaysCount += 1;
      existing.lastDayStr = today;
    }

    if (responseTimeMs) {
      existing.averageResponseMs = Math.round(
        (existing.averageResponseMs || responseTimeMs) * 0.7 + responseTimeMs * 0.3
      );
    }

    if (question.id && !existing.recentQuestionIds.includes(question.id)) {
      existing.recentQuestionIds = [...existing.recentQuestionIds.slice(-4), question.id];
    }

    // Dynamic ease factor adjustment (SM-2 inspired)
    let ease = existing.easeFactor || 2.5;
    if (grade === 'again') {
      ease = Math.max(1.3, ease - 0.2);
    } else if (grade === 'hard') {
      ease = Math.max(1.3, ease - 0.15);
    } else if (grade === 'easy') {
      ease = Math.min(3.0, ease + 0.15);
    }
    existing.easeFactor = Number(ease.toFixed(2));

    if (!isCorrect) {
      // WRONG ANSWER: again
      existing.wrongCount += 1;
      existing.consecutiveCorrect = 0;
      existing.lapseCount += 1;

      // In-session repeat with natural, unpredictable spacing (randomly 20 to 30 questions later)
      const fuzzGap = Math.floor(20 + Math.random() * 11); // 20 to 30
      existing.dueAfterOrdinal = this.sessionOrdinal + fuzzGap;

      // High-priority next day calendar retry (~1 day ± 15% jitter)
      const dueDays = applyFuzz(1.0, 0.15);
      const computedDue = now + Math.round(dueDays * 86400000);
      existing.dueAt = computedDue;
      existing.nextReviewAt = computedDue;
      existing.level = 'learning';
    } else {
      // CORRECT ANSWER: good / easy / hard
      existing.correctCount += 1;
      existing.consecutiveCorrect += 1;
      existing.dueAfterOrdinal = null;

      // Spaced interval progression: 3d -> 7d -> 14d -> 30d -> 60d
      let baseIntervalDays = 3;
      if (existing.consecutiveCorrect === 1) {
        baseIntervalDays = 3;
      } else if (existing.consecutiveCorrect === 2) {
        baseIntervalDays = 7;
      } else if (existing.consecutiveCorrect === 3) {
        baseIntervalDays = 14;
      } else if (existing.consecutiveCorrect === 4) {
        baseIntervalDays = 30;
      } else {
        baseIntervalDays = 60;
      }

      // Small speed modifier (max ~10-15%, only applied when correct)
      if (grade === 'easy') {
        baseIntervalDays *= 1.12; // +12% slight boost for confident fast recall
      } else if (grade === 'hard') {
        baseIntervalDays *= 0.88; // -12% slight reduction for slow recall
      }

      // Light jitter (12%) so items don't clump on the exact same second
      const fuzzedDays = applyFuzz(baseIntervalDays, 0.12);
      const computedDue = now + Math.round(fuzzedDays * 86400000);
      existing.dueAt = computedDue;
      existing.nextReviewAt = computedDue;

      // Mastery: ~4 successful reviews across separate sessions/days with no active lapses
      if (
        existing.consecutiveCorrect >= 4 &&
        existing.distinctDaysCount >= 2 &&
        existing.lapseCount === 0
      ) {
        existing.level = 'mastered';
      } else if (existing.consecutiveCorrect >= 3) {
        existing.level = 'strong';
      } else if (existing.consecutiveCorrect >= 2) {
        existing.level = 'familiar';
      } else {
        existing.level = 'learning';
      }
    }

    this.reviewStates.set(memoryKey, existing);
    this.pendingSyncKeys.add(memoryKey);

    this.saveToLocalStorage();
    syncHistoryWithReviewStates([existing]);
    this.scheduleCloudSync();

    return existing;
  }

  // Set saved status
  public setSavedStatus(memoryKey: string, isSaved: boolean) {
    this.init();
    const key = memoryKey.toLowerCase().trim();
    const state = this.reviewStates.get(key);
    if (state) {
      state.isSaved = isSaved;
      state.updatedAt = Date.now();
      this.pendingSyncKeys.add(key);
      this.saveToLocalStorage();
      this.scheduleCloudSync();
    }
  }

  // Summary statistics for dashboard/practice UI
  public getStats(): {
    totalConcepts: number;
    newCount: number;
    learningCount: number;
    familiarCount: number;
    strongCount: number;
    masteredCount: number;
    dueCount: number;
  } {
    this.init();
    const all = Array.from(this.reviewStates.values());
    const now = Date.now();

    let newCount = 0;
    let learningCount = 0;
    let familiarCount = 0;
    let strongCount = 0;
    let masteredCount = 0;
    let dueCount = 0;

    for (const s of all) {
      if (s.level === 'mastered') masteredCount++;
      else if (s.level === 'strong') strongCount++;
      else if (s.level === 'familiar') familiarCount++;
      else if (s.level === 'learning') learningCount++;
      else newCount++;

      if (this.isConceptDue(s.memoryKey, now)) {
        dueCount++;
      }
    }

    return {
      totalConcepts: all.length,
      newCount,
      learningCount,
      familiarCount,
      strongCount,
      masteredCount,
      dueCount,
    };
  }

  // Local Storage persistence
  private loadFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storageKey = this.getStorageKey();
      let raw = localStorage.getItem(storageKey);
      
      // Migration fallback from global storage key if user-scoped key is empty
      if (!raw && this.currentAuthUid) {
        raw = localStorage.getItem(STORAGE_KEY_REVIEWS_PREFIX);
      }

      if (raw) {
        const parsed: ReviewState[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.memoryKey) {
              const normalizedKey = item.memoryKey.toLowerCase().trim();
              if (!item.nextReviewAt && item.dueAt) {
                item.nextReviewAt = item.dueAt;
              }
              this.reviewStates.set(normalizedKey, item);
            }
          }
        }
      }

      // Reconcile questionHistoryManager with all existing review states
      if (this.reviewStates.size > 0) {
        syncHistoryWithReviewStates(Array.from(this.reviewStates.values()));
      }
    } catch (e) {
      console.warn('Failed to load review states from localStorage:', e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const array = Array.from(this.reviewStates.values());
      localStorage.setItem(this.getStorageKey(), JSON.stringify(array));
    } catch (e) {
      console.warn('Failed to save review states to localStorage:', e);
    }
  }

  // Migration from legacy mastery data (vocabclash_pyq_mastery_v2)
  private performLegacyMigration() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const migrated = localStorage.getItem(STORAGE_KEY_MIGRATION);
      if (migrated) return;

      const rawMastery = localStorage.getItem('vocabclash_pyq_mastery_v2');
      if (rawMastery) {
        const parsed = JSON.parse(rawMastery);
        const now = Date.now();
        const today = getTodayStr();

        for (const [key, oldRecord] of Object.entries<any>(parsed)) {
          const memoryKey = `word:${key.toLowerCase().trim()}`;
          if (!this.reviewStates.has(memoryKey) && oldRecord) {
            const correct = oldRecord.correctCount || 0;
            const incorrect = oldRecord.incorrectCount || 0;
            const consecutive = oldRecord.consecutiveCorrect || (correct > 0 && incorrect === 0 ? correct : 1);

            let initialLevel: ReviewLevel = 'learning';
            if (correct >= 4 && consecutive >= 2) initialLevel = 'familiar';
            if (correct >= 7 && consecutive >= 3) initialLevel = 'strong';

            const due = now + (correct >= 3 ? 86400000 * 2 : 86400000);
            const migratedState: ReviewState = {
              memoryKey,
              category: 'synonyms',
              conceptDisplay: key,
              firstSeenAt: oldRecord.lastAttemptTimestamp || now - 86400000 * 3,
              lastSeenAt: oldRecord.lastAttemptTimestamp || now,
              lastReviewedAt: oldRecord.lastAttemptTimestamp || now,
              seenCount: correct + incorrect,
              correctCount: correct,
              wrongCount: incorrect,
              consecutiveCorrect: Math.min(3, consecutive),
              lapseCount: incorrect > 0 ? 1 : 0,
              lastResult: incorrect > 0 ? 'hard' : 'good',
              lastSeenOrdinal: 0,
              dueAt: due,
              nextReviewAt: due,
              dueAfterOrdinal: null,
              level: initialLevel,
              easeFactor: 2.5,
              recentQuestionIds: [],
              distinctDaysCount: correct >= 3 ? 2 : 1,
              lastDayStr: today,
              updatedAt: now,
            };

            this.reviewStates.set(memoryKey, migratedState);
          }
        }
      }

      localStorage.setItem(STORAGE_KEY_MIGRATION, 'true');
      this.saveToLocalStorage();
    } catch (e) {
      console.warn('Legacy review migration skipped or failed:', e);
    }
  }

  // Cloud Sync for logged-in users (batched & throttled)
  private scheduleCloudSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.flushCloudSync().catch(err => console.warn('Background review sync error:', err));
    }, 4000);
  }

  public async flushCloudSync(): Promise<void> {
    const user = auth.currentUser;
    if (!user || this.pendingSyncKeys.size === 0) return;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    const keysToSync = Array.from(this.pendingSyncKeys);
    this.pendingSyncKeys.clear();

    try {
      const batch = writeBatch(db);
      let opCount = 0;
      const now = Date.now();

      for (const key of keysToSync) {
        const state = this.reviewStates.get(key);
        if (state) {
          // Sanitize key for Firestore doc ID
          const safeDocId = encodeURIComponent(key).replace(/\./g, '_').slice(0, 100);
          const docRef = doc(db, 'users', user.uid, 'review_progress', safeDocId);
          const payload = {
            ...state,
            dueAt: state.dueAt || state.nextReviewAt || now,
            nextReviewAt: state.nextReviewAt || state.dueAt || now,
            updatedAt: state.updatedAt || now,
          };
          batch.set(docRef, payload, { merge: true });
          opCount++;
          if (opCount >= 400) break; // Firestore batch write cap
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('Error syncing review progress to Firestore:', err);
      // Re-add unsynced keys on failure so they are retried on next sync/lifecycle
      for (const k of keysToSync) this.pendingSyncKeys.add(k);
    }
  }

  /**
   * Resets all in-memory review states and clears local storage on logout
   */
  public reset(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.pendingSyncKeys.clear();
    this.reviewStates.clear();
    this.sessionOrdinal = 0;
    this.recentMemoryKeys = [];
    this.recentQuestionIds = [];
    this.currentAuthUid = null;
    this.initialized = false;
    this.lastReconcileTime = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY_REVIEWS_PREFIX);
      } catch (e) {
        console.warn('Failed to clear review states from localStorage:', e);
      }
    }
  }

  // Hydrate user progress from Firestore subcollection on login or user switch
  public setAuthUser(uid: string | null) {
    setHistoryAuthUid(uid);
    if (this.currentAuthUid && !uid) {
      // Authenticated user logged out: clean memory and localStorage
      this.reset();
      return;
    }
    if (this.currentAuthUid && uid && this.currentAuthUid !== uid) {
      // User switched: reset previous user's data before hydrating
      this.reset();
    }
    this.currentAuthUid = uid;
    if (uid) {
      this.loadFromLocalStorage();
      this.hydrateUserProgressFromCloud(uid).catch(err => console.warn('Hydrate review progress error:', err));
    }
  }

  /**
   * Comprehensive cloud hydration supporting >1000 records using pagination.
   * Merges authoritative cloud review state into local Map deterministically.
   */
  public async hydrateUserProgressFromCloud(uid: string): Promise<number> {
    try {
      const colRef = collection(db, 'users', uid, 'review_progress');
      let count = 0;
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      let hasMore = true;
      const PAGE_SIZE = 500;

      while (hasMore) {
        const q = lastDoc
          ? query(colRef, orderBy('updatedAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
          : query(colRef, orderBy('updatedAt', 'desc'), limit(PAGE_SIZE));

        const snap = await getDocs(q);
        if (snap.empty) {
          hasMore = false;
          break;
        }

        snap.forEach(docSnap => {
          const data = docSnap.data() as ReviewState;
          if (data && data.memoryKey) {
            const key = data.memoryKey.toLowerCase().trim();
            const existing = this.reviewStates.get(key);
            const isPending = this.pendingSyncKeys.has(key);

            const cloudTime = data.updatedAt || data.lastSeenAt || 0;
            const localTime = existing ? (existing.updatedAt || existing.lastSeenAt || 0) : 0;

            if (!existing) {
              const normalizedData: ReviewState = {
                ...data,
                dueAt: data.dueAt || data.nextReviewAt || cloudTime,
                nextReviewAt: data.nextReviewAt || data.dueAt || cloudTime,
              };
              this.reviewStates.set(key, normalizedData);
              count++;
            } else if (!isPending && cloudTime >= localTime) {
              const normalizedData: ReviewState = {
                ...existing,
                ...data,
                dueAt: data.dueAt || data.nextReviewAt || cloudTime,
                nextReviewAt: data.nextReviewAt || data.dueAt || cloudTime,
              };
              this.reviewStates.set(key, normalizedData);
              count++;
            } else if (isPending) {
              // Local has pending changes: merge metrics conservatively
              const merged: ReviewState = {
                ...data,
                ...existing,
                seenCount: Math.max(existing.seenCount || 0, data.seenCount || 0),
                correctCount: Math.max(existing.correctCount || 0, data.correctCount || 0),
                wrongCount: Math.max(existing.wrongCount || 0, data.wrongCount || 0),
                dueAt: localTime >= cloudTime ? (existing.dueAt || existing.nextReviewAt || localTime) : (data.dueAt || data.nextReviewAt || cloudTime),
                nextReviewAt: localTime >= cloudTime ? (existing.nextReviewAt || existing.dueAt || localTime) : (data.nextReviewAt || data.dueAt || cloudTime),
                level: localTime >= cloudTime ? existing.level : data.level,
                consecutiveCorrect: localTime >= cloudTime ? existing.consecutiveCorrect : data.consecutiveCorrect,
                lastSeenAt: Math.max(existing.lastSeenAt || 0, data.lastSeenAt || 0),
                lastReviewedAt: Math.max(existing.lastReviewedAt || 0, data.lastReviewedAt || 0),
                updatedAt: Math.max(existing.updatedAt || 0, data.updatedAt || 0),
              };
              this.reviewStates.set(key, merged);
              count++;
            }
          }
        });

        if (snap.size < PAGE_SIZE) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }

      if (count > 0) {
        this.saveToLocalStorage();
        syncHistoryWithReviewStates(Array.from(this.reviewStates.values()));
      }
      this.lastReconcileTime = Date.now();
      return count;
    } catch (err) {
      console.warn('Failed to hydrate review progress from cloud:', err);
      return 0;
    }
  }

  /**
   * Lightweight reconciliation when app resumes, receives focus, or reconnects.
   * Throttled to at most once per 30 seconds unless force=true.
   */
  public async reconcileWithCloud(uid?: string, force: boolean = false): Promise<boolean> {
    const targetUid = uid || this.currentAuthUid;
    if (!targetUid || this.isReconciling) return false;

    const now = Date.now();
    if (!force && now - this.lastReconcileTime < 30000) {
      return false; // Throttled
    }

    this.isReconciling = true;
    try {
      // First flush any local pending changes so cloud gets them
      await this.flushCloudSync();
      // Then rehydrate updated records from cloud
      const updatedCount = await this.hydrateUserProgressFromCloud(targetUid);
      this.lastReconcileTime = Date.now();

      if (updatedCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vocabclash:review-states-synced', {
          detail: { updatedCount, stats: this.getStats() }
        }));
      }
      return updatedCount > 0;
    } finally {
      this.isReconciling = false;
    }
  }
}

export const questionReviewScheduler = new QuestionReviewScheduler();

