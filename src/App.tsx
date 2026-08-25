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
import { LiveRoomFinalResult } from './services/realtimeMatchmaking';
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

const STORAGE_KEY_PLAYER = 'vocabclash_player_v5';
const STORAGE_KEY_VAULT = 'vocabclash_vault_v2';
const STORAGE_KEY_SUBSCRIPTION = 'vocabclash_subscription_v2';

const INITIAL_PLAYER: PlayerProfile = {
  id: 'user-live-1',
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
  if (!raw) return { ...INITIAL_PLAYER };

  const isLegacyDemo = 
    raw.id === 'user-cgl-1' || 
    raw.name === 'Aspirant Rahul' ||
    (raw.matchesPlayed === 48 && (raw.rankPoints === 1840 || raw.rankPoints === 1865 || raw.rankPoints >= 1800)) ||
    (raw.tierTitle && raw.tierTitle.includes('2800 GP') && raw.matchesPlayed <= 50);

  const cleanUserName = extractCleanUserName(googleUser?.displayName, googleUser?.email);

  if (isLegacyDemo) {
    return {
      ...INITIAL_PLAYER,
      id: googleUser ? googleUser.uid : 'user-live-1',
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

  return {
    ...INITIAL_PLAYER,
    ...raw,
    id: googleUser ? googleUser.uid : (raw.id || 'user-live-1'),
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
        try { return JSON.parse(saved); } catch { /* ignore */ }
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
  const [showTourModal, setShowTourModal] = useState<boolean>(false);

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
              setSavedWords(cloudData.savedWords);
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

    // Automatically add incorrect questions to Mistake Vault
    if (!playerAns.isCorrect) {
      const currentQ = matchState.questions[matchState.currentQuestionIndex];
      if (currentQ) {
        handleBookmarkQuestion(currentQ, true);
      }
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
  const handleCompleteMatch = (authoritativeResult?: LiveRoomFinalResult) => {
    if (!matchState) return;

    let isWinner = false;
    let isDraw = false;
    let lpDelta = 0;
    let finalPlayerScore = matchState.playerScore;
    let finalOpponentScore = matchState.opponentScore;

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
      isWinner = matchState.playerScore > matchState.opponentScore;
      isDraw = matchState.playerScore === matchState.opponentScore;
      lpDelta = isWinner ? 30 + (matchState.comboStreak > 2 ? 5 : 0) : isDraw ? 5 : -15;
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

  // Bookmark / Save question to Mistake Vault
  const handleBookmarkQuestion = (q: Question, isAutomaticMistake: boolean = false) => {
    setSavedWords(prev => {
      const exists = prev.find(item => item.question.id === q.id);
      if (exists) {
        return prev.map(item =>
          item.question.id === q.id
            ? {
                ...item,
                mistakeCount: isAutomaticMistake ? item.mistakeCount + 1 : item.mistakeCount,
                isBookmarked: true,
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            question: q,
            savedAt: Date.now(),
            mistakeCount: isAutomaticMistake ? 1 : 0,
            correctCount: 0,
            isBookmarked: true,
          },
        ];
      }
    });
  };

  const handleToggleUserSaved = (questionId: string) => {
    soundManager.playTap();
    setSavedWords(prev =>
      prev.map(item => {
        if (item.question.id === questionId) {
          const currentStatus = item.isUserSaved ?? item.isBookmarked ?? false;
          return {
            ...item,
            isUserSaved: !currentStatus,
            isBookmarked: !currentStatus,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveSavedWord = (questionId: string) => {
    setSavedWords(prev => prev.filter(w => w.question.id !== questionId));
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
    soundManager.playTap();
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

  const bookmarkedIds = savedWords.map(w => w.question.id);

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
          mistakeCount={savedWords.length}
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
          onOpenTour={() => {
            soundManager.playTap();
            setShowTourModal(true);
          }}
        />
      )}

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative w-full">
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
          onOpenTour={() => {
            soundManager.playTap();
            setShowTourModal(true);
          }}
        />

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
              />
            )}

            {currentTab === 'ai_coach' && (
              <AiTutorTab />
            )}
          </>
        )}
      </main>

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
          onOpenTour={() => {
            setShowProfileModal(false);
            setShowTourModal(true);
          }}
          onUserChange={user => setCurrentUser(user)}
          onManualSync={handleManualSync}
          onSignOut={handleSignOutUser}
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
          mistakeCount={savedWords.length}
        />
      )}
      </div>
    </AndroidDeviceShell>
  );
}
