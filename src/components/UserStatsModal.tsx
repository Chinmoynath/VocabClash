import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Zap, 
  Award, 
  BookOpen, 
  ChevronRight, 
  Calendar, 
  Shield, 
  Sparkles,
  Info,
  Layers,
  Clock,
  Lock,
  ArrowRight,
  LogIn
} from 'lucide-react';
import { PlayerProfile, UserSubscription, DailyStreakState, QuestionCategory } from '../types';
import { getUserStatsSummary, getDailyStatsMap, saveDailyStatsMap } from '../utils/userStatsManager';
import { auth, db } from '../services/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { soundManager } from '../utils/audio';

interface UserStatsModalProps {
  isOpen?: boolean;
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  onClose: () => void;
  onNavigateToPractice?: () => void;
  onNavigateToMistakes?: () => void;
  onOpenAuth?: () => void;
}

export const UserStatsModal: React.FC<UserStatsModalProps> = ({
  isOpen = true,
  player,
  subscription,
  dailyStreak,
  onClose,
  onNavigateToPractice,
  onNavigateToMistakes,
  onOpenAuth,
}) => {
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [updateTick, setUpdateTick] = useState<number>(0);

  // Check if current user is logged in / signed up (has permanent account)
  const currentUser = auth.currentUser;
  const isSignedUp = Boolean(currentUser && !currentUser.isAnonymous && currentUser.email);

  // Real-time listener for local attempts and cloud stats updates
  useEffect(() => {
    if (!isOpen) return;

    const handleStatsUpdated = () => {
      setUpdateTick(prev => prev + 1);
    };

    window.addEventListener('user-stats-updated', handleStatsUpdated);
    window.addEventListener('storage', handleStatsUpdated);

    let unsubscribeFirestore: (() => void) | undefined;
    if (currentUser?.uid) {
      try {
        const statsDocRef = doc(db, 'users', currentUser.uid, 'stats_summary', 'main');
        unsubscribeFirestore = onSnapshot(statsDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.recentDays) && data.recentDays.length > 0) {
              const localDailyMap = getDailyStatsMap();
              let updated = false;
              for (const r of data.recentDays) {
                if (r?.date && (!localDailyMap[r.date] || r.solved > localDailyMap[r.date].solved)) {
                  localDailyMap[r.date] = r;
                  updated = true;
                }
              }
              if (updated) {
                saveDailyStatsMap(localDailyMap);
                setUpdateTick(prev => prev + 1);
              }
            }
          }
        }, (err) => {
          console.warn('Live stats subscription note:', err);
        });
      } catch {}
    }

    return () => {
      window.removeEventListener('user-stats-updated', handleStatsUpdated);
      window.removeEventListener('storage', handleStatsUpdated);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [isOpen, currentUser?.uid]);

  // Load latest stats summary reactively
  const stats = useMemo(() => {
    return getUserStatsSummary(player, dailyStreak, timeRange);
  }, [player, dailyStreak, timeRange, updateTick]);

  if (!isOpen) return null;

  const history = stats.dailyHistory;

  // Compute graph bounds & coordinates
  const graphData = useMemo(() => {
    const maxSolvedInPeriod = Math.max(1, ...history.map(h => h.solved));
    const avgAcc = stats.overallAccuracy || 75;

    return history.map((item, idx) => {
      const xPercent = history.length > 1 ? (idx / (history.length - 1)) * 100 : 50;
      const accuracyVal = item.solved > 0 ? item.accuracy : avgAcc;
      const accuracyY = 100 - Math.min(100, Math.max(5, accuracyVal));
      const volumeHeight = item.solved > 0 ? Math.max(12, Math.min(85, (item.solved / maxSolvedInPeriod) * 85)) : 4;
      return {
        ...item,
        xPercent,
        accuracyY,
        volumeHeight,
      };
    });
  }, [history, stats.overallAccuracy]);

  // Construct SVG path for smooth accuracy line
  const accuracyPathD = useMemo(() => {
    if (graphData.length === 0) return '';
    const points = graphData.map(p => ({ x: p.xPercent, y: p.accuracyY }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1x = prev.x + (curr.x - prev.x) / 2;
      const cp1y = prev.y;
      const cp2x = prev.x + (curr.x - prev.x) / 2;
      const cp2y = curr.y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
    }
    return path;
  }, [graphData]);

  // Filled area path for chart depth
  const accuracyAreaD = useMemo(() => {
    if (graphData.length === 0) return '';
    let path = `M ${graphData[0].xPercent},100 L ${graphData[0].xPercent},${graphData[0].accuracyY}`;
    for (let i = 1; i < graphData.length; i++) {
      const prev = graphData[i - 1];
      const curr = graphData[i];
      const cp1x = prev.xPercent + (curr.xPercent - prev.xPercent) / 2;
      const cp1y = prev.accuracyY;
      const cp2x = prev.xPercent + (curr.xPercent - prev.xPercent) / 2;
      const cp2y = curr.accuracyY;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.xPercent},${curr.accuracyY}`;
    }
    path += ` L ${graphData[graphData.length - 1].xPercent},100 Z`;
    return path;
  }, [graphData]);

  // Format short date
  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || parts[1]}`;
    }
    return dateStr;
  };

  const getCategoryLabel = (cat: QuestionCategory): { name: string; icon: string; color: string } => {
    switch (cat) {
      case 'synonyms':
        return { name: 'Synonyms', icon: '📖', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
      case 'antonyms':
        return { name: 'Antonyms', icon: '🔄', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'ows':
        return { name: 'One Word Sub', icon: '🎯', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'idioms':
        return { name: 'Idioms & Phrases', icon: '💡', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      default:
        return { name: 'Vocabulary', icon: '✨', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    }
  };

  const hoveredItem = hoveredDayIndex !== null ? graphData[hoveredDayIndex] : null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.playTap();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 no-scrollbar overflow-hidden">
        
        {/* Guest / Unauthenticated Blur Lock Overlay */}
        {!isSignedUp && (
          <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50 animate-bounce">
              <Lock className="w-7 h-7" />
            </div>
            
            <h3 className="text-lg font-black text-slate-100 mb-1 tracking-tight">
              Sign In to View Full Accuracy & Daily Graph
            </h3>
            
            <p className="text-xs text-slate-300 max-w-xs mb-5 leading-relaxed">
              Track your solved questions, accuracy graph, mistake recovery curves & exam readiness score without ever losing your progress.
            </p>

            <div className="w-full max-w-xs space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onClose();
                  if (onOpenAuth) {
                    onOpenAuth();
                  }
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign Up / Sign In with Google</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onClose();
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Maybe Later
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Auto Cloud Backup
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Daily History Saved
              </span>
            </div>
          </div>
        )}

        {/* Inner Content (Blurred if not signed up) */}
        <div className={`space-y-4 ${!isSignedUp ? 'filter blur-[4px] select-none opacity-40 pointer-events-none' : ''}`}>
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                Performance & Daily Analytics
              </h3>
              <p className="text-[11px] text-slate-400">
                Detailed accuracy trends, solved counts & monthly progress
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundManager.playTap();
              onClose();
            }}
            aria-label="Close Analytics Modal"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-400 hover:text-slate-200 flex items-center justify-center border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center justify-between bg-slate-850 p-1 rounded-2xl border border-slate-800 text-xs">
          <span className="text-[11px] font-bold text-slate-400 pl-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Time Window:</span>
          </span>
          <div className="flex gap-1">
            {([7, 14, 30] as const).map(range => (
              <button
                key={range}
                onClick={() => {
                  soundManager.playTap();
                  setTimeRange(range);
                }}
                className={`px-3 py-1 rounded-xl font-bold transition-all text-xs ${
                  timeRange === range
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Last {range}d
              </button>
            ))}
          </div>
        </div>

        {/* KPI Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Total Solved */}
          <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Solved</span>
              <Target className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="font-mono text-xl font-black text-slate-100">
              {stats.totalSolved.toLocaleString()}
            </div>
            <div className="text-[10px] text-sky-400/90 font-medium mt-0.5 flex items-center gap-1">
              <span>{player.pyqScore || 0} PYQ pts</span>
            </div>
          </div>

          {/* 2. Overall Accuracy */}
          <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Accuracy</span>
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="font-mono text-xl font-black text-emerald-400 flex items-baseline gap-1">
              <span>{stats.overallAccuracy}%</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
              {stats.overallAccuracy >= 80 ? '🎯 Cutoff Cleared' : '📈 Target: 80%+'}
            </div>
          </div>

          {/* 3. Correct vs Wrong */}
          <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Right / Wrong</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="font-mono text-base font-black text-slate-100 flex items-center gap-1.5">
              <span className="text-emerald-400">{stats.totalCorrect}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{stats.totalWrong}</span>
            </div>
            {/* Proportion Bar */}
            <div className="w-full bg-rose-950/60 rounded-full h-1.5 mt-1.5 overflow-hidden flex border border-slate-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.overallAccuracy}%` }}
              />
            </div>
          </div>

          {/* 4. Month Progress */}
          <div className="bg-slate-850 border border-slate-800/80 rounded-2xl p-3 relative overflow-hidden group">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Last Month %</span>
              {stats.monthOverMonthAccuracyDelta >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
            <div className="font-mono text-base font-black text-slate-200">
              {stats.lastMonthAccuracy}%
            </div>
            <div className="text-[10px] font-semibold mt-0.5 flex items-center gap-1">
              {stats.monthOverMonthAccuracyDelta >= 0 ? (
                <span className="text-emerald-400 font-bold">
                  +{stats.monthOverMonthAccuracyDelta}% vs last mo
                </span>
              ) : (
                <span className="text-rose-400 font-bold">
                  {stats.monthOverMonthAccuracyDelta}% vs last mo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Interactive Daily Accuracy & Volume Chart */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Daily Accuracy & Volume Graph</span>
              </span>
              <span className="text-[10px] text-slate-400">
                (Last {timeRange} Days)
              </span>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-1 rounded-full bg-amber-400" />
                <span>Accuracy %</span>
              </div>
              <div className="flex items-center gap-1 text-sky-400">
                <span className="w-2 h-2 rounded-sm bg-sky-500/40 border border-sky-400/80" />
                <span>Questions</span>
              </div>
            </div>
          </div>

          {/* Interactive SVG Chart Container */}
          <div className="relative h-44 w-full bg-slate-900/90 rounded-xl border border-slate-800/80 p-2 select-none">
            {/* Background Grid Lines & Benchmark */}
            <div className="absolute inset-x-2 inset-y-2 pointer-events-none flex flex-col justify-between text-[9px] font-mono text-slate-600">
              {/* 100% line */}
              <div className="border-b border-slate-800/60 w-full flex justify-between">
                <span className="text-slate-600">100%</span>
              </div>
              {/* 80% Govt Cutoff Benchmark */}
              <div className="border-b border-dashed border-amber-500/40 w-full flex justify-between items-center relative">
                <span className="text-[8px] bg-slate-900 text-amber-400/90 px-1 rounded border border-amber-500/30">
                  🎯 Cutoff Benchmark (80%)
                </span>
                <span className="text-amber-400/60">80%</span>
              </div>
              {/* 50% line */}
              <div className="border-b border-slate-800/60 w-full flex justify-between">
                <span className="text-slate-600">50%</span>
              </div>
              {/* 0% line */}
              <div className="border-b border-slate-800/60 w-full flex justify-between">
                <span className="text-slate-600">0%</span>
              </div>
            </div>

            {/* SVG Visual Layers */}
            <svg
              className="w-full h-full overflow-visible relative z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="volumeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="accuracyLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="accuracyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Volume Bars */}
              {graphData.map((item, idx) => {
                const barWidth = Math.max(1.8, Math.min(4.5, 60 / graphData.length));
                const barX = item.xPercent - barWidth / 2;
                const barY = 100 - item.volumeHeight;

                return (
                  <rect
                    key={`bar-${idx}`}
                    x={`${barX}%`}
                    y={`${barY}%`}
                    width={`${barWidth}%`}
                    height={`${item.volumeHeight}%`}
                    rx="1.5"
                    fill="url(#volumeBarGrad)"
                    stroke="#38bdf8"
                    strokeWidth="0.4"
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Accuracy Area Fill */}
              <path
                d={accuracyAreaD}
                fill="url(#accuracyAreaGrad)"
                className="transition-all duration-300"
              />

              {/* Accuracy Trend Spline */}
              <path
                d={accuracyPathD}
                fill="none"
                stroke="url(#accuracyLineGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]"
              />

              {/* Data Points */}
              {graphData.map((item, idx) => {
                const isHovered = hoveredDayIndex === idx;

                return (
                  <g key={`pt-${idx}`}>
                    <circle
                      cx={`${item.xPercent}%`}
                      cy={`${item.accuracyY}%`}
                      r={isHovered ? '4' : '2.2'}
                      fill="#fbbf24"
                      stroke="#0f172a"
                      strokeWidth={isHovered ? '1.5' : '1'}
                      className="cursor-pointer transition-all"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover Touch/Click Overlay Columns */}
            <div className="absolute inset-0 flex z-20">
              {graphData.map((item, idx) => (
                <div
                  key={`hover-col-${idx}`}
                  onMouseEnter={() => setHoveredDayIndex(idx)}
                  onMouseLeave={() => setHoveredDayIndex(null)}
                  onClick={() => {
                    soundManager.playTap();
                    setHoveredDayIndex(idx);
                  }}
                  className="flex-1 h-full cursor-pointer hover:bg-white/5 transition-colors relative"
                />
              ))}
            </div>

            {/* Floating Tooltip Card */}
            {hoveredItem && (
              <div
                className="absolute z-30 bg-slate-950 border border-amber-400/60 rounded-xl p-2 shadow-2xl pointer-events-none text-xs space-y-1 transform -translate-x-1/2 -translate-y-full min-w-[140px]"
                style={{
                  left: `${Math.max(18, Math.min(82, hoveredItem.xPercent))}%`,
                  top: `${Math.max(20, hoveredItem.accuracyY * 0.4)}%`,
                }}
              >
                <div className="text-[10px] font-bold text-slate-300 flex items-center justify-between border-b border-slate-800 pb-1">
                  <span>📅 {formatShortDate(hoveredItem.date)}</span>
                  <span className="text-amber-400 font-black">
                    {hoveredItem.solved > 0 ? `${hoveredItem.accuracy}%` : '0%'}
                  </span>
                </div>
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Solved:</span>
                    <span className="font-mono font-bold text-sky-400">{hoveredItem.solved} questions</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Correct:</span>
                    <span className="font-mono font-bold">{hoveredItem.correct}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Wrong:</span>
                    <span className="font-mono font-bold">{hoveredItem.wrong}</span>
                  </div>
                  {hoveredItem.avgResponseMs ? (
                    <div className="flex justify-between text-slate-400 pt-0.5 border-t border-slate-850">
                      <span>Avg Speed:</span>
                      <span className="font-mono text-amber-300">{(hoveredItem.avgResponseMs / 1000).toFixed(1)}s</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Date Axis Labels */}
          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-1">
            <span>{formatShortDate(graphData[0]?.date || '')}</span>
            <span>{formatShortDate(graphData[Math.floor(graphData.length / 2)]?.date || '')}</span>
            <span className="text-amber-400 font-bold">Today ({formatShortDate(graphData[graphData.length - 1]?.date || '')})</span>
          </div>
        </div>

        {/* Exam Readiness & Speed Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Exam Readiness Index */}
          <div className="bg-gradient-to-br from-indigo-950/60 to-slate-850 border border-indigo-500/30 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Exam Readiness Score</span>
              </div>
              <div className="text-[11px] text-slate-300 leading-tight">
                {stats.examReadinessScore >= 80 ? (
                  <span className="text-emerald-300 font-semibold">
                    🔥 Projected 46+/50 in SSC English Tier-1
                  </span>
                ) : (
                  <span className="text-indigo-200">
                    Target 80+ score for assured Tier-1 cutoff
                  </span>
                )}
              </div>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-indigo-950 border-2 border-indigo-400/80 flex flex-col items-center justify-center shadow-lg shadow-indigo-950 shrink-0">
              <span className="text-lg font-black text-amber-300 font-mono leading-none">
                {stats.examReadinessScore}
              </span>
              <span className="text-[8px] text-indigo-300 font-bold uppercase mt-0.5">
                / 100
              </span>
            </div>
          </div>

          {/* Speed & Discipline Card */}
          <div className="bg-slate-850 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Pacing & Discipline</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Avg Response: <b className="text-slate-200">{(stats.averageResponseTimeMs / 1000).toFixed(1)}s</b> per Q
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-orange-950/80 border border-orange-600/60 text-orange-300 px-2.5 py-1.5 rounded-xl text-center">
                <div className="text-[9px] text-orange-400/90 font-bold uppercase">Streak</div>
                <div className="text-xs font-mono font-black">{stats.currentStreak}d 🔥</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown Matrix */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Category-Wise Mastery Breakdown</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Best: <b className="text-amber-400 capitalize">{stats.bestCategory}</b>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['synonyms', 'antonyms', 'ows', 'idioms'] as QuestionCategory[]).map(cat => {
              const catData = stats.categoryBreakdown[cat];
              const meta = getCategoryLabel(cat);
              const acc = catData.solved > 0 ? catData.accuracy : 75;

              return (
                <div
                  key={cat}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="font-bold text-slate-200 text-xs">{meta.name}</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-amber-400">
                      {acc}% Acc
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        acc >= 80 ? 'bg-emerald-400' : acc >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{catData.solved} attempted</span>
                    <span className="text-amber-300 font-medium">
                      {catData.masteredCount} Mastered
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex gap-2 pt-1">
          {onNavigateToPractice && (
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
                onNavigateToPractice();
              }}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Target className="w-4 h-4" />
              <span>Drill Next PYQs →</span>
            </button>
          )}

          {onNavigateToMistakes && (
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
                onNavigateToMistakes();
              }}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-rose-300 border border-rose-500/30 hover:border-rose-400/60 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <BookOpen className="w-4 h-4 text-rose-400" />
              <span>Mistake Vault</span>
            </button>
          )}
        </div>

        </div>

      </div>
    </div>
  );
};
