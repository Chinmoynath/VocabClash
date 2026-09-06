import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QuestionCategory, ExamType, Question } from '../types';
import { getNextDrillQuestion } from '../services/matchmakingService';
import { questionReviewScheduler, ReviewState } from '../services/questionReviewScheduler';
import { getPersistentSeenWords } from '../utils/questionHistoryManager';
import { getOptionBreakdown, OptionDetail } from '../utils/optionExplanations';
import { soundManager } from '../utils/audio';
import { recordQuestionAttempt } from '../utils/userStatsManager';
import { AttemptSource } from '../services/attemptTrackingService';
import { 
  Target, 
  Check, 
  X, 
  ChevronRight, 
  Sparkles, 
  Bookmark, 
  BookmarkCheck,
  Flame,
  Award,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Lightbulb,
  Flag,
  LifeBuoy,
  RotateCcw,
  CheckCircle,
  Info,
  Timer,
  Pause,
  Play,
  BarChart3
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';
import { ReportQuestionModal } from './ReportQuestionModal';
import { SupportModal } from './SupportModal';
import { formatExamTag } from '../services/jsonPyqParser';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';

interface PracticeModeProps {
  pyqScore: number;
  onUpdatePyqScore: (delta: number) => void;
  onBookmarkQuestion: (question: Question) => void;
  onOpenAiTutor: (question: Question) => void;
  onOpenStats?: () => void;
  onBatchComplete?: () => void;
  onSolveQuestion?: () => void;
  onRecordMistake?: (question: Question) => void;
  bookmarkedIds: string[];
  isPremium?: boolean;
  // Targeted coaching drill session support & SSC Top 100
  customTargetQueue?: Question[] | null;
  customSessionTitle?: string | null;
  customInitialIndex?: number;
  customBadge?: string | null;
  attemptSource?: AttemptSource;
  onCustomQueueQuestionAnswered?: (q: Question, isCorrect: boolean, indexInQueue: number) => void;
  onCustomDrillCompleted?: (results: { isCorrect: boolean }[]) => void;
  onExitCustomQueue?: () => void;
}

const getTodayStrKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const STORAGE_KEY_DAILY_DRILL = 'vocabclash_pyq_daily_progress_v2';

interface DailyDrillProgress {
  date: string;
  questionNumber: number;
  sessionSolvedCount: number;
  streak: number;
}

const getStoredDailyProgress = (): DailyDrillProgress => {
  const today = getTodayStrKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_DRILL);
    if (raw) {
      const parsed: DailyDrillProgress = JSON.parse(raw);
      if (parsed && parsed.date === today && typeof parsed.questionNumber === 'number') {
        return parsed;
      }
    }
  } catch {}
  return {
    date: today,
    questionNumber: 1,
    sessionSolvedCount: 0,
    streak: 0,
  };
};

const saveDailyProgress = (progress: DailyDrillProgress) => {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_DRILL, JSON.stringify(progress));
  } catch {}
};

