import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { db, isFirestoreQuotaExhausted } from './firebaseService';
import { 
  trackBattle1v1Start, 
  trackBattle1v1Complete, 
  trackBattle1v1Abandoned, 
  trackBattle1v1PostMatchSignup 
} from './analyticsService';

export interface BattleAnalyticsSummary {
  totalMatchesStarted: number;
  totalMatchesCompleted: number;
  totalMatchesAbandoned: number;
  completionRate: number; // Percentage 0 - 100
  abandonmentRate: number; // Percentage 0 - 100
  guestMatchesStarted: number;
  authMatchesStarted: number;
  guestMatchesCompleted: number;
  authMatchesCompleted: number;
  guestMatchesAbandoned: number;
  authMatchesAbandoned: number;
  postMatchSignupPromptsShown: number;
  postMatchSignupsCompleted: number;
  signupConversionRate: number; // Post-match signups / guest matches completed
  abandonReasons: {
    forfeit: number;
    disconnect: number;
    window_close: number;
    opponent_left: number;
    other: number;
  };
  abandonQuestionDropoff: Record<number, number>; // index 0, 1, 2...
  modeBreakdown: {
    '1v1_ranked': { started: number; completed: number; abandoned: number };
    'quick_duel': { started: number; completed: number; abandoned: number };
    'friend_lobby': { started: number; completed: number; abandoned: number };
  };
  opponentTypeBreakdown: {
    real: { started: number; completed: number; abandoned: number };
    bot: { started: number; completed: number; abandoned: number };
  };
  outcomes: {
    wins: number;
    losses: number;
    draws: number;
  };
  avgMatchDurationSec: number;
  totalMatchDurationSec: number;
  avgQuestionsAnswered: number;
  totalQuestionsAnsweredInBattles: number;
  lastUpdated: number;
}

export interface BattleAnalyticsEvent {
  id: string;
  type: 'battle_started' | 'battle_completed' | 'battle_abandoned' | 'signup_prompt_viewed' | 'post_battle_signup';
  matchId: string;
  timestamp: number;
  mode: '1v1_ranked' | 'quick_duel' | 'friend_lobby' | 'daily_challenge' | string;
  isGuest: boolean;
  userId?: string;
  isRealPlayer?: boolean;
  roundCount?: number;
  questionsAnswered?: number;
  abandonReason?: 'forfeit' | 'disconnect' | 'window_close' | 'opponent_left' | 'other';
  dropoffQuestionIndex?: number;
  matchDurationSec?: number;
  outcome?: 'win' | 'loss' | 'draw';
  playerScore?: number;
  opponentScore?: number;
  authProvider?: string;
  timeAfterMatchSec?: number;
}

export interface DailyBattleStat {
  date: string; // YYYY-MM-DD
  started: number;
  completed: number;
  abandoned: number;
  signups: number;
  guestCount: number;
  authCount: number;
}

const LOCAL_STORAGE_SUMMARY_KEY = 'vclash_battle_analytics_summary_v1';
const LOCAL_STORAGE_EVENTS_KEY = 'vclash_battle_analytics_recent_events_v1';
const ACTIVE_BATTLE_SESSION_KEY = 'vclash_active_battle_session';
const LAST_COMPLETED_BATTLE_KEY = 'vclash_last_completed_battle_attribution';

export const INITIAL_BATTLE_SUMMARY: BattleAnalyticsSummary = {
  totalMatchesStarted: 0,
  totalMatchesCompleted: 0,
  totalMatchesAbandoned: 0,
  completionRate: 0,
  abandonmentRate: 0,
  guestMatchesStarted: 0,
  authMatchesStarted: 0,
  guestMatchesCompleted: 0,
  authMatchesCompleted: 0,
  guestMatchesAbandoned: 0,
  authMatchesAbandoned: 0,
  postMatchSignupPromptsShown: 0,
  postMatchSignupsCompleted: 0,
  signupConversionRate: 0,
  abandonReasons: {
    forfeit: 0,
    disconnect: 0,
    window_close: 0,
    opponent_left: 0,
    other: 0,
  },
  abandonQuestionDropoff: {},
  modeBreakdown: {
    '1v1_ranked': { started: 0, completed: 0, abandoned: 0 },
    'quick_duel': { started: 0, completed: 0, abandoned: 0 },
    'friend_lobby': { started: 0, completed: 0, abandoned: 0 },
  },
  opponentTypeBreakdown: {
    real: { started: 0, completed: 0, abandoned: 0 },
    bot: { started: 0, completed: 0, abandoned: 0 },
  },
  outcomes: {
    wins: 0,
    losses: 0,
    draws: 0,
  },
  avgMatchDurationSec: 0,
  totalMatchDurationSec: 0,
  avgQuestionsAnswered: 0,
  totalQuestionsAnsweredInBattles: 0,
  lastUpdated: Date.now(),
};

