import React from 'react';
import { 
  Swords, 
  BookOpen, 
  Bot, 
  Brain, 
  Lightbulb, 
  RotateCcw, 
  X, 
  ChevronRight, 
  Sparkles,
  Zap,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { VocabClashLogo } from './VocabClashLogo';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBattle?: () => void;
  onStartFirstMatch?: () => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartBattle,
  onStartFirstMatch,
}) => {
  if (!isOpen) return null;

  const markSeenAndDismiss = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vocabclash_onboarding_seen_v1', 'true');
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleStart = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    if (onStartBattle) {
      onStartBattle();
    } else if (onStartFirstMatch) {
      onStartFirstMatch();
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    onClose();
  };

  const features = [
    {
      icon: <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      title: '1v1 Vocab Duels',
      subtitle: 'Challenge real players',
      bgGlow: 'from-amber-500/10 to-transparent border-amber-500/30 text-amber-300',
    },
    {
      icon: <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      title: '24,000+ PYQs',
      subtitle: 'Practice exam-level questions',
      bgGlow: 'from-sky-500/10 to-transparent border-sky-500/30 text-sky-300',
    },
    {
      icon: <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
      title: 'AI Tutor',
      subtitle: 'Instant explanations & guidance',
      bgGlow: 'from-indigo-500/10 to-transparent border-indigo-500/30 text-indigo-300',
    },
    {
      icon: <Brain className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      title: 'Mistake Vault',
      subtitle: 'Never repeat the same mistake',
      bgGlow: 'from-rose-500/10 to-transparent border-rose-500/30 text-rose-300',
    },
    {
      icon: <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      title: 'Mnemonic Hooks',
      subtitle: 'Remember difficult words easily',
      bgGlow: 'from-emerald-500/10 to-transparent border-emerald-500/30 text-emerald-300',
    },
    {
      icon: <RotateCcw className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
      title: 'Spaced Repetition',
      subtitle: 'Revise at the right time',
      bgGlow: 'from-purple-500/10 to-transparent border-purple-500/30 text-purple-300',
    },
  ];

  return (
    <div 
      id="vocabclash-onboarding-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="vocabclash-onboarding-card"
        className="relative w-full max-w-md bg-gradient-to-b from-[#131629] via-[#0d1021] to-[#090b17] border border-indigo-500/30 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.2)] overflow-hidden flex flex-col max-h-[95vh] text-slate-100"
      >
        {/* Subtle Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-600/20 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-2xl pointer-events-none rounded-full" />

        {/* Top Floating Close Button */}
        <button
          id="btn-onboarding-close"
          onClick={handleSkip}
          aria-label="Close intro"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700/60 shadow-sm"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable / Flexible Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-3.5">
          
          {/* Header & Main Message */}
          <div className="text-center space-y-1.5 pt-1">
            {/* Mini Brand Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 text-[10px] font-semibold text-indigo-300 tracking-wide uppercase shadow-sm">
              <VocabClashLogo size="sm" className="w-3.5 h-3.5 rounded-md" />
              <span>VocabClash • Govt Exam Arena</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight pt-0.5">
              Master English. <br className="hidden xs:inline" />
              <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-orange-400 bg-clip-text text-transparent">
                One Duel at a Time.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xs text-slate-300/90 font-medium leading-relaxed max-w-xs mx-auto">
              Learn smarter. Practice with purpose. Remember what you learn.
            </p>
          </div>

          {/* HERO VISUAL: 1v1 Vocab Duel Arena Card */}
          <div 
            id="onboarding-hero-duel"
            className="relative bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3 shadow-inner overflow-hidden space-y-2.5"
          >
            {/* Top Match Bar with Two Opponents & VS */}
            <div className="flex items-center justify-between text-[11px] font-semibold px-1">
              {/* Player 1 (You) */}
              <div className="flex items-center gap-1.5 text-amber-400 min-w-0">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[11px] shrink-0">
                  👨‍💼
                </div>
                <div className="truncate">
                  <span className="font-bold">You</span>
                  <span className="text-[9px] text-amber-300/70 ml-1 font-mono">1,840 LP</span>
                </div>
              </div>

              {/* VS & Round Badge */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-sky-500/20 border border-indigo-400/30 text-[10px] font-black tracking-wider text-indigo-200 shrink-0">
                <span className="text-amber-400">⚔️</span>
                <span className="font-mono">VS</span>
                <span className="text-[9px] text-slate-400 font-normal">• 9s left</span>
              </div>

              {/* Player 2 (Rival) */}
              <div className="flex items-center gap-1.5 text-sky-400 min-w-0 justify-end">
                <div className="truncate text-right">
                  <span className="font-bold">Rival Aspirant</span>
                  <span className="text-[9px] text-sky-300/70 ml-1 font-mono">1,815 LP</span>
                </div>
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-[11px] shrink-0">
                  🎯
                </div>
              </div>
            </div>

            {/* Question Snippet Tile */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-center relative">
              <div className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1">
                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">SSC CGL PYQ</span>
                <span>Select ANTONYM</span>
              </div>
              <div className="text-sm sm:text-base font-black text-white tracking-wide">
                METICULOUS
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Meaning: अति सावधान / सतर्क (Careful & precise)
              </div>

              {/* 2x2 Mini Options Grid Preview */}
              <div className="grid grid-cols-2 gap-1.5 mt-2 text-[10px] font-medium text-left">
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-400">
                  A. Accurate
                </div>
                <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-lg px-2 py-1 text-emerald-300 font-bold flex items-center justify-between shadow-sm">
                  <span>B. Careless</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-400">
                  C. Detailed
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-400">
                  D. Strict
                </div>
              </div>
            </div>

            {/* Mini Progress & Combo Status */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                +120 LP (2x Combo Streak)
              </span>
              <span className="text-slate-400">Score: 480 vs 360</span>
            </div>
          </div>

          {/* CORE FEATURES GRID: Compact, minimal, elegant cards */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {features.map((feat, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-900/60 hover:bg-slate-850/80 border rounded-xl p-2 transition-all flex flex-col justify-between ${feat.bgGlow}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="p-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                      {feat.icon}
                    </div>
                    <span className="text-[11px] font-bold text-white leading-tight truncate">
                      {feat.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {feat.subtitle}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA SECTION: Bottom action */}
          <div className="pt-1 text-center space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Ready to start?
            </div>

            {/* Primary Action Button */}
            <button
              id="btn-onboarding-start-learning"
              onClick={handleStart}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Play First Duel (10 Qs)</span>
              <ChevronRight className="w-4 h-4 text-slate-950 stroke-[3]" />
            </button>

            {/* Secondary Skip Option */}
            <button
              id="btn-onboarding-skip"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium py-1 px-4 rounded-lg"
            >
              Skip
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
