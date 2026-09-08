import React, { useState } from 'react';
import { 
  Swords, 
  BookOpen, 
  Brain, 
  Lightbulb, 
  RotateCcw, 
  ChevronRight, 
  Zap,
  CheckCircle2,
  ShieldAlert,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  LogIn,
  Trophy,
  Compass
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { VocabClashLogo } from './VocabClashLogo';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBattle?: () => void;
  onStartFirstMatch?: () => void;
  onOpenLogin?: () => void;
  onExploreApp?: () => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartBattle,
  onStartFirstMatch,
  onOpenLogin,
  onExploreApp,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

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
    if (onExploreApp) {
      onExploreApp();
    } else {
      onClose();
    }
  };

  const handleLoginClick = () => {
    soundManager.playTap();
    markSeenAndDismiss();
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      onClose();
    }
  };

  return (
    <div 
      id="vocabclash-first-time-landing"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#050714] text-slate-100 flex flex-col justify-between selection:bg-orange-500/30 selection:text-white"
    >
      {/* Ambient background glows matching pic 2 */}
      <div className="fixed top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/10 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed -top-10 left-0 w-80 h-80 bg-indigo-600/10 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-80 h-80 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* TOP HEADER BAR (Logo on left, Login + Hamburger Menu on right) */}
      <header className="relative z-20 w-full border-b border-blue-950/40 bg-[#050714]/80 backdrop-blur-md">
        <div className="max-w-xl md:max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between">
          {/* VocabClash Logo (Brand untouched as instructed: "don't change the logo") */}
          <div 
            onClick={handleSkip}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
            title="VocabClash • Govt Exam Arena"
          >
            <VocabClashLogo size="sm" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shrink-0 ring-1 ring-blue-500/30 group-hover:ring-blue-400/60 transition-all" />
            <div className="flex flex-col">
              <span className="font-black text-lg sm:text-xl tracking-wider text-sky-400 group-hover:text-sky-300 transition-colors leading-none">
                VOCABCLASH
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-widest text-slate-400 font-bold leading-tight uppercase mt-0.5">
                GOVT EXAM ARENA
              </span>
            </div>
          </div>

          {/* Action buttons on right (Login + Hamburger Menu) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-landing-login"
              onClick={handleLoginClick}
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold border border-slate-700/70 shadow-sm transition-all cursor-pointer"
            >
              Login
            </button>
            <button
              id="btn-landing-menu"
              onClick={() => {
                soundManager.playTap();
                setIsMenuOpen(!isMenuOpen);
              }}
              aria-label="Navigation Menu"
              className="p-1.5 sm:p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              )}
            </button>
          </div>
        </div>

        {/* Slide-down Hamburger Menu */}
        {isMenuOpen && (
          <div className="w-full bg-[#090D24] border-b border-blue-900/50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-w-xl md:max-w-2xl mx-auto px-4 py-3 space-y-1.5 text-sm">
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-amber-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Swords className="w-4 h-4 text-amber-400" />
                  Play 1v1 Battle
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-sky-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  Practice 24,000+ PYQs
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-purple-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  Mistake Vault
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={handleLoginClick}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-white transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  Login / Cloud Sync
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-300 hover:text-white transition-colors font-medium cursor-pointer text-left border-t border-slate-800/80 pt-2.5 mt-1"
              >
                <span className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4 text-slate-400" />
                  Explore Full App
                </span>
                <span className="text-xs text-sky-400 font-semibold">Enter →</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN HERO & CENTRAL DUEL SECTION */}
      <main className="relative z-10 flex-1 max-w-xl md:max-w-2xl mx-auto w-full px-4 sm:px-6 pt-5 sm:pt-7 pb-4 flex flex-col justify-center">
        
        {/* HERO TITLE & CALLOUT HEADER (Two-column layout matching Pic 2) */}
        <div className="flex items-start justify-between gap-3">
          {/* Left Column: Heading + Subtitle + Category Pills */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <h1 className="text-2xl xs:text-3xl sm:text-4xl font-black text-white tracking-tight leading-[1.15]">
              Master English.
              <span className="block text-[#FF7A29] bg-gradient-to-r from-amber-400 via-orange-500 to-[#FF7A29] bg-clip-text text-transparent">
                One Duel at a Time.
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 font-normal leading-relaxed pt-0.5">
              Practice. Compete. Remember. Crack your exams.
            </p>

            {/* Exam Category Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 pt-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
                SSC
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
                Banking
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
                Railways
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-800/40 text-blue-300/80 text-xs font-medium hover:border-blue-400 transition-colors">
                + more
              </span>
            </div>
          </div>

          {/* Right Column: Handwritten/Cursive script "Same Words. Stronger You." (Matching Pic 2) */}
          <div className="shrink-0 flex flex-col items-end justify-center font-handwritten text-sky-400 text-lg xs:text-xl sm:text-2xl font-bold leading-tight -rotate-3 select-none pr-1 drop-shadow-[0_2px_8px_rgba(56,189,248,0.25)]">
            <span>Same</span>
            <span>Words.</span>
            <span className="mt-0.5">Stronger</span>
            <span>You.</span>
          </div>
        </div>

        {/* CENTRAL DUEL ARENA CARD MOCKUP (Pixel-perfect fidelity to Pic 2) */}
        <div 
          id="landing-hero-duel-card"
          className="relative rounded-2xl bg-[#090D22] border border-blue-900/40 p-3 sm:p-4 shadow-[0_12px_45px_rgba(0,0,0,0.6)] mt-4 space-y-2.5 ring-1 ring-blue-500/15"
        >
          {/* Top Player vs Rival Bar */}
          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold px-1">
            {/* Player You (Amber) */}
            <div className="flex items-center gap-1.5 text-amber-400">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-[11px] shrink-0">
                👨‍💼
              </div>
              <span className="font-bold">You</span>
              <span className="text-[10px] sm:text-xs text-amber-300/80 font-mono">1,840 LP</span>
            </div>

            {/* Central VS Badge */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-sky-500/20 border border-indigo-400/30 text-[11px] font-black tracking-wider text-indigo-100 shrink-0">
              <span className="text-amber-400">⚔️</span>
              <span className="font-mono">VS</span>
            </div>

            {/* Rival Aspirant (Sky Blue) */}
            <div className="flex items-center gap-1.5 text-sky-400">
              <span className="font-bold">Rival Aspirant</span>
              <span className="text-[10px] sm:text-xs text-sky-300/80 font-mono">1,815 LP</span>
              <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-[11px] shrink-0">
                👤
              </div>
            </div>
          </div>

          {/* Central Question Box */}
          <div className="bg-[#0B1021] rounded-xl p-3 border border-blue-900/30 text-center space-y-1.5 shadow-inner">
            {/* Question Exam Tags */}
            <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                SSC CGL PYQ
              </span>
              <span className="text-amber-300 tracking-wider">
                SELECT ANTONYM
              </span>
            </div>

            {/* Target Vocabulary Word */}
            <div className="text-base sm:text-lg font-black text-white tracking-wider pt-0.5">
              METICULOUS
            </div>

            {/* Hindi & English Meaning */}
            <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
              Meaning: अति सावधान / सतर्क (Careful & precise)
            </div>

            {/* 4 Option Buttons (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] sm:text-xs font-medium text-left">
              <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5">
                A. Accurate
              </div>
              <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 rounded-lg px-2.5 py-1.5 font-bold flex items-center justify-between shadow-sm">
                <span>B. Careless</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5">
                C. Detailed
              </div>
              <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5">
                D. Strict
              </div>
            </div>
          </div>

          {/* Footer of Duel Card: LP Combo & Score Status */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              +120 LP (2x Combo Streak)
            </span>
            <span className="text-slate-400">Score: 480 vs 360</span>
          </div>
        </div>

        {/* PRIMARY CTA ACTION BUTTON (Vibrant rich orange gradient matching Pic 2) */}
        <div className="mt-4 sm:mt-5 space-y-2 text-center">
          <button
            id="btn-landing-play-first-duel"
            onClick={handleStart}
            className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/25 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Swords className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            <span>Play Your First Duel</span>
            <ChevronRight className="w-5 h-5 text-slate-950 stroke-[3]" />
          </button>

          {/* Microcopy Trust Subtext directly under button */}
          <p className="text-xs sm:text-sm text-slate-400 font-normal">
            10 questions • ~2 minutes • No signup required
          </p>
        </div>

        {/* HORIZONTAL 4-COLUMN FEATURE ROW (Matching Pic 2) */}
        <div className="grid grid-cols-4 gap-2 text-center mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800/60">
          {/* 1. 24,000+ PYQs */}
          <div className="flex flex-col items-center">
            <BookOpen className="w-5 h-5 text-blue-400 mb-1" />
            <span className="font-bold text-xs sm:text-sm text-white leading-tight">24,000+</span>
            <span className="text-[10px] sm:text-xs text-slate-400">PYQs</span>
          </div>

          {/* 2. Mnemonic Hooks */}
          <div className="flex flex-col items-center">
            <Lightbulb className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="font-bold text-xs sm:text-sm text-white leading-tight">Mnemonic</span>
            <span className="text-[10px] sm:text-xs text-slate-400">Hooks</span>
          </div>

          {/* 3. Mistake Vault */}
          <div className="flex flex-col items-center">
            <ShieldAlert className="w-5 h-5 text-purple-400 mb-1" />
            <span className="font-bold text-xs sm:text-sm text-white leading-tight">Mistake</span>
            <span className="text-[10px] sm:text-xs text-slate-400">Vault</span>
          </div>

          {/* 4. Spaced Repetition */}
          <div className="flex flex-col items-center">
            <RotateCcw className="w-5 h-5 text-indigo-400 mb-1" />
            <span className="font-bold text-xs sm:text-sm text-white leading-tight">Spaced</span>
            <span className="text-[10px] sm:text-xs text-slate-400">Repetition</span>
          </div>
        </div>
      </main>

      {/* BOTTOM "EXPLORE MORE" SECTION WITH DOWN CHEVRON (Matching Pic 2) */}
      <footer className="relative z-10 w-full text-center py-3 pb-4 sm:pb-6">
        <button
          id="btn-landing-explore-more"
          onClick={handleSkip}
          className="inline-flex flex-col items-center justify-center gap-1 text-sky-400/90 hover:text-sky-300 transition-colors cursor-pointer group"
        >
          <ChevronDown className="w-4 h-4 text-sky-400 group-hover:translate-y-0.5 transition-transform animate-bounce" />
          <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase">
            EXPLORE MORE
          </span>
        </button>
      </footer>
    </div>
  );
};