/**
 * Normalizes computed rates and ratios safely
 */
function computeDerivedRates(summary: Partial<BattleAnalyticsSummary>): BattleAnalyticsSummary {
  const started = Math.max(0, Number(summary.totalMatchesStarted || 0));
  const completed = Math.max(0, Number(summary.totalMatchesCompleted || 0));
  const abandoned = Math.max(0, Number(summary.totalMatchesAbandoned || 0));
  const guestCompleted = Math.max(0, Number(summary.guestMatchesCompleted || 0));
  const signups = Math.max(0, Number(summary.postMatchSignupsCompleted || 0));
  const prompts = Math.max(0, Number(summary.postMatchSignupPromptsShown || 0));

  const completionRate = started > 0 ? Math.round((completed / started) * 1000) / 10 : 0;
  const abandonmentRate = started > 0 ? Math.round((abandoned / started) * 1000) / 10 : 0;
  
  // Base conversion either on prompts shown or guest completed matches
  const denom = prompts > 0 ? prompts : guestCompleted;
  const signupConversionRate = denom > 0 ? Math.round((signups / denom) * 1000) / 10 : 0;

  const totalDuration = Math.max(0, Number(summary.totalMatchDurationSec || 0));
  const avgDuration = completed > 0 ? Math.round(totalDuration / completed) : 0;

  const totalQs = Math.max(0, Number(summary.totalQuestionsAnsweredInBattles || 0));
  const avgQs = (completed + abandoned) > 0 ? Math.round((totalQs / (completed + abandoned)) * 10) / 10 : 0;

  return {
    ...INITIAL_BATTLE_SUMMARY,
    ...summary,
    totalMatchesStarted: started,
    totalMatchesCompleted: completed,
    totalMatchesAbandoned: abandoned,
    completionRate,
    abandonmentRate,
    signupConversionRate,
    avgMatchDurationSec: avgDuration,
    avgQuestionsAnswered: avgQs,
    lastUpdated: Date.now(),
  } as BattleAnalyticsSummary;
}

/**
 * Loads cached analytics summary from localStorage
 */
function getLocalSummary(): BattleAnalyticsSummary {
  if (typeof window === 'undefined') return INITIAL_BATTLE_SUMMARY;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUMMARY_KEY);
    if (!raw) return INITIAL_BATTLE_SUMMARY;
    return computeDerivedRates(JSON.parse(raw));
  } catch {
    return INITIAL_BATTLE_SUMMARY;
  }
}

/**
 * Saves summary to localStorage
 */
function saveLocalSummary(summary: BattleAnalyticsSummary): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SUMMARY_KEY, JSON.stringify(summary));
  } catch {}
}

/**
 * Loads recent events from localStorage
 */
export function getLocalRecentEvents(): BattleAnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Adds an event to local buffer
 */
function recordLocalEvent(event: BattleAnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const events = getLocalRecentEvents();
    events.unshift(event);
    if (events.length > 50) {
      events.length = 50;
    }
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch {}
}

/**
 * Today's date key in YYYY-MM-DD
 */
function getTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface BattleStartParams {
  matchId: string;
  mode: '1v1_ranked' | 'quick_duel' | 'friend_lobby' | 'daily_challenge' | string;
  isGuest: boolean;
  isRealPlayer: boolean;
  roundCount: number;
  userId?: string;
  category?: string;
  exam?: string;
}

/**
 * 1. Record 1v1 Battle Start
 */
