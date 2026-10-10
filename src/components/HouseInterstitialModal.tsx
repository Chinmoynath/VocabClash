import React, { useState, useEffect } from 'react';
import { 
  X, 
  Crown, 
  Sparkles, 
  ArrowRight
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { recordAdShown } from '../utils/adManager';

interface HouseInterstitialModalProps {
  onClose: () => void;
  onOpenPremium: () => void;
  isPremium?: boolean;
}

export const HouseInterstitialModal: React.FC<HouseInterstitialModalProps> = ({
  onClose,
  onOpenPremium,
  isPremium,
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const [canDismiss, setCanDismiss] = useState<boolean>(false);

  // If user is VIP or becomes VIP via cloud hydration while modal is mounted, dismiss instantly
  useEffect(() => {
    if (isPremium) {
      onClose();
    }
  }, [isPremium, onClose]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanDismiss(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    if (!canDismiss) return;
    soundManager.playTap();
    recordAdShown();
    onClose();
  };

  const handleGoPremium = () => {
    soundManager.playTap();
    recordAdShown();
    onClose();
    onOpenPremium();
  };

  return (
    <div 
      id="house-interstitial-overlay"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none"
    >
      <div 
        id="house-interstitial-card"
        className="w-full max-w-md bg-gradient-to-b from-[#161524] to-[#0c0c16] border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col justify-between relative max-h-[96vh] overflow-y-auto no-scrollbar"
      >
        {/* Top Bar with Intermission Indicator and 5-Second Countdown / Circled Black Cross Sign */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/70 px-2.5 py-1 rounded-full text-[10px] text-slate-300 font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>VOCABCLASH STUDY BREAK</span>
          </div>

          <div className="flex items-center gap-2">
            {canDismiss ? (
              <button
                id="house-ad-close-circle-btn"
                onClick={handleDismiss}
                aria-label="Close"
                title="Close"
                className="w-8 h-8 rounded-full bg-black/90 hover:bg-black border border-slate-700/90 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <div 
                id="house-ad-countdown-pill"
                className="bg-slate-800/90 text-slate-300 px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 border border-slate-700"
              >
                <span>Continue in</span>
                <span className="text-amber-400 font-bold">{countdown}</span>
              </div>
            )}
          </div>
        </div>

        {/* Real Static Study Break Banner Asset */}
        <div 
          id="house-interstitial-ad-area"
          className="my-3 rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-black flex items-center justify-center"
        >
          <img
            src="/study-break-promo.png"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith('/assets/study-break-vip.png')) {
                target.src = '/assets/study-break-vip.png';
              }
            }}
            alt="Turn preparation into progress. With the right tools. VocabClash English for Govt Exams"
            className="w-full h-auto object-contain rounded-xl select-none pointer-events-none block"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Bottom VIP CTA: VocabClash VIP */}
        <div 
          id="house-interstitial-vip-section"
          className="bg-[#1b152d] border border-purple-600/50 rounded-2xl p-3.5 space-y-2.5 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Crown className="w-4.5 h-4.5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black text-purple-100 leading-tight">
                VocabClash VIP
              </div>
              <div className="text-[11px] text-purple-300/80 mt-0.5">
                Practice without interruptions. Boost recall by 2.4x.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-purple-300/90 font-medium">
              Starting at <strong className="text-white font-bold">₹19/month</strong>
            </span>
            <span className="text-[10px] text-purple-400/80 font-medium">
              Instant Activation · Cancel Anytime
            </span>
          </div>

          <button
            id="house-ad-upgrade-vip-btn"
            onClick={handleGoPremium}
            className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/60 border border-purple-400/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>UPGRADE TO VIP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
