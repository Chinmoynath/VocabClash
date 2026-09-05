import React from 'react';
import { 
  MentorPeriod, 
  MentorAnalytics, 
  MentorAiReport, 
  PlayerProfile,
  QuestionCategory,
  SavedWord 
} from '../types';
import { 
  MIN_SAMPLE_THRESHOLD, 
  MIN_USER_QUESTIONS_FOR_FULL_REPORT 
} from '../services/mentorAnalyticsService';
import { 
  Target, 
  Zap, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowRight, 
  ShieldAlert, 
  Calendar, 
  Award,
  Search
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { RepeatedMistakesRow } from './RepeatedMistakesRow';

export interface MentorDiagnosticsViewProps {
  analytics: MentorAnalytics;
  selectedPeriod: MentorPeriod;
  onSelectPeriod: (period: MentorPeriod) => void;
  mentorReport: MentorAiReport | null;
  reportLoading: boolean;
  onRefreshReport: () => void;
  onLaunchDrill: () => void;
  isPreparingDrill: boolean;
  player: PlayerProfile;
  savedWords?: SavedWord[];
  onAnalyzeWord?: (word: string) => void;
}

export const MentorDiagnosticsView: React.FC<MentorDiagnosticsViewProps> = ({
  analytics,
  selectedPeriod,
  onSelectPeriod,
  mentorReport,
  reportLoading,
  onRefreshReport,
  onLaunchDrill,
  isPreparingDrill,
  player,
  savedWords = [],
  onAnalyzeWord,
}) => {
  const weakCatStat = analytics.weakestCategory ? analytics.categoryStats[analytics.weakestCategory] : null;
  const strongCatStat = analytics.strongestCategory ? analytics.categoryStats[analytics.strongestCategory] : null;
  const qualifiedCategoriesCount = (['antonyms', 'synonyms', 'ows', 'idioms'] as QuestionCategory[])
    .filter(c => analytics.categoryStats[c]?.hasEnoughData).length;

  return (
    <div className="space-y-4">
      {/* 1. Time Period Selector */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 sm:p-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['week', 'month', 'all_time'] as MentorPeriod[]).map(period => {
            const isSelected = selectedPeriod === period;
            const labels: Record<MentorPeriod, string> = {
              week: 'This Week',
              month: 'This Month',
              all_time: 'All Time',
            };

            return (
              <button
                key={period}
                onClick={() => {
                  soundManager.playTap();
                  onSelectPeriod(period);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {labels[period]}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 pr-2">
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          <span>{analytics.periodLabel}</span>
        </div>
      </div>

      {/* 2. Low-Data State Banner (< 20 questions) */}
      {!analytics.hasEnoughUserData && (
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm sm:text-base font-black text-slate-100">
                Your Mentor is getting to know your learning profile.
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Attempt at least 20 vocabulary questions across practice, 1v1 battles, or drills to unlock full accuracy diagnostics and coaching trends.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (analytics.totalAttempted / MIN_USER_QUESTIONS_FOR_FULL_REPORT) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-purple-300 font-bold">
                {analytics.totalAttempted} / {MIN_USER_QUESTIONS_FOR_FULL_REPORT} questions
              </span>
            </div>
          </div>

          <button
            onClick={onLaunchDrill}
            disabled={isPreparingDrill}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all shrink-0 cursor-pointer"
          >
            <span>Start Practice (10 Questions)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Performance Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                {selectedPeriod === 'week' ? 'THIS WEEK' : selectedPeriod === 'month' ? 'THIS MONTH' : 'ALL TIME'}
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-100">
                Performance Diagnostics
              </h2>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-300">
              {analytics.totalAttempted > 0 ? (
                <span>
                  <b>{analytics.totalAttempted}</b> Questions · <b className="text-emerald-400">{analytics.totalCorrect}</b> Correct · <b className="text-rose-400">{analytics.totalWrong}</b> Incorrect · <b className="text-sky-400">{analytics.overallAccuracy}% Accuracy</b>
                </span>
              ) : (
                <span className="text-slate-400">0 Questions attempted in this period</span>
              )}
            </div>
          </div>

          {/* Comparison with Previous Equivalent Period */}
          {analytics.accuracyDeltaPp !== null ? (
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {analytics.accuracyDeltaPp > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-emerald-300">
                    +{analytics.accuracyDeltaPp} percentage points
                  </span>
                </>
              ) : analytics.accuracyDeltaPp < 0 ? (
                <>
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-rose-300">
                    {analytics.accuracyDeltaPp} percentage points
                  </span>
                </>
              ) : (
                <>
                  <Minus className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-300">Stable accuracy</span>
                </>
              )}
              <span className="text-slate-500 font-medium">
                {analytics.previousPeriodLabel}
              </span>
            </div>
          ) : selectedPeriod !== 'all_time' ? (
            <div className="self-start sm:self-auto text-[11px] text-slate-500">
              {analytics.totalAttempted > 0
                ? 'Comparison available after next active cycle'
                : 'No activity recorded yet in this period'}
            </div>
          ) : null}
        </div>

        {/* Strongest & Weakest Callout Pills */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {strongCatStat && strongCatStat.accuracy !== null && strongCatStat.hasEnoughData ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
              <span className="text-slate-400 font-medium">STRONGEST:</span>
              <span className="font-bold text-emerald-300">{strongCatStat.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 font-mono font-bold text-[11px] text-emerald-200">
                {strongCatStat.accuracy}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <span className="font-medium">STRONGEST:</span>
              <span>Need ≥5 attempts in a category</span>
            </div>
          )}

          {weakCatStat && weakCatStat.accuracy !== null && weakCatStat.hasEnoughData ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs">
              <span className="text-slate-400 font-medium">NEEDS ATTENTION:</span>
              <span className="font-bold text-rose-300">{weakCatStat.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-900/60 font-mono font-bold text-[11px] text-rose-200">
                {weakCatStat.accuracy}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <span className="font-medium">NEEDS ATTENTION:</span>
              <span>
                {qualifiedCategoriesCount < 2
                  ? 'Need ≥5 attempts across 2+ categories to compare'
                  : 'Consistent accuracy across categories'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Action Hero: "Train My Weak Areas" */}
      <div className="bg-slate-900 border-2 border-purple-500/40 hover:border-purple-500/70 rounded-2xl p-4 sm:p-5 shadow-md transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <span>Train My Weak Areas (10 Questions)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Curates a high-yield targeted drill prioritizing your repeatedly missed words, due spaced repetition cards, and lowest-scoring category ({weakCatStat?.name || 'priority areas'}).
            </p>
          </div>

          <button
            onClick={onLaunchDrill}
            disabled={isPreparingDrill}
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all shrink-0 cursor-pointer"
          >
            {isPreparingDrill ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Assembling Drill...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Start Weak Area Drill</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5. Category Diagnosis */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-sky-400" />
              Category Breakdown & Accuracy
            </h3>
            <p className="text-[11px] text-slate-400">
              Deterministic metrics for {analytics.periodLabel.toLowerCase()}.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Min {MIN_SAMPLE_THRESHOLD} questions required for strength assessment
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {(['antonyms', 'synonyms', 'ows', 'idioms'] as QuestionCategory[]).map(catKey => {
            const cat = analytics.categoryStats[catKey];
            if (!cat) return null;

            const isUnattempted = cat.attempted === 0;
            const isLimitedData = cat.attempted > 0 && !cat.hasEnoughData;
            const isWeak = analytics.weakestCategory === catKey && cat.hasEnoughData;
            const isStrong = analytics.strongestCategory === catKey && cat.hasEnoughData;

            return (
              <div
                key={catKey}
                className={`p-3.5 rounded-xl border transition-all ${
                  isUnattempted
                    ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                    : isWeak
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    : isStrong
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">({cat.hindiName})</span>
                    
                    {isUnattempted && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] font-bold uppercase">
                        Not attempted
                      </span>
                    )}
                    {isLimitedData && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 text-[9px] font-bold">
                        Limited data ({cat.attempted}/{MIN_SAMPLE_THRESHOLD})
                      </span>
                    )}
                    {isWeak && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-extrabold uppercase">
                        Needs Focus
                      </span>
                    )}
                    {isStrong && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold uppercase">
                        Strongest
                      </span>
                    )}
                  </div>

                  <span className="font-mono font-black text-xs shrink-0">
                    {cat.accuracy !== null ? `${cat.accuracy}%` : 'Not attempted'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isUnattempted
                        ? 'bg-transparent'
                        : isWeak
                        ? 'bg-rose-500'
                        : isStrong
                        ? 'bg-emerald-500'
                        : isLimitedData
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                    }`}
                    style={{ width: cat.accuracy !== null ? `${cat.accuracy}%` : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                  <span>
                    {isUnattempted
                      ? 'No attempts in this period'
                      : `${cat.attempted} attempted · ${cat.correct} correct · ${cat.wrong} wrong`}
                  </span>
                  <span>
                    {isUnattempted ? (
                      <span className="text-slate-500">Practice to unlock</span>
                    ) : isLimitedData ? (
                      <span className="text-amber-400 font-medium">Need {MIN_SAMPLE_THRESHOLD - cat.attempted} more</span>
                    ) : isWeak ? (
                      <span className="text-rose-400 font-bold">Priority Area</span>
                    ) : isStrong ? (
                      <span className="text-emerald-400 font-bold">Solid Foundation</span>
                    ) : (
                      <span className="text-slate-400">Stable</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Words You're Repeatedly Missing */}
      <RepeatedMistakesRow
        items={analytics.repeatedMistakes}
        fallbackSavedWords={savedWords}
        onAnalyzeWord={(word, cat) => {
          if (onAnalyzeWord) {
            onAnalyzeWord(word);
          }
        }}
      />

      {/* 7. Vocab Mentor Report */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-100">
                Vocab Mentor Coaching Report
              </h3>
              <p className="text-[10px] text-slate-400">
                Grounded evaluation for {analytics.periodLabel.toLowerCase()} ({player.targetExam || 'SSC CGL'})
              </p>
            </div>
          </div>

          <button
            onClick={onRefreshReport}
            disabled={reportLoading}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Refresh coaching report with current data"
          >
            <RefreshCw className={`w-3 h-3 ${reportLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refresh Report</span>
          </button>
        </div>

        {reportLoading && !mentorReport ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Analyzing real performance metrics and structuring report...</span>
          </div>
        ) : mentorReport ? (
          <div className="space-y-3">
            {/* Section 1: Diagnosis */}
            <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Diagnosis</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {mentorReport.diagnosis}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Section 2: What Improved */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. What Improved</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {mentorReport.whatImproved}
                </p>
              </div>

              {/* Section 3: Main Weakness */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>3. Main Weakness</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {mentorReport.mainWeakness}
                </p>
              </div>
            </div>

            {/* Section 4: What to Do Next */}
            <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-sky-400" />
                <span>4. What to Do Next</span>
              </div>
              <div className="space-y-1.5">
                {mentorReport.whatToDoNext.map((step, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800/90 text-slate-300 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="font-medium leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Short Encouragement */}
            <div className="bg-gradient-to-r from-purple-950/40 to-slate-950 border border-purple-500/30 p-3 rounded-xl flex items-center gap-2.5">
              <Award className="w-4 h-4 text-purple-400 shrink-0" />
              <p className="text-xs text-purple-200 font-medium italic leading-relaxed">
                "{mentorReport.encouragement}"
              </p>
            </div>

            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
              <span>Grounded strictly in computed analytics · Zero fabricated numbers</span>
              <span>{mentorReport.isFallback ? 'Deterministic report' : 'AI Mentor Coach'}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