export async function recordBattleStarted(params: BattleStartParams): Promise<void> {
  const startTime = Date.now();
  const modeKey = (params.mode in INITIAL_BATTLE_SUMMARY.modeBreakdown) ? params.mode : '1v1_ranked';
  const oppTypeKey = params.isRealPlayer ? 'real' : 'bot';

  // Save active battle session in sessionStorage & memory for sudden leave/unload detection
  try {
    const sessionData = {
      matchId: params.matchId,
      mode: params.mode,
      isGuest: params.isGuest,
      isRealPlayer: params.isRealPlayer,
      roundCount: params.roundCount,
      startTime,
      currentQuestionIndex: 0,
      questionsAnswered: 0,
      userId: params.userId,
    };
    sessionStorage.setItem(ACTIVE_BATTLE_SESSION_KEY, JSON.stringify(sessionData));
  } catch {}

  // Update local summary
  const current = getLocalSummary();
  current.totalMatchesStarted += 1;
  if (params.isGuest) {
    current.guestMatchesStarted += 1;
  } else {
    current.authMatchesStarted += 1;
  }
  current.modeBreakdown[modeKey].started += 1;
  current.opponentTypeBreakdown[oppTypeKey].started += 1;
  const updatedLocal = computeDerivedRates(current);
  saveLocalSummary(updatedLocal);

  // Record event
  const event: BattleAnalyticsEvent = {
    id: `ev-start-${params.matchId}-${startTime}`,
    type: 'battle_started',
    matchId: params.matchId,
    timestamp: startTime,
    mode: params.mode,
    isGuest: params.isGuest,
    userId: params.userId,
    isRealPlayer: params.isRealPlayer,
    roundCount: params.roundCount,
  };
  recordLocalEvent(event);

  // Send GA4 telemetry
  trackBattle1v1Start({
    mode: params.mode,
    is_guest: params.isGuest,
    is_real_opponent: params.isRealPlayer,
    round_count: params.roundCount,
    category: params.category,
    exam: params.exam,
  });

  // Sync to Firestore if quota not exhausted
  if (!isFirestoreQuotaExhausted()) {
    try {
      const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
      const dailyDocRef = doc(db, 'battle_analytics', `daily_${getTodayDateKey()}`);
      
      const payload: any = {
        totalMatchesStarted: increment(1),
        [params.isGuest ? 'guestMatchesStarted' : 'authMatchesStarted']: increment(1),
        [`modeBreakdown.${modeKey}.started`]: increment(1),
        [`opponentTypeBreakdown.${oppTypeKey}.started`]: increment(1),
        lastUpdated: startTime,
      };

      setDoc(summaryDocRef, payload, { merge: true }).catch(() => {});
      setDoc(dailyDocRef, {
        date: getTodayDateKey(),
        started: increment(1),
        [params.isGuest ? 'guestCount' : 'authCount']: increment(1),
        lastUpdated: startTime,
      }, { merge: true }).catch(() => {});

      // Record event log (best effort)
      const eventDocRef = doc(db, 'battle_analytics_events', event.id);
      setDoc(eventDocRef, event).catch(() => {});
    } catch {}
  }
}

export interface BattleCompleteParams {
  matchId: string;
  mode: '1v1_ranked' | 'quick_duel' | 'friend_lobby' | 'daily_challenge' | string;
  isGuest: boolean;
  isRealPlayer: boolean;
  roundCount: number;
  questionsAnswered: number;
  durationSec: number;
  outcome: 'win' | 'loss' | 'draw';
  playerScore: number;
  opponentScore: number;
  userId?: string;
}

/**
 * 2. Record 1v1 Battle Completed
 */
