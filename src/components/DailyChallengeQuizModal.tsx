import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Award, 
  TrendingUp, 
  ChevronRight, 
  Timer, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Question, PlayerProfile, QuestionCategory } from '../types';
import { questionBankEngine } from '../services/questionBankEngine';
import { 
  DailyChallengeAttempt, 
  saveDailyChallengeAttempt, 
  getTodayDateString, 
  formatDuration 
} from '../services/dailyChallengeService';
import { soundManager } from '../utils/audio';
import { triggerGlobalQuestionSolved } from '../utils/streakManager';

interface DailyChallengeQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerProfile;
  onChallengeComplete: (attempt: DailyChallengeAttempt) => void;
  onOpenReport: () => void;
}

const TOTAL_TIME_SECONDS = 120; // 2 minutes
const TOTAL_QUESTIONS_COUNT = 20; // 20 questions

export const DailyChallengeQuizModal: React.FC<DailyChallengeQuizModalProps> = ({
  isOpen,
  onClose,
  player,
  onChallengeComplete,
  onOpenReport,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [answersLog, setAnswersLog] = useState<{ isCorrect: boolean; category: QuestionCategory }[]>([]);
  
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_TIME_SECONDS);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [finalAttempt, setFinalAttempt] = useState<DailyChallengeAttempt | null>(null);
  const [rankPointsGained, setRankPointsGained] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasSavedRef = useRef<boolean>(false);

  // Initialize questions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    hasSavedRef.current = false;
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setAnswersLog([]);
    setTimeLeft(TOTAL_TIME_SECONDS);
    setIsFinished(false);
    setFinalAttempt(null);
    setRankPointsGained(0);
    startTimeRef.current = Date.now();

    // Fetch 20 high-yield deterministic questions for today's daily challenge
    const todayStr = getTodayDateString();
    const pool = questionBankEngine.getDailyChallengeQuestions(
      todayStr,
      (player.targetExam as any) || 'ALL'
    );
    setQuestions(pool);
  }, [isOpen, player.targetExam]);

  // Handle countdown timer
  useEffect(() => {
    if (!isOpen || isFinished || questions.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleFinishQuiz();
          return 0;
        }
        // Warning sound when time is running out (< 10s)
        if (prev === 10) {
          soundManager.playWarning();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, isFinished, questions.length]);

  // Finish quiz handler
  const handleFinishQuiz = () => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;
    setIsFinished(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const timeSpent = Math.min(
      TOTAL_TIME_SECONDS,
      Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
    );

    // Calculate score & accuracy
    const correctCount = answersLog.filter(a => a.isCorrect).length;
    const answeredCount = answersLog.length;
    const wrongCount = answeredCount - correctCount;
    const score = correctCount; // 1 mark per correct answer out of 20
    const maxMarks = TOTAL_QUESTIONS_COUNT;
    const percentage = Math.round((correctCount / TOTAL_QUESTIONS_COUNT) * 100 * 10) / 10;

    const attempt: DailyChallengeAttempt = {
      date: getTodayDateString(),
      timestamp: Date.now(),
      totalQuestions: TOTAL_QUESTIONS_COUNT,
      answeredCount,
      correctCount,
      wrongCount,
      score,
      maxMarks,
      percentage,
      timeTakenSeconds: timeSpent,
    };

    const { rankPointsGained: lp } = saveDailyChallengeAttempt(attempt, player);
    setFinalAttempt(attempt);
    setRankPointsGained(lp);
    onChallengeComplete(attempt);

    if (percentage >= 50) {
      soundManager.playVictory();
    } else {
      soundManager.playDefeat();
    }
  };

  // Option selection
  const handleSelectOption = (index: number) => {
    if (isAnswerRevealed || isFinished) return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setSelectedOption(index);
    setIsAnswerRevealed(true);

    // Broadcast solve so daily streak and targets update instantly across app & devices
    triggerGlobalQuestionSolved();

    const isCorrect = index === currentQ.correctIndex;
    if (isCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }

    const updatedLog = [
      ...answersLog,
      { isCorrect, category: currentQ.category },
    ];
    setAnswersLog(updatedLog);

    // Auto-advance swiftly to next question after 450ms
    setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        handleFinishQuiz();
      } else {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswerRevealed(false);
      }
    }, 450);
  };

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex];
  const timerPercentage = (timeLeft / TOTAL_TIME_SECONDS) * 100;
  const isTimerCritical = timeLeft <= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Active Quiz Screen */}
        {!isFinished && currentQuestion ? (
          <>
            {/* Top Bar with Timer & Progress */}
            <div className="p-4 bg-slate-850/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
                  Q{currentIndex + 1}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                    <span>Daily Challenge</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({currentIndex + 1}/{TOTAL_QUESTIONS_COUNT})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    {currentQuestion.category} • {currentQuestion.exam || 'SSC / PYQ'}
                  </div>
                </div>
              </div>

              {/* 2-Min Countdown Timer */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-black text-xs border transition-all ${
                  isTimerCritical 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse' 
                    : timeLeft <= 60 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                    : 'bg-slate-800 text-emerald-400 border-slate-700'
                }`}>
                  <Timer className="w-3.5 h-3.5" />
                  <span>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm('Leave daily challenge? Your score will be calculated from answered questions.')) {
                      handleFinishQuiz();
                    }
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center"
                  aria-label="Exit"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Time Bar Progress Indicator */}
            <div className="w-full bg-slate-950 h-1.5 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  isTimerCritical ? 'bg-rose-500' : timeLeft <= 60 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${timerPercentage}%` }}
              />
            </div>

            {/* Question Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Question Instruction & Word/Prompt */}
              <div className="bg-slate-850/80 border border-slate-800/90 rounded-2xl p-4 sm:p-5 text-center space-y-2">
                <span className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider block">
                  {currentQuestion.instruction || `Select the correct answer for the ${currentQuestion.category}:`}
                </span>
                
                <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-wide font-serif">
                  {currentQuestion.wordOrPhrase || currentQuestion.question}
                </h3>

                {currentQuestion.hindiMeaning && (
                  <p className="text-xs text-slate-400 font-medium">
                    ({currentQuestion.hindiMeaning})
                  </p>
                )}
              </div>

              {/* 4 Options */}
              <div className="space-y-2.5">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQuestion.correctIndex;
                  
                  let btnStyle = 'bg-slate-850/70 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700';
                  
                  if (isAnswerRevealed) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-500/20 border-emerald-500/80 text-emerald-200 font-bold shadow-md shadow-emerald-500/10';
                    } else if (isSelected) {
                      btnStyle = 'bg-rose-500/20 border-rose-500/80 text-rose-200 font-bold';
                    } else {
                      btnStyle = 'bg-slate-850/30 border-slate-800/50 text-slate-500 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={isAnswerRevealed}
                      className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-[11px] font-mono font-bold text-slate-300 shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="truncate">{option}</span>
                      </div>

                      {isAnswerRevealed && (
                        <div className="shrink-0">
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : isSelected ? (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Micro Live Tracker */}
            <div className="p-3 bg-slate-850/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold font-mono">
                  {answersLog.filter(a => a.isCorrect).length} Correct
                </span>
                <span>•</span>
                <span className="text-rose-400 font-bold font-mono">
                  {answersLog.filter(a => !a.isCorrect).length} Wrong
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Auto-advances on answer
              </div>
            </div>
          </>
        ) : (
          /* Finished / Completion Summary Screen */
          finalAttempt && (
            <div className="p-5 sm:p-7 space-y-5 text-center">
              {/* Header Icon */}
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/5 animate-bounce">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                  Daily Challenge Completed!
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Today&apos;s 2-minute drill recorded successfully
                </p>
              </div>

              {/* Marks & Percentage Cards as requested */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-850/90 border border-amber-500/40 rounded-2xl p-3 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Score / Marks
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-mono mt-0.5">
                    {finalAttempt.score} / {finalAttempt.maxMarks}
                  </div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    {finalAttempt.correctCount} of 20 correct
                  </div>
                </div>

                <div className="bg-slate-850/90 border border-emerald-500/40 rounded-2xl p-3 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Accuracy Rate
                  </div>
                  <div className="text-2xl font-black text-emerald-300 font-mono mt-0.5">
                    {finalAttempt.percentage}%
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">
                    {finalAttempt.percentage >= 70 ? '🌟 Excellent' : '👍 Good Effort'}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-slate-850/90 border border-sky-500/40 rounded-2xl p-3 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Time Taken
                  </div>
                  <div className="text-2xl font-black text-sky-300 font-mono mt-0.5">
                    {formatDuration(finalAttempt.timeTakenSeconds)}
                  </div>
                  <div className="text-[10px] text-sky-400/80 mt-0.5">
                    of 2m 00s
                  </div>
                </div>
              </div>

              {/* Rank Points Boost Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-slate-200">Daily Rank Points Bonus:</span>
                </div>
                <span className="font-mono font-black text-amber-400 text-sm">
                  +{rankPointsGained} LP
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onClose();
                    onOpenReport();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>View Performance Report (Line Graph)</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                >
                  Back to Ranks
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
