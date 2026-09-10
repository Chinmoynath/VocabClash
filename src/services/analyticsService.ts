/**
 * Google Analytics 4 (GA4) Central Tracking Service for VocabClash SPA
 * 
 * Measurement ID: G-GRSQYTY5W1
 * 
 * Guiding Principles:
 * 1. Safe & Resilient: Analytics failures NEVER throw or break the application.
 * 2. Clean & Non-invasive: No sensitive user data (PII, UID, email, full question text, codes) is ever sent.
 * 3. Strictly De-duplicated: No duplicate page views or spam events on re-renders, route hydration, or component mounts.
 * 4. Development-safe Debugging: Sends `debug_mode: true` when debugging so events stream into GA4 DebugView.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-GRSQYTY5W1';

export type PracticeType = 'pyq_drill' | 'ssc_top100' | 'daily_sprint' | '1v1';
export type CategoryType = 'synonyms' | 'antonyms' | 'ows' | 'idioms' | 'mixed';
export type ExamFamilyType = 'all' | 'ssc' | 'banking' | 'defence';

/**
 * Checks if debug mode is active for GA4 DebugView.
 * Active on development preview domains, localhost, or when explicitly requested via URL param or localStorage.
 */
export function isAnalyticsDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const search = window.location.search;
    const hostname = window.location.hostname;
    return (
      search.includes('debug_mode=true') ||
      search.includes('analytics_debug=1') ||
      search.includes('ga_debug=true') ||
      localStorage.getItem('vocabclash_analytics_debug') === 'true' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('run.app')
    );
  } catch {
    return false;
  }
}

/**
 * Strips PII, authentication credentials, and excessive question text from event params.
 */
const SENSITIVE_KEY_PATTERNS = [
  'email',
  'useremail',
  'user_email',
  'phone',
  'fullname',
  'name',
  'displayname',
  'uid',
  'userid',
  'user_id',
  'firebaseuid',
  'roomcode',
  'room_code',
  'friendcode',
  'friend_code',
  'code',
  'password',
  'token',
  'question_text',
  'questiontext',
  'question_content',
  'search_query',
  'searchtext',
];

function sanitizeParams(params?: Record<string, any>): Record<string, any> {
  if (!params) return {};
  const cleaned: Record<string, any> = {};

  for (const [key, val] of Object.entries(params)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(p => normalizedKey.includes(p.replace(/[-_]/g, '')));

    if (isSensitive) {
      continue;
    }

    if (typeof val === 'string') {
      // Guard against accidental emails
      if (val.includes('@') && val.includes('.')) {
        continue;
      }
      cleaned[key] = val.slice(0, 100); // Cap string length
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      cleaned[key] = val;
    }
  }

  return cleaned;
}

/**
 * Generic safe event dispatcher
 */
export function trackEvent(eventName: string, params?: Record<string, any>): void {
  try {
    if (typeof window === 'undefined') return;

    const safeParams = sanitizeParams(params);
    const isDebug = isAnalyticsDebugMode();

    if (isDebug) {
      safeParams.debug_mode = true;
      console.log(
        `%c[GA4 Event] %c${eventName}`,
        'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #0284c7; font-weight: bold;',
        safeParams
      );
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, safeParams);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...safeParams,
      });
    }
  } catch (err) {
    // Analytics failure must never break user experience
    console.warn('[Analytics] trackEvent suppressed error:', err);
  }
}

/**
 * Tracks virtual SPA page_view without sending duplicate events for the same path.
 */
let lastTrackedPath: string | null = null;

export function trackPageView(pagePath: string, pageTitle: string, pageLocation?: string): void {
  try {
    if (typeof window === 'undefined') return;

    const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;

    // Prevent duplicate page_view events for the same route
    if (lastTrackedPath === normalizedPath) {
      return;
    }
    lastTrackedPath = normalizedPath;

    const location = pageLocation || (window.location.origin + normalizedPath);
    const isDebug = isAnalyticsDebugMode();

    const payload: Record<string, any> = {
      page_path: normalizedPath,
      page_title: pageTitle,
      page_location: location,
    };

    if (isDebug) {
      payload.debug_mode = true;
      console.log(
        `%c[GA4 PageView] %c${normalizedPath} (${pageTitle})`,
        'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #059669; font-weight: bold;',
        payload
      );
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', payload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: 'page_view',
        ...payload,
      });
    }
  } catch (err) {
    console.warn('[Analytics] trackPageView suppressed error:', err);
  }
}