export async function recordBattleCompleted(params: BattleCompleteParams): Promise<void> {
  const completeTime = Date.now();
  const modeKey = (params.mode in INITIAL_BATTLE_SUMMARY.modeBreakdown) ? params.mode : '1v1_ranked';
  const oppTypeKey = params.isRealPlayer ? 'real' : 'bot';

  // Clear active in-progress battle session from sessionStorage
  try {
    sessionStorage.removeItem(ACTIVE_BATTLE_SESSION_KEY);
    // Set post-match attribution record for 15-minute signup conversion tracking
    const attributionData = {
      matchId: params.matchId,
      mode: params.mode,
      isGuest: params.isGuest,
      completedAt: completeTime,
      outcome: params.outcome,
    };
    sessionStorage.setItem(LAST_COMPLETED_BATTLE_KEY, JSON.stringify(attributionData));
    localStorage.setItem(LAST_COMPLETED_BATTLE_KEY, JSON.stringify(attributionData));
  } catch {}

  // Update local summary
  const current = getLocalSummary();
  current.totalMatchesCompleted += 1;
  if (params.isGuest) {
    current.guestMatchesCompleted += 1;
  } else {
    current.authMatchesCompleted += 1;
  }
  current.modeBreakdown[modeKey].completed += 1;
  current.opponentTypeBreakdown[oppTypeKey].completed += 1;
  
  if (params.outcome === 'win') current.outcomes.wins += 1;
  else if (params.outcome === 'loss') current.outcomes.losses += 1;
  else current.outcomes.draws += 1;

  current.totalMatchDurationSec += Math.max(0, params.durationSec);
  current.totalQuestionsAnsweredInBattles += Math.max(0, params.questionsAnswered);

  const updatedLocal = computeDerivedRates(current);
  saveLocalSummary(updatedLocal);

  // Record event
  const event: BattleAnalyticsEvent = {
    id: `ev-comp-${params.matchId}-${completeTime}`,
    type: 'battle_completed',
    matchId: params.matchId,
    timestamp: completeTime,
    mode: params.mode,
    isGuest: params.isGuest,
    userId: params.userId,
    isRealPlayer: params.isRealPlayer,
    roundCount: params.roundCount,
    questionsAnswered: params.questionsAnswered,
    matchDurationSec: params.durationSec,
    outcome: params.outcome,
    playerScore: params.playerScore,
    opponentScore: params.opponentScore,
  };
  recordLocalEvent(event);

  // Send GA4 telemetry
  trackBattle1v1Complete({
    mode: params.mode,
    is_guest: params.isGuest,
    outcome: params.outcome,
    questions_answered: params.questionsAnswered,
    duration_sec: params.durationSec,
    player_score: params.playerScore,
    opponent_score: params.opponentScore,
  });

  // Sync to Firestore
  if (!isFirestoreQuotaExhausted()) {
    try {
      const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
      const dailyDocRef = doc(db, 'battle_analytics', `daily_${getTodayDateKey()}`);

      const payload: any = {
        totalMatchesCompleted: increment(1),
        [params.isGuest ? 'guestMatchesCompleted' : 'authMatchesCompleted']: increment(1),
        [`modeBreakdown.${modeKey}.completed`]: increment(1),
        [`opponentTypeBreakdown.${oppTypeKey}.completed`]: increment(1),
        [`outcomes.${params.outcome === 'win' ? 'wins' : params.outcome === 'loss' ? 'losses' : 'draws'}`]: increment(1),
        totalMatchDurationSec: increment(Math.max(0, params.durationSec)),
        totalQuestionsAnsweredInBattles: increment(Math.max(0, params.questionsAnswered)),
        lastUpdated: completeTime,
      };

      setDoc(summaryDocRef, payload, { merge: true }).catch(() => {});
      setDoc(dailyDocRef, {
        date: getTodayDateKey(),
        completed: increment(1),
        lastUpdated: completeTime,
      }, { merge: true }).catch(() => {});

      const eventDocRef = doc(db, 'battle_analytics_events', event.id);
      setDoc(eventDocRef, event).catch(() => {});
    } catch {}
  }
}

export interface BattleAbandonParams {
  matchId: string;
  mode: '1v1_ranked' | 'quick_duel' | 'friend_lobby' | 'daily_challenge' | string;
  isGuest: boolean;
  isRealPlayer: boolean;
  roundCount: number;
  currentQuestionIndex: number;
  questionsAnswered: number;
  reason: 'forfeit' | 'disconnect' | 'window_close' | 'opponent_left' | 'other';
  userId?: string;
}

/**
 * 3. Record 1v1 Battle Abandoned / Ended in Between
 */
