import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Clock, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  Settings2, 
  ChevronRight, 
  Gift, 
  Check, 
  X,
  Sliders,
  TrendingUp,
  Zap
} from 'lucide-react';
import { 
  getDailyTargetState, 
  saveDailyTargetConfig, 
  claimDailyTargetReward, 
  getTimeUntilMidnight,
  MIN_DAILY_TARGET,
  MAX_DAILY_TARGET,
  DEFAULT_DAILY_TARGET,
  DailyTargetState
} from '../utils/dailyTargetManager';
import { soundManager } from '../utils/audio';

interface DailyTargetCardProps {
  onStartMatchmaking?: (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => void;
  onNavigateTab?: (tab: 'arena' | 'practice' | 'leaderboard' | 'mistakes' | 'ai_coach') => void;
  onRewardLP: (lpDelta: number, reason: string) => void;
}

export const DailyTargetCard: React.FC<DailyTargetCardProps> = ({
  onStartMatchmaking,
  onNavigateTab,
  onRewardLP,
}) => {
  const [state, setState] = useState<DailyTargetState>(() => getDailyTargetState());
  const [timeLeft, setTimeLeft] = useState<string>(() => getTimeUntilMidnight().formatted);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [customTargetInput, setCustomTargetInput] = useState<number>(() => state.targetQuestions);
  const [claimToast, setClaimToast] = useState<{ message: string; lp: number } | null>(null);

  // Sync state on updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<DailyTargetState>;
      if (customEvent.detail) {
        setState(customEvent.detail);
        setCustomTargetInput(customEvent.detail.targetQuestions);
      } else {
        const fresh = getDailyTargetState();
        setState(fresh);
        setCustomTargetInput(fresh.targetQuestions);
      }
    };

    window.addEventListener('daily-target-updated', handleUpdate);
    return () => window.removeEventListener('daily-target-updated', handleUpdate);
  }, []);

  // Countdown timer to midnight
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight().formatted);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const solved = state.questionsSolvedToday;
  const target = state.targetQuestions;
  const isCompleted = solved >= target;
  const isClaimed = state.isRewardClaimed;
  const percentage = Math.min(100, Math.round((solved / target) * 100));
  const remaining = Math.max(0, target - solved);

  const potentialRewardLP = 50 + Math.floor((target / 10) * 5);

  const handleClaim = () => {
    soundManager.playTap();
    const result = claimDailyTargetReward();
    if (result.success) {
      soundManager.playVictory();
      setState(result.state);
      onRewardLP(result.rewardLP, `Daily Target of ${target} Questions Completed`);
      setClaimToast({
        message: `🎯 DAILY TARGET COMPLETED! +${result.rewardLP} LP Claimed!`,
        lp: result.rewardLP,
      });
      setTimeout(() => setClaimToast(null), 3000);
    }
  };

  const handleSaveSettings = (newVal?: number) => {
    soundManager.playTap();
    const valToSave = newVal !== undefined ? newVal : customTargetInput;
    const clamped = Math.max(MIN_DAILY_TARGET, Math.min(MAX_DAILY_TARGET, Math.round(valToSave)));
    saveDailyTargetConfig({ targetQuestions: clamped });
    setCustomTargetInput(clamped);
    setShowSettings(false);
  };

  const handleQuickAction = () => {
    soundManager.playTap();
    if (onNavigateTab) {
      onNavigateTab('practice');
    } else if (onStartMatchmaking) {
      onStartMatchmaking('1v1_ranked');
    }
  };

  return (
    <div 
      id="daily-target-container"
      className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 shadow-xl relative overflow-hidden space-y-3 transition-all"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Claim Toast */}
      {claimToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-amber-200 animate-bounce">
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>{claimToast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-400">
            <Target className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                Daily Question Target
              </h3>
              <span className="bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                <span>+{potentialRewardLP} LP</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              {isCompleted ? (
                <span className="text-emerald-400 font-bold">🎉 Target achieved! Claim your bonus LP reward.</span>
              ) : (
                <span>Solve <b className="text-amber-300">{remaining} more questions</b> today to complete.</span>
              )}
            </p>
          </div>
        </div>

        {/* Target Settings Toggle Button */}
        <button
          onClick={() => {
            soundManager.playTap();
            setShowSettings(!showSettings);
          }}
          className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition-all ${
            showSettings
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
          }`}
          title="Customize Daily Target (20 to 500 questions)"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold hidden sm:inline">Target: {target}</span>
        </button>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="bg-slate-950/90 border border-amber-500/50 rounded-xl p-3 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              Set Your Daily Goal (Min 20, Max 500):
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[20, 30, 50, 100, 200, 500].map(val => (
              <button
                key={val}
                onClick={() => {
                  setCustomTargetInput(val);
                  handleSaveSettings(val);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all shrink-0 ${
                  target === val
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {val === 30 ? '30 (Default)' : val}
              </button>
            ))}
          </div>

          {/* Slider & Number Input */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              min={MIN_DAILY_TARGET}
              max={MAX_DAILY_TARGET}
              step={5}
              value={customTargetInput}
              onChange={(e) => setCustomTargetInput(Number(e.target.value))}
              className="flex-1 accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={MIN_DAILY_TARGET}
                max={MAX_DAILY_TARGET}
                value={customTargetInput}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCustomTargetInput(val);
                }}
                className="w-16 bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs p-1.5 rounded-lg text-center font-mono"
              />
              <button
                onClick={() => handleSaveSettings()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar & Solved Status */}
      <div className="space-y-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-slate-300">Progress:</span>
            <span className="text-amber-400 font-mono text-sm font-black">{solved}</span>
            <span className="text-slate-500 font-mono">/ {target} questions</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`font-bold font-mono text-xs ${
              isCompleted ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {percentage}%
            </span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono border-l border-slate-800 pl-2">
              <Clock className="w-3 h-3 text-sky-400" />
              <span>{timeLeft}</span>
            </div>
          </div>
        </div>

        {/* The Progress Bar */}
        <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-slate-700/60 relative p-0.5 shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-500 relative flex items-center justify-end pr-1 shadow-md ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400' 
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400'
            }`}
            style={{ width: `${Math.max(4, percentage)}%` }}
          >
            {percentage >= 25 && (
              <span className="text-[9px] font-black text-slate-950 font-mono leading-none">
                {percentage}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action / Claim Footer */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Counts 1v1 Matches & PYQ Drill practice</span>
        </div>

        <div>
          {isClaimed ? (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1.5 rounded-xl shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Reward Claimed ✓</span>
            </div>
          ) : isCompleted ? (
            <button
              onClick={handleClaim}
              id="claim-daily-target-reward-btn"
              className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:from-amber-300 hover:to-orange-300 active:scale-95 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-amber-100 animate-bounce"
            >
              <Gift className="w-3.5 h-3.5 fill-slate-950" />
              <span>CLAIM +{potentialRewardLP} LP</span>
            </button>
          ) : (
            <button
              onClick={handleQuickAction}
              className="bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-sky-400/40 flex items-center gap-1 shadow-md transition-all"
            >
              <span>Practice Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