/**
 * Normalizes question category to GA4 standard parameters:
 * "synonyms" | "antonyms" | "ows" | "idioms" | "mixed"
 */
export function normalizeAnalyticsCategory(cat?: string | null): CategoryType {
  if (!cat) return 'mixed';
  const c = cat.toLowerCase();
  if (c.includes('syn')) return 'synonyms';
  if (c.includes('ant')) return 'antonyms';
  if (c.includes('ows') || c.includes('one_word') || c.includes('oneword') || c.includes('substitution')) return 'ows';
  if (c.includes('idiom') || c.includes('phrase')) return 'idioms';
  return 'mixed';
}

/**
 * Normalizes exam type to GA4 exam family:
 * "all" | "ssc" | "banking" | "defence"
 */
export function normalizeAnalyticsExamFamily(exam?: string | null): ExamFamilyType {
  if (!exam) return 'ssc';
  const e = exam.toLowerCase();
  if (e === 'all' || e === 'mixed') return 'all';
  if (e.includes('bank') || e.includes('ibps') || e.includes('sbi') || e.includes('rbi')) return 'banking';
  if (e.includes('def') || e.includes('nda') || e.includes('cds') || e.includes('afcat')) return 'defence';
  return 'ssc';
}

// ----------------------------------------------------
// Specialized Core Event Trackers
// ----------------------------------------------------

/**
 * A. practice_start
 * Fired when a user genuinely starts a practice session.
 */
export function trackPracticeStart(params: {
  practice_type: PracticeType;
  category: CategoryType;
  exam_family: ExamFamilyType;
}): void {
  trackEvent('practice_start', {
    practice_type: params.practice_type,
    category: params.category,
    exam_family: params.exam_family,
  });
}

/**
 * B. question_answered
 * Fired when a user submits an answer.
 */
export function trackQuestionAnswered(params: {
  practice_type: PracticeType;
  category: CategoryType;
  exam_family: ExamFamilyType;
  correct: boolean;
}): void {
  trackEvent('question_answered', {
    practice_type: params.practice_type,
    category: params.category,
    exam_family: params.exam_family,
    correct: Boolean(params.correct),
  });
}

/**
 * C. practice_complete
 * Fired when the user completes a meaningful session.
 */
export function trackPracticeComplete(params: {
  practice_type: PracticeType;
  questions_answered: number;
  correct_count: number;
  accuracy: number;
}): void {
  trackEvent('practice_complete', {
    practice_type: params.practice_type,
    questions_answered: Math.max(0, Math.round(params.questions_answered)),
    correct_count: Math.max(0, Math.round(params.correct_count)),
    accuracy: Math.min(100, Math.max(0, Math.round(params.accuracy))),
  });
}

/**
 * D. signup
 * Fired only after account creation successfully completes.
 */
export function trackSignup(method: 'google' | 'email'): void {
  trackEvent('signup', {
    method,
  });
}

/**
 * E. daily_goal_complete
 * Fired ONCE when user crosses the daily target (e.g. 29 -> 30).
 * Immune to refreshes or subsequent questions (31/30, 32/30).
 */
const DAILY_GOAL_KEY_PREFIX = 'vocabclash_ga4_daily_goal_';

