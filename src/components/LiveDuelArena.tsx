import React, { useState, useEffect, useRef } from 'react';
import { 
  Question, 
  PlayerProfile, 
  MatchState, 
  PlayerAnswerRecord 
} from '../types';
import { 
  calculateScore, 
  simulateOpponentAnswer, 
  generateRandomOpponentEmote 
} from '../services/matchmakingService';
import { 
  subscribeToLiveRoom, 
  submitPlayerAnswerToLiveRoom, 
  sendLiveRoomEmote, 
  forceFinalizeLiveRoom,
  forfeitLiveRoom,
  LiveDuelRoom,
  LiveRoomFinalResult 
} from '../services/realtimeMatchmaking';
import { soundManager } from '../utils/audio';
import { 
  Zap, 
  Clock, 
  HelpCircle, 
  Flame, 
  Check, 
  X, 
  Smile, 
  LogOut, 
  AlertTriangle,
  Loader2,
  Radio
} from 'lucide-react';

interface LiveDuelArenaProps {
  player: PlayerProfile;
  matchState: MatchState;
  onAnswerQuestion: (
    playerAnswer: PlayerAnswerRecord,
    opponentAnswer: PlayerAnswerRecord,
    updatedScores: { playerScore: number; opponentScore: number; combo: number; opponentCombo: number }
  ) => void;
  onCompleteMatch: (
    authoritativeResult?: LiveRoomFinalResult,
    finalScores?: { playerScore: number; opponentScore: number; combo?: number; opponentCombo?: number }
  ) => void;
  onSendEmote: (emoji: string) => void;
  onLeaveMatch: () => void;
}

const ROUND_TIME_SEC = 15;

