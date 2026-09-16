import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Lightweight, zero-layout-shift splash overlay that smoothly dissolves once
 * the primary VocabClash UI has mounted and completed its initial paint.
 * Matches the inline HTML splash in index.html with exact 1:1 pixel alignment.
 */
export const StartupSplashOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Wait for the primary arena UI and layout to settle on screen
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsVisible(false);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

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
