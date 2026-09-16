import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedWord, Question } from '../types';
import { questionReviewScheduler } from '../services/questionReviewScheduler';
import { recordAttemptEvent } from '../services/attemptTrackingService';
import { trackDueRevisionStart, trackDueRevisionComplete } from '../services/analyticsService';
import { soundManager } from '../utils/audio';
import { triggerGlobalQuestionSolved } from '../utils/streakManager';
import { resolveRevisionCard, NormalizedMistakeVaultItem } from '../utils/mistakeVaultCardResolver';
import { 
  Brain, 
  X, 
  CheckCircle2, 
  RotateCw, 
  ChevronRight, 
  Sparkles, 
  Star, 
  Flame, 
  Trophy,
  ArrowRight,
  Eye,
  Check,
  AlertCircle
} from 'lucide-react';

interface DueRevisionSessionModalProps {
  isOpen: boolean;
  dueWords: SavedWord[];
  onClose: () => void;
  onSessionFinished?: () => void;
}

const BATCH_SIZE = 10;

export const DueRevisionSessionModal: React.FC<DueRevisionSessionModalProps> = ({
  isOpen,
  dueWords,
  onClose,
  onSessionFinished,
}) => {
  const [batchStartIndex, setBatchStartIndex] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<{
    reviewed: number;
    strengthened: number;
    stillWeak: number;
  }>({
    reviewed: 0,
    strengthened: 0,
    stillWeak: 0,
  });
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());

  useEffect(() => {
    if (isOpen) {
      setBatchStartIndex(0);
      setCurrentIndex(0);
      setIsRevealed(false);
      setIsCompleted(false);
      setSessionResults({ reviewed: 0, strengthened: 0, stillWeak: 0 });
      setCardStartTime(Date.now());
      if (dueWords.length > 0) {
        trackDueRevisionStart(Math.min(BATCH_SIZE, dueWords.length));
      }
    }
  }, [isOpen, dueWords.length]);

  if (!isOpen || dueWords.length === 0) return null;

  const currentBatch = dueWords.slice(batchStartIndex, batchStartIndex + BATCH_SIZE);
  const totalInBatch = currentBatch.length;
  const currentItem = currentBatch[currentIndex];
  const remainingDueCount = Math.max(0, dueWords.length - (batchStartIndex + currentBatch.length));

  const handleRateCard = (grade: 'again' | 'good' | 'easy') => {
    if (!currentItem) return;

    const responseTimeMs = Date.now() - cardStartTime;
    const isCorrect = grade !== 'again';
    const isStrengthened = grade === 'good' || grade === 'easy';

    if (isStrengthened) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    // 1. Authoritative Spaced Repetition Record
    questionReviewScheduler.recordAttempt(currentItem.question, isCorrect, responseTimeMs);

    // Broadcast question solved to daily streak & targets
    triggerGlobalQuestionSolved();

    // 2. Authoritative Attempt Log
    recordAttemptEvent({
      questionId: currentItem.question.id,
      conceptKey: currentItem.question.memoryKey || currentItem.question.wordOrPhrase,
      category: currentItem.question.category,
      correct: isCorrect,
      source: 'mistake_review',
      responseTimeMs,
    });

    const nextReviewed = sessionResults.reviewed + 1;
    const nextStrengthened = sessionResults.strengthened + (isStrengthened ? 1 : 0);
    const nextStillWeak = sessionResults.stillWeak + (!isStrengthened ? 1 : 0);

    setSessionResults({
      reviewed: nextReviewed,
      strengthened: nextStrengthened,
      stillWeak: nextStillWeak,
    });

    if (currentIndex + 1 < totalInBatch) {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
      setCardStartTime(Date.now());
    } else {
      // Batch Completed!
      setIsCompleted(true);
      soundManager.playVictory();
      const accuracy = Math.round((nextStrengthened / totalInBatch) * 100);
      trackDueRevisionComplete({
        count: totalInBatch,
        strengthenedCount: nextStrengthened,
        accuracy,
      });
      if (onSessionFinished) {
        onSessionFinished();
      }
    }
  };

  const cardData: NormalizedMistakeVaultItem | null = currentItem 
    ? resolveRevisionCard(currentItem.question, currentItem) 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wide">
                Due Mistake Revision
              </h2>
              <p className="text-[11px] text-slate-400">
                {dueWords.length > BATCH_SIZE ? `Micro-Session (${totalInBatch} of ${dueWords.length} due)` : 'Spaced Repetition Flashcards'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isCompleted && (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-blue-300">
                {currentIndex + 1} / {totalInBatch}
              </span>
            )}
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!isCompleted && cardData ? (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIndex + 1) / totalInBatch) * 100}%` }}
                />
              </div>

              {/* Revision Flashcard */}
              <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                {/* Word & Category */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                      {cardData.categoryDisplay}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide mt-0.5">
                      {cardData.target}
                    </h3>
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80">
                    {cardData.mistakeCount}× Missed
                  </span>
                </div>

                {/* Target Hindi / Meaning Clue if available */}
                {(cardData.targetMeaning || cardData.targetHindiMeaning) && (
                  <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-1">
                    {cardData.targetMeaning && (
                      <p className="leading-relaxed">{cardData.targetMeaning}</p>
                    )}
                    {cardData.targetHindiMeaning && (
                      <p className="text-sky-300 font-medium">{cardData.targetHindiMeaning}</p>
                    )}
                  </div>
                )}

                {/* Reveal Answer Trigger / Answer Details */}
                {!isRevealed ? (
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      setIsRevealed(true);
                    }}
                    className="w-full py-4 rounded-xl border border-dashed border-slate-700 hover:border-blue-400/80 bg-slate-900/40 hover:bg-blue-950/20 text-blue-300 flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer group active:scale-99"
                  >
                    <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Tap to Reveal Meaning & Answer</span>
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Answer & Meaning */}
                    <div className="bg-slate-900 rounded-xl p-3.5 border border-emerald-500/40 space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                        {cardData.relation}
                      </div>
                      <div className="text-base sm:text-lg font-black text-emerald-300 tracking-wide uppercase flex items-center gap-2">
                        <span>{cardData.answer}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                      {cardData.answerMeaning && (
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          {cardData.answerMeaning}
                        </p>
                      )}
                      {cardData.answerHindiMeaning && (
                        <p className="text-xs text-amber-300/90 font-medium">
                          {cardData.answerHindiMeaning}
                        </p>
                      )}
                    </div>

                    {/* Memory Hook */}
                    {cardData.mnemonic && (
                      <div className="bg-amber-950/30 rounded-xl p-3 border border-amber-500/30 text-xs">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          💡 Memory Hook
                        </span>
                        <p className="text-slate-300 mt-1 leading-relaxed">
                          {cardData.mnemonic}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Rating Actions (Shown when revealed) */}
              {isRevealed && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pt-1"
                >
                  <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    How well did you recall this word?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleRateCard('again')}
                      className="p-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/60 hover:border-rose-400 text-rose-200 flex flex-col items-center justify-center gap-1 transition-all active:scale-97 cursor-pointer"
                    >
                      <span className="text-sm font-black">❌ Forgot</span>
                      <span className="text-[10px] text-rose-300/80 font-mono">Repeat soon</span>
                    </button>

                    <button
                      onClick={() => handleRateCard('good')}
                      className="p-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-600/60 hover:border-sky-400 text-sky-200 flex flex-col items-center justify-center gap-1 transition-all active:scale-97 cursor-pointer"
                    >
                      <span className="text-sm font-black">👍 Recalled</span>
                      <span className="text-[10px] text-sky-300/80 font-mono">+3-7 Days</span>
                    </button>

                    <button
                      onClick={() => handleRateCard('easy')}
                      className="p-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/60 hover:border-emerald-400 text-emerald-200 flex flex-col items-center justify-center gap-1 transition-all active:scale-97 cursor-pointer"
                    >
                      <span className="text-sm font-black">⭐ Mastered</span>
                      <span className="text-[10px] text-emerald-300/80 font-mono">+14-30 Days</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ) : isCompleted ? (
            /* Session Completed Screen */
            <div className="text-center py-6 space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-orange-950/60 animate-bounce">
                🏆
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
                  {remainingDueCount > 0 ? 'Batch Completed!' : 'Revision Completed!'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  {remainingDueCount > 0 
                    ? `Great focus! ${remainingDueCount} more due in queue.`
                    : 'Your spaced repetition schedule has been updated.'}
                </p>
              </div>

              {/* Outcome Metrics */}
              <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-slate-100">{sessionResults.reviewed}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Reviewed</div>
                </div>

                <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-emerald-300">{sessionResults.strengthened}</div>
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">Strengthened</div>
                </div>

                <div className="bg-rose-950/60 border border-rose-700/60 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-rose-300">{sessionResults.stillWeak}</div>
                  <div className="text-[10px] text-rose-400 uppercase font-bold">Still Weak</div>
                </div>
              </div>

              {remainingDueCount > 0 ? (
                <div className="space-y-2.5 max-w-sm mx-auto">
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      setBatchStartIndex(prev => prev + BATCH_SIZE);
                      setCurrentIndex(0);
                      setIsRevealed(false);
                      setIsCompleted(false);
                      setSessionResults({ reviewed: 0, strengthened: 0, stillWeak: 0 });
                      setCardStartTime(Date.now());
                    }}
                    className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm uppercase tracking-wide shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <span>Review {Math.min(10, remainingDueCount)} More</span>
                    <ChevronRight className="w-4 h-4 text-blue-200" />
                  </button>

                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onClose();
                  }}
                  className="w-full max-w-sm mx-auto py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm uppercase tracking-wide shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <span>Return to Arena</span>
                  <ChevronRight className="w-4 h-4 text-blue-200" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
