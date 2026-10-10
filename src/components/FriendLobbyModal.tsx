import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Share2, 
  X, 
  Swords, 
  ArrowRight, 
  Radio, 
  Sparkles, 
  Crown, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Zap,
  HelpCircle,
  Filter,
  ShieldCheck,
  LogIn,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  KeyRound,
  WifiOff
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { 
  PlayerProfile, 
  QuestionCategory, 
  ExamType, 
  Question, 
  FriendLobby 
} from '../types';
import { soundManager } from '../utils/audio';
import { isAndroidCapacitor } from '../utils/platform';
import { validateProperEmail } from '../utils/emailValidator';
import { openExternalUrl } from '../utils/externalLinks';
import { UserAvatar } from './UserAvatar';
import { 
  createFriendLobby, 
  joinFriendLobby, 
  subscribeToFriendLobby, 
  launchFriendLobbyDuel, 
  leaveOrCancelLobby,
  fetchLiveRoomQuestions,
  FetchLiveRoomQuestionsResult
} from '../services/friendLobbyService';
import { 
  signInWithGoogle, 
  signInWithGoogleRedirect, 
  signInWithEmailPassword,
  registerWithEmailPassword,
  sendPasswordReset,
  getFriendlyAuthErrorMessage 
} from '../services/firebaseService';
import { 
  EXAM_FAMILY_PILLS, 
  EXAM_FAMILY_SUB_TAGS, 
  normalizeFilterToFamily, 
  getExamFilterDisplayName 
} from '../utils/examFamilyUtils';

interface FriendLobbyModalProps {
  player: PlayerProfile;
  currentUser?: FirebaseUser | null;
  initialCategory: QuestionCategory | 'mixed';
  initialExam: ExamType;
  initialCode?: string;
  onUserChange?: (user: FirebaseUser | null) => void;
  onSelectPlayOnline?: () => void;
  onClose: () => void;
  onStartMatch: (
    opponent: PlayerProfile, 
    questions: Question[], 
    roomId: string
  ) => void;
}

