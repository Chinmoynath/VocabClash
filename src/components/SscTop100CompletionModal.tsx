import React from 'react';
import {
  Trophy,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Flame,
  Award,
  ShieldCheck
} from 'lucide-react';
import { SscTop100Category, SSC_TOP_100_CATEGORIES } from '../data/sscTop100';
import { soundManager } from '../utils/audio';

interface SscTop100CompletionModalProps {
  category: SscTop100Category;
  score?: number;
  accuracy?: number;
  mistakeCount?: number;
  totalSolved?: number;
  correctCount?: number;
  totalQuestions?: number;
  onRetake?: () => void;
  onRestartCategory?: () => void;
  onReviewMistakes?: () => void;
  onNavigateToMistakes?: () => void;
  onReturnToArena?: () => void;
  onClose: () => void;
}

export const SscTop100CompletionModal: React.FC<SscTop100CompletionModalProps> = ({
  category,
  score,
  accuracy: passedAccuracy,
  mistakeCount: passedMistakeCount,
  totalSolved,
  correctCount = 0,
  totalQuestions = 100,
  onRetake,
  onRestartCategory,
  onReviewMistakes,
  onNavigateToMistakes,
  onReturnToArena,
  onClose,
}) => {
  const catInfo = SSC_TOP_100_CATEGORIES.find(c => c.id === category);
  const total = totalSolved || totalQuestions;
  const effectiveMistakes = passedMistakeCount !== undefined ? passedMistakeCount : Math.max(0, total - correctCount);
  const effectiveAccuracy = passedAccuracy !== undefined ? passedAccuracy : Math.round(((total - effectiveMistakes) / total) * 100);
  const effectiveCorrect = total - effectiveMistakes;

  const handleRetake = () => {
    soundManager.playTap();
    if (onRestartCategory) {
      onRestartCategory();
    } else if (onRetake) {
      onRetake();
    }
  };

  const handleMistakes = () => {
    soundManager.playTap();
    if (onReviewMistakes) {
      onReviewMistakes();
    } else if (onNavigateToMistakes) {
      onNavigateToMistakes();
    }
  };

  const handleHome = () => {
    soundManager.playTap();
    if (onReturnToArena) {
      onReturnToArena();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center">
        {/* Glow effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Trophy Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 animate-bounce">
          <Trophy className="w-10 h-10 text-slate-950 stroke-[2.2]" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
          <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          SSC TOP 100 MASTERED
        </div>

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Drill Completed!
        </h2>
        <p className="text-sm font-semibold text-amber-400 mt-0.5">
          {catInfo?.title} ({catInfo?.hindiTitle})
        </p>
        <p className="text-xs text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
          You conquered all 100 high-frequency PYQs asked across SSC CGL, CHSL, CPO & MTS!
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Score
            </div>
            <div className="text-xl font-black text-amber-300 mt-0.5">
              {effectiveCorrect}/{total}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Accuracy
            </div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {effectiveAccuracy}%
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mistakes
            </div>
            <div className="text-xl font-black text-rose-400 mt-0.5">
              {effectiveMistakes}
            </div>
          </div>
        </div>

        {/* Benefits Note */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-850 border border-slate-800 text-left text-xs text-slate-300 mb-6">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            Every question has been tracked into your <strong>Daily Target</strong>,{' '}
            <strong>Mistake Vault</strong>, and <strong>Vocab Mentor</strong> analytics.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {effectiveMistakes > 0 && (onReviewMistakes || onNavigateToMistakes) && (
            <button
              onClick={handleMistakes}
              className="w-full py-3 px-4 bg-gradient-to-r from-rose-950 to-red-900 hover:from-rose-900 hover:to-red-850 border border-rose-600/60 text-rose-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Review {effectiveMistakes} Mistakes in Mistake Vault
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleRetake}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Retake Drill
            </button>

            <button
              onClick={handleHome}
              className="py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg transition-all"
            >
              Arena Home
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
