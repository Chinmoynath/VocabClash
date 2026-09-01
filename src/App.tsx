import React, { useState, useEffect, useRef } from 'react';
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
  generateMatchedOpponent, 
  getTierFromLP, 
  getTierTitle 
} from './services/matchmakingService';
import { questionReviewScheduler } from './services/questionReviewScheduler';
import { LiveRoomFinalResult, forfeitLiveRoom } from './services/realtimeMatchmaking';
import { soundManager } from './utils/audio';
import { isAdDue, resetAdTimerForTest } from './utils/adManager';
import { extractCleanUserName, formatNameFromEmail } from './utils/nameHelper';
import { 
  getInitialStreak, 
  saveStreakState, 
  evaluateStreakIntegrity,
  recordDailyQuestionSolved
} from './utils/streakManager';
import { 
  recordQuestionSolvedForDailyTarget 
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
  fetchUserDataFromFirestore,
  checkRedirectAuthResult
} from './services/firebaseService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AndroidDeviceShell } from './components/AndroidDeviceShell';
import { TopBar } from './components/TopBar';
import { DesktopSidebar } from './components/DesktopSidebar';
import { BottomNavBar, TabType } from './components/BottomNavBar';
import { ArenaHome } from './components/ArenaHome';
import { MatchmakingModal } from './components/MatchmakingModal';
import { LiveDuelArena } from './components/LiveDuelArena';
import { MatchSummary } from './components/MatchSummary';
import { MistakeVault } from './components/MistakeVault';
import { PracticeMode } from './components/PracticeMode';
import { LeaderboardView } from './components/LeaderboardView';
import { AiTutorModal } from './components/AiTutorModal';
import { AiTutorTab } from './components/AiTutorTab';
import { ProfileModal } from './components/ProfileModal';
import { PremiumModal } from './components/PremiumModal';
import { InterstitialAdModal } from './components/InterstitialAdModal';
import { StreakModal } from './components/StreakModal';
import { OnboardingTourModal } from './components/OnboardingTourModal';
import { PlayModeSelectorModal } from './components/PlayModeSelectorModal';
import { FriendLobbyModal } from './components/FriendLobbyModal';
import { AdminPyqImporter } from './components/AdminPyqImporter';
import { UserStatsModal } from './components/UserStatsModal';
import { recordQuestionAttempt } from './utils/userStatsManager';

const STORAGE_KEY_PLAYER = 'vocabclash_player_v5';
const STORAGE_KEY_VAULT = 'vocabclash_vault_v2';
const STORAGE_KEY_SUBSCRIPTION = 'vocabclash_subscription_v2';

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

