import React, { useState } from 'react';
import { PlayerProfile, ExamType, UserSubscription, DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { User as FirebaseUser } from 'firebase/auth';
import { GoogleAuthCard } from './GoogleAuthCard';
import { VocabClashLogo } from './VocabClashLogo';
import { extractCleanUserName } from '../utils/nameHelper';
import { 
  User, 
  X, 
  Award, 
  Shield, 
  Flame, 
  Target, 
  Check, 
  Edit3, 
  TrendingUp,
  Crown,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  LifeBuoy,
  Mail,
  Scale,
  BarChart3,
  BookOpen
} from 'lucide-react';
import { SupportModal } from './SupportModal';
import { LegalAccountModal } from './LegalAccountModal';

export const TARGET_EXAM_GROUPS = [
  {
    group: '🏛️ SSC CGL 2026 - Specific Posts (Group B & C)',
    exams: [
      'SSC CGL - GST Inspector (Central Excise / 4600 GP)',
      'SSC CGL - Income Tax Inspector (CBDT / 4600 GP)',
      'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
      'SSC CGL - Assistant Audit Officer (AAO - Gazetted 4800 GP)',
      'SSC CGL - Assistant Accounts Officer (AAO - Gazetted 4800 GP)',
      'SSC CGL - Preventive Officer (Customs / 4600 GP)',
      'SSC CGL - Examiner (Customs / 4600 GP)',
      'SSC CGL - Sub-Inspector (CBI / 4600 GP)',
      'SSC CGL - Enforcement Officer (ED / 4600 GP)',
      'SSC CGL - Sub-Inspector (NIA / 4200 GP)',
      'SSC CGL - Divisional Accountant (CAG / 4200 GP)',
      'SSC CGL - Statistical Investigator Gr-II (4200 GP)',
      'SSC CGL - Auditor / Accountant (CAG & CGDA / 2800 GP)',
      'SSC CGL - Tax Assistant (CBDT & CBIC / 2400 GP)',
      'SSC CGL - Upper Division Clerk / UDC (2400 GP)',
    ],
  },
  {
    group: '👮 SSC Other Examinations',
    exams: [
      'SSC CPO - Sub-Inspector (Delhi Police / CAPF)',
      'SSC CHSL - Postal Assistant / DEO / LDC (10+2)',
      'SSC MTS & Havaldar (CBIC/CBN)',
      'SSC Selection Post (Phase Exam)',
    ],
  },
  {
    group: '🚆 Railways (RRB)',
    exams: [
      'RRB NTPC - Station Master / Traffic Assistant',
      'RRB NTPC - Goods Guard / Senior Clerk',
      'RRB Senior Section Engineer / JE',
      'RRB ALP & Technician / Group D',
    ],
  },
  {
    group: '🏦 Banking & Insurance',
    exams: [
      'Bank PO (SBI / IBPS Probationary Officer)',
      'Bank Clerk (SBI / IBPS Junior Associate)',
      'RBI Grade B Officer / RBI Assistant',
      'NABARD / SEBI Grade A Officer',
      'LIC AAO & Specialist Officer',
    ],
  },
  {
    group: '🎖️ Defense & UPSC',
    exams: [
      'CDS & NDA Officer Entry (IMA / INA / AFA)',
      'AFCAT Flying & Ground Duty Officer',
      'UPSC EPFO (EO / AO / APFC)',
      'UPSC CAPF (Assistant Commandant)',
    ],
  },
];

export const ALL_TARGET_EXAMS = TARGET_EXAM_GROUPS.flatMap(g => g.exams);

interface ProfileModalProps {
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  currentUser: FirebaseUser | null;
  isSyncing: boolean;
  onClose: () => void;
  onUpdatePlayer: (updated: Partial<PlayerProfile>) => void;
  onResetStats?: () => void;
  onOpenPremium: () => void;
  onOpenStreak: () => void;
  onOpenStats?: () => void;
  onOpenTour?: () => void;
  onUserChange?: (user: FirebaseUser | null) => void;
  onManualSync?: () => void;
  onSignOut?: () => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  player,
  subscription,
  dailyStreak,
  currentUser,
  isSyncing,
  onClose,
  onUpdatePlayer,
  onResetStats,
  onOpenPremium,
  onOpenStreak,
  onOpenStats,
  onOpenTour,
  onUserChange,
  onManualSync,
  onSignOut,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [name, setName] = useState<string>(player.name);
  const [avatar, setAvatar] = useState<string>(player.avatar);
  const [targetExam, setTargetExam] = useState<string>(player.targetExam);

  const avatars = ['👨‍💼', '👩‍🎓', '👮‍♂️', '👨‍🏫', '👩‍⚖️', '🧑‍💻', '👨‍✈️', '👩‍🔬'];

  const handleSave = () => {
    soundManager.playTap();
    onUpdatePlayer({
      name: name.trim() || player.name,
      avatar,
      targetExam,
    });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-3.5 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
            <User className="w-4 h-4 text-amber-400" />
            Aspirant Profile & Cadre
          </h3>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Authentication & Cloud Sync Card */}
        <GoogleAuthCard
          currentUser={currentUser}
          isSyncing={isSyncing}
          onUserChange={onUserChange}
          onManualSync={onManualSync}
          onSignOut={onSignOut}
        />

        {/* Admin PYQ Ingestion Pipeline Button (Prominent for Admin) */}
        {(currentUser?.email?.toLowerCase() === 'nathchinmoy777@gmail.com' || (currentUser?.email && currentUser.email.toLowerCase().includes('admin'))) && (
          <button
            onClick={() => {
              soundManager.playTap();
              if (typeof window !== 'undefined') {
                window.location.hash = 'admin-pyq';
              }
              onClose();
            }}
            className="w-full py-2.5 px-3.5 bg-gradient-to-r from-amber-950/90 to-amber-900/90 hover:from-amber-900 hover:to-amber-850 border-2 border-amber-500/80 rounded-2xl text-amber-200 text-xs font-black flex items-center justify-between transition shadow-lg shadow-amber-950/50 cursor-pointer animate-pulse"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/50 flex items-center justify-center text-sm">
                📁
              </div>
              <div className="text-left">
                <div className="text-amber-300 font-extrabold flex items-center gap-1.5">
                  <span>PYQ PDF Importer</span>
                  <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                    Admin
                  </span>
                </div>
                <div className="text-[10px] text-amber-400/80 font-normal">Extract & Review Govt Exam Questions</div>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-bold bg-amber-500/20 px-2 py-1 rounded-xl border border-amber-500/40">
              Open →
            </span>
          </button>
        )}

        {/* VIP Membership Banner in Profile */}
        <div 
          onClick={() => {
            soundManager.playTap();
            onOpenPremium();
          }}
          className="bg-gradient-to-r from-purple-950/90 via-indigo-950/80 to-purple-900/90 border border-purple-600/60 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:border-purple-400 transition-all shadow-lg shadow-purple-950/40"
        >
          <div className="flex items-center gap-2.5">
            <VocabClashLogo size="md" className="rounded-xl ring-2 ring-purple-400/50 shadow-md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">
                  {subscription.isPremium ? 'VIP Active' : 'VocabClash VIP'}
                </span>
                <span className="text-[9px] bg-purple-900 text-purple-200 border border-purple-500/50 px-1.5 py-0.2 rounded font-bold uppercase">
                  {subscription.isPremium ? (subscription.planName || 'Active') : 'Ad-Free'}
                </span>
              </div>
              <div className="text-[10px] text-purple-300">
                {subscription.isPremium
                  ? (subscription.renewalDate || 'Premium Member')
                  : 'Always Ad-Free • 1v1 Arena Pass'}
              </div>
            </div>
          </div>

          <div className="text-purple-300 text-xs font-bold flex items-center gap-0.5">
            <span>{subscription.isPremium ? 'Manage' : 'View'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-850 border border-slate-700 rounded-2xl p-4 text-center space-y-2">
          <div className="relative w-16 h-16 mx-auto">
            {player.photoURL && !isEditing ? (
              <img
                src={player.photoURL}
                alt={player.name}
                className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-amber-300 mx-auto"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-3xl shadow-lg border-2 border-amber-300 mx-auto">
                {avatar}
              </div>
            )}
            {isEditing && (
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full text-xs">
                <Edit3 className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Avatar picker when editing */}
          {isEditing && (
            <div className="flex justify-center gap-1.5 flex-wrap pt-1">
              {currentUser?.photoURL && (
                <button
                  onClick={() => {
                    onUpdatePlayer({ photoURL: currentUser.photoURL || undefined });
                  }}
                  className="px-2 py-1 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-500 text-[10px] font-bold flex items-center gap-1"
                >
                  <img
                    src={currentUser.photoURL}
                    alt="google avatar"
                    className="w-4 h-4 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <span>Google Photo</span>
                </button>
              )}
              {avatars.map(av => (
                <button
                  key={av}
                  onClick={() => {
                    setAvatar(av);
                    onUpdatePlayer({ photoURL: undefined });
                  }}
                  className={`w-8 h-8 rounded-full text-lg flex items-center justify-center border ${
                    avatar === av ? 'border-amber-400 bg-amber-950/60 scale-110' : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-1">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter Aspirant Name"
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center text-sm font-bold text-slate-100 w-full focus:outline-none focus:border-amber-400"
              />
              {currentUser?.displayName && currentUser.displayName !== name && (
                <button
                  type="button"
                  onClick={() => setName(currentUser.displayName || name)}
                  className="text-[10px] text-sky-400 hover:underline font-medium"
                >
                  Use Google Name: {currentUser.displayName}
                </button>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-base font-extrabold text-slate-100">
                {extractCleanUserName(player.name, currentUser?.email || player.email)}
              </h2>
              {currentUser?.email && (
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{currentUser.email}</div>
              )}
            </div>
          )}

          <div className="text-xs font-semibold text-amber-400 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>{player.tierTitle}</span>
          </div>

          {isEditing ? (
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                🎯 Select Your Target Post / Exam:
              </label>
              <select
                value={targetExam}
                onChange={e => setTargetExam(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-300 w-full font-semibold focus:outline-none focus:border-amber-400 shadow-inner"
              >
                {TARGET_EXAM_GROUPS.map((groupObj, gIdx) => (
                  <optgroup
                    key={gIdx}
                    label={groupObj.group}
                    className="bg-slate-950 font-bold text-amber-300 py-1"
                  >
                    {groupObj.exams.map(ex => (
                      <option
                        key={ex}
                        value={ex}
                        className="bg-slate-900 text-slate-200 font-medium py-1"
                      >
                        {ex}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/80 inline-block max-w-full">
              Target:{' '}
              <span className="text-emerald-400 font-semibold truncate">
                {player.targetExam}
              </span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
          <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <div className="text-[9px] text-slate-400">Total LP</div>
            <div className="font-mono font-extrabold text-amber-400 text-xs mt-0.5">
              {player.rankPoints}
            </div>
          </div>

          <button
            onClick={() => {
              if (onOpenStats) {
                soundManager.playTap();
                onClose();
                onOpenStats();
              }
            }}
            className="bg-slate-800/80 hover:bg-slate-750 p-2 rounded-xl border border-amber-500/30 hover:border-amber-400/80 transition-all text-left group"
            title="Click to view full accuracy & performance analytics"
          >
            <div className="text-[9px] text-slate-400 flex items-center justify-between">
              <span>PYQ Score</span>
              <BarChart3 className="w-2.5 h-2.5 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-mono font-extrabold text-sky-400 text-xs mt-0.5 text-center">
              {player.pyqScore || 0}
            </div>
          </button>

          <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <div className="text-[9px] text-slate-400">Matches</div>
            <div className="font-mono font-extrabold text-slate-200 text-xs mt-0.5">
              {player.matchesPlayed}
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
              onOpenStreak();
            }}
            className="bg-orange-950/60 p-2 rounded-xl border border-orange-600/60 hover:border-orange-400 transition-colors"
          >
            <div className="text-[9px] text-orange-300">Streak 🔥</div>
            <div className="font-mono font-extrabold text-orange-400 text-xs mt-0.5">
              {dailyStreak.currentStreak}d
            </div>
          </button>
        </div>

        {/* Detailed Performance Analytics Shortcut */}
        {onOpenStats && (
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
              onOpenStats();
            }}
            className="w-full bg-slate-850 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400/60 p-2.5 rounded-2xl flex items-center justify-between text-left transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-100 group-hover:text-amber-300">
                  Performance & Daily Accuracy Graph
                </div>
                <div className="text-[10px] text-slate-400">
                  Total Solved, Right/Wrong counts & monthly trend
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        )}


        {/* Badges Earned */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-300">Honors & Badges:</div>
          <div className="flex flex-wrap gap-1.5">
            {player.badges && player.badges.length > 0 ? (
              player.badges.map((badge, idx) => (
                <span
                  key={idx}
                  className="bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-xl text-[11px] font-medium"
                >
                  {badge}
                </span>
              ))
            ) : (
              <span className="bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-xl text-[11px]">
                🏛️ SSC Aspirant
              </span>
            )}
            {player.matchesPlayed >= 10 && (
              <span className="bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                ⚔️ 10+ Duels Veteran
              </span>
            )}
            {player.winStreak >= 3 && (
              <span className="bg-orange-950/80 border border-orange-700/60 text-orange-300 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                🔥 {player.winStreak}-Streak Hot
              </span>
            )}
            {dailyStreak.currentStreak >= 7 && (
              <span className="bg-amber-950/80 border border-amber-700/60 text-amber-300 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                🏆 7-Day Discipline
              </span>
            )}
          </div>
        </div>

        {/* How VocabClash Works Guide Button */}
        {onOpenTour && !isEditing && (
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenTour();
            }}
            className="w-full bg-gradient-to-r from-sky-950/80 to-indigo-950/80 hover:from-sky-900/80 hover:to-indigo-900/80 border border-sky-600/50 text-sky-200 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <div className="text-left">
                <div>App Guide & Rules</div>
                <div className="text-[10px] text-sky-400 font-normal">How 1v1 duels, LP & Mistake Vault work</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-sky-400" />
          </button>
        )}

        {/* 24/7 Help & Support Button */}
        {!isEditing && (
          <button
            onClick={() => {
              soundManager.playTap();
              setShowSupportModal(true);
            }}
            className="w-full bg-gradient-to-r from-slate-850 to-slate-800 hover:from-slate-800 hover:to-slate-750 border border-slate-700/90 text-slate-200 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between shadow-sm transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-slate-100 font-bold flex items-center gap-1.5">
                  <span>Help & Aspirant Support</span>
                  <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-800/80 px-1.5 py-0.2 rounded font-mono font-normal">
                    24/7
                  </span>
                </div>
                <div className="text-[10px] text-sky-400 font-mono">support@vocabclash.in</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {/* ⚖️ Legal & Account Button */}
        {!isEditing && (
          <button
            onClick={() => {
              soundManager.playTap();
              setShowLegalModal(true);
            }}
            className="w-full bg-gradient-to-r from-slate-850 to-slate-800 hover:from-slate-800 hover:to-slate-750 border border-slate-700/90 text-slate-200 font-bold p-2.5 rounded-xl text-xs flex items-center justify-between shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-slate-100 font-bold">
                  ⚖ Legal & Account
                </div>
                <div className="text-[10px] text-slate-400">Privacy, Terms & Account Settings</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {/* Edit / Save Action */}
        <div className="space-y-2">
          {isEditing ? (
            <button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>SAVE CHANGES</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              <span>EDIT PROFILE & TARGET EXAM</span>
            </button>
          )}

          {/* Admin PYQ Ingestion Pipeline Link (Admin UID/Email Only) */}
          {(currentUser?.email === 'Nathchinmoy777@gmail.com' || (currentUser?.email && currentUser.email.toLowerCase().includes('admin'))) && (
            <button
              onClick={() => {
                soundManager.playTap();
                if (typeof window !== 'undefined') {
                  window.location.hash = 'admin-pyq';
                }
                onClose();
              }}
              className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center justify-between transition shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span>📁</span>
                <span>Admin PYQ PDF Importer</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-mono">Open Portal →</span>
            </button>
          )}

          {onResetStats && !isEditing && (
            <div>
              {showResetConfirm ? (
                <div className="bg-rose-950/80 border border-rose-600/80 p-2.5 rounded-xl text-center space-y-2 animate-fadeIn">
                  <div className="text-[11px] text-rose-200 font-medium">
                    Reset career stats to 0 LP, 0 matches, and Level 1?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        soundManager.playTap();
                        onResetStats();
                        setShowResetConfirm(false);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1 px-2 rounded-lg text-[10px]"
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-1 px-2 rounded-lg text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full text-center text-[10px] text-slate-500 hover:text-slate-400 py-1 transition-colors"
                >
                  Calibrate / Reset Stats to 0 LP (Fresh Start)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Support & Help Modal */}
        {showSupportModal && (
          <SupportModal
            onClose={() => setShowSupportModal(false)}
            player={player}
            subscription={subscription}
          />
        )}

        {/* ⚖️ Legal & Account Modal */}
        {showLegalModal && (
          <LegalAccountModal
            currentUser={currentUser}
            onClose={() => setShowLegalModal(false)}
            onSignOut={async () => {
              setShowLegalModal(false);
              if (onSignOut) {
                await onSignOut();
              }
            }}
            onAccountDeleted={() => {
              setShowLegalModal(false);
              onClose();
              if (onUserChange) onUserChange(null);
            }}
          />
        )}
      </div>
    </div>
  );
};
