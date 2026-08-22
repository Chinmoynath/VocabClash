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
  listenToDuelRoom,
  updatePlayerRoomProgress,
  sendDuelRoomEmote,
  cancelOrLeaveDuelRoom,
  DuelRoomData
} from '../services/multiplayerService';
import { soundManager } from '../utils/audio';
import { 
  Zap, 
  Clock, 
  HelpCircle, 
  Flame, 
  Shield, 
  Check, 
  X, 
  Sparkles, 
  Smile, 
  Info,
  ChevronRight,
  TrendingUp,
  LogOut,
  AlertTriangle,
  WifiOff
} from 'lucide-react';

interface LiveDuelArenaProps {
  player: PlayerProfile;
  matchState: MatchState;
  roomCode?: string;
  role?: 'host' | 'guest';
  onAnswerQuestion: (
    playerAnswer: PlayerAnswerRecord,
    opponentAnswer: PlayerAnswerRecord,
    updatedScores: { playerScore: number; opponentScore: number; combo: number; opponentCombo: number }
  ) => void;
  onCompleteMatch: () => void;
  onSendEmote: (emoji: string) => void;
  onLeaveMatch: () => void;
}

const ROUND_TIME_SEC = 15;

export const LiveDuelArena: React.FC<LiveDuelArenaProps> = ({
  player,
  matchState,
  roomCode,
  role,
  onAnswerQuestion,
  onCompleteMatch,
  onSendEmote,
  onLeaveMatch,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [opponentDisconnected, setOpponentDisconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to multiplayer room updates in real-time
  useEffect(() => {
    if (!roomCode || !role) return;

    const unsub = listenToDuelRoom(
      roomCode,
      (updatedRoom) => {
        if (updatedRoom.status === 'abandoned') {
          setOpponentDisconnected(true);
          return;
        }

        const oppEmote = role === 'host' ? updatedRoom.guestEmote : updatedRoom.hostEmote;
        if (oppEmote && oppEmote.timestamp > (Date.now() - 3000)) {
          triggerFloatingEmote('opponent', oppEmote.emoji, oppEmote.text);
        }

        const oppIndex = role === 'host' ? updatedRoom.guestCurrentIndex : updatedRoom.hostCurrentIndex;
        if (oppIndex > matchState.currentQuestionIndex) {
          setOpponentAnsweredState({
            answered: true,
            isCorrect: true,
            points: 100,
          });
        }
      },
      (err) => {
        console.warn('Live duel room error:', err);
      }
    );

    return () => unsub();
  }, [roomCode, role, matchState.currentQuestionIndex]);

  const currentQIndex = matchState.currentQuestionIndex;
  const currentQuestion = matchState.questions[currentQIndex];

  const [timeRemaining, setTimeRemaining] = useState<number>(ROUND_TIME_SEC);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
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
  const opponentAnswerResultRef = useRef<{ selectedIndex: number; timeTakenMs: number; isCorrect: boolean } | null>(null);

  // Reset for each new question
  useEffect(() => {
    setTimeRemaining(ROUND_TIME_SEC);
    setSelectedOption(null);
    setIsAnswered(false);
    setEliminatedOptions([]);
    setIsTimeFrozen(false);
    setShowHindiHint(false);
    setOpponentAnsweredState({ answered: false, isCorrect: false, points: 0 });
    questionStartTimeRef.current = Date.now();

    // Prepare opponent simulated answer
    if (currentQuestion) {
      const oppResult = simulateOpponentAnswer(
        currentQuestion,
        matchState.opponent.accuracyRate,
        ROUND_TIME_SEC
      );
      opponentAnswerResultRef.current = oppResult;

      // Schedule opponent answer event
      opponentTimerRef.current = setTimeout(() => {
        const oppScore = calculateScore(
          oppResult.isCorrect,
          ROUND_TIME_SEC - oppResult.timeTakenMs / 1000,
          ROUND_TIME_SEC,
          matchState.opponentCombo
        );
        setOpponentAnsweredState({
          answered: true,
          isCorrect: oppResult.isCorrect,
          points: oppScore,
        });

        // Chance of opponent sending a friendly reaction
        if (Math.random() < 0.35) {
          const randEmote = generateRandomOpponentEmote();
          triggerFloatingEmote('opponent', randEmote.emoji, randEmote.text);
        }
      }, oppResult.timeTakenMs);
    }

    return () => {
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [currentQIndex, currentQuestion]);

  // Main countdown timer
  useEffect(() => {
    if (isAnswered) return;

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
  }, [isAnswered, isTimeFrozen, currentQIndex]);

  const handleTimeExpired = () => {
    if (isAnswered) return;
    handleSelectOption(-1); // Timed out (unanswered)
  };

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedOption(index);

    const timeTakenMs = Date.now() - questionStartTimeRef.current;
    const isCorrect = index === currentQuestion.correctIndex;

    if (isCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    const newPlayerCombo = isCorrect ? matchState.comboStreak + 1 : 0;
    const playerScoreGained = calculateScore(isCorrect, timeRemaining, ROUND_TIME_SEC, newPlayerCombo);

    // Opponent answer resolving
    const oppResult = opponentAnswerResultRef.current || {
      selectedIndex: currentQuestion.correctIndex,
      timeTakenMs: 3000,
      isCorrect: true,
    };
    const newOppCombo = oppResult.isCorrect ? matchState.opponentCombo + 1 : 0;
    const oppScoreGained = calculateScore(
      oppResult.isCorrect,
      ROUND_TIME_SEC - oppResult.timeTakenMs / 1000,
      ROUND_TIME_SEC,
      newOppCombo
    );

    const playerRecord: PlayerAnswerRecord = {
      questionId: currentQuestion.id,
      selectedIndex: index,
      timeTakenMs,
      isCorrect,
      scoreGained: playerScoreGained,
    };

    const opponentRecord: PlayerAnswerRecord = {
      questionId: currentQuestion.id,
      selectedIndex: oppResult.selectedIndex,
      timeTakenMs: oppResult.timeTakenMs,
      isCorrect: oppResult.isCorrect,
      scoreGained: oppScoreGained,
    };

    // If active multiplayer room, sync progress to Firestore
    if (roomCode && role) {
      updatePlayerRoomProgress(roomCode, role, {
        score: Math.max(0, matchState.playerScore + playerScoreGained),
        currentIndex: currentQIndex + 1,
        combo: newPlayerCombo,
        finished: currentQIndex + 1 >= matchState.questions.length,
        answerRecord: playerRecord,
      }).catch(err => console.warn('Update player progress error:', err));
    }

    // Auto advance to next question or end match after short delay
    setTimeout(() => {
      onAnswerQuestion(playerRecord, opponentRecord, {
        playerScore: Math.max(0, matchState.playerScore + playerScoreGained),
        opponentScore: Math.max(0, matchState.opponentScore + oppScoreGained),
        combo: newPlayerCombo,
        opponentCombo: newOppCombo,
      });

      if (currentQIndex + 1 >= matchState.questions.length) {
        onCompleteMatch();
      }
    }, 1600);
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
    onSendEmote(emoji);
    if (roomCode && role) {
      sendDuelRoomEmote(roomCode, role, emoji).catch(err => console.warn('Send room emote error:', err));
    }
    setShowEmotePicker(false);
  };

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
    <div className="flex-1 flex flex-col justify-between p-3.5 space-y-3 pb-5 relative min-h-full">
      {/* Opponent Disconnected / Left Notice */}
      {opponentDisconnected && (
        <div className="bg-amber-950/95 border-2 border-amber-500/90 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-amber-100 z-50 animate-bounce">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏆</span>
            <div>
              <div className="font-black text-xs sm:text-sm">Opponent Left the Match!</div>
              <div className="text-[11px] text-amber-300/90">Victory awarded to you. Tap to claim result.</div>
            </div>
          </div>
          <button
            onClick={onCompleteMatch}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs shrink-0 shadow-lg"
          >
            Claim Victory
          </button>
        </div>
      )}

      {/* Offline Alert Banner in Live Duel */}
      {!isOnline && (
        <div className="bg-red-950/95 border-2 border-red-500/90 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-red-100 z-50">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
            <span className="font-black text-xs sm:text-sm">
              arena connection failed: please connect to the internet to play 1v1 battles
            </span>
          </div>
          <button
            onClick={onLeaveMatch}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shrink-0"
          >
            Leave Match
          </button>
        </div>
      )}

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

      {/* TOP: Split Live Score Arena Header & Leave Match Option */}
      <div className="space-y-2 shrink-0">
        {/* Round number, Leave Match Button & Exam tag */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {/* Leave Match / Exit Button */}
            <button
              onClick={() => {
                soundManager.playTap();
                setShowLeaveConfirm(true);
              }}
              className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 shadow-sm"
              title="Leave match and return to lobby"
            >
              <LogOut className="w-3 h-3" />
              <span>Leave</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300 font-semibold">
              <span>Round {currentQIndex + 1}/{matchState.questions.length}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 uppercase font-mono text-[10px]">
                {currentQuestion.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-700/60 text-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
            <span>🔥 Repeat {currentQuestion.repeatCount}x</span>
          </div>
        </div>

        {/* Dynamic Head-to-Head Scorebar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 shadow-md flex items-center justify-between gap-2">
          {/* Player Side */}
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-lg shadow-sm shrink-0">
              {player.avatar}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-200 truncate">{player.name}</div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-amber-400 font-mono">
                  {matchState.playerScore}
                </span>
                {matchState.comboStreak > 1 && (
                  <span className="text-[9px] bg-orange-600/90 text-white font-bold px-1 rounded flex items-center">
                    <Flame className="w-2.5 h-2.5 mr-0.5 fill-white" />
                    {matchState.comboStreak}x
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center Timer Ring */}
          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                className="stroke-slate-800"
                strokeWidth="3.5"
                fill="transparent"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                className={`transition-all duration-300 ${
                  isTimerCritical ? 'stroke-rose-500' : isTimeFrozen ? 'stroke-sky-400' : 'stroke-amber-400'
                }`}
                strokeWidth="3.5"
                strokeDasharray={113.1}
                strokeDashoffset={113.1 * (1 - timerFraction)}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span
              className={`absolute text-xs font-black font-mono ${
                isTimerCritical ? 'text-rose-400 animate-ping' : isTimeFrozen ? 'text-sky-300' : 'text-slate-100'
              }`}
            >
              {timeRemaining}
            </span>
          </div>

          {/* Opponent Side */}
          <div className="flex items-center justify-end gap-2 flex-1 text-right">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-200 truncate">
                {matchState.opponent.name}
              </div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm font-black text-orange-400 font-mono">
                  {matchState.opponentScore}
                </span>
                {opponentAnsweredState.answered && (
                  <span
                    className={`text-[9px] font-bold px-1 rounded ${
                      opponentAnsweredState.isCorrect ? 'bg-emerald-800 text-emerald-100' : 'bg-rose-900 text-rose-200'
                    }`}
                  >
                    {opponentAnsweredState.isCorrect ? '✓ IN' : '✗ OUT'}
                  </span>
                )}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-lg shadow-sm shrink-0">
              {matchState.opponent.avatar}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Main Question Card */}
      <div className="my-auto space-y-3 py-1">
        {/* Exam Past Occurrences Pill */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {currentQuestion.examHistory.slice(0, 2).map((examTag, idx) => (
            <span
              key={idx}
              className="text-[10px] bg-slate-800 text-sky-300 border border-slate-700/80 px-2 py-0.5 rounded-md font-semibold"
            >
              🏛️ {examTag}
            </span>
          ))}
          <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-md font-bold">
            ⚡ 100% Guaranteed PYQ Pool
          </span>
        </div>

        {/* Question Statement Box */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/90 rounded-2xl p-4 text-center shadow-lg relative">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {currentQuestion.instruction || 'Select the most appropriate answer:'}
          </div>

          <h2 className="text-xl font-black text-amber-300 tracking-wide break-words">
            "{currentQuestion.wordOrPhrase}"
          </h2>

          {/* Hindi Clue Reveal if powerup used */}
          {showHindiHint && (
            <div className="mt-2.5 p-2 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-200 text-xs animate-fadeIn">
              <span className="font-bold">हिन्दी अर्थ: </span>
              <span>{currentQuestion.hindiMeaning}</span>
              <div className="text-[10px] text-amber-300/80 mt-1 italic">
                💡 {currentQuestion.mnemonic}
              </div>
            </div>
          )}
        </div>

        {/* 4 Answer Option Buttons */}
        <div className="grid grid-cols-1 gap-2">
          {currentQuestion.options.map((option, idx) => {
            const isEliminated = eliminatedOptions.includes(idx);
            const isChosen = selectedOption === idx;
            const isCorrectOption = idx === currentQuestion.correctIndex;

            let buttonStyle = 'bg-slate-800/90 border-slate-700/80 text-slate-200 hover:bg-slate-750 active:scale-[0.99]';
            let iconElement = (
              <span className="w-5 h-5 rounded-md bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
            );

            if (isEliminated) {
              buttonStyle = 'bg-slate-900/40 border-slate-800/40 text-slate-600 line-through opacity-40 pointer-events-none';
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
                disabled={isAnswered || isEliminated}
                onClick={() => handleSelectOption(idx)}
                className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-150 relative ${buttonStyle}`}
              >
                {iconElement}
                <span className="text-xs font-semibold flex-1 leading-snug">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM: Powerups & Emote Trigger Bar */}
      <div className="pt-2 shrink-0 relative">
        {/* Lifelines / Combat Powerups */}
        <div className="flex items-center justify-between gap-2">
          {/* 50-50 Lifeline */}
          <button
            disabled={matchState.powerups.fiftyFiftyUsed || isAnswered}
            onClick={handleUseFiftyFifty}
            className={`flex-1 py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              matchState.powerups.fiftyFiftyUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-amber-500/50 text-amber-300 shadow-sm active:scale-95'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>50-50</span>
          </button>

          {/* Time Freeze Lifeline */}
          <button
            disabled={matchState.powerups.freezeTimeUsed || isAnswered}
            onClick={handleUseFreezeTime}
            className={`flex-1 py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              matchState.powerups.freezeTimeUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-sky-500/50 text-sky-300 shadow-sm active:scale-95'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>+5s Freeze</span>
          </button>

          {/* Hindi Clue Lifeline */}
          <button
            disabled={matchState.powerups.hintUsed || isAnswered}
            onClick={handleUseHint}
            className={`flex-1 py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              matchState.powerups.hintUsed
                ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-50'
                : 'bg-slate-800 hover:bg-slate-700 border-purple-500/50 text-purple-300 shadow-sm active:scale-95'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>हिन्दी Hint</span>
          </button>

          {/* Live Emote / Taunt Launcher */}
          <button
            onClick={() => {
              soundManager.playTap();
              setShowEmotePicker(prev => !prev);
            }}
            className={`p-2.5 rounded-xl border transition-all active:scale-90 ${
              showEmotePicker
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
            }`}
            title="Send Reaction Emote"
          >
            <Smile className="w-5 h-5" />
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

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-100">
                Leave Active Duel?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Leaving this match will forfeit your current round progress and return you to the main arena lobby.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowLeaveConfirm(false);
                  onLeaveMatch();
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Yes, Forfeit & Return to Lobby</span>
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