export const PracticeMode: React.FC<PracticeModeProps> = ({
  pyqScore,
  onUpdatePyqScore,
  onBookmarkQuestion,
  onOpenAiTutor,
  onOpenStats,
  onBatchComplete,
  onSolveQuestion,
  onRecordMistake,
  bookmarkedIds,
  isPremium = false,
  customTargetQueue = null,
  customSessionTitle = null,
  customInitialIndex = 0,
  customBadge = null,
  attemptSource = 'practice',
  onCustomQueueQuestionAnswered,
  onCustomDrillCompleted,
  onExitCustomQueue,
}) => {
  const [category, setCategory] = useState<QuestionCategory | 'mixed'>('mixed');
  const [exam, setExam] = useState<ExamType>('ALL');

  // Custom targeted coaching drill state
  const validInitialIndex = useMemo(() => {
    if (customTargetQueue && customTargetQueue.length > 0 && typeof customInitialIndex === 'number') {
      return Math.min(Math.max(0, customInitialIndex), customTargetQueue.length - 1);
    }
    return 0;
  }, [customTargetQueue, customInitialIndex]);

  const [customQueueIndex, setCustomQueueIndex] = useState<number>(validInitialIndex);
  const [customQueueResults, setCustomQueueResults] = useState<{ isCorrect: boolean }[]>([]);
  const [customDrillCompleted, setCustomDrillCompleted] = useState<boolean>(false);
  
  // Continuous drill session state - persists across tab switches for today and resets on a new day
  const [questionNumber, setQuestionNumber] = useState<number>(() => getStoredDailyProgress().questionNumber);
  const [sessionSolvedCount, setSessionSolvedCount] = useState<number>(() => getStoredDailyProgress().sessionSolvedCount);
  const [streak, setStreak] = useState<number>(() => getStoredDailyProgress().streak);

  const [recentWordsHistory, setRecentWordsHistory] = useState<string[]>(() => getPersistentSeenWords().slice(-100));
  const [currentQ, setCurrentQ] = useState<Question>(() => {
    if (customTargetQueue && customTargetQueue.length > 0) {
      const idx = Math.min(Math.max(0, customInitialIndex || 0), customTargetQueue.length - 1);
      return customTargetQueue[idx];
    }
    const initHistory = getPersistentSeenWords().slice(-100);
    return getNextDrillQuestion('mixed', 'ALL', initHistory);
  });

  useEffect(() => {
    if (customTargetQueue && customTargetQueue.length > 0) {
      const startIdx = Math.min(Math.max(0, customInitialIndex || 0), customTargetQueue.length - 1);
      setCustomQueueIndex(startIdx);
      setCustomQueueResults([]);
      setCustomDrillCompleted(false);
      setCurrentQ(customTargetQueue[startIdx]);
      setSelectedOption(null);
      setIsAnswered(false);
    }
  }, [customTargetQueue, customInitialIndex]);

  const questionStartTimeRef = useRef<number>(Date.now());
  const isAdvancingRef = useRef<boolean>(false);
  const [currentReviewState, setCurrentReviewState] = useState<ReviewState | null>(() => 
    currentQ ? questionReviewScheduler.getReviewState(currentQ.memoryKey || currentQ.wordOrPhrase) || null : null
  );

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showAllOptionBreakdown, setShowAllOptionBreakdown] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance countdown timer settings (0 = off, 3, 5, 8 seconds)
  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number>(() => {
    const saved = localStorage.getItem('vocabclash_pyq_autonext');
    return saved !== null ? Number(saved) : 0;
  });
  const [countdown, setCountdown] = useState<number>(0);
  const [isCountdownPaused, setIsCountdownPaused] = useState<boolean>(false);

  const handleSetAutoAdvance = (sec: number) => {
    setAutoAdvanceSec(sec);
    localStorage.setItem('vocabclash_pyq_autonext', String(sec));
    if (sec === 0) {
      setCountdown(0);
    } else if (isAnswered) {
      setCountdown(sec);
    }
  };

  // Overall scheduler summary for top stats
  const [schedulerStats, setSchedulerStats] = useState(() => questionReviewScheduler.getStats());

  // Keep review state updated for the current question
  useEffect(() => {
    if (currentQ) {
      questionStartTimeRef.current = Date.now();
      setCurrentReviewState(questionReviewScheduler.getReviewState(currentQ.memoryKey || currentQ.wordOrPhrase) || null);
      setIsCountdownPaused(false);
      isAdvancingRef.current = false;
    }
  }, [currentQ]);

  // Auto-advance countdown timer when question is answered (clean interval + single-trigger timeout)
  useEffect(() => {
    if (!isAnswered || autoAdvanceSec <= 0 || isCountdownPaused) {
      setCountdown(0);
      return;
    }

    setCountdown(autoAdvanceSec);

    // Visual countdown ticker (strictly UI-only, no side effects in state updater)
    const intervalId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Dedicated single-shot advance timer
    const timeoutId = setTimeout(() => {
      handleNextQuestion();
    }, autoAdvanceSec * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [isAnswered, autoAdvanceSec, isCountdownPaused, currentQ?.id]);

  // Desktop keyboard controls (1-4 for options, S/B for bookmark, Space/Enter/N for Next question)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showReportModal || showSupportModal) return;

      // Bookmark shortcut
      if (e.key === 's' || e.key === 'S' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleToggleBookmark();
        return;
      }

      if (!isAnswered && currentQ) {
        if (e.key === '1' || e.key === 'a' || e.key === 'A') {
          handleSelectOption(0);
        } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
          handleSelectOption(1);
        } else if (e.key === '3' || e.key === 'c' || e.key === 'C') {
          handleSelectOption(2);
        } else if (e.key === '4' || e.key === 'd' || e.key === 'D') {
          handleSelectOption(3);
        }
      } else if (isAnswered) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, currentQ, showReportModal, showSupportModal, bookmarkedIds]);

  const showSaveConfirmation = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSaveToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setSaveToast(null);
    }, 2200);
  };

  const handleApplyFilter = (newCat: QuestionCategory | 'mixed', newExam: ExamType) => {
    soundManager.playTap();
    setCategory(newCat);
    setExam(newExam);
    const nextQ = getNextDrillQuestion(newCat, newExam, recentWordsHistory);
    setCurrentQ(nextQ);
    setSelectedOption(null);
    setIsAnswered(false);
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    if (onSolveQuestion) {
      onSolveQuestion();
    }

    const elapsedMs = Date.now() - questionStartTimeRef.current;
    const isCorrect = idx === currentQ.correctIndex;

    // Track results for custom coaching session
    if (customTargetQueue && customTargetQueue.length > 0) {
      setCustomQueueResults(prev => [...prev, { isCorrect }]);
      if (onCustomQueueQuestionAnswered) {
        onCustomQueueQuestionAnswered(currentQ, isCorrect, customQueueIndex);
      }
    }

    // Record spaced repetition attempt in adaptive scheduler
    const updatedRecord = questionReviewScheduler.recordAttempt(currentQ, isCorrect, elapsedMs);
    setCurrentReviewState(updatedRecord);
    setSchedulerStats(questionReviewScheduler.getStats());

    // Add to session word history
    setRecentWordsHistory(prev => [...prev.slice(-50), currentQ.wordOrPhrase]);
    const nextSolvedCount = sessionSolvedCount + 1;
    setSessionSolvedCount(nextSolvedCount);

    // Record in global daily stats & accuracy manager
    recordQuestionAttempt({
      isCorrect,
      responseTimeMs: elapsedMs,
      category: currentQ.category,
      pyqPoints: isCorrect ? 10 : -2,
      questionId: currentQ.id,
      conceptKey: currentQ.wordOrPhrase || currentQ.memoryKey,
      source: (attemptSource || 'practice') as AttemptSource,
    });

    const nextStreak = isCorrect ? streak + 1 : 0;
    if (isCorrect) {
      soundManager.playCorrect();
      setStreak(nextStreak);
      onUpdatePyqScore(10);
    } else {
      soundManager.playWrong();
      setStreak(0);
      onUpdatePyqScore(-2);
      if (onRecordMistake) {
        onRecordMistake(currentQ);
      }
    }

    saveDailyProgress({
      date: getTodayStrKey(),
      questionNumber: questionNumber,
      sessionSolvedCount: nextSolvedCount,
      streak: nextStreak,
    });
  };

  const handleNextQuestion = () => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    soundManager.playTap();
    
    // Batch interval ad trigger (every 15 questions solved)
    if ((sessionSolvedCount + 1) % 15 === 0 && onBatchComplete) {
      onBatchComplete();
    }

    // Handle Custom Targeted Coaching Queue if active
    if (customTargetQueue && customTargetQueue.length > 0) {
      const nextIdx = customQueueIndex + 1;
      if (nextIdx >= customTargetQueue.length) {
        setCustomDrillCompleted(true);
        if (onCustomDrillCompleted) {
          onCustomDrillCompleted(customQueueResults);
        }
        setTimeout(() => {
          isAdvancingRef.current = false;
        }, 300);
        return;
      }
      setCustomQueueIndex(nextIdx);
      const nextQ = customTargetQueue[nextIdx];
      setCurrentQ(nextQ);
      setSelectedOption(null);
      setIsAnswered(false);
      setCountdown(0);
      setIsCountdownPaused(false);
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 400);
      return;
    }

    // Pull next adaptive repetition question
    const nextQ = getNextDrillQuestion(category, exam, [...recentWordsHistory, currentQ.wordOrPhrase]);
    setCurrentQ(nextQ);
    
    setQuestionNumber(prev => {
      const nextNum = prev + 1;
      saveDailyProgress({
        date: getTodayStrKey(),
        questionNumber: nextNum,
        sessionSolvedCount: sessionSolvedCount,
        streak: streak,
      });
      return nextNum;
    });

    setSelectedOption(null);
    setIsAnswered(false);
    setCountdown(0);
    setIsCountdownPaused(false);

    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 400);
  };

  const handleToggleBookmark = () => {
    if (!currentQ) return;
    soundManager.playTap();
    onBookmarkQuestion(currentQ);
    const alreadyBookmarked = bookmarkedIds.includes(currentQ.id);
    const nextSaved = !alreadyBookmarked;
    questionReviewScheduler.setSavedStatus(currentQ.memoryKey || currentQ.wordOrPhrase, nextSaved);

    showSaveConfirmation(
      alreadyBookmarked ? 'Removed from Saved' : '⭐ Question Saved to Revision Vault'
    );
  };

  const isBookmarked = currentQ ? bookmarkedIds.includes(currentQ.id) : false;

  // Compute detailed breakdowns for all 4 options (prioritizing question.optionDetails)
  const optionDetails: OptionDetail[] = useMemo(() => {
    if (!currentQ) return [];
    if (Array.isArray(currentQ.optionDetails) && currentQ.optionDetails.length === 4) {
      return currentQ.optionDetails.map((od, idx) => ({
        option: od.option || currentQ.options[idx] || `Option ${String.fromCharCode(65 + idx)}`,
        englishMeaning: od.englishMeaning || 'Option explanation',
        hindiMeaning: od.hindiMeaning || '',
        isCorrect: idx === currentQ.correctIndex,
        mnemonicHook: od.mnemonicHook,
      }));
    }
    return getOptionBreakdown(
      currentQ.options,
      currentQ.correctIndex,
      currentQ.category,
      currentQ.wordOrPhrase,
      currentQ.meaning,
      currentQ.hindiMeaning
    );
  }, [currentQ]);

  // Guaranteed educational fields resolution so that every question has complete enrichment
  const eduDetails = useMemo(() => {
    if (!currentQ) return null;
    const targetWord = (currentQ.wordOrPhrase || '').trim();
    const correctOpt = currentQ.options[currentQ.correctIndex] || 'Option';
    const lower = targetWord.toLowerCase();

    let root = currentQ.rootWordInfo?.trim() || '';
    if (!root) {
      if (lower.startsWith('pan')) {
        root = 'Greek pan- ("all, whole") -> formal speech of praise delivered in a public gathering.';
      } else if (lower.startsWith('castig') || lower.startsWith('chast')) {
        root = 'Latin castigare (castus "pure" + agere "to drive") -> to discipline or severely criticize.';
      } else if (lower.startsWith('fastid')) {
        root = 'Latin fastidium ("loathing, distaste") -> difficult to please; excessively particular.';
      } else if (lower.startsWith('bene') || lower.startsWith('bon')) {
        root = 'Latin bene ("well, good") -> expressing kindness or favorable disposition.';
      } else if (lower.startsWith('mal')) {
        root = 'Latin malus ("bad, ill") -> denoting harmful, defective, or hostile state.';
      } else if (lower.startsWith('equ')) {
        root = 'Latin aequus ("even, equal") -> denoting calmness, balance, or fair proportion.';
      } else if (lower.startsWith('tacit')) {
        root = 'Latin tacere ("to be silent") -> expressing quietness or habitual lack of speech.';
      } else if (lower.startsWith('loqu') || lower.startsWith('locu')) {
        root = 'Latin loqui ("to speak") -> tending to speak fluently or at great length.';
      } else {
        root = `Root and morphological structure of "${targetWord}" tested frequently in competitive examinations.`;
      }
    }

    let meaning = currentQ.meaning?.trim() || '';
    let hindiMeaning = currentQ.hindiMeaning?.trim() || '';

    if (!meaning) {
      if (currentQ.category === 'synonyms') {
        meaning = `Shows characteristics or qualities closely corresponding to "${correctOpt}".`;
        hindiMeaning = `"${targetWord}" का यथार्थ शब्दार्थ एवं भावार्थ`;
      } else if (currentQ.category === 'antonyms') {
        meaning = `Denotes a state or quality in direct contrast to "${correctOpt}".`;
        hindiMeaning = `"${targetWord}" का सटीक विलोमार्थी भाव`;
      } else if (currentQ.category === 'ows') {
        meaning = `One who or that which corresponds to: "${targetWord}".`;
        hindiMeaning = `"${correctOpt}" का एक शब्द में सटीक अर्थ`;
      } else {
        meaning = `Figurative meaning: Denotes "${correctOpt}".`;
        hindiMeaning = `मुहावरे "${targetWord}" का लाक्षणिक अर्थ`;
      }
    }

    const mnemonic = currentQ.mnemonic?.trim() || `Memory Hook: Connect "${targetWord}" with "${correctOpt}" for rapid recall during revision.`;
    const example = currentQ.exampleSentence?.trim() || `The examination sentence tested the precise contextual nuance of "${targetWord}".`;

    return {
      meaning,
      hindiMeaning,
      rootWordInfo: root,
      mnemonic,
      exampleSentence: example,
    };
  }, [currentQ]);

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 pb-8 max-w-4xl mx-auto w-full">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-amber-300 animate-bounce">
          <BookmarkCheck className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Custom Targeted Coaching / SSC Top 100 Drill Banner */}
      {customTargetQueue && customTargetQueue.length > 0 && !customDrillCompleted && (
        <div className={`p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-lg ${
          customBadge?.includes('SSC') || customBadge?.includes('Top 100')
            ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-orange-950/80 border border-amber-500/40 shadow-amber-950/30'
            : 'bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 shadow-purple-950/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              customBadge?.includes('SSC') || customBadge?.includes('Top 100')
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            }`}>
              {customBadge?.includes('SSC') || customBadge?.includes('Top 100') ? (
                <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                  customBadge?.includes('SSC') || customBadge?.includes('Top 100')
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}>
                  {customBadge || 'AI Vocab Mentor Drill'}
                </span>
                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
                  Question {customQueueIndex + 1} of {customTargetQueue.length}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
                {customSessionTitle || 'Targeted Weak Areas Training'}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold sm:hidden ${
              customBadge?.includes('SSC') || customBadge?.includes('Top 100') ? 'text-amber-300' : 'text-purple-300'
            }`}>
              {customQueueIndex + 1}/{customTargetQueue.length}
            </span>
            {onExitCustomQueue && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  onExitCustomQueue();
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                Exit Drill
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom Coaching Drill Completion Summary */}
      {customDrillCompleted ? (
        <div className="bg-slate-900/90 border border-purple-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-100">
              Targeted Coaching Drill Complete!
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              You've successfully drilled through your priority weak areas and mistake vault words. Your spaced repetition states have been refreshed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-2xl font-black text-emerald-400">
                {customQueueResults.filter(r => r.isCorrect).length} / {customTargetQueue?.length || 10}
              </div>
              <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Correct Answers</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-2xl font-black text-purple-400">
                {customTargetQueue?.length
                  ? Math.round((customQueueResults.filter(r => r.isCorrect).length / customTargetQueue.length) * 100)
                  : 0}
                %
              </div>
              <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Accuracy</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            {onExitCustomQueue && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  onExitCustomQueue();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
              >
                Return to Vocab Mentor
              </button>
            )}
            <button
              onClick={() => {
                soundManager.playTap();
                setCustomDrillCompleted(false);
                if (onExitCustomQueue) onExitCustomQueue();
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
            >
              Continue PYQ Endless Drill
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-1.5">
            <Target className="w-5 h-5 text-sky-400" />
            PYQ Endless Drill
          </h2>
          <p className="text-xs text-slate-400">
            24,000+ Govt Exam PYQ Pool with Adaptive Spaced Repetition & Option Analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          {streak > 1 && (
            <div className="flex items-center gap-1 bg-orange-950/80 border border-orange-700/60 text-orange-400 px-2 py-0.5 rounded-full text-xs font-bold">
              <Flame className="w-3 h-3 fill-orange-400" />
              <span>{streak}x</span>
            </div>
          )}
          {/* PYQ Score & Stats Symbol */}
          <button
            onClick={() => {
              if (onOpenStats) {
                soundManager.playTap();
                onOpenStats();
              }
            }}
            id="practice-stats-button"
            className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 border border-amber-500/35 hover:border-amber-400 px-2.5 py-1 rounded-xl shadow-sm transition-all group active:scale-95 cursor-pointer"
            title="View Solved Questions, Right/Wrong Counts & Daily Accuracy Graph"
            aria-label="View Performance Statistics"
          >
            <div className="w-4 h-4 rounded bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-3 h-3" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden xs:inline">PYQ</span>
              <span className="text-xs font-mono font-black text-amber-400">
                {pyqScore} pts
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Mastery & Session Bar */}
      <div className="bg-slate-850 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-bold flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Question #{questionNumber}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 text-[11px]">
            Session: <b className="text-slate-200">{sessionSolvedCount} solved</b>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Due:</span>
            <span className="font-bold text-sky-400">{schedulerStats.dueCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Mastered:</span>
            <span className="font-bold text-amber-400">{schedulerStats.masteredCount}</span>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { id: 'mixed', label: 'All Mixed (24k+)' },
          { id: 'antonyms', label: 'Antonyms (6k+)' },
          { id: 'synonyms', label: 'Synonyms (6k+)' },
          { id: 'ows', label: 'One Word (6k+)' },
          { id: 'idioms', label: 'Idioms (6k+)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleApplyFilter(tab.id as QuestionCategory | 'mixed', exam)}
            className={`px-3 py-1.5 rounded-xl border font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1 ${
              category === tab.id
                ? 'bg-sky-600 border-sky-400 text-white shadow-md'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Question Card */}
      {currentQ && (
        <div className="space-y-3 pt-1">
          {/* Top Info & Actions Header (Clean 1-line layout) */}
          <div className="flex items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0">
                🔥 Repeated {currentQ.repeatCount}x
              </span>

              {/* Spaced Review Reason Pill (Subtle & clean) */}
              {currentQ.reviewReason === 'due_review' && (
                <span className="bg-sky-950 text-sky-300 border border-sky-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <RotateCcw className="w-2.5 h-2.5" />
                  Due Review
                </span>
              )}
              {currentQ.reviewReason === 'mistake_review' && (
                <span className="bg-rose-950 text-rose-300 border border-rose-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <RotateCcw className="w-2.5 h-2.5" />
                  Mistake Review
                </span>
              )}
              {currentQ.reviewReason === 'saved_review' && (
                <span className="bg-amber-950 text-amber-300 border border-amber-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <Bookmark className="w-2.5 h-2.5" />
                  Saved Review
                </span>
              )}

              {/* 5-State Concept Memory Level */}
              {currentReviewState?.level === 'mastered' ? (
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Mastered
                </span>
              ) : currentReviewState?.level === 'strong' ? (
                <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0">
                  Strong ({currentReviewState.consecutiveCorrect}✓)
                </span>
              ) : currentReviewState?.level === 'familiar' ? (
                <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0">
                  Familiar ({currentReviewState.correctCount}✓)
                </span>
              ) : currentReviewState?.level === 'learning' ? (
                <span className="bg-blue-950/80 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0">
                  Learning
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-medium text-[10px] shrink-0">
                  Fresh Concept
                </span>
              )}
            </div>

            {/* Right side: Transparent Red Flag Icon + Save Symbol Only + Next Question Symbol */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Transparent Red Flag Report Button */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowReportModal(true);
                }}
                className="p-2 rounded-xl text-rose-500/80 hover:text-rose-400 hover:bg-rose-950/40 active:scale-90 transition-all border border-transparent hover:border-rose-900/40"
                title="Report issue in this question (support@vocabclash.in)"
                aria-label="Report Question"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              {/* Save / Bookmark Button - Symbol ONLY */}
              <button
                onClick={handleToggleBookmark}
                id="pyq-save-button"
                className={`p-2 rounded-xl border transition-all active:scale-90 flex items-center justify-center ${
                  isBookmarked
                    ? 'bg-amber-950/90 border-amber-500 text-amber-400 shadow-sm ring-1 ring-amber-500/40'
                    : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title={isBookmarked ? "Saved in Revision Vault (Click to remove, or press S/B)" : "Save Question to Revision Vault (Press S/B)"}
                aria-label={isBookmarked ? "Saved Question" : "Save Question"}
              >
                <Bookmark className={`w-3.5 h-3.5 transition-transform ${isBookmarked ? 'fill-amber-400 text-amber-400 scale-105' : 'text-slate-400'}`} />
              </button>

              {/* Next Question Symbol & Quick Action in Sky-Blue Theme */}
              <button
                onClick={handleNextQuestion}
                id="pyq-top-next-button"
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-sky-500/60 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white active:scale-90 transition-all shadow-sm flex items-center gap-1 group font-bold text-xs"
                title="Next Question / Skip (Press Space / Enter / N)"
                aria-label="Next Question"
              >
                <span className="text-[11px] font-bold hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 shadow-lg text-center space-y-1 relative">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {currentQ.instruction || 'Select the correct option:'}
            </div>
            <h3 className="text-xl font-black text-amber-400 break-words">
              "{currentQ.wordOrPhrase}"
            </h3>
            <div className="pt-1 flex items-center justify-center">
              <ExamAppearancesBadge
                appearances={currentQ.appearances}
                exam={currentQ.exam}
                year={currentQ.year}
                tier={currentQ.tier}
                examHistory={currentQ.examHistory}
                repeatCount={currentQ.repeatCount}
                showRepeatCount={true}
                size="xs"
              />
            </div>
          </div>

          {/* 4 Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;

              let style = 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 active:scale-[0.99] cursor-pointer';
              if (isAnswered) {
                if (isCorrect) {
                  style = 'bg-emerald-950 border-emerald-500 text-emerald-100 font-bold';
                } else if (isSelected) {
                  style = 'bg-rose-950 border-rose-500 text-rose-100 font-bold';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between text-xs sm:text-sm font-semibold transition-all shadow-sm ${style}`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="break-words leading-snug flex-1 text-slate-100">{option}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="hidden md:inline-flex text-[10px] font-mono text-slate-500 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                      {idx + 1}
                    </span>
                    {isAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                    {isAnswered && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {!isAnswered && (
            <div className="text-center py-1.5 text-[11px] text-slate-400/80 font-medium">
              💡 Select an option (or press <span className="text-sky-300 font-mono font-bold">1, 2, 3, 4</span> on keyboard) to check answer & reveal breakdown
            </div>
          )}

          {/* Post-Answer Detailed Explanation Box with 4 Options Breakdown */}
          {isAnswered && (
            <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-3.5 space-y-3 animate-fadeIn shadow-md">
              {/* Header Action Bar & Dedicated Word Meaning */}
              {currentQ.category !== 'idioms' && currentQ.category !== 'ows' ? (
                /* Dedicated Word Meaning for Synonyms, Antonyms & Vocab */
                <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        Word Meaning (शब्दार्थ):
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleBookmark}
                        className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 font-bold ${
                          isBookmarked
                            ? 'bg-amber-950 border-amber-600 text-amber-400'
                            : 'bg-slate-800 border-slate-750 text-slate-300'
                        }`}
                      >
                        <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-amber-400' : ''}`} />
                        <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onOpenAiTutor(currentQ);
                        }}
                        className="px-2 py-1 rounded-lg bg-purple-950/90 border border-purple-800 text-purple-300 text-[11px] flex items-center gap-1 font-bold hover:bg-purple-900"
                      >
                        <Sparkles className="w-3 h-3" />
                        AI Deep Dive
                      </button>
                    </div>
                  </div>

                  {eduDetails && (
                    <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      {eduDetails.meaning && (
                        <div className="text-xs text-slate-100 font-medium">
                          <span className="font-bold text-sky-400">English: </span>
                          <span>{eduDetails.meaning}</span>
                        </div>
                      )}
                      {eduDetails.hindiMeaning && (
                        <div className="text-xs text-amber-300/90 font-medium">
                          <span className="font-bold text-amber-400">हिन्दी अर्थ: </span>
                          <span>{eduDetails.hindiMeaning}</span>
                        </div>
                      )}
                      {eduDetails.rootWordInfo && (
                        <div className="text-[11px] text-teal-300/90 pt-0.5 border-t border-slate-800/60">
                          <span className="font-bold text-teal-400">Performance Diagnostic: </span>
                          <span>{eduDetails.rootWordInfo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Clean Action Bar for Idioms & One-Word Substitutions */
                <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {currentQ.category === 'idioms' ? '📖 Idiom & Phrase Insight' : '💡 One Word Substitution Insight'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleBookmark}
                        className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 font-bold ${
                          isBookmarked
                            ? 'bg-amber-950 border-amber-600 text-amber-400'
                            : 'bg-slate-800 border-slate-750 text-slate-300'
                        }`}
                      >
                        <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-amber-400' : ''}`} />
                        <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onOpenAiTutor(currentQ);
                        }}
                        className="px-2 py-1 rounded-lg bg-purple-950/90 border border-purple-800 text-purple-300 text-[11px] flex items-center gap-1 font-bold hover:bg-purple-900"
                      >
                        <Sparkles className="w-3 h-3" />
                        AI Deep Dive
                      </button>
                    </div>
                  </div>

                  {eduDetails && (
                    <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      {eduDetails.meaning && (
                        <div className="text-xs text-slate-100 font-medium">
                          <span className="font-bold text-sky-400">Meaning: </span>
                          <span>{eduDetails.meaning}</span>
                        </div>
                      )}
                      {eduDetails.hindiMeaning && (
                        <div className="text-xs text-amber-300/90 font-medium">
                          <span className="font-bold text-amber-400">हिन्दी भावार्थ: </span>
                          <span>{eduDetails.hindiMeaning}</span>
                        </div>
                      )}
                      {eduDetails.rootWordInfo && (
                        <div className="text-[11px] text-teal-300/90 pt-0.5 border-t border-slate-800/60">
                          <span className="font-bold text-teal-400">Performance Diagnostic: </span>
                          <span>{eduDetails.rootWordInfo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question Explanation / Rationale */}
              {currentQ.explanation && (
                <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-2.5 text-xs space-y-1 text-slate-200">
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Why this answer (Exam Rationale):</span>
                  </div>
                  <div className="leading-relaxed pl-4 text-[12px] text-sky-100">
                    {currentQ.explanation}
                  </div>
                </div>
              )}

              {/* Mnemonic Hook and Example */}
              {eduDetails && (eduDetails.mnemonic || eduDetails.exampleSentence) && (
                <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                  {eduDetails.mnemonic && (
                    <div>
                      <span className="font-bold text-sky-400">💡 Mnemonic Hook: </span>
                      <span>{eduDetails.mnemonic}</span>
                    </div>
                  )}
                  {eduDetails.exampleSentence && (
                    <div className={`text-[11px] text-slate-400 italic ${eduDetails.mnemonic ? 'pt-0.5 border-t border-slate-800/50' : ''}`}>
                      <span className="font-semibold text-slate-500 not-italic">Example: </span>"{eduDetails.exampleSentence}"
                    </div>
                  )}
                </div>
              )}

              {/* 4 Options Comprehensive Breakdown Section */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                      All 4 Options Meaning & Explanation:
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAllOptionBreakdown(!showAllOptionBreakdown)}
                    className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-0.5 font-medium"
                  >
                    <span>{showAllOptionBreakdown ? 'Hide' : 'Show All'}</span>
                    {showAllOptionBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showAllOptionBreakdown && (
                  <div className="space-y-2 pt-0.5">
                    {optionDetails.map((detail, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isCorrect = detail.isCorrect;
                      const isUserChoice = selectedOption === idx;

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                            isCorrect
                              ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-100 shadow-sm ring-1 ring-emerald-500/30'
                              : isUserChoice
                              ? 'bg-rose-950/60 border-rose-600/70 text-slate-200'
                              : 'bg-slate-850/80 border-slate-750 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-md font-mono text-[10px] font-black flex items-center justify-center border ${
                                isCorrect
                                  ? 'bg-emerald-800 border-emerald-400 text-emerald-100'
                                  : isUserChoice
                                  ? 'bg-rose-800 border-rose-400 text-rose-100'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}>
                                {letter}
                              </span>
                              <span className="font-extrabold text-slate-100 text-[13px]">
                                {detail.option}
                              </span>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isCorrect
                                ? 'bg-emerald-900/90 text-emerald-300 border-emerald-600'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {isCorrect ? '✓ Correct Option' : 'Option Meaning'}
                            </span>
                          </div>

                          <div className="pl-7 space-y-0.5">
                            {detail.hindiMeaning && (
                              <div className="text-amber-300 font-semibold text-[11px]">
                                {detail.hindiMeaning}
                              </div>
                            )}
                            {detail.englishMeaning && (
                              <div className="text-slate-300 text-[11px] leading-relaxed">
                                {detail.englishMeaning}
                              </div>
                            )}
                            {detail.mnemonicHook && (
                              <div className="text-[10px] text-sky-400 flex items-center gap-1 pt-0.5">
                                <Lightbulb className="w-3 h-3 text-sky-400 shrink-0" />
                                <span><b>Hook:</b> {detail.mnemonicHook}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Next Question CTA & Auto-Advance Control in Sky-Blue Theme */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleNextQuestion}
                  id="pyq-bottom-next-button"
                  className="w-full bg-[#00a6f4] hover:bg-[#0096dc] active:bg-[#0086c7] text-white font-black py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.99] transition-all relative overflow-hidden group"
                >
                  {/* Subtle timer progress bar when auto-advance active */}
                  {autoAdvanceSec > 0 && countdown > 0 && !isCountdownPaused && (
                    <div 
                      className="absolute bottom-0 left-0 top-0 bg-white/20 transition-all duration-1000 ease-linear pointer-events-none"
                      style={{ width: `${(countdown / autoAdvanceSec) * 100}%` }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <span>NEXT QUESTION</span>
                    {autoAdvanceSec > 0 && countdown > 0 && (
                      <span className="bg-sky-950/40 border border-white/20 text-sky-100 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-mono font-bold">
                        {isCountdownPaused ? 'Paused' : `${countdown}s`}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>

                {/* Auto-Next Time Option Pill Selector */}
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
                    <Timer className="w-3.5 h-3.5 text-sky-400" />
                    <span>Auto-Next Timer:</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[
                      { sec: 0, label: 'Off' },
                      { sec: 3, label: '3s' },
                      { sec: 5, label: '5s' },
                      { sec: 8, label: '8s' },
                    ].map(opt => (
                      <button
                        key={opt.sec}
                        onClick={() => {
                          soundManager.playTap();
                          handleSetAutoAdvance(opt.sec);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          autoAdvanceSec === opt.sec
                            ? 'bg-[#00a6f4] text-white shadow-sm font-black'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                        }`}
                        title={opt.sec === 0 ? 'Manual Next button click' : `Automatically advance to next question in ${opt.sec}s`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {autoAdvanceSec > 0 && isAnswered && (
                      <button
                        onClick={() => setIsCountdownPaused(!isCountdownPaused)}
                        className="ml-1 p-1 sm:px-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 hover:text-sky-300 text-[10px] flex items-center gap-0.5 font-bold"
                        title={isCountdownPaused ? 'Resume auto timer' : 'Pause auto timer'}
                      >
                        {isCountdownPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        <span className="hidden sm:inline text-[9px]">{isCountdownPaused ? 'Resume' : 'Pause'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* AdSense / AdMob Banner Slot (Free users only) */}
      {!isPremium && (
        <div className="pt-2">
          <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" isPremium={isPremium} />
        </div>
      )}

      {/* Question Discrepancy / Report Modal */}
      {showReportModal && currentQ && (
        <ReportQuestionModal
          question={currentQ}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Support & Help Modal */}
      {showSupportModal && (
        <SupportModal
          onClose={() => setShowSupportModal(false)}
          prefilledSubject={`[PYQ Drill Support] VocabClash Question: "${currentQ?.wordOrPhrase || ''}"`}
          prefilledBody={`Hi VocabClash Support,\n\nI am practicing in PYQ Drill Mode and have a query regarding word: "${currentQ?.wordOrPhrase || ''}" (ID: ${currentQ?.id || ''}).\n\nIssue/Query details:`}
        />
      )}
    </div>
  );
};
