import React, { useState } from 'react';
import { DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { 
  X, 
  Flame, 
  Sparkles, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Target,
  Zap
} from 'lucide-react';
import { 
  getTodayDateString,
  isDailyStreakBonusClaimed,
  isDailyQuestionSolvedToday,
  claimDailyStreakBonus
} from '../utils/streakManager';

interface StreakModalProps {
  streak: DailyStreakState;
  uid?: string | null;
  onClose: () => void;
  onUpdateStreak: (updated: DailyStreakState) => void;
  onAddLP?: (amount: number) => void;
  onGoToPractice?: () => void;
}

export const StreakModal: React.FC<StreakModalProps> = ({
  streak,
  uid,
  onClose,
  onUpdateStreak,
  onAddLP,
  onGoToPractice,
}) => {
  const todayStr = getTodayDateString();
  const isSolvedToday = isDailyQuestionSolvedToday(streak, todayStr);
  const isBonusAlreadyClaimed = isDailyStreakBonusClaimed(streak, todayStr, uid);

  const [claimedBonus, setClaimedBonus] = useState<boolean>(() => isBonusAlreadyClaimed);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isBonusClaimed = claimedBonus || isBonusAlreadyClaimed;

  // Calculate 7-day recent status window matching currentStreak
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i; // 6 (6 days ago), 5, 4, 3, 2, 1 (yesterday), 0 (today)
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const isToday = offset === 0;

    // A day is active in the current streak if:
    // 1) When solved today: the last `currentStreak` consecutive days (offsets 0 to currentStreak - 1)
    // 2) When not yet solved today: the last `currentStreak` consecutive days ending yesterday (offsets 1 to currentStreak)
    let isActive = false;
    if (streak.currentStreak > 0) {
      if (isSolvedToday) {
        isActive = offset >= 0 && offset < streak.currentStreak;
      } else {
        isActive = offset >= 1 && offset <= streak.currentStreak;
      }
    }

    return {
      dateStr,
      dayName,
      isToday,
      isActive,
      dayNum: d.getDate(),
    };
  });

  const milestones = [
    { days: 3, reward: '+50 LP', title: '3-Day Aspirant', reached: streak.currentStreak >= 3 },
    { days: 7, reward: '+150 LP', title: '7-Day Scholar', reached: streak.currentStreak >= 7 },
    { days: 14, reward: '+350 LP', title: '14-Day Warrior', reached: streak.currentStreak >= 14 },
    { days: 30, reward: '+1000 LP', title: '30-Day Master', reached: streak.currentStreak >= 30 },
  ];

  const handleClaimDailyBonus = () => {
    // 1. Strict guard: Bonus can only be claimed ONCE per calendar day
    if (isBonusClaimed) {
      setToastMessage('⚠️ You have already claimed today’s streak bonus (+25 LP). Come back tomorrow!');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // 2. Strict guard: Must have solved at least 1 question today
    if (!isSolvedToday) {
      setToastMessage('⚠️ Solve at least 1 question today to unlock the daily streak bonus!');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // 3. Atomically claim bonus with verification
    const result = claimDailyStreakBonus(streak, todayStr, uid);
    if (!result.success) {
      if (result.error === 'ALREADY_CLAIMED') {
        setClaimedBonus(true);
        setToastMessage('⚠️ You have already claimed today’s streak bonus (+25 LP). Come back tomorrow!');
      } else {
        setToastMessage('⚠️ Solve at least 1 question today to unlock the daily streak bonus!');
      }
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    soundManager.playCorrect();
    setClaimedBonus(true);
    onUpdateStreak(result.updatedStreak);

    if (onAddLP) {
      onAddLP(result.rewardLP);
    }
    setToastMessage('🔥 +25 LP Daily Streak Bonus Claimed! (Available once per day)');
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#191428] via-[#120f1e] to-[#0c0a14] border-2 border-orange-500/50 rounded-[32px] p-5 shadow-[0_0_50px_rgba(249,115,22,0.25)] flex flex-col justify-between relative max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* Top Header Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-orange-950/80 border border-orange-600/60 px-3 py-1 rounded-full text-xs text-orange-300 font-extrabold shadow-inner">
            <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400 animate-pulse" />
            <span>DAILY STREAK TRACKER</span>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast alert */}
        {toastMessage && (
          <div className="my-2 bg-amber-950/90 border border-amber-500 text-amber-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Streak Broken Warning if flagged */}
        {streak.streakBrokenNotice && streak.currentStreak === 0 && (
          <div className="my-2 bg-rose-950/90 border border-rose-600/80 text-rose-200 p-3 rounded-2xl text-xs space-y-1 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Streak Reset Notice</span>
            </div>
            <p className="text-[11px] text-rose-300/90 leading-relaxed">
              You missed a day of practice, so your streak reset to 0. Solve 1 question today to reignite your streak!
            </p>
          </div>
        )}

        {/* Flame Hero Counter */}
        <div className="text-center my-3 space-y-2">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            {/* Outer flame glow */}
            <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
              streak.currentStreak > 0 ? 'bg-orange-600/40' : 'bg-slate-700/30'
            }`} />
            
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl border relative transition-all ${
              streak.currentStreak > 0
                ? 'bg-gradient-to-tr from-amber-600 via-orange-600 to-rose-600 border-amber-400 text-white shadow-orange-900/50'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              <Flame className={`w-9 h-9 ${streak.currentStreak > 0 ? 'fill-amber-200 text-amber-100 animate-bounce' : 'text-slate-500'}`} />
            </div>
          </div>

          <div>
            <div className="text-3xl font-black text-white font-mono tracking-tight flex items-center justify-center gap-1">
              <span>{streak.currentStreak}</span>
              <span className="text-sm font-bold text-orange-400 uppercase tracking-widest font-sans">
                {streak.currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
              </span>
            </div>

            {/* Today's practice status indicator */}
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all">
              {isSolvedToday ? (
                <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-950/70 border-emerald-600/60 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Today's Practice Completed 🔥</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/70 border-amber-600/60 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Solve 1 question today to continue streak</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">
              Solve at least 1 question daily from Live Duels or Practice Drill. Missing a day resets your streak to 0.
            </p>
          </div>
        </div>

        {/* 7-Day Recent Calendar Tracker */}
        <div className="bg-[#12101e] border border-slate-800/90 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span>Last 7 Days</span>
            </span>
            <span className="text-[11px] text-orange-300">
              Longest: <strong className="text-white font-mono">{streak.longestStreak}d</strong>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {last7Days.map((day, idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border transition-all ${
                  day.isActive
                    ? 'bg-orange-950/80 border-orange-500/80 text-orange-200'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
                } ${day.isToday ? 'ring-2 ring-amber-400' : ''}`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  {day.dayName}
                </span>

                <div className="my-1">
                  {day.isActive ? (
                    <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-800" />
                  )}
                </div>

                <span className="text-[10px] font-mono font-bold">
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Streak Milestones */}
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-bold text-slate-300 px-1 flex items-center justify-between">
            <span>Milestone Rewards</span>
            <span className="text-[10px] text-amber-400 font-mono">Bonus Rank Points</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  m.reached
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">{m.title}</div>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">{m.reward}</div>
                </div>
                {m.reached ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">{m.days}d</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Daily Bonus Claim & Action button */}
        <div className="mt-4 space-y-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleClaimDailyBonus}
            disabled={isBonusClaimed || !isSolvedToday}
            className={`w-full py-3 px-4 rounded-full font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isBonusClaimed
                ? 'bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 cursor-default shadow-emerald-950/30'
                : isSolvedToday
                ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-950 active:scale-98 cursor-pointer'
                : 'bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed opacity-80'
            }`}
          >
            {isBonusClaimed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Today's Daily Bonus Claimed (+25 LP)</span>
              </>
            ) : isSolvedToday ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Claim Today's Streak Bonus (+25 LP)</span>
              </>
            ) : (
              <>
                <Target className="w-4 h-4 text-slate-400" />
                <span>Solve 1 Question to Unlock Bonus (+25 LP)</span>
              </>
            )}
          </button>

          {isBonusClaimed && (
            <p className="text-[11px] text-center text-emerald-400/90 font-semibold flex items-center justify-center gap-1.5 py-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Claimed for today! Next bonus unlocks after midnight.</span>
            </p>
          )}

          {!isSolvedToday && onGoToPractice && (
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
                onGoToPractice();
              }}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Practice Now to Build Streak</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
