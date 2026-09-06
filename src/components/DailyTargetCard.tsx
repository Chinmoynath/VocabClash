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

  // Countdown timer to midnight & active midnight reset detector
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeUntilMidnight();
      setTimeLeft(remaining.formatted);

      // Check if midnight passed and date has transitioned
      const fresh = getDailyTargetState();
      if (fresh.date !== state.date) {
        setState(fresh);
        setCustomTargetInput(fresh.targetQuestions);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.date]);

  const solved = state.questionsSolvedToday;
  const target = state.targetQuestions;
  const isCompleted = solved >= target;
  const isClaimed = state.isRewardClaimed;
  const displaySolved = isCompleted ? target : Math.min(solved, target);
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
        message: `🎯 DAILY TARGET COMPLETED! +${result.rewardLP} LP Claimed! Come back tomorrow for your next target.`,
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
      className="bg-gradient-to-br from-slate-900/95 via-slate-850/95 to-slate-900/95 border border-amber-500/30 rounded-2xl p-3 shadow-lg relative overflow-hidden space-y-2.5 transition-all"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Claim Toast */}
      {claimToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-amber-200 animate-bounce">
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>{claimToast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="p-1.5 bg-amber-500/15 border border-amber-400/30 rounded-xl text-amber-400 shrink-0">
            <Target className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 truncate">
                Daily Target
              </h3>
              {isCompleted ? (
                <span className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap shadow-sm">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Target Complete</span>
                </span>
              ) : (
                <span className="bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap shadow-sm">
                  <Flame className="w-2.5 h-2.5 fill-orange-400 text-orange-400" />
                  <span>+{potentialRewardLP} LP</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
              {isCompleted ? (
                <span className="text-emerald-300 font-semibold">
                  Come back tomorrow for your next <b className="text-amber-300 font-black">+{potentialRewardLP} LP</b> target.
                </span>
              ) : (
                <span>Solve <b className="text-amber-300">{remaining} more Qs</b> today to complete.</span>
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
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ml-1 active:scale-95 shadow-sm ${
            showSettings
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
              : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700/80 text-slate-200'
          }`}
          title="Customize Daily Target (20 to 500 questions)"
        >
          <Sliders className="w-3 h-3 text-amber-400" />
          <span>{target} Qs</span>
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
            {[20, 30, 50, 100, 200, 400, 500].map(val => (
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
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          {isCompleted ? (
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-emerald-400 font-mono font-black">{target}/{target}</span>
              <span className="text-emerald-400 font-black">✓</span>
              <span className="text-emerald-300 font-extrabold">Daily Target Complete</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-slate-400">Progress:</span>
              <span className="text-amber-400 font-mono font-black">{displaySolved}</span>
              <span className="text-slate-500 font-mono">/ {target} questions</span>
              <span className="text-amber-400/90 font-bold ml-0.5">({percentage}%)</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>{timeLeft}</span>
          </div>
        </div>

        {/* The Progress Bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 relative shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-sm shadow-emerald-500/50' 
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-sm shadow-orange-500/50'
            }`}
            style={{ width: isCompleted ? '100%' : `${Math.max(2, percentage)}%` }}
          />
        </div>
      </div>

      {/* Action / Claim Footer */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">
            {isCompleted
              ? `Next +${potentialRewardLP} LP target unlocks tomorrow`
              : 'Counts 1v1 Matches & Drill practice'}
          </span>
        </div>

        <div>
          {isClaimed ? (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-1 rounded-lg shadow-sm">
              <CheckCircle2 className="w-3 h-3" />
              <span>Claimed ✓</span>
            </div>
          ) : isCompleted ? (
            <button
              onClick={handleClaim}
              id="claim-daily-target-reward-btn"
              className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:from-amber-300 hover:to-orange-300 active:scale-95 text-slate-950 font-black text-xs px-3 py-1 rounded-lg shadow-md flex items-center gap-1 border border-amber-100 animate-bounce"
            >
              <Gift className="w-3 h-3 fill-slate-950" />
              <span>CLAIM +{potentialRewardLP} LP</span>
            </button>
          ) : (
            <button
              onClick={handleQuickAction}
              className="bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl border border-sky-400/40 flex items-center gap-1 shadow-sm transition-all"
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
