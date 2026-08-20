import React, { useState, useEffect, useRef } from 'react';
import { QuestionCategory, ExamType, Question } from '../types';
import { getNextDrillQuestion } from '../services/matchmakingService';
import { recordQuestionAttempt, getWordMastery, getOverallMasteryStats, QuestionMasteryRecord } from '../utils/masteryManager';
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
  LifeBuoy
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
  const [currentMastery, setCurrentMastery] = useState<QuestionMasteryRecord | null>(() => 
    currentQ ? getWordMastery(currentQ.wordOrPhrase) : null
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

  // Overall mastery summary for top stats
  const [masteryStats, setMasteryStats] = useState(() => getOverallMasteryStats());

  // Keep word mastery updated for the current question
  useEffect(() => {
    if (currentQ) {
      setCurrentMastery(getWordMastery(currentQ.wordOrPhrase));
    }
  }, [currentQ]);

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

    const isCorrect = idx === currentQ.correctIndex;

    // Record spaced repetition attempt in persistent storage
    const updatedRecord = recordQuestionAttempt(currentQ.wordOrPhrase, isCorrect);
    setCurrentMastery(updatedRecord);
    setMasteryStats(getOverallMasteryStats());

    // Add to session word history (to prevent immediate repeat for 50 questions)
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

    // Pull next spaced-repetition question from the 24,000+ pool
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
    showSaveConfirmation(
      alreadyBookmarked ? 'Word saved in Revision Vault' : '⭐ Question Saved to Revision Vault'
    );
  };

  const isBookmarked = currentQ ? bookmarkedIds.includes(currentQ.id) : false;

  // Compute detailed breakdowns for all 4 options
  const optionDetails: OptionDetail[] = currentQ 
    ? getOptionBreakdown(
        currentQ.options,
        currentQ.correctIndex,
        currentQ.category,
        currentQ.wordOrPhrase,
        currentQ.meaning,
        currentQ.hindiMeaning
      )
    : [];

  return (
    <div className="flex-1 p-4 space-y-3.5 overflow-y-auto pb-8">
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
            24,000+ Govt Exam PYQ Pool with Smart Spaced Repetition & Full Option Analysis
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
        <div className="flex items-center gap-1.5 text-[11px]">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">Mastered:</span>
          <span className="font-bold text-amber-400">{masteryStats.masteredCount}</span>
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
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0">
                🔥 Repeated {currentQ.repeatCount}x
              </span>

              {/* Mastery tag for this word */}
              {currentMastery && currentMastery.correctCount >= 10 ? (
                <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Mastered ({currentMastery.correctCount}✓)
                </span>
              ) : currentMastery && currentMastery.correctCount > 0 ? (
                <span className="bg-blue-950/80 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0">
                  Learning ({currentMastery.correctCount}/10✓)
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-medium text-[10px] shrink-0">
                  Fresh Word
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
          <div className="grid grid-cols-1 gap-2">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;

              let style = 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750';
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
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all ${style}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                  {isAnswered && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-400" />}
                </button>
              );
            })}
          </div>

          {/* Post-Answer Detailed Explanation Box with 4 Options Breakdown */}
          {isAnswered && (
            <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-3.5 space-y-3 animate-fadeIn shadow-md">
              {/* Header Action Bar & Optional Word Meaning */}
              {currentQ.category !== 'idioms' && currentQ.category !== 'one-word' ? (
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

                  <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="text-xs text-slate-100 font-medium">
                      <span className="font-bold text-sky-400">English: </span>
                      <span>{currentQ.meaning}</span>
                    </div>
                    <div className="text-xs text-amber-300/90 font-medium">
                      <span className="font-bold text-amber-400">हिन्दी अर्थ: </span>
                      <span>{currentQ.hindiMeaning}</span>
                    </div>
                    {currentQ.rootWordInfo && (
                      <div className="text-[11px] text-teal-300/90 pt-0.5 border-t border-slate-800/60">
                        <span className="font-bold text-teal-400">Root & Etymology: </span>
                        <span>{currentQ.rootWordInfo}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Clean Action Bar for Idioms & One-Word Substitutions */
                <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 px-3 py-2 rounded-xl">
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
              )}

              {/* Mnemonic Hook and Example */}
              <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                <div>
                  <span className="font-bold text-sky-400">💡 Mnemonic Hook: </span>
                  <span>{currentQ.mnemonic}</span>
                </div>
                <div className="text-[11px] text-slate-400 italic pt-0.5 border-t border-slate-800/50">
                  <span className="font-semibold text-slate-500 not-italic">Example: </span>"{currentQ.exampleSentence}"
                </div>
              </div>

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
                    className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-0.5"
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
                            <div className="text-amber-300 font-semibold text-[11px]">
                              {detail.hindiMeaning}
                            </div>
                            <div className="text-slate-300 text-[11px] leading-relaxed">
                              {detail.englishMeaning}
                            </div>
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
