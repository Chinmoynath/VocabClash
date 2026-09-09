import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Trophy,
  Database,
  ArrowLeftRight,
  Target,
  Quote,
  RefreshCw
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
  onStartDrill: (category: SscTop100Category, resumeIndex?: number, initialCorrect?: number) => void;
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

  // Load user progress for all 4 categories with midnight rollover auto-refresh
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
          newMap[prog.category] = {
            ...prog,
            solvedCount: Math.min(100, prog.solvedCount),
            correctCount: Math.min(100, prog.correctCount),
            currentQuestionIndex: Math.min(100, prog.currentQuestionIndex),
          };
        });
        setProgressMap(newMap);
      } catch (err) {
        console.warn('Error loading SSC Top 100 progress:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgress();

    // Check periodically and on window focus so midnight rollover immediately reflects
    const interval = setInterval(() => {
      loadProgress();
    }, 60000);

    const handleFocus = () => {
      loadProgress();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId]);

  const handleStartCategory = (category: SscTop100Category) => {
    soundManager.playTap();
    const currentProgress = progressMap[category];
    const resumeIndex = currentProgress.status === 'completed' ? 0 : Math.min(99, currentProgress.currentQuestionIndex);
    const initialCorrect = currentProgress.status === 'completed' ? 0 : Math.min(100, currentProgress.correctCount);
    onStartDrill(category, resumeIndex, initialCorrect);
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

  // Category Icon helper with serious vector icons
  const getCategoryIcon = (category: SscTop100Category) => {
    switch (category) {
      case 'synonyms':
        return <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
      case 'antonyms':
        return <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />;
      case 'ows':
        return <Target className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />;
      case 'idioms':
        return <Quote className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />;
      default:
        return <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
    }
  };

  return (
    <section id="ssc-top-100-section" className="w-full mt-1 mb-2">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 shadow-xl backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="max-w-3xl">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                TCS & Eduquity PYQ Bank
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-sky-400 bg-sky-950/50 px-2.5 py-0.5 rounded-full border border-sky-500/40 shadow-sm">
                400 Questions
              </span>
            </div>

            <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Top 100 Vocab Drill</span>
            </h2>
          </div>

          {/* Right Action & Vault Progress Strip */}
          <div className="flex flex-row items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-sm flex items-center gap-2.5">
              <div className="text-right">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Vault Mastered
                </div>
                <div className="text-sm sm:text-base font-black text-sky-400 font-mono leading-tight">
                  {totalSolvedAll} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">/ 400</span>
                </div>
              </div>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Trophy className="w-4 h-4" />
              </div>
            </div>

            {/* Admin Diagnostics Pill */}
            {isAdmin && (
              <button
                onClick={handleOpenDiagnostics}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600 text-slate-200 text-xs font-semibold shadow-sm transition-all"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" />
                Admin Rankings
              </button>
            )}
          </div>
        </div>

        {/* 4 Category Cards Grid: 2-card system side-by-side (2 up, 2 down) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 mt-3 sm:mt-4">
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
                className="group relative flex flex-col justify-between bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer overflow-hidden"
              >
                {/* Card Content: Icon, Solved count badge, Title */}
                <div>
                  {/* Top Bar: Icon & Solved Count Badge */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                      {getCategoryIcon(catInfo.id)}
                    </div>

                    <span
                      className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-sm ${
                        isCompleted
                          ? 'bg-sky-950/70 border-sky-500/40 text-sky-300'
                          : isInProgress
                          ? 'bg-slate-800 border-slate-700 text-sky-400 font-mono'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-sky-400" />
                          <span>100</span>
                        </>
                      ) : (
                        <span>{solvedCount}/100</span>
                      )}
                    </span>
                  </div>

                  {/* Title (Clean, crisp, no Hindi wording) */}
                  <h3 className="text-xs sm:text-sm lg:text-base font-bold text-white group-hover:text-sky-300 transition-colors leading-tight">
                    {catInfo.title}
                  </h3>
                </div>

                {/* Card Bottom: Slim Progress Bar & Action CTA */}
                <div className="mt-3.5 space-y-2">
                  {/* Slim Progress Bar */}
                  <div className="w-full bg-slate-800/60 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Action CTA Button */}
                  <div>
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCategory(catInfo.id);
                        }}
                        className="w-full py-1.5 sm:py-2 px-2 bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-sky-300 font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all"
                      >
                        <span>Retake</span>
                        <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
                      </button>
                    ) : isInProgress ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleResetCategory(e, catInfo.id)}
                          title="Reset from question #1"
                          className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartCategory(catInfo.id);
                          }}
                          className="flex-1 py-1.5 sm:py-2 px-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] sm:text-xs rounded-lg sm:rounded-xl flex items-center justify-center gap-0.5 shadow-sm transition-all truncate"
                        >
                          <span>Resume</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCategory(catInfo.id);
                        }}
                        className="w-full py-1.5 sm:py-2 px-2 bg-slate-800/80 group-hover:bg-sky-500 group-hover:text-slate-950 border border-slate-700/80 group-hover:border-sky-400 text-slate-200 font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all duration-200"
                      >
                        <span>Start Drill</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
                  <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
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
