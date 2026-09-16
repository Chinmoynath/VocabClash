import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target,
  Swords, 
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Bookmark,
  CheckCircle2,
  Lightbulb,
  BookOpen,
  Brain,
  ShieldCheck,
  RotateCcw,
  FileText,
  ArrowLeftRight,
  BookMarked,
  MoreHorizontal
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { VocabClashLogo } from './VocabClashLogo';

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPyq?: () => void;
  onStartBattle?: () => void;
  onStartFirstMatch?: () => void;
  onOpenLogin?: () => void;
  onExploreApp?: () => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartPyq,
  onStartBattle,
  onStartFirstMatch,
  onOpenLogin,
  onExploreApp,
}) => {
  const [showDetailedExplanation, setShowDetailedExplanation] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

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

  const handleStartPyq = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    setIsDismissing(true);
    setTimeout(() => {
      if (onStartPyq) {
        onStartPyq();
      } else {
        onClose();
      }
    }, 180);
  };

  const handleStartDuel = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    setIsDismissing(true);
    setTimeout(() => {
      if (onStartBattle) {
        onStartBattle();
      } else if (onStartFirstMatch) {
        onStartFirstMatch();
      } else {
        onClose();
      }
    }, 180);
  };

  const handleLoginClick = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    setIsDismissing(true);
    setTimeout(() => {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        onClose();
      }
    }, 180);
  };

  const handleExploreMore = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    setIsDismissing(true);
    setTimeout(() => {
      if (onExploreApp) {
        onExploreApp();
      } else {
        onClose();
      }
    }, 220);
  };

  return (
    <AnimatePresence>
      <motion.div 
        id="vocabclash-first-time-landing"
        initial={{ opacity: 0, y: 15 }}
        animate={isDismissing ? { opacity: 0, y: -40, filter: 'blur(4px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-50 overflow-y-auto bg-[#050714] text-slate-100 flex flex-col justify-between selection:bg-orange-500/30 selection:text-white"
      >
        {/* Subtle Ambient Background Glows */}
        <div className="fixed top-0 right-0 w-80 sm:w-96 lg:w-[32rem] h-80 sm:h-96 lg:h-[32rem] bg-blue-600/10 blur-3xl pointer-events-none rounded-full" />
        <div className="fixed top-1/4 left-0 w-80 lg:w-[28rem] h-80 lg:h-[28rem] bg-indigo-600/10 blur-3xl pointer-events-none rounded-full" />
        <div className="fixed bottom-0 right-1/4 w-80 lg:w-[30rem] h-80 lg:h-[30rem] bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

        {/* 1. TOP HEADER BAR */}
        <header className="relative z-20 w-full border-b border-blue-950/40 bg-[#050714]/85 backdrop-blur-md shrink-0">
          <div className="max-w-xl md:max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            {/* VocabClash Brand Logo */}
            <div 
              onClick={handleExploreMore}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
              title="VocabClash • Govt Exam English Arena"
            >
              <VocabClashLogo size="sm" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shrink-0 ring-1 ring-blue-500/30 group-hover:ring-blue-400/60 transition-all" />
              <div className="flex flex-col">
                <div className="flex items-center font-black text-lg sm:text-xl tracking-wider leading-none">
                  <span className="text-white">VOCAB</span>
                  <span className="text-amber-400">CLASH</span>
                </div>
                <span className="text-[9px] sm:text-[10px] tracking-widest text-slate-400 font-bold leading-tight uppercase mt-0.5">
                  GOVT EXAM ENGLISH ARENA
                </span>
              </div>
            </div>

            {/* Login Button on Right (No Hamburger Menu per requirements) */}
            <button
              id="btn-landing-login"
              type="button"
              onClick={handleLoginClick}
              className="px-4 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold border border-slate-700/80 shadow-sm transition-all cursor-pointer select-none active:scale-95"
            >
              Login
            </button>
          </div>
        </header>

        {/* 2. MAIN HERO SECTION */}
        <main className="relative z-10 flex-1 max-w-xl md:max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col justify-start space-y-4 sm:space-y-5">
          
          {/* Headline & Handwritten Accent */}
          <div className="flex items-start justify-between gap-2 pt-1">
            <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-2xl xs:text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.14]">
                Master Govt Exam
                <span className="block">Vocabulary.</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500">
                  One PYQ at a Time.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-normal pt-1 leading-relaxed">
                Practice. Compete. Remember. Crack your exams.
              </p>
            </div>

            {/* Handwritten script badge on top right: Same Words. Stronger You. */}
            <div className="shrink-0 flex flex-col items-end pt-0.5 pr-1 select-none pointer-events-none">
              <div className="font-handwritten text-sky-400 text-lg sm:text-xl md:text-2xl font-bold leading-tight -rotate-3 text-right drop-shadow-[0_2px_8px_rgba(56,189,248,0.3)]">
                <span>Same</span>
                <span className="block">Words.</span>
                <span className="block mt-0.5">Stronger</span>
                <span className="block">You.</span>
              </div>
              {/* Curved hand-drawn accent underline stroke */}
              <svg className="w-14 sm:w-16 h-3 text-sky-400 -mt-0.5 -rotate-6" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <path d="M5 13 Q 50 19, 95 7" />
              </svg>
            </div>
          </div>

          {/* Exam Category Chips */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {['SSC', 'Banking', 'Defence', 'DSSSB'].map((examName) => (
                <span 
                  key={examName}
                  className="px-4 py-1.5 rounded-full bg-blue-950/70 border border-blue-500/40 text-blue-200 text-xs sm:text-sm font-semibold shadow-sm hover:border-blue-400/70 transition-colors select-none"
                >
                  {examName}
                </span>
              ))}
            </div>
            
            {/* Sub-exams list */}
            <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 flex-wrap font-medium select-none">
              <span>CGL</span>
              <span className="text-slate-600">•</span>
              <span>CHSL</span>
              <span className="text-slate-600">•</span>
              <span>CPO</span>
              <span className="text-slate-600">•</span>
              <span>MTS</span>
              <span className="text-slate-600">•</span>
              <span>IBPS PO</span>
              <span className="text-slate-600">•</span>
              <span>SBI PO</span>
              <span className="text-slate-600">•</span>
              <span>AFCAT</span>
              <span className="text-slate-600">•</span>
              <span>CDS</span>
              <span 
                onClick={handleStartPyq}
                className="text-sky-400 hover:text-sky-300 font-bold ml-1 cursor-pointer transition-colors"
              >
                + more
              </span>
            </div>
          </div>

          {/* 3. SAMPLE PYQ CARD */}
          <div 
            id="landing-sample-pyq-card"
            className="w-full rounded-2xl bg-[#090D24] border border-blue-900/50 p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] space-y-3 ring-1 ring-blue-500/15"
          >
            {/* Header: Exam Badge, Instruction, Bookmark & Counter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[10px] tracking-wider uppercase">
                  SSC CGL PYQ
                </span>
                <span className="text-slate-400 text-xs font-medium">
                  Select the antonym
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                <span>1/10</span>
              </div>
            </div>

            {/* Target Word */}
            <div className="text-center py-1">
              <span className="text-lg sm:text-xl font-extrabold text-white tracking-widest uppercase">
                METICULOUS
              </span>
            </div>

            {/* Options Grid (2x2) */}
            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm font-medium">
              <div className="bg-[#10152D] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 sm:py-2.5 select-none">
                A. Accurate
              </div>
              <div className="bg-emerald-950/70 border border-emerald-500 text-emerald-300 rounded-xl px-3 py-2 sm:py-2.5 font-bold flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.15)] select-none">
                <span>B. Careless</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div className="bg-[#10152D] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 sm:py-2.5 select-none">
                C. Detailed
              </div>
              <div className="bg-[#10152D] border border-slate-800 text-slate-300 rounded-xl px-3 py-2 sm:py-2.5 select-none">
                D. Strict
              </div>
            </div>

            {/* Explanation Box */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs">
              <div className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-300 leading-snug">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-200 font-medium">Meticulous = very careful and precise.</span>
                  <span className="block text-slate-400">Antonym: Careless = not giving enough attention.</span>
                  {showDetailedExplanation && (
                    <span className="block text-sky-300 text-[10px] mt-1 font-mono">
                      Origin: Latin meticulosus (fearful of making errors). SSC asks this frequently.
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailedExplanation(prev => !prev)}
                className="text-[11px] sm:text-xs text-slate-300 hover:text-white font-medium flex items-center gap-0.5 shrink-0 ml-2 cursor-pointer transition-colors"
              >
                <span>View Explanation</span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showDetailedExplanation ? 'rotate-90 text-sky-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* 4. CTA BUTTONS SECTION */}
          <div className="space-y-2.5 pt-1">
            {/* Primary Orange CTA: Start PYQ */}
            <button
              id="btn-landing-start-pyq"
              type="button"
              onClick={handleStartPyq}
              className="group relative w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-slate-950 font-black shadow-[0_8px_30px_rgba(249,115,22,0.45)] hover:shadow-[0_12px_40px_rgba(249,115,22,0.6)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between sm:justify-center gap-3 select-none"
            >
              {/* Bullseye / Target Icon */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-950/15 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 stroke-[2.5]" />
              </div>

              {/* Text */}
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-950">
                Start PYQ
              </span>

              {/* Action Circle Arrow on Right */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/20 group-hover:bg-slate-950/30 flex items-center justify-center shrink-0 transition-colors ml-auto sm:ml-0">
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Secondary CTA: Try 1v1 Duel */}
            <button
              id="btn-landing-try-duel"
              type="button"
              onClick={handleStartDuel}
              className="w-full py-2.5 sm:py-3 px-5 rounded-2xl bg-blue-950/40 hover:bg-blue-900/40 border border-sky-500/60 hover:border-sky-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98] select-none"
            >
              <Swords className="w-4 h-4 text-amber-400 stroke-[2.5]" />
              <span>Try 1v1 Duel</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Microcopy */}
            <p className="text-xs text-slate-400 text-center font-medium select-none">
              No signup required • Start instantly
            </p>
          </div>

          {/* 5. FOUR FEATURE METRICS ROW */}
          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className="flex flex-col items-center">
              <BookOpen className="w-5 h-5 text-sky-400 mb-1" />
              <span className="font-extrabold text-xs sm:text-sm text-white leading-tight">24,000+</span>
              <span className="text-[10px] sm:text-xs text-slate-400">PYQs</span>
            </div>

            <div className="flex flex-col items-center">
              <Brain className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="font-extrabold text-xs sm:text-sm text-white leading-tight">Mnemonic</span>
              <span className="text-[10px] sm:text-xs text-slate-400">Hooks</span>
            </div>

            <div className="flex flex-col items-center">
              <ShieldCheck className="w-5 h-5 text-purple-400 mb-1" />
              <span className="font-extrabold text-xs sm:text-sm text-white leading-tight">Mistake</span>
              <span className="text-[10px] sm:text-xs text-slate-400">Vault</span>
            </div>

            <div className="flex flex-col items-center">
              <RotateCcw className="w-5 h-5 text-amber-400 mb-1" />
              <span className="font-extrabold text-xs sm:text-sm text-white leading-tight">Spaced</span>
              <span className="text-[10px] sm:text-xs text-slate-400">Repetition</span>
            </div>
          </div>

          {/* 6. VOCAB CATEGORY BADGES ROW */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-xs text-slate-300 font-medium pt-3 border-t border-slate-800/60 select-none">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Synonyms
            </span>
            <span className="flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              Antonyms
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-slate-400" />
              One Word Substitution
            </span>
            <span className="flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5 text-slate-400" />
              Idioms & Phrases
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <MoreHorizontal className="w-3.5 h-3.5" />
              More
            </span>
          </div>
        </main>

        {/* 7. EXPLORE MORE FOOTER LINK */}
        <footer className="relative z-20 w-full text-center pt-2 pb-5 shrink-0 bg-[#050714]/80 backdrop-blur-sm">
          <div 
            id="landing-explore-more"
            onClick={handleExploreMore}
            className="inline-flex flex-col items-center justify-center gap-0.5 text-sky-400 hover:text-sky-300 cursor-pointer transition-colors select-none group"
            title="Enter VocabClash Arena"
          >
            <ChevronDown className="w-4 h-4 text-sky-400 group-hover:translate-y-0.5 transition-transform" />
            <span className="text-[11px] sm:text-xs font-black tracking-widest uppercase">
              EXPLORE MORE
            </span>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