export function checkAndTrackDailyGoalComplete(targetQuestions: number): void {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${DAILY_GOAL_KEY_PREFIX}${today}`;

    if (localStorage.getItem(storageKey)) {
      return; // Already recorded today
    }

    localStorage.setItem(storageKey, 'true');
    trackEvent('daily_goal_complete', {
      target_questions: targetQuestions,
    });
  } catch (err) {
    console.warn('[Analytics] checkAndTrackDailyGoalComplete error:', err);
  }
}

/**
 * F. top100_start
 * Fired when user starts or resumes one of the SSC Top 100 drills.
 */
export function trackTop100Start(category: string, resumeIndex: number): void {
  trackEvent('top100_start', {
    category: normalizeAnalyticsCategory(category),
    resume_index: Math.max(0, Math.round(resumeIndex)),
  });
}

/**
 * G. top100_complete
 * Fired once after completing 100/100 of an SSC Top 100 module.
 */
export function trackTop100Complete(category: string, correctCount: number, accuracy: number): void {
  trackEvent('top100_complete', {
    category: normalizeAnalyticsCategory(category),
    correct_count: Math.max(0, Math.round(correctCount)),
    accuracy: Math.min(100, Math.max(0, Math.round(accuracy))),
  });
}

/**
 * 4. question_10_completed
 * Fired once per user per day when someone reaches 10 legitimate answered questions.
 */
const Q10_KEY_PREFIX = 'vocabclash_ga4_q10_';

export function checkAndTrackQuestion10(totalQuestionsSolvedToday: number): void {
  if (typeof window === 'undefined') return;
  if (totalQuestionsSolvedToday < 10) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${Q10_KEY_PREFIX}${today}`;

    if (localStorage.getItem(storageKey)) {
      return; // Already fired today
    }

    localStorage.setItem(storageKey, 'true');
    trackEvent('question_10_completed');
  } catch (err) {
    console.warn('[Analytics] checkAndTrackQuestion10 error:', err);
  }
}

/**
 * 5. article_view
 * Fired when a user views an individual educational article
 */
export function trackArticleView(articleSlug: string, articleCategory: string): void {
  trackEvent('article_view', {
    article_slug: articleSlug,
    article_category: articleCategory,
  });
}

/**
 * 6. related_practice_click
 * Fired when a reader clicks the related practice CTA in an article
 */
export function trackRelatedPracticeClick(articleSlug: string, practiceType: string, practiceRoute?: string): void {
  trackEvent('related_practice_click', {
    article_slug: articleSlug,
    practice_type: practiceType,
    practice_route: practiceRoute || ''
  });
}

/**
 * Guest-to-Sign-In Conversion Funnel Events
 */
export function trackGuestPyq10Completed(params?: { correctCount?: number; mistakeCount?: number; accuracy?: number }): void {
  trackEvent('guest_pyq_10_completed', params);
}

export function trackGuestPyqSignupPromptView(): void {
  trackEvent('guest_pyq_signup_prompt_view');
}

export function trackGuestPyqSignupPromptClose(): void {
  trackEvent('guest_pyq_signup_prompt_close');
}

export function trackGuestPyqSignupClick(): void {
  trackEvent('guest_pyq_signup_click');
}

export function trackGuestBattleComplete(params?: { score?: number; accuracy?: number; result?: string }): void {
  trackEvent('guest_battle_complete', params);
}

export function trackGuestReviewClick(params?: { mistakesCount?: number }): void {
  trackEvent('guest_review_click', params);
}

export function trackGuestReviewSignupPromptView(): void {
  trackEvent('guest_review_signup_prompt_view');
}

export function trackGuestReviewSignupPromptClose(): void {
  trackEvent('guest_review_signup_prompt_close');
}

export function trackGuestReviewSignupClick(): void {
  trackEvent('guest_review_signup_click');
}

export function trackGuestSignupComplete(source?: 'pyq' | 'battle_review'): void {
  trackEvent('guest_signup_complete', { source: source || 'unknown' });
}

/**
 * Push Notification Events
 */
export function trackNotificationPromptView(): void {
  trackEvent('notification_prompt_view');
}

export function trackNotificationPromptDismiss(): void {
  trackEvent('notification_prompt_dismiss');
}

export function trackNotificationPermissionGranted(source: string = 'prompt'): void {
  trackEvent('notification_permission_granted', { source });
}

export function trackNotificationPermissionDenied(source: string = 'prompt'): void {
  trackEvent('notification_permission_denied', { source });
}

export function trackNotificationOpen(notificationType: string = 'general', route: string = ''): void {
  trackEvent('notification_open', {
    notification_type: notificationType,
    target_route: route,
  });
}



