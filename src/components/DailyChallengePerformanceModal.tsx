import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  Award, 
  Target, 
  Clock, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  Percent
} from 'lucide-react';
import { 
  DailyChallengeAttempt, 
  formatDisplayDate, 
  formatDuration, 
  getTodayDateString,
  getLast30DaysRange,
  getLast30DaysChallengeAttempts,
  getCalendarDayOffset,
  calculateDailyChallengeReportStats
} from '../services/dailyChallengeService';
import { soundManager } from '../utils/audio';

interface DailyChallengePerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: DailyChallengeAttempt[];
  todayAttempt: DailyChallengeAttempt | null;
}

type ReportMetricTab = 'accuracy' | 'score';

export const DailyChallengePerformanceModal: React.FC<DailyChallengePerformanceModalProps> = ({
  isOpen,
  onClose,
  history,
  todayAttempt,
}) => {
  const [activeTab, setActiveTab] = useState<ReportMetricTab>('accuracy');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // 1. Rolling 30 calendar days range ending today in India Standard Time
  const thirtyDayRange = useMemo(() => {
    return getLast30DaysRange();
  }, []);

  // Strictly normalize and filter history to the rolling LAST 30 CALENDAR DAYS
  const thirtyDayAttempts = useMemo(() => {
    return getLast30DaysChallengeAttempts(history);
  }, [history]);

  // Chart data plots all completed attempts in the last 30 calendar days chronologically
  const chartData = thirtyDayAttempts;

  // 2. Compute deterministic aggregate statistics for the last 30 calendar days
  const stats = useMemo(() => {
    return calculateDailyChallengeReportStats(thirtyDayAttempts);
  }, [thirtyDayAttempts]);

  if (!isOpen) return null;

  // Ergonomic SVG Chart Dimensions
  const width = 520;
  const height = 180;
  const isAccuracy = activeTab === 'accuracy';
  const padLeft = isAccuracy ? 48 : 40;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 28;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const maxY = isAccuracy ? 100 : 20;
  const minY = 0;

  // Build points with calendar-date x-positioning across the 30-calendar-day window
  const points = chartData.map((item) => {
    const rawVal = isAccuracy ? item.percentage : item.score;
    const val = typeof rawVal === 'number' && isFinite(rawVal) ? rawVal : 0;

    // Calendar day offset from startDate (0 to 29 across 30 calendar days)
    const dayOffset = getCalendarDayOffset(item.date, thirtyDayRange.startDate);
    const x = padLeft + (dayOffset / 29) * chartWidth;

    const yRatio = (val - minY) / (maxY - minY);
    const safeRatio = Math.max(0, Math.min(1, isFinite(yRatio) ? yRatio : 0));
    const y = padTop + chartHeight - safeRatio * chartHeight;
    return {
      x,
      y,
      val,
      item,
      dayOffset,
      label: formatDisplayDate(item.date),
      isToday: item.date === getTodayDateString(),
    };
  });

  const primaryColor = isAccuracy ? '#10b981' : '#f59e0b'; // Emerald for accuracy, Amber for score
  const primaryGradientId = isAccuracy ? 'grad-accuracy' : 'grad-score';

  // SVG Path generation
  let linePath = '';
  let areaPath = '';

  if (points.length === 1) {
    // 1-day attempt: draw a clean horizontal trend line across the chart at today's score
    const y0 = points[0].y;
    linePath = `M ${padLeft} ${y0} L ${padLeft + chartWidth} ${y0}`;
    areaPath = `M ${padLeft} ${y0} L ${padLeft + chartWidth} ${y0} L ${padLeft + chartWidth} ${padTop + chartHeight} L ${padLeft} ${padTop + chartHeight} Z`;
  } else if (points.length > 1) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;
  }

  // Y-axis grid values: 10 lines (every 10%) for Accuracy vs 4 lines (every 5 marks) for Score
  const yTicks = isAccuracy 
    ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] 
    : [0, 5, 10, 15, 20];

  const hoveredPoint = hoveredPointIndex !== null && points[hoveredPointIndex] ? points[hoveredPointIndex] : (points.length === 1 ? points[0] : null);

  const slotWidth = Math.max(22, chartWidth / 29);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-100">
                  Daily Challenge Report
                </h2>
                <span className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Performance
                </span>
              </div>
              <p className="text-xs text-slate-400">
                20 Questions in 2 Minutes • Last 30 Days Trend & Stats
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                <Percent className="w-3 h-3 text-emerald-400" />
                <span>Avg Accuracy</span>
              </div>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                {stats.avgAccuracy !== null ? `${stats.avgAccuracy}%` : '—'}
              </div>
            </div>

            <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                <Award className="w-3 h-3 text-amber-400" />
                <span>Best Score</span>
              </div>
              <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                {stats.totalAttempts > 0 ? `${stats.bestScore} / 20` : '—'}
              </div>
            </div>

            <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Avg Speed</span>
              </div>
              <div className="text-lg font-black text-sky-400 font-mono mt-0.5">
                {stats.totalAttempts > 0 ? formatDuration(stats.avgSpeed) : '—'}
              </div>
            </div>

            <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3 text-purple-400" />
                <span>Completed</span>
              </div>
              <div className="text-lg font-black text-purple-400 font-mono mt-0.5">
                {stats.completedDays} Days
              </div>
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div className="bg-slate-850/60 p-1 rounded-2xl border border-slate-800">
            <div className="flex gap-1">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('accuracy');
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isAccuracy
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Accuracy (%)</span>
                {isAccuracy && (
                  <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded font-mono">
                    Active
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('score');
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !isAccuracy
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Score (Marks)</span>
                {!isAccuracy && (
                  <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded font-mono">
                    Active
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Interactive Line Graph Box */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 relative">
            {/* Hovered Tooltip Badge */}
            {hoveredPoint ? (
              <div className="absolute top-2 right-3 z-10 bg-slate-800/95 border border-slate-700 rounded-xl px-2.5 py-1 text-xs shadow-lg flex items-center gap-2 animate-fadeIn">
                <span className="text-slate-400 font-medium">{hoveredPoint.label}:</span>
                <span className="font-mono font-black" style={{ color: primaryColor }}>
                  {isAccuracy ? `${hoveredPoint.val}% Accuracy` : `${hoveredPoint.val} / 20 Marks`}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({formatDuration(hoveredPoint.item.timeTakenSeconds)})
                </span>
              </div>
            ) : (
              <div className="absolute top-2 right-3 z-10 text-[11px] text-slate-400 font-medium">
                {chartData.length > 0 
                  ? (isAccuracy ? `Latest: ${chartData[chartData.length - 1]?.percentage ?? 0}%` : `Latest: ${chartData[chartData.length - 1]?.score ?? 0}/20`)
                  : 'No attempts in last 30 days'}
              </div>
            )}

            <div className="w-full overflow-x-auto">
              <svg 
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-44 sm:h-52 overflow-visible select-none"
              >
                <defs>
                  <linearGradient id={primaryGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primaryColor} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-axis Grid Lines & Labels */}
                {yTicks.map((tick) => {
                  const y = padTop + chartHeight - ((tick - minY) / (maxY - minY)) * chartHeight;
                  return (
                    <g key={tick}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={width - padRight}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                        opacity={isAccuracy && tick % 20 !== 0 && tick !== 100 ? 0.6 : 0.9}
                      />
                      <text
                        x={padLeft - 6}
                        y={y + 3.5}
                        fill={isAccuracy && tick % 20 !== 0 && tick !== 100 ? '#64748b' : '#94a3b8'}
                        fontSize={isAccuracy ? '8.5' : '9.5'}
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {isAccuracy ? `${tick}%` : tick}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient */}
                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#${primaryGradientId})`}
                  />
                )}

                {/* Main Trend Line Path */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth={points.length === 1 ? '2.5' : '3'}
                    strokeDasharray={points.length === 1 ? '6 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Columns and Data Points */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredPointIndex === idx || (hoveredPointIndex === null && points.length === 1);
                  const colX = Math.max(padLeft, pt.x - slotWidth / 2);

                  return (
                    <g key={idx}>
                      {/* Full-Height Column Interactive Hit Area (Tap anywhere in vertical strip) */}
                      <rect
                        x={colX}
                        y={0}
                        width={slotWidth}
                        height={height}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        onTouchStart={() => {
                          soundManager.playTap();
                          setHoveredPointIndex(idx);
                        }}
                        onClick={() => {
                          soundManager.playTap();
                          setHoveredPointIndex(idx);
                        }}
                      />

                      {/* Vertical Indicator Stem line from bottom axis to point */}
                      <line
                        x1={pt.x}
                        y1={padTop + chartHeight}
                        x2={pt.x}
                        y2={pt.y}
                        stroke={primaryColor}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity={isHovered ? 0.7 : 0.25}
                      />

                      {/* Outer glow ring around point */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? '9' : '6'}
                        fill={primaryColor}
                        opacity={isHovered ? 0.35 : 0.15}
                        className="transition-all"
                      />

                      {/* Center Point Circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? '5.5' : '4'}
                        fill={pt.isToday ? '#ffffff' : primaryColor}
                        stroke={primaryColor}
                        strokeWidth="2.5"
                        className="transition-all"
                      />

                      {/* Floating Badge above point with value */}
                      <g transform={`translate(${isFinite(pt.x) ? pt.x : padLeft}, ${isFinite(pt.y) ? pt.y - 14 : padTop})`}>
                        <rect
                          x={-24}
                          y={-14}
                          width={48}
                          height={16}
                          rx={5}
                          fill="#0f172a"
                          stroke={primaryColor}
                          strokeWidth="1"
                          opacity={isHovered ? 1 : 0.85}
                        />
                        <text
                          x={0}
                          y={-3}
                          fill={isAccuracy ? '#10b981' : '#fbbf24'}
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {isAccuracy ? `${pt.val}%` : `${pt.val}/20`}
                        </text>
                      </g>

                      {/* X-axis Date Label: rendered clearly without text overlap */}
                      {(() => {
                        const isSelected = isHovered;
                        const isFirst = idx === 0;
                        const isLast = idx === points.length - 1;
                        const isToday = pt.isToday;
                        const hasSpacing = idx === 0 || Math.abs(pt.x - points[idx - 1].x) >= 26;

                        if (!isSelected && !isFirst && !isLast && !isToday && !hasSpacing) {
                          return null;
                        }

                        return (
                          <text
                            x={pt.x}
                            y={padTop + chartHeight + 16}
                            fill={pt.isToday ? '#fbbf24' : isSelected ? '#ffffff' : '#94a3b8'}
                            fontSize="9"
                            fontWeight={pt.isToday || isSelected ? 'bold' : 'normal'}
                            textAnchor="middle"
                          >
                            {pt.label}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}
              </svg>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-2 border-t border-slate-800/60 pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span>{isAccuracy ? 'Accuracy Percentage Trend' : 'Score (Marks / 20) Trend'}</span>
              </span>
              <span className="text-[10px] text-slate-400">Tap anywhere on a day column to inspect</span>
            </div>
          </div>

          {/* Today's Attempt Summary (if attempted) */}
          {todayAttempt ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-extrabold text-emerald-300">
                    Today&apos;s Challenge Completed!
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  +{todayAttempt.rankPointsAwarded || 65} LP Earned
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Score / Marks</div>
                  <div className="font-mono font-black text-amber-300 text-sm">
                    {todayAttempt.score} / {todayAttempt.maxMarks}
                  </div>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Accuracy</div>
                  <div className="font-mono font-black text-emerald-300 text-sm">
                    {todayAttempt.percentage}%
                  </div>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/20">
                  <div className="text-[10px] text-slate-400">Time Taken</div>
                  <div className="font-mono font-black text-sky-300 text-sm">
                    {formatDuration(todayAttempt.timeTakenSeconds)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-850/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Today&apos;s daily challenge is pending!</span>
              </div>
              <span className="text-amber-400 font-bold">20 Qs • 2 Min</span>
            </div>
          )}

          {/* Recent History Table */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recent Challenge Attempts (Last 30 Days)
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {thirtyDayAttempts && thirtyDayAttempts.length > 0 ? (
                [...thirtyDayAttempts].reverse().map((att, idx) => {
                  const isToday = att.date === getTodayDateString();
                  return (
                    <div 
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isToday 
                          ? 'bg-slate-800/90 border-emerald-500/40 text-slate-100' 
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div>
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span>{formatDisplayDate(att.date)}</span>
                            {isToday && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                TODAY
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(att.timeTakenSeconds)}</span>
                            <span>•</span>
                            <span>{att.correctCount} correct / {att.wrongCount} wrong</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-amber-400 text-xs">
                          {att.score} / {att.maxMarks} ({att.percentage}%)
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono">
                          +{att.rankPointsAwarded || 65} LP
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-400">
                  No challenge attempts recorded in the last 30 days. Complete today&apos;s drill to start your graph!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-850/90 flex items-center justify-end">
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