export async function recordBattleAbandoned(params: BattleAbandonParams): Promise<void> {
  const abandonTime = Date.now();
  const modeKey = (params.mode in INITIAL_BATTLE_SUMMARY.modeBreakdown) ? params.mode : '1v1_ranked';
  const oppTypeKey = params.isRealPlayer ? 'real' : 'bot';
  const reasonKey = params.reason in INITIAL_BATTLE_SUMMARY.abandonReasons ? params.reason : 'other';

  // Clear active battle session
  try {
    sessionStorage.removeItem(ACTIVE_BATTLE_SESSION_KEY);
  } catch {}

  // Update local summary
  const current = getLocalSummary();
  current.totalMatchesAbandoned += 1;
  if (params.isGuest) {
    current.guestMatchesAbandoned += 1;
  } else {
    current.authMatchesAbandoned += 1;
  }
  current.modeBreakdown[modeKey].abandoned += 1;
  current.opponentTypeBreakdown[oppTypeKey].abandoned += 1;
  current.abandonReasons[reasonKey] = (current.abandonReasons[reasonKey] || 0) + 1;
  
  const qIdx = Math.max(0, params.currentQuestionIndex);
  current.abandonQuestionDropoff[qIdx] = (current.abandonQuestionDropoff[qIdx] || 0) + 1;
  current.totalQuestionsAnsweredInBattles += Math.max(0, params.questionsAnswered);

  const updatedLocal = computeDerivedRates(current);
  saveLocalSummary(updatedLocal);

  // Record event
  const event: BattleAnalyticsEvent = {
    id: `ev-abn-${params.matchId}-${abandonTime}`,
    type: 'battle_abandoned',
    matchId: params.matchId,
    timestamp: abandonTime,
    mode: params.mode,
    isGuest: params.isGuest,
    userId: params.userId,
    isRealPlayer: params.isRealPlayer,
    roundCount: params.roundCount,
    questionsAnswered: params.questionsAnswered,
    abandonReason: params.reason,
    dropoffQuestionIndex: qIdx,
  };
  recordLocalEvent(event);

  // Send GA4 telemetry
  trackBattle1v1Abandoned({
    mode: params.mode,
    is_guest: params.isGuest,
    reason: params.reason,
    dropoff_question_index: qIdx,
    questions_answered: params.questionsAnswered,
  });

  // Sync to Firestore
  if (!isFirestoreQuotaExhausted()) {
    try {
      const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
      const dailyDocRef = doc(db, 'battle_analytics', `daily_${getTodayDateKey()}`);

      const payload: any = {
        totalMatchesAbandoned: increment(1),
        [params.isGuest ? 'guestMatchesAbandoned' : 'authMatchesAbandoned']: increment(1),
        [`modeBreakdown.${modeKey}.abandoned`]: increment(1),
        [`opponentTypeBreakdown.${oppTypeKey}.abandoned`]: increment(1),
        [`abandonReasons.${reasonKey}`]: increment(1),
        [`abandonQuestionDropoff.${qIdx}`]: increment(1),
        totalQuestionsAnsweredInBattles: increment(Math.max(0, params.questionsAnswered)),
        lastUpdated: abandonTime,
      };

      setDoc(summaryDocRef, payload, { merge: true }).catch(() => {});
      setDoc(dailyDocRef, {
        date: getTodayDateKey(),
        abandoned: increment(1),
        lastUpdated: abandonTime,
      }, { merge: true }).catch(() => {});

      const eventDocRef = doc(db, 'battle_analytics_events', event.id);
      setDoc(eventDocRef, event).catch(() => {});
    } catch {}
  }
}

/**
 * 4. Record Post-Match Signup Prompt View
 */
export async function recordBattleSignupPromptView(matchId?: string, source: string = 'battle_summary'): Promise<void> {
  const viewTime = Date.now();
  const current = getLocalSummary();
  current.postMatchSignupPromptsShown += 1;
  const updatedLocal = computeDerivedRates(current);
  saveLocalSummary(updatedLocal);

  const event: BattleAnalyticsEvent = {
    id: `ev-prompt-${matchId || 'anon'}-${viewTime}`,
    type: 'signup_prompt_viewed',
    matchId: matchId || 'unknown',
    timestamp: viewTime,
    mode: '1v1_ranked',
    isGuest: true,
  };
  recordLocalEvent(event);

  if (!isFirestoreQuotaExhausted()) {
    try {
      const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
      setDoc(summaryDocRef, {
        postMatchSignupPromptsShown: increment(1),
        lastUpdated: viewTime,
      }, { merge: true }).catch(() => {});
    } catch {}
  }
}

/**
 * 5. Record Post-1v1 Signup Completed
 * Checks if the user just played a 1v1 battle in the last 15 minutes and attributes the conversion!
 */