const INITIAL_PLAYER: PlayerProfile = {
  id: getOrCreateGuestId(),
  name: 'Govt Aspirant',
  avatar: '👨‍💼',
  country: 'India',
  countryCode: 'IN',
  targetExam: 'SSC CGL 2026 (GST Inspector)',
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

// Helper to sanitize and cleanse any lingering demo template state
function sanitizeProfile(raw: any, googleUser?: FirebaseUser | null): PlayerProfile {
  const deviceGuestId = getOrCreateGuestId();
  if (!raw) return { ...INITIAL_PLAYER, id: googleUser ? googleUser.uid : deviceGuestId };

  const isLegacyDemo = 
    raw.id === 'user-cgl-1' || 
    raw.id === 'user-live-1' ||
    raw.name === 'Aspirant Rahul' ||
    (raw.matchesPlayed === 48 && (raw.rankPoints === 1840 || raw.rankPoints === 1865 || raw.rankPoints >= 1800)) ||
    (raw.tierTitle && raw.tierTitle.includes('2800 GP') && raw.matchesPlayed <= 50);

  const cleanUserName = extractCleanUserName(googleUser?.displayName, googleUser?.email);

  if (isLegacyDemo) {
    return {
      ...INITIAL_PLAYER,
      id: googleUser ? googleUser.uid : deviceGuestId,
      name: cleanUserName || 'Govt Aspirant',
      photoURL: googleUser?.photoURL || undefined,
      email: googleUser?.email || undefined,
      rankPoints: 100,
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

  const rankPoints = typeof raw.rankPoints === 'number' ? Math.max(0, raw.rankPoints) : 100;
  const pyqScore = typeof raw.pyqScore === 'number' ? Math.max(0, raw.pyqScore) : 0;
  const matchesPlayed = typeof raw.matchesPlayed === 'number' ? Math.max(0, raw.matchesPlayed) : 0;
  const matchesWon = typeof raw.matchesWon === 'number' ? Math.max(0, raw.matchesWon) : 0;
  const winStreak = typeof raw.winStreak === 'number' ? Math.max(0, raw.winStreak) : 0;
  const accuracyRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
  const tier = getTierFromLP(rankPoints);
  const tierTitle = getTierTitle(tier);
  const level = Math.max(1, Math.floor(matchesPlayed / 3) + 1);

  // If raw name is the default placeholder or looks like a raw email prefix without spaces and with digits, format it cleanly
  let effectiveName = raw.name;
  if (!effectiveName || effectiveName === 'Aspirant Rahul') {
    effectiveName = cleanUserName || 'Govt Aspirant';
  } else if (!effectiveName.includes(' ') && /\d/.test(effectiveName)) {
    // Looks like raw email prefix stored previously (e.g. "surajkumarhero7399")
    effectiveName = extractCleanUserName(effectiveName, googleUser?.email || raw.email);
  }

  const resolvedId = googleUser ? googleUser.uid : (raw.id && raw.id !== 'user-live-1' && raw.id !== 'user-cgl-1' ? raw.id : deviceGuestId);

  return {
    ...INITIAL_PLAYER,
    ...raw,
    id: resolvedId,
    name: effectiveName || cleanUserName || 'Govt Aspirant',
    photoURL: googleUser?.photoURL || raw.photoURL || undefined,
    email: googleUser?.email || raw.email || undefined,
    rankPoints,
    pyqScore,
    tier,
    tierTitle,
    matchesPlayed,
    matchesWon,
    winStreak,
    accuracyRate,
    level,
  };
}

const INITIAL_SUBSCRIPTION: UserSubscription = {
  isPremium: false,
  autoRenew: false,
};

export default function App() {
  // Firebase Auth state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isInitialCloudLoad = useRef<boolean>(true);

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
  const [currentTab, setCurrentTab] = useState<TabType>('arena');
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'mixed'>('mixed');
  const [selectedExam, setSelectedExam] = useState<ExamType>('SSC_CGL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Matchmaking & Game state
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const [matchMode, setMatchMode] = useState<'1v1_ranked' | 'quick_duel' | 'daily_challenge'>('1v1_ranked');
  const [matchedOpponent, setMatchedOpponent] = useState<PlayerProfile | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [isMatchCompleted, setIsMatchCompleted] = useState<boolean>(false);

  // Modals
  const [activeAiQuestion, setActiveAiQuestion] = useState<Question | null>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [showStreakModal, setShowStreakModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [showPlayModeModal, setShowPlayModeModal] = useState<boolean>(false);
  const [showFriendLobbyModal, setShowFriendLobbyModal] = useState<boolean>(false);
  const [friendLobbyInitialCode, setFriendLobbyInitialCode] = useState<string>('');
  const [forfeitNotice, setForfeitNotice] = useState<string | null>(null);
  const [showAdminImporter, setShowAdminImporter] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.pathname.includes('/admin/pyq-import') ||
        window.location.pathname.includes('/admin') ||
        window.location.hash.includes('admin-pyq') ||
        window.location.search.includes('admin=pyq')
      );
    }
    return false;
  });

  // Listen to hash / route changes for private admin portal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashOrPopState = () => {
      const isAdminRoute = 
        window.location.pathname.includes('/admin/pyq-import') ||
        window.location.pathname.includes('/admin') ||
        window.location.hash.includes('admin-pyq') ||
        window.location.search.includes('admin=pyq');
      setShowAdminImporter(isAdminRoute);
    };

    window.addEventListener('popstate', handleHashOrPopState);
    window.addEventListener('hashchange', handleHashOrPopState);
    return () => {
      window.removeEventListener('popstate', handleHashOrPopState);
      window.removeEventListener('hashchange', handleHashOrPopState);
    };
  }, []);

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

  // Auto-trigger onboarding tour for first-time visitors
  useEffect(() => {
    try {
      const tourSeen = localStorage.getItem('vocabclash_onboarding_seen_v1');
      if (!tourSeen) {
        const timer = setTimeout(() => {
          setShowTourModal(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Listen to Firebase Auth state & sync with Google Account
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Check if coming back from Google redirect auth
    checkRedirectAuthResult().catch(err => {
      console.warn('Redirect auth check completed:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      questionReviewScheduler.setAuthUser(user ? user.uid : null);
      if (user) {
        setIsSyncing(true);
        try {
          // Read local player state right now before overwriting
          let localPlayer = player;
          try {
            const localSavedRaw = localStorage.getItem(STORAGE_KEY_PLAYER);
            if (localSavedRaw) {
              localPlayer = JSON.parse(localSavedRaw);
            }
          } catch { /* ignore */ }

          // Try to load existing cloud data for this user
          const cloudData = await fetchUserDataFromFirestore(user.uid);
          const cleanAuthName = extractCleanUserName(user.displayName, user.email);
          
          if (cloudData && cloudData.player) {
            const cloudP = cloudData.player;
            // Clean up cloud name if it was previously saved as a raw email username
            let resolvedName = cloudP.name;
            if (!resolvedName || resolvedName === 'Aspirant Rahul') {
              resolvedName = cleanAuthName || localPlayer.name || 'Govt Aspirant';
            } else if (!resolvedName.includes(' ') && /\d/.test(resolvedName)) {
              resolvedName = extractCleanUserName(resolvedName, user.email || cloudP.email);
            }

            // Intelligently merge: preserve whichever source has higher progress
            const mergedLP = Math.max(cloudP.rankPoints ?? 0, localPlayer.rankPoints ?? 0, 100);
            const mergedPYQScore = Math.max(cloudP.pyqScore ?? 0, localPlayer.pyqScore ?? 0);
            const mergedMatches = Math.max(cloudP.matchesPlayed ?? 0, localPlayer.matchesPlayed ?? 0);
            const mergedWins = Math.max(cloudP.matchesWon ?? 0, localPlayer.matchesWon ?? 0);
            const mergedStreak = Math.max(cloudP.winStreak ?? 0, localPlayer.winStreak ?? 0);
            const mergedAccuracy = mergedMatches > 0 ? Math.round((mergedWins / mergedMatches) * 100) : 0;
            const mergedTier = getTierFromLP(mergedLP);
            const mergedTierTitle = getTierTitle(mergedTier);
            const mergedLevel = Math.max(cloudP.level ?? 1, localPlayer.level ?? 1, Math.floor(mergedMatches / 3) + 1);

            const mergedPlayer: PlayerProfile = {
              ...INITIAL_PLAYER,
              ...cloudP,
              id: user.uid,
              name: resolvedName || cleanAuthName || localPlayer.name || 'Govt Aspirant',
              avatar: cloudP.avatar || localPlayer.avatar || '👨‍💼',
              country: cloudP.country || localPlayer.country || 'India',
              countryCode: cloudP.countryCode || localPlayer.countryCode || 'IN',
              targetExam: cloudP.targetExam || localPlayer.targetExam || 'SSC CGL 2026 (GST Inspector)',
              photoURL: user.photoURL || cloudP.photoURL || undefined,
              email: user.email || cloudP.email || undefined,
              rankPoints: mergedLP,
              pyqScore: mergedPYQScore,
              tier: mergedTier,
              tierTitle: mergedTierTitle,
              matchesPlayed: mergedMatches,
              matchesWon: mergedWins,
              winStreak: mergedStreak,
              accuracyRate: mergedAccuracy,
              level: mergedLevel,
              bestCategory: cloudP.bestCategory || localPlayer.bestCategory || 'synonyms',
              badges: cloudP.badges || localPlayer.badges || ['🏛️ SSC CGL Aspirant'],
            };

            setPlayer(mergedPlayer);

            if (cloudData.subscription) setSubscription(cloudData.subscription);
            if (cloudData.streak) {
              const checkedStreak = evaluateStreakIntegrity(cloudData.streak);
              setStreak(checkedStreak);
            }
            if (cloudData.savedWords && cloudData.savedWords.length > 0) {
              const sanitizedCloud = sanitizeVaultList(cloudData.savedWords);
              setSavedWords(sanitizedCloud);
            }

            // Immediately write merged data back to Firestore
            await saveUserDataToFirestore(
              user.uid,
              { 
                player: mergedPlayer, 
                subscription: cloudData.subscription || subscription, 
                streak: cloudData.streak || streak, 
                savedWords: (cloudData.savedWords && cloudData.savedWords.length > 0) ? cloudData.savedWords : savedWords 
              },
              user
            );
          } else {
            // First time sign-in with Google: Carry over user's existing local progress!
            const initialLP = Math.max(100, localPlayer.rankPoints || 100);
            const initialPYQScore = localPlayer.pyqScore || 0;
            const initialMatches = localPlayer.matchesPlayed || 0;
            const initialWins = localPlayer.matchesWon || 0;
            const initialWinStreak = localPlayer.winStreak || 0;
            const initialAccuracy = initialMatches > 0 ? Math.round((initialWins / initialMatches) * 100) : 0;
            const initialLevel = Math.max(1, localPlayer.level || 1, Math.floor(initialMatches / 3) + 1);
            const initialTier = getTierFromLP(initialLP);
            const initialTierTitle = getTierTitle(initialTier);

            const newPlayer: PlayerProfile = {
              ...INITIAL_PLAYER,
              id: user.uid,
              name: cleanAuthName || localPlayer.name || 'Govt Aspirant',
              avatar: localPlayer.avatar || '👨‍💼',
              country: localPlayer.country || 'India',
              countryCode: localPlayer.countryCode || 'IN',
              targetExam: localPlayer.targetExam || 'SSC CGL 2026 (GST Inspector)',
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
            };

            setPlayer(newPlayer);
            await saveUserDataToFirestore(
              user.uid,
              { player: newPlayer, subscription, streak, savedWords },
              user
            );
          }
        } catch (error) {
          console.warn('Session cloud data fetch failed, keeping local state safe:', error);
        } finally {
          setIsSyncing(false);
          setSessionLoaded(true);
        }
      } else {
        // When user is signed out, ensure guest state is clean (no leftover Google photo or name)
        setSessionLoaded(true);
        setPlayer(prev => {
          if (prev.photoURL || prev.email || prev.name !== 'Govt Aspirant') {
            return { ...INITIAL_PLAYER };
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(player));
  }, [player]);

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
          { player, subscription, streak, savedWords },
          currentUser
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [player, subscription, streak, savedWords, currentUser, sessionLoaded, isSyncing]);

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    soundManager.setSoundEnabled(nextVal);
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    await saveUserDataToFirestore(
      currentUser.uid,
      { player, subscription, streak, savedWords },
      currentUser
    );
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

  // Sign out user: 1. Save data to Firestore -> 2. Firebase sign out -> 3. Clear local storage & reset state to Guest
  const handleSignOutUser = async () => {
    setIsSyncing(true);
    try {
      if (currentUser) {
        // Save current progress in Firestore before signout so user can resume seamlessly upon next login
        await saveUserDataToFirestore(
          currentUser.uid,
          { player, subscription, streak, savedWords },
          currentUser
        );
      }
    } catch (err) {
      console.warn('Error auto-saving before sign out:', err);
    }

    try {
      await auth.signOut();
    } catch (err) {
      console.warn('Firebase sign out error:', err);
    }

    // Reset local storage keys
    localStorage.removeItem(STORAGE_KEY_PLAYER);
    localStorage.removeItem(STORAGE_KEY_VAULT);
    localStorage.removeItem(STORAGE_KEY_SUBSCRIPTION);
    localStorage.removeItem('vocabclash_daily_streak_v2');

    // Reset React state to fresh guest mode
    setCurrentUser(null);
    setPlayer({ ...INITIAL_PLAYER });
    setSubscription({ ...INITIAL_SUBSCRIPTION });
    setSavedWords([]);
    setStreak(getInitialStreak());
    setIsSyncing(false);
  };

  // Check 10-minute ad trigger safely
  const triggerAdIfDue = () => {
    if (isAdDue(subscription.isPremium)) {
      setShowAdModal(true);
    }
  };

  // Start matchmaking flow
  const handleStartMatchmaking = (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => {
    setMatchMode(mode);
    const opp = generateMatchedOpponent(player.rankPoints, selectedExam);
    setMatchedOpponent(opp);
    setIsMatchmaking(true);
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

    const isFirstTimeMatch = player.matchesPlayed === 0 || matchMode === 'quick_duel';
    const roundCount = isFirstTimeMatch ? 10 : (matchMode === 'quick_duel' ? 10 : 20);
    
    // For first-time players / quick start: Curate 10 questions (70-80% easy, 20-30% medium)
    // Or use the synchronized question list generated and locked during the atomic match transaction
    const questions = matchedQuestions && matchedQuestions.length > 0 
      ? matchedQuestions 
      : (isFirstTimeMatch && selectedCategory === 'mixed'
          ? getFirstMatchQuestions(selectedExam)
          : getFilteredQuestions(selectedCategory, selectedExam, roundCount));

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
  };

  // Automatic streak tracking: solving at least 1 question daily advances or starts the streak
  const handleRecordQuestionSolved = () => {
    setStreak(prev => {
      const { updatedStreak } = recordDailyQuestionSolved(prev);
      return updatedStreak;
    });
    // Also track towards user's daily question target
    recordQuestionSolvedForDailyTarget(1);
  };

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

    let isWinner = false;
    let isDraw = false;
    let lpDelta = 0;
    let finalPlayerScore = finalScores?.playerScore ?? matchState.playerScore;
    let finalOpponentScore = finalScores?.opponentScore ?? matchState.opponentScore;
    const finalComboStreak = finalScores?.combo ?? matchState.comboStreak;
    const finalOpponentCombo = finalScores?.opponentCombo ?? matchState.opponentCombo;

    if (authoritativeResult && authoritativeResult.finalised) {
      // Authoritative synchronized scores directly from Firestore Live Room
      if (authoritativeResult.winnerId === 'draw') {
        isDraw = true;
        isWinner = false;
        lpDelta = 5;
      } else if (authoritativeResult.winnerId === player.id) {
        isWinner = true;
        isDraw = false;
        lpDelta = 30;
      } else {
        isWinner = false;
        isDraw = false;
        lpDelta = -15;
      }

      // Synchronize exact final scores
      if (authoritativeResult.player1FinalScore !== undefined && authoritativeResult.player2FinalScore !== undefined) {
        if (isWinner) {
          finalPlayerScore = Math.max(authoritativeResult.player1FinalScore, authoritativeResult.player2FinalScore);
          finalOpponentScore = Math.min(authoritativeResult.player1FinalScore, authoritativeResult.player2FinalScore);
        } else if (isDraw) {
          finalPlayerScore = authoritativeResult.player1FinalScore;
          finalOpponentScore = authoritativeResult.player2FinalScore;
        } else {
          finalPlayerScore = Math.min(authoritativeResult.player1FinalScore, authoritativeResult.player2FinalScore);
          finalOpponentScore = Math.max(authoritativeResult.player1FinalScore, authoritativeResult.player2FinalScore);
        }
      }
    } else {
      // Bot / Offline match
      isWinner = finalPlayerScore > finalOpponentScore;
      isDraw = finalPlayerScore === finalOpponentScore;
      lpDelta = isWinner ? 30 + (finalComboStreak > 2 ? 5 : 0) : isDraw ? 5 : -15;
    }

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

    setMatchState(prev => prev ? {
      ...prev,
      playerScore: finalPlayerScore,
      opponentScore: finalOpponentScore,
      comboStreak: finalComboStreak,
      opponentCombo: finalOpponentCombo,
      finalResult: authoritativeResult,
    } : null);

    setIsMatchCompleted(true);

    // Immediately persist match results to Firestore if user is signed in
    if (currentUser) {
      saveUserDataToFirestore(
        currentUser.uid,
        { player: updatedPlayer, subscription, streak, savedWords },
        currentUser
      ).catch(err => console.warn('Instant cloud save after match completion failed:', err));
    }

    // Trigger 10-min interval ad safely after match completion (only for free tier)
    if (isAdDue(subscription.isPremium)) {
      setTimeout(() => {
        setShowAdModal(true);
      }, 700);
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
      const forfeitPenalty = -15;
      const newLP = Math.max(0, player.rankPoints + forfeitPenalty);
      const newTier = getTierFromLP(newLP);
      const newTierTitle = getTierTitle(newTier);

      const nextMatchesPlayed = player.matchesPlayed + 1;
      const nextAccuracy = Math.round((player.matchesWon / nextMatchesPlayed) * 100);

      const updatedPlayer: PlayerProfile = {
        ...player,
        rankPoints: newLP,
        tier: newTier,
        tierTitle: newTierTitle,
        matchesPlayed: nextMatchesPlayed,
        winStreak: 0, // Forfeiting breaks active win streak
        accuracyRate: nextAccuracy,
      };

      setPlayer(updatedPlayer);

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
        forfeitLiveRoom(rId, player.id).catch(err => console.warn('Failed to broadcast room forfeit:', err));
      }

      // Display floating forfeit penalty notification
      setForfeitNotice('⚠️ Match Forfeited: -15 LP deducted & win streak reset');
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
    resetAdTimerForTest();
    setShowAdModal(true);
  };

  const handleResetStats = async () => {
    const cleanAuthName = extractCleanUserName(currentUser?.displayName, currentUser?.email);
    const cleanPlayer: PlayerProfile = {
      id: currentUser ? currentUser.uid : 'user-live-1',
      name: cleanAuthName || player.name || 'Govt Aspirant',
      avatar: player.avatar || '👨‍💼',
      country: 'India',
      countryCode: 'IN',
      targetExam: player.targetExam || 'SSC CGL 2026 (GST Inspector)',
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

  const handleAddLP = (amount: number) => {
    setPlayer(prev => {
      const newLP = prev.rankPoints + amount;
      const newTier = getTierFromLP(newLP);
      const newTierTitle = getTierTitle(newTier);
      return {
        ...prev,
        rankPoints: newLP,
        tier: newTier,
        tierTitle: newTierTitle,
      };
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
          onOpenTour={() => {
            soundManager.playTap();
            setShowTourModal(true);
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
          onOpenAdminImporter={() => {
            soundManager.playTap();
            setShowAdminImporter(true);
          }}
        />

        {/* Forfeit Penalty Notification Banner */}
        {forfeitNotice && (
          <div className="w-full bg-gradient-to-r from-rose-900/90 via-rose-800/90 to-rose-900/90 border-b border-rose-600/60 px-4 py-2 text-center text-xs font-black text-rose-100 flex items-center justify-center gap-2 shadow-lg backdrop-blur-md animate-fadeIn z-20 shrink-0">
            <span>{forfeitNotice}</span>
          </div>
        )}

        {/* Main Dynamic View Content */}
        <main id="app-main-content" className="flex-1 min-h-0 relative overflow-y-auto flex flex-col no-scrollbar">
        {matchState ? (
          !isMatchCompleted ? (
            /* Live 1v1 Battle Arena Screen */
            <LiveDuelArena
              player={player}
              matchState={matchState}
              onAnswerQuestion={handleAnswerQuestion}
              onCompleteMatch={handleCompleteMatch}
              onSendEmote={handleSendEmote}
              onLeaveMatch={handleLeaveMatch}
            />
          ) : (
            /* Post-Match Summary & Detailed Question Review */
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
              bookmarkedIds={bookmarkedIds}
              isPremium={subscription.isPremium}
              currentUser={currentUser}
              onUserChange={user => setCurrentUser(user)}
            />
          )
        ) : (
          /* Regular Tab Views */
          <>
            {currentTab === 'arena' && (
              <ArenaHome
                player={player}
                subscription={subscription}
                dailyStreak={streak}
                selectedCategory={selectedCategory}
                selectedExam={selectedExam}
                currentUser={currentUser}
                onSelectCategory={setSelectedCategory}
                onSelectExam={setSelectedExam}
                onStartMatchmaking={handleStartMatchmaking}
                onOpenPlayModeSelector={() => setShowPlayModeModal(true)}
                onOpenFriendLobby={() => {
                  setFriendLobbyInitialCode('');
                  setShowFriendLobbyModal(true);
                }}
                onOpenPremium={() => setShowPremiumModal(true)}
                onOpenStreak={() => setShowStreakModal(true)}
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenTour={() => setShowTourModal(true)}
                onNavigateTab={setCurrentTab}
                onRewardLP={handleRewardLP}
                onTriggerTestAd={handleTriggerTestAd}
              />
            )}

            {currentTab === 'practice' && (
              <PracticeMode
                pyqScore={player.pyqScore || 0}
                onUpdatePyqScore={handleUpdatePyqScore}
                onBookmarkQuestion={handleBookmarkQuestion}
                onOpenAiTutor={handleOpenAiTutor}
                onOpenStats={() => {
                  soundManager.playTap();
                  setShowStatsModal(true);
                }}
                onBatchComplete={triggerAdIfDue}
                onSolveQuestion={handleRecordQuestionSolved}
                bookmarkedIds={bookmarkedIds}
                isPremium={subscription.isPremium}
              />
            )}

            {currentTab === 'leaderboard' && (
              <LeaderboardView player={player} isPremium={subscription.isPremium} />
            )}

            {currentTab === 'mistakes' && (
              <MistakeVault
                savedWords={savedWords}
                onRemoveWord={handleRemoveSavedWord}
                onToggleUserSaved={handleToggleUserSaved}
                onOpenAiTutor={handleOpenAiTutor}
                onGoToArena={() => setCurrentTab('arena')}
                onGoToPractice={() => setCurrentTab('practice')}
              />
            )}

            {currentTab === 'ai_coach' && (
              <AiTutorTab />
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
          initialBotOpponent={matchedOpponent || generateMatchedOpponent(player.rankPoints, selectedExam)}
          mode={matchMode}
          category={selectedCategory}
          exam={selectedExam}
          onCancel={() => setIsMatchmaking(false)}
          onReadyToFight={handleReadyToFight}
        />
      )}

      {/* AI Tutor Deep Dive Modal */}
      {showAiModal && (
        <AiTutorModal
          question={activeAiQuestion}
          onClose={() => setShowAiModal(false)}
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
          onUpdatePlayer={updated => setPlayer(prev => ({ ...prev, ...updated }))}
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
          onUserChange={user => setCurrentUser(user)}
          onManualSync={handleManualSync}
          onSignOut={handleSignOutUser}
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
            setCurrentTab('vault');
          }}
        />
      )}

      {/* Interactive App Onboarding Tour Modal */}
      <OnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartBattle={() => {
          setShowTourModal(false);
          handleStartMatchmaking('1v1_ranked');
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
      {showAdModal && (
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
