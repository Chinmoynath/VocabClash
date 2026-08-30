import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QuestionCategory, ExamType, Question } from '../types';
import { getNextDrillQuestion } from '../services/matchmakingService';
import { questionReviewScheduler, ReviewState } from '../services/questionReviewScheduler';
import { getPersistentSeenWords } from '../utils/questionHistoryManager';
import { getOptionBreakdown, OptionDetail } from '../utils/optionExplanations';
import { soundManager } from '../utils/audio';
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
  Info
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';
import { ReportQuestionModal } from './ReportQuestionModal';
import { SupportModal } from './SupportModal';

interface PracticeModeProps {
  pyqScore: number;
  onUpdatePyqScore: (delta: number) => void;
  onBookmarkQuestion: (question: Question) => void;
  onOpenAiTutor: (question: Question) => void;
  onBatchComplete?: () => void;
  onSolveQuestion?: () => void;
  bookmarkedIds: string[];
  isPremium?: boolean;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({
  pyqScore,
  onUpdatePyqScore,
  onBookmarkQuestion,
  onOpenAiTutor,
  onBatchComplete,
  onSolveQuestion,
  bookmarkedIds,
  isPremium = false,
}) => {
  const [category, setCategory] = useState<QuestionCategory | 'mixed'>('mixed');
  const [exam, setExam] = useState<ExamType>('ALL');
  
  // Continuous drill session state (no 20 question limit)
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [recentWordsHistory, setRecentWordsHistory] = useState<string[]>(() => getPersistentSeenWords().slice(-100));
  const [currentQ, setCurrentQ] = useState<Question>(() => {
    const initHistory = getPersistentSeenWords().slice(-100);
    return getNextDrillQuestion('mixed', 'ALL', initHistory);
  });

  const questionStartTimeRef = useRef<number>(Date.now());
  const [currentReviewState, setCurrentReviewState] = useState<ReviewState | null>(() => 
    currentQ ? questionReviewScheduler.getReviewState(currentQ.memoryKey || currentQ.wordOrPhrase) || null : null
  );

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);
  const [sessionSolvedCount, setSessionSolvedCount] = useState<number>(0);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showAllOptionBreakdown, setShowAllOptionBreakdown] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Overall scheduler summary for top stats
  const [schedulerStats, setSchedulerStats] = useState(() => questionReviewScheduler.getStats());

  // Keep review state updated for the current question
  useEffect(() => {
    if (currentQ) {
      questionStartTimeRef.current = Date.now();
      setCurrentReviewState(questionReviewScheduler.getReviewState(currentQ.memoryKey || currentQ.wordOrPhrase) || null);
    }
  }, [currentQ]);

  // Desktop keyboard controls (1-4 for options, Space/Enter for Next question)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showReportModal || showSupportModal) return;

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
  }, [isAnswered, currentQ, showReportModal, showSupportModal]);

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

    // Record spaced repetition attempt in adaptive scheduler
    const updatedRecord = questionReviewScheduler.recordAttempt(currentQ, isCorrect, elapsedMs);
    setCurrentReviewState(updatedRecord);
    setSchedulerStats(questionReviewScheduler.getStats());

    // Add to session word history
    setRecentWordsHistory(prev => [...prev.slice(-50), currentQ.wordOrPhrase]);
    setSessionSolvedCount(prev => prev + 1);

    if (isCorrect) {
      soundManager.playCorrect();
      setStreak(prev => prev + 1);
      onUpdatePyqScore(10);
    } else {
      soundManager.playWrong();
      setStreak(0);
      onUpdatePyqScore(-2);
    }
  };

  const handleNextQuestion = () => {
    soundManager.playTap();
    
    // Batch interval ad trigger (every 15 questions solved)
    if ((sessionSolvedCount + 1) % 15 === 0 && onBatchComplete) {
      onBatchComplete();
    }

    // Pull next adaptive repetition question
    const nextQ = getNextDrillQuestion(category, exam, [...recentWordsHistory, currentQ.wordOrPhrase]);
    setCurrentQ(nextQ);
    setQuestionNumber(prev => prev + 1);
    setSelectedOption(null);
    setIsAnswered(false);
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
          <div className="flex items-center gap-1.5 bg-slate-850 border border-amber-500/30 px-2.5 py-1 rounded-xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PYQ Score</span>
            <span className="text-xs font-mono font-black text-amber-400">
              {pyqScore} pts
            </span>
          </div>
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

            {/* Right side: Transparent Red Flag Icon + Save Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Transparent Red Flag Report Button */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowReportModal(true);
                }}
                className="p-1.5 rounded-lg text-rose-500/80 hover:text-rose-400 hover:bg-rose-950/40 active:scale-95 transition-all"
                title="Report issue in this question (support@vocabclash.in)"
                aria-label="Report Question"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              {/* Save / Bookmark Button */}
              <button
                onClick={handleToggleBookmark}
                id="pyq-save-button"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                  isBookmarked
                    ? 'bg-amber-950 border-amber-600 text-amber-400 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
                title="Save to Mistake & Revision Vault"
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                <span>{isBookmarked ? 'Saved' : 'Save Question'}</span>
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
            <div className="text-[10px] text-sky-400 flex items-center justify-center gap-1 pt-1">
              <span>{currentQ.examHistory.slice(0, 2).join(' • ')}</span>
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
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono flex items-center justify-center font-bold shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="truncate">{option}</span>
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
                          <span className="font-bold text-teal-400">Root & Etymology: </span>
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
                          <span className="font-bold text-teal-400">Root & Etymology: </span>
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

              {/* Next Question CTA */}
              <button
                onClick={handleNextQuestion}
                className="w-full mt-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-extrabold p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
              >
                <span>NEXT QUESTION</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
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
