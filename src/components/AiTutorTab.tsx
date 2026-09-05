import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord, 
  Question, 
  QuestionCategory, 
  ExamType 
} from '../types';
import { soundManager } from '../utils/audio';
import { 
  calculateMentorDiagnostics, 
  getPersonalizedMentorInsight, 
  buildWeakAreasDrillQuestions,
  MentorDiagnostics,
  MentorAiInsight 
} from '../services/aiMentorCoachingService';
import { 
  getWordExplanationWithCache, 
  getDailyAiGenerationStatus, 
  getRecentCachedWords,
  ExplanationResponse 
} from '../services/aiTutorCacheService';
import { AiAnalysisResult } from '../utils/aiTutorEngine';
import { 
  Sparkles, 
  Target, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  RefreshCw, 
  Zap, 
  Crown, 
  Bookmark, 
  TrendingUp, 
  GraduationCap, 
  Languages, 
  ChevronRight,
  Flame,
  HelpCircle,
  Clock,
  ArrowRight,
  Lock
} from 'lucide-react';

export interface AiTutorTabProps {
  player?: PlayerProfile;
  streak?: DailyStreakState;
  savedWords?: SavedWord[];
  subscription?: { isPremium?: boolean };
  onStartTargetedPractice?: (questions: Question[], title: string) => void;
  onOpenUpgradeModal?: () => void;
  onBookmarkQuestion?: (question: Question) => void;
}

const DEFAULT_PLAYER_FALLBACK: PlayerProfile = {
  id: 'guest-aspirant',
  name: 'Aspirant',
  avatar: '👨‍🎓',
  country: 'India',
  countryCode: 'IN',
  targetExam: 'SSC CGL',
  rankPoints: 1200,
  pyqScore: 0,
  tier: 'GST_IT_Inspector',
  tierTitle: 'GST / IT Inspector',
  level: 1,
  matchesPlayed: 14,
  matchesWon: 9,
  winStreak: 3,
  accuracyRate: 68,
  bestCategory: 'synonyms',
  badges: [],
};

const DEFAULT_STREAK_FALLBACK: DailyStreakState = {
  currentStreak: 3,
  longestStreak: 5,
  lastActiveDate: new Date().toISOString().split('T')[0],
  lastActiveTimestamp: Date.now(),
  claimedToday: false,
  totalDaysActive: 3,
  history: {},
};

