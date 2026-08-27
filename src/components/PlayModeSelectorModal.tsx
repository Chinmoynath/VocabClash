import React from 'react';
import { 
  Globe, 
  Users, 
  X, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Share2, 
  Radio,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { PlayerProfile, QuestionCategory, ExamType } from '../types';
import { User as FirebaseUser } from 'firebase/auth';

interface PlayModeSelectorModalProps {
  player: PlayerProfile;
  selectedCategory: QuestionCategory | 'mixed';
  selectedExam: ExamType;
  currentUser?: FirebaseUser | null;
  onSelectPlayOnline: () => void;
  onSelectPlayWithFriend: () => void;
  onClose: () => void;
}

export const PlayModeSelectorModal: React.FC<PlayModeSelectorModalProps> = ({
  player,
  selectedCategory,
  selectedExam,
  currentUser,
  onSelectPlayOnline,
  onSelectPlayWithFriend,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/90 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100">
        
        {/* Subtle decorative background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

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

        {/* Header */}
        <div className="text-center space-y-1.5 pb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Match Mode</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            How do you want to play?
          </h2>
          <p className="text-xs text-slate-400">
            Choose online ranked matchmaking or a private room with a friend
          </p>
        </div>

        {/* 2 Big Action Cards */}
        <div className="space-y-3 pt-1">
          
          {/* OPTION 1: Play Online */}
          <button
            onClick={() => {
              soundManager.playTap();
              onSelectPlayOnline();
            }}
            className="w-full text-left p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-slate-800/90 via-slate-800/70 to-slate-900/90 hover:from-amber-950/40 hover:via-slate-800 hover:to-amber-950/30 border border-slate-700 hover:border-amber-400/80 transition-all group relative overflow-hidden shadow-lg cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center text-2xl font-black shadow-md shrink-0 group-hover:scale-105 group-hover:rotate-3 transition-transform">
                🌐
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-black text-white group-hover:text-amber-300 transition-colors">
                    Play Online
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                    <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    Instant Queue
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Battle real aspirants in 1v1
                </p>

                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <Zap className="w-3 h-3 text-amber-400" /> +30 LP on Victory
                  </span>
                  <span>•</span>
                  <span>Avg Queue: ~1.8s</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 mt-3" />
            </div>
          </button>

          {/* OPTION 2: Play with Friend */}
          <button
            onClick={() => {
              soundManager.playTap();
              onSelectPlayWithFriend();
            }}
            className="w-full text-left p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-slate-800/90 via-slate-800/70 to-slate-900/90 hover:from-sky-950/40 hover:via-slate-800 hover:to-sky-950/30 border border-slate-700 hover:border-sky-400/80 transition-all group relative overflow-hidden shadow-lg cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0 group-hover:scale-105 group-hover:-rotate-3 transition-transform">
                👥
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-black text-white group-hover:text-sky-300 transition-colors">
                    Play with Friend
                  </span>
                  <div className="flex items-center gap-1">
                    {currentUser ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0 font-mono">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        Signed In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-500/40 shrink-0 font-mono">
                        <Lock className="w-2.5 h-2.5 text-sky-400" />
                        Requires Login
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Create a room or join with a 6-digit code
                </p>

                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400 font-medium">
                  <span className="text-sky-300 font-semibold flex items-center gap-1">
                    <Share2 className="w-3 h-3 text-sky-400" /> Share invite link
                  </span>
                  <span>•</span>
                  <span>{currentUser ? 'Ready to Duel' : 'Google 1-Tap Sign-In'}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all shrink-0 mt-3" />
            </div>
          </button>

        </div>

        {/* Footer info pill */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Both players answer the exact same questions with real-time sync</span>
          </div>
        </div>

      </div>
    </div>
  );
};
