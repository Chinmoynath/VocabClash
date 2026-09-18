import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Timer, 
  TrendingUp, 
  CheckCircle2, 
  Play, 
  Clock, 
  Percent, 
  Target,
  BarChart2
} from 'lucide-react';
import { PlayerProfile } from '../types';
import { 
  DailyChallengeAttempt, 
  getDailyChallengeHistory, 
  getTodayChallengeAttempt, 
  formatDuration,
  getTimeUntilNextReset,
  syncDailyChallengeWithBackend
} from '../services/dailyChallengeService';
import { DailyChallengeQuizModal } from './DailyChallengeQuizModal';
import { DailyChallengePerformanceModal } from './DailyChallengePerformanceModal';
import { soundManager } from '../utils/audio';

interface DailyChallengeCardProps {
  player: PlayerProfile;
  onLpUpdated?: () => void;
  onChallengeCompleted?: () => void;
}

export const DailyChallengeCard: React.FC<DailyChallengeCardProps> = ({ player, onLpUpdated, onChallengeCompleted }) => {
  const [history, setHistory] = useState<DailyChallengeAttempt[]>([]);
  const [todayAttempt, setTodayAttempt] = useState<DailyChallengeAttempt | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [resetCountdown, setResetCountdown] = useState<string>('');

  const refreshChallengeState = () => {
    const hist = getDailyChallengeHistory(player?.id);
    const today = getTodayChallengeAttempt(player?.id);
    setHistory(hist);
    setTodayAttempt(today);
  };

  useEffect(() => {
    refreshChallengeState();

    // Sync genuine history with backend and sanitize any cross-account leaks
    syncDailyChallengeWithBackend(player?.id, player?.email).then(() => {
      refreshChallengeState();
    });

    const handleChallengeUpdate = () => {
      refreshChallengeState();
    };

    window.addEventListener('daily-challenge-updated', handleChallengeUpdate);

    const interval = setInterval(() => {
      const { hours, minutes } = getTimeUntilNextReset();
      setResetCountdown(`${hours}h ${minutes}m`);
    }, 1000);

    return () => {
      window.removeEventListener('daily-challenge-updated', handleChallengeUpdate);
      clearInterval(interval);
    };
  }, [player?.id, player?.email]);

  const handleChallengeComplete = (attempt: DailyChallengeAttempt) => {
    refreshChallengeState();
    if (onLpUpdated) {
      onLpUpdated();
    }
  };

  const isCompleted = todayAttempt !== null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-850/90 hover:border-slate-700/80 p-3 sm:p-3.5 transition-all shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          
          {/* Left / Top: Title & Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isCompleted 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              <Flame className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wide text-slate-100 uppercase">
                  Daily Challenge
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  20 Qs • 2 min
                </span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Done
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded-md border border-amber-500/20">
                    1x Daily
                  </span>
                )}
              </div>

              {/* Status / Score Summary Subtitle */}
              {isCompleted && todayAttempt ? (
                <div className="flex items-center gap-3 text-xs mt-0.5 text-slate-300 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Target className="w-3 h-3 text-amber-400" />
                    <span className="text-slate-400 text-[11px]">Marks:</span>
                    <strong className="font-mono text-amber-300">{todayAttempt.score}/{todayAttempt.maxMarks}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Percent className="w-3 h-3 text-emerald-400" />
                    <span className="text-slate-400 text-[11px]">Accuracy:</span>
                    <strong className="font-mono text-emerald-300">{todayAttempt.percentage}%</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span className="text-slate-400 text-[11px]">Speed:</span>
                    <strong className="font-mono text-sky-300">{formatDuration(todayAttempt.timeTakenSeconds)}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Test your speed & accuracy • Resets in {resetCountdown}
                </p>
              )}
            </div>
          </div>

          {/* Right / Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto">
            {/* Report Button */}
            <button
              onClick={() => {
                soundManager.playTap();
                setIsReportOpen(true);
              }}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              title="View performance report and line graph"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Report</span>
            </button>

            {/* Play Button if not yet completed */}
            {!isCompleted && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  setIsQuizOpen(true);
                }}
                className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-sm shadow-amber-500/20 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Play className="w-3 h-3 fill-slate-950" />
                <span>Start</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      <DailyChallengeQuizModal
        isOpen={isQuizOpen}
        onClose={() => {
          setIsQuizOpen(false);
          if (todayAttempt || getTodayChallengeAttempt(player?.id)) {
            onChallengeCompleted?.();
          }
        }}
        player={player}
        onChallengeComplete={(attempt) => {
          handleChallengeComplete(attempt);
        }}
        onOpenReport={() => {
          setIsQuizOpen(false);
          setIsReportOpen(true);
        }}
      />

      {/* Performance Report Line Graph Modal */}
      <DailyChallengePerformanceModal
        isOpen={isReportOpen}
        onClose={() => {
          setIsReportOpen(false);
          if (todayAttempt || getTodayChallengeAttempt(player?.id)) {
            onChallengeCompleted?.();
          }
        }}
        history={history}
        todayAttempt={todayAttempt}
      />
    </>
  );
};