export const AiTutorTab: React.FC<AiTutorTabProps> = ({
  player = DEFAULT_PLAYER_FALLBACK,
  streak = DEFAULT_STREAK_FALLBACK,
  savedWords = [],
  subscription = { isPremium: false },
  onStartTargetedPractice,
  onOpenUpgradeModal,
  onBookmarkQuestion,
}) => {
  const isPremium = Boolean(subscription?.isPremium);

  // 1. Calculate deterministic performance diagnostics locally (0 Gemini overhead)
  const diagnostics: MentorDiagnostics = useMemo(() => {
    return calculateMentorDiagnostics(player, streak, savedWords);
  }, [player, streak, savedWords]);

  // 2. AI Coaching Daily Insight (Cached locally, 0 calls on repeated opens)
  const [mentorInsight, setMentorInsight] = useState<MentorAiInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadInsight = async () => {
      setInsightLoading(true);
      try {
        const insight = await getPersonalizedMentorInsight(diagnostics, false);
        if (isMounted) {
          setMentorInsight(insight);
        }
      } catch (err) {
        console.warn('Failed to load mentor insight:', err);
      } finally {
        if (isMounted) setInsightLoading(false);
      }
    };
    loadInsight();
    return () => {
      isMounted = false;
    };
  }, [diagnostics.weakestCategory, diagnostics.targetExam]);

  const handleRefreshInsight = async () => {
    soundManager.playTap();
    setInsightLoading(true);
    try {
      const fresh = await getPersonalizedMentorInsight(diagnostics, true);
      setMentorInsight(fresh);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setInsightLoading(false);
    }
  };

  // 3. Word Deep Dive & Search State (connected to Firestore `ai_tutor_cache`)
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>('ABERRATION');
  const [activeCategory, setActiveCategory] = useState<string>('synonyms');
  const [wordLoading, setWordLoading] = useState<boolean>(false);
  const [explanationData, setExplanationData] = useState<ExplanationResponse | null>(null);
  const [recentWords, setRecentWords] = useState<{ word: string; category?: string; tag?: string }[]>([]);
  const [dailyUsage, setDailyUsage] = useState(() => getDailyAiGenerationStatus(isPremium));
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDailyUsage(getDailyAiGenerationStatus(isPremium));
  }, [isPremium]);

  const isFreeLimitReached = !isPremium && dailyUsage.remaining <= 0;

  // Load initial explanation and recent cached words
  useEffect(() => {
    let isMounted = true;
    getRecentCachedWords(8).then(words => {
      if (isMounted && words.length > 0) {
        setRecentWords(words);
      }
    });

    fetchWordExplanation('ABERRATION');
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchWordExplanation = async (term: string) => {
    setWordLoading(true);
    try {
      const cleanTerm = term.trim();
      const detectedCat = cleanTerm.includes(' ') ? 'idioms' : 'synonyms';
      const response = await getWordExplanationWithCache(
        cleanTerm,
        detectedCat,
        isPremium,
        [diagnostics.targetExam, 'SSC CHSL', 'RRB NTPC']
      );
      setExplanationData(response);
      setActiveWord(cleanTerm.toUpperCase());
      setActiveCategory(detectedCat);
      setDailyUsage(getDailyAiGenerationStatus(isPremium));
    } catch (err) {
      console.warn('Word explanation error:', err);
    } finally {
      setWordLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFreeLimitReached) {
      soundManager.playWrong();
      if (onOpenUpgradeModal) onOpenUpgradeModal();
      return;
    }
    if (!searchInput.trim()) return;
    soundManager.playTap();
    const cleanWord = searchInput.trim();
    fetchWordExplanation(cleanWord);
    setSearchInput('');
  };

  const handleSelectWordChip = (term: string) => {
    if (isFreeLimitReached) {
      soundManager.playWrong();
      if (onOpenUpgradeModal) onOpenUpgradeModal();
      return;
    }
    soundManager.playTap();
    fetchWordExplanation(term);
  };

  // 4. "Train My Weak Areas" Action Trigger
  const [isPreparingDrill, setIsPreparingDrill] = useState<boolean>(false);

  const handleLaunchWeakAreasDrill = () => {
    soundManager.playTap();
    setIsPreparingDrill(true);

    try {
      const drillQuestions = buildWeakAreasDrillQuestions(
        diagnostics,
        (player.targetExam as ExamType) || 'SSC_CGL',
        10
      );

      const weakCatLabel = diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.name || 'Weak Areas';
      const drillTitle = `🎯 AI Mentor: ${weakCatLabel} & Mistakes Drill`;

      if (onStartTargetedPractice) {
        onStartTargetedPractice(drillQuestions, drillTitle);
      }
    } catch (err) {
      console.warn('Drill launch error:', err);
    } finally {
      setIsPreparingDrill(false);
    }
  };

  const handleSaveActiveWordToVault = () => {
    soundManager.playTap();
    if (onBookmarkQuestion && explanationData?.analysis) {
      const dummyQ: Question = {
        id: `mentor-${activeWord.toLowerCase()}`,
        wordOrPhrase: activeWord,
        category: activeCategory as QuestionCategory,
        exam: (player.targetExam as ExamType) || 'SSC_CGL',
        difficulty: 'medium',
        importanceLevel: 'high',
        exampleSentence: explanationData.analysis.sampleUsage || `The sentence tests "${activeWord}".`,
        meaning: explanationData.analysis.meaning || '',
        hindiMeaning: explanationData.analysis.hindiMeaning || '',
        options: [
          activeWord,
          explanationData.analysis.relatedWords?.[0] || 'Synonym',
          explanationData.analysis.relatedWords?.[1] || 'Antonym',
          'None of these'
        ],
        correctIndex: 0,
        mnemonic: explanationData.analysis.mnemonicHook || '',
        rootWordInfo: explanationData.analysis.rootEtymology,
        examHistory: [diagnostics.targetExam],
        repeatCount: 1,
        isPYQ: true,
      };
      onBookmarkQuestion(dummyQ);
      setSavedSuccessMessage(`⭐ "${activeWord}" saved to Revision Vault`);
      setTimeout(() => setSavedSuccessMessage(null), 2500);
    }
  };

  const weakCatName = diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.name || diagnostics.weakestCategory;
  const strongCatName = diagnostics.categoryBreakdown[diagnostics.strongestCategory]?.name || diagnostics.strongestCategory;
  const analysis = explanationData?.analysis;

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-5 pb-12 max-w-5xl mx-auto w-full">
      {/* Toast Notification */}
      {savedSuccessMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-amber-300 animate-bounce">
          <Bookmark className="w-4 h-4 fill-slate-950" />
          <span>{savedSuccessMessage}</span>
        </div>
      )}

      {/* 1. Header & Aspirant Performance Identity */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-100">
                  AI Vocab Mentor
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-mono font-bold">
                  {diagnostics.targetExam} Focus
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-semibold">
                  {player.tierTitle || 'Aspirant'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personalized performance diagnosis, weak area coaching, and instant root word breakdowns.
              </p>
            </div>
          </div>

          {/* Daily Generation Quota Status */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isPremium ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>VIP Pro: Unlimited AI</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    New AI Words: <b className="text-purple-300">{dailyUsage.remaining} / {dailyUsage.limit}</b> left today
                  </span>
                </div>
                {onOpenUpgradeModal && (
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onOpenUpgradeModal();
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-sm transition-all cursor-pointer"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Primary Action Hero: "Train My Weak Areas" */}
      <div className="bg-slate-900 border-2 border-purple-500/40 hover:border-purple-500/70 rounded-2xl p-4 sm:p-5 shadow-md transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Train My Weak Areas</span>
            </h2>
            
            {/* Clean Weakest and Strongest Highlights */}
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs">
                <span className="text-slate-400 font-medium">Your Weakest:</span>
                <span className="font-bold text-rose-300">{weakCatName}</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-900/60 font-mono font-bold text-[11px] text-rose-200">
                  {diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.isTested
                    ? `${diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.accuracy}%`
                    : 'Unattempted'}
                </span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
                <span className="text-slate-400 font-medium">Your Strongest:</span>
                <span className="font-bold text-emerald-300">{strongCatName}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 font-mono font-bold text-[11px] text-emerald-200">
                  {diagnostics.categoryBreakdown[diagnostics.strongestCategory]?.isTested
                    ? `${diagnostics.categoryBreakdown[diagnostics.strongestCategory]?.accuracy}%`
                    : 'Unattempted'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLaunchWeakAreasDrill}
            disabled={isPreparingDrill}
            className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all shrink-0 cursor-pointer"
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

      {/* 3. Deterministic Local Performance Diagnostics (4 Categories) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-sky-400" />
                Category Accuracy & Weak Area Diagnosis
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                All-Time Lifetime Performance
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {diagnostics.totalSolved > 0
                ? `Calculated from all questions you have answered till now (all matches, drills & PYQs): ${diagnostics.totalCorrect} correct out of ${diagnostics.totalSolved} total questions (${diagnostics.overallAccuracy}% lifetime accuracy)`
                : 'Cumulative all-time calculations based on all your attempted questions across 1v1 battles and practice modes'}
            </p>
          </div>
          <div className="sm:text-right">
            <div className="text-xs sm:text-sm font-mono font-black text-sky-400">
              {diagnostics.totalSolved > 0 ? `${diagnostics.overallAccuracy}% Lifetime Accuracy` : '0% Accuracy'}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {diagnostics.totalSolved > 0
                ? `All-Time: ${diagnostics.totalCorrect} of ${diagnostics.totalSolved} correct`
                : '0 questions solved'} · Readiness: {diagnostics.examReadinessScore}/100
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {(['antonyms', 'synonyms', 'ows', 'idioms'] as QuestionCategory[]).map(catKey => {
            const cat = diagnostics.categoryBreakdown[catKey];
            if (!cat) return null;

            const isTested = cat.isTested && cat.solved > 0;
            const isWeak = cat.isWeakest && isTested;
            const isStrong = cat.isStrongest && isTested && !isWeak;

            return (
              <div
                key={catKey}
                className={`p-3 rounded-xl border transition-all ${
                  !isTested
                    ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                    : isWeak
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    : isStrong
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{cat.name}</span>
                    {!isTested && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] font-bold uppercase">
                        Unattempted
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
                  <span className="font-mono font-black text-xs">
                    {isTested ? `${cat.accuracy}%` : '--%'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      !isTested
                        ? 'bg-transparent'
                        : isWeak
                        ? 'bg-rose-500'
                        : isStrong
                        ? 'bg-emerald-500'
                        : 'bg-sky-500'
                    }`}
                    style={{ width: isTested ? `${cat.accuracy}%` : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>
                    {isTested
                      ? `Solved: ${cat.solved} (${cat.correct} correct, ${cat.wrong} wrong)`
                      : 'Solved in matches/drills: 0'}
                  </span>
                  {!isTested ? (
                    <span className="text-slate-500">Not practiced yet</span>
                  ) : isWeak ? (
                    <span className="text-rose-400 font-semibold">Examiner Trap Risk: High</span>
                  ) : (
                    <span>Mastery: Stable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. AI Coaching Daily Insight (Cached, 0 calls on page open) */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
                Faculty Coach Assessment & Tactical Blueprint
              </h3>
              <p className="text-[10px] text-slate-400">
                Personalized guidance targeting your {diagnostics.targetExam} performance
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshInsight}
            disabled={insightLoading}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Refresh Coach Advice for your current stats"
          >
            <RefreshCw className={`w-3 h-3 ${insightLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span className="hidden sm:inline">Refresh Advice</span>
          </button>
        </div>

        {insightLoading && !mentorInsight ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Analyzing performance records and generating tactical advice...</span>
          </div>
        ) : mentorInsight ? (
          <div className="space-y-3 pt-1">
            {/* Diagnosis */}
            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Diagnostic Evaluation
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {mentorInsight.diagnosis}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Recommended Focus Roots */}
              <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3 h-3 text-sky-400" />
                  Recommended Roots for Today
                </div>
                <div className="space-y-1.5">
                  {mentorInsight.recommendedFocus?.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800/90 text-slate-300 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                      <span className="font-medium leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tactical Elimination Technique */}
              <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Exam-Day Elimination Tactic
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {mentorInsight.tacticalTip}
                </p>
                {mentorInsight.motivationalQuote && (
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] italic text-slate-400">
                    "{mentorInsight.motivationalQuote}"
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 5. Word Explorer & Deep Dive (Connected to Firestore `ai_tutor_cache`) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm relative overflow-hidden">
        {/* If free limit reached and not premium, display blur & lock overlay */}
        {isFreeLimitReached && (
          <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10 animate-pulse">
              <Lock className="w-7 h-7" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>5/5 Free AI Limit Reached</span>
            </div>
            <h4 className="text-base sm:text-lg font-black text-slate-100 max-w-md">
              AI Vocab Mentor Search Locked
            </h4>
            <p className="text-xs text-slate-300 max-w-md mt-1.5 leading-relaxed">
              You have used all 5 free AI vocabulary searches for today. Upgrade to VIP Pro to unlock unlimited real-time root word breakdowns, high-yield memory mnemonics, and exam trap analysis without daily caps.
            </p>
            {onOpenUpgradeModal && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  onOpenUpgradeModal();
                }}
                className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Crown className="w-4 h-4 text-slate-950" />
                <span>Unlock with VIP Pro (Instant Access)</span>
              </button>
            )}
          </div>
        )}

        <div className={`space-y-4 ${isFreeLimitReached ? 'filter blur-[3px] pointer-events-none select-none opacity-30' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-400" />
                Ask or Search Any Vocabulary, Idiom, or Concept
              </h3>
              <p className="text-[11px] text-slate-400">
                Type any word, idiom, phrase, or exam expression. The AI mentor analyzes roots, Hindi meaning, memory mnemonics, and examiner traps.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search or ask anything (e.g. Ephemeral, Bite the bullet, Taciturn, Plutocracy)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/70 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Explain
            </button>
          </form>

          {/* Trending & Recent Cached Word Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Explore:
            </span>
            {recentWords.map(item => (
              <button
                key={item.word}
                onClick={() => handleSelectWordChip(item.word)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                  activeWord === item.word
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                {item.word}
              </button>
            ))}
          </div>

          {/* Quota Exhaustion Banner (if reached free limit) */}
          {explanationData?.limitReached && !isFreeLimitReached && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <b>Daily Free AI Limit Reached (5/5).</b> Showing smart faculty knowledge base. All cached words remain unlimited.
                </span>
              </div>
              {onOpenUpgradeModal && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onOpenUpgradeModal();
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] self-start sm:self-auto cursor-pointer"
                >
                  Upgrade to Pro (Unlimited)
                </button>
              )}
            </div>
          )}

          {/* Word Explanation Details Card */}
          {wordLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              <span>Consulting Firestore cache and analyzing word origins...</span>
            </div>
          ) : analysis ? (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
              {/* Word Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xl sm:text-2xl font-black text-slate-100 tracking-wide">
                      {activeWord}
                    </h4>
                    {analysis.partOfSpeech && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 text-[10px] font-bold">
                        {analysis.partOfSpeech}
                      </span>
                    )}
                    {explanationData?.fromCache && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Cached (0 Quota)
                      </span>
                    )}
                  </div>
                  {analysis.hindiMeaning && (
                    <div className="text-sm font-semibold text-amber-400 mt-1 flex items-center gap-1.5">
                      <Languages className="w-4 h-4" />
                      <span>{analysis.hindiMeaning}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveActiveWordToVault}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save to Vault</span>
                  </button>
                </div>
              </div>

              {/* Meaning & Definition */}
              {analysis.meaning && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    English Definition
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    {analysis.meaning}
                  </p>
                </div>
              )}

              {/* Desi Mnemonic Hook */}
              {analysis.mnemonicHook && (
                <div className="bg-amber-950/20 border border-amber-700/40 p-3.5 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Memory Trick / Mnemonic Hook (देसी याद रखने का तरीका)
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {analysis.mnemonicHook}
                  </p>
                </div>
              )}

              {/* 2-Column Root & Exam Trap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Root Etymology */}
                {analysis.rootEtymology && (
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                      Root Word & Etymology
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {analysis.rootEtymology}
                    </p>
                  </div>
                )}

                {/* Examiner Exam Trap */}
                {analysis.examTrapTip && (
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Examiner Trap & Confusion Alert
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {analysis.examTrapTip}
                    </p>
                  </div>
                )}
              </div>

              {/* Authentic Exam Sample Sentence */}
              {analysis.sampleUsage && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Exam Sentence Usage
                  </div>
                  <p className="text-xs text-slate-300 italic border-l-2 border-purple-500 pl-2.5 py-0.5">
                    "{analysis.sampleUsage}"
                  </p>
                </div>
              )}

              {/* Related Words */}
              {analysis.relatedWords && analysis.relatedWords.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Related High-Frequency PYQ Cognates
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.relatedWords.map((rw, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectWordChip(rw.replace(/[^a-zA-Z\s]/g, ''))}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {rw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
