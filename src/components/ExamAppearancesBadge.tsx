import React, { useState, useRef, useEffect } from 'react';
import { ExamAppearance } from '../types';
import { formatExamTag } from '../services/jsonPyqParser';
import { sortAppearances } from '../utils/questionFingerprint';
import { Layers, ChevronDown, X, History, Sparkles } from 'lucide-react';

interface ExamAppearancesBadgeProps {
  appearances?: ExamAppearance[];
  exam?: string;
  year?: number;
  tier?: string;
  examHistory?: string[];
  repeatCount?: number;
  maxVisibleMobile?: number;
  maxVisibleDesktop?: number;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'center' | 'right';
  showRepeatCount?: boolean;
}

export const ExamAppearancesBadge: React.FC<ExamAppearancesBadgeProps> = ({
  appearances,
  exam,
  year,
  tier,
  examHistory,
  repeatCount,
  maxVisibleMobile = 2,
  maxVisibleDesktop = 3,
  className = '',
  size = 'sm',
  align = 'center',
  showRepeatCount = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Build resolved appearances list
  const resolvedList: ExamAppearance[] = React.useMemo(() => {
    if (Array.isArray(appearances) && appearances.length > 0) {
      return sortAppearances(appearances.filter(a => Boolean(a && a.exam)));
    }

    if (exam || year || tier) {
      return [
        {
          exam: exam || 'Govt Exam',
          year: year || 2024,
          tier: tier || '',
        },
      ];
    }

    if (Array.isArray(examHistory) && examHistory.length > 0) {
      return examHistory.map(tag => ({
        exam: tag,
        year: 2024,
        tier: '',
      }));
    }

    return [
      {
        exam: 'Govt Exam PYQ',
        year: 2024,
        tier: '',
      },
    ];
  }, [appearances, exam, year, tier, examHistory]);

  const totalCount = resolvedList.length;
  const isMultiAppearance = totalCount > 1;

  const sizeClasses = {
    xs: 'text-[10px] px-2 py-0.5',
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3 py-1.5',
  }[size];

  const justifyClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[align];

  return (
    <div className={`relative inline-flex flex-wrap items-center gap-1.5 ${justifyClass} ${className}`}>
      {/* If single appearance */}
      {!isMultiAppearance ? (
        <span className={`inline-flex items-center gap-1 font-medium rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 ${sizeClasses}`}>
          <History className="w-3 h-3 text-sky-400 shrink-0" />
          <span>{formatExamTag(resolvedList[0].exam, resolvedList[0].year, resolvedList[0].tier)}</span>
        </span>
      ) : (
        /* Multiple appearances */
        <>
          {/* Visible pills on desktop (maxVisibleDesktop) and mobile (maxVisibleMobile) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {resolvedList.slice(0, maxVisibleDesktop).map((app, idx) => (
              <span
                key={`${app.exam}_${app.year}_${app.tier}_${idx}`}
                className={`inline-flex items-center gap-1 font-medium rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 ${sizeClasses} ${
                  idx >= maxVisibleMobile ? 'hidden sm:inline-flex' : 'inline-flex'
                }`}
              >
                <History className="w-3 h-3 text-sky-400 shrink-0" />
                <span>{formatExamTag(app.exam, app.year, app.tier)}</span>
              </span>
            ))}

            {/* Overflow badge (+N more) button */}
            {totalCount > maxVisibleMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
                className={`inline-flex items-center gap-1 font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer ${sizeClasses}`}
                title="View all exam appearances for this question"
                aria-expanded={isOpen}
              >
                <Layers className="w-3 h-3 text-amber-400" />
                <span className="sm:hidden">
                  +{totalCount - maxVisibleMobile} {totalCount - maxVisibleMobile === 1 ? 'exam' : 'exams'}
                </span>
                <span className="hidden sm:inline">
                  {totalCount > maxVisibleDesktop ? `+${totalCount - maxVisibleDesktop} more` : 'All exams'}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </>
      )}

      {/* Repeat count badge if requested */}
      {showRepeatCount && (repeatCount || totalCount) > 1 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" />
          {repeatCount || totalCount}x
        </span>
      )}

      {/* Floating Appearances Modal / Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl p-3.5 space-y-2.5 text-left text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{ [align === 'right' ? 'right' : 'left']: 0 }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>All Exam Appearances ({totalCount})</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              aria-label="Close popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
            {resolvedList.map((app, idx) => (
              <div
                key={`pop_${app.exam}_${app.year}_${app.tier}_${idx}`}
                className="pt-1.5 first:pt-0 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {app.exam}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span className="font-mono text-sky-400">{app.year}</span>
                      {app.tier && app.tier.trim() && app.tier !== 'Not Specified' && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{app.tier}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-bold shrink-0">
                  {app.examFamily || 'Govt'}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
            Canonical PYQ merged across multiple exams. Progress & mastery are unified as one question.
          </div>
        </div>
      )}
    </div>
  );
};
