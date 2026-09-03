import React, { useState } from 'react';
import { 
  WifiOff, 
  RefreshCw, 
  BookOpen, 
  Bookmark, 
  X, 
  ShieldAlert, 
  Zap, 
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { networkManager } from '../utils/networkManager';

interface OfflineWarningModalProps {
  onClose: () => void;
  onPlayOfflineDrill: () => void;
  onOpenMistakeVault?: () => void;
  onConnectionRestored?: () => void;
}

export const OfflineWarningModal: React.FC<OfflineWarningModalProps> = ({
  onClose,
  onPlayOfflineDrill,
  onOpenMistakeVault,
  onConnectionRestored,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<'success' | 'failed' | null>(null);

  const handleRetry = async () => {
    soundManager.playTap();
    setIsRetrying(true);
    setRetryResult(null);

    const result = await networkManager.checkLatency();
    setIsRetrying(false);

    if (result.isOnline) {
      setRetryResult('success');
      soundManager.playCorrect();
      setTimeout(() => {
        if (onConnectionRestored) {
          onConnectionRestored();
        } else {
          onClose();
        }
      }, 1000);
    } else {
      setRetryResult('failed');
      soundManager.playWrong();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100">
        
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => {
            soundManager.playTap();
            onClose();
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="text-center space-y-2 pb-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-950/40 animate-pulse">
            <WifiOff className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-bold tracking-wide uppercase">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Internet Required for 1v1</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            You Are Currently Offline
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed px-2">
            1v1 Ranked Battles and Live Friend Rooms require an active internet connection to match aspirants and sync round timers in real time.
          </p>
        </div>

        {/* Retry status alert */}
        {retryResult === 'failed' && (
          <div className="my-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Still offline. Please check your Wi-Fi or mobile data.</span>
          </div>
        )}

        {retryResult === 'success' && (
          <div className="my-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Connection restored! Ready for 1v1 battle.</span>
          </div>
        )}

        {/* Offline-Ready Action Options */}
        <div className="space-y-2.5 pt-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">
            Playable Offline (No Internet Needed):
          </div>

          {/* Option 1: PYQ Drill Practice (100% Offline) */}
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
              onPlayOfflineDrill();
            }}
            className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-800 to-slate-800 hover:from-amber-500/25 border border-amber-500/40 hover:border-amber-400 transition-all flex items-center justify-between gap-3 group shadow-md cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-white group-hover:text-amber-200 flex items-center gap-1.5">
                  <span>Solo PYQ Practice Drill</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-400/30">
                    24k Pool
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  Solve exam questions offline with instant explanations
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* Option 2: Mistake Vault Revision */}
          {onOpenMistakeVault && (
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
                onOpenMistakeVault();
              }}
              className="w-full text-left p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-between gap-3 group shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm text-white group-hover:text-sky-200">
                    Revise Mistake Vault
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Review tricky words and bookmarked items offline
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          )}

          {/* Re-check Internet Connection Button */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-[0.98] border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Testing Internet Connection...' : 'Check Connection / Reconnect'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
