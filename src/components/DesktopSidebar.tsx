import React from 'react';
import { 
  Swords, 
  Target, 
  Trophy, 
  BookOpen, 
  Sparkles, 
  Flame, 
  Shield, 
  Crown, 
  User, 
  HelpCircle,
  Zap,
  LogIn,
  BarChart3
} from 'lucide-react';
import { TabType } from './BottomNavBar';
import { PlayerProfile, UserSubscription, DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { VocabClashLogo } from './VocabClashLogo';
import { extractCleanUserName } from '../utils/nameHelper';
import { User as FirebaseUser } from 'firebase/auth';

interface DesktopSidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  currentUser?: FirebaseUser | null;
  mistakeCount?: number;
  onOpenProfile: () => void;
  onOpenPremium: () => void;
  onOpenStreak: () => void;
  onOpenStats?: () => void;
  onOpenTour?: () => void;
  onOpenGuides?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentTab,
  onSelectTab,
  player,
  subscription,
  dailyStreak,
  currentUser,
  mistakeCount = 0,
  onOpenProfile,
  onOpenPremium,
  onOpenStreak,
  onOpenStats,
  onOpenTour,
  onOpenGuides,
}) => {
  const navItems = [
    {
      id: 'arena' as TabType,
      label: '1v1 Arena',
      sublabel: 'Live Ranked Duels',
      icon: Swords,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
    {
      id: 'practice' as TabType,
      label: 'PYQ Drill',
      sublabel: '24,000+ Exam Pool',
      icon: Target,
      color: 'text-sky-400',
      activeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    },
    {
      id: 'leaderboard' as TabType,
      label: 'All-India Ranks',
      sublabel: 'Leaderboard & Tiers',
      icon: Trophy,
      color: 'text-yellow-400',
      activeBg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    },
    {
      id: 'mistakes' as TabType,
      label: 'Mistake Vault',
      sublabel: 'Spaced Repetition',
      icon: BookOpen,
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      badge: mistakeCount,
    },
    {
      id: 'ai_coach' as TabType,
      label: 'AI Vocab Mentor',
      sublabel: 'Mnemonics & Etymology',
      icon: Sparkles,
      color: 'text-purple-400',
      activeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    },
  ];

  return (
    <aside 
      id="vocabclash-desktop-sidebar"
      aria-label="Main Navigation Sidebar"
      className="hidden md:flex flex-col w-64 lg:w-72 bg-slate-950 border-r border-slate-800/80 p-4 shrink-0 h-full justify-between select-none z-20"
    >
      {/* Top: Brand & Logo */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <VocabClashLogo size="md" className="rounded-xl shadow-md ring-1 ring-amber-400/30" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-white tracking-tight">VocabClash</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                  Govt PYQs
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Arena Active</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  soundManager.playTap();
                  onSelectTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all group ${
                  isActive
                    ? `${item.activeBg} font-bold shadow-sm ring-1 ring-white/10`
                    : 'bg-transparent border-transparent hover:bg-slate-900 hover:border-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-slate-900/90' : 'bg-slate-900/60 group-hover:bg-slate-850'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? item.color : 'text-slate-400 group-hover:text-slate-200'}`} />
                  </div>
                  <div className="min-w-0 truncate">
                    <div className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && item.badge > 0 ? (
                  <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-rose-900 shadow-sm shrink-0">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Quick Stats & User Profile Box */}
      <div className="space-y-3 pt-4 border-t border-slate-800/80">
        
        {/* Quick Streak, Stats & Tour trigger */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenStreak();
            }}
            className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
              dailyStreak.currentStreak > 0
                ? 'bg-orange-950/40 border-orange-600/50 text-orange-300 hover:border-orange-400'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
            title="View Daily Streak Challenge"
          >
            <Flame className={`w-4 h-4 shrink-0 ${dailyStreak.currentStreak > 0 ? 'text-orange-400 fill-orange-400 animate-bounce' : 'text-slate-500'}`} />
            <div className="text-left leading-tight truncate">
              <span className="font-mono">{dailyStreak.currentStreak}d</span> Streak
            </div>
          </button>

          {onOpenGuides ? (
            <button
              onClick={() => {
                soundManager.playTap();
                onOpenGuides();
              }}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-400/70 text-xs font-bold text-slate-200 transition-all text-left group"
              title="SSC Vocabulary Guides & 2018-2025 PYQ Analysis"
            >
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-left leading-tight truncate">
                <span className="text-amber-400 font-bold">Guides</span> Hub
              </div>
            </button>
          ) : onOpenStats ? (
            <button
              onClick={() => {
                soundManager.playTap();
                onOpenStats();
              }}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-400/70 text-xs font-bold text-slate-200 transition-all text-left"
              title="View Daily Solved Questions, Accuracy & Graph"
            >
              <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left leading-tight truncate">
                <span className="text-amber-400 font-mono font-black">{player.pyqScore || 0}</span> Stats
              </div>
            </button>
          ) : onOpenTour ? (
            <button
              onClick={() => {
                soundManager.playTap();
                onOpenTour();
              }}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 transition-all text-left"
              title="Overview & How It Works"
            >
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">Guide</span>
            </button>
          ) : null}
        </div>

        {/* Premium VIP Banner if not VIP */}
        {!subscription.isPremium ? (
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenPremium();
            }}
            className="w-full bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/40 hover:border-purple-400/80 p-2.5 rounded-xl flex items-center justify-between text-left transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/40">
                <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300/40" />
              </div>
              <div>
                <div className="text-xs font-black text-white group-hover:text-purple-200">
                  Upgrade to VIP
                </div>
                <div className="text-[10px] text-purple-300/80">
                  ₹19/mo • Ad-Free + Unlimited
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="bg-purple-950/50 border border-purple-500/40 p-2 rounded-xl flex items-center justify-between text-xs text-purple-300">
            <span className="flex items-center gap-1.5 font-bold">
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40" />
              VIP Member Active
            </span>
            <span className="text-[10px] font-mono bg-purple-900/60 px-1.5 py-0.2 rounded border border-purple-500/30">PRO</span>
          </div>
        )}

        {/* User Card */}
        <div
          onClick={() => {
            soundManager.playTap();
            onOpenProfile();
          }}
          className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              {player.photoURL ? (
                <img
                  src={player.photoURL}
                  alt={player.name}
                  className="w-8 h-8 rounded-full object-cover shadow-sm border border-amber-400/50"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-sm shadow-sm border border-amber-300/40">
                  {player.avatar}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-[8px] font-bold px-1 rounded-full border border-indigo-400">
                Lv.{player.level}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors truncate">
                {extractCleanUserName(player.name, player.email)}
              </div>
              <div className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{player.rankPoints} LP</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 truncate">{player.tierTitle.replace(/[^\w\s]/gi, '')}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
            {currentUser ? '⚙️' : <LogIn className="w-3.5 h-3.5 text-indigo-400" />}
          </div>
        </div>

      </div>
    </aside>
  );
};
