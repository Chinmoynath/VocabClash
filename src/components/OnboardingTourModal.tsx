import React, { useState, useRef } from 'react';
import { motion, useDragControls, PanInfo } from 'motion/react';
import { 
  Swords, 
  BookOpen, 
  Lightbulb, 
  RotateCcw, 
  Zap,
  CheckCircle2,
  ShieldAlert,
  Menu,
  X,
  ChevronUp,
  ArrowRight,
  ChevronRight,
  LogIn,
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
  const [isSlidingUp, setIsSlidingUp] = useState<boolean>(false);
  const dragControls = useDragControls();
  const touchStartY = useRef<number | null>(null);

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

  const handleSlideUpDismiss = () => {
    if (isSlidingUp) return;
    soundManager.playTap();
    markSeenAndDismiss();
    setIsSlidingUp(true);
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

  // Shared Sub-components for Clean Responsive Multi-Screen Layout
  const renderExamPills = () => (
    <div className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap">
      <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
        SSC
      </span>
      <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
        Banking
      </span>
      <span className="px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-200 text-xs font-semibold shadow-sm hover:border-blue-400 transition-colors">
        Defence
      </span>
      <span className="px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-800/40 text-blue-300/80 text-xs font-medium hover:border-blue-400 transition-colors">
        + more
      </span>
    </div>
  );

  const renderHandwrittenBadge = (isDesktop = false) => (
    <div className={`font-handwritten text-sky-400 select-none drop-shadow-[0_2px_8px_rgba(56,189,248,0.25)] ${
      isDesktop 
        ? 'text-xl xl:text-2xl font-bold -rotate-2 shrink-0' 
        : 'shrink-0 flex flex-col items-end justify-center text-lg xs:text-xl sm:text-2xl font-bold leading-tight -rotate-3 pr-1'
    }`}>
      {isDesktop ? (
        <span>Same Words. Stronger You.</span>
      ) : (
        <>
          <span>Same</span>
          <span>Words.</span>
          <span className="mt-0.5">Stronger</span>
          <span>You.</span>
        </>
      )}
    </div>
  );

  const renderCtaSection = (isDesktop = false) => (
    <div className={`space-y-2.5 ${isDesktop ? 'pt-2' : 'mt-4 sm:mt-5'} text-center ${isDesktop ? 'lg:text-left' : ''}`}>
      <button
        id={isDesktop ? 'btn-landing-play-first-duel-pc' : 'btn-landing-play-first-duel'}
        onClick={(e) => {
          e.stopPropagation();
          handleStart();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`group relative w-full ${isDesktop ? 'lg:w-auto lg:min-w-[340px] lg:px-8' : ''} py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-black border-t-2 border-amber-200/90 border-b-[5px] border-amber-800 shadow-[0_8px_25px_rgba(245,158,11,0.4)] hover:shadow-[0_12px_32px_rgba(245,158,11,0.55)] hover:brightness-105 active:translate-y-1 active:border-b-[2px] active:shadow-md transition-all duration-150 cursor-pointer flex items-center justify-between sm:justify-center gap-3 select-none`}
      >
        {/* 3D button sheen / highlight layer */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-xl pointer-events-none" />

        {/* Swords Icon Badge on Left */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-950/15 border border-slate-950/10 flex items-center justify-center shrink-0 shadow-inner">
          <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
        </div>

        {/* Button Text */}
        <span className="text-base sm:text-lg font-black tracking-tight text-slate-950 whitespace-nowrap drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
          Play Your First Duel
        </span>

        {/* Arrow After It - Distinct Circular Action Badge with forward nudge */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/20 group-hover:bg-slate-950/30 flex items-center justify-center shrink-0 transition-colors shadow-sm ml-auto sm:ml-0">
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      <p className="text-xs sm:text-sm text-slate-400 font-normal">
        10 questions • ~2 minutes • No signup required
      </p>
    </div>
  );

  const renderFeaturesRow = (isDesktop = false) => (
    <div className={`grid grid-cols-4 gap-2 text-center ${isDesktop ? 'pt-4 border-t border-slate-800/80 max-w-lg' : 'mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800/60'}`}>
      <div className="flex flex-col items-center">
        <BookOpen className="w-5 h-5 text-blue-400 mb-1" />
        <span className="font-bold text-xs sm:text-sm text-white leading-tight">24,000+</span>
        <span className="text-[10px] sm:text-xs text-slate-400">PYQs</span>
      </div>

      <div className="flex flex-col items-center">
        <Lightbulb className="w-5 h-5 text-emerald-400 mb-1" />
        <span className="font-bold text-xs sm:text-sm text-white leading-tight">Mnemonic</span>
        <span className="text-[10px] sm:text-xs text-slate-400">Hooks</span>
      </div>

      <div className="flex flex-col items-center">
        <ShieldAlert className="w-5 h-5 text-purple-400 mb-1" />
        <span className="font-bold text-xs sm:text-sm text-white leading-tight">Mistake</span>
        <span className="text-[10px] sm:text-xs text-slate-400">Vault</span>
      </div>

      <div className="flex flex-col items-center">
        <RotateCcw className="w-5 h-5 text-indigo-400 mb-1" />
        <span className="font-bold text-xs sm:text-sm text-white leading-tight">Spaced</span>
        <span className="text-[10px] sm:text-xs text-slate-400">Repetition</span>
      </div>
    </div>
  );

  const renderDuelCard = () => (
    <div 
      id="landing-hero-duel-card"
      onPointerDown={(e) => e.stopPropagation()}
      className="relative w-full max-w-md xl:max-w-lg rounded-2xl bg-[#090D22] border border-blue-900/40 p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] space-y-2.5 ring-1 ring-blue-500/15"
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
      <div className="bg-[#0B1021] rounded-xl p-3 sm:p-3.5 border border-blue-900/30 text-center space-y-2 shadow-inner">
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
        <div className="text-lg sm:text-xl font-black text-white tracking-wider py-0.5">
          METICULOUS
        </div>

        {/* 4 Option Buttons (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-xs font-medium text-left">
          <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 sm:py-2">
            A. Accurate
          </div>
          <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 rounded-lg px-2.5 py-1.5 sm:py-2 font-bold flex items-center justify-between shadow-sm">
            <span>B. Careless</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 sm:py-2">
            C. Detailed
          </div>
          <div className="bg-[#11162B] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 sm:py-2">
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
  );

  return (
    <motion.div 
      id="vocabclash-first-time-landing"
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: -1000, bottom: 0 }}
      dragElastic={{ top: 1, bottom: 0.08 }}
      dragDirectionLock
      onDragEnd={(_e, info: PanInfo) => {
        // If pulled upward by > 60px or flicked upward with velocity
        if (info.offset.y < -60 || info.velocity.y < -160) {
          handleSlideUpDismiss();
        }
      }}
      animate={isSlidingUp ? { y: '-100%' } : { y: 0 }}
      transition={
        isSlidingUp 
          ? { duration: 0.38, ease: [0.22, 1, 0.36, 1] } 
          : { type: 'spring', damping: 26, stiffness: 280, mass: 0.8 }
      }
      onAnimationComplete={() => {
        if (isSlidingUp) {
          if (onExploreApp) {
            onExploreApp();
          } else {
            onClose();
          }
        }
      }}
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchStartY.current !== null) {
          const deltaY = touchStartY.current - e.changedTouches[0].clientY;
          // Swiped upward by > 60px
          if (deltaY > 60) {
            handleSlideUpDismiss();
          }
          touchStartY.current = null;
        }
      }}
      onWheel={(e) => {
        // Scrolled downward with mouse wheel to slide up
        if (e.deltaY > 40) {
          handleSlideUpDismiss();
        }
      }}
      onPointerDown={(e) => {
        // Allow dragging from empty backdrop areas
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('a') && !target.closest('#landing-hero-duel-card')) {
          dragControls.start(e);
        }
      }}
      className="fixed inset-0 z-50 overflow-hidden bg-[#050714] text-slate-100 flex flex-col justify-between selection:bg-orange-500/30 selection:text-white border-b-2 border-sky-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
    >
      {/* Ambient background glows */}
      <div className="fixed top-0 right-0 w-72 sm:w-96 lg:w-[32rem] h-72 sm:h-96 lg:h-[32rem] bg-blue-600/10 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed -top-10 left-0 w-80 lg:w-[30rem] h-80 lg:h-[30rem] bg-indigo-600/10 blur-3xl pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-80 lg:w-[28rem] h-80 lg:h-[28rem] bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* TOP HEADER BAR */}
      <header className="relative z-20 w-full border-b border-blue-950/40 bg-[#050714]/80 backdrop-blur-md">
        <div className="max-w-xl md:max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          {/* VocabClash Logo */}
          <div 
            onClick={handleSlideUpDismiss}
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
              onClick={(e) => {
                e.stopPropagation();
                handleLoginClick();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold border border-slate-700/70 shadow-sm transition-all cursor-pointer"
            >
              Login
            </button>
            <button
              id="btn-landing-menu"
              onClick={(e) => {
                e.stopPropagation();
                soundManager.playTap();
                setIsMenuOpen(!isMenuOpen);
              }}
              onPointerDown={(e) => e.stopPropagation()}
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
            <div className="max-w-xl md:max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 py-3 space-y-1.5 text-sm">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStart();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-amber-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Swords className="w-4 h-4 text-amber-400" />
                  Play 1v1 Battle
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSlideUpDismiss();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-sky-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  Practice 24,000+ PYQs
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSlideUpDismiss();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-purple-300 transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  Mistake Vault
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoginClick();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 text-slate-200 hover:text-white transition-colors font-semibold cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  Login / Cloud Sync
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSlideUpDismiss();
                }}
                onPointerDown={(e) => e.stopPropagation()}
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
      <main className="relative z-10 flex-1 max-w-xl md:max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 lg:pt-6 pb-2 flex flex-col justify-center">
        
        {/* MOBILE & TABLET LAYOUT (< lg) */}
        <div className="lg:hidden flex flex-col justify-center">
          {/* HERO TITLE & CALLOUT HEADER */}
          <div className="flex items-start justify-between gap-3">
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
              {renderExamPills()}
            </div>

            {/* Handwritten Callout */}
            {renderHandwrittenBadge(false)}
          </div>

          {/* Central Duel Arena Card Mockup */}
          <div className="mt-3.5 flex justify-center">
            {renderDuelCard()}
          </div>

          {/* Primary CTA Action Button */}
          {renderCtaSection(false)}

          {/* Horizontal 4-Column Feature Row */}
          {renderFeaturesRow(false)}
        </div>

        {/* DESKTOP / PC VIEW (lg+) - 2-Column Balanced Dashboard */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-10 xl:gap-14 lg:items-center w-full my-auto">
          {/* Left Column: Heading, Subtitle, Category Pills, Cursive script, CTA Button, Features */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-4 xl:space-y-5">
            <div className="space-y-2">
              <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.12]">
                Master English.
                <span className="block text-[#FF7A29] bg-gradient-to-r from-amber-400 via-orange-500 to-[#FF7A29] bg-clip-text text-transparent">
                  One Duel at a Time.
                </span>
              </h1>

              <p className="text-sm xl:text-base text-slate-300 font-normal leading-relaxed">
                Practice. Compete. Remember. Crack your exams.
              </p>
            </div>

            {/* Exam Pills & Cursive Callout side by side */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {renderExamPills()}
              {renderHandwrittenBadge(true)}
            </div>

            {/* Primary CTA Action Button on PC */}
            {renderCtaSection(true)}

            {/* 4-Column Feature Highlight Row on PC */}
            {renderFeaturesRow(true)}
          </div>

          {/* Right Column: Centered High-Fidelity Duel Arena Card Mockup */}
          <div className="lg:col-span-6 xl:col-span-6 flex justify-center">
            {renderDuelCard()}
          </div>
        </div>
      </main>

      {/* BOTTOM WINDOW SHUTTER PULL BAR (Interactive Shutter Slat Handle) */}
      <footer
        id="landing-shutter-handle-bar"
        onPointerDown={(e) => {
          dragControls.start(e);
        }}
        onClick={handleSlideUpDismiss}
        style={{ touchAction: 'none' }}
        className="relative z-30 w-full text-center py-2.5 pb-4 sm:pb-5 cursor-grab active:cursor-grabbing select-none group shrink-0 border-t border-blue-950/80 bg-[#050714]/95 backdrop-blur-md transition-colors hover:bg-[#090D24]"
        title="Slide or pull up like a window shutter to explore the arena"
      >
        {/* Tactile Shutter Slat Ridges (Embossed Grooved Grip) */}
        <div className="flex flex-col items-center justify-center gap-1 mb-1.5">
          <div className="w-16 sm:w-20 h-1.5 bg-slate-700/80 rounded-full group-hover:bg-sky-400 transition-colors shadow-inner" />
          <div className="w-10 sm:w-12 h-1 bg-slate-800 rounded-full group-hover:bg-sky-500/60 transition-colors" />
        </div>
        
        {/* Upward Chevron & Shutter Pull Hint */}
        <div className="inline-flex flex-col items-center justify-center gap-0.5 text-sky-400 group-hover:text-sky-300 transition-colors">
          <ChevronUp className="w-4 h-4 text-sky-400 group-hover:-translate-y-1 transition-transform animate-bounce" />
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black tracking-widest uppercase">
            <span>EXPLORE MORE</span>
            <span className="text-[10px] text-slate-500 font-medium normal-case tracking-normal">(Pull Up)</span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};
