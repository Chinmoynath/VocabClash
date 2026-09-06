import React, { useState, useEffect } from 'react';
import {
  Flame,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  BookOpen,
  Trophy,
  ArrowRight,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import {
  SscTop100Category,
  SSC_TOP_100_CATEGORIES,
  SscTop100CategoryInfo
} from '../data/sscTop100';
import {
  sscTop100Service,
  SscTop100Progress,
  SscVocabRankingDiagnostic
} from '../services/sscTop100Service';
import { soundManager } from '../utils/audio';

interface SscTop100SectionProps {
  userId?: string;
  onStartDrill: (category: SscTop100Category, resumeIndex?: number) => void;
  isAdmin?: boolean;
}

export const SscTop100Section: React.FC<SscTop100SectionProps> = ({
  userId,
  onStartDrill,
  isAdmin = false,
}) => {
  const [progressMap, setProgressMap] = useState<Record<SscTop100Category, SscTop100Progress>>({
    synonyms: { category: 'synonyms', completedQuestionIds: [], solvedCount: 0, correctCount: 0, currentQuestionIndex: 0, status: 'not_started', lastAttemptAt: 0 },
    antonyms: { category: 'antonyms', completedQuestionIds: [], solvedCount: 0, correctCount: 0, currentQuestionIndex: 0, status: 'not_started', lastAttemptAt: 0 },
    ows: { category: 'ows', completedQuestionIds: [], solvedCount: 0, correctCount: 0, currentQuestionIndex: 0, status: 'not_started', lastAttemptAt: 0 },
    idioms: { category: 'idioms', completedQuestionIds: [], solvedCount: 0, correctCount: 0, currentQuestionIndex: 0, status: 'not_started', lastAttemptAt: 0 },
  });

  const [loading, setLoading] = useState(true);
  const [showAdminDiagnostics, setShowAdminDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SscVocabRankingDiagnostic[]>([]);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);

  // Load user progress for all 4 categories
  useEffect(() => {
    let isMounted = true;

    async function loadProgress() {
      try {
        const results = await Promise.all(
          SSC_TOP_100_CATEGORIES.map(cat => sscTop100Service.fetchUserProgress(userId, cat.id))
        );

        if (!isMounted) return;

        const newMap = { ...progressMap };
        results.forEach(prog => {
          newMap[prog.category] = prog;
        });
        setProgressMap(newMap);
      } catch (err) {
        console.warn('Error loading SSC Top 100 progress:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleStartCategory = (category: SscTop100Category) => {
    soundManager.playTap();
    const currentProgress = progressMap[category];
    const resumeIndex = currentProgress.status === 'completed' ? 0 : currentProgress.currentQuestionIndex;
    onStartDrill(category, resumeIndex);
  };

  const handleResetCategory = async (e: React.MouseEvent, category: SscTop100Category) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to reset your progress for Top 100 ${category}? You can retake from question #1.`)) {
      return;
    }

    soundManager.playTap();
    await sscTop100Service.resetUserProgress(userId, category);
    const refreshed = await sscTop100Service.fetchUserProgress(userId, category);
    setProgressMap(prev => ({
      ...prev,
      [category]: refreshed,
    }));
  };

  const handleOpenDiagnostics = async () => {
    soundManager.playTap();
    setShowAdminDiagnostics(true);
    const data = await sscTop100Service.inspectSscRankings();
    setDiagnostics(data);
  };

  const handleTriggerRebuild = async () => {
    if (!window.confirm('Rebuild and sync authoritative Top 100 lists to Firestore for all categories?')) {
      return;
    }
    soundManager.playTap();
    setIsRebuilding(true);
    setRebuildMessage(null);
    try {
      const res = await sscTop100Service.rebuildAndSyncSscTop100();
      setRebuildMessage(res.summary);
      const data = await sscTop100Service.inspectSscRankings();
      setDiagnostics(data);
    } catch (err: any) {
      setRebuildMessage(`Rebuild failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  // Total solved questions across all 4 categories
  const totalSolvedAll = (Object.values(progressMap) as SscTop100Progress[]).reduce(
    (acc, p) => acc + (p.completedQuestionIds?.length || 0),
    0
  );
  const totalMasteredCount = (Object.values(progressMap) as SscTop100Progress[]).filter(
    p => (p.completedQuestionIds?.length || 0) >= 100
  ).length;

  return (
    <section id="ssc-top-100-section" className="w-full mt-4 sm:mt-6 mb-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-950/80 via-slate-900/95 to-slate-950 border border-amber-500/40 p-5 sm:p-6 lg:p-7 shadow-2xl backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-gradient-to-r from-amber-500/25 to-orange-500/25 border border-amber-400/50 text-amber-300 shadow-sm">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                SSC TOP 100
              </span>
              <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                TCS Most Repeated PYQ Bank
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                400 High-Yield Questions
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Repeated Vocabulary Vault</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              Master the definitive high-frequency vocabulary asked repeatedly across{' '}
              <span className="text-amber-300 font-semibold">SSC CGL, CHSL, CPO, MTS & Selection Post</span>.
              Curated and ranked #1 to #100 by authentic exam shift frequency with Hindi meanings, mnemonics & 4-option explanations.
            </p>
          </div>

          {/* Right Action & Vault Progress Strip on PC */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-md flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Vault Mastered
                </div>
                <div className="text-base sm:text-lg font-black text-amber-300 font-mono">
                  {totalSolvedAll} <span className="text-xs font-semibold text-slate-400">/ 400</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
            </div>

            {/* Admin Diagnostics Pill */}
            {isAdmin && (
              <button
                onClick={handleOpenDiagnostics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600 text-slate-200 text-xs font-semibold shadow-sm transition-all"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                Admin Rankings
              </button>
            )}
          </div>
        </div>

        {/* 4 Category Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4.5 lg:gap-5 mt-6">
          {SSC_TOP_100_CATEGORIES.map((catInfo: SscTop100CategoryInfo) => {
            const prog = progressMap[catInfo.id] || {
              completedQuestionIds: [],
              solvedCount: 0,
              correctCount: 0,
              status: 'not_started',
            };

            const solvedCount = prog.completedQuestionIds?.length || 0;
            const progressPercent = Math.min(100, Math.round((solvedCount / catInfo.targetCount) * 100));
            const isCompleted = solvedCount >= catInfo.targetCount;
            const isInProgress = solvedCount > 0 && !isCompleted;

            return (
              <div
                key={catInfo.id}
                id={`ssc-top-100-card-${catInfo.id}`}
                onClick={() => handleStartCategory(catInfo.id)}
                className="group relative flex flex-col justify-between bg-gradient-to-b from-slate-900/95 to-slate-950/95 hover:from-slate-850 hover:to-slate-900 border border-slate-800/90 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer overflow-hidden min-h-[220px]"
              >
                {/* Accent top highlight bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 transition-all ${
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 opacity-80 group-hover:opacity-100'
                  }`}
                />

                {/* Card Top: Icon, Badges, Title, Hindi */}
                <div>
                  {/* Top Bar: Icon & Solved Count Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/70 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform shrink-0">
                      {catInfo.icon}
                    </div>

                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-sm ${
                        isCompleted
                          ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                          : isInProgress
                          ? 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                          : 'bg-slate-800/90 border-slate-700 text-slate-300'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>100/100</span>
                        </>
                      ) : (
                        <span>{solvedCount} / {catInfo.targetCount}</span>
                      )}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {catInfo.title}
                  </h3>

                  {/* Hindi Translation Pill */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-block text-xs font-semibold text-amber-300/90 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                      {catInfo.hindiTitle}
                    </span>
                  </div>
                </div>

                {/* Card Bottom: Progress Bar & Distinct Action Button */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 space-y-3">
                  {/* Progress Header & Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="text-slate-400">
                        {isCompleted
                          ? 'All 100 Mastered'
                          : isInProgress
                          ? `${progressPercent}% Solved`
                          : '100 PYQs Pool'}
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {solvedCount}/100
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="pt-0.5">
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCategory(catInfo.id);
                        }}
                        className="w-full py-2.5 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        <span>Review & Retake</span>
                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                      </button>
                    ) : isInProgress ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleResetCategory(e, catInfo.id)}
                          title="Reset and start over from question #1"
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartCategory(catInfo.id);
                          }}
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-md transition-all truncate"
                        >
                          <span>Resume (Q{Math.min(100, solvedCount + 1)})</span>
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCategory(catInfo.id);
                        }}
                        className="w-full py-2.5 px-3 bg-slate-800/90 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-slate-950 border border-slate-700 group-hover:border-amber-400/80 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all duration-200"
                      >
                        <span>Start Practice</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin Diagnostics Modal / Panel */}
      {showAdminDiagnostics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">
                  SSC Top 100 Rankings & Firestore Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setShowAdminDiagnostics(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    Cloud Ranking Sync Engine
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Generates the top 100 most repeated SSC questions per category and updates Firestore collections.
                  </div>
                </div>

                <button
                  onClick={handleTriggerRebuild}
                  disabled={isRebuilding}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all whitespace-nowrap"
                >
                  <Flame className="w-4 h-4" />
                  {isRebuilding ? 'Rebuilding & Syncing...' : 'Rebuild & Sync SSC Top 100'}
                </button>
              </div>

              {rebuildMessage && (
                <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-600 text-amber-200 text-xs font-medium">
                  {rebuildMessage}
                </div>
              )}

              {/* Diagnostic Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diagnostics.map(diag => (
                  <div key={diag.category} className="bg-slate-850 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        {diag.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {diag.totalPoolScanned} questions ranked
                      </span>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {diag.topRankedSample.slice(0, 5).map(item => (
                        <div
                          key={item.rank}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900 border border-slate-800"
                        >
                          <span className="font-semibold text-slate-200 truncate max-w-[160px]">
                            #{item.rank} {item.word}
                          </span>
                          <span className="text-[11px] font-bold text-amber-300">
                            {item.repeatCount} repeats
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAdminDiagnostics(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
