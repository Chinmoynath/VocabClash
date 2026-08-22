import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, ExamType, QuestionCategory } from '../types';
import { 
  findOrCreateRandomMatch, 
  listenToDuelRoom, 
  cancelOrLeaveDuelRoom, 
  DuelRoomData 
} from '../services/multiplayerService';
import { soundManager } from '../utils/audio';
import { Shield, Swords, X, Globe, Radio, WifiOff, Users, Loader2 } from 'lucide-react';

interface MatchmakingModalProps {
  player: PlayerProfile;
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge';
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  isOnline: boolean;
  onCancel: () => void;
  onReadyToFight: (roomData: DuelRoomData, role: 'host' | 'guest') => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  player,
  mode,
  category,
  exam,
  isOnline,
  onCancel,
  onReadyToFight,
}) => {
  const [searchStep, setSearchStep] = useState<number>(0); // 0: Connecting, 1: Searching for real opponent, 2: Found
  const [activeRoom, setActiveRoom] = useState<DuelRoomData | null>(null);
  const [userRole, setUserRole] = useState<'host' | 'guest'>('host');
  const [matchedOpponent, setMatchedOpponent] = useState<PlayerProfile | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [searchTimeSec, setSearchTimeSec] = useState<number>(0);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);

  // Monitor offline state
  useEffect(() => {
    if (!isOnline || !navigator.onLine) {
      handleCancel();
      return;
    }
    const handleOffline = () => {
      handleCancel();
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [isOnline]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Search Timer
  useEffect(() => {
    if (searchStep < 2) {
      const timer = setInterval(() => {
        setSearchTimeSec(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [searchStep]);

  // Initiate real online matchmaking in Firestore
  useEffect(() => {
    if (!isOnline) return;

    let isMounted = true;
    setSearchStep(0);

    const initMatchmaking = async () => {
      try {
        setSearchStep(1); // Searching open queue
        const result = await findOrCreateRandomMatch(player, exam, category, mode);
        if (!isMounted) return;

        activeRoomCodeRef.current = result.roomCode;
        setActiveRoom(result.roomData);

        if (result.type === 'joined') {
          // Joined an existing waiting player's room!
          setUserRole('guest');
          setMatchedOpponent(result.roomData.host);
          setSearchStep(2);
          soundManager.playMatchFound();
          setCountdown(3);
        } else {
          // Created our own public room -> listen for real opponent to join
          setUserRole('host');
          const unsub = listenToDuelRoom(
            result.roomCode,
            (updated) => {
              if (!isMounted) return;
              if (updated.status === 'starting' && updated.guest) {
                // Real player joined our room!
                setActiveRoom(updated);
                setMatchedOpponent(updated.guest);
                setSearchStep(2);
                soundManager.playMatchFound();
                setCountdown(3);
              }
            },
            (err) => {
              console.warn('Matchmaking listener error:', err);
            }
          );
          unsubscribeRef.current = unsub;
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Matchmaking error:', err);
      }
    };

    initMatchmaking();

    return () => {
      isMounted = false;
    };
  }, [player, exam, category, mode, isOnline]);

  // Countdown timer when match is found
  useEffect(() => {
    if (countdown === null || !activeRoom) return;

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
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        onReadyToFight(activeRoom, userRole);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [countdown, activeRoom, userRole, onReadyToFight]);

  // Cancel matchmaking
  const handleCancel = async () => {
    soundManager.playTap();
    if (activeRoomCodeRef.current && userRole === 'host' && searchStep < 2) {
      try {
        await cancelOrLeaveDuelRoom(activeRoomCodeRef.current, 'host');
      } catch (err) {
        console.warn('Cancel matchmaking room error:', err);
      }
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
        {/* Cancel button if still searching */}
        {searchStep < 2 && (
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {searchStep < 2 ? (
          /* Real-Time Radar Scanning View */
          <div className="py-6 space-y-5 flex flex-col items-center w-full">
            {/* Animated Radar */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping opacity-30"></div>
              <div className="absolute inset-2 rounded-full border border-amber-500/30 animate-pulse"></div>
              <div className="absolute inset-6 rounded-full border border-amber-500/40"></div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-2xl shadow-xl z-10">
                {player.avatar}
              </div>
              <div className="absolute inset-0 rounded-full border-t-2 border-amber-400 animate-spin"></div>
            </div>

            <div className="space-y-1.5 w-full">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Finding Real Opponent ({searchTimeSec}s)</span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-100">
                Matching Online Aspirants
              </h3>
              <p className="text-xs text-slate-400">
                ELO Tier: <span className="text-amber-300 font-bold">{player.rankPoints} ± 150 LP</span>
              </p>
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1 mt-2">
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Govt Exams Matchmaking • 0 Bots</span>
              </div>
            </div>

            {/* Cancel Matchmaking Button */}
            <button
              onClick={handleCancel}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
            >
              Cancel Search
            </button>
          </div>
        ) : (
          /* Real Match Found Head-to-Head View */
          <div className="w-full py-2 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-black tracking-wide animate-bounce">
              <Swords className="w-3.5 h-3.5" />
              OPPONENT FOUND!
            </div>

            {/* Head-to-Head Split Card */}
            <div className="grid grid-cols-2 gap-3 relative py-2">
              {/* Player Side */}
              <div className="bg-slate-800/80 border border-amber-500/40 rounded-2xl p-3 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                  {player.avatar}
                </div>
                <div className="font-bold text-xs text-slate-100 truncate w-full">{player.name}</div>
                <div className="text-[10px] text-amber-400 font-mono font-semibold">{player.rankPoints} LP</div>
                <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{player.targetExam}</div>
              </div>

              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-orange-600 border-2 border-slate-900 flex items-center justify-center font-black text-[11px] text-white shadow-xl z-20">
                VS
              </div>

              {/* Opponent Side */}
              {matchedOpponent && (
                <div className="bg-slate-800/80 border border-orange-700/40 rounded-2xl p-3 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                    {matchedOpponent.avatar}
                  </div>
                  <div className="font-bold text-xs text-slate-100 truncate w-full">{matchedOpponent.name}</div>
                  <div className="text-[10px] text-orange-400 font-mono font-semibold">{matchedOpponent.rankPoints} LP</div>
                  <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{matchedOpponent.targetExam}</div>
                </div>
              )}
            </div>

            {/* Countdown to Battle */}
            <div className="pt-2">
              <div className="text-3xl font-black text-amber-400 font-mono animate-ping">
                {countdown !== null && countdown > 0 ? countdown : 'DUEL!'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Starting Live Head-to-Head Duel...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
