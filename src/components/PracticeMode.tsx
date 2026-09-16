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
  ChevronLeft,
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
  BarChart3,
  Trophy,
  XCircle,
  Filter
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT, ADS_ENABLED } from '../services/adSenseService';
import { ReportQuestionModal } from './ReportQuestionModal';
import { SupportModal } from './SupportModal';
import { formatExamTag } from '../services/jsonPyqParser';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';
import { formatRepeatCount } from '../utils/questionFingerprint';
import { resolveCardEducation } from '../utils/questionEducationResolver';
import { QuestionSolutionBreakdown } from './QuestionSolutionBreakdown';
import { VaultFlyAnimation, VaultFlyItem } from './VaultFlyAnimation';
import { EXAM_FAMILY_PILLS, EXAM_FAMILY_SUB_TAGS, normalizeFilterToFamily, matchesExamFamilyFilter } from '../utils/examFamilyUtils';
import { questionBankEngine } from '../services/questionBankEngine';
import { 
  trackPracticeStart, 
  trackQuestionAnswered, 
  trackPracticeComplete, 
  normalizeAnalyticsCategory, 
  normalizeAnalyticsExamFamily, 
  PracticeType,
  trackGuestPyq10Completed, 
  trackGuestPyqSignupPromptView, 
  trackGuestPyqSignupPromptClose, 
  trackGuestPyqSignupClick,
  trackGuestSignupComplete
} from '../services/analyticsService';
import { User as FirebaseUser } from 'firebase/auth';
import { GuestConversionModal } from './GuestConversionModal';

interface PracticeModeProps {
  pyqScore: number;
  category?: QuestionCategory | 'mixed';
  exam?: ExamType;
  onFilterChange?: (category: QuestionCategory | 'mixed', exam: ExamType) => void;
  onUpdatePyqScore: (delta: number) => void;
  onBookmarkQuestion: (question: Question) => void;
  onOpenAiTutor: (question: Question) => void;
  onOpenStats?: () => void;
  onBatchComplete?: () => void;
  onSolveQuestion?: () => void;
  onRecordMistake?: (question: Question) => void;
  bookmarkedIds: string[];
  isPremium?: boolean;
  currentUser?: FirebaseUser | null;
  onUserChange?: (user: FirebaseUser | null) => void;
  // Targeted coaching drill session support & SSC Top 100
  customTargetQueue?: Question[] | null;
  customSessionTitle?: string | null;
  customInitialIndex?: number;
  customInitialCorrectCount?: number;
  customBadge?: string | null;
  attemptSource?: AttemptSource;
  onCustomQueueQuestionAnswered?: (q: Question, isCorrect: boolean, indexInQueue: number) => void;
  onCustomDrillCompleted?: (results: { isCorrect: boolean }[]) => void;
  onRestartCustomDrill?: () => void;
  onReviewMistakes?: () => void;
  onExitCustomQueue?: () => void;
  isActive?: boolean;
  showFilterGuidance?: boolean;
  onFilterGuidanceDismissed?: () => void;
}

export const STORAGE_KEY_ACTIVE_DRILL = 'vocabclash_active_drill_question_v1';

export interface StoredActiveDrill {
  question: Question;
  selectedOption: number | null;
  isAnswered: boolean;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  customSessionTitle?: string | null;
  customQueueIndex?: number;
}

export const getStoredActiveDrill = (): StoredActiveDrill | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ACTIVE_DRILL) || localStorage.getItem(STORAGE_KEY_ACTIVE_DRILL);
    if (!raw) return null;
    const parsed: StoredActiveDrill = JSON.parse(raw);
    if (parsed && parsed.question && parsed.question.id && Array.isArray(parsed.question.options)) {
      return parsed;
    }
  } catch {}
  return null;
};

export const saveStoredActiveDrill = (state: StoredActiveDrill | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!state) {
      sessionStorage.removeItem(STORAGE_KEY_ACTIVE_DRILL);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_DRILL);
    } else {
      const serialized = JSON.stringify(state);
      sessionStorage.setItem(STORAGE_KEY_ACTIVE_DRILL, serialized);
      localStorage.setItem(STORAGE_KEY_ACTIVE_DRILL, serialized);
    }
  } catch {}
};

export const STORAGE_KEY_PYQ_FILTER = 'vocabclash_pyq_filter_preferences_v1';

export interface PyqFilterPreferences {
  category: QuestionCategory | 'mixed';
  exam: ExamType;
}

export const getStoredPyqFilterPreferences = (): PyqFilterPreferences => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PYQ_FILTER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.category || parsed.exam)) {
          return {
            category: parsed.category || 'mixed',
            exam: parsed.exam || 'ALL',
          };
        }
      }
    } catch { /* ignore */ }
  }
  return {
    category: 'mixed',
    exam: 'ALL',
  };
};

