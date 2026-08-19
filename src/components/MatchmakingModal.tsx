import React, { useState, useEffect } from 'react';
import { PlayerProfile, ExamType, QuestionCategory } from '../types';
import { soundManager } from '../utils/audio';
import { Shield, Flame, Swords, X, Globe, Radio } from 'lucide-react';

interface MatchmakingModalProps {
  player: PlayerProfile;
  opponent: PlayerProfile | null;
  mode: string;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  onCancel: () => void;
  onReadyToFight: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  player,
  opponent,
  mode,
  category,
  exam,
  onCancel,
  onReadyToFight,
}) => {
  const [searchStep, setSearchStep] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Step 0: Connecting
    const t1 = setTimeout(() => {
      setSearchStep(1); // Searching ELO bracket
    }, 900);

    // Step 2: Opponent found
    const t2 = setTimeout(() => {
      setSearchStep(2);
      soundManager.playMatchFound();
    }, 2200);

    // Step 3: Countdown
    const t3 = setTimeout(() => {
      setCountdown(3);
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 1) {
      const timer = setTimeout(() => {
        soundManager.playTick();
        setCountdown(countdown - 1);
      }, 900);
      return () => clearTimeout(timer);
    } else if (countdown === 1) {
      const timer = setTimeout(() => {
        soundManager.playTick();
        setCountdown(0);
        onReadyToFight();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [countdown, onReadyToFight]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
        {/* Cancel button if still searching */}
        {searchStep < 2 && (
          <button
            onClick={() => {
              soundManager.playTap();
              onCancel();
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {searchStep < 2 ? (
          /* Radar Scanning View */
          <div className="py-8 space-y-6 flex flex-col items-center">
            {/* Animated Radar */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping opacity-30"></div>
              <div className="absolute inset-2 rounded-full border border-amber-500/30 animate-pulse"></div>
              <div className="absolute inset-6 rounded-full border border-amber-500/40"></div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-2xl shadow-xl z-10">
                {player.avatar}
              </div>
              <div className="absolute inset-0 rounded-full border-t-2 border-amber-400 animate-spin"></div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-100 flex items-center justify-center gap-1.5">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                {searchStep === 0 ? 'Connecting to Global Server...' : 'Searching Competitive Aspirants...'}
              </h3>
              <p className="text-xs text-slate-400">
                Matching ELO: <span className="text-amber-300 font-bold">{player.rankPoints} ± 150 LP</span>
              </p>
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1 mt-2">
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Asia-South Server • 28ms Ping</span>
              </div>
            </div>
          </div>
        ) : (
          /* Match Found VS View */
          <div className="w-full py-2 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-black tracking-wide animate-bounce">
              <Swords className="w-3.5 h-3.5" />
              MATCH FOUND!
            </div>

            {/* Head-to-Head Split Card */}
            <div className="grid grid-cols-2 gap-3 relative py-2">
              {/* Player Side */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                  {player.avatar}
                </div>
                <div className="font-bold text-xs text-slate-100 truncate w-full">{player.name}</div>
                <div className="text-[10px] text-emerald-400 font-mono font-semibold">{player.rankPoints} LP</div>
                <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{player.targetExam}</div>
              </div>

              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-orange-600 border-2 border-slate-900 flex items-center justify-center font-black text-[11px] text-white shadow-xl z-20">
                VS
              </div>

              {/* Opponent Side */}
              {opponent && (
                <div className="bg-slate-800/80 border border-orange-700/40 rounded-2xl p-3 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                    {opponent.avatar}
                  </div>
                  <div className="font-bold text-xs text-slate-100 truncate w-full">{opponent.name}</div>
                  <div className="text-[10px] text-orange-400 font-mono font-semibold">{opponent.rankPoints} LP</div>
                  <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{opponent.targetExam}</div>
                </div>
              )}
            </div>

            {/* Countdown to Battle */}
            <div className="pt-2">
              <div className="text-3xl font-black text-amber-400 font-mono animate-ping">
                {countdown !== null && countdown > 0 ? countdown : 'GO!'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Starting Head-to-Head Duel...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
