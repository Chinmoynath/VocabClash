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
  X,
  Sliders,
  Zap,
  Gauge,
  Trophy,
  Activity
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
import { trackPyqDrillStarted } from '../services/analyticsService';

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
        message: `🎯 SPEEDOMETER TARGET HIT! +${result.rewardLP} LP Claimed!`,
        lp: result.rewardLP,
      });
      setTimeout(() => setClaimToast(null), 3200);
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
      trackPyqDrillStarted({
        target_exam: 'all',
        category: 'mixed',
      });
      onNavigateTab('practice');
    } else if (onStartMatchmaking) {
      onStartMatchmaking('1v1_ranked');
    }
  };

  // Speedometer Geometry
  const arcRadius = 90;
  const centerCX = 130;
  const centerCY = 120;
  const arcLength = Math.PI * arcRadius; // ≈ 282.74
  const strokeOffset = arcLength * (1 - Math.min(1, Math.max(0, percentage / 100)));

  // Needle angle: -90° (at 0%) to +90° (at 100%)
  const needleAngle = -90 + (Math.min(100, Math.max(0, percentage)) / 100) * 180;

  // Tip indicator coordinates
  const tipAngleRad = (180 - (Math.min(100, Math.max(0, percentage)) / 100) * 180) * (Math.PI / 180);
  const tipX = centerCX + arcRadius * Math.cos(tipAngleRad);
  const tipY = centerCY - arcRadius * Math.sin(tipAngleRad);

  // Speed zone categorization
  const getVelocityStatus = () => {
    if (isCompleted) {
      return {
        label: 'MAX SPEED • GOAL CRUSHED!',
        badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-400/60 shadow-emerald-500/20',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      };
    }
    if (percentage >= 80) {
      return {
        label: `TURBO BOOST • ${percentage}% PACE`,
        badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-500/60 shadow-orange-500/25 animate-pulse',
        icon: <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
      };
    }
    if (percentage >= 40) {
      return {
        label: `HIGH VELOCITY • ${percentage}% SPEED`,
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-amber-500/20',
        icon: <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
      };
    }
    if (percentage > 0) {
      return {
        label: `ACCELERATING • ${percentage}%`,
        badgeClass: 'bg-cyan-950/80 text-[#00C4EE] border-[#00C4EE]/50 shadow-cyan-500/20',
        icon: <Activity className="w-3.5 h-3.5 text-[#00C4EE]" />
      };
    }
    return {
      label: 'IDLE AT 0 MPH • TAP TO ACCELERATE',
      badgeClass: 'bg-slate-850 text-slate-300 border-slate-700',
      icon: <Gauge className="w-3.5 h-3.5 text-[#00C4EE]" />
    };
  };

  const velocityInfo = getVelocityStatus();

  return (
    <div 
      id="daily-target-speedometer-card"
      className="bg-gradient-to-b from-[#0b1322] via-[#0d1629] to-[#0a0f1d] border border-cyan-500/25 rounded-2xl p-3 sm:p-4 shadow-xl relative overflow-hidden space-y-3 transition-all"
    >
      {/* Background ambient lighting glows: Cyan aura on left, Amber aura on right */}
      <div className="absolute -top-10 -left-10 w-36 h-36 bg-[#00C4EE]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Claim Toast */}
      {claimToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-[#00C4EE] via-amber-400 to-orange-500 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-cyan-200 animate-bounce">
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>{claimToast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-gradient-to-br from-[#00C4EE]/20 to-amber-500/20 border border-[#00C4EE]/40 rounded-xl text-[#00C4EE] shrink-0 shadow-sm">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                <span>Daily Target</span>
                <span className="text-[10px] text-[#00C4EE] font-mono font-bold tracking-normal uppercase bg-[#00C4EE]/10 border border-[#00C4EE]/30 px-1.5 py-0.5 rounded-md">
                  Speedometer
                </span>
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#00C4EE] shrink-0" />
              <span>Resets in <b className="text-cyan-300 font-mono">{timeLeft}</b></span>
            </p>
          </div>
        </div>

        {/* Goal Preset / Edit Pill: styled with the vibrant Electric Cyan matching user's image */}
        <button
          onClick={() => {
            soundManager.playTap();
            setShowSettings(!showSettings);
          }}
          className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm ${
            showSettings
              ? 'bg-amber-400 text-slate-950 border border-amber-300'
              : 'bg-[#00C4EE] hover:bg-[#38d4f5] text-slate-950 border border-cyan-200 shadow-[#00C4EE]/30'
          }`}
          title="Adjust Daily Target (20 to 500 questions)"
        >
          <Sliders className="w-3 h-3 text-slate-950" />
          <span>{target} Qs</span>
        </button>
      </div>

      {/* Collapsible Settings Drawer */}
      {showSettings && (
        <div className="bg-slate-950/90 border border-[#00C4EE]/40 rounded-xl p-3 space-y-2.5 animate-fadeIn relative z-20 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-[#00C4EE]" />
              Set Your Daily Goal Speed:
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[20, 30, 50, 100, 200, 300, 500].map(val => (
              <button
                key={val}
                onClick={() => {
                  setCustomTargetInput(val);
                  handleSaveSettings(val);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-black transition-all shrink-0 active:scale-95 ${
                  target === val
                    ? 'bg-[#00C4EE] text-slate-950 border-cyan-200 shadow-sm shadow-cyan-400/40'
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {val === 30 ? '30 (Default)' : val}
              </button>
            ))}
          </div>

          {/* Slider & Input */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              min={MIN_DAILY_TARGET}
              max={MAX_DAILY_TARGET}
              step={5}
              value={customTargetInput}
              onChange={(e) => setCustomTargetInput(Number(e.target.value))}
              className="flex-1 accent-[#00C4EE] h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={MIN_DAILY_TARGET}
                max={MAX_DAILY_TARGET}
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 text-[#00C4EE] font-bold text-xs p-1.5 rounded-lg text-center font-mono"
              />
              <button
                onClick={() => handleSaveSettings()}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-lg transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THE SPEEDOMETER INSTRUMENT CLUSTER */}
      <div className="relative flex flex-col items-center justify-center pt-1 pb-1">
        <div className="w-full max-w-[280px] sm:max-w-[310px] mx-auto relative select-none">
          <svg
            viewBox="0 0 260 145"
            className="w-full h-auto overflow-visible filter drop-shadow-md"
          >
            <defs>
              {/* Dynamic Speedometer Arc Gradient: Electric Cyan (user pic) -> Yellow -> Orange -> Flame Red */}
              <linearGradient id="speedoTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00C4EE" />
                <stop offset="35%" stopColor="#38BDF8" />
                <stop offset="65%" stopColor="#FACC15" />
                <stop offset="85%" stopColor="#FB923C" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>

              {/* Needle Taper Gradient */}
              <linearGradient id="speedoNeedleGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#00C4EE" />
                <stop offset="50%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>

              {/* Glowing effects */}
              <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Outer Subtle Dash Track */}
            <path
              d="M 32 120 A 98 98 0 0 1 228 120"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              strokeOpacity="0.7"
            />

            {/* Background Dark Arc Track */}
            <path
              d="M 40 120 A 90 90 0 0 1 220 120"
              fill="none"
              stroke="#131e33"
              strokeWidth="13"
              strokeLinecap="round"
            />

            {/* Active Speed Progress Arc */}
            <path
              d="M 40 120 A 90 90 0 0 1 220 120"
              fill="none"
              stroke="url(#speedoTrackGrad)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeOffset}
              filter={percentage > 0 ? "url(#arcGlow)" : undefined}
              className="transition-all duration-700 ease-out"
            />

            {/* Speedometer Radial Ticks */}
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tickPct) => {
              const isMajor = tickPct % 25 === 0 || tickPct === 0 || tickPct === 50 || tickPct === 100;
              const angleRad = (180 - (tickPct / 100) * 180) * (Math.PI / 180);
              const outerR = 78;
              const innerR = isMajor ? 67 : 72;
              const x1 = centerCX + innerR * Math.cos(angleRad);
              const y1 = centerCY - innerR * Math.sin(angleRad);
              const x2 = centerCX + outerR * Math.cos(angleRad);
              const y2 = centerCY - outerR * Math.sin(angleRad);
              const isPassed = tickPct <= percentage;
              const tickColor = tickPct <= 35 ? '#00C4EE' : tickPct <= 75 ? '#FACC15' : '#FB923C';

              return (
                <line
                  key={tickPct}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isPassed ? tickColor : '#334155'}
                  strokeWidth={isMajor ? 2.5 : 1.5}
                  strokeOpacity={isPassed ? 1 : 0.4}
                />
              );
            })}

            {/* Speedometer Labels at 0, 50%, MAX */}
            <text x="50" y="112" fill="#00C4EE" fontSize="9" fontWeight="900" textAnchor="middle" opacity="0.85">0</text>
            <text x="130" y="44" fill="#FACC15" fontSize="9" fontWeight="900" textAnchor="middle" opacity="0.9">50%</text>
            <text x="210" y="112" fill="#FB923C" fontSize="8.5" fontWeight="900" textAnchor="middle" opacity="0.85">MAX</text>

            {/* Glowing Leading Indicator Dot on the Arc */}
            {percentage > 0 && (
              <g>
                <circle
                  cx={tipX}
                  cy={tipY}
                  r="5.5"
                  fill="#FFFFFF"
                  filter="url(#dotGlow)"
                />
                <circle
                  cx={tipX}
                  cy={tipY}
                  r="3.5"
                  fill={percentage >= 80 ? '#FB923C' : percentage >= 40 ? '#FACC15' : '#00C4EE'}
                />
              </g>
            )}

            {/* Rotating Speedometer Needle */}
            <g
              style={{
                transform: `rotate(${needleAngle}deg)`,
                transformOrigin: `${centerCX}px ${centerCY}px`,
                transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Needle Blade */}
              <polygon
                points={`${centerCX - 2.5},${centerCY} ${centerCX - 0.5},48 ${centerCX + 0.5},48 ${centerCX + 2.5},${centerCY} ${centerCX},${centerCY + 7}`}
                fill="url(#speedoNeedleGrad)"
                filter="url(#arcGlow)"
              />
              {/* Needle Tip Accent */}
              <circle cx={centerCX} cy="48" r="2.5" fill="#FFFFFF" />
            </g>

            {/* Center Speedometer Hub */}
            <circle
              cx={centerCX}
              cy={centerCY}
              r="13"
              fill="#0b1322"
              stroke="#00C4EE"
              strokeWidth="2.5"
            />
            <circle
              cx={centerCX}
              cy={centerCY}
              r="6.5"
              fill="#F59E0B"
            />
            <circle
              cx={centerCX}
              cy={centerCY}
              r="2.5"
              fill="#FFFFFF"
            />
          </svg>

          {/* Central Digital Readout (Nested cleanly beneath the hub) */}
          <div className="flex flex-col items-center justify-center -mt-3 sm:-mt-4 relative z-10">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight bg-gradient-to-r from-[#00C4EE] via-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                {displaySolved}
              </span>
              <span className="text-slate-400 font-mono text-xs sm:text-sm font-bold">
                / {target} Qs
              </span>
            </div>

            {/* Dynamic Velocity Status Badge */}
            <div className={`mt-1 text-[10px] sm:text-[11px] font-extrabold px-3 py-0.5 rounded-full border shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap ${velocityInfo.badgeClass}`}>
              {velocityInfo.icon}
              <span>{velocityInfo.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Telemetry Metrics (Optimized responsive 3-column mobile layout) */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 relative z-10 text-center">
        {/* Metric 1: Velocity */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <Activity className="w-2.5 h-2.5 text-[#00C4EE]" />
            Velocity
          </span>
          <span className="text-xs sm:text-sm font-mono font-black text-[#00C4EE] mt-0.5">
            {percentage}%
          </span>
        </div>

        {/* Metric 2: Remaining to Target */}
        <div className="flex flex-col items-center justify-center border-x border-slate-800/80 px-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <Target className="w-2.5 h-2.5 text-amber-400" />
            To Redline
          </span>
          <span className="text-xs sm:text-sm font-mono font-black text-amber-400 mt-0.5">
            {isCompleted ? 'Complete ✓' : `${remaining} Qs`}
          </span>
        </div>

        {/* Metric 3: Bounty LP */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5 text-orange-400" />
            Bounty
          </span>
          <span className="text-xs sm:text-sm font-mono font-black text-orange-400 mt-0.5">
            +{potentialRewardLP} LP
          </span>
        </div>
      </div>

      {/* Action Footer: Practice Now or Claim Bounty */}
      <div className="pt-0.5 relative z-10">
        {isClaimed ? (
          <div className="w-full bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Target Reward Claimed ✓ Next Gauge Unlocks Tomorrow</span>
          </div>
        ) : isCompleted ? (
          <button
            onClick={handleClaim}
            id="claim-daily-target-reward-btn"
            className="w-full bg-gradient-to-r from-[#00C4EE] via-amber-400 to-orange-500 hover:from-[#38d4f5] hover:to-orange-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm py-3 px-4 rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 border border-amber-200 animate-pulse transition-all"
          >
            <Gift className="w-4 h-4 fill-slate-950" />
            <span>CLAIM +{potentialRewardLP} LP TARGET BOUNTY</span>
          </button>
        ) : (
          <button
            onClick={handleQuickAction}
            className="w-full bg-gradient-to-r from-[#00C4EE] via-cyan-400 to-amber-400 hover:from-[#38d4f5] hover:to-amber-300 active:scale-98 text-slate-950 font-black text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl border border-cyan-200 shadow-md shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all"
          >
            <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
            <span>ACCELERATE NOW • PRACTICE QUESTIONS</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
