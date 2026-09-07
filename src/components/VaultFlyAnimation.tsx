import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, Sparkles, Check, CheckCircle2 } from 'lucide-react';

export interface VaultFlyItem {
  id: string;
  startX: number;
  startY: number;
  word: string;
  isSave: boolean;
}

interface VaultFlyAnimationProps {
  items: VaultFlyItem[];
  onComplete: (id: string) => void;
}

export const VaultFlyAnimation: React.FC<VaultFlyAnimationProps> = ({ items, onComplete }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <FlyParticle key={item.id} item={item} onDone={() => onComplete(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const FlyParticle: React.FC<{ item: VaultFlyItem; onDone: () => void }> = ({ item, onDone }) => {
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>(() => {
    // Determine destination target (Desktop sidebar vault or mobile bottom nav vault if in DOM)
    if (typeof window !== 'undefined') {
      const desktopVault = document.querySelector('#vocabclash-desktop-sidebar [aria-label*="Vault"], #vocabclash-desktop-sidebar button:nth-child(4)');
      if (desktopVault) {
        const rect = desktopVault.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      const bottomVault = document.querySelector('nav button:nth-child(4), [aria-label*="Vault"]');
      if (bottomVault) {
        const rect = bottomVault.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      // Default graceful parabolic flight towards top-left / vault direction
      return {
        x: Math.max(40, item.startX - 180),
        y: Math.max(30, item.startY - 260),
      };
    }
    return { x: item.startX - 120, y: item.startY - 200 };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      onDone();
    }, 550);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!item.isSave) {
    // Unsaved / removed: quick gentle micro-puff dissolving in place
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: item.startY - 10, x: item.startX - 50 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 0.95, 0.8], y: item.startY - 36 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="fixed z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/95 border border-rose-500/40 text-rose-300 text-[11px] font-bold shadow-xl backdrop-blur-md"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span>Removed from Vault</span>
      </motion.div>
    );
  }

  const deltaX = targetPos.x - item.startX;
  const deltaY = targetPos.y - item.startY;

  return (
    <>
      {/* 1. Miniature Sealed Letter / Parchment Card Whooshing into the Vault */}
      <motion.div
        initial={{
          x: item.startX - 45,
          y: item.startY - 20,
          scale: 0.4,
          opacity: 0,
          rotate: 0,
        }}
        animate={{
          x: [item.startX - 45, item.startX - 30, item.startX + deltaX * 0.4, item.startX + deltaX],
          y: [item.startY - 20, item.startY - 45, item.startY + deltaY * 0.5 - 25, item.startY + deltaY],
          scale: [0.4, 1.08, 0.85, 0.22],
          opacity: [0, 1, 0.95, 0],
          rotate: [0, -8, -16, -26],
        }}
        transition={{
          duration: 0.48,
          times: [0, 0.2, 0.65, 1],
          ease: [0.25, 1, 0.5, 1],
        }}
        className="fixed z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-200 via-amber-100 to-amber-300 border border-amber-400 text-slate-950 font-black shadow-[0_8px_25px_rgba(245,158,11,0.55)] select-none pointer-events-none"
      >
        {/* Envelope & Wax Bookmark Seal */}
        <div className="relative flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500/30 text-amber-900 shadow-inner">
          <Bookmark className="w-3.5 h-3.5 fill-amber-700 text-amber-900" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </div>

        {/* Word Preview */}
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-black text-slate-900 truncate max-w-[85px] capitalize">
            {item.word || 'Question'}
          </span>
          <span className="text-[8px] font-bold text-amber-950/80 uppercase tracking-wider">
            Vault ✉️
          </span>
        </div>
      </motion.div>

      {/* 2. Sparkle Slipstream Trail */}
      <motion.div
        initial={{
          x: item.startX - 10,
          y: item.startY - 15,
          scale: 0.3,
          opacity: 0,
        }}
        animate={{
          x: [item.startX - 10, item.startX + deltaX * 0.35, item.startX + deltaX * 0.75],
          y: [item.startY - 15, item.startY + deltaY * 0.4, item.startY + deltaY * 0.8],
          scale: [0.3, 0.8, 0],
          opacity: [0, 0.8, 0],
        }}
        transition={{
          duration: 0.42,
          delay: 0.05,
          ease: 'easeOut',
        }}
        className="fixed z-45 pointer-events-none"
      >
        <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      </motion.div>

      {/* 3. Polite non-blocking micro confirmation chip near origin */}
      <motion.div
        initial={{
          x: item.startX - 55,
          y: item.startY - 8,
          opacity: 0,
          scale: 0.85,
        }}
        animate={{
          x: item.startX - 55,
          y: item.startY - 38,
          opacity: [0, 1, 1, 0],
          scale: [0.85, 1, 0.98, 0.9],
        }}
        transition={{
          duration: 0.95,
          times: [0, 0.2, 0.75, 1],
          ease: 'easeOut',
        }}
        className="fixed z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-amber-500/40 text-amber-300 text-[11px] font-bold shadow-xl backdrop-blur-md"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
        <span>Saved to Vault</span>
      </motion.div>
    </>
  );
};