export const LiveDuelArena: React.FC<LiveDuelArenaProps> = ({
  player,
  matchState,
  onAnswerQuestion,
  onCompleteMatch,
  onSendEmote,
  onLeaveMatch,
}) => {
  const currentQIndex = matchState.currentQuestionIndex;
  const currentQuestion = matchState.questions[currentQIndex];

  const isRealMatch = Boolean(matchState.isRealPlayer && (matchState.realRoomId || matchState.matchId));
  const roomId = matchState.realRoomId || matchState.matchId;
  const myPlayerId = player.id || 'player';
  const oppPlayerId = matchState.opponent.id;

  const [timeRemaining, setTimeRemaining] = useState<number>(ROUND_TIME_SEC);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState<boolean>(false);

  // Authoritative live state from Firestore (for real-player matches)
  const [liveRoom, setLiveRoom] = useState<LiveDuelRoom | null>(null);

  // Authoritative live scores & combos for instant real-time UI synchronization
  const [livePlayerScore, setLivePlayerScore] = useState<number>(matchState.playerScore);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number>(matchState.opponentScore);
  const [livePlayerCombo, setLivePlayerCombo] = useState<number>(matchState.comboStreak);
  const [liveOpponentCombo, setLiveOpponentCombo] = useState<number>(matchState.opponentCombo);

  const [opponentAnsweredState, setOpponentAnsweredState] = useState<{
    answered: boolean;
    isCorrect: boolean;
    points: number;
  }>({ answered: false, isCorrect: false, points: 0 });

  // Powerups local state for current question
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);
  const [showHindiHint, setShowHindiHint] = useState<boolean>(false);
  const [showEmotePicker, setShowEmotePicker] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);

  // Floating emotes
  const [floatingEmotes, setFloatingEmotes] = useState<
    { id: string; sender: 'player' | 'opponent'; emoji: string; text?: string }[]
  >([]);

  const questionStartTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const opponentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const opponentAnswerResultRef = useRef<{ selectedIndex: number; timeTakenMs: number; isCorrect: boolean } | null>(null);
  const processedEmoteTimestampsRef = useRef<Set<number>>(new Set());
  const hasCompletedRef = useRef<boolean>(false);
  const isRoundAdvancingRef = useRef<boolean>(false);
  const playerAnswerRecordRef = useRef<PlayerAnswerRecord | null>(null);
  const opponentAnswerRecordRef = useRef<PlayerAnswerRecord | null>(null);
  const currentLiveScoresRef = useRef<{
    playerScore: number;
    opponentScore: number;
    combo: number;
    opponentCombo: number;
  }>({
    playerScore: matchState.playerScore,
    opponentScore: matchState.opponentScore,
    combo: matchState.comboStreak,
    opponentCombo: matchState.opponentCombo,
  });

  // Synchronize live score state when current question index changes (new round)
  useEffect(() => {
    currentLiveScoresRef.current = {
      playerScore: matchState.playerScore,
      opponentScore: matchState.opponentScore,
      combo: matchState.comboStreak,
      opponentCombo: matchState.opponentCombo,
    };
    setLivePlayerScore(matchState.playerScore);
    setLiveOpponentScore(matchState.opponentScore);
    setLivePlayerCombo(matchState.comboStreak);
    setLiveOpponentCombo(matchState.opponentCombo);
  }, [currentQIndex]);

  // 1. REAL-PLAYER REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!isRealMatch || !roomId) return;

    const unsubscribe = subscribeToLiveRoom(roomId, (roomData) => {
      setLiveRoom(roomData);

      // Extract authoritative scores
      if (roomData.scores) {
        const authPlayerScore = roomData.scores[myPlayerId] ?? currentLiveScoresRef.current.playerScore;
        const authOpponentScore = roomData.scores[oppPlayerId] ?? currentLiveScoresRef.current.opponentScore;
        currentLiveScoresRef.current.playerScore = authPlayerScore;
        currentLiveScoresRef.current.opponentScore = authOpponentScore;
        setLivePlayerScore(authPlayerScore);
        setLiveOpponentScore(authOpponentScore);
      }

      if (roomData.combos) {
        const authPlayerCombo = roomData.combos[myPlayerId] ?? currentLiveScoresRef.current.combo;
        const authOpponentCombo = roomData.combos[oppPlayerId] ?? currentLiveScoresRef.current.opponentCombo;
        currentLiveScoresRef.current.combo = authPlayerCombo;
        currentLiveScoresRef.current.opponentCombo = authOpponentCombo;
        setLivePlayerCombo(authPlayerCombo);
        setLiveOpponentCombo(authOpponentCombo);
      }

      // Check opponent answer for current question
      if (roomData.answers && roomData.answers[oppPlayerId]) {
        const oppAnswers = roomData.answers[oppPlayerId];
        const currentQAnswer = oppAnswers[currentQIndex];
        if (currentQAnswer && !opponentAnsweredState.answered) {
          setOpponentAnsweredState({
            answered: true,
            isCorrect: currentQAnswer.isCorrect,
            points: currentQAnswer.scoreGained,
          });
        }
      }

      // Sync active emotes from opponent
      if (roomData.activeEmotes && roomData.activeEmotes.length > 0) {
        roomData.activeEmotes.forEach(emote => {
          if (emote.senderId === oppPlayerId && !processedEmoteTimestampsRef.current.has(emote.timestamp)) {
            processedEmoteTimestampsRef.current.add(emote.timestamp);
            triggerFloatingEmote('opponent', emote.emoji, emote.text);
          }
        });
      }

      // Check for match completion
      if (roomData.finalResult && roomData.finalResult.finalised && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteMatch(roomData.finalResult);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isRealMatch, roomId, myPlayerId, oppPlayerId, currentQIndex, onCompleteMatch]);

  const advanceToNextRound = () => {
    if (isRoundAdvancingRef.current) return;
    isRoundAdvancingRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);

    const isLastQuestion = currentQIndex + 1 >= matchState.questions.length;
    const finalScoresSnapshot = {
      playerScore: currentLiveScoresRef.current.playerScore,
      opponentScore: currentLiveScoresRef.current.opponentScore,
      combo: currentLiveScoresRef.current.combo,
      opponentCombo: currentLiveScoresRef.current.opponentCombo,
    };

    if (isRealMatch && roomId) {
      if (isLastQuestion) {
        if (liveRoom?.finalResult && liveRoom.finalResult.finalised && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onCompleteMatch(liveRoom.finalResult, finalScoresSnapshot);
        } else {
          setIsWaitingForOpponent(true);
        }
      } else {
        const pRecord = playerAnswerRecordRef.current || {
          questionId: currentQuestion.id,
          selectedIndex: -1,
          timeTakenMs: ROUND_TIME_SEC * 1000,
          isCorrect: false,
          scoreGained: -40,
        };
        const tempOppRecord: PlayerAnswerRecord = {
          questionId: currentQuestion.id,
          selectedIndex: -1,
          timeTakenMs: 0,
          isCorrect: false,
          scoreGained: 0,
        };
        onAnswerQuestion(pRecord, tempOppRecord, finalScoresSnapshot);
      }
    } else {
      // Bot Match
      const pRecord = playerAnswerRecordRef.current || {
        questionId: currentQuestion.id,
        selectedIndex: -1,
        timeTakenMs: ROUND_TIME_SEC * 1000,
        isCorrect: false,
        scoreGained: -40,
      };
      const oRecord = opponentAnswerRecordRef.current || {
        questionId: currentQuestion.id,
        selectedIndex: opponentAnswerResultRef.current?.selectedIndex ?? currentQuestion.correctIndex,
        timeTakenMs: opponentAnswerResultRef.current?.timeTakenMs ?? 3000,
        isCorrect: opponentAnswerResultRef.current?.isCorrect ?? true,
        scoreGained: opponentAnsweredState.points,
      };

      onAnswerQuestion(pRecord, oRecord, finalScoresSnapshot);

      if (isLastQuestion) {
        onCompleteMatch(undefined, finalScoresSnapshot);
      }
    }
  };

  const scheduleAdvance = (delayMs: number = 1200) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceToNextRound();
    }, delayMs);
  };

  // Bot execute answer logic
  const executeBotAnswer = (oppResult: { selectedIndex: number; timeTakenMs: number; isCorrect: boolean }) => {
    if (opponentAnswerRecordRef.current !== null || isRoundAdvancingRef.current) return;

    const nextOppCombo = oppResult.isCorrect ? currentLiveScoresRef.current.opponentCombo + 1 : 0;
    const oppScoreGained = calculateScore(
      oppResult.isCorrect,
      ROUND_TIME_SEC - oppResult.timeTakenMs / 1000,
      ROUND_TIME_SEC,
      nextOppCombo
    );
    const newOppScore = Math.max(0, currentLiveScoresRef.current.opponentScore + oppScoreGained);

    currentLiveScoresRef.current.opponentScore = newOppScore;
    currentLiveScoresRef.current.opponentCombo = nextOppCombo;

    setLiveOpponentScore(newOppScore);
    setLiveOpponentCombo(nextOppCombo);
    setOpponentAnsweredState({
      answered: true,
      isCorrect: oppResult.isCorrect,
      points: oppScoreGained,
    });

    opponentAnswerRecordRef.current = {
      questionId: currentQuestion.id,
      selectedIndex: oppResult.selectedIndex,
      timeTakenMs: oppResult.timeTakenMs,
      isCorrect: oppResult.isCorrect,
      scoreGained: oppScoreGained,
    };

    // Chance of opponent sending a friendly reaction
    if (Math.random() < 0.35) {
      const randEmote = generateRandomOpponentEmote();
      triggerFloatingEmote('opponent', randEmote.emoji, randEmote.text);
    }

    // If player has also already answered, schedule round advance
    if (playerAnswerRecordRef.current !== null) {
      scheduleAdvance(1200);
    }
  };

  // Reset for each new question
  useEffect(() => {
    setTimeRemaining(ROUND_TIME_SEC);
    setSelectedOption(null);
    setIsAnswered(false);
    setEliminatedOptions([]);
    setIsTimeFrozen(false);
    setShowHindiHint(false);
    setOpponentAnsweredState({ answered: false, isCorrect: false, points: 0 });
    
    playerAnswerRecordRef.current = null;
    opponentAnswerRecordRef.current = null;
    isRoundAdvancingRef.current = false;
    questionStartTimeRef.current = Date.now();

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

    // Prepare opponent simulated answer ONLY IF IT'S A BOT MATCH
    if (!isRealMatch && currentQuestion) {
      const oppResult = simulateOpponentAnswer(
        currentQuestion,
        matchState.opponent.accuracyRate,
        ROUND_TIME_SEC
      );
      opponentAnswerResultRef.current = oppResult;

      // Schedule opponent answer event
      opponentTimerRef.current = setTimeout(() => {
        executeBotAnswer(oppResult);
      }, oppResult.timeTakenMs);
    }

    return () => {
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [currentQIndex, currentQuestion, isRealMatch]);

  // Main countdown timer
  useEffect(() => {
    if (isAnswered || isWaitingForOpponent) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (isTimeFrozen) return prev; // Time is frozen by powerup
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeExpired();
          return 0;
        }
        if (prev <= 4) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAnswered, isTimeFrozen, currentQIndex, isWaitingForOpponent]);

  // Fallback safety timeout if waiting for opponent on last question
  useEffect(() => {
    if (!isWaitingForOpponent || !isRealMatch || !roomId) return;

    const safetyTimer = setTimeout(() => {
      if (!hasCompletedRef.current) {
        forceFinalizeLiveRoom(roomId).then(finalizedRoom => {
          if (finalizedRoom?.finalResult && !hasCompletedRef.current) {
            hasCompletedRef.current = true;
            onCompleteMatch(finalizedRoom.finalResult);
          }
        });
      }
    }, 12000);

    return () => clearTimeout(safetyTimer);
  }, [isWaitingForOpponent, isRealMatch, roomId, onCompleteMatch]);

  const handleTimeExpired = () => {
    if (isAnswered || isRoundAdvancingRef.current) return;
    handleSelectOption(-1); // Timed out (unanswered)
  };

  const handleSelectOption = async (index: number) => {
    if (isAnswered || isWaitingForOpponent || isRoundAdvancingRef.current) return;
    setIsAnswered(true);
    setSelectedOption(index);

    const timeTakenMs = Date.now() - questionStartTimeRef.current;
    const isCorrect = index === currentQuestion.correctIndex;

    if (isCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    const nextPlayerCombo = isCorrect ? currentLiveScoresRef.current.combo + 1 : 0;
    const playerScoreGained = index === -1 
      ? -40 
      : calculateScore(isCorrect, timeRemaining, ROUND_TIME_SEC, nextPlayerCombo);
    const newPlayerScore = Math.max(0, currentLiveScoresRef.current.playerScore + playerScoreGained);

    currentLiveScoresRef.current.playerScore = newPlayerScore;
    currentLiveScoresRef.current.combo = nextPlayerCombo;

    setLivePlayerScore(newPlayerScore);
    setLivePlayerCombo(nextPlayerCombo);

    const isLastQuestion = currentQIndex + 1 >= matchState.questions.length;

    const playerRecord: PlayerAnswerRecord = {
      questionId: currentQuestion.id,
      selectedIndex: index,
      timeTakenMs,
      isCorrect,
      scoreGained: playerScoreGained,
    };
    playerAnswerRecordRef.current = playerRecord;

    if (isRealMatch && roomId) {
      // SUBMIT ANSWER ATOMICALLY TO FIRESTORE LIVE ROOM
      submitPlayerAnswerToLiveRoom(roomId, myPlayerId, playerRecord, isLastQuestion).then(updatedRoom => {
        if (updatedRoom?.finalResult && updatedRoom.finalResult.finalised && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          setTimeout(() => {
            onCompleteMatch(updatedRoom.finalResult, {
              playerScore: currentLiveScoresRef.current.playerScore,
              opponentScore: currentLiveScoresRef.current.opponentScore,
              combo: currentLiveScoresRef.current.combo,
              opponentCombo: currentLiveScoresRef.current.opponentCombo,
            });
          }, 1200);
        }
      });

      scheduleAdvance(1500);
    } else {
      // BOT MATCH FLOW
      const oppResult = opponentAnswerResultRef.current || {
        selectedIndex: currentQuestion.correctIndex,
        timeTakenMs: 3000,
        isCorrect: true,
      };

      if (opponentAnswerRecordRef.current !== null) {
        // Bot has ALREADY answered! Both have now finished this question
        scheduleAdvance(1200);
      } else {
        // Bot is still thinking:
        // If bot scheduled time is more than 2.2s away, accelerate it slightly so the user watches bot answer naturally
        const elapsedTimeMs = Date.now() - questionStartTimeRef.current;
        const remainingDelay = oppResult.timeTakenMs - elapsedTimeMs;

        if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);

        const naturalFollowupDelay = remainingDelay > 2200
          ? Math.round(700 + Math.random() * 1100) // 0.7s - 1.8s
          : Math.max(400, remainingDelay);

        opponentTimerRef.current = setTimeout(() => {
          executeBotAnswer(oppResult);
        }, naturalFollowupDelay);
      }
    }
  };

  // Powerup: 50-50
  const handleUseFiftyFifty = () => {
    if (matchState.powerups.fiftyFiftyUsed || eliminatedOptions.length > 0 || isAnswered) return;
    soundManager.playPowerup();
    matchState.powerups.fiftyFiftyUsed = true;

    // Pick 2 wrong option indices
    const wrongIndices = [0, 1, 2, 3].filter(idx => idx !== currentQuestion.correctIndex);
    const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    setEliminatedOptions(toEliminate);
  };

  // Powerup: Freeze Time (+5s)
  const handleUseFreezeTime = () => {
    if (matchState.powerups.freezeTimeUsed || isTimeFrozen || isAnswered) return;
    soundManager.playPowerup();
    matchState.powerups.freezeTimeUsed = true;
    setIsTimeFrozen(true);
    setTimeRemaining(prev => Math.min(ROUND_TIME_SEC, prev + 5));

    setTimeout(() => {
      setIsTimeFrozen(false);
    }, 4000);
  };

  // Powerup: Hindi Meaning / Mnemonic Hint
  const handleUseHint = () => {
    if (matchState.powerups.hintUsed || showHindiHint || isAnswered) return;
    soundManager.playPowerup();
    matchState.powerups.hintUsed = true;
    setShowHindiHint(true);
  };

  const triggerFloatingEmote = (sender: 'player' | 'opponent', emoji: string, text?: string) => {
    const id = `emote-${Date.now()}-${Math.random()}`;
    setFloatingEmotes(prev => [...prev, { id, sender, emoji, text }]);
    setTimeout(() => {
      setFloatingEmotes(prev => prev.filter(e => e.id !== id));
    }, 2400);
  };

  const handleSendEmote = (emoji: string) => {
    soundManager.playTap();
    triggerFloatingEmote('player', emoji);
    if (isRealMatch && roomId) {
      sendLiveRoomEmote(roomId, myPlayerId, emoji);
    }
    onSendEmote(emoji);
    setShowEmotePicker(false);
  };

  // Keyboard hotkeys for fast desktop gameplay (1, 2, 3, 4 or A, B, C, D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || !currentQuestion || isWaitingForOpponent) return;
      if (e.key === '1' || e.key === 'a' || e.key === 'A') {
        handleSelectOption(0);
      } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
        handleSelectOption(1);
      } else if (e.key === '3' || e.key === 'c' || e.key === 'C') {
        handleSelectOption(2);
      } else if (e.key === '4' || e.key === 'd' || e.key === 'D') {
        handleSelectOption(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, currentQuestion, isWaitingForOpponent]);

  if (!currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs text-slate-400">Loading next PYQ clash round...</div>
        </div>
      </div>
    );
  }

  // Timer ring percentage
  const timerFraction = timeRemaining / ROUND_TIME_SEC;
  const isTimerCritical = timeRemaining <= 3;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col justify-between p-3 sm:p-5 lg:p-6 space-y-2 sm:space-y-3 pb-2 sm:pb-4 relative max-w-4xl mx-auto w-full overflow-hidden">
      {/* Floating Reaction Emotes */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingEmotes.map(emote => (
          <div
            key={emote.id}
            className={`absolute animate-bounce transition-all ${
              emote.sender === 'player'
                ? 'left-6 bottom-28 bg-slate-900/95 border-2 border-amber-400 text-amber-300'
                : 'right-6 bottom-28 bg-slate-900/95 border-2 border-orange-400 text-orange-300'
            } px-3 py-1.5 rounded-2xl shadow-2xl flex items-center gap-1.5 text-xs font-bold`}
          >
            <span className="text-2xl">{emote.emoji}</span>
            {emote.text && <span>{emote.text}</span>}
          </div>
        ))}
      </div>

      {/* Waiting for Opponent Finalize Overlay */}
      {isWaitingForOpponent && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-100">
                You Finished All Rounds!
              </h3>
              <p className="text-xs text-slate-400">
                Waiting for <span className="text-orange-400 font-bold">{matchState.opponent.name}</span> to complete the final question...
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Your Final Score:</span>
              <span className="text-amber-400 font-bold text-sm">{livePlayerScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP: Split Live Score Arena Header & Leave Match Option */}
      <div className="space-y-2 sm:space-y-2.5 shrink-0">
        {/* Round number, Leave Match Button & Exam tag */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Leave Match / Exit Button */}
            <button
              onClick={() => {
                soundManager.playTap();
                setShowLeaveConfirm(true);
              }}
              className="flex items-center gap-1.5 bg-rose-950/90 hover:bg-rose-900 border border-rose-600/70 text-rose-200 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs sm:text-sm font-extrabold transition-all active:scale-95 shadow-sm"
              title="Leave match and return to lobby"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-800/95 border border-slate-700 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-slate-100 font-extrabold text-xs sm:text-sm">
              <span>Round {currentQIndex + 1}/{matchState.questions.length}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 uppercase font-mono text-[10px] sm:text-xs">
                {currentQuestion.category}
              </span>
            </div>

            {isRealMatch && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-xs font-bold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Live 1v1</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-amber-950/90 border border-amber-600/70 text-amber-300 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs sm:text-sm font-extrabold">
            <span>🔥 {currentQuestion.repeatCount}x</span>
          </div>
        </div>

        {/* Dynamic Head-to-Head Scorebar */}
        <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-md flex items-center justify-between gap-2">
          {/* Player Side */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-lg shadow-sm shrink-0">
              {player.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">{player.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
                  {livePlayerScore}
                </span>
                {livePlayerCombo > 1 && (
                  <span className="text-[9px] sm:text-[10px] bg-orange-600/90 text-white font-bold px-1.5 py-0.2 rounded flex items-center">
                    <Flame className="w-2.5 h-2.5 mr-0.5 fill-white" />
                    {livePlayerCombo}x
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center Timer Ring */}
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-slate-800 sm:hidden"
                strokeWidth="3.5"
                fill="transparent"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className={`sm:hidden transition-all duration-300 ${
                  isTimerCritical ? 'stroke-rose-500' : isTimeFrozen ? 'stroke-sky-400' : 'stroke-amber-400'
                }`}
                strokeWidth="3.5"
                strokeDasharray={100.5}
                strokeDashoffset={100.5 * (1 - timerFraction)}
                strokeLinecap="round"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="19"
                className="stroke-slate-800 hidden sm:block"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="19"
                className={`hidden sm:block transition-all duration-300 ${
                  isTimerCritical ? 'stroke-rose-500' : isTimeFrozen ? 'stroke-sky-400' : 'stroke-amber-400'
                }`}
                strokeWidth="4"
                strokeDasharray={119.4}
                strokeDashoffset={119.4 * (1 - timerFraction)}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span
              className={`absolute text-xs sm:text-sm font-black font-mono ${
                isTimerCritical ? 'text-rose-400 animate-ping' : isTimeFrozen ? 'text-sky-300' : 'text-slate-100'
              }`}
            >
              {timeRemaining}
            </span>
          </div>

          {/* Opponent Side */}
          <div className="flex items-center justify-end gap-2 flex-1 min-w-0 text-right">
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                {matchState.opponent.name}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-sm sm:text-base font-black text-orange-400 font-mono">
                  {liveOpponentScore}
                </span>
                {opponentAnsweredState.answered && (
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      opponentAnsweredState.isCorrect ? 'bg-emerald-800 text-emerald-100' : 'bg-rose-900 text-rose-200'
                    }`}
                  >
                    {opponentAnsweredState.isCorrect ? '✓ IN' : '✗ OUT'}
                  </span>
                )}
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-lg shadow-sm shrink-0">
              {matchState.opponent.avatar}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Main Question Card & Options (Occupies remaining height stably) */}
      <div className="flex-1 min-h-0 flex flex-col justify-center space-y-2.5 sm:space-y-3.5 py-1 overflow-y-auto no-scrollbar">
        {/* Exam Past Occurrences Pill */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap shrink-0">
          {currentQuestion.examHistory.slice(0, 2).map((examTag, idx) => (
            <span
              key={idx}
              className="text-[10px] sm:text-xs bg-slate-800 text-sky-300 border border-slate-700/80 px-2 py-0.5 rounded-md font-semibold"
            >
              🏛️ {examTag}
            </span>
          ))}
          <span className="text-[10px] sm:text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-md font-bold">
            ⚡ 100% Guaranteed PYQ Pool
          </span>
        </div>

        {/* Question Statement Box */}
        <div className="shrink-0 bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/90 rounded-2xl p-3.5 sm:p-5 text-center shadow-lg relative">
          <div className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {currentQuestion.instruction || 'Select the most appropriate answer:'}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-wide break-words">
            "{currentQuestion.wordOrPhrase}"
          </h2>

          {/* Hindi Clue Reveal if powerup used */}
          {showHindiHint && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-200 text-xs animate-fadeIn">
              <span className="font-bold">हिन्दी अर्थ: </span>
              <span>{currentQuestion.hindiMeaning}</span>
              <div className="text-[10px] text-amber-300/80 mt-1 italic">
                💡 {currentQuestion.mnemonic}
              </div>
            </div>
          )}
        </div>

        {/* 4 Answer Option Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
          {currentQuestion.options.map((option, idx) => {
            const isEliminated = eliminatedOptions.includes(idx);
            const isChosen = selectedOption === idx;
            const isCorrectOption = idx === currentQuestion.correctIndex;

            let buttonStyle = 'bg-slate-800/90 border-slate-700/80 text-slate-200 hover:bg-slate-750 active:scale-[0.99] cursor-pointer';
            let iconElement = (
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 border border-slate-700 text-xs sm:text-sm font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
            );

            if (isEliminated) {
              buttonStyle = 'bg-slate-900/40 border-slate-800/40 text-slate-600 line-through opacity-40 pointer-events-none cursor-default';
            } else if (isAnswered) {
              if (isCorrectOption) {
                buttonStyle = 'bg-emerald-900/80 border-emerald-500 text-emerald-100 shadow-md shadow-emerald-950 font-bold ring-1 ring-emerald-400';
                iconElement = <Check className="w-5 h-5 text-emerald-400 shrink-0" />;
              } else if (isChosen && !isCorrectOption) {
                buttonStyle = 'bg-rose-900/80 border-rose-500 text-rose-100 shadow-md shadow-rose-950 font-bold ring-1 ring-rose-400 animate-shake';
                iconElement = <X className="w-5 h-5 text-rose-400 shrink-0" />;
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered || isEliminated || isWaitingForOpponent}
                onClick={() => handleSelectOption(idx)}
                className={`w-full p-3 sm:p-4 rounded-xl border text-left flex items-center gap-3 transition-all duration-150 relative min-h-[48px] sm:min-h-[54px] ${buttonStyle}`}
              >
                {iconElement}
                <span className="text-xs sm:text-sm font-bold flex-1 leading-snug">{option}</span>
                <span className="hidden md:inline-flex text-[10px] font-mono text-slate-500 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM: Powerups & Emote Trigger Bar (Firmly pinned to bottom) */}
      <div className="pt-2 sm:pt-3 pb-1 shrink-0 relative">
        {/* Lifelines / Combat Powerups */}
        <div className="flex items-center justify-between gap-2 sm:gap-2.5">
          {/* 50-50 Lifeline */}
          <button
            disabled={matchState.powerups.fiftyFiftyUsed || isAnswered || isWaitingForOpponent}
            onClick={handleUseFiftyFifty}
            className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[46px] ${
              matchState.powerups.fiftyFiftyUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-amber-500/50 text-amber-300 shadow-sm active:scale-95'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>50-50</span>
          </button>

          {/* Time Freeze Lifeline */}
          <button
            disabled={matchState.powerups.freezeTimeUsed || isTimeFrozen || isAnswered || isWaitingForOpponent}
            onClick={handleUseFreezeTime}
            className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[46px] ${
              matchState.powerups.freezeTimeUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-sky-500/50 text-sky-300 shadow-sm active:scale-95'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>+5s Freeze</span>
          </button>

          {/* Hindi Clue Lifeline */}
          <button
            disabled={matchState.powerups.hintUsed || showHindiHint || isAnswered || isWaitingForOpponent}
            onClick={handleUseHint}
            className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all min-h-[42px] sm:min-h-[46px] ${
              matchState.powerups.hintUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-purple-500/50 text-purple-300 shadow-sm active:scale-95'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>हिन्दी Hint</span>
          </button>

          {/* Live Emote / Taunt Launcher */}
          <button
            disabled={isWaitingForOpponent}
            onClick={() => {
              soundManager.playTap();
              setShowEmotePicker(prev => !prev);
            }}
            className={`p-2.5 sm:p-3 rounded-xl border transition-all active:scale-90 min-h-[42px] sm:min-h-[46px] flex items-center justify-center ${
              showEmotePicker
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
            }`}
            title="Send Reaction Emote"
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Emote Quick Bar Popup (Floats directly above the emoji button) */}
        {showEmotePicker && (
          <div className="absolute right-0 bottom-14 z-50 bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md animate-fadeIn flex flex-col gap-1.5 min-w-[220px]">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 border-b border-slate-800 pb-1">
              <span>Send Reaction</span>
              <button 
                onClick={() => setShowEmotePicker(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {['🔥', '👏', '🤯', '⚡', '💪', '😂', '🎯', '💀', '👑', '😱'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleSendEmote(emoji)}
                  className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-amber-500/30 active:scale-125 border border-slate-700 hover:border-amber-400 text-xl flex items-center justify-center transition-all"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leave Match Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-xs space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-600/50 flex items-center justify-center text-rose-400 mx-auto shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-100">
                Forfeit Active Duel?
              </h3>
              <p className="text-xs text-rose-400 font-bold">
                You will lose -15 LP by leaving now.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  soundManager.playWrong();
                  setShowLeaveConfirm(false);
                  if (isRealMatch && roomId) {
                    forfeitLiveRoom(roomId, myPlayerId).catch(console.warn);
                  }
                  onLeaveMatch();
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Yes, Forfeit (-15 LP)</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowLeaveConfirm(false);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold py-2 rounded-xl text-xs transition-all border border-slate-700"
              >
                Continue Playing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
