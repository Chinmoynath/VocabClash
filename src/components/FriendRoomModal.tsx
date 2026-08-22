import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, ExamType, QuestionCategory } from '../types';
import { 
  createDuelRoom, 
  joinDuelRoom, 
  listenToDuelRoom, 
  cancelOrLeaveDuelRoom, 
  DuelRoomData 
} from '../services/multiplayerService';
import { soundManager } from '../utils/audio';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Swords, 
  ArrowLeft, 
  Radio, 
  Shield, 
  AlertCircle, 
  Loader2,
  WifiOff
} from 'lucide-react';

interface FriendRoomModalProps {
  initialView: 'create' | 'join';
  player: PlayerProfile;
  exam: ExamType;
  category: QuestionCategory | 'mixed';
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge';
  isOnline: boolean;
  onClose: () => void;
  onStartDuel: (roomData: DuelRoomData, role: 'host' | 'guest') => void;
}

export const FriendRoomModal: React.FC<FriendRoomModalProps> = ({
  initialView,
  player,
  exam,
  category,
  mode,
  isOnline,
  onClose,
  onStartDuel,
}) => {
  const [view, setView] = useState<'create' | 'join'>(initialView);
  
  // Create Room state
  const [createdRoom, setCreatedRoom] = useState<DuelRoomData | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // Join Room state
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // VS Countdown transition state
  const [matchedRoom, setMatchedRoom] = useState<DuelRoomData | null>(null);
  const [userRole, setUserRole] = useState<'host' | 'guest'>('host');
  const [countdown, setCountdown] = useState<number | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Clean up listeners and room on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Monitor offline state
  useEffect(() => {
    if (!isOnline) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      onClose();
    }
  }, [isOnline, onClose]);

  // Create room on view change if in create mode
  useEffect(() => {
    if (view === 'create' && !createdRoom && !isCreating && isOnline) {
      let isMounted = true;
      setIsCreating(true);

      createDuelRoom(player, exam, category, 'friend_duel', false)
        .then(({ roomCode, roomData }) => {
          if (!isMounted) return;
          setCreatedRoom(roomData);
          setIsCreating(false);

          // Start listening to the room for guest player
          const unsub = listenToDuelRoom(
            roomCode,
            (updated) => {
              if (updated.status === 'starting' && updated.guest) {
                // Second player joined! Trigger VS countdown!
                soundManager.playMatchFound();
                setMatchedRoom(updated);
                setUserRole('host');
                setCountdown(3);
              }
            },
            (err) => {
              console.warn('Room listener error:', err);
            }
          );
          unsubscribeRef.current = unsub;
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Failed to create room:', err);
          setIsCreating(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [view, player, exam, category, isOnline, createdRoom, isCreating]);

  // Handle countdown progression
  useEffect(() => {
    if (countdown === null || !matchedRoom) return;

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
        onStartDuel(matchedRoom, userRole);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [countdown, matchedRoom, userRole, onStartDuel]);

  // Copy room code to clipboard
  const handleCopyCode = async () => {
    if (!createdRoom) return;
    soundManager.playTap();
    try {
      await navigator.clipboard.writeText(createdRoom.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Share room code via Web Share API
  const handleShareCode = async () => {
    if (!createdRoom) return;
    soundManager.playTap();
    const shareText = `⚔️ Challenge me in 1v1 Vocab Duel (Govt Exams)!\nJoin with Room Code: ${createdRoom.roomCode}\n`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VocabClash 1v1 Duel Room',
          text: shareText,
          url: window.location.href,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  // Join existing friend room
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      soundManager.playWrong();
      setJoinError('Arena connection failed: Please connect to the internet.');
      return;
    }

    const code = joinCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) {
      soundManager.playWrong();
      setJoinError('Please enter a valid room code.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    soundManager.playTap();

    try {
      const roomData = await joinDuelRoom(code, player);
      soundManager.playMatchFound();
      setMatchedRoom(roomData);
      setUserRole('guest');
      setCountdown(3);
    } catch (err: any) {
      soundManager.playWrong();
      const msg = err?.message || 'Failed to join room. Please check the code.';
      setJoinError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  // Cancel / Leave created room
  const handleCancelRoom = async () => {
    soundManager.playTap();
    if (createdRoom) {
      try {
        await cancelOrLeaveDuelRoom(createdRoom.roomCode, 'host');
      } catch (err) {
        console.warn('Cancel room error:', err);
      }
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    onClose();
  };

  // If countdown is active, show the synchronized VS Head-to-Head screen
  if (countdown !== null && matchedRoom) {
    const oppPlayer = userRole === 'host' ? matchedRoom.guest! : matchedRoom.host;
    const mePlayer = userRole === 'host' ? matchedRoom.host : matchedRoom.guest!;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-black tracking-wide animate-bounce">
            <Swords className="w-4 h-4" />
            FRIEND CONNECTED!
          </div>

          <div className="text-xs text-slate-400">
            Room Code: <span className="font-mono font-black text-amber-300">{matchedRoom.roomCode}</span>
          </div>

          {/* Head-to-Head Split Card */}
          <div className="w-full grid grid-cols-2 gap-3 relative py-2">
            {/* My Side */}
            <div className="bg-slate-800/90 border border-amber-500/40 rounded-2xl p-3 flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                {mePlayer.avatar}
              </div>
              <div className="font-extrabold text-xs text-slate-100 truncate w-full">{mePlayer.name}</div>
              <div className="text-[10px] text-amber-400 font-mono font-bold">{mePlayer.rankPoints} LP</div>
              <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{mePlayer.targetExam}</div>
            </div>

            {/* Center VS Badge */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 border-2 border-slate-900 flex items-center justify-center font-black text-xs text-white shadow-xl z-20">
              VS
            </div>

            {/* Friend Side */}
            <div className="bg-slate-800/90 border border-indigo-500/40 rounded-2xl p-3 flex flex-col items-center text-center">
              <div className="w-13 h-13 rounded-full bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center text-2xl shadow-md mb-1.5">
                {oppPlayer.avatar}
              </div>
              <div className="font-extrabold text-xs text-slate-100 truncate w-full">{oppPlayer.name}</div>
              <div className="text-[10px] text-indigo-400 font-mono font-bold">{oppPlayer.rankPoints} LP</div>
              <div className="text-[9px] text-slate-400 mt-1 line-clamp-1">{oppPlayer.targetExam}</div>
            </div>
          </div>

          {/* Big Countdown to Battle */}
          <div className="pt-2">
            <div className="text-4xl font-black text-amber-400 font-mono animate-ping">
              {countdown > 0 ? countdown : 'DUEL!'}
            </div>
            <div className="text-xs text-slate-400 mt-1">Entering Live Vocab Battle...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-lg">
              {view === 'create' ? '🏠' : '🔑'}
            </div>
            <div>
              <h3 className="font-black text-slate-100 text-sm sm:text-base tracking-wide">
                {view === 'create' ? 'Create Friend Room' : 'Join Friend Room'}
              </h3>
              <p className="text-[11px] text-slate-400">1v1 Real-Time Vocab Duel</p>
            </div>
          </div>

          <button
            onClick={view === 'create' ? handleCancelRoom : onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 flex items-center justify-center border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers if not yet generated */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => {
              soundManager.playTap();
              setView('create');
            }}
            className={`py-2 rounded-lg transition-all ${
              view === 'create'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => {
              soundManager.playTap();
              setView('join');
            }}
            className={`py-2 rounded-lg transition-all ${
              view === 'join'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Join by Code
          </button>
        </div>

        {/* VIEW 1: CREATE ROOM */}
        {view === 'create' && (
          <div className="space-y-4 pt-1 text-center flex flex-col items-center">
            {isCreating || !createdRoom ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-300 font-medium">Generating Room Code...</span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-extrabold tracking-wider">
                    Your Room Code
                  </span>
                  {/* Big Stylized Room Code Display */}
                  <div className="bg-slate-950 border-2 border-indigo-500/60 rounded-2xl py-3 px-6 shadow-inner flex items-center justify-center">
                    <span className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-widest select-all">
                      {createdRoom.roomCode}
                    </span>
                  </div>
                </div>

                {/* Animated Pulsing Status */}
                <div className="py-2 flex flex-col items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl z-10">
                      {player.avatar}
                    </div>
                    <div className="absolute inset-0 rounded-full border border-indigo-400 animate-ping opacity-30"></div>
                  </div>
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                    <span>Waiting for friend to join...</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Share this 6-letter code with your friend</p>
                </div>

                {/* Action Buttons: Copy Code & Share */}
                <div className="grid grid-cols-2 gap-2 w-full pt-1">
                  <button
                    onClick={handleCopyCode}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleShareCode}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-indigo-950/60"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{shareSuccess ? 'Shared!' : 'Share Code'}</span>
                  </button>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelRoom}
                  className="text-xs text-slate-400 hover:text-red-400 font-bold pt-1 transition-colors"
                >
                  Cancel Room
                </button>
              </>
            )}
          </div>
        )}

        {/* VIEW 2: JOIN ROOM */}
        {view === 'join' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5 text-center">
              <label className="text-xs text-slate-300 font-bold block">
                Enter your friend's 6-character code
              </label>
              <input
                type="text"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value.toUpperCase());
                  setJoinError(null);
                }}
                placeholder="e.g. 7KX4P9"
                className="w-full bg-slate-950 border-2 border-indigo-500/50 focus:border-amber-400 focus:outline-none rounded-2xl py-3 px-4 text-center font-mono text-2xl font-black tracking-widest text-amber-300 uppercase placeholder:text-slate-600 placeholder:text-base placeholder:tracking-normal"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {joinError && (
              <div className="bg-red-950/80 border border-red-500/60 rounded-xl p-2.5 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-medium leading-tight">{joinError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={isJoining || joinCodeInput.trim().length < 4}
                className={`w-full py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  joinCodeInput.trim().length >= 4 && !isJoining
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 border-amber-300 shadow-lg shadow-orange-950/60 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Room...</span>
                  </>
                ) : (
                  <>
                    <Swords className="w-4 h-4" />
                    <span>Join Room</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setView('create');
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 font-bold transition-colors"
              >
                Or Create a New Room
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
