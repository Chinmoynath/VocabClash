import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isNativeCapacitor } from '../utils/platform';

interface StartupSplashOverlayProps {
  /**
   * Optional signal indicating that the app's initial auth check or profile
   * restoration is ready to reveal the main arena.
   */
  isReady?: boolean;
}

// Module-level guard: once dismissed on Capacitor cold-start, never re-display during the session
let hasCapacitorSplashDismissed = false;

/**
 * StartupSplashOverlay:
 * 
 * - WEB / PWA:
 *   Always returns null immediately. The web platform renders the main VocabClash
 *   interface instantly without any full-screen blocking splash or loading barrier.
 *   Guest users and shared link visitors can immediately access practice, PYQs,
 *   and articles while Firebase Auth and Firestore initialize asynchronously.
 * 
 * - CAPACITOR ANDROID APP:
 *   Maintains the polished, branded startup loading experience while the native
 *   WebView mounts and initial profile/auth resolution takes place.
 *   Dismisses as soon as initialization is ready or via a deterministic fallback
 *   timer (1.2s max), ensuring it can NEVER get stuck or freeze the app.
 */
export const StartupSplashOverlay: React.FC<StartupSplashOverlayProps> = ({ isReady }) => {
  // 1. Strict Web / PWA Bypass: Never display on web browsers, PWAs, or TWAs
  if (!isNativeCapacitor() || hasCapacitorSplashDismissed) {
    return null;
  }

  return <CapacitorNativeSplashInner isReady={isReady} />;
};

const CapacitorNativeSplashInner: React.FC<{ isReady?: boolean }> = ({ isReady }) => {
  const [isVisible, setIsVisible] = useState(true);
  const dismissedRef = useRef(false);

  useEffect(() => {
    // If already dismissed, clean up immediately
    if (dismissedRef.current || hasCapacitorSplashDismissed) {
      setIsVisible(false);
      return;
    }

    // Dismiss helper
    const dismiss = () => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      hasCapacitorSplashDismissed = true;
      setIsVisible(false);
    };

    // If isReady is explicitly signaled from App (e.g. cached profile loaded or auth resolved)
    if (isReady) {
      const raf = requestAnimationFrame(() => {
        dismiss();
      });
      return () => cancelAnimationFrame(raf);
    }

    // Deterministic fallback timeout (1.2s max) to guarantee the splash screen
    // NEVER remains visible forever even if Firebase Auth or network hangs completely
    const fallbackTimer = setTimeout(() => {
      dismiss();
    }, 1200);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [isReady]);

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="vc-startup-splash-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="fixed inset-0 z-[99999] bg-[#020617] flex flex-col items-center justify-center select-none pointer-events-none"
          style={{ willChange: 'opacity' }}
          aria-hidden="true"
        >
          {/* Branded Icon Badge */}
          <div className="w-[68px] h-[68px] rounded-[18px] bg-[radial-gradient(circle_at_30%_30%,#1e293b,#090d16)] border border-amber-500/40 shadow-2xl shadow-black/80 flex items-center justify-center mb-4">
            <img 
              src="/favicon.png" 
              alt="VocabClash" 
              width={42} 
              height={42} 
              className="rounded-[10px] block" 
              loading="eager"
            />
          </div>

          {/* Title and Subtitle */}
          <div className="text-2xl font-extrabold text-slate-100 tracking-tight leading-tight mb-1">
            Vocab<span className="text-amber-500">Clash</span>
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 mb-5">
            Govt Exam English Arena
          </div>

          {/* Minimalist Status Indicator */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/55 text-xs font-medium text-slate-300">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse" />
            <span>Preparing your arena…</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