export async function recordBattleSignupCompleted(
  userId: string, 
  authProvider: string = 'google'
): Promise<{ attributedTo1v1: boolean; matchId?: string }> {
  const signupTime = Date.now();
  let attribution: any = null;

  try {
    const raw = sessionStorage.getItem(LAST_COMPLETED_BATTLE_KEY) || localStorage.getItem(LAST_COMPLETED_BATTLE_KEY);
    if (raw) {
      attribution = JSON.parse(raw);
    }
  } catch {}

  // Check 15-minute attribution window (900,000 ms)
  const isWithinAttributionWindow = attribution && (signupTime - attribution.completedAt) <= (15 * 60 * 1000);

  if (isWithinAttributionWindow && attribution?.isGuest) {
    const timeDeltaSec = Math.round((signupTime - attribution.completedAt) / 1000);
    
    // Clear attribution so one match isn't double-counted
    try {
      sessionStorage.removeItem(LAST_COMPLETED_BATTLE_KEY);
      localStorage.removeItem(LAST_COMPLETED_BATTLE_KEY);
    } catch {}

    // Update local summary
    const current = getLocalSummary();
    current.postMatchSignupsCompleted += 1;
    const updatedLocal = computeDerivedRates(current);
    saveLocalSummary(updatedLocal);

    // Record event
    const event: BattleAnalyticsEvent = {
      id: `ev-signup-${userId}-${signupTime}`,
      type: 'post_battle_signup',
      matchId: attribution.matchId || 'unknown',
      timestamp: signupTime,
      mode: attribution.mode || '1v1_ranked',
      isGuest: false,
      userId,
      authProvider,
      timeAfterMatchSec: timeDeltaSec,
    };
    recordLocalEvent(event);

    // Send GA4 telemetry
    trackBattle1v1PostMatchSignup({
      time_after_match_sec: timeDeltaSec,
      auth_provider: authProvider,
      match_id: attribution.matchId,
    });

    // Sync to Firestore
    if (!isFirestoreQuotaExhausted()) {
      try {
        const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
        const dailyDocRef = doc(db, 'battle_analytics', `daily_${getTodayDateKey()}`);

        setDoc(summaryDocRef, {
          postMatchSignupsCompleted: increment(1),
          lastUpdated: signupTime,
        }, { merge: true }).catch(() => {});

        setDoc(dailyDocRef, {
          date: getTodayDateKey(),
          signups: increment(1),
          lastUpdated: signupTime,
        }, { merge: true }).catch(() => {});

        const eventDocRef = doc(db, 'battle_analytics_events', event.id);
        setDoc(eventDocRef, event).catch(() => {});
      } catch {}
    }

    return { attributedTo1v1: true, matchId: attribution.matchId };
  }

  return { attributedTo1v1: false };
}

/**
 * 6. Get Global Battle Analytics Summary (combining Firestore + local caches)
 */
