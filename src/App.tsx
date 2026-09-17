import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlayerProfile, 
  QuestionCategory, 
  ExamType, 
  MatchState, 
  Question, 
  SavedWord,
  PlayerAnswerRecord,
  UserSubscription,
  DailyStreakState
} from './types';
import { 
  getFilteredQuestions, 
  getFirstMatchQuestions,
  getSpeedBlitzSessionQuestions,
  deduplicateAndEnsureCount,
  generateMatchedOpponent, 
  getTierFromLP, 
  getTierTitle 
} from './services/matchmakingService';
import { questionReviewScheduler } from './services/questionReviewScheduler';
import { LiveRoomFinalResult, forfeitLiveRoom } from './services/realtimeMatchmaking';
import { soundManager } from './utils/audio';
import { isAdDue, resetAdTimerForTest, recordAdShown, ADS_ENABLED } from './utils/adManager';
import { matchesExamFamilyFilter } from './utils/examFamilyUtils';
import { extractCleanUserName, formatNameFromEmail, resolvePlayerName } from './utils/nameHelper';
import { 
  getInitialStreak, 
  saveStreakState, 
  evaluateStreakIntegrity,
  recordDailyQuestionSolved,
  calculateStreakFromHistory,
  mergeStreakStates,
  getTodayDateString,
  STORAGE_KEY_STREAK_BONUS_CLAIMED_DATE
} from './utils/streakManager';
import { 
  recordQuestionSolvedForDailyTarget,
  getDailyTargetState,
  saveDailyTargetState,
  resetDailyTargetState
} from './utils/dailyTargetManager';
import { 
  isItemSaved,
  isItemMistake,
  sanitizeVaultList,
  recordMistakeInVault,
  toggleSaveInVault,
  removeVaultItem
} from './utils/vaultManager';
import { 
  auth, 
  saveUserDataToFirestore, 
  saveUserProfileFieldsToFirestore,
  fetchUserDataFromFirestore,
  subscribeToUserCloudData,
  checkRedirectAuthResult,
  getPendingRegistrationDisplayName,
  setPendingRegistrationDisplayName,
  saveDailyChallengeToFirestore,
  deleteDailyChallengeDayFromFirestore
} from './services/firebaseService';
import { 
  mergeDailyChallengeHistory, 
  getDailyChallengeHistory,
  setDailyChallengeHistoryForUser,
  clearDailyChallengeLocalCache,
  sanitizeDailyChallengeHistory,
  getTodayChallengeAttempt
} from './services/dailyChallengeService';
import { syncUserToLeaderboard } from './services/leaderboardService';
import { rankStore } from './services/rankStore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AndroidDeviceShell } from './components/AndroidDeviceShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { DesktopSidebar } from './components/DesktopSidebar';
import { BottomNavBar, TabType } from './components/BottomNavBar';
import { ArenaHome } from './components/ArenaHome';
import { MatchmakingModal } from './components/MatchmakingModal';
import { LiveDuelArena } from './components/LiveDuelArena';
import { MatchSummary } from './components/MatchSummary';
import { MistakeVault } from './components/MistakeVault';
import { PracticeMode, saveStoredActiveDrill } from './components/PracticeMode';
import { calculateMentorAnalytics } from './services/mentorAnalyticsService';
import { buildWeakAreasDrillQuestions } from './services/aiMentorCoachingService';
import { LeaderboardView } from './components/LeaderboardView';
import { AiTutorModal } from './components/AiTutorModal';
import { AiTutorTab } from './components/AiTutorTab';
import { ProfileModal } from './components/ProfileModal';
import { EditProfileModal } from './components/EditProfileModal';
import { SscTop100CompletionModal } from './components/SscTop100CompletionModal';
import { SscTop100Category, getTop100Questions, SSC_TOP_100_META } from './data/sscTop100';
import { recordSscTop100Answer, markSscTop100CategoryCompleted, sscTop100Service } from './services/sscTop100Service';
import { PremiumModal } from './components/PremiumModal';
import { InterstitialAdModal } from './components/InterstitialAdModal';
import { StreakModal } from './components/StreakModal';
import { OnboardingTourModal } from './components/OnboardingTourModal';
import { AppGuideModal } from './components/AppGuideModal';
import { DueRevisionSessionModal } from './components/DueRevisionSessionModal';
import { PlayModeSelectorModal } from './components/PlayModeSelectorModal';
import { FriendLobbyModal } from './components/FriendLobbyModal';
import { AdminPyqImporter } from './components/AdminPyqImporter';
import { UserStatsModal } from './components/UserStatsModal';
import { OfflineWarningModal } from './components/OfflineWarningModal';
import { SeoPublicPage } from './components/SeoPublicPage';
import { SeoGuidesModal } from './components/SeoGuidesModal';
import { SEO_PAGES } from './data/seoContentData';
import { updatePageSeo } from './utils/seoMetaManager';
import { networkManager } from './utils/networkManager';
import { recordQuestionAttempt, resetUserStats, hydrateStatsFromCloud } from './utils/userStatsManager';
import { resetAuthoritativeAttempts } from './services/attemptTrackingService';
import { clearSeenHistory } from './utils/questionHistoryManager';
import { ArticlesDashboard } from './components/admin/ArticlesDashboard';
import { ArticleEditor } from './components/admin/ArticleEditor';
import { PublicArticlesIndex } from './components/public/PublicArticlesIndex';
import { PublicArticleDetail } from './components/public/PublicArticleDetail';
import { Article } from './types/article';
import { isUserAdmin } from './services/pyqFirestoreService';
import { StartupSplashOverlay } from './components/StartupSplashOverlay';
import { BattleAnalyticsDashboard } from './components/admin/BattleAnalyticsDashboard';
import { 
  recordBattleStarted, 
  recordBattleCompleted, 
  recordBattleAbandoned, 
  recordBattleSignupCompleted 
} from './services/battleAnalyticsService';
import { battleHistoryService } from './services/battleHistoryService';
import { 
  trackPageView, 
  trackPracticeStart, 
  trackQuestionAnswered, 
  trackPracticeComplete, 
  trackTop100Start, 
  trackTop100Complete,
  normalizeAnalyticsCategory,
  normalizeAnalyticsExamFamily
} from './services/analyticsService';

const STORAGE_KEY_PLAYER = 'vocabclash_player_v5';
const STORAGE_KEY_VAULT = 'vocabclash_vault_v2';
const STORAGE_KEY_SUBSCRIPTION = 'vocabclash_subscription_v2';

export function getPlayerStorageKey(userId?: string | null): string {
  if (!userId || userId === 'default_user' || userId.startsWith('guest_')) {
    return 'vocabclash_player_profile_guest';
  }
  return `vocabclash_player_profile_${userId}`;
}

export function cleanupLegacyUnscopedPlayerStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PLAYER);
    localStorage.removeItem('vocabclash_player_v3');
    localStorage.removeItem('vocabclash_player_v2');
    localStorage.removeItem('vocabclash_player_v1');
    localStorage.removeItem('vocabclash_player_profile');
  } catch {}
}

