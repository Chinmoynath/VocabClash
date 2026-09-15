import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  CheckCircle2, 
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { PlayerProfile, DailyStreakState, SavedWord, QuestionCategory } from '../types';
import { 
  getDailyStudySummary, 
  DailyStudySummary, 
} from '../services/dailyCommandCenterService';
import { trackNextBestActionView, trackNextBestActionClick } from '../services/analyticsService';
import { soundManager } from '../utils/audio';
import { SscTop100Category } from '../data/sscTop100';

interface DailyCommandCenterCardProps {
  player: PlayerProfile;
  dailyStreak: DailyStreakState;
  savedWords: SavedWord[];
  currentUser?: FirebaseUser | null;
  onStartDueRevision: (dueWords: SavedWord[]) => void;
  onNavigateTab?: (tab: 'arena' | 'practice' | 'leaderboard' | 'mistakes' | 'ai_coach') => void;
  onStartMatchmaking?: (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => void;
  onSelectCategory?: (category: QuestionCategory | 'mixed') => void;
  onStartSscTop100Drill?: (category: SscTop100Category, resumeIndex?: number) => void;
}

export const DailyCommandCenterCard: React.FC<DailyCommandCenterCardProps> = ({
  player,
  dailyStreak,
  savedWords,
  currentUser,
  onStartDueRevision,
  onNavigateTab,
  onStartMatchmaking,
  onSelectCategory,
  onStartSscTop100Drill,
}) => {
  const [summary, setSummary] = useState<DailyStudySummary>(() => 
    getDailyStudySummary(player, dailyStreak, savedWords, !!currentUser)
  );

  // Sync on prop changes or custom system events
  useEffect(() => {
    const refresh = () => {
      setSummary(getDailyStudySummary(player, dailyStreak, savedWords, !!currentUser));
    };

    refresh();
    window.addEventListener('user-stats-updated', refresh);
    window.addEventListener('daily-target-updated', refresh);
    return () => {
      window.removeEventListener('user-stats-updated', refresh);
      window.removeEventListener('daily-target-updated', refresh);
    };
  }, [player, dailyStreak, savedWords, currentUser]);

  // Track Next Best Action View in GA4 once per session / action type
  useEffect(() => {
    if (summary.nextBestAction) {
      trackNextBestActionView(summary.nextBestAction.type, summary.nextBestAction.priority);
    }
  }, [summary.nextBestAction.type]);

  const action = summary.nextBestAction;

  const handleActionClick = () => {
    soundManager.playTap();
    trackNextBestActionClick(action.type, action.priority);

    if (action.type === 'due_mistakes') {
      if (summary.dueSavedWords && summary.dueSavedWords.length > 0) {
        onStartDueRevision(summary.dueSavedWords);
      } else {
        if (onNavigateTab) onNavigateTab('practice');
      }
    } else if (action.type === 'resume_top100') {
      if (action.data?.top100Category && onStartSscTop100Drill) {
        onStartSscTop100Drill(action.data.top100Category, (action.data.top100Progress || 1) - 1);
      } else if (onNavigateTab) {
        onNavigateTab('practice');
      }
    } else if (action.type === 'daily_goal') {
      if (onNavigateTab) onNavigateTab('practice');
    } else if (action.type === 'weakest_area') {
      if (action.data?.category && onSelectCategory) {
        onSelectCategory(action.data.category);
      }
      if (onNavigateTab) onNavigateTab('practice');
    } else {
      if (onNavigateTab) onNavigateTab('practice');
    }
  };

  const target = summary.dailyTarget;

  return (
    <div 
      id="daily-command-center"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-sm relative overflow-hidden transition-all"
    >
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {/* Row 1: Greeting & Next Step Badge */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-200 truncate">
            {summary.greeting}, <span className="text-cyan-400 font-black">{summary.userName}</span>
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-md shrink-0">
            {action.badge || 'YOUR NEXT STEP'}
          </span>
        </div>

        {/* Row 2: Action Details & Main Action CTA (Side-by-Side on phone and desktop) */}
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 pt-0.5">
          {/* Action Details */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-xs text-sky-400">
              {action.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xs sm:text-sm text-slate-100 tracking-tight leading-snug truncate">
                {action.title}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                {action.subtitle}
              </p>
            </div>
          </div>

          {/* Primary CTA Button (Only 'Start' as requested for clean mobile layout) */}
          <button
            onClick={handleActionClick}
            className="shrink-0 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm tracking-wider border border-cyan-300 shadow-md shadow-cyan-950/50 hover:shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer group flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap"
          >
            <span>Start</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 shrink-0 transition-transform animate-arrow-nudge group-hover:translate-x-1" />
          </button>
        </div>

        {/* Row 3: Strongest & Weakest Category Strip (Clean, subtle white typography) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-slate-800/80 text-[11px]">
          {/* Strongest Area */}
          {summary.strongestCategory && summary.strongestCategoryLabel && (
            <button
              onClick={() => {
                if (summary.strongestCategory && onSelectCategory) {
                  onSelectCategory(summary.strongestCategory);
                }
                if (onNavigateTab) onNavigateTab('practice');
              }}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Practice strongest category"
            >
              <span className="text-slate-400 font-medium">Strongest:</span>
              <span className="font-bold text-white">{summary.strongestCategoryLabel}</span>
              {typeof summary.strongestAccuracy === 'number' && summary.strongestAccuracy > 0 && (
                <span className="text-slate-400 font-mono text-[10px]">({summary.strongestAccuracy}%)</span>
              )}
            </button>
          )}

          {/* Divider */}
          {summary.strongestCategory && summary.weakestCategory && (
            <span className="text-slate-700 select-none">•</span>
          )}

          {/* Weakest Area */}
          {summary.weakestCategory && summary.weakestCategoryLabel && (
            <button
              onClick={() => {
                if (summary.weakestCategory && onSelectCategory) {
                  onSelectCategory(summary.weakestCategory);
                }
                if (onNavigateTab) onNavigateTab('practice');
              }}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Train weakest category"
            >
              <span className="text-slate-400 font-medium">Weakest:</span>
              <span className="font-bold text-white">{summary.weakestCategoryLabel}</span>
              {typeof summary.weakestAccuracy === 'number' && summary.weakestAccuracy > 0 && (
                <span className="text-slate-400 font-mono text-[10px]">({summary.weakestAccuracy}%)</span>
              )}
            </button>
          )}

          {/* Spaced repetition mastery queue (compact) */}
          {summary.masteryStats.total > 0 && (
            <>
              <span className="text-slate-700 select-none hidden sm:inline">•</span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('mistakes')}
                className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="View Mistake Vault"
              >
                <span>{summary.masteryStats.learning} learning</span>
                {summary.masteryStats.mastered > 0 && (
                  <span className="text-emerald-400 font-mono">· {summary.masteryStats.mastered} mastered</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