export const FriendLobbyModal: React.FC<FriendLobbyModalProps> = ({
  player,
  currentUser,
  initialCategory,
  initialExam,
  initialCode = '',
  onUserChange,
  onSelectPlayOnline,
  onClose,
  onStartMatch,
}) => {
  const network = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  
  // Auth state for Sign-In Gate
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [emailAuthMode, setEmailAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState<boolean>(false);

  // Create Room Configuration State
  const [category, setCategory] = useState<QuestionCategory | 'mixed'>(initialCategory);
  const [exam, setExam] = useState<ExamType>(initialExam);
  const [roundCount, setRoundCount] = useState<number>(20);
  
  // Active Lobby State
  const [activeLobby, setActiveLobby] = useState<FriendLobby | null>(null);
  const activeLobbyRef = useRef<FriendLobby | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createElapsedSec, setCreateElapsedSec] = useState<number>(0);
  const [isStartingDuel, setIsStartingDuel] = useState<boolean>(false);
  
  // Guest match launch & failure retry state
  const [isGuestLoadingBattle, setIsGuestLoadingBattle] = useState<boolean>(false);
  const [guestBattleError, setGuestBattleError] = useState<string | null>(null);
  const [guestBattlePermissionDenied, setGuestBattlePermissionDenied] = useState<boolean>(false);
  
  // Join Room Input State
  const [joinCodeDigits, setJoinCodeDigits] = useState<string[]>(() => {
    if (initialCode && initialCode.length === 6) {
      return initialCode.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  
  // Clipboard copied status
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  // Input refs for 6-digit auto-advance
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMatchLaunchedRef = useRef<boolean>(false);

  // Categories config
  const categoriesList: { id: QuestionCategory | 'mixed'; label: string; icon: string }[] = [
    { id: 'mixed', label: 'All Mixed Pool', icon: '⚡' },
    { id: 'synonyms', label: 'Synonyms', icon: '🔁' },
    { id: 'antonyms', label: 'Antonyms', icon: '🔀' },
    { id: 'ows', label: 'One Word Substitution', icon: '🎯' },
    { id: 'idioms', label: 'Idioms & Phrases', icon: '📜' },
  ];

  // Exams config - 4 primary families
  const examsList = EXAM_FAMILY_PILLS;

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Rotate create lobby loading messages based on elapsed time (0-6s, 6-12s, 12-18s, 18s+)
  useEffect(() => {
    if (!isCreating) {
      setCreateElapsedSec(0);
      return;
    }
    setCreateElapsedSec(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCreateElapsedSec(elapsed);
    }, 250);

    return () => clearInterval(interval);
  }, [isCreating]);

  const getCreateLoadingMessage = (): string => {
    if (createElapsedSec >= 18) {
      return 'Still working — this is taking a little longer than usual...';
    }
    if (createElapsedSec >= 12) {
      return 'Almost there — connecting your room...';
    }
    if (createElapsedSec >= 6) {
      return 'Setting up your private lobby...';
    }
    return 'Generating your 6-digit room...';
  };

  // Handle Real-Time Lobby State Updates
  const handleLobbyUpdate = (lobby: FriendLobby) => {
    const prevGuest = activeLobbyRef.current?.guest;
    activeLobbyRef.current = lobby;
    setActiveLobby(lobby);

    // If friend joined
    if (lobby.guest && !prevGuest) {
      soundManager.playMatchFound();
    }

    // If match was launched by host
    if (lobby.status === 'in_progress' && lobby.roomId && lobby.guest && !isMatchLaunchedRef.current) {
      const g4 = Date.now();
      console.log(`[FriendLobbyTiming] G4: Guest receives in_progress lobby snapshot at ${g4} (roomId: ${lobby.roomId})`);

      const isGuestPlayer = lobby.host.id !== player.id;
      if (isGuestPlayer) {
        handleGuestFetchAndLaunch(lobby, g4);
      }
    }
  };

  // Attempt to fetch authoritative questions for the Guest from live_rooms/{roomId}
  const handleGuestFetchAndLaunch = async (lobbyToLaunch: FriendLobby, g4Timestamp = Date.now()) => {
    if (!lobbyToLaunch.roomId) return;
    const roomId = lobbyToLaunch.roomId;
    const opponent = lobbyToLaunch.host;

    setIsGuestLoadingBattle(true);
    setGuestBattleError(null);
    setGuestBattlePermissionDenied(false);

    try {
      const result: FetchLiveRoomQuestionsResult = await fetchLiveRoomQuestions(roomId, player, g4Timestamp);
      if (result.success && result.questions && result.questions.length > 0) {
        // Authoritative questions fetched successfully from live_rooms
        isMatchLaunchedRef.current = true;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('vclash_friend_lobby_role', 'guest');
        }
        soundManager.playMatchFound();

        const g5 = Date.now();
        console.log(`[FriendLobbyTiming] G5: guest onStartMatch called in ${g5 - g4Timestamp}ms from G4 (${result.questions.length} questions)`);
        onStartMatch(opponent, result.questions, roomId);
      } else {
        // Failed: DO NOT generate replacement questions. DO NOT launch with different question set.
        // Keep Guest in the lobby/start-loading state with a concise retry option.
        setIsGuestLoadingBattle(false);
        setGuestBattleError(result.error || "Couldn't load the battle. Tap to retry.");
        setGuestBattlePermissionDenied(Boolean(result.isPermissionDenied));
        isMatchLaunchedRef.current = false;
      }
    } catch (err: any) {
      console.error('[FriendLobby] Unexpected error in handleGuestFetchAndLaunch:', err);
      setIsGuestLoadingBattle(false);
      setGuestBattleError("Couldn't load the battle. Tap to retry.");
      isMatchLaunchedRef.current = false;
    }
  };

  // Handle Google 1-Tap Sign-In from Friend Lobby Gate
  const handleGoogleSignInGate = async (forceRedirect = false) => {
    try {
      soundManager.playTap();
      setIsSigningIn(true);
      setAuthError(null);
      setAuthSuccessMessage(null);
      const user = await signInWithGoogle(forceRedirect);
      if (user) {
        soundManager.playCorrect();
        if (onUserChange) {
          onUserChange(user);
        }
      } else if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('vclash_auth_redirect_pending') === '1') {
        setAuthSuccessMessage('Connecting to Google Sign-In...');
      }
    } catch (err: any) {
      console.error('Friend Lobby Sign-In Error:', err);
      setAuthError(getFriendlyAuthErrorMessage(err));
    } finally {
      if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('vclash_auth_redirect_pending') !== '1') {
        setIsSigningIn(false);
      }
    }
  };

  // Handle Email / Password Sign-In & Sign-Up
  const handleEmailAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    
    const emailValidation = validateProperEmail(cleanEmail);
    if (!emailValidation.isValid) {
      setAuthError(emailValidation.error || 'Please enter a valid email address.');
      return;
    }

    if (emailAuthMode !== 'forgot' && !passwordInput) {
      setAuthError('Please enter your password.');
      return;
    }
    if (emailAuthMode === 'signup' && passwordInput.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    try {
      soundManager.playTap();
      setIsSubmittingEmail(true);
      setAuthError(null);
      setAuthSuccessMessage(null);

      if (emailAuthMode === 'signin') {
        const user = await signInWithEmailPassword(cleanEmail, passwordInput);
        soundManager.playCorrect();
        if (onUserChange) {
          onUserChange(user);
        }
      } else if (emailAuthMode === 'signup') {
        const user = await registerWithEmailPassword(
          cleanEmail, 
          passwordInput, 
          nameInput.trim() || undefined
        );
        soundManager.playCorrect();
        if (onUserChange) {
          onUserChange(user);
        }
      } else if (emailAuthMode === 'forgot') {
        await sendPasswordReset(cleanEmail);
        soundManager.playCorrect();
        setAuthSuccessMessage(`Password reset link sent to ${cleanEmail}! Check your inbox.`);
        setEmailAuthMode('signin');
      }
    } catch (err: any) {
      console.error('Email Auth Error in Friend Lobby:', err);
      setAuthError(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  // 1. Create a 6-Digit Lobby
  const handleCreateLobby = async () => {
    if (!network.isOnline) {
      soundManager.playWrong();
      return;
    }
    const c0 = Date.now();
    console.log(`[FriendLobbyTiming] AC0: Android Create button tapped at ${c0} (isAndroid: ${isAndroidCapacitor()})`);
    setIsCreating(true);
    soundManager.playTap();

    try {
      const res = await createFriendLobby(player, category, exam, roundCount, c0);
      if (res.success && res.code && res.lobby) {
        activeLobbyRef.current = res.lobby;
        setActiveLobby(res.lobby);
        const ac10Time = Date.now();
        console.log(`[FriendLobbyTiming] AC10: FriendLobbyModal setActiveLobby called / Room Ready rendered in +${ac10Time - c0}ms from tap (Code: ${res.code})`);

        // Subscribe to real-time updates for this code
        if (unsubscribeRef.current) unsubscribeRef.current();
        unsubscribeRef.current = subscribeToFriendLobby(res.code, handleLobbyUpdate);
      }
    } catch (err) {
      console.error('Error generating room:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // 2. Join a 6-Digit Lobby
  const handleJoinLobby = async () => {
    if (!network.isOnline) {
      setJoinError('You are offline. Please connect to the internet to join a friend room.');
      soundManager.playWrong();
      return;
    }
    const fullCode = joinCodeDigits.join('').trim();
    if (fullCode.length !== 6) {
      setJoinError('Please enter all 6 digits of the room code.');
      return;
    }

    const j0 = Date.now();
    console.log(`[FriendLobbyTiming] J0: Join tapped at ${j0} for code: ${fullCode}`);

    setIsJoining(true);
    setJoinError(null);
    soundManager.playTap();

    try {
      const res = await joinFriendLobby(fullCode, player, j0);
      if (res.success && res.lobby) {
        activeLobbyRef.current = res.lobby;
        setActiveLobby(res.lobby);
        const j4 = Date.now();
        console.log(`[FriendLobbyTiming] J4: joined lobby UI rendered in ${j4 - j0}ms from tap`);
        soundManager.playMatchFound();

        // Subscribe to real-time updates
        if (unsubscribeRef.current) unsubscribeRef.current();
        unsubscribeRef.current = subscribeToFriendLobby(fullCode, handleLobbyUpdate);
      } else {
        setJoinError(res.error || 'Unable to join room. Please check the code.');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join lobby.');
    } finally {
      setIsJoining(false);
    }
  };

  // 3. Host Launches the Duel
  const handleStartLobbyMatch = async () => {
    if (!activeLobby || !activeLobby.guest) return;

    const s0 = Date.now();
    console.log(`[FriendLobbyTiming] S0: Start tapped at ${s0}`);

    setIsStartingDuel(true);
    soundManager.playTap();

    try {
      const res = await launchFriendLobbyDuel(activeLobby, s0);
      if (!res.success) {
        alert(res.error || 'Failed to launch duel.');
        setIsStartingDuel(false);
        return;
      }

      // Host starts immediately locally after successful launch
      // Prevent double-launch: set isMatchLaunchedRef.current BEFORE calling onStartMatch
      if (!isMatchLaunchedRef.current) {
        isMatchLaunchedRef.current = true;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('vclash_friend_lobby_role', 'host');
        }
        soundManager.playMatchFound();

        const opponent = activeLobby.guest;
        const questions = (activeLobby.questions && activeLobby.questions.length > 0)
          ? activeLobby.questions
          : (res.questions || []);
        const roomId = res.roomId || activeLobby.roomId;

        onStartMatch(opponent, questions, roomId);
      }
    } catch (err) {
      console.error('Error launching duel:', err);
      setIsStartingDuel(false);
    }
  };

  // Copy Room Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    soundManager.playTap();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Direct Share Link
  const handleCopyLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vocabclash.in';
    const inviteUrl = `${origin}?lobby=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    soundManager.playTap();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vocabclash.in';
    const inviteUrl = `${origin}?lobby=${code}`;
    const message = `⚔️ *VocabClash 1v1 Battle Challenge!*\n\nJoin my private room to duel on SSC & Govt Exam English PYQs in real-time!\n\n🔑 *Room Code:* ${code}\n🔗 *Direct Join Link:* ${inviteUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    openExternalUrl(whatsappUrl);
  };

  // 6-Digit PIN input handling
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const newDigits = [...joinCodeDigits];

    if (clean.length > 1) {
      // Handle pasting whole 6 digits into single box
      const chars = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setJoinCodeDigits(newDigits);
      const nextFocus = Math.min(chars.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = clean;
    setJoinCodeDigits(newDigits);
    setJoinError(null);

    // Auto-advance to next input box
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !joinCodeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Leave / Cancel Room
  const handleLeaveLobby = () => {
    soundManager.playTap();
    if (activeLobby) {
      const isHost = activeLobby.host.id === player.id;
      leaveOrCancelLobby(activeLobby.code, player.id, isHost);
    }
    setActiveLobby(null);
    setIsGuestLoadingBattle(false);
    setGuestBattleError(null);
    setGuestBattlePermissionDenied(false);
    onClose();
  };

  const isHost = activeLobby ? activeLobby.host.id === player.id : true;
  const isGuest = activeLobby ? activeLobby.guest?.id === player.id : false;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 my-auto">
        
        {/* Ambient background glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleLeaveLobby}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1 pb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[11px] font-bold tracking-wide uppercase">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Play with Friend</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Custom 1v1 Friend Lobby
          </h2>
          <p className="text-xs text-slate-400">
            Duel your friends, study partners, or coaching mates on identical PYQs
          </p>
        </div>

        {/* Offline Notice Banner */}
        {!network.isOnline && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-rose-200">Device is Offline</p>
              <p className="text-[11px] text-rose-300/80">Connect to the internet to create or join a friend lobby.</p>
            </div>
          </div>
        )}

        {/* IF IN ACTIVE LOBBY: SHOW LIVE STAGE */}
        {activeLobby ? (
          <div className="space-y-4 pt-1">
            
            {/* 6-Digit Room Code Banner */}
            <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-4 text-center shadow-inner relative overflow-hidden">
              <div className="text-[11px] font-bold text-amber-300/90 tracking-wider uppercase flex items-center justify-center gap-1.5">
                <span>Room Code</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800/60 rounded">
                  SHARE WITH FRIEND
                </span>
              </div>

              {/* Huge Monospace 6-Digit Boxes */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-3">
                {activeLobby.code.split('').map((digit, idx) => (
                  <div
                    key={idx}
                    className="w-10 h-12 sm:w-12 sm:h-14 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-black font-mono text-amber-300 shadow-lg shadow-amber-950/30"
                  >
                    {digit}
                  </div>
                ))}
              </div>

              {/* Action Buttons: Copy Code, WhatsApp, Link */}
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={() => handleCopyCode(activeLobby.code)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  onClick={() => handleShareWhatsApp(activeLobby.code)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 border border-emerald-500/60 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp Invite</span>
                </button>

                <button
                  onClick={() => handleCopyLink(activeLobby.code)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Match Rules & Pool Summary Badge */}
            <div className="flex items-center justify-between text-xs bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200">Exam:</span>
                <span className="text-sky-300 font-bold">{activeLobby.exam}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200">Topic:</span>
                <span className="text-amber-300 font-bold capitalize">{activeLobby.category}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200">Length:</span>
                <span className="text-emerald-300 font-bold">{activeLobby.roundCount} Qs</span>
              </div>
            </div>

            {/* 2-Player Head-to-Head Visual Stage */}
            <div className="grid grid-cols-2 gap-3 relative py-2">
              
              {/* Host Side */}
              <div className="bg-slate-800/80 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-lg relative">
                <div className="absolute -top-2.5 px-2 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black uppercase rounded-full shadow-sm flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Host
                </div>
                <UserAvatar
                  photoURL={activeLobby.host.photoURL}
                  avatar={activeLobby.host.avatar || '👨‍💼'}
                  name={activeLobby.host.name}
                  className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-md my-1.5 shrink-0 overflow-hidden"
                />
                <div className="font-extrabold text-sm text-slate-100 truncate w-full">
                  {activeLobby.host.name}
                </div>
                <div className="text-[11px] text-amber-300 font-mono font-bold">
                  {activeLobby.host.rankPoints} LP
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate w-full">
                  {activeLobby.host.targetExam}
                </div>
                <div className="mt-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ready to Battle
                </div>
              </div>

              {/* Center VS Circle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-slate-900 flex items-center justify-center font-black text-xs text-slate-950 shadow-2xl z-20">
                VS
              </div>

              {/* Guest / Friend Side */}
              {activeLobby.guest ? (
                /* Friend Connected */
                <div className="bg-slate-800/80 border border-sky-500/50 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-lg relative animate-in zoom-in-95 duration-200">
                  <div className="absolute -top-2.5 px-2 py-0.5 bg-sky-500 text-white text-[9px] font-black uppercase rounded-full shadow-sm flex items-center gap-1">
                    Challenger
                  </div>
                  <UserAvatar
                    photoURL={activeLobby.guest.photoURL}
                    avatar={activeLobby.guest.avatar || '🎯'}
                    name={activeLobby.guest.name}
                    className="w-14 h-14 rounded-full bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center text-3xl shadow-md my-1.5 shrink-0 overflow-hidden"
                  />
                  <div className="font-extrabold text-sm text-slate-100 truncate w-full">
                    {activeLobby.guest.name}
                  </div>
                  <div className="text-[11px] text-sky-300 font-mono font-bold">
                    {activeLobby.guest.rankPoints} LP
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate w-full">
                    {activeLobby.guest.targetExam}
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </div>
                </div>
              ) : (
                /* Friend Waiting Slot */
                <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center">
                  <div className="relative w-14 h-14 flex items-center justify-center my-1.5">
                    <div className="absolute inset-0 rounded-full border border-sky-500/30 animate-ping opacity-40"></div>
                    <div className="w-12 h-12 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-xl text-slate-500">
                      👥
                    </div>
                  </div>
                  <div className="font-bold text-xs text-slate-300 mt-1">
                    Waiting for Friend...
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Share code <span className="text-amber-300 font-mono font-bold">{activeLobby.code}</span>
                  </p>
                  <div className="mt-2 text-[10px] text-sky-400 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    Listening for joins...
                  </div>
                </div>
              )}

            </div>

            {/* Launch / Waiting Action Button */}
            <div className="pt-2">
              {isHost ? (
                /* Host Controls */
                <button
                  disabled={!activeLobby.guest || isStartingDuel}
                  onClick={handleStartLobbyMatch}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide uppercase flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    activeLobby.guest
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-950/60 active:scale-98 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {isStartingDuel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Launching Duel...</span>
                    </>
                  ) : activeLobby.guest ? (
                    <>
                      <Swords className="w-4 h-4" />
                      <span>START 1V1 DUEL NOW (2/2 READY)</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      <span>Waiting for Friend to Join...</span>
                    </>
                  )}
                </button>
              ) : (
                /* Guest Waiting View */
                guestBattleError ? (
                  <div className="bg-rose-950/80 border border-rose-500/60 rounded-2xl p-3.5 text-center space-y-2.5">
                    <div className="flex items-center justify-center gap-2 text-rose-300 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{guestBattleError}</span>
                    </div>
                    {!guestBattlePermissionDenied && (
                      <button
                        onClick={() => handleGuestFetchAndLaunch(activeLobby)}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Couldn't load the battle. Tap to retry</span>
                      </button>
                    )}
                  </div>
                ) : isGuestLoadingBattle || activeLobby.status === 'in_progress' ? (
                  <div className="bg-slate-950/80 border border-amber-500/50 rounded-2xl p-3.5 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Joining duel battle...</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Synchronizing battle questions with host...
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-950/80 border border-sky-500/40 rounded-2xl p-3.5 text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2 text-sky-300 text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Waiting for Host ({activeLobby.host.name}) to start match...</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      The duel will begin automatically for both of you in real-time.
                    </p>
                  </div>
                )
              )}

              {/* Leave Room Option */}
              <button
                onClick={handleLeaveLobby}
                className="w-full mt-2.5 py-2 text-center text-xs text-slate-400 hover:text-rose-400 transition-colors font-medium cursor-pointer"
              >
                {isHost ? 'Cancel & Close Room' : 'Leave Room'}
              </button>
            </div>

          </div>
        ) : !currentUser ? (
          /* AUTH GATEWAY: REQUIRE SIGN-IN (GOOGLE OR EMAIL & PASSWORD) FOR FRIEND DUELS */
          <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
            {/* Emblem and Header */}
            <div className="text-center space-y-1.5 py-0.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-amber-500 p-0.5 shadow-xl shadow-sky-950/60">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl sm:text-2xl">
                  👥
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[10px] font-bold uppercase tracking-wide">
                  <ShieldCheck className="w-3 h-3 text-sky-400" />
                  <span>Verified 1v1 Aspirant Lobby</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {initialCode ? `Sign in to Join Room #${initialCode}` : 'Sign In to Duel Friends'}
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Sign in with Google or your Email to create private 6-digit rooms and duel study partners with verified stats.
                </p>
              </div>
            </div>

            {/* 3 Value Pillars */}
            <div className="grid grid-cols-3 gap-1.5 text-left">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <div className="text-xs">🛡️</div>
                <div className="text-[10px] font-bold text-slate-200">Real Profile</div>
                <div className="text-[9px] text-slate-400 leading-tight">Unique UID & Stats</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <div className="text-xs">📊</div>
                <div className="text-[10px] font-bold text-slate-200">Live Sync</div>
                <div className="text-[9px] text-slate-400 leading-tight">Instant score & LP</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-0.5">
                <div className="text-xs">⚔️</div>
                <div className="text-[10px] font-bold text-slate-200">PYQ Battles</div>
                <div className="text-[9px] text-slate-400 leading-tight">Synced 1v1 rounds</div>
              </div>
            </div>

            {/* Google 1-Tap Sign-In */}
            <div className="space-y-2 pt-0.5">
              <button
                disabled={isSigningIn || isSubmittingEmail}
                onClick={() => handleGoogleSignInGate(false)}
                className="w-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-900 font-extrabold py-3 px-4 rounded-xl shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer border border-slate-200 text-xs sm:text-sm"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider absolute">
                  Or Continue with Email
                </span>
              </div>

              {/* Email & Password Form Container */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 space-y-3">
                {/* Subtabs: Sign In vs Register vs Reset */}
                <div className="grid grid-cols-2 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setEmailAuthMode('signin');
                      setAuthError(null);
                      setAuthSuccessMessage(null);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      emailAuthMode === 'signin'
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setEmailAuthMode('signup');
                      setAuthError(null);
                      setAuthSuccessMessage(null);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      emailAuthMode === 'signup'
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Create Account</span>
                  </button>
                </div>

                <form onSubmit={handleEmailAuthSubmit} onKeyDown={e => e.stopPropagation()} className="space-y-2.5">
                  {/* Name field for Registration */}
                  {emailAuthMode === 'signup' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Aspirant Name / Nickname
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          placeholder="e.g., Raj / Inspector Rahul"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        placeholder="aspirant@example.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Password Field (only for signin & signup) */}
                  {emailAuthMode !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Password {emailAuthMode === 'signup' && <span className="text-slate-500">(min 6 chars)</span>}
                        </label>
                        {emailAuthMode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playTap();
                              setEmailAuthMode('forgot');
                              setAuthError(null);
                            }}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Forgot Password Mode notice */}
                  {emailAuthMode === 'forgot' && (
                    <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-600/30 text-[11px] text-sky-300 flex items-start gap-2">
                      <KeyRound className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        We will send a password reset link to your email.
                        <button
                          type="button"
                          onClick={() => setEmailAuthMode('signin')}
                          className="block text-sky-400 font-bold underline mt-1 cursor-pointer"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingEmail || isSigningIn}
                    className="w-full bg-gradient-to-r from-sky-500 via-indigo-600 to-indigo-700 hover:from-sky-400 hover:to-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
                  >
                    {isSubmittingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>
                          {emailAuthMode === 'signin' 
                            ? 'Sign In & Enter Friend Lobby' 
                            : emailAuthMode === 'signup' 
                            ? 'Create Account & Enter Lobby' 
                            : 'Send Reset Link'}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Success Message */}
              {authSuccessMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="flex-1">{authSuccessMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-600/50 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="flex-1">{authError}</span>
                </div>
              )}

              {/* Casual Alternative without Login */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">Prefer playing without sign-in?</span>
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onClose();
                    if (onSelectPlayOnline) onSelectPlayOnline();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer flex items-center gap-1"
                >
                  <span>Play Online Ranked</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* IF NOT IN LOBBY & SIGNED IN: SHOW CREATE VS JOIN TABS */
          <div className="space-y-4 pt-1">
            
            {/* Top Mode Segmented Tabs */}
            <div className="grid grid-cols-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('create');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Room</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('join');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'join'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Join with Code</span>
              </button>
            </div>

            {/* TAB 1: CREATE ROOM */}
            {activeTab === 'create' ? (
              <div className="space-y-3.5">
                
                {/* Exam Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-cyan-400" /> Target Govt Exam:
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {normalizeFilterToFamily(exam) === 'all'
                        ? 'All Board PYQs'
                        : normalizeFilterToFamily(exam) === 'ssc'
                        ? 'All SSC Exams'
                        : normalizeFilterToFamily(exam) === 'banking'
                        ? 'All Banking Exams'
                        : 'All Defence Exams'}
                    </span>
                  </div>
                  
                  {/* Slidable Family Row (No 2 rows) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                    {examsList.map(item => {
                      const isSelected = (item.id === 'ALL' && normalizeFilterToFamily(exam) === 'all') || (item.family && normalizeFilterToFamily(exam) === item.family);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            soundManager.playTap();
                            setExam(item.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md shadow-cyan-950/60'
                              : 'bg-slate-900/90 text-slate-300 border-slate-750 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Subtle non-touchable preview tags (Compact, no vertical bloat) */}
                  {normalizeFilterToFamily(exam) !== 'all' && EXAM_FAMILY_SUB_TAGS[normalizeFilterToFamily(exam)]?.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-slate-400 select-none pointer-events-none">
                      <span className="text-slate-500 font-semibold shrink-0 text-[10px] uppercase tracking-wider">Includes:</span>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {EXAM_FAMILY_SUB_TAGS[normalizeFilterToFamily(exam)].map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 font-medium text-[10px] whitespace-nowrap shrink-0"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Topic / Section:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {categoriesList.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          soundManager.playTap();
                          setCategory(cat.id);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          category === cat.id
                            ? 'bg-amber-950/50 border-amber-400/80 text-amber-200 ring-1 ring-amber-400/50'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-sm">{cat.icon}</div>
                        <div className="text-xs font-bold truncate mt-0.5">{cat.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Round Length Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Match Length:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        soundManager.playTap();
                        setRoundCount(10);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        roundCount === 10
                          ? 'bg-slate-800 border-amber-400 text-white ring-1 ring-amber-400/40'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>⚡ 10 Rounds</span>
                        <span className="text-[10px] text-amber-400 font-mono">Speed Blitz</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">~3 mins duel</div>
                    </button>

                    <button
                      onClick={() => {
                        soundManager.playTap();
                        setRoundCount(20);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        roundCount === 20
                          ? 'bg-slate-800 border-amber-400 text-white ring-1 ring-amber-400/40'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>⚔️ 20 Rounds</span>
                        <span className="text-[10px] text-amber-400 font-mono">Full Battle</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Comprehensive PYQs</div>
                    </button>
                  </div>
                </div>

                {/* Create Room Button */}
                <button
                  disabled={isCreating}
                  onClick={handleCreateLobby}
                  className="w-full mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 font-black py-3.5 px-4 rounded-2xl shadow-xl shadow-orange-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-slate-950" />
                      <span className="text-xs sm:text-sm font-black normal-case text-center leading-snug">
                        {getCreateLoadingMessage()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="uppercase tracking-wide">Create 6-Digit Room</span>
                    </>
                  )}
                </button>

              </div>
            ) : (
              /* TAB 2: JOIN ROOM */
              <div className="space-y-4 py-2">
                
                <div className="text-center space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Enter Friend's 6-Digit Room Code:
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Ask your friend for their 6-digit code or check WhatsApp
                  </p>
                </div>

                {/* 6-Digit PIN Boxes */}
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-2">
                  {joinCodeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={e => handleDigitChange(idx, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(idx, e)}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl sm:text-3xl font-black font-mono rounded-xl bg-slate-950 border-2 transition-all outline-none ${
                        digit
                          ? 'border-sky-400 text-sky-300 shadow-md shadow-sky-950/50'
                          : 'border-slate-700 text-slate-100 focus:border-sky-400'
                      }`}
                    />
                  ))}
                </div>

                {/* Error Message */}
                {joinError && (
                  <div className="bg-rose-950/60 border border-rose-600/40 rounded-xl p-2.5 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{joinError}</span>
                  </div>
                )}

                {/* Join Button */}
                <button
                  disabled={isJoining || joinCodeDigits.join('').length !== 6}
                  onClick={handleJoinLobby}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide uppercase flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                    joinCodeDigits.join('').length === 6 && !isJoining
                      ? 'bg-gradient-to-r from-sky-500 via-indigo-600 to-sky-500 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-950/60 active:scale-98'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Joining Room...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Friend's Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