export async function getBattleAnalyticsSummary(): Promise<BattleAnalyticsSummary> {
  const local = getLocalSummary();

  if (isFirestoreQuotaExhausted()) {
    return local;
  }

  try {
    const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
    const snap = await getDoc(summaryDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const combined = computeDerivedRates({
        ...local,
        ...data,
        // Take maximums of counters between local buffer and cloud doc
        totalMatchesStarted: Math.max(local.totalMatchesStarted, data.totalMatchesStarted || 0),
        totalMatchesCompleted: Math.max(local.totalMatchesCompleted, data.totalMatchesCompleted || 0),
        totalMatchesAbandoned: Math.max(local.totalMatchesAbandoned, data.totalMatchesAbandoned || 0),
        guestMatchesStarted: Math.max(local.guestMatchesStarted, data.guestMatchesStarted || 0),
        authMatchesStarted: Math.max(local.authMatchesStarted, data.authMatchesStarted || 0),
        guestMatchesCompleted: Math.max(local.guestMatchesCompleted, data.guestMatchesCompleted || 0),
        authMatchesCompleted: Math.max(local.authMatchesCompleted, data.authMatchesCompleted || 0),
        guestMatchesAbandoned: Math.max(local.guestMatchesAbandoned, data.guestMatchesAbandoned || 0),
        authMatchesAbandoned: Math.max(local.authMatchesAbandoned, data.authMatchesAbandoned || 0),
        postMatchSignupPromptsShown: Math.max(local.postMatchSignupPromptsShown, data.postMatchSignupPromptsShown || 0),
        postMatchSignupsCompleted: Math.max(local.postMatchSignupsCompleted, data.postMatchSignupsCompleted || 0),
        totalMatchDurationSec: Math.max(local.totalMatchDurationSec, data.totalMatchDurationSec || 0),
        totalQuestionsAnsweredInBattles: Math.max(local.totalQuestionsAnsweredInBattles, data.totalQuestionsAnsweredInBattles || 0),
        abandonReasons: {
          forfeit: Math.max(local.abandonReasons.forfeit, data.abandonReasons?.forfeit || 0),
          disconnect: Math.max(local.abandonReasons.disconnect, data.abandonReasons?.disconnect || 0),
          window_close: Math.max(local.abandonReasons.window_close, data.abandonReasons?.window_close || 0),
          opponent_left: Math.max(local.abandonReasons.opponent_left, data.abandonReasons?.opponent_left || 0),
          other: Math.max(local.abandonReasons.other, data.abandonReasons?.other || 0),
        },
        modeBreakdown: {
          '1v1_ranked': {
            started: Math.max(local.modeBreakdown['1v1_ranked'].started, data.modeBreakdown?.['1v1_ranked']?.started || 0),
            completed: Math.max(local.modeBreakdown['1v1_ranked'].completed, data.modeBreakdown?.['1v1_ranked']?.completed || 0),
            abandoned: Math.max(local.modeBreakdown['1v1_ranked'].abandoned, data.modeBreakdown?.['1v1_ranked']?.abandoned || 0),
          },
          'quick_duel': {
            started: Math.max(local.modeBreakdown['quick_duel'].started, data.modeBreakdown?.['quick_duel']?.started || 0),
            completed: Math.max(local.modeBreakdown['quick_duel'].completed, data.modeBreakdown?.['quick_duel']?.completed || 0),
            abandoned: Math.max(local.modeBreakdown['quick_duel'].abandoned, data.modeBreakdown?.['quick_duel']?.abandoned || 0),
          },
          'friend_lobby': {
            started: Math.max(local.modeBreakdown['friend_lobby'].started, data.modeBreakdown?.['friend_lobby']?.started || 0),
            completed: Math.max(local.modeBreakdown['friend_lobby'].completed, data.modeBreakdown?.['friend_lobby']?.completed || 0),
            abandoned: Math.max(local.modeBreakdown['friend_lobby'].abandoned, data.modeBreakdown?.['friend_lobby']?.abandoned || 0),
          },
        },
        outcomes: {
          wins: Math.max(local.outcomes.wins, data.outcomes?.wins || 0),
          losses: Math.max(local.outcomes.losses, data.outcomes?.losses || 0),
          draws: Math.max(local.outcomes.draws, data.outcomes?.draws || 0),
        },
      });
      saveLocalSummary(combined);
      return combined;
    }
  } catch (err) {
    console.info('Using local battle analytics summary');
  }

  return local;
}

/**
 * 7. Real-time Subscription to Battle Analytics
 */
export function subscribeToBattleAnalytics(callback: (summary: BattleAnalyticsSummary) => void): () => void {
  // Fire immediately with local cache
  callback(getLocalSummary());

  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }

  try {
    const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
    const unsubscribe = onSnapshot(
      summaryDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const merged = computeDerivedRates(data);
          saveLocalSummary(merged);
          callback(merged);
        }
      },
      () => {
        // Silent on subscription error
      }
    );
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * 8. Get Recent Events (Firestore + Local fallback)
 */
export async function getRecentBattleEvents(count: number = 20): Promise<BattleAnalyticsEvent[]> {
  const localEvents = getLocalRecentEvents();

  if (isFirestoreQuotaExhausted()) {
    return localEvents.slice(0, count);
  }

  try {
    const eventsCol = collection(db, 'battle_analytics_events');
    const q = query(eventsCol, orderBy('timestamp', 'desc'), limit(count));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const serverEvents: BattleAnalyticsEvent[] = [];
      snap.forEach(docSnap => {
        serverEvents.push(docSnap.data() as BattleAnalyticsEvent);
      });
      // Merge unique by id
      const map = new Map<string, BattleAnalyticsEvent>();
      [...serverEvents, ...localEvents].forEach(ev => {
        if (!map.has(ev.id)) map.set(ev.id, ev);
      });
      return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, count);
    }
  } catch {}

  return localEvents.slice(0, count);
}

/**
 * 9. Reset Battle Analytics (Admin only helper)
 */
export async function resetBattleAnalytics(): Promise<void> {
  saveLocalSummary(INITIAL_BATTLE_SUMMARY);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_EVENTS_KEY);
    sessionStorage.removeItem(ACTIVE_BATTLE_SESSION_KEY);
    localStorage.removeItem(LAST_COMPLETED_BATTLE_KEY);
  }

  try {
    const summaryDocRef = doc(db, 'battle_analytics', 'global_summary');
    await setDoc(summaryDocRef, { ...INITIAL_BATTLE_SUMMARY, lastUpdated: Date.now() });
  } catch {}
}