// Generates and persists a unique device guest ID so no two guest devices ever collide
export function getOrCreateGuestId(): string {
  if (typeof window !== 'undefined') {
    try {
      let gid = localStorage.getItem('vocabclash_guest_uid');
      if (!gid || gid === 'user-live-1' || gid === 'user-cgl-1') {
        gid = `guest_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem('vocabclash_guest_uid', gid);
      }
      return gid;
    } catch { /* ignore */ }
  }
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

const resolveTargetExam = (cloudExam?: string | null, localExam?: string | null): string => {
  const explicit = typeof window !== 'undefined' ? localStorage.getItem('vocabclash_user_chosen_target_exam') : null;
  if (explicit && explicit.trim()) return explicit;
  // If local exam is customized (not the legacy default), prefer it over a stale default
  if (localExam && localExam !== 'SSC CGL 2026 (GST Inspector)' && localExam.trim()) {
    return localExam;
  }
  if (cloudExam && cloudExam !== 'SSC CGL 2026 (GST Inspector)' && cloudExam.trim()) {
    return cloudExam;
  }
  if (cloudExam && cloudExam.trim()) {
    return cloudExam;
  }
  if (localExam && localExam.trim()) {
    return localExam;
  }
  return 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)';
};

const INITIAL_PLAYER: PlayerProfile = {
  id: getOrCreateGuestId(),
  name: 'Govt Aspirant',
  avatar: '👨‍💼',
  country: 'India',
  countryCode: 'IN',
  targetExam: (typeof window !== 'undefined' && localStorage.getItem('vocabclash_user_chosen_target_exam')) || 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
  rankPoints: 0,
  pyqScore: 0,
  tier: 'Aspirant',
  tierTitle: '🥉 Govt Job Aspirant',
  level: 1,
  matchesPlayed: 0,
  matchesWon: 0,
  winStreak: 0,
  accuracyRate: 0,
  bestCategory: 'synonyms',
  badges: ['🏛️ SSC CGL Aspirant'],
};

/**
 * Sanitizes and repairs contaminated accounts (e.g. Suraj Kumar inheriting Chinmoy's 1340 LP).
 * Restores genuine baseline stats while preserving earned daily challenge bonuses and preventing future leaks.
 */
export function sanitizeAndRepairPlayerProfile(
  rawProfile: PlayerProfile,
  authUser: { uid: string; email?: string | null; displayName?: string | null }
): { player: PlayerProfile; wasRepaired: boolean } {
  const isChinmoy = 
    authUser.email?.toLowerCase() === 'nathchinmoy777@gmail.com' ||
    authUser.email?.toLowerCase().includes('nathchinmoy777');

  const isSuraj = 
    authUser.email?.toLowerCase().includes('suraj') ||
    authUser.displayName?.toLowerCase().includes('suraj') ||
    rawProfile.name?.toLowerCase().includes('suraj');

  // Case 1: Chinmoy Nath (admin/owner account)
  if (isChinmoy) {
    const minLP = 1265;
    const finalLP = Math.max(rawProfile.rankPoints || 0, minLP, 1340);
    const finalMatches = Math.max(rawProfile.matchesPlayed || 0, 32);
    const finalWins = Math.max(rawProfile.matchesWon || 0, 28);
    const finalTier = getTierFromLP(finalLP);
    return {
      player: {
        ...rawProfile,
        id: authUser.uid,
        name: 'Chinmoy Nath',
        email: 'nathchinmoy777@gmail.com',
        rankPoints: finalLP,
        matchesPlayed: finalMatches,
        matchesWon: finalWins,
        winStreak: Math.max(rawProfile.winStreak || 0, 5),
        pyqScore: Math.max(rawProfile.pyqScore || 0, 730),
        accuracyRate: Math.round((finalWins / finalMatches) * 100),
        level: Math.max(rawProfile.level || 1, 34),
        tier: finalTier,
        tierTitle: getTierTitle(finalTier),
        targetExam: rawProfile.targetExam || 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
        badges: ['🏛️ SSC CGL Aspirant'],
      },
      wasRepaired: false,
    };
  }

  // Case 2: Non-Chinmoy account contaminated with Chinmoy's stats
  const isContaminated = 
    rawProfile.tierTitle?.includes('Auditor') ||
    rawProfile.tierTitle?.includes('Accountant') ||
    (rawProfile.rankPoints >= 1265 && rawProfile.accuracyRate === 29 && rawProfile.matchesWon === 28) ||
    (rawProfile.rankPoints >= 1200 && rawProfile.level >= 30) ||
    (isSuraj && rawProfile.rankPoints > 500);

  if (isContaminated) {
    console.warn(`[ProfileSanitizer] Cross-account contamination detected for ${authUser.email || authUser.uid}. Repairing genuine stats.`);
    
    if (isSuraj) {
      let dailyBonus = 0;
      try {
        const todayAttempt = getTodayChallengeAttempt(authUser.uid);
        if (todayAttempt) {
          dailyBonus = todayAttempt.rankPointsAwarded || (25 + (todayAttempt.correctCount || 0) * 2);
        }
      } catch {}

      const baseLP = 360;
      const repairedLP = baseLP + dailyBonus;
      const repairedTier = getTierFromLP(repairedLP);
      return {
        player: {
          ...rawProfile,
          id: authUser.uid,
          name: 'Suraj Kumar',
          email: authUser.email || undefined,
          rankPoints: repairedLP,
          level: 20,
          matchesPlayed: 14,
          matchesWon: 1,
          winStreak: 0,
          accuracyRate: 7,
          pyqScore: Math.min(rawProfile.pyqScore || 0, 150),
          tier: repairedTier,
          tierTitle: getTierTitle(repairedTier),
          targetExam: rawProfile.targetExam || 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
          badges: ['🏛️ SSC CGL Aspirant'],
        },
        wasRepaired: true,
      };
    } else {
      const clampedLP = Math.min(rawProfile.rankPoints || 0, 350);
      const clampedTier = getTierFromLP(clampedLP);
      return {
        player: {
          ...rawProfile,
          id: authUser.uid,
          rankPoints: clampedLP,
          level: Math.min(rawProfile.level || 1, 10),
          tier: clampedTier,
          tierTitle: getTierTitle(clampedTier),
          accuracyRate: Math.min(rawProfile.accuracyRate || 0, 60),
          badges: ['🏛️ SSC CGL Aspirant'],
        },
        wasRepaired: true,
      };
    }
  }

  // Case 3: Clean, non-contaminated user
  return {
    player: {
      ...rawProfile,
      id: authUser.uid,
      tier: getTierFromLP(rawProfile.rankPoints || 0),
      tierTitle: getTierTitle(getTierFromLP(rawProfile.rankPoints || 0)),
    },
    wasRepaired: false,
  };
}

// Helper to sanitize and cleanse any lingering demo template state
function sanitizeProfile(raw: any, googleUser?: FirebaseUser | null): PlayerProfile {
  const deviceGuestId = getOrCreateGuestId();
  if (!raw) return { ...INITIAL_PLAYER, id: googleUser ? googleUser.uid : deviceGuestId };

  // Only genuinely hardcoded mock demo accounts from legacy tests are demo accounts
  const isHardcodedDemoAccount = 
    (raw.id === 'user-cgl-1' || raw.id === 'user-live-1') ||
    (raw.name === 'Aspirant Rahul' && !raw.email && !googleUser?.email);

  const cleanUserName = extractCleanUserName(googleUser?.displayName, googleUser?.email);

  if (isHardcodedDemoAccount) {
    return {
      ...INITIAL_PLAYER,
      id: googleUser ? googleUser.uid : deviceGuestId,
      name: cleanUserName || 'Govt Aspirant',
      photoURL: googleUser?.photoURL || undefined,
      email: googleUser?.email || undefined,
      rankPoints: 0,
      pyqScore: 0,
      tier: 'Aspirant',
      tierTitle: '🥉 Govt Job Aspirant',
      level: 1,
      matchesPlayed: 0,
      matchesWon: 0,
      winStreak: 0,
      accuracyRate: 0,
    };
  }

  let rankPoints = typeof raw.rankPoints === 'number' ? Math.max(0, raw.rankPoints) : 0;
  let pyqScore = typeof raw.pyqScore === 'number' ? Math.max(0, raw.pyqScore) : 0;
  let matchesPlayed = typeof raw.matchesPlayed === 'number' ? Math.max(0, raw.matchesPlayed) : 0;
  let matchesWon = typeof raw.matchesWon === 'number' ? Math.max(0, raw.matchesWon) : 0;
  let winStreak = typeof raw.winStreak === 'number' ? Math.max(0, raw.winStreak) : 0;
  let accuracyRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
  let level = Math.max(1, Math.floor(matchesPlayed / 3) + 1);

  const userEmail = googleUser?.email;
  let effectiveName = resolvePlayerName({
    cloudName: raw.name,
    authDisplayName: googleUser?.displayName,
    email: userEmail,
  });

  // Restore progress for Chinmoy Nath (admin/owner account) ONLY if authenticated as Chinmoy
  const isChinmoy = 
    userEmail?.toLowerCase() === 'nathchinmoy777@gmail.com' || 
    userEmail?.toLowerCase().includes('nathchinmoy777');

  if (isChinmoy) {
    effectiveName = 'Chinmoy Nath';
    if (rankPoints < 1265) {
      rankPoints = 1265; // Restore Auditor / Accountant 2800 GP tier (1200+ LP)
      matchesPlayed = Math.max(matchesPlayed, 32);
      matchesWon = Math.max(matchesWon, 28);
      winStreak = Math.max(winStreak, 5);
      pyqScore = Math.max(pyqScore, 730);
      accuracyRate = Math.round((matchesWon / matchesPlayed) * 100);
      level = Math.max(level, 12);
    }
  }

  const tier = getTierFromLP(rankPoints);
  const tierTitle = getTierTitle(tier);

  const resolvedId = googleUser ? googleUser.uid : (raw.id && raw.id !== 'user-live-1' && raw.id !== 'user-cgl-1' ? raw.id : deviceGuestId);

  const practiceFilters = raw.practiceFilters && typeof raw.practiceFilters === 'object' && raw.practiceFilters.category && raw.practiceFilters.exam
    ? { category: raw.practiceFilters.category, exam: raw.practiceFilters.exam }
    : undefined;

  const resolvedTargetExam = resolveTargetExam(raw.targetExam);

  return {
    ...INITIAL_PLAYER,
    ...raw,
    id: resolvedId,
    name: effectiveName || cleanUserName || 'Govt Aspirant',
    targetExam: resolvedTargetExam,
    photoURL: googleUser?.photoURL || raw.photoURL || undefined,
    email: userEmail || undefined,
    rankPoints,
    pyqScore,
    tier,
    tierTitle,
    matchesPlayed,
    matchesWon,
    winStreak,
    accuracyRate,
    level,
    createdAt: raw.createdAt || (googleUser?.metadata?.creationTime ? new Date(googleUser.metadata.creationTime).getTime() : Date.now()),
    ...(practiceFilters ? { practiceFilters } : {}),
  };
}

const INITIAL_SUBSCRIPTION: UserSubscription = {
  isPremium: false,
  autoRenew: false,
};

/**
 * Purge all user-specific data from local caches and reset all managers upon user sign out
 * Ensures guest starts completely fresh with 0 questions, 0 daily target progress, and no lingering stats
 */
export function clearUserDataOnSignOut(specificUid?: string | null) {
  if (typeof window === 'undefined') return;

  // 1. Reset user profile, vault, subscription, streak from localStorage
  try {
    localStorage.removeItem('vocabclash_player_profile_guest');
    localStorage.removeItem(STORAGE_KEY_VAULT);
    localStorage.removeItem(STORAGE_KEY_SUBSCRIPTION);
    localStorage.removeItem('vocabclash_daily_streak_v2');
    localStorage.removeItem(STORAGE_KEY_STREAK_BONUS_CLAIMED_DATE);
    cleanupLegacyUnscopedPlayerStorage();

    if (specificUid) {
      localStorage.removeItem(getPlayerStorageKey(specificUid));
      localStorage.removeItem(`vocabclash:user:${specificUid}:stats`);
    }

    // Clean up any remaining namespaced keys for authenticated user
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('vocabclash:user:') || k.startsWith('vocabclash_player_profile_'))) {
        if (specificUid && k.includes(specificUid)) {
          keysToRemove.push(k);
        } else if (!specificUid && !k.endsWith('_guest')) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}

  // Reset global in-memory rank store and unsubscribe Firestore listeners
  rankStore.handleLogout(specificUid);

  // 2. Reset daily target state & config so guest gets fresh 0-progress target
  resetDailyTargetState();

  // 3. Reset spaced repetition scheduler and reviews
  questionReviewScheduler.reset();

  // 4. Reset authoritative attempts log
  resetAuthoritativeAttempts();

  // 5. Reset user stats totals & daily accuracy map
  resetUserStats();

  // 6. Reset SSC Top 100 progress
  sscTop100Service.resetLocalProgress();

  // 7. Reset active practice drill & daily progress
  saveStoredActiveDrill(null);
  try {
    localStorage.removeItem('vocabclash_pyq_daily_progress');
    localStorage.removeItem('vocabclash_pyq_filter_pref');
  } catch {}

  // 8. Reset question seen history
  clearSeenHistory();

  // 9. Reset mastery map
  try {
    localStorage.removeItem('vocabclash_pyq_mastery_v2');
  } catch {}

  // 10. Clear mentor cached reports & AI usage
  try {
    localStorage.removeItem('vocabclash_ai_daily_usage_v2');
  } catch {}

  // 11. Clear daily challenge storage & caches
  clearDailyChallengeLocalCache();

  // 12. Reset battle history & analytics
  try {
    localStorage.removeItem('vocabclash_battle_history_v1');
    localStorage.removeItem('vocabclash_battle_summary_v1');
    localStorage.removeItem('vocabclash_battle_events_v1');
  } catch {}

  // 13. Dispatch events so all UI listeners (DailyCommandCenterCard, DailyTargetCard, TopBar, DailyChallengeCard) update immediately
  window.dispatchEvent(new CustomEvent('daily-target-updated'));
  window.dispatchEvent(new CustomEvent('user-stats-updated'));
  window.dispatchEvent(new CustomEvent('daily-challenge-updated'));
  window.dispatchEvent(new CustomEvent('storage'));
}

// Helper for virtual SPA route tracking in GA4
function getVirtualRouteDetails(params: {
  activeSeoSlug: string | null;
  activeArticleSlug?: string | null;
  isViewingArticlesIndex?: boolean;
  showAdminArticles?: boolean;
  matchState: MatchState | null;
  isMatchmaking: boolean;
  currentTab: TabType;
}): { page_path: string; page_title: string } {
  if (params.showAdminArticles) {
    return {
      page_path: '/admin/articles',
      page_title: 'VocabClash Editorial Studio (Admin)',
    };
  }

  if (params.activeArticleSlug) {
    return {
      page_path: `/articles/${params.activeArticleSlug}`,
      page_title: `VocabClash Article: ${params.activeArticleSlug}`,
    };
  }

  if (params.isViewingArticlesIndex) {
    return {
      page_path: '/articles',
      page_title: 'VocabClash Articles & Editorial Hub',
    };
  }

  if (params.activeSeoSlug) {
    const slugKey = params.activeSeoSlug.replace(/^\//, '');
    const seoPage = SEO_PAGES[slugKey];
    return {
      page_path: params.activeSeoSlug,
      page_title: seoPage ? seoPage.title : 'SSC Vocabulary Guide',
    };
  }

  if (params.matchState || params.isMatchmaking) {
    return {
      page_path: '/1v1',
      page_title: '1v1 Arena',
    };
  }

  switch (params.currentTab) {
    case 'practice':
      return {
        page_path: '/pyq-drill',
        page_title: 'PYQ Drill',
      };
    case 'mistakes':
      return {
        page_path: '/mistake-vault',
        page_title: 'Mistake Vault',
      };
    case 'leaderboard':
      return {
        page_path: '/ranks',
        page_title: 'Ranks Leaderboard',
      };
    case 'ai_coach':
      return {
        page_path: '/ai-mentor',
        page_title: 'AI Vocab Mentor',
      };
    case 'arena':
    default:
      return {
        page_path: '/',
        page_title: 'home',
      };
  }
}

export default function App() {
  // Firebase Auth state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isInitialCloudLoad = useRef<boolean>(true);
  const previousUserUidRef = useRef<string | null>(null);

  // Player state persisted in localStorage & Cloud
  const [player, setPlayer] = useState<PlayerProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Clean up legacy localStorage keys
        localStorage.removeItem('vocabclash_player_v1');
        localStorage.removeItem('vocabclash_player_v2');
        localStorage.removeItem('vocabclash_player_v3');
        const saved = localStorage.getItem(STORAGE_KEY_PLAYER);
        if (saved) {
          const parsed = JSON.parse(saved);
          return sanitizeProfile(parsed);
        }
      } catch { /* ignore */ }
    }
    return INITIAL_PLAYER;
  });

  // Saved words (Mistake vault)
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_VAULT);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return sanitizeVaultList(parsed);
        } catch { /* ignore */ }
      }
    }
    return [];
  });

  // VIP / Premium Subscription state
  const [subscription, setSubscription] = useState<UserSubscription>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SUBSCRIPTION);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return INITIAL_SUBSCRIPTION;
  });

  // Daily Streak state (evaluates day difference and resets to 0 if 1 day missed)
  const [streak, setStreak] = useState<DailyStreakState>(() => getInitialStreak());

  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const rawPath = window.location.pathname.toLowerCase();
      if (rawPath.includes('/pyq-drill') || rawPath.includes('/practice')) return 'practice';
      if (rawPath.includes('/mistake-vault') || rawPath.includes('/vault') || rawPath.includes('/mistakes')) return 'mistakes';
      if (rawPath.includes('/ranks') || rawPath.includes('/leaderboard')) return 'leaderboard';
      if (rawPath.includes('/ai-coach') || rawPath.includes('/ai-mentor')) return 'ai_coach';
    }
    return 'arena';
  });
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'mixed'>('mixed');
  const [selectedExam, setSelectedExam] = useState<ExamType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vocabclash_pyq_filter_pref') || localStorage.getItem('vocabclash_pyq_filter_preferences_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.exam) return parsed.exam;
        }
      } catch {}
    }
    return 'ALL';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Persistent PYQ Practice Filters (Persists across tabs, sessions, and cloud devices)
  const [practiceFilters, setPracticeFilters] = useState<{ category: QuestionCategory | 'mixed'; exam: ExamType }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vocabclash_pyq_filter_pref') || localStorage.getItem('vocabclash_pyq_filter_preferences_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.category || parsed.exam)) {
            return {
              category: parsed.category || 'mixed',
              exam: parsed.exam || 'ALL',
            };
          }
        }
      } catch {}
    }
    return { category: 'mixed', exam: 'ALL' };
  });

  const handleSelectExam = (newExam: ExamType) => {
    setSelectedExam(newExam);
    const nextFilters = { ...practiceFilters, exam: newExam };
    setPracticeFilters(nextFilters);
    try {
      localStorage.setItem('vocabclash_pyq_filter_pref', JSON.stringify(nextFilters));
      localStorage.setItem('vocabclash_pyq_filter_preferences_v1', JSON.stringify(nextFilters));
    } catch {}
    setPlayer(prev => ({
      ...prev,
      practiceFilters: nextFilters,
    }));
    // If a custom target queue from another exam was active, clear it so user's filter takes effect
    if (practiceCustomQueue) {
      const allMatch = practiceCustomQueue.every(q => matchesExamFamilyFilter(q, newExam));
      if (!allMatch) {
        setPracticeCustomQueue(null);
        setPracticeModeBannerTitle(null);
        setActiveSscTop100Category(null);
      }
    }
  };

  const handleUpdatePracticeFilter = (newCat: QuestionCategory | 'mixed', newExam: ExamType) => {
    const nextFilters = { category: newCat, exam: newExam };
    setPracticeFilters(nextFilters);
    setSelectedExam(newExam);
    try {
      localStorage.setItem('vocabclash_pyq_filter_pref', JSON.stringify(nextFilters));
      localStorage.setItem('vocabclash_pyq_filter_preferences_v1', JSON.stringify(nextFilters));
    } catch {}
    setPlayer(prev => ({
      ...prev,
      practiceFilters: nextFilters,
    }));
    // If a custom target queue from another exam was active, clear it so user's filter takes effect
    if (practiceCustomQueue) {
      const allMatch = practiceCustomQueue.every(q => matchesExamFamilyFilter(q, newExam));
      if (!allMatch) {
        setPracticeCustomQueue(null);
        setPracticeModeBannerTitle(null);
        setActiveSscTop100Category(null);
      }
    }
  };

  // Targeted Coaching Drill Queue (from AI Vocab Mentor & SSC Top 100)
  const [practiceCustomQueue, setPracticeCustomQueue] = useState<Question[] | null>(null);
  const [practiceModeBannerTitle, setPracticeModeBannerTitle] = useState<string | null>(null);
  const [practiceCustomBadge, setPracticeCustomBadge] = useState<string | null>(null);

  // SSC Top 100 Drill State
  const [activeSscTop100Category, setActiveSscTop100Category] = useState<SscTop100Category | null>(null);
  const [sscTop100InitialIndex, setSscTop100InitialIndex] = useState<number>(0);
  const [sscTop100InitialCorrect, setSscTop100InitialCorrect] = useState<number>(0);
  const [showSscTop100CompletionModal, setShowSscTop100CompletionModal] = useState<boolean>(false);
  const [sscTop100SummaryData, setSscTop100SummaryData] = useState<{
    category: SscTop100Category;
    score: number;
    accuracy: number;
    mistakeCount: number;
    totalSolved: number;
  } | null>(null);

  // Matchmaking & Game state
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const [matchMode, setMatchMode] = useState<'1v1_ranked' | 'quick_duel' | 'daily_challenge'>('1v1_ranked');
  const [matchedOpponent, setMatchedOpponent] = useState<PlayerProfile | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [isMatchCompleted, setIsMatchCompleted] = useState<boolean>(false);
  const matchStartTimeRef = useRef<number>(0);

  // 1v1 Battle Analytics & Funnel Dashboard
  const [showBattleAnalytics, setShowBattleAnalytics] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      return (
        p.includes('/admin/analytics') ||
        p.includes('/admin/battle-analytics') ||
        h.includes('admin-analytics') ||
        h.includes('admin-battle-analytics') ||
        window.location.search.includes('admin=analytics')
      );
    }
    return false;
  });

  // Modals
  const [activeAiQuestion, setActiveAiQuestion] = useState<Question | null>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [editProfileReturnToProfile, setEditProfileReturnToProfile] = useState<boolean>(false);
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [showStreakModal, setShowStreakModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showAppGuideModal, setShowAppGuideModal] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const rawPath = window.location.pathname.toLowerCase();
        const rawHash = window.location.hash.toLowerCase();
        // Skip onboarding modal on admin or direct deep link routes
        if (
          rawPath.startsWith('/admin') ||
          rawPath.startsWith('/articles') ||
          rawHash.includes('admin-') ||
          rawPath.includes('/pyq-drill') ||
          rawPath.includes('/mistake-vault') ||
          rawPath.includes('/ranks') ||
          rawPath.includes('/ai-coach') ||
          window.location.search.includes('admin=')
        ) {
          return false;
        }
        const tourSeen = localStorage.getItem('vocabclash_onboarding_seen_v1');
        return !tourSeen;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [shouldShowPyqFilterGuidance, setShouldShowPyqFilterGuidance] = useState<boolean>(false);
  const [showPlayModeModal, setShowPlayModeModal] = useState<boolean>(false);
  const [showFriendLobbyModal, setShowFriendLobbyModal] = useState<boolean>(false);
  const [showOfflineWarningModal, setShowOfflineWarningModal] = useState<boolean>(false);
  const [showSeoGuidesModal, setShowSeoGuidesModal] = useState<boolean>(false);
  const [showDueRevisionModal, setShowDueRevisionModal] = useState<boolean>(false);
  const [dueRevisionWords, setDueRevisionWords] = useState<SavedWord[]>([]);

  const handleStartDueRevision = (dueWords: SavedWord[]) => {
    setDueRevisionWords(dueWords);
    setShowDueRevisionModal(true);
  };

  // Article Publishing System & Public Articles routing states
  const [showAdminArticles, setShowAdminArticles] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      return p === '/admin/articles' || p === '/admin/articles/' || window.location.hash.includes('admin-articles');
    }
    return false;
  });
  const [adminArticleMode, setAdminArticleMode] = useState<'dashboard' | 'editor'>('dashboard');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  const [isViewingArticlesIndex, setIsViewingArticlesIndex] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      return p === '/articles' || p === '/articles/' || hash === '#/articles' || hash === '#/articles/';
    }
    return false;
  });

  const [activeArticleSlug, setActiveArticleSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.startsWith('/articles/') && p !== '/articles/' && !p.startsWith('/articles/category')) {
        const slug = p.replace(/^\/articles\/?/, '').split('/')[0].split('?')[0].trim();
        return decodeURIComponent(slug) || null;
      }
      const hash = window.location.hash.toLowerCase();
      if (hash.startsWith('#/articles/')) {
        const hashSlug = hash.replace(/^#\/articles\/?/, '').split('/')[0].split('?')[0].trim();
        return decodeURIComponent(hashSlug) || null;
      }
      const params = new URLSearchParams(window.location.search);
      const qSlug = params.get('article') || params.get('slug');
      if (qSlug) return decodeURIComponent(qSlug);
    }
    return null;
  });

  const [activeSeoSlug, setActiveSeoSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const rawPath = window.location.pathname.toLowerCase();
      const key = rawPath.replace(/^\//, '').trim();
      if (key && SEO_PAGES[key]) {
        return `/${key}`;
      }
    }
    return null;
  });
  const [friendLobbyInitialCode, setFriendLobbyInitialCode] = useState<string>('');
  const [forfeitNotice, setForfeitNotice] = useState<string | null>(null);
  const [showAdminImporter, setShowAdminImporter] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/admin/articles')) return false;
      return (
        p.includes('/admin/pyq-import') ||
        p === '/admin' ||
        p === '/admin/' ||
        window.location.hash.includes('admin-pyq') ||
        window.location.search.includes('admin=pyq')
      );
    }
    return false;
  });

  // Listen to hash / route changes for private admin portal, public articles, and public SEO guides
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashOrPopState = () => {
      const rawPath = window.location.pathname.toLowerCase();

      // 0. Admin 1v1 Battle Analytics Route (/admin/analytics, /admin/battle-analytics, #admin-analytics)
      const isAnalyticsRoute = 
        rawPath.includes('/admin/analytics') ||
        rawPath.includes('/admin/battle-analytics') ||
        window.location.hash.includes('admin-analytics') ||
        window.location.hash.includes('admin-battle-analytics') ||
        window.location.search.includes('admin=analytics');
      setShowBattleAnalytics(isAnalyticsRoute);
      if (isAnalyticsRoute) {
        setShowAdminArticles(false);
        setShowAdminImporter(false);
        setIsViewingArticlesIndex(false);
        setActiveArticleSlug(null);
        setActiveSeoSlug(null);
        return;
      }

      // 1. Admin Articles Route (/admin/articles)
      if (rawPath === '/admin/articles' || rawPath === '/admin/articles/' || window.location.hash.includes('admin-articles')) {
        setShowAdminArticles(true);
        setShowAdminImporter(false);
        setIsViewingArticlesIndex(false);
        setActiveArticleSlug(null);
        setActiveSeoSlug(null);
        return;
      }
      setShowAdminArticles(false);

      // 2. Admin PYQ Import Route
      const isAdminRoute = 
        rawPath.includes('/admin/pyq-import') ||
        rawPath === '/admin' ||
        rawPath === '/admin/' ||
        window.location.hash.includes('admin-pyq') ||
        window.location.search.includes('admin=pyq');
      setShowAdminImporter(isAdminRoute);
      if (isAdminRoute) {
        setIsViewingArticlesIndex(false);
        setActiveArticleSlug(null);
        setActiveSeoSlug(null);
        return;
      }

      // 3. Public Articles Index Route (/articles or #/articles)
      const hash = window.location.hash.toLowerCase();
      if (rawPath === '/articles' || rawPath === '/articles/' || hash === '#/articles' || hash === '#/articles/') {
        setIsViewingArticlesIndex(true);
        setActiveArticleSlug(null);
        setActiveSeoSlug(null);
        return;
      }

      // 4. Public Article Detail Route (/articles/:slug or #/articles/:slug or ?article=:slug)
      if (rawPath.startsWith('/articles/')) {
        const slug = rawPath.replace(/^\/articles\/?/, '').split('/')[0].split('?')[0].trim();
        if (slug) {
          setActiveArticleSlug(decodeURIComponent(slug));
          setIsViewingArticlesIndex(false);
          setActiveSeoSlug(null);
          return;
        }
      }
      if (hash.startsWith('#/articles/')) {
        const hashSlug = hash.replace(/^#\/articles\/?/, '').split('/')[0].split('?')[0].trim();
        if (hashSlug) {
          setActiveArticleSlug(decodeURIComponent(hashSlug));
          setIsViewingArticlesIndex(false);
          setActiveSeoSlug(null);
          return;
        }
      }
      const searchParams = new URLSearchParams(window.location.search);
      const queryArticle = searchParams.get('article') || searchParams.get('slug');
      if (queryArticle) {
        setActiveArticleSlug(decodeURIComponent(queryArticle));
        setIsViewingArticlesIndex(false);
        setActiveSeoSlug(null);
        return;
      }

      // Clear article views if navigating away
      setIsViewingArticlesIndex(false);
      setActiveArticleSlug(null);

      // 5. Existing SEO topic hubs and tab routes
      const key = rawPath.replace(/^\//, '').trim();
      if (key && SEO_PAGES[key]) {
        setActiveSeoSlug(`/${key}`);
      } else {
        setActiveSeoSlug(null);
        updatePageSeo(null);
        if (rawPath.includes('/pyq-drill') || rawPath.includes('/practice')) {
          setCurrentTab('practice');
        } else if (rawPath.includes('/mistake-vault') || rawPath.includes('/vault') || rawPath.includes('/mistakes')) {
          setCurrentTab('mistakes');
        } else if (rawPath.includes('/ranks') || rawPath.includes('/leaderboard')) {
          setCurrentTab('leaderboard');
        } else if (rawPath.includes('/ai-coach') || rawPath.includes('/ai-mentor')) {
          setCurrentTab('ai_coach');
        } else if (rawPath === '/' || rawPath === '/1v1') {
          setCurrentTab('arena');
        }
      }
    };

    window.addEventListener('popstate', handleHashOrPopState);
    window.addEventListener('hashchange', handleHashOrPopState);
    return () => {
      window.removeEventListener('popstate', handleHashOrPopState);
      window.removeEventListener('hashchange', handleHashOrPopState);
    };
  }, []);

  // GA4 Virtual SPA Page Tracking (page_path, page_title, page_location)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const route = getVirtualRouteDetails({
      activeSeoSlug,
      activeArticleSlug,
      isViewingArticlesIndex,
      showAdminArticles,
      matchState,
      isMatchmaking,
      currentTab,
    });

    // Synchronize browser history URL if switching views inside the SPA
    if (!activeSeoSlug && !activeArticleSlug && !isViewingArticlesIndex && !showAdminArticles && window.location.pathname !== route.page_path) {
      try {
        window.history.replaceState(null, '', route.page_path);
      } catch {
        // ignore
      }
    }

    // Safely fire virtual page_view (analyticsService deduplicates identical successive paths)
    trackPageView(
      route.page_path,
      route.page_title,
      window.location.origin + route.page_path
    );
  }, [currentTab, activeSeoSlug, activeArticleSlug, isViewingArticlesIndex, showAdminArticles, Boolean(matchState), isMatchmaking]);

  // Update default SEO meta tags when not on a specific SEO guide page
  useEffect(() => {
    if (!activeSeoSlug) {
      updatePageSeo(null);
    }
  }, [activeSeoSlug]);

  // Auto-detect friend lobby code from URL parameters (e.g. ?lobby=492810 or ?join=492810)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const lobbyParam = urlParams.get('lobby') || urlParams.get('join') || urlParams.get('room');
        if (lobbyParam) {
          const cleanCode = lobbyParam.trim().replace(/\D/g, '');
          if (cleanCode.length === 6) {
            setFriendLobbyInitialCode(cleanCode);
            setShowFriendLobbyModal(true);
          }
        }
      } catch {
        // ignore URL parsing error
      }
    }
  }, []);

  // Auto-trigger onboarding tour for first-time visitors (State is initialized synchronously on first mount)
  useEffect(() => {
    try {
      const tourSeen = localStorage.getItem('vocabclash_onboarding_seen_v1');
      if (!tourSeen) {
        const rawPath = window.location.pathname.toLowerCase();
        const rawHash = window.location.hash.toLowerCase();
        if (
          !rawPath.startsWith('/admin') &&
          !rawPath.startsWith('/articles') &&
          !rawHash.includes('admin-')
        ) {
          setShowTourModal(true);
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Track window/tab close during active match as match abandonment
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = () => {
      if (matchState && !isMatchCompleted) {
        try {
          recordBattleAbandoned({
            matchId: matchState.matchId,
            mode: (matchState.mode as any) || '1v1_ranked',
            isGuest: !currentUser,
            isRealPlayer: Boolean(matchState.isRealPlayer),
            roundCount: matchState.questions?.length || 5,
            currentQuestionIndex: matchState.currentQuestionIndex,
            questionsAnswered: matchState.playerAnswers?.length || 0,
            reason: 'window_close',
            userId: currentUser?.uid,
          });

          // Record as definitive loss in 30-day battle history
          battleHistoryService.recordMatch({
            id: matchState.matchId,
            timestamp: Date.now(),
            mode: (matchState.mode as any) || '1v1_ranked',
            category: matchState.categoryFilter,
            exam: matchState.examFilter,
            playerScore: matchState.playerScore,
            opponentScore: matchState.opponentScore,
            opponentName: matchState.opponent?.name || 'Opponent',
            opponentAvatar: matchState.opponent?.avatar,
            isWin: false,
            isDraw: false,
            lpDelta: -15,
          });

          // Deduct -15 LP and increment matchesPlayed in local cache
          const nextMatchesPlayed = (player.matchesPlayed || 0) + 1;
          const nextMatchesWon = player.matchesWon || 0;
          const nextLP = Math.max(0, (player.rankPoints || 0) - 15);
          const nextAccuracy = Math.round((nextMatchesWon / nextMatchesPlayed) * 100);
          const localUpdated: PlayerProfile = {
            ...player,
            matchesPlayed: nextMatchesPlayed,
            matchesWon: nextMatchesWon,
            rankPoints: nextLP,
            winStreak: 0,
            accuracyRate: nextAccuracy,
          };
          localStorage.setItem('vocabclash_user_profile', JSON.stringify(localUpdated));

          if (matchState.isRealPlayer && (matchState.realRoomId || matchState.matchId)) {
            const rId = matchState.realRoomId || matchState.matchId;
            forfeitLiveRoom(rId, player.id, matchState.opponent?.id).catch(() => {});
          }
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [matchState, isMatchCompleted, currentUser, player]);

  // Listen to Firebase Auth state & sync with Google Account
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Check if coming back from Google redirect auth
    checkRedirectAuthResult().catch(err => {
      console.warn('Redirect auth check completed:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const lastActiveUid = typeof window !== 'undefined' ? localStorage.getItem('vocabclash_last_active_user_uid') : null;
        const previousUid = previousUserUidRef.current;
        const priorUid = previousUid || lastActiveUid;
        const isSwitchingUser = !!priorUid && priorUid !== user.uid;
        if (isSwitchingUser) {
          console.log('[Auth] Account switch detected:', priorUid, '->', user.uid, '- purging previous user local cache');
          clearUserDataOnSignOut();
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('vocabclash_last_active_user_uid', user.uid);
        }
        previousUserUidRef.current = user.uid;
        setCurrentUser(user);
        questionReviewScheduler.setAuthUser(user.uid);
        try {
          recordBattleSignupCompleted(user.uid, user.providerData?.[0]?.providerId || 'google');
        } catch {}
        hydrateStatsFromCloud(user.uid).catch(e => console.warn('Hydrate stats error:', e));
        setIsSyncing(true);
        try {
          // Read user-scoped local player state right now before overwriting
          let localPlayer: PlayerProfile = { ...INITIAL_PLAYER, id: user.uid };
          if (!isSwitchingUser) {
            try {
              const userScopedRaw = localStorage.getItem(getPlayerStorageKey(user.uid));
              if (userScopedRaw) {
                localPlayer = JSON.parse(userScopedRaw);
              }
            } catch { /* ignore */ }
          }

          // Try to load existing cloud data for this user
          const cloudData = await fetchUserDataFromFirestore(user.uid);
          const pendingRegName = getPendingRegistrationDisplayName();
          const effectiveAuthDisplayName = user.displayName?.trim() || pendingRegName;
          const cleanAuthName = effectiveAuthDisplayName || extractCleanUserName(user.displayName, user.email);
          
          if (cloudData && cloudData.player) {
            const cloudP = cloudData.player;
            // Clean up cloud name by prioritizing authenticated identity and fixing synthetic email artifacts
            let resolvedName = resolvePlayerName({
              cloudName: cloudP.name,
              localName: localPlayer.name,
              authDisplayName: effectiveAuthDisplayName,
              email: user.email,
            });

            // SANITIZE & REPAIR: Never merge cross-account stats with Math.max!
            // The cloud profile is the authoritative source of truth.
            const { player: repairedPlayer, wasRepaired } = sanitizeAndRepairPlayerProfile(cloudP, user);

            const resolvedTargetExam = resolveTargetExam(repairedPlayer.targetExam, localPlayer.targetExam);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('vocabclash_user_chosen_target_exam', resolvedTargetExam);
              } catch {}
            }

            const resolvedPlayer: PlayerProfile = {
              ...INITIAL_PLAYER,
              ...repairedPlayer,
              id: user.uid,
              name: resolvedName || cleanAuthName || repairedPlayer.name || 'Govt Aspirant',
              avatar: repairedPlayer.avatar || '👨‍💼',
              country: repairedPlayer.country || 'India',
              countryCode: repairedPlayer.countryCode || 'IN',
              targetExam: resolvedTargetExam,
              photoURL: repairedPlayer.photoURL === null ? null : (repairedPlayer.photoURL || user.photoURL || undefined),
              email: user.email || repairedPlayer.email || undefined,
              badges: repairedPlayer.badges || ['🏛️ SSC CGL Aspirant'],
              ...(repairedPlayer.practiceFilters || practiceFilters
                ? { practiceFilters: repairedPlayer.practiceFilters || practiceFilters }
                : {}),
            };

            setPlayer(resolvedPlayer);
            rankStore.handleAuthChange(user, resolvedPlayer);
            try {
              localStorage.setItem(getPlayerStorageKey(user.uid), JSON.stringify(resolvedPlayer));
            } catch {}

            // If profile was contaminated or exam updated, push repaired stats to Firestore users & leaderboard
            if (wasRepaired || cloudP.targetExam !== resolvedTargetExam) {
              saveUserProfileFieldsToFirestore(user.uid, resolvedPlayer, user).catch(() => {});
              syncUserToLeaderboard(resolvedPlayer, user.uid).catch(() => {});
            }

            if (cloudP.practiceFilters) {
              setPracticeFilters(cloudP.practiceFilters);
              try {
                localStorage.setItem('vocabclash_pyq_filter_pref', JSON.stringify(cloudP.practiceFilters));
              } catch {}
            }

            if (cloudData.subscription) setSubscription(cloudData.subscription);

            const isChinmoyUser = 
              user.email?.toLowerCase() === 'nathchinmoy777@gmail.com' ||
              user.email?.toLowerCase().includes('nathchinmoy777');

            // Intelligently merge streak states across devices using union of active days
            const mergedStreak = mergeStreakStates(streak, cloudData.streak, getTodayDateString(), user.email);

            if (cloudData.savedWords && cloudData.savedWords.length > 0) {
              const sanitizedCloud = sanitizeVaultList(cloudData.savedWords);
              setSavedWords(sanitizedCloud);
            }
            if (cloudData.dailyTarget) {
              const todayStr = new Date().toISOString().slice(0, 10);
              if (cloudData.dailyTarget.date === todayStr) {
                saveDailyTargetState(cloudData.dailyTarget);
              }
            }
            // Safely merge cloud challenge history with user local records without ever wiping
            const cloudHistory = Array.isArray(cloudData.dailyChallengeHistory) ? cloudData.dailyChallengeHistory : [];
            const mergedHistory = mergeDailyChallengeHistory(cloudHistory, user.uid);

            // Ingest all completed genuine challenge dates into streak history to ensure streak integrity
            for (const attempt of mergedHistory) {
              if (attempt?.date) {
                mergedStreak.history[attempt.date] = true;
              }
            }
            const recalc = calculateStreakFromHistory(mergedStreak.history);
            mergedStreak.currentStreak = Math.max(mergedStreak.currentStreak, recalc.currentStreak);
            mergedStreak.longestStreak = Math.max(mergedStreak.longestStreak, recalc.longestStreak);

            if (isChinmoyUser) {
              mergedStreak.history['2026-09-15'] = true;
              mergedStreak.history['2026-09-16'] = true;
              mergedStreak.currentStreak = Math.max(mergedStreak.currentStreak, 2);
              mergedStreak.longestStreak = Math.max(mergedStreak.longestStreak, 4);
              mergedStreak.lastActiveDate = '2026-09-16';
            }

            setStreak(mergedStreak);
            saveStreakState(mergedStreak);

            // Asynchronously write clean repaired data back to Firestore in background without blocking UI
            saveUserDataToFirestore(
              user.uid,
              { 
                player: resolvedPlayer, 
                subscription: cloudData.subscription || subscription, 
                streak: mergedStreak, 
                savedWords: (cloudData.savedWords && cloudData.savedWords.length > 0) ? cloudData.savedWords : savedWords,
                dailyTarget: cloudData.dailyTarget || getDailyTargetState(),
                dailyChallengeHistory: getDailyChallengeHistory(user.uid),
              },
              user
            ).catch((err) => console.warn('Background sync notice:', err));
            syncUserToLeaderboard(resolvedPlayer, user.uid).catch((err) => console.warn('Leaderboard sync notice:', err));
          } else {
            // First time sign-in with Google or Email: Carry over only genuine anonymous guest progress
            const isChinmoy = 
              user.email?.toLowerCase() === 'nathchinmoy777@gmail.com' ||
              user.email?.toLowerCase().includes('nathchinmoy777');

            const isGenuineGuest = 
              !localPlayer.email && 
              typeof localPlayer.id === 'string' && 
              localPlayer.id.startsWith('guest_') && 
              (localPlayer.rankPoints ?? 0) < 300;

            let initialLP = isGenuineGuest ? Math.max(0, localPlayer.rankPoints || 0) : 0;
            let initialPYQScore = isGenuineGuest ? (localPlayer.pyqScore || 0) : 0;
            let initialMatches = isGenuineGuest ? (localPlayer.matchesPlayed || 0) : 0;
            let initialWins = isGenuineGuest ? (localPlayer.matchesWon || 0) : 0;
            let initialWinStreak = isGenuineGuest ? (localPlayer.winStreak || 0) : 0;

            if (isChinmoy) {
              initialLP = 1340;
              initialMatches = Math.max(initialMatches, 32);
              initialWins = Math.max(initialWins, 28);
              initialWinStreak = Math.max(initialWinStreak, 5);
              initialPYQScore = Math.max(initialPYQScore, 730);
            }

            const initialAccuracy = initialMatches > 0 ? Math.round((initialWins / initialMatches) * 100) : 0;
            const initialTier = getTierFromLP(initialLP);
            const initialTierTitle = getTierTitle(initialTier);
            const initialLevel = Math.max(1, localPlayer.level || 1, Math.floor(initialMatches / 3) + 1, isChinmoy ? 12 : 1);

            const resolvedTargetExam = resolveTargetExam(null, localPlayer.targetExam);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('vocabclash_user_chosen_target_exam', resolvedTargetExam);
              } catch {}
            }

            const resolvedNewName = resolvePlayerName({
              cloudName: null,
              localName: localPlayer.name,
              authDisplayName: effectiveAuthDisplayName,
              email: user.email,
            });

            const newPlayer: PlayerProfile = {
              ...INITIAL_PLAYER,
              id: user.uid,
              name: isChinmoy ? 'Chinmoy Nath' : resolvedNewName,
              avatar: localPlayer.avatar || '👨‍💼',
              country: localPlayer.country || 'India',
              countryCode: localPlayer.countryCode || 'IN',
              targetExam: resolvedTargetExam,
              photoURL: user.photoURL || undefined,
              email: user.email || undefined,
              rankPoints: initialLP,
              pyqScore: initialPYQScore,
              tier: initialTier,
              tierTitle: initialTierTitle,
              level: initialLevel,
              matchesPlayed: initialMatches,
              matchesWon: initialWins,
              winStreak: initialWinStreak,
              accuracyRate: initialAccuracy,
              bestCategory: localPlayer.bestCategory || 'synonyms',
              badges: localPlayer.badges || ['🏛️ SSC CGL Aspirant'],
              practiceFilters: localPlayer.practiceFilters || practiceFilters,
            };

            const existingGuestHistory = getDailyChallengeHistory(null);
            const userHistory = mergeDailyChallengeHistory(existingGuestHistory, user.uid);
            setPlayer(newPlayer);
            rankStore.handleAuthChange(user, newPlayer);
            try {
              localStorage.setItem(getPlayerStorageKey(user.uid), JSON.stringify(newPlayer));
            } catch {}

            saveUserDataToFirestore(
              user.uid,
              { 
                player: newPlayer, 
                subscription, 
                streak, 
                savedWords, 
                dailyTarget: getDailyTargetState(),
                dailyChallengeHistory: userHistory,
              },
              user
            ).catch((err) => console.warn('Initial save notice:', err));
            syncUserToLeaderboard(newPlayer, user.uid).catch((err) => console.warn('Leaderboard sync notice:', err));
          }
        } catch (error) {
          console.warn('Session cloud data fetch failed, keeping local state safe:', error);
        } finally {
          setIsSyncing(false);
          setSessionLoaded(true);
        }
      } else {
        // If transitioning from a logged-in user to null (e.g. sign out occurred or token revoked)
        if (previousUserUidRef.current) {
          clearUserDataOnSignOut(previousUserUidRef.current);
          setPlayer({ ...INITIAL_PLAYER });
          setSubscription({ ...INITIAL_SUBSCRIPTION });
          setSavedWords([]);
          setStreak(getInitialStreak());
        }
        rankStore.handleLogout(previousUserUidRef.current);
        previousUserUidRef.current = null;
        setCurrentUser(null);
        questionReviewScheduler.setAuthUser(null);
        setIsSyncing(false);
        setSessionLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Synchronize player state into global rank store on initial mount
  useEffect(() => {
    rankStore.updatePlayer(player);
  }, []);

  // Save to user-scoped localStorage on change
  useEffect(() => {
    try {
      const key = getPlayerStorageKey(currentUser?.uid || (player.id?.startsWith('guest_') ? null : player.id));
      localStorage.setItem(key, JSON.stringify(player));
    } catch {}
  }, [player, currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VAULT, JSON.stringify(savedWords));
  }, [savedWords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(subscription));
  }, [subscription]);

  useEffect(() => {
    saveStreakState(streak);
  }, [streak]);

  // Sync to Firestore when state changes if user is logged in & session is fully loaded
  useEffect(() => {
    if (currentUser && sessionLoaded && !isSyncing) {
      const timer = setTimeout(() => {
        saveUserDataToFirestore(
          currentUser.uid,
          { 
            player, 
            subscription, 
            streak, 
            savedWords,
            dailyTarget: getDailyTargetState(),
            dailyChallengeHistory: getDailyChallengeHistory(currentUser.uid),
          },
          currentUser
        ).catch(() => {});
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [player, subscription, streak, savedWords, currentUser, sessionLoaded, isSyncing]);

  // Real-time listener for instant cross-device sync (phone <-> laptop / multi-device)
  useEffect(() => {
    if (!currentUser || !sessionLoaded || currentUser.uid === 'default_user') return;
    const unsubscribe = subscribeToUserCloudData(currentUser.uid, (cloudData) => {
      if (cloudData.streak) {
        setStreak(prev => {
          const merged = mergeStreakStates(prev, cloudData.streak, getTodayDateString(), currentUser.email);
          saveStreakState(merged);
          return merged;
        });
      }
      if (cloudData.dailyChallengeHistory && Array.isArray(cloudData.dailyChallengeHistory)) {
        const clean = sanitizeDailyChallengeHistory(cloudData.dailyChallengeHistory, currentUser.uid, currentUser.email);
        setDailyChallengeHistoryForUser(currentUser.uid, clean);
        window.dispatchEvent(new CustomEvent('daily-challenge-updated'));
      }
      if (cloudData.player) {
        setPlayer(prev => {
          if (
            (cloudData.player.rankPoints && cloudData.player.rankPoints !== prev.rankPoints) ||
            (cloudData.player.matchesPlayed && cloudData.player.matchesPlayed > prev.matchesPlayed)
          ) {
            return {
              ...prev,
              rankPoints: Math.max(prev.rankPoints, cloudData.player.rankPoints || 0),
              matchesPlayed: Math.max(prev.matchesPlayed, cloudData.player.matchesPlayed || 0),
              matchesWon: Math.max(prev.matchesWon, cloudData.player.matchesWon || 0),
            };
          }
          return prev;
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser, sessionLoaded]);

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    soundManager.setSoundEnabled(nextVal);
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await saveUserDataToFirestore(
        currentUser.uid,
        { player, subscription, streak, savedWords },
        currentUser
      );
    } catch {}
    setTimeout(() => {
      setIsSyncing(false);
    }, 400);
  };

  // Sign out user: instant non-blocking logout with background sync
  const handleSignOutUser = async () => {
    setIsSyncing(false);
    const userToSignOut = currentUser;

    // 1. Immediately save snapshot in background with max 800ms race so UI is never blocked
    if (userToSignOut) {
      try {
        const currentDailyTarget = getDailyTargetState();
        Promise.race([
          saveUserDataToFirestore(
            userToSignOut.uid,
            { player, subscription, streak, savedWords, dailyTarget: currentDailyTarget },
            userToSignOut
          ),
          new Promise(r => setTimeout(r, 600))
        ]).catch(() => {});

        questionReviewScheduler.flushCloudSync().catch(() => {});
      } catch (err) {
        console.warn('Error saving before sign out:', err);
      }
    }

    // 2. Perform sign out with timeout
    try {
      await Promise.race([
        auth.signOut(),
        new Promise(r => setTimeout(r, 800))
      ]);
    } catch (err) {
      console.warn('Firebase sign out notice:', err);
    }

    // 3. Instantly clear all authenticated user session data and return to guest mode
    clearUserDataOnSignOut(userToSignOut?.uid);
    rankStore.handleLogout(userToSignOut?.uid);
    previousUserUidRef.current = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocabclash_last_active_user_uid');
    }
    setCurrentUser(null);
    questionReviewScheduler.setAuthUser(null);
    setPlayer({ ...INITIAL_PLAYER });
    setSubscription({ ...INITIAL_SUBSCRIPTION });
    setSavedWords([]);
    setStreak(getInitialStreak());
    setIsSyncing(false);
  };

  // Check 10-minute ad trigger safely (never after first duel to protect new user retention)
  const triggerAdIfDue = () => {
    if (!ADS_ENABLED) {
      return;
    }
    if (player.matchesPlayed <= 1) {
      return;
    }
    if (isAdDue(subscription.isPremium, player.matchesPlayed)) {
      setShowAdModal(true);
    }
  };

  // Start matchmaking flow (with offline check)
  const handleStartMatchmaking = (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => {
    if (!networkManager.isOnline()) {
      setShowOfflineWarningModal(true);
      return;
    }
    setMatchMode(mode);
    const opp = generateMatchedOpponent(player.rankPoints, selectedExam, {
      accuracyRate: player.accuracyRate,
      matchesPlayed: player.matchesPlayed,
      pyqScore: player.pyqScore,
    });
    setMatchedOpponent(opp);
    setIsMatchmaking(true);
  };

  const handleOpenFriendLobbyModal = () => {
    if (!networkManager.isOnline()) {
      setShowOfflineWarningModal(true);
      return;
    }
    setShowFriendLobbyModal(true);
  };

  // When matchmaking countdown finishes -> transition to Live Duel
  const handleReadyToFight = (
    finalOpponent: PlayerProfile, 
    isRealPlayer: boolean = false, 
    matchedQuestions?: Question[], 
    sharedRoomId?: string
  ) => {
    const opp = finalOpponent || matchedOpponent;
    if (!opp) return;

    const isFirstTimeMatch = player.matchesPlayed === 0 && matchMode !== 'quick_duel';
    const roundCount = matchMode === 'quick_duel' ? 10 : (isFirstTimeMatch ? 10 : 20);
    
    let questions: Question[];
    if (isRealPlayer && matchedQuestions && matchedQuestions.length > 0) {
      // Authoritative synchronized question list from Real-Time Matchmaker or Friend Lobby
      questions = matchedQuestions;
    } else if (matchMode === 'quick_duel') {
      // Speed Blitz: Exactly 10 unique questions by stable database ID, anti-repetition across sessions
      if (matchedQuestions && matchedQuestions.length > 0) {
        questions = deduplicateAndEnsureCount(matchedQuestions, selectedCategory, selectedExam, 10);
      } else {
        questions = getSpeedBlitzSessionQuestions(selectedCategory, selectedExam, 10);
      }
    } else {
      // Standard / Ranked Duels:
      if (matchedQuestions && matchedQuestions.length > 0) {
        questions = deduplicateAndEnsureCount(matchedQuestions, selectedCategory, selectedExam, roundCount);
      } else if (isFirstTimeMatch && selectedCategory === 'mixed') {
        questions = getFirstMatchQuestions(selectedExam);
      } else {
        questions = getFilteredQuestions(selectedCategory, selectedExam, roundCount);
      }
    }

    const newMatch: MatchState = {
      matchId: sharedRoomId || `match-${Date.now()}`,
      isRealPlayer,
      realRoomId: sharedRoomId,
      mode: matchMode,
      categoryFilter: selectedCategory,
      examFilter: selectedExam,
      opponent: opp,
      questions,
      currentQuestionIndex: 0,
      playerScore: 0,
      opponentScore: 0,
      playerAnswers: [],
      opponentAnswers: [],
      status: 'in_round',
      questionStartTime: Date.now(),
      timeRemainingSec: 15,
      comboStreak: 0,
      opponentCombo: 0,
      activeEmotes: [],
      powerups: {
        fiftyFiftyUsed: false,
        freezeTimeUsed: false,
        hintUsed: false,
      },
      eliminatedOptionIndices: [],
      isTimeFrozen: false,
      hintRevealed: false,
    };

    setMatchedOpponent(opp);
    setMatchState(newMatch);
    setIsMatchmaking(false);
    setIsMatchCompleted(false);

    const matchStartTime = Date.now();
    matchStartTimeRef.current = matchStartTime;

    try {
      recordBattleStarted({
        matchId: newMatch.matchId,
        mode: matchMode,
        isGuest: !currentUser,
        isRealPlayer,
        roundCount: questions.length,
        userId: currentUser?.uid,
        category: selectedCategory,
        exam: selectedExam,
      });
    } catch {}

    // GA4: practice_start for 1v1 Arena match
    trackPracticeStart({
      practice_type: '1v1',
      category: normalizeAnalyticsCategory(selectedCategory),
      exam_family: normalizeAnalyticsExamFamily(selectedExam),
    });
  };

  // Automatic streak tracking: solving at least 1 question daily advances or starts the streak
  // Immediately persists to both local storage and cloud database to sync with all devices!
  const handleRecordQuestionSolved = useCallback(() => {
    setStreak(prev => {
      const { updatedStreak } = recordDailyQuestionSolved(prev);
      saveStreakState(updatedStreak);
      if (currentUser && currentUser.uid !== 'default_user') {
        saveUserDataToFirestore(
          currentUser.uid,
          { 
            player, 
            subscription, 
            streak: updatedStreak, 
            savedWords,
            dailyTarget: getDailyTargetState(),
            dailyChallengeHistory: getDailyChallengeHistory(),
          },
          currentUser
        ).catch((err) => console.warn('[Streak Firestore Sync Notice]:', err));
      }
      return updatedStreak;
    });
    // Also track towards user's daily question target
    recordQuestionSolvedForDailyTarget(1);
  }, [currentUser, player, subscription, savedWords]);

  // Global question solved listener: fires whenever a question is answered anywhere in the app
  useEffect(() => {
    const onQuestionSolvedEvent = () => {
      handleRecordQuestionSolved();
    };
    window.addEventListener('vocabclash:question-solved', onQuestionSolvedEvent);
    return () => {
      window.removeEventListener('vocabclash:question-solved', onQuestionSolvedEvent);
    };
  }, [handleRecordQuestionSolved]);

  // Reward LP directly from Daily Targets or bonuses
  const handleRewardLP = (lpDelta: number) => {
    setPlayer(prev => {
      const newLP = Math.max(100, prev.rankPoints + lpDelta);
      const newTier = getTierFromLP(newLP);
      const newTierTitle = getTierTitle(newTier);
      const updated: PlayerProfile = {
        ...prev,
        rankPoints: newLP,
        tier: newTier,
        tierTitle: newTierTitle,
      };
      if (currentUser) {
        saveUserDataToFirestore(
          currentUser.uid,
          { player: updated, subscription, streak, savedWords },
          currentUser
        ).catch(err => console.warn('Instant cloud save after reward LP failed:', err));
      }
      return updated;
    });
  };

  // Called each time a question round completes
  const handleAnswerQuestion = (
    playerAns: PlayerAnswerRecord,
    opponentAns: PlayerAnswerRecord,
    scores: { playerScore: number; opponentScore: number; combo: number; opponentCombo: number }
  ) => {
    if (!matchState) return;

    // Automatically count question towards today's daily streak and daily target
    handleRecordQuestionSolved();

    const currentQ = matchState.questions[matchState.currentQuestionIndex];
    if (currentQ) {
      recordQuestionAttempt({
        isCorrect: playerAns.isCorrect,
        responseTimeMs: playerAns.timeTakenMs,
        category: currentQ.category,
        pyqPoints: playerAns.isCorrect ? 10 : 0,
        questionId: currentQ.id,
        conceptKey: currentQ.wordOrPhrase || currentQ.memoryKey || currentQ.question,
        source: 'battle',
      });

      // GA4: question_answered for 1v1 Arena duel round
      trackQuestionAnswered({
        practice_type: '1v1',
        category: normalizeAnalyticsCategory(currentQ.category || selectedCategory),
        exam_family: normalizeAnalyticsExamFamily((currentQ as any)?.examTag || selectedExam),
        correct: playerAns.isCorrect,
      });
    }

    // Automatically add incorrect questions to Mistake Vault (WITHOUT marking as Saved)
    if (!playerAns.isCorrect && currentQ) {
      handleRecordMistake(currentQ);
    }

    setMatchState(prev => {
      if (!prev) return null;
      const nextIndex = prev.currentQuestionIndex + 1;
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        playerScore: scores.playerScore,
        opponentScore: scores.opponentScore,
        comboStreak: scores.combo,
        opponentCombo: scores.opponentCombo,
        playerAnswers: [...prev.playerAnswers, playerAns],
        opponentAnswers: [...prev.opponentAnswers, opponentAns],
      };
    });
  };

  // Called when all rounds of the duel complete (Never during rounds)
  const handleCompleteMatch = (
    authoritativeResult?: LiveRoomFinalResult,
    finalScores?: { playerScore: number; opponentScore: number; combo?: number; opponentCombo?: number }
  ) => {
    if (!matchState) return;

    let finalPlayerScore = finalScores?.playerScore ?? matchState.playerScore;
    let finalOpponentScore = finalScores?.opponentScore ?? matchState.opponentScore;
    const finalComboStreak = finalScores?.combo ?? matchState.comboStreak;
    const finalOpponentCombo = finalScores?.opponentCombo ?? matchState.opponentCombo;

    // Direct, definitive winner determination based on scores
    let isWinner = finalPlayerScore > finalOpponentScore;
    let isDraw = !isWinner && finalPlayerScore === finalOpponentScore;

    // If authoritative result explicitly designated winner and scores are tied, use it
    if (authoritativeResult?.finalised) {
      if (authoritativeResult.winnerId === player.id && !isWinner) {
        isWinner = true;
        isDraw = false;
      } else if (authoritativeResult.winnerId === 'draw' && finalPlayerScore === finalOpponentScore) {
        isDraw = true;
        isWinner = false;
      }
    }

    const lpDelta = isWinner ? 30 + (finalComboStreak > 2 ? 5 : 0) : isDraw ? 5 : -15;

    const newLP = Math.max(100, player.rankPoints + lpDelta);
    const newTier = getTierFromLP(newLP);
    const newTierTitle = getTierTitle(newTier);

    const nextMatchesPlayed = player.matchesPlayed + 1;
    const nextMatchesWon = isWinner ? player.matchesWon + 1 : player.matchesWon;
    const nextWinStreak = isWinner ? player.winStreak + 1 : 0;
    const nextAccuracy = Math.round((nextMatchesWon / nextMatchesPlayed) * 100);
    const nextLevel = Math.max(1, Math.floor(nextMatchesPlayed / 3) + 1);

    const updatedPlayer: PlayerProfile = {
      ...player,
      rankPoints: newLP,
      tier: newTier,
      tierTitle: newTierTitle,
      matchesPlayed: nextMatchesPlayed,
      matchesWon: nextMatchesWon,
      winStreak: nextWinStreak,
      accuracyRate: nextAccuracy,
      level: nextLevel,
    };

    setPlayer(updatedPlayer);
    rankStore.handleBattleCompleted(updatedPlayer, currentUser?.uid);
    syncUserToLeaderboard(updatedPlayer, currentUser?.uid).catch(() => {});

    setMatchState(prev => prev ? {
      ...prev,
      playerScore: finalPlayerScore,
      opponentScore: finalOpponentScore,
      comboStreak: finalComboStreak,
      opponentCombo: finalOpponentCombo,
      finalResult: authoritativeResult,
    } : null);

    setIsMatchCompleted(true);

    if (matchState) {
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - (matchStartTimeRef.current || matchState.questionStartTime || Date.now())) / 1000)
      );
      try {
        recordBattleCompleted({
          matchId: matchState.matchId,
          mode: (matchState.mode as any) || '1v1_ranked',
          isGuest: !currentUser,
          isRealPlayer: Boolean(matchState.isRealPlayer),
          roundCount: matchState.questions?.length || 5,
          questionsAnswered: matchState.playerAnswers?.length || 5,
          durationSec,
          outcome: isWinner ? 'win' : isDraw ? 'draw' : 'loss',
          playerScore: finalPlayerScore,
          opponentScore: finalOpponentScore,
          userId: currentUser?.uid,
        });

        // Record to local 30-day battle history
        battleHistoryService.recordMatch({
          id: matchState.matchId,
          timestamp: Date.now(),
          mode: (matchState.mode as any) || '1v1_ranked',
          category: matchState.categoryFilter,
          exam: matchState.examFilter,
          playerScore: finalPlayerScore,
          opponentScore: finalOpponentScore,
          opponentName: matchState.opponent?.name || 'Opponent',
          opponentAvatar: matchState.opponent?.avatar,
          isWin: isWinner,
          isDraw: isDraw,
          lpDelta,
        });
      } catch {}

      const totalAns = matchState.playerAnswers.length;
      const correctAns = matchState.playerAnswers.filter(a => a.isCorrect).length;
      const accuracy = Math.round((correctAns / Math.max(1, totalAns)) * 100);
      trackPracticeComplete({
        practice_type: '1v1',
        questions_answered: totalAns,
        correct_count: correctAns,
        accuracy,
      });
    }

    // Immediately persist match results to Firestore if user is signed in
    if (currentUser) {
      saveUserDataToFirestore(
        currentUser.uid,
        { player: updatedPlayer, subscription, streak, savedWords },
        currentUser
      ).catch(err => console.warn('Instant cloud save after match completion failed:', err));
    }

    // Trigger 10-min interval ad safely after match completion (only for free tier)
    // NEVER show ad after the user's first duel (to maximize new player retention)
    if (ADS_ENABLED) {
      const isFirstDuel = player.matchesPlayed === 0 || nextMatchesPlayed <= 1;
      if (isFirstDuel) {
        // Cleanly start their ad timer cooldown so they get a full grace period going forward
        recordAdShown();
      } else if (isAdDue(subscription.isPremium, nextMatchesPlayed)) {
        setTimeout(() => {
          setShowAdModal(true);
        }, 700);
      }
    }
  };

  // Record question mistake in vault (does NOT mark as Saved/Bookmarked)
  const handleRecordMistake = (q: Question) => {
    setSavedWords(prev => recordMistakeInVault(prev, q));
  };

  // Explicit user bookmark/save action (toggles Saved status independently of Mistakes)
  const handleBookmarkQuestion = (q: Question) => {
    soundManager.playTap();
    setSavedWords(prev => toggleSaveInVault(prev, q).updatedVault);
  };

  // Toggle user Saved status from MistakeVault or other views
  const handleToggleUserSaved = (questionId: string, question?: Question) => {
    soundManager.playTap();
    setSavedWords(prev => {
      const targetQ = question || prev.find(item => item.question.id === questionId)?.question;
      if (!targetQ) return prev;
      return toggleSaveInVault(prev, targetQ).updatedVault;
    });
  };

  // Remove word according to active scope (mistakes only, saved only, or all)
  const handleRemoveSavedWord = (questionId: string, scope?: 'all' | 'saved_by_me' | 'mistakes') => {
    soundManager.playTap();
    setSavedWords(prev => removeVaultItem(prev, questionId, scope));
  };

  const handleOpenAiTutor = (q: Question) => {
    setActiveAiQuestion(q);
    setShowAiModal(true);
  };

  const handleStartSscTop100Drill = (cat: SscTop100Category, resumeIndex = 0, initialCorrect = 0) => {
    soundManager.playTap();
    // GA4: top100_start and practice_start
    trackTop100Start(cat, resumeIndex);
    trackPracticeStart({
      practice_type: 'ssc_top100',
      category: normalizeAnalyticsCategory(cat),
      exam_family: 'ssc',
    });
    const questions = getTop100Questions(cat);
    setActiveSscTop100Category(cat);
    setSscTop100InitialIndex(resumeIndex);
    setSscTop100InitialCorrect(initialCorrect);
    setPracticeCustomBadge('SSC TOP 100');
    saveStoredActiveDrill(null);
    setPracticeCustomQueue(questions);
    const categoryTitle =
      cat === 'synonyms' ? 'Synonyms Drill' :
      cat === 'antonyms' ? 'Antonyms Drill' :
      cat === 'ows' ? 'One Word Substitutions Drill' :
      'Idioms & Phrases Drill';
    setPracticeModeBannerTitle(categoryTitle);
    setCurrentTab('practice');
  };

  const handleSendEmote = (emoji: string) => {
    if (!matchState) return;
    setMatchState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        activeEmotes: [
          ...prev.activeEmotes,
          { sender: 'player', emoji, timestamp: Date.now() },
        ],
      };
    });
  };

  const handleLeaveMatch = () => {
    soundManager.playWrong();

    // If leaving an active match in progress, penalize with -15 LP and reset win streak
    if (matchState && !isMatchCompleted) {
      try {
        recordBattleAbandoned({
          matchId: matchState.matchId,
          mode: (matchState.mode as any) || '1v1_ranked',
          isGuest: !currentUser,
          isRealPlayer: Boolean(matchState.isRealPlayer),
          roundCount: matchState.questions.length,
          currentQuestionIndex: matchState.currentQuestionIndex,
          questionsAnswered: matchState.playerAnswers.length,
          reason: 'forfeit',
          userId: currentUser?.uid,
        });

        // Record to local 30-day battle history as loss
        battleHistoryService.recordMatch({
          id: matchState.matchId,
          timestamp: Date.now(),
          mode: (matchState.mode as any) || '1v1_ranked',
          category: matchState.categoryFilter,
          exam: matchState.examFilter,
          playerScore: matchState.playerScore,
          opponentScore: matchState.opponentScore,
          opponentName: matchState.opponent?.name || 'Opponent',
          opponentAvatar: matchState.opponent?.avatar,
          isWin: false,
          isDraw: false,
          lpDelta: -15,
        });
      } catch {}

      const forfeitPenalty = -15;
      const newLP = Math.max(0, player.rankPoints + forfeitPenalty);
      const newTier = getTierFromLP(newLP);
      const newTierTitle = getTierTitle(newTier);

      const nextMatchesPlayed = (player.matchesPlayed || 0) + 1;
      const nextMatchesWon = player.matchesWon || 0; // Won matches remain unchanged, increasing loss count
      const nextAccuracy = Math.round((nextMatchesWon / nextMatchesPlayed) * 100);

      const updatedPlayer: PlayerProfile = {
        ...player,
        rankPoints: newLP,
        tier: newTier,
        tierTitle: newTierTitle,
        matchesPlayed: nextMatchesPlayed,
        matchesWon: nextMatchesWon,
        winStreak: 0, // Forfeiting breaks active win streak
        accuracyRate: nextAccuracy,
      };

      setPlayer(updatedPlayer);
      rankStore.handleBattleCompleted(updatedPlayer, currentUser?.uid);

      // Instantly persist penalty to Firestore if user is authenticated
      if (currentUser) {
        saveUserDataToFirestore(
          currentUser.uid,
          { player: updatedPlayer, subscription, streak, savedWords },
          currentUser
        ).catch(err => console.warn('Instant cloud save after match forfeit failed:', err));
      }

      // If it's a real live room, broadcast forfeit result to opponent in Firestore
      if (matchState.isRealPlayer && (matchState.realRoomId || matchState.matchId)) {
        const rId = matchState.realRoomId || matchState.matchId;
        forfeitLiveRoom(rId, player.id, matchState.opponent?.id).catch(err => console.warn('Failed to broadcast room forfeit:', err));
      }

      // Display floating forfeit penalty notification
      setForfeitNotice('⚠️ Match Forfeited (Counted as Loss): -15 LP deducted & win streak reset');
      setTimeout(() => {
        setForfeitNotice(null);
      }, 4500);
    }

    setMatchState(null);
    setIsMatchCompleted(false);
    setCurrentTab('arena');
    triggerAdIfDue();
  };

  const handleTriggerTestAd = () => {
    if (!ADS_ENABLED) return;
    resetAdTimerForTest();
    setShowAdModal(true);
  };

  const handleResetStats = async () => {
    const cleanAuthName = extractCleanUserName(currentUser?.displayName, currentUser?.email);
    const resolvedExam = resolveTargetExam(null, player.targetExam);
    const cleanPlayer: PlayerProfile = {
      id: currentUser ? currentUser.uid : 'user-live-1',
      name: cleanAuthName || player.name || 'Govt Aspirant',
      avatar: player.avatar || '👨‍💼',
      country: 'India',
      countryCode: 'IN',
      targetExam: resolvedExam,
      photoURL: currentUser?.photoURL || player.photoURL || undefined,
      email: currentUser?.email || player.email || undefined,
      rankPoints: 0,
      pyqScore: 0,
      tier: 'Aspirant',
      tierTitle: '🥉 Govt Job Aspirant',
      level: 1,
      matchesPlayed: 0,
      matchesWon: 0,
      winStreak: 0,
      accuracyRate: 0,
      bestCategory: player.bestCategory || 'synonyms',
      badges: ['🏛️ SSC CGL Aspirant'],
    };

    setPlayer(cleanPlayer);
    rankStore.updatePlayer(cleanPlayer);

    if (currentUser) {
      setIsSyncing(true);
      await saveUserDataToFirestore(
        currentUser.uid,
        { player: cleanPlayer, subscription, streak, savedWords },
        currentUser
      );
      setIsSyncing(false);
    }
  };

  const handleUpdatePlayerProfile = async (updated: Partial<PlayerProfile>) => {
    const updatedTargetExam = updated.targetExam
      ? updated.targetExam
      : resolveTargetExam(null, player.targetExam);

    if (updated.targetExam && typeof window !== 'undefined') {
      try {
        localStorage.setItem('vocabclash_user_chosen_target_exam', updated.targetExam);
      } catch {}
    }

    const updatedPlayer: PlayerProfile = {
      ...player,
      ...updated,
      targetExam: updatedTargetExam,
    };

    setPlayer(updatedPlayer);
    rankStore.updatePlayer(updatedPlayer);

    try {
      const key = getPlayerStorageKey(currentUser?.uid || player.id);
      localStorage.setItem(key, JSON.stringify(updatedPlayer));
    } catch { /* storage quota */ }

    // Fast asynchronous sync to Firestore users and leaderboard collections
    if (currentUser && !currentUser.isAnonymous) {
      try {
        await Promise.all([
          saveUserProfileFieldsToFirestore(currentUser.uid, updatedPlayer, currentUser),
          syncUserToLeaderboard(updatedPlayer, currentUser.uid),
        ]);
      } catch (err) {
        console.warn('Fast profile sync notice:', err);
      }
    }
  };

  const handleAddLP = (amount: number) => {
    setPlayer(prev => {
      const newLP = prev.rankPoints + amount;
      const newTier = getTierFromLP(newLP);
      const newTierTitle = getTierTitle(newTier);
      const updated = {
        ...prev,
        rankPoints: newLP,
        tier: newTier,
        tierTitle: newTierTitle,
      };
      rankStore.updatePlayer(updated);
      return updated;
    });
  };

  const handleUpdatePyqScore = (delta: number) => {
    setPlayer(prev => {
      const currentScore = typeof prev.pyqScore === 'number' ? prev.pyqScore : 0;
      const newScore = Math.max(0, currentScore + delta);
      const updated: PlayerProfile = {
        ...prev,
        pyqScore: newScore,
      };
      if (currentUser) {
        saveUserDataToFirestore(
          currentUser.uid,
          { player: updated, subscription, streak, savedWords },
          currentUser
        ).catch(err => console.warn('Cloud save after PYQ score update failed:', err));
      }
      return updated;
    });
  };

  const bookmarkedIds = savedWords.filter(w => isItemSaved(w)).map(w => w.question.id);
  const activeMistakeCount = savedWords.filter(w => isItemMistake(w)).length;
  const activeSeoPage = activeSeoSlug ? SEO_PAGES[activeSeoSlug.replace(/^\//, '')] : null;

  // Handler for practice CTAs originating from articles
  const handleStartPracticeFromArticle = (route: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
    const r = (route || '').toLowerCase();
    if (r.includes('mistake') || r.includes('vault')) {
      setCurrentTab('mistakes');
    } else if (r.includes('1v1') || r.includes('arena') || r.includes('duel')) {
      setCurrentTab('arena');
      setShowPlayModeModal(true);
    } else {
      setCurrentTab('practice');
    }
  };

  // 1. Render Admin Article Studio (/admin/articles)
  if (showAdminArticles) {
    if (adminArticleMode === 'editor') {
      return (
        <>
          <StartupSplashOverlay />
          <ArticleEditor
            initialArticle={editingArticle}
            onBack={() => {
              setAdminArticleMode('dashboard');
              setEditingArticle(null);
            }}
            onSaved={() => {
              setAdminArticleMode('dashboard');
              setEditingArticle(null);
            }}
          />
        </>
      );
    }
    return (
      <>
        <StartupSplashOverlay />
        <ArticlesDashboard
          onNewArticle={() => {
            setEditingArticle(null);
            setAdminArticleMode('editor');
          }}
          onEditArticle={(art) => {
            setEditingArticle(art);
            setAdminArticleMode('editor');
          }}
          onPreviewArticle={(art) => {
            setShowAdminArticles(false);
            setActiveArticleSlug(art.slug);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/articles/${art.slug}`);
            }
          }}
          onBackToApp={() => {
            setShowAdminArticles(false);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
          }}
          currentUserEmail={currentUser?.email || null}
        />
      </>
    );
  }

  // 2. Render Public Crawlable Article Detail Page (/articles/:slug)
  if (activeArticleSlug) {
    return (
      <>
        <StartupSplashOverlay />
        <PublicArticleDetail
          articleSlug={activeArticleSlug}
          onNavigateHome={() => {
            setActiveArticleSlug(null);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
            setCurrentTab('arena');
          }}
          onNavigateToArticles={() => {
            setActiveArticleSlug(null);
            setIsViewingArticlesIndex(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/articles');
            }
          }}
          onNavigateToSlug={(slug) => {
            setActiveArticleSlug(slug);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/articles/${slug}`);
            }
          }}
          onStartPractice={(route) => {
            setActiveArticleSlug(null);
            handleStartPracticeFromArticle(route);
          }}
        />
      </>
    );
  }

  // 3. Render Public Articles Index Listing (/articles)
  if (isViewingArticlesIndex) {
    return (
      <>
        <StartupSplashOverlay />
        <PublicArticlesIndex
          onSelectArticle={(slug) => {
            setIsViewingArticlesIndex(false);
            setActiveArticleSlug(slug);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/articles/${slug}`);
            }
          }}
          onNavigateHome={() => {
            setIsViewingArticlesIndex(false);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
            setCurrentTab('arena');
          }}
          onStartPractice={(route) => {
            setIsViewingArticlesIndex(false);
            handleStartPracticeFromArticle(route);
          }}
          isAdmin={isUserAdmin(currentUser?.email)}
          onNavigateToAdmin={() => {
            setIsViewingArticlesIndex(false);
            setShowAdminArticles(true);
            setAdminArticleMode('dashboard');
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/articles');
            }
          }}
        />
      </>
    );
  }

  // 4. Render Public Crawlable SEO Page when URL matches any of the 8 SEO topic hubs
  if (activeSeoPage) {
    return (
      <>
        <StartupSplashOverlay />
        <SeoPublicPage
          pageData={activeSeoPage}
          onNavigateHome={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
            setActiveSeoSlug(null);
            setCurrentTab('arena');
          }}
          onStartBattle={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
            setActiveSeoSlug(null);
            setCurrentTab('arena');
            setShowPlayModeModal(true);
          }}
          onStartPractice={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/');
            }
            setActiveSeoSlug(null);
            setCurrentTab('practice');
          }}
          onNavigateToSlug={(slug) => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', slug);
            }
            setActiveSeoSlug(slug);
          }}
        />
      </>
    );
  }

  return (
    <AndroidDeviceShell>
      {/* Desktop Navigation Sidebar (Visible only on md+ screens when not in live match) */}
      {!matchState && (
        <DesktopSidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (currentTab === 'practice' && tab !== 'practice') {
              triggerAdIfDue();
            }
            setCurrentTab(tab);
          }}
          player={player}
          subscription={subscription}
          dailyStreak={streak}
          currentUser={currentUser}
          mistakeCount={activeMistakeCount}
          onOpenProfile={() => {
            soundManager.playTap();
            setShowProfileModal(true);
          }}
          onOpenPremium={() => {
            soundManager.playTap();
            setShowPremiumModal(true);
          }}
          onOpenStreak={() => {
            soundManager.playTap();
            setShowStreakModal(true);
          }}
          onOpenStats={() => {
            soundManager.playTap();
            setShowStatsModal(true);
          }}
          onOpenAppGuide={() => {
            soundManager.playTap();
            setShowAppGuideModal(true);
          }}
          onOpenTour={() => {
            soundManager.playTap();
            setShowTourModal(true);
          }}
          onOpenGuides={() => {
            soundManager.playTap();
            setShowSeoGuidesModal(true);
          }}
          onOpenArticles={() => {
            soundManager.playTap();
            setIsViewingArticlesIndex(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/articles');
            }
          }}
          isAdmin={(currentUser?.email?.toLowerCase() === 'nathchinmoy777@gmail.com' || (currentUser?.email && currentUser.email.toLowerCase().includes('admin')))}
          onOpenAdminArticles={() => {
            soundManager.playTap();
            setShowAdminArticles(true);
            setAdminArticleMode('dashboard');
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/articles');
            }
          }}
          onOpenAdminImporter={() => {
            soundManager.playTap();
            setShowAdminImporter(true);
          }}
        />
      )}

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative w-full">
        {/* Top App Bar */}
        <TopBar
          player={player}
          subscription={subscription}
          dailyStreak={streak}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onOpenProfile={() => {
            soundManager.playTap();
            setShowProfileModal(true);
          }}
          onOpenPremium={() => {
            soundManager.playTap();
            setShowPremiumModal(true);
          }}
          onOpenStreak={() => {
            soundManager.playTap();
            setShowStreakModal(true);
          }}
          onOpenStats={() => {
            soundManager.playTap();
            setShowStatsModal(true);
          }}
          onOpenTour={() => {
            soundManager.playTap();
            setShowTourModal(true);
          }}
          isAdmin={(currentUser?.email?.toLowerCase() === 'nathchinmoy777@gmail.com' || (currentUser?.email && currentUser.email.toLowerCase().includes('admin')))}
          onOpenBattleAnalytics={() => {
            soundManager.playTap();
            setShowBattleAnalytics(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/analytics');
            }
          }}
          onOpenAdminArticles={() => {
            soundManager.playTap();
            setShowAdminArticles(true);
            setAdminArticleMode('dashboard');
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/articles');
            }
          }}
          onOpenAdminImporter={() => {
            soundManager.playTap();
            setShowAdminImporter(true);
          }}
        />

        {/* Forfeit Penalty Notification Banner with Smooth Fade In & Fade Out */}
        <AnimatePresence>
          {forfeitNotice && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full bg-gradient-to-r from-rose-900/90 via-rose-800/90 to-rose-900/90 border-b border-rose-600/60 px-4 py-2 text-center text-xs font-black text-rose-100 flex items-center justify-center gap-2 shadow-lg backdrop-blur-md z-20 shrink-0"
            >
              <span>{forfeitNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dynamic View Content */}
        <main 
          id="app-main-content" 
          className="flex-1 min-h-0 relative overflow-y-auto flex flex-col custom-scrollbar"
        >
        {matchState ? (
          !isMatchCompleted ? (
            /* Live 1v1 Battle Arena Screen */
            <ErrorBoundary
              componentName="1v1 Battle Arena"
              onReset={() => {
                handleCompleteMatch();
              }}
            >
              <LiveDuelArena
                player={player}
                matchState={matchState}
                onAnswerQuestion={handleAnswerQuestion}
                onCompleteMatch={handleCompleteMatch}
                onSendEmote={handleSendEmote}
                onLeaveMatch={handleLeaveMatch}
              />
            </ErrorBoundary>
          ) : (
            /* Post-Match Summary & Detailed Question Review */
            <ErrorBoundary 
              componentName="1v1 Battle Result Summary"
              onReset={() => {
                setMatchState(null);
                setIsMatchCompleted(false);
                setCurrentTab('arena');
              }}
            >
              <MatchSummary
                player={player}
                matchState={matchState}
                onPlayAgain={() => {
                  setMatchState(null);
                  setIsMatchCompleted(false);
                  handleStartMatchmaking(matchMode);
                }}
                onBackToLobby={() => {
                  setMatchState(null);
                  setIsMatchCompleted(false);
                  setCurrentTab('arena');
                  triggerAdIfDue();
                }}
                onBookmarkQuestion={handleBookmarkQuestion}
                onOpenAiDeepDive={handleOpenAiTutor}
                onNavigateToMistakes={() => {
                  setMatchState(null);
                  setIsMatchCompleted(false);
                  setCurrentTab('mistakes');
                }}
                bookmarkedIds={bookmarkedIds}
                isPremium={subscription.isPremium}
                currentUser={currentUser}
                onUserChange={user => setCurrentUser(user)}
              />
            </ErrorBoundary>
          )
        ) : (
          /* Regular Tab Views */
          <>
            {currentTab === 'arena' && (
              <ArenaHome
                player={player}
                subscription={subscription}
                dailyStreak={streak}
                savedWords={savedWords}
                selectedCategory={selectedCategory}
                selectedExam={selectedExam}
                currentUser={currentUser}
                isAdmin={Boolean(
                  currentUser?.email === 'Nathchinmoy777@gmail.com' ||
                  (currentUser?.email && currentUser.email.toLowerCase().includes('admin'))
                )}
                onSelectCategory={setSelectedCategory}
                onSelectExam={handleSelectExam}
                onStartMatchmaking={handleStartMatchmaking}
                onOpenPlayModeSelector={() => setShowPlayModeModal(true)}
                onOpenFriendLobby={() => {
                  setFriendLobbyInitialCode('');
                  handleOpenFriendLobbyModal();
                }}
                onOpenPremium={() => setShowPremiumModal(true)}
                onOpenStreak={() => setShowStreakModal(true)}
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenEditProfile={() => {
                  setEditProfileReturnToProfile(false);
                  setShowEditProfileModal(true);
                }}
                onOpenTour={() => setShowTourModal(true)}
                onOpenAppGuide={() => setShowAppGuideModal(true)}
                onNavigateTab={setCurrentTab}
                onRewardLP={handleRewardLP}
                onTriggerTestAd={handleTriggerTestAd}
                onStartSscTop100Drill={handleStartSscTop100Drill}
                onStartDueRevision={handleStartDueRevision}
              />
            )}

            <div
              id="practice-tab-container"
              className={currentTab === 'practice' ? 'block' : 'hidden'}
            >
              <PracticeMode
                isActive={currentTab === 'practice'}
                pyqScore={player.pyqScore || 0}
                category={practiceFilters.category}
                exam={practiceFilters.exam}
                onFilterChange={handleUpdatePracticeFilter}
                onUpdatePyqScore={handleUpdatePyqScore}
                onBookmarkQuestion={handleBookmarkQuestion}
                onOpenAiTutor={handleOpenAiTutor}
                onOpenStats={() => {
                  soundManager.playTap();
                  setShowStatsModal(true);
                }}
                onBatchComplete={triggerAdIfDue}
                onSolveQuestion={handleRecordQuestionSolved}
                onRecordMistake={handleRecordMistake}
                bookmarkedIds={bookmarkedIds}
                isPremium={subscription.isPremium}
                currentUser={currentUser}
                onUserChange={user => setCurrentUser(user)}
                customTargetQueue={practiceCustomQueue}
                customSessionTitle={practiceModeBannerTitle}
                customInitialIndex={activeSscTop100Category ? sscTop100InitialIndex : 0}
                customInitialCorrectCount={activeSscTop100Category ? sscTop100InitialCorrect : 0}
                customBadge={activeSscTop100Category ? 'SSC TOP 100' : (practiceCustomBadge || (practiceCustomQueue ? 'WEAK AREAS DRILL' : null))}
                attemptSource={activeSscTop100Category ? 'ssc_top100' : (practiceCustomQueue ? 'weak_areas' : 'practice')}
                onCustomQueueQuestionAnswered={(q, isCorrect, index) => {
                  if (activeSscTop100Category) {
                    recordSscTop100Answer(
                      currentUser?.uid || player.id,
                      activeSscTop100Category,
                      q.id,
                      isCorrect,
                      index
                    );
                  }
                }}
                onCustomDrillCompleted={(results) => {
                  if (activeSscTop100Category) {
                    const cat = activeSscTop100Category;
                    const effectiveCorrect = Math.min(100, (sscTop100InitialCorrect || 0) + results.filter(r => r.isCorrect).length);
                    const mistakeCount = Math.max(0, 100 - effectiveCorrect);
                    const accuracy = Math.round((effectiveCorrect / 100) * 100);
                    const score = (effectiveCorrect * 10) - (mistakeCount * 2);

                    // GA4: top100_complete and practice_complete for SSC Top 100
                    trackTop100Complete(cat, effectiveCorrect, accuracy);
                    trackPracticeComplete({
                      practice_type: 'ssc_top100',
                      questions_answered: 100,
                      correct_count: effectiveCorrect,
                      accuracy,
                    });

                    markSscTop100CategoryCompleted(currentUser?.uid || player.id, cat);

                    setSscTop100SummaryData({
                      category: cat,
                      score,
                      accuracy,
                      mistakeCount,
                      totalSolved: 100,
                    });
                    setShowSscTop100CompletionModal(true);
                  }
                }}
                onRestartCustomDrill={async () => {
                  if (activeSscTop100Category) {
                    const cat = activeSscTop100Category;
                    const uid = currentUser?.uid || player.id;
                    await sscTop100Service.resetUserProgress(uid, cat);
                    handleStartSscTop100Drill(cat, 0, 0);
                  } else if (practiceCustomQueue) {
                    saveStoredActiveDrill(null);
                    const exam = (player.targetExam as ExamType) || 'SSC_CGL';
                    const freshAnalytics = calculateMentorAnalytics('week', player, streak, savedWords);
                    const drillQuestions = buildWeakAreasDrillQuestions(freshAnalytics, exam, 10);
                    const weakName = freshAnalytics.weakestCategory
                      ? freshAnalytics.categoryStats[freshAnalytics.weakestCategory]?.name
                      : 'Priority Vocab';
                    setPracticeCustomBadge('WEAK AREAS DRILL');
                    setPracticeCustomQueue(drillQuestions);
                    setPracticeModeBannerTitle(`Weak Areas Drill · ${weakName}`);
                  }
                }}
                onReviewMistakes={() => {
                  setPracticeCustomQueue(null);
                  setPracticeModeBannerTitle(null);
                  setPracticeCustomBadge(null);
                  saveStoredActiveDrill(null);
                  setActiveSscTop100Category(null);
                  setSscTop100InitialIndex(0);
                  setSscTop100InitialCorrect(0);
                  setCurrentTab('mistakes');
                }}
                onExitCustomQueue={() => {
                  setPracticeCustomQueue(null);
                  setPracticeModeBannerTitle(null);
                  setPracticeCustomBadge(null);
                  saveStoredActiveDrill(null);
                  const wasTop100 = activeSscTop100Category !== null;
                  setActiveSscTop100Category(null);
                  setSscTop100InitialIndex(0);
                  setSscTop100InitialCorrect(0);
                  setCurrentTab(wasTop100 ? 'arena' : 'ai_coach');
                }}
                showFilterGuidance={shouldShowPyqFilterGuidance}
                onFilterGuidanceDismissed={() => {
                  setShouldShowPyqFilterGuidance(false);
                  try {
                    localStorage.setItem('vocabclash_filter_guided_completed_v1', 'true');
                  } catch {}
                }}
              />
            </div>

            {currentTab === 'leaderboard' && (
              <LeaderboardView player={player} isPremium={subscription.isPremium} />
            )}

            {currentTab === 'mistakes' && (
              <MistakeVault
                savedWords={savedWords}
                userId={currentUser?.uid || player.id}
                onRemoveWord={handleRemoveSavedWord}
                onToggleUserSaved={handleToggleUserSaved}
                onOpenAiTutor={handleOpenAiTutor}
                onGoToArena={() => setCurrentTab('arena')}
                onGoToPractice={() => setCurrentTab('practice')}
              />
            )}

            {currentTab === 'ai_coach' && (
              <AiTutorTab
                player={player}
                streak={streak}
                savedWords={savedWords}
                subscription={subscription}
                onStartTargetedPractice={(drillQuestions, title) => {
                  setActiveSscTop100Category(null);
                  setSscTop100InitialIndex(0);
                  setSscTop100InitialCorrect(0);
                  setPracticeCustomBadge('WEAK AREAS DRILL');
                  saveStoredActiveDrill(null);
                  setPracticeCustomQueue(drillQuestions);
                  setPracticeModeBannerTitle(title);
                  setCurrentTab('practice');
                }}
                onOpenUpgradeModal={() => setShowPremiumModal(true)}
                onBookmarkQuestion={handleBookmarkQuestion}
              />
            )}
          </>
        )}
      </main>

      {/* Play Mode Selection Modal (Online Ranked vs Play with Friend) */}
      {showPlayModeModal && (
        <PlayModeSelectorModal
          player={player}
          selectedCategory={selectedCategory}
          selectedExam={selectedExam}
          currentUser={currentUser}
          onSelectPlayOnline={() => {
            setShowPlayModeModal(false);
            handleStartMatchmaking(player.matchesPlayed === 0 ? 'quick_duel' : '1v1_ranked');
          }}
          onSelectPlayWithFriend={() => {
            setShowPlayModeModal(false);
            setFriendLobbyInitialCode('');
            setShowFriendLobbyModal(true);
          }}
          onClose={() => setShowPlayModeModal(false)}
        />
      )}

      {/* Custom 6-Digit Friend Lobby Modal */}
      {showFriendLobbyModal && (
        <FriendLobbyModal
          player={player}
          currentUser={currentUser}
          initialCategory={selectedCategory}
          initialExam={selectedExam}
          initialCode={friendLobbyInitialCode}
          onUserChange={user => setCurrentUser(user)}
          onSelectPlayOnline={() => {
            setShowFriendLobbyModal(false);
            setFriendLobbyInitialCode('');
            handleStartMatchmaking(player.matchesPlayed === 0 ? 'quick_duel' : '1v1_ranked');
          }}
          onClose={() => {
            setShowFriendLobbyModal(false);
            setFriendLobbyInitialCode('');
          }}
          onStartMatch={(opponent, questions, roomId) => {
            setShowFriendLobbyModal(false);
            setFriendLobbyInitialCode('');
            setMatchMode('1v1_ranked');
            handleReadyToFight(opponent, true, questions, roomId);
          }}
        />
      )}

      {/* Matchmaking Radar Modal */}
      {isMatchmaking && (
        <MatchmakingModal
          player={player}
          initialBotOpponent={matchedOpponent || generateMatchedOpponent(player.rankPoints, selectedExam, {
            accuracyRate: player.accuracyRate,
            matchesPlayed: player.matchesPlayed,
            pyqScore: player.pyqScore,
          })}
          mode={matchMode}
          category={selectedCategory}
          exam={selectedExam}
          onCancel={() => setIsMatchmaking(false)}
          onReadyToFight={handleReadyToFight}
          onPlayOffline={() => {
            setIsMatchmaking(false);
            setCurrentTab('practice');
          }}
        />
      )}

      {/* 1v1 Offline Warning Modal */}
      {showOfflineWarningModal && (
        <OfflineWarningModal
          onClose={() => setShowOfflineWarningModal(false)}
          onPlayOfflineDrill={() => {
            setShowOfflineWarningModal(false);
            setCurrentTab('practice');
          }}
          onOpenMistakeVault={() => {
            setShowOfflineWarningModal(false);
            setCurrentTab('mistakes');
          }}
          onConnectionRestored={() => {
            setShowOfflineWarningModal(false);
          }}
        />
      )}

      {/* AI Tutor Deep Dive Modal */}
      {showAiModal && (
        <AiTutorModal
          question={activeAiQuestion}
          onClose={() => setShowAiModal(false)}
          isPremium={subscription.isPremium}
        />
      )}

      {/* Aspirant Profile Modal with Google Auth & Cloud Sync */}
      {showProfileModal && (
        <ProfileModal
          player={player}
          subscription={subscription}
          dailyStreak={streak}
          currentUser={currentUser}
          isSyncing={isSyncing}
          onClose={() => setShowProfileModal(false)}
          onUpdatePlayer={handleUpdatePlayerProfile}
          onResetStats={handleResetStats}
          onOpenPremium={() => {
            setShowProfileModal(false);
            setShowPremiumModal(true);
          }}
          onOpenStreak={() => {
            setShowProfileModal(false);
            setShowStreakModal(true);
          }}
          onOpenStats={() => {
            setShowProfileModal(false);
            setShowStatsModal(true);
          }}
          onOpenTour={() => {
            setShowProfileModal(false);
            setShowTourModal(true);
          }}
          onOpenAppGuide={() => {
            setShowProfileModal(false);
            setShowAppGuideModal(true);
          }}
          onOpenBattleAnalytics={() => {
            setShowProfileModal(false);
            setShowBattleAnalytics(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/analytics');
            }
          }}
          onOpenEditProfile={() => {
            setShowProfileModal(false);
            setEditProfileReturnToProfile(true);
            setShowEditProfileModal(true);
          }}
          onUserChange={user => setCurrentUser(user)}
          onManualSync={handleManualSync}
          onSignOut={handleSignOutUser}
        />
      )}

      {/* 🎯 Direct Edit Profile & Target Exam Modal (linked to CadreRankCard and ProfileModal) */}
      {showEditProfileModal && (
        <EditProfileModal
          player={player}
          currentUser={currentUser}
          onClose={() => {
            setShowEditProfileModal(false);
            if (editProfileReturnToProfile) {
              setEditProfileReturnToProfile(false);
              setShowProfileModal(true);
            }
          }}
          onUpdatePlayer={handleUpdatePlayerProfile}
        />
      )}

      {/* 🔥 SSC TOP 100 100-Question Completion Modal */}
      {showSscTop100CompletionModal && sscTop100SummaryData && (
        <SscTop100CompletionModal
          category={sscTop100SummaryData.category}
          score={sscTop100SummaryData.score}
          accuracy={sscTop100SummaryData.accuracy}
          mistakeCount={sscTop100SummaryData.mistakeCount}
          totalSolved={sscTop100SummaryData.totalSolved}
          onClose={() => setShowSscTop100CompletionModal(false)}
          onReviewMistakes={() => {
            setShowSscTop100CompletionModal(false);
            setPracticeCustomQueue(null);
            setPracticeModeBannerTitle(null);
            setActiveSscTop100Category(null);
            setSscTop100InitialIndex(0);
            setCurrentTab('mistakes');
          }}
          onReturnToArena={() => {
            setShowSscTop100CompletionModal(false);
            setPracticeCustomQueue(null);
            setPracticeModeBannerTitle(null);
            setActiveSscTop100Category(null);
            setSscTop100InitialIndex(0);
            setCurrentTab('arena');
          }}
          onRestartCategory={async () => {
            setShowSscTop100CompletionModal(false);
            const cat = sscTop100SummaryData.category;
            const uid = currentUser?.uid || player.id;
            await sscTop100Service.resetUserProgress(uid, cat);
            handleStartSscTop100Drill(cat, 0, 0);
          }}
        />
      )}

      {/* Performance & Daily Accuracy Analytics Dashboard Modal */}
      {showStatsModal && (
        <UserStatsModal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          player={player}
          dailyStreak={streak}
          subscription={subscription}
          onOpenAuth={() => {
            setShowStatsModal(false);
            setShowProfileModal(true);
          }}
          onNavigateToPractice={() => {
            setShowStatsModal(false);
            setCurrentTab('practice');
          }}
          onNavigateToMistakes={() => {
            setShowStatsModal(false);
            setCurrentTab('mistakes');
          }}
        />
      )}

      {/* Interactive App Onboarding Tour Modal */}
      <OnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartPyq={() => {
          setShowTourModal(false);
          setCurrentTab('practice');
          if (typeof window !== 'undefined') {
            try {
              const alreadyGuided = localStorage.getItem('vocabclash_filter_guided_completed_v1');
              if (!alreadyGuided) {
                setShouldShowPyqFilterGuidance(true);
              }
            } catch {
              setShouldShowPyqFilterGuidance(true);
            }
          }
        }}
        onStartBattle={() => {
          setShowTourModal(false);
          handleStartMatchmaking('1v1_ranked');
        }}
        onOpenLogin={() => {
          setShowTourModal(false);
          setShowProfileModal(true);
        }}
        onExploreApp={() => {
          setShowTourModal(false);
        }}
      />

      {/* Official App Guide & Rules Modal */}
      <AppGuideModal
        isOpen={showAppGuideModal}
        onClose={() => setShowAppGuideModal(false)}
        onNavigate={(tab) => {
          setShowAppGuideModal(false);
          setCurrentTab(tab);
        }}
        onStart1v1={() => {
          setShowAppGuideModal(false);
          handleStartMatchmaking('1v1_ranked');
        }}
        onStartFriendLobby={() => {
          setShowAppGuideModal(false);
          setFriendLobbyInitialCode('');
          handleOpenFriendLobbyModal();
        }}
        onStartDailyChallenge={() => {
          setShowAppGuideModal(false);
          handleStartMatchmaking('daily_challenge');
        }}
        onStartSpeedBlitz={() => {
          setShowAppGuideModal(false);
          handleStartMatchmaking('quick_duel');
        }}
      />

      {/* VIP Premium Subscription Modal */}
      {showPremiumModal && (
        <PremiumModal
          subscription={subscription}
          player={player}
          currentUser={currentUser}
          currentUserEmail={currentUser?.email || undefined}
          onClose={() => setShowPremiumModal(false)}
          onUpdateSubscription={updated => setSubscription(updated)}
          onOpenProfile={() => {
            setShowPremiumModal(false);
            setShowProfileModal(true);
          }}
          onUserChange={user => setCurrentUser(user)}
        />
      )}

      {/* Daily Streak Tracker Modal with Automated Question-Based Logic */}
      {showStreakModal && (
        <StreakModal
          streak={streak}
          onClose={() => setShowStreakModal(false)}
          onUpdateStreak={updated => setStreak(updated)}
          onAddLP={handleAddLP}
          onGoToPractice={() => {
            setShowStreakModal(false);
            setCurrentTab('practice');
          }}
        />
      )}

      {/* 10-Minute Interstitial Ad Modal (for free users after match or back) */}
      {ADS_ENABLED && showAdModal && (
        <InterstitialAdModal
          onClose={() => setShowAdModal(false)}
          onOpenPremium={() => {
            setShowAdModal(false);
            setShowPremiumModal(true);
          }}
        />
      )}

      {/* Private Admin PDF PYQ Importer Portal */}
      {showAdminImporter && (
        <AdminPyqImporter
          userEmail={currentUser?.email || null}
          onClose={() => {
            setShowAdminImporter(false);
            if (typeof window !== 'undefined' && window.location.hash.includes('admin-pyq')) {
              window.location.hash = '';
            }
          }}
          onOpenArticles={() => {
            setShowAdminImporter(false);
            setShowAdminArticles(true);
            setAdminArticleMode('dashboard');
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/articles');
            }
          }}
          onOpenAnalytics={() => {
            setShowAdminImporter(false);
            setShowBattleAnalytics(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/admin/analytics');
            }
          }}
        />
      )}

      {/* 1v1 Battle Analytics & Funnel Dashboard Modal */}
      {showBattleAnalytics && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto flex items-start justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-4">
            <BattleAnalyticsDashboard 
              onClose={() => {
                setShowBattleAnalytics(false);
                if (typeof window !== 'undefined' && (window.location.pathname.includes('/admin/analytics') || window.location.hash.includes('admin-analytics'))) {
                  window.history.pushState(null, '', '/');
                }
              }}
            />
          </div>
        </div>
      )}

      {/* SSC Vocab Guides & PYQ Hub Modal */}
      {showSeoGuidesModal && (
        <SeoGuidesModal
          isOpen={showSeoGuidesModal}
          onClose={() => setShowSeoGuidesModal(false)}
          onSelectGuide={(slug) => {
            setShowSeoGuidesModal(false);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', slug);
            }
            setActiveSeoSlug(slug);
          }}
          onSelectArticlesIndex={() => {
            setShowSeoGuidesModal(false);
            setIsViewingArticlesIndex(true);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/articles');
            }
          }}
        />
      )}

      {/* Due Mistake Revision Session Modal */}
      {showDueRevisionModal && (
        <DueRevisionSessionModal
          isOpen={showDueRevisionModal}
          dueWords={dueRevisionWords}
          onClose={() => setShowDueRevisionModal(false)}
          onSessionFinished={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('user-stats-updated'));
            }
          }}
        />
      )}

      {/* Android Bottom Navigation Bar (Hidden during active match and on desktop screens) */}
      {!matchState && (
        <BottomNavBar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            // Trigger ad if leaving practice or completed session
            if (currentTab === 'practice' && tab !== 'practice') {
              triggerAdIfDue();
            }
            setCurrentTab(tab);
          }}
          mistakeCount={activeMistakeCount}
        />
      )}
      </div>
    </AndroidDeviceShell>
  );
}
