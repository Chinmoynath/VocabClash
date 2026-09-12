import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, ExamType, QuestionCategory, Question } from '../types';
import { soundManager } from '../utils/audio';
import { realtimeMatchmaker, MatchSuccessResult } from '../services/realtimeMatchmaking';
import { getSpeedBlitzSessionQuestions, deduplicateAndEnsureCount, getFilteredQuestions } from '../services/matchmakingService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Swords, X, Radio, WifiOff, RefreshCw, BookOpen } from 'lucide-react';

interface MatchmakingModalProps {
  player: PlayerProfile;
  initialBotOpponent: PlayerProfile;
  mode: string;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  onCancel: () => void;
  onReadyToFight: (
    finalOpponent: PlayerProfile, 
    isRealPlayer: boolean, 
    matchedQuestions?: Question[], 
    sharedRoomId?: string
  ) => void;
  onPlayOffline?: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  player,
  initialBotOpponent,
  mode,
  category,
  exam,
  onCancel,
  onReadyToFight,
  onPlayOffline,
}) => {
  const network = useNetworkStatus();
  const [searchStep, setSearchStep] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchedOpponent, setMatchedOpponent] = useState<PlayerProfile | null>(null);
  const [isRealOpponent, setIsRealOpponent] = useState<boolean>(false);
  const [matchedQuestions, setMatchedQuestions] = useState<Question[] | undefined>(undefined);
  const [sharedRoomId, setSharedRoomId] = useState<string | undefined>(undefined);
  const SEARCH_DURATION_SECONDS = 6;
  const [searchSecondsLeft, setSearchSecondsLeft] = useState<number>(SEARCH_DURATION_SECONDS);
  const [isRetryingOffline, setIsRetryingOffline] = useState<boolean>(false);

  const isMatchedRef = useRef<boolean>(false);

  // Active search countdown visual (5-8s window)
  useEffect(() => {
    if (searchStep >= 2 || !network.isOnline) return;
    setSearchSecondsLeft(SEARCH_DURATION_SECONDS);
    const interval = setInterval(() => {
      setSearchSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [searchStep, network.isOnline]);

  useEffect(() => {
    if (!network.isOnline) {
      realtimeMatchmaker.cancelMatchmaking();
      return;
    }

    isMatchedRef.current = false;
    const roundCount = mode === 'quick_duel' ? 10 : 20;

    // Connect to Firestore + Server dual-channel matchmaking queue
    realtimeMatchmaker.enterMatchQueue(
      player,
      category,
      exam,
      roundCount,
      // 1. Real Match Found: Triggered instantly when paired!
      (result: MatchSuccessResult) => {
        if (isMatchedRef.current) return;
        isMatchedRef.current = true;
        setIsRealOpponent(true);
        setMatchedOpponent(result.opponent);
        const uniqueQuestions = deduplicateAndEnsureCount(result.questions, category, exam, roundCount);
        setMatchedQuestions(uniqueQuestions);
        setSharedRoomId(result.roomId);
        setSearchStep(2);
        soundManager.playMatchFound();
        setTimeout(() => {
          setCountdown(3);
        }, 1000);
      },
      // 2. Fallback Callback: Exactly 5.0 seconds passed with no human -> start bot match
      () => {
        if (isMatchedRef.current) return;
        isMatchedRef.current = true;
        setIsRealOpponent(false);
        setMatchedOpponent(initialBotOpponent);
        const botQuestions = mode === 'quick_duel'
          ? getSpeedBlitzSessionQuestions(category, exam, roundCount)
          : getFilteredQuestions(category, exam, roundCount);
        setMatchedQuestions(botQuestions);
        setSearchStep(2);
        soundManager.playMatchFound();
        setTimeout(() => {
          setCountdown(3);
        }, 1000);
      }
    );

    return () => {
      realtimeMatchmaker.cancelMatchmaking();
    };
  }, [player, category, exam, mode, initialBotOpponent, network.isOnline]);

  // Countdown timer once match is found (3... 2... 1... GO!)
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 1) {
      const timer = setTimeout(() => {
        soundManager.playTick();
        setCountdown(countdown - 1);
      }, 900);
      return () => clearTimeout(timer);
    } else if (countdown === 1) {
      const timer = setTimeout(() => {
        soundManager.playTick();
        setCountdown(0);
        if (matchedOpponent) {
          onReadyToFight(matchedOpponent, isRealOpponent, matchedQuestions, sharedRoomId);
        }
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [countdown, matchedOpponent, isRealOpponent, matchedQuestions, sharedRoomId, onReadyToFight]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
        {/* Cancel button if still searching */}
        {searchStep < 2 && (
          <button
            onClick={() => {
              soundManager.playTap();
              realtimeMatchmaker.cancelMatchmaking();
              onCancel();
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {!network.isOnline && searchStep < 2 ? (
          /* Offline Search Interrupted View */
          <div className="py-6 space-y-4 flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto animate-pulse">
              <WifiOff className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
                <span>Search Paused • Offline</span>
              </div>
              <h3 className="text-lg font-black text-white">
                No Internet Connection
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                1v1 matchmaking requires an active internet connection to match aspirants.
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              {onPlayOffline && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onCancel();
                    onPlayOffline();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Play Solo Practice Offline</span>
                </button>
              )}

              <button
                onClick={async () => {
                  soundManager.playTap();
                  setIsRetryingOffline(true);
                  await network.checkConnection();
                  setIsRetryingOffline(false);
                }}
                disabled={isRetryingOffline}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRetryingOffline ? 'animate-spin' : ''}`} />
                <span>{isRetryingOffline ? 'Checking connection...' : 'Retry Connection'}</span>
              </button>
            </div>
          </div>
        ) : searchStep < 2 ? (
          /* Radar Scanning View */
          <div className="py-7 space-y-5 flex flex-col items-center w-full">
            {/* Animated Radar */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping opacity-30"></div>
              <div className="absolute inset-2 rounded-full border border-amber-500/30 animate-pulse"></div>
              <div className="absolute inset-6 rounded-full border border-amber-500/40"></div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-2xl shadow-xl z-10">
                {player.avatar}
              </div>
              <div className="absolute inset-0 rounded-full border-t-2 border-amber-400 animate-spin"></div>
            </div>

            <div className="space-y-2 w-full">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>All-India Online Lobby</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-100">
                Finding Live Opponent ({searchSecondsLeft}s)
              </h3>
              <p className="text-xs text-slate-400">
                Category: <span className="text-amber-300 font-bold capitalize">{category === 'mixed' ? 'Mixed PYQs' : category}</span>
              </p>
              <div className="w-44 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden border border-slate-700/50 mt-1">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, (searchSecondsLeft / SEARCH_DURATION_SECONDS) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Match Found VS View */
          <div className="w-full py-2 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-black tracking-wide shadow-lg shadow-emerald-950/50 animate-bounce">
              <Swords className="w-4 h-4 text-emerald-400" />
              <span>OPPONENT FOUND!</span>
            </div>

            {/* Head-to-Head Split Card */}
            <div className="grid grid-cols-2 gap-3 relative py-2">
              {/* Player Side */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 flex flex-col items-center text-center shadow-md">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                  {player.avatar}
                </div>
                <div className="font-bold text-xs text-slate-100 truncate w-full">{player.name}</div>
                <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{player.targetExam}</div>
              </div>

              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-slate-900 flex items-center justify-center font-black text-[11px] text-slate-950 shadow-xl z-20">
                VS
              </div>

              {/* Opponent Side */}
              {matchedOpponent && (
                <div className="bg-slate-800/80 border border-orange-700/40 rounded-2xl p-3 flex flex-col items-center text-center shadow-md">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                    {matchedOpponent.avatar}
                  </div>
                  <div className="font-bold text-xs text-slate-100 truncate w-full">{matchedOpponent.name}</div>
                  <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{matchedOpponent.targetExam}</div>
                </div>
              )}
            </div>

            {/* Countdown to Battle */}
            <div className="pt-2">
              <div className="text-3xl font-black text-amber-400 font-mono animate-ping">
                {countdown !== null && countdown > 0 ? countdown : 'GO!'}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">
                Starting Vocab Duel...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
