import React, { useState, useEffect } from 'react';
import { 
  X, 
  Crown, 
  Sparkles, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { recordAdShown, ADS_ENABLED } from '../utils/adManager';
import { isNativeCapacitor } from '../utils/platform';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_INTERSTITIAL_SLOT } from '../services/adSenseService';

interface InterstitialAdModalProps {
  onClose: () => void;
  onOpenPremium: () => void;
}

export const InterstitialAdModal: React.FC<InterstitialAdModalProps> = ({
  onClose,
  onOpenPremium,
}) => {
  // Completely dormant when ads are disabled or running inside native Capacitor
  if (!ADS_ENABLED || isNativeCapacitor()) {
    return null;
  }

  const [countdown, setCountdown] = useState<number>(5);
  const [canSkip, setCanSkip] = useState<boolean>(false);
  const [adMuted, setAdMuted] = useState<boolean>(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanSkip(true);
    }
  }, [countdown]);

  const handleDismiss = () => {
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
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#181726] to-[#0f0e1a] border-2 border-slate-700/80 rounded-[32px] p-4 sm:p-5 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col justify-between relative max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* Top Header Bar with Timer & Skip Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-full text-[10px] text-slate-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Google AdSense • Interstitial</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdMuted(!adMuted)}
              className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 text-xs"
              title="Toggle Audio"
            >
              {adMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {canSkip ? (
              <button
                onClick={handleDismiss}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md transition-transform active:scale-95 animate-bounce"
              >
                <span>Skip Ad</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1 border border-slate-700">
                <span className="text-amber-400">{countdown}s</span>
                <span className="text-[10px] text-slate-400">Skip</span>
              </div>
            )}
          </div>
        </div>

        {/* Live AdSense Unit */}
        <div className="my-3 space-y-2.5">
          <AdSenseUnit 
            slotId={ADSENSE_INTERSTITIAL_SLOT}
            format="rectangle"
            onAdClick={handleDismiss}
          />

          <div className="text-center text-[10px] text-slate-500">
            Powered by Google AdSense • 1 ad intermission every 10 min for free tier
          </div>
        </div>

        {/* Upgrade to Premium Ad-Free Card */}
        <div className="mt-1 bg-[#1b152d] border border-purple-600/50 rounded-2xl p-3 space-y-2 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-purple-200">
                Hate Ads? Get 100% Ad-Free
              </div>
              <div className="text-[10px] text-purple-300/80">
                Starting at just ₹19/month • Always Ad-Free
              </div>
            </div>
          </div>

          <button
            onClick={handleGoPremium}
            className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950 border border-purple-400/30 transition-all"
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