export const saveStoredPyqFilterPreferences = (prefs: PyqFilterPreferences) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PYQ_FILTER, JSON.stringify(prefs));
    } catch { /* ignore */ }
  }
};

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
  category: categoryProp,
  exam: examProp,
  onFilterChange,
  onUpdatePyqScore,
  onBookmarkQuestion,
  onOpenAiTutor,
  onOpenStats,
  onBatchComplete,
  onSolveQuestion,
  onRecordMistake,
  bookmarkedIds,
  isPremium = false,
  currentUser = null,
  onUserChange,
  customTargetQueue = null,
  customSessionTitle = null,
  customInitialIndex = 0,
  customInitialCorrectCount = 0,
  customBadge = null,
  attemptSource = 'practice',
  onCustomQueueQuestionAnswered,
  onCustomDrillCompleted,
  onRestartCustomDrill,
  onReviewMistakes,
  onExitCustomQueue,
  isActive = true,
  showFilterGuidance = false,
  onFilterGuidanceDismissed,
}) => {
  const [category, setCategory] = useState<QuestionCategory | 'mixed'>(() => {
    return categoryProp || getStoredPyqFilterPreferences().category;
  });
  const [exam, setExam] = useState<ExamType>(() => {
    return examProp || getStoredPyqFilterPreferences().exam;
  });

  // Guest-to-sign-in conversion flow for PYQ Drill
  const [showGuestPyqModal, setShowGuestPyqModal] = useState<boolean>(false);
  const [guestPyqStats, setGuestPyqStats] = useState<{
    correctCount: number;
    mistakeCount: number;
    accuracy: number;
  }>({ correctCount: 0, mistakeCount: 0, accuracy: 0 });

  const guestPyqSessionCountRef = useRef<number>(
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('vocabclash_guest_pyq_session_count') || '0', 10) || 0
      : 0
  );
  const guestPyqCorrectCountRef = useRef<number>(
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('vocabclash_guest_pyq_session_correct') || '0', 10) || 0
      : 0
  );
  const guestPyqMistakeCountRef = useRef<number>(
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('vocabclash_guest_pyq_session_mistakes') || '0', 10) || 0
      : 0
  );

  // Continuous drill session state - persists across tab switches for today and resets on a new day
  const [questionNumber, setQuestionNumber] = useState<number>(() => getStoredDailyProgress().questionNumber);
  const [sessionSolvedCount, setSessionSolvedCount] = useState<number>(() => getStoredDailyProgress().sessionSolvedCount);
  const [streak, setStreak] = useState<number>(() => getStoredDailyProgress().streak);

  const [recentWordsHistory, setRecentWordsHistory] = useState<string[]>(() => getPersistentSeenWords().slice(-100));

  // Retrieve cached active question to ensure switching tabs does not reset unanswered/active question
  const initialStoredDrill = useMemo(() => {
    return getStoredActiveDrill();
  }, []);

  const [currentQ, setCurrentQ] = useState<Question>(() => {
    if (customTargetQueue && customTargetQueue.length > 0) {
      const idx = Math.min(Math.max(0, customInitialIndex || 0), customTargetQueue.length - 1);
      if (
        initialStoredDrill &&
        initialStoredDrill.customSessionTitle === customSessionTitle &&
        typeof initialStoredDrill.customQueueIndex === 'number' &&
        initialStoredDrill.customQueueIndex >= 0 &&
        initialStoredDrill.customQueueIndex < customTargetQueue.length
      ) {
        return customTargetQueue[initialStoredDrill.customQueueIndex];
      }
      return customTargetQueue[idx];
    }

    const initialCat = categoryProp || getStoredPyqFilterPreferences().category;
    const initialEx = examProp || getStoredPyqFilterPreferences().exam;

    // Never change active question on navigation/tab-switch if it matches current filter
    if (initialStoredDrill && initialStoredDrill.question && initialStoredDrill.question.id) {
      const matchesCategory = initialCat === 'mixed' || initialStoredDrill.question.category === initialCat;
      const matchesExam = initialEx === 'ALL' || matchesExamFamilyFilter(initialStoredDrill.question, initialEx);
      if (matchesCategory && matchesExam) {
        return initialStoredDrill.question;
      }
    }

    const initHistory = getPersistentSeenWords().slice(-100);
    const newQ = getNextDrillQuestion(initialCat, initialEx, initHistory);
    saveStoredActiveDrill({
      question: newQ,
      selectedOption: null,
      isAnswered: false,
      category: initialCat,
      exam: initialEx,
    });
    return newQ;
  });

  // Keep state in sync if parent prop changes (e.g. from cloud fetch or global selector)
  useEffect(() => {
    if (categoryProp && categoryProp !== category) {
      setCategory(categoryProp);
      if (categoryProp !== 'mixed' && currentQ?.category !== categoryProp && !customTargetQueue) {
        const nextQ = getNextDrillQuestion(categoryProp, exam, recentWordsHistory);
        setCurrentQ(nextQ);
        setSelectedOption(null);
        setIsAnswered(false);
        setCountdown(0);
        setIsCountdownPaused(false);
        saveStoredActiveDrill({
          question: nextQ,
          selectedOption: null,
          isAnswered: false,
          category: categoryProp,
          exam,
        });
      }
    }
  }, [categoryProp, category, exam, currentQ, recentWordsHistory, customTargetQueue]);

  useEffect(() => {
    if (examProp && examProp !== exam) {
      setExam(examProp);
      // Immediately reset active question if it does not match the new exam filter
      if (examProp !== 'ALL' && !matchesExamFamilyFilter(currentQ, examProp)) {
        const nextQ = getNextDrillQuestion(category, examProp, recentWordsHistory);
        setCurrentQ(nextQ);
        setSelectedOption(null);
        setIsAnswered(false);
        setCountdown(0);
        setIsCountdownPaused(false);
        saveStoredActiveDrill({
          question: nextQ,
          selectedOption: null,
          isAnswered: false,
          category,
          exam: examProp,
        });
      }
    }
  }, [examProp, exam, category, recentWordsHistory, currentQ]);

  // Custom targeted coaching drill state
  const validInitialIndex = useMemo(() => {
    if (customTargetQueue && customTargetQueue.length > 0) {
      if (
        initialStoredDrill &&
        initialStoredDrill.customSessionTitle === customSessionTitle &&
        typeof initialStoredDrill.customQueueIndex === 'number' &&
        initialStoredDrill.customQueueIndex >= 0 &&
        initialStoredDrill.customQueueIndex < customTargetQueue.length
      ) {
        return initialStoredDrill.customQueueIndex;
      }
      if (typeof customInitialIndex === 'number') {
        return Math.min(Math.max(0, customInitialIndex), customTargetQueue.length - 1);
      }
    }
    return 0;
  }, [customTargetQueue, customInitialIndex, initialStoredDrill, customSessionTitle]);

  const [customQueueIndex, setCustomQueueIndex] = useState<number>(validInitialIndex);
  const [customQueueResults, setCustomQueueResults] = useState<{ isCorrect: boolean }[]>([]);
  const customResultsRef = useRef<{ isCorrect: boolean }[]>([]);
  const [customDrillCompleted, setCustomDrillCompleted] = useState<boolean>(false);

  // Derived drill metrics (strictly bounded by queue length, e.g. max 100 for SSC Top 100)
  const isSscTop100 = Boolean(
    attemptSource === 'ssc_top100' ||
    (customBadge && (customBadge.includes('SSC TOP 100') || customBadge === 'SSC TOP 100'))
  );

  const isWeakAreasDrill = Boolean(
    attemptSource === 'weak_areas' ||
    (customBadge && (customBadge.includes('WEAK AREAS') || customBadge.includes('TARGETED'))) ||
    (customSessionTitle && customSessionTitle.toLowerCase().includes('weak areas'))
  );

  const totalCustomQuestions = customTargetQueue ? customTargetQueue.length : 0;
  const currentDrillQuestionNum = customTargetQueue && customTargetQueue.length > 0
    ? Math.min(totalCustomQuestions, customQueueIndex + 1)
    : 0;
  const currentDrillSolvedCount = customTargetQueue && customTargetQueue.length > 0
    ? Math.min(totalCustomQuestions, (customInitialIndex || 0) + customQueueResults.length)
    : 0;
  const liveCorrectCount = customTargetQueue && customTargetQueue.length > 0
    ? Math.min(currentDrillSolvedCount, (customInitialCorrectCount || 0) + customQueueResults.filter(r => r.isCorrect).length)
    : 0;
  const liveMistakeCount = Math.max(0, currentDrillSolvedCount - liveCorrectCount);
  const liveRightPercent = currentDrillSolvedCount > 0
    ? Math.round((liveCorrectCount / currentDrillSolvedCount) * 100)
    : 0;
  const liveWrongPercent = currentDrillSolvedCount > 0
    ? Math.round((liveMistakeCount / currentDrillSolvedCount) * 100)
    : 0;
  const drillProgressPercent = totalCustomQuestions > 0
    ? Math.min(100, Math.round((currentDrillSolvedCount / totalCustomQuestions) * 100))
    : 0;

  // Clean, non-repetitive display badge and title for custom drills
  const displayBadge = useMemo(() => {
    if (customBadge) return customBadge;
    if (isSscTop100) return 'SSC TOP 100';
    if (isWeakAreasDrill) return 'WEAK AREAS DRILL';
    return 'TARGETED DRILL';
  }, [customBadge, isSscTop100, isWeakAreasDrill]);

  const displayTitle = useMemo(() => {
    if (!customSessionTitle) {
      if (isSscTop100) return 'SSC Top 100 Drill';
      if (isWeakAreasDrill) return 'Weak Areas Drill';
      return 'Vocab Drill';
    }
    let t = customSessionTitle;
    if (isSscTop100) {
      if (t.startsWith('SSC TOP 100 • ')) {
        t = t.replace('SSC TOP 100 • ', '').trim();
      }
      const lower = t.toLowerCase();
      if (lower.includes('synonyms')) return 'Synonyms Drill';
      if (lower.includes('antonyms')) return 'Antonyms Drill';
      if (lower.includes('one word') || lower.includes('ows')) return 'One Word Substitutions Drill';
      if (lower.includes('idioms')) return 'Idioms & Phrases Drill';
    }
    return t;
  }, [customSessionTitle, isSscTop100, isWeakAreasDrill]);

  const lastCustomQueueRef = useRef<Question[] | null>(null);
  useEffect(() => {
    if (customTargetQueue && customTargetQueue.length > 0 && lastCustomQueueRef.current !== customTargetQueue) {
      lastCustomQueueRef.current = customTargetQueue;
      const startIdx = validInitialIndex;
      setCustomQueueIndex(startIdx);
      setCustomQueueResults([]);
      customResultsRef.current = [];
      setCustomDrillCompleted(false);
      setCurrentQ(customTargetQueue[startIdx]);
      if (!initialStoredDrill || initialStoredDrill.question?.id !== customTargetQueue[startIdx].id) {
        setSelectedOption(null);
        setIsAnswered(false);
      }
    }
  }, [customTargetQueue, validInitialIndex, initialStoredDrill]);

  const questionStartTimeRef = useRef<number>(Date.now());
  const isAdvancingRef = useRef<boolean>(false);
  const [currentReviewState, setCurrentReviewState] = useState<ReviewState | null>(() => 
    currentQ ? questionReviewScheduler.getReviewState(currentQ.memoryKey || currentQ.wordOrPhrase) || null : null
  );

  const [selectedOption, setSelectedOption] = useState<number | null>(() => {
    if (initialStoredDrill && initialStoredDrill.question?.id === currentQ?.id) {
      return initialStoredDrill.selectedOption;
    }
    return null;
  });
  const [isAnswered, setIsAnswered] = useState<boolean>(() => {
    if (initialStoredDrill && initialStoredDrill.question?.id === currentQ?.id) {
      return initialStoredDrill.isAnswered;
    }
    return false;
  });
  const [flyItems, setFlyItems] = useState<VaultFlyItem[]>([]);
  const [showAllOptionBreakdown, setShowAllOptionBreakdown] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [pendingCategory, setPendingCategory] = useState<QuestionCategory | 'mixed'>(category);
  const [pendingExam, setPendingExam] = useState<ExamType>(exam);
  const [isAppliedAnimation, setIsAppliedAnimation] = useState<boolean>(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // Click outside to dismiss filter dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const hasFiredPracticeStartRef = useRef<boolean>(false);
  const batchCorrectCountRef = useRef<number>(0);

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
    if (!isActive || !isAnswered || autoAdvanceSec <= 0 || isCountdownPaused) {
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
  }, [isActive, isAnswered, autoAdvanceSec, isCountdownPaused, currentQ?.id]);

  // Desktop keyboard controls (1-4 for options, S/B for bookmark, Space/Enter/N for Next question)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
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
  }, [isActive, isAnswered, currentQ, showReportModal, showSupportModal, bookmarkedIds]);

  const handleApplyFilter = (newCat: QuestionCategory | 'mixed', newExam: ExamType) => {
    soundManager.playTap();
    setCategory(newCat);
    setExam(newExam);
    saveStoredPyqFilterPreferences({ category: newCat, exam: newExam });
    if (onFilterChange) {
      onFilterChange(newCat, newExam);
    }
    if (customTargetQueue && onExitCustomQueue) {
      const allMatch = customTargetQueue.every(q => matchesExamFamilyFilter(q, newExam));
      if (!allMatch) {
        onExitCustomQueue();
      }
    }
    hasFiredPracticeStartRef.current = false;
    batchCorrectCountRef.current = 0;
    const nextQ = getNextDrillQuestion(newCat, newExam, recentWordsHistory);
    setCurrentQ(nextQ);
    setSelectedOption(null);
    setIsAnswered(false);
    setCountdown(0);
    setIsCountdownPaused(false);
    saveStoredActiveDrill({
      question: nextQ,
      selectedOption: null,
      isAnswered: false,
      category: newCat,
      exam: newExam,
    });
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    saveStoredActiveDrill({
      question: currentQ,
      selectedOption: idx,
      isAnswered: true,
      category,
      exam,
      customSessionTitle,
      customQueueIndex,
    });

    if (onSolveQuestion) {
      onSolveQuestion();
    }

    const elapsedMs = Date.now() - questionStartTimeRef.current;
    const isCorrect = idx === currentQ.correctIndex;

    // GA4 Core Event Parameters
    const isTop100 = Boolean(
      attemptSource === 'ssc_top100' ||
      (customSessionTitle && customSessionTitle.includes('SSC TOP 100')) ||
      (customBadge && customBadge.includes('SSC'))
    );
    const isDailySprint = attemptSource === 'daily_sprint' || Boolean(customSessionTitle && customSessionTitle.includes('Daily Sprint'));
    const currentPracticeType: PracticeType = isTop100 ? 'ssc_top100' : isDailySprint ? 'daily_sprint' : 'pyq_drill';
    const currentAnalyticsCat = normalizeAnalyticsCategory(currentQ.category || category);
    const currentAnalyticsExam = normalizeAnalyticsExamFamily((currentQ as any)?.examTag || exam);

    // 1. GA4: practice_start (fired once when user genuinely starts answering the practice session)
    if (!hasFiredPracticeStartRef.current) {
      hasFiredPracticeStartRef.current = true;
      trackPracticeStart({
        practice_type: currentPracticeType,
        category: currentAnalyticsCat,
        exam_family: currentAnalyticsExam,
      });
    }

    // 2. GA4: question_answered (fired for every submitted answer with non-PII metadata)
    trackQuestionAnswered({
      practice_type: currentPracticeType,
      category: currentAnalyticsCat,
      exam_family: currentAnalyticsExam,
      correct: isCorrect,
    });

    if (isCorrect) {
      batchCorrectCountRef.current += 1;
    }

    // Track results for custom coaching session
    if (customTargetQueue && customTargetQueue.length > 0) {
      const nextResults = [...customResultsRef.current, { isCorrect }];
      customResultsRef.current = nextResults;
      setCustomQueueResults(nextResults);
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

    // Non-logged-in guest tracking for 10-question milestone prompt
    if (!currentUser) {
      guestPyqSessionCountRef.current += 1;
      if (isCorrect) {
        guestPyqCorrectCountRef.current += 1;
      } else {
        guestPyqMistakeCountRef.current += 1;
      }
      try {
        sessionStorage.setItem('vocabclash_guest_pyq_session_count', String(guestPyqSessionCountRef.current));
        sessionStorage.setItem('vocabclash_guest_pyq_session_correct', String(guestPyqCorrectCountRef.current));
        sessionStorage.setItem('vocabclash_guest_pyq_session_mistakes', String(guestPyqMistakeCountRef.current));
      } catch {}

      if (guestPyqSessionCountRef.current === 10) {
        const c = guestPyqCorrectCountRef.current;
        const m = guestPyqMistakeCountRef.current;
        const acc = Math.round((c / 10) * 100);
        setGuestPyqStats({ correctCount: c, mistakeCount: m, accuracy: acc });
        trackGuestPyq10Completed({ correctCount: c, mistakeCount: m, accuracy: acc });
      }
    }

    // 3. GA4: 10-Question Milestone PYQ session completion (if not in a custom bounded queue)
    if (!customTargetQueue && nextSolvedCount % 10 === 0) {
      const correctInBatch = batchCorrectCountRef.current;
      trackPracticeComplete({
        practice_type: 'pyq_drill',
        questions_answered: 10,
        correct_count: correctInBatch,
        accuracy: Math.round((correctInBatch / 10) * 100),
      });
      batchCorrectCountRef.current = 0;
    }

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

  const proceedWithNextQuestion = () => {
    isAdvancingRef.current = true;
    soundManager.playTap();
    
    // Batch interval ad trigger (every 15 questions solved)
    if ((sessionSolvedCount + 1) % 15 === 0 && onBatchComplete) {
      onBatchComplete();
    }

    // Handle Custom Targeted Coaching Queue if active and matches current exam filter
    if (customTargetQueue && customTargetQueue.length > 0 && customTargetQueue.every(q => matchesExamFamilyFilter(q, exam))) {
      const nextIdx = customQueueIndex + 1;
      if (nextIdx >= customTargetQueue.length) {
        setCustomDrillCompleted(true);
        const isTop100 = Boolean(
          attemptSource === 'ssc_top100' ||
          (customSessionTitle && customSessionTitle.includes('SSC TOP 100')) ||
          (customBadge && customBadge.includes('SSC'))
        );
        const isDailySprint = attemptSource === 'daily_sprint' || Boolean(customSessionTitle && customSessionTitle.includes('Daily Sprint'));
        const total = customResultsRef.current.length;
        const correctCount = customResultsRef.current.filter(r => r.isCorrect).length;
        const accuracy = Math.round((correctCount / Math.max(1, total)) * 100);

        // GA4: practice_complete for custom sessions (Daily sprint or AI mentor drill)
        if (!isTop100) {
          trackPracticeComplete({
            practice_type: isDailySprint ? 'daily_sprint' : 'pyq_drill',
            questions_answered: total,
            correct_count: correctCount,
            accuracy,
          });
        }

        if (onCustomDrillCompleted) {
          onCustomDrillCompleted(customResultsRef.current);
        }
        saveStoredActiveDrill(null);
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
      saveStoredActiveDrill({
        question: nextQ,
        selectedOption: null,
        isAnswered: false,
        category,
        exam,
        customSessionTitle,
        customQueueIndex: nextIdx,
      });
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 400);
      return;
    }

    // Pull next adaptive repetition question strictly respecting exam filter
    const nextQ = getNextDrillQuestion(category, exam, [...recentWordsHistory, currentQ.wordOrPhrase]);
    const safeQ = (exam !== 'ALL' && !matchesExamFamilyFilter(nextQ, exam))
      ? questionBankEngine.getNextDrillQuestion(category, exam, recentWordsHistory)
      : nextQ;
    setCurrentQ(safeQ);
    
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
    saveStoredActiveDrill({
      question: safeQ,
      selectedOption: null,
      isAnswered: false,
      category,
      exam,
    });

    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 400);
  };

  const handleNextQuestion = () => {
    if (isAdvancingRef.current) return;

    // Check if non-logged-in guest completed 10 questions and hasn't seen the prompt yet
    const promptAlreadyShown = typeof window !== 'undefined' && localStorage.getItem('guestPyqSignupPromptShown') === 'true';
    if (!currentUser && guestPyqSessionCountRef.current >= 10 && !promptAlreadyShown) {
      setIsCountdownPaused(true);
      setShowGuestPyqModal(true);
      trackGuestPyqSignupPromptView();
      return;
    }

    proceedWithNextQuestion();
  };

  const handleGuestPyqModalClose = () => {
    try {
      localStorage.setItem('guestPyqSignupPromptShown', 'true');
    } catch {}
    trackGuestPyqSignupPromptClose();
    setShowGuestPyqModal(false);
    setIsCountdownPaused(false);
    proceedWithNextQuestion();
  };

  const handleGuestPyqModalSuccess = (user: FirebaseUser) => {
    try {
      localStorage.setItem('guestPyqSignupPromptShown', 'true');
    } catch {}
    trackGuestSignupComplete('pyq');
    if (onUserChange) onUserChange(user);
    setShowGuestPyqModal(false);
    setIsCountdownPaused(false);
    proceedWithNextQuestion();
  };

  const handleToggleBookmark = (e?: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (!currentQ) return;

    // Detect click / tap coordinates for the letter flight origin
    let startX = typeof window !== 'undefined' ? window.innerWidth * 0.75 : 200;
    let startY = 120;

    if (e && 'clientX' in e && e.clientX && e.clientY) {
      startX = e.clientX;
      startY = e.clientY;
    } else if (e && 'touches' in e && e.touches && e.touches[0]) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else if (typeof document !== 'undefined') {
      const btn = document.querySelector('#pyq-save-button, #pyq-explanation-save-button');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      }
    }

    onBookmarkQuestion(currentQ);
    const alreadyBookmarked = bookmarkedIds.includes(currentQ.id);
    const nextSaved = !alreadyBookmarked;
    questionReviewScheduler.setSavedStatus(currentQ.memoryKey || currentQ.wordOrPhrase, nextSaved);

    // Audio & Haptic feedback
    if (nextSaved) {
      soundManager.playWhoosh();
    } else {
      soundManager.playUnsave();
    }

    const cleanWord = (currentQ.wordOrPhrase || 'Question').replace(/^["']+|["']+$/g, '').trim();
    const newFlyItem: VaultFlyItem = {
      id: `${currentQ.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startX,
      startY,
      word: cleanWord,
      isSave: nextSaved,
    };

    setFlyItems(prev => [...prev, newFlyItem]);
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

  // Guaranteed educational fields resolution with disambiguated word & option meanings
  const eduDetails = useMemo(() => {
    if (!currentQ) return null;
    return resolveCardEducation(currentQ);
  }, [currentQ]);

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 pb-8 max-w-4xl mx-auto w-full">
      {/* Smooth Flying Letter Whoosh Animation into Vault */}
      <VaultFlyAnimation
        items={flyItems}
        onComplete={(id) => setFlyItems(prev => prev.filter(item => item.id !== id))}
      />

      {/* Custom Coaching Drill Completion Summary */}
      {customDrillCompleted ? (
        isSscTop100 ? (
          <div className="bg-slate-900/95 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-10 h-10 stroke-[2.2]" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                SSC TOP 100 DRILL COMPLETED
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-100">
                {customSessionTitle || 'Top 100 Drill Completed'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                You've solved all 100 high-frequency questions from TCS & Eduquity exam shifts.
              </p>
            </div>

            {/* Performance Grid with Right %, Wrong %, Solved */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md mx-auto">
              <div className="bg-slate-950/80 border border-emerald-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Right %
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                  {liveRightPercent}%
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  {liveCorrectCount} Correct
                </div>
              </div>

              <div className="bg-slate-950/80 border border-rose-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Wrong %
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
                  {liveWrongPercent}%
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  {liveMistakeCount} Wrong
                </div>
              </div>

              <div className="bg-slate-950/80 border border-amber-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  Solved
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                  100/100
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  +{liveCorrectCount * 10 - liveMistakeCount * 2} pts
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
              <button
                onClick={() => {
                  soundManager.playTap();
                  if (onRestartCustomDrill) {
                    onRestartCustomDrill();
                  } else {
                    setCustomDrillCompleted(false);
                    setCustomQueueIndex(0);
                    setCustomQueueResults([]);
                    customResultsRef.current = [];
                    if (customTargetQueue && customTargetQueue.length > 0) {
                      setCurrentQ(customTargetQueue[0]);
                      setSelectedOption(null);
                      setIsAnswered(false);
                    }
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Start Again
              </button>

              {liveMistakeCount > 0 && onReviewMistakes && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onReviewMistakes();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Review Mistakes
                </button>
              )}

              {onExitCustomQueue && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onExitCustomQueue();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  Arena Home
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-purple-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-purple-500/15 border border-purple-500/30 text-purple-300">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                {displayBadge} COMPLETED
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-100">
                {displayTitle || 'Targeted Coaching Drill Complete!'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                You've successfully completed this targeted weak areas session. Spaced repetition memory levels and category accuracy have been refreshed.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-md mx-auto">
              <div className="bg-slate-950/80 border border-emerald-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Right %
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                  {liveRightPercent}%
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  {liveCorrectCount} Correct
                </div>
              </div>

              <div className="bg-slate-950/80 border border-rose-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Wrong %
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
                  {liveWrongPercent}%
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  {liveMistakeCount} Mistakes
                </div>
              </div>

              <div className="bg-slate-950/80 border border-purple-500/40 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  Solved
                </div>
                <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
                  {currentDrillSolvedCount}/{totalCustomQuestions}
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5">
                  +{liveCorrectCount * 10 - liveMistakeCount * 2} pts
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3 max-w-md mx-auto">
              <button
                onClick={() => {
                  soundManager.playTap();
                  if (onRestartCustomDrill) {
                    onRestartCustomDrill();
                  } else {
                    setCustomDrillCompleted(false);
                    setCustomQueueIndex(0);
                    setCustomQueueResults([]);
                    customResultsRef.current = [];
                    if (customTargetQueue && customTargetQueue.length > 0) {
                      setCurrentQ(customTargetQueue[0]);
                      setSelectedOption(null);
                      setIsAnswered(false);
                    }
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-200" />
                Train More Weak Areas
              </button>

              {liveMistakeCount > 0 && onReviewMistakes && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onReviewMistakes();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Review Mistakes
                </button>
              )}

              {onExitCustomQueue && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onExitCustomQueue();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  Return to AI Coach
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      ) : customTargetQueue && customTargetQueue.length > 0 ? (
        /* Dedicated Targeted Coaching / SSC Top 100 Drill Header */
        <div className={`border rounded-2xl p-3 sm:p-4 shadow-xl space-y-3 ${
          isSscTop100 
            ? 'bg-slate-900/95 border-amber-500/40' 
            : 'bg-slate-900/95 border-purple-500/40 shadow-purple-950/20'
        }`}>
          {/* Top Row: Category title, Subtitle/badge, and Exit Drill button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl border shrink-0 ${
                isSscTop100
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
              }`}>
                {isSscTop100 ? (
                  <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
                ) : (
                  <Target className="w-5 h-5 text-purple-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                    isSscTop100
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}>
                    {displayBadge}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                    {isSscTop100 ? 'TCS & Eduquity PYQ Bank' : 'AI Adaptive Coaching • Weak Area Focus'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-100 truncate mt-0.5">
                  {displayTitle}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {streak > 1 && (
                <div className="hidden xs:flex items-center gap-1 bg-orange-950/80 border border-orange-700/60 text-orange-400 px-2 py-1 rounded-xl text-xs font-bold">
                  <Flame className="w-3.5 h-3.5 fill-orange-400" />
                  <span>{streak}x</span>
                </div>
              )}
              <div className={`flex items-center gap-1 bg-slate-800/90 border px-2.5 py-1 rounded-xl text-xs ${
                isSscTop100 ? 'border-amber-500/30' : 'border-purple-500/30'
              }`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase">PYQ</span>
                <span className={`font-mono font-black ${isSscTop100 ? 'text-amber-400' : 'text-purple-400'}`}>
                  {pyqScore} pts
                </span>
              </div>
              {onExitCustomQueue && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onExitCustomQueue();
                  }}
                  className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  Exit Drill
                </button>
              )}
            </div>
          </div>

          {/* Drill Progress & Live Right/Wrong Stats Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`font-black flex items-center gap-1 ${
                  isSscTop100 ? 'text-amber-400' : 'text-purple-400'
                }`}>
                  <BookOpen className="w-3.5 h-3.5" />
                  Question {currentDrillQuestionNum} of {totalCustomQuestions}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300 font-semibold text-[11px]">
                  Drill Progress: <b className="text-white">{currentDrillSolvedCount}/{totalCustomQuestions}</b>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {liveCorrectCount} Right ({liveRightPercent}%)
                </span>
                <span className="text-rose-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {liveMistakeCount} Wrong ({liveWrongPercent}%)
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isSscTop100 ? 'bg-amber-400' : 'bg-purple-500'
                }`}
                style={{ width: `${drillProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-100 flex items-center gap-1.5 truncate">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400 shrink-0" />
                <span>PYQ Endless Drill</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                24,000+ Govt Exam PYQ Pool with Adaptive Spaced Repetition & Option Analysis
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {streak > 1 && (
                <div className="hidden xs:flex items-center gap-1 bg-orange-950/80 border border-orange-700/60 text-orange-400 px-2 py-0.5 rounded-full text-xs font-bold">
                  <Flame className="w-3 h-3 fill-orange-400" />
                  <span>{streak}x</span>
                </div>
              )}

              {/* 🎯 Small Exam & Category Filter Option (To the Left of Stats Button) */}
              <div className="relative shrink-0" ref={filterPopoverRef}>
                <button
                  type="button"
                  id="practice-filter-button"
                  onClick={() => {
                    soundManager.playTap();
                    if (showFilterGuidance) {
                      onFilterGuidanceDismissed?.();
                    }
                    if (!isFilterOpen) {
                      setPendingCategory(category);
                      setPendingExam(exam);
                      setIsAppliedAnimation(false);
                    }
                    setIsFilterOpen(prev => !prev);
                  }}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 shrink-0 ${
                    showFilterGuidance && !isFilterOpen
                      ? 'bg-amber-950/70 border-amber-400 text-amber-300 ring-2 ring-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : isFilterOpen || normalizeFilterToFamily(exam) !== 'all'
                      ? 'bg-cyan-950/60 border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/40'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                  }`}
                  title="Filter Exam Board & Vocab Section"
                  aria-expanded={isFilterOpen}
                  aria-haspopup="true"
                >
                  <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[11px] font-bold whitespace-nowrap">
                    {normalizeFilterToFamily(exam) === 'all'
                      ? 'All Exams'
                      : normalizeFilterToFamily(exam) === 'ssc'
                      ? 'SSC'
                      : normalizeFilterToFamily(exam) === 'dsssb'
                      ? 'DSSSB'
                      : normalizeFilterToFamily(exam) === 'banking'
                      ? 'Banking'
                      : 'Defence'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0 ${isFilterOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                </button>

                {/* 🎯 Subtle Animated Filter Guidance Pointer (Target / Exam Filter Education) */}
                {showFilterGuidance && !isFilterOpen && (
                  <div 
                    id="pyq-filter-guidance-container"
                    className="absolute right-0 top-full mt-2 z-40 flex flex-col items-end pointer-events-auto select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundManager.playTap();
                      onFilterGuidanceDismissed?.();
                      setPendingCategory(category);
                      setPendingExam(exam);
                      setIsAppliedAnimation(false);
                      setIsFilterOpen(true);
                    }}
                  >
                    {/* Pulsing Upward Pointer Arrow */}
                    <div className="mr-5 mb-1 text-amber-400 animate-bounce flex items-center justify-center">
                      <svg className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(245,158,11,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3L4 11h5v10h6V11h5L12 3z" />
                      </svg>
                    </div>

                    {/* Compact Explanatory Tooltip Card */}
                    <div className="bg-[#090D24]/95 border border-amber-500/80 rounded-xl p-2 sm:p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] text-right backdrop-blur-md max-w-[210px] sm:max-w-[240px] cursor-pointer hover:border-amber-400 transition-all ring-1 ring-amber-400/30 active:scale-95">
                      <div className="text-[11px] font-extrabold text-amber-300 flex items-center justify-end gap-1">
                        <span>Tap to choose target exam</span>
                        <Target className="w-3 h-3 text-amber-400 shrink-0" />
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                        Filter by SSC, Banking, Defence, or DSSSB
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Popover */}
                {isFilterOpen && (
                  <div
                    id="practice-filter-dropdown"
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-2rem)] sm:w-80 bg-slate-900/98 border border-slate-700/90 rounded-2xl shadow-2xl p-3 sm:p-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <Filter className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Filter PYQ Pool</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playTap();
                          setIsFilterOpen(false);
                        }}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer active:scale-95"
                        aria-label="Close Filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Target Exam Family Selector */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-cyan-400" />
                          Target Exam:
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                          {normalizeFilterToFamily(pendingExam) === 'all'
                            ? 'All Board PYQs'
                            : `${normalizeFilterToFamily(pendingExam).toUpperCase()} PYQ Bank`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {EXAM_FAMILY_PILLS.map(pill => {
                          const activeFam = normalizeFilterToFamily(pendingExam);
                          const isSelected = (pill.id === 'ALL' && activeFam === 'all') || (pill.family && activeFam === pill.family);
                          return (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => {
                                soundManager.playTap();
                                setPendingExam(pill.id as ExamType);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 border-cyan-300 text-slate-950 font-black shadow-md shadow-cyan-950/50 ring-2 ring-cyan-300/80 scale-[1.02]'
                                  : 'bg-slate-800/90 border-slate-700/80 text-slate-300 hover:bg-slate-750 hover:text-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-slate-950 stroke-[3] shrink-0" />}
                              <span>{pill.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Included Sub-Exam Preview Tags */}
                      {normalizeFilterToFamily(pendingExam) !== 'all' && EXAM_FAMILY_SUB_TAGS[normalizeFilterToFamily(pendingExam)]?.length > 0 && (
                        <div className="pt-1.5 bg-slate-950/70 border border-slate-800/90 rounded-xl p-2 space-y-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                            Included In {normalizeFilterToFamily(pendingExam).toUpperCase()}:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {EXAM_FAMILY_SUB_TAGS[normalizeFilterToFamily(pendingExam)].map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-medium text-[10px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vocab Section / Category Option */}
                    <div className="space-y-1.5 border-t border-slate-800/90 pt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-sky-400" />
                          Vocab Category:
                        </span>
                        <span className="text-[10px] text-sky-400 font-mono">
                          {pendingCategory === 'mixed' ? 'All PYQs' : pendingCategory.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {[
                          { id: 'mixed', label: 'All PYQs' },
                          { id: 'antonyms', label: 'Antonyms' },
                          { id: 'synonyms', label: 'Synonyms' },
                          { id: 'ows', label: 'One Word' },
                          { id: 'idioms', label: 'Idioms' },
                        ].map(tab => {
                          const isSelected = pendingCategory === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                soundManager.playTap();
                                setPendingCategory(tab.id as QuestionCategory | 'mixed');
                              }}
                              className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-sky-500 border-sky-300 text-white font-black shadow-sm ring-2 ring-sky-300/80 scale-[1.02]'
                                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3] text-white shrink-0" />}
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Apply & Close Button with Real Click Feedback */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        id="apply-filter-button"
                        onClick={() => {
                          soundManager.playTap();
                          setIsAppliedAnimation(true);
                          handleApplyFilter(pendingCategory, pendingExam);
                          setTimeout(() => {
                            setIsFilterOpen(false);
                            setIsAppliedAnimation(false);
                          }, 200);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 hover:from-cyan-400 hover:via-sky-400 hover:to-blue-400 active:scale-[0.97] active:brightness-90 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-cyan-500/25 border border-cyan-300/50 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 select-none"
                      >
                        {isAppliedAnimation ? (
                          <>
                            <Check className="w-4 h-4 text-slate-950 stroke-[3] animate-bounce" />
                            <span>Filters Applied!</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                            <span>Apply & Close</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* PYQ Score & Stats Symbol */}
              <button
                onClick={() => {
                  if (onOpenStats) {
                    soundManager.playTap();
                    onOpenStats();
                  }
                }}
                id="practice-stats-button"
                className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 border border-amber-500/35 hover:border-amber-400 px-2 sm:px-2.5 py-1 rounded-xl shadow-sm transition-all group active:scale-95 cursor-pointer shrink-0"
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
              { id: 'mixed', label: 'All PYQs' },
              { id: 'antonyms', label: 'Antonyms' },
              { id: 'synonyms', label: 'Synonyms' },
              { id: 'ows', label: 'One Word' },
              { id: 'idioms', label: 'Idioms' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  handleApplyFilter(tab.id as QuestionCategory | 'mixed', exam);
                }}
                className={`px-3 py-1.5 rounded-xl border font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                  category === tab.id
                    ? 'bg-sky-600 border-sky-400 text-white shadow-md ring-1 ring-sky-300/50'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Question Card */}
      {currentQ && !customDrillCompleted && (
        <div className="space-y-3 pt-1">
          {/* Top Info & Actions Header (Clean 1-line layout) */}
          <div className="flex items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span 
                title={currentQ.repeatCount > 5 ? `Repeated ${currentQ.repeatCount} times in official exams` : undefined}
                className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span>Repeated {formatRepeatCount(currentQ.repeatCount)}</span>
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
              {currentQ.reviewReason === 'weak_category' && (
                <span className="bg-purple-950 text-purple-300 border border-purple-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <Target className="w-2.5 h-2.5 text-purple-400" />
                  Weak Area Focus
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
                onClick={(e) => handleToggleBookmark(e)}
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

              {/* Next Question Symbol & Quick Action */}
              <button
                onClick={handleNextQuestion}
                id="pyq-top-next-button"
                className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition-all shadow-sm flex items-center gap-1 group font-bold text-xs ${
                  customTargetQueue && customQueueIndex === customTargetQueue.length - 1
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'border-sky-500/60 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white'
                }`}
                title={customTargetQueue && customQueueIndex === customTargetQueue.length - 1 ? `Finish Drill (${totalCustomQuestions}/${totalCustomQuestions})` : "Next Question / Skip (Press Space / Enter / N)"}
                aria-label={customTargetQueue && customQueueIndex === customTargetQueue.length - 1 ? "Finish Drill" : "Next Question"}
              >
                <span className="text-[11px] font-bold hidden sm:inline">
                  {customTargetQueue && customQueueIndex === customTargetQueue.length - 1 ? `Finish (${totalCustomQuestions}/${totalCustomQuestions}) 🏆` : 'Next'}
                </span>
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
              {/* Header Action Bar & Structured Educational Solution Breakdown */}
              <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      {currentQ.category === 'ows'
                        ? '💡 One Word Substitution Insight'
                        : currentQ.category === 'idioms'
                        ? '📖 Idiom & Phrase Insight'
                        : currentQ.category === 'antonyms'
                        ? '⚖️ Antonym & Contrast Insight'
                        : '📚 Vocabulary & Solution Insight'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleToggleBookmark(e)}
                      id="pyq-explanation-save-button"
                      className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 font-bold transition-all active:scale-95 cursor-pointer ${
                        isBookmarked
                          ? 'bg-amber-950 border-amber-600 text-amber-400'
                          : 'bg-slate-800 border-slate-750 text-slate-300 hover:text-slate-100'
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
                  <QuestionSolutionBreakdown
                    breakdown={eduDetails.meaningsBreakdown}
                    meaning={eduDetails.meaning}
                    hindiMeaning={eduDetails.hindiMeaning}
                    rootWordInfo={eduDetails.rootWordInfo}
                    category={currentQ.category}
                  />
                )}
              </div>

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

              {/* Next Question CTA & Auto-Advance Control */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleNextQuestion}
                  id="pyq-bottom-next-button"
                  className={`w-full font-black py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all relative overflow-hidden group cursor-pointer ${
                    customTargetQueue && customQueueIndex === customTargetQueue.length - 1
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-amber-500/30'
                      : 'bg-[#00a6f4] hover:bg-[#0096dc] active:bg-[#0086c7] text-white shadow-sky-500/25'
                  }`}
                >
                  {/* Subtle timer progress bar when auto-advance active */}
                  {autoAdvanceSec > 0 && countdown > 0 && !isCountdownPaused && (
                    <div 
                      className="absolute bottom-0 left-0 top-0 bg-white/20 transition-all duration-1000 ease-linear pointer-events-none"
                      style={{ width: `${(countdown / autoAdvanceSec) * 100}%` }}
                    />
                  )}

                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <span>
                      {customTargetQueue && customQueueIndex === customTargetQueue.length - 1
                        ? `FINISH DRILL & VIEW RESULTS (${totalCustomQuestions}/${totalCustomQuestions}) 🏆`
                        : 'NEXT QUESTION'}
                    </span>
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

      {/* AdSense / AdMob Banner Slot (Free users only, gated by ADS_ENABLED) */}
      {ADS_ENABLED && !isPremium && (
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

      {/* Non-logged-in Guest Conversion Modal (after 10 PYQ Drill questions) */}
      <GuestConversionModal
        isOpen={showGuestPyqModal}
        variant="pyq_10"
        stats={guestPyqStats}
        onClose={handleGuestPyqModalClose}
        onSuccess={handleGuestPyqModalSuccess}
        onGoogleClick={trackGuestPyqSignupClick}
      />
    </div>
  );
};
