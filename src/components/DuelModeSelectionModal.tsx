import React from 'react';
import { PlayerProfile, ExamType, QuestionCategory } from '../types';
import { soundManager } from '../utils/audio';
import { Globe, Users, X, Swords, PlusCircle, LogIn, Sparkles, Shield, WifiOff } from 'lucide-react';

interface DuelModeSelectionModalProps {
  player: PlayerProfile;
  exam: ExamType;
  category: QuestionCategory | 'mixed';
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge';
  isOnline: boolean;
  onClose: () => void;
  onSelectRandomMatch: () => void;
  onOpenCreateFriendRoom: () => void;
  onOpenJoinFriendRoom: () => void;
}

export const DuelModeSelectionModal: React.FC<DuelModeSelectionModalProps> = ({
  player,
  exam,
  category,
  mode,
  isOnline,
  onClose,
  onSelectRandomMatch,
  onOpenCreateFriendRoom,
  onOpenJoinFriendRoom,
}) => {
  const roundCount = mode === 'quick_duel' ? 10 : 20;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
        {/* Subtle background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
              ⚔️
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                1v1 Vocab Duel
              </h2>
              <p className="text-xs text-slate-400">
                {roundCount} PYQ Rounds • {exam.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Offline notice if disconnected */}
        {!isOnline && (
          <div className="bg-red-950/90 border border-red-500/80 rounded-2xl p-3 text-red-200 flex items-center gap-2.5 text-xs font-bold">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <span>arena connection failed: please connect to the internet to play 1v1 battles</span>
          </div>
        )}

        {/* Two Main Battle Options */}
        <div className="space-y-3 relative z-10 pt-1">
          {/* Option 1: Random Online Match */}
          <button
            onClick={() => {
              if (!isOnline) {
                soundManager.playWrong();
                return;
              }
              soundManager.playTap();
              onSelectRandomMatch();
            }}
            disabled={!isOnline}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 group relative overflow-hidden ${
              isOnline
                ? 'bg-gradient-to-r from-slate-850 to-slate-800 hover:border-amber-400 border-slate-700 shadow-lg shadow-slate-950/50 cursor-pointer active:scale-[0.98]'
                : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
              🌎
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm sm:text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                  Random Online Match
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Global ELO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Finds a real competitive aspirant online in your ELO bracket for a live head-to-head duel.
              </p>
            </div>
          </button>

          {/* Option 2: Play with Friends (Custom Rooms) */}
          <div className="bg-slate-850/90 border-2 border-indigo-700/60 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl shrink-0">
                👥
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm sm:text-base text-slate-100">
                    Play with Friends
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                    Room Code
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create a custom room or join with your friend's 6-digit code.
                </p>
              </div>
            </div>

            {/* Friend Room Sub-Buttons: Create Room & Join Room */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  if (!isOnline) {
                    soundManager.playWrong();
                    return;
                  }
                  soundManager.playTap();
                  onOpenCreateFriendRoom();
                }}
                disabled={!isOnline}
                className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-1.5 border transition-all ${
                  isOnline
                    ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border-indigo-400/40 shadow-md shadow-indigo-950/60 active:scale-[0.97]'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Room</span>
              </button>

              <button
                onClick={() => {
                  if (!isOnline) {
                    soundManager.playWrong();
                    return;
                  }
                  soundManager.playTap();
                  onOpenJoinFriendRoom();
                }}
                disabled={!isOnline}
                className={`py-3 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-1.5 border transition-all ${
                  isOnline
                    ? 'bg-slate-800 hover:bg-slate-750 text-indigo-200 border-indigo-500/40 shadow-md active:scale-[0.97]'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Join Room</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-1 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time multiplayer powered by Firebase • Zero Bots</span>
        </div>
      </div>
    </div>
  );
};
