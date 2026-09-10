import React from 'react';
import { Flame, Volume2, VolumeX, Shield, Crown } from 'lucide-react';
import { PlayerProfile, UserSubscription, DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { extractCleanUserName } from '../utils/nameHelper';

interface TopBarProps {
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenProfile: () => void;
  onOpenPremium: () => void;
  onOpenStreak: () => void;
  onOpenStats?: () => void;
  onOpenTour?: () => void;
  onOpenAdminImporter?: () => void;
  onOpenAdminArticles?: () => void;
  isAdmin?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  player,
  subscription,
  dailyStreak,
  soundEnabled,
  onToggleSound,
  onOpenProfile,
  onOpenPremium,
  onOpenStreak,
  onOpenStats,
  onOpenAdminImporter,
  onOpenAdminArticles,
  isAdmin = false,
}) => {
  return (
    <header className="w-full bg-slate-950/95 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3.5 pt-[max(0.65rem,env(safe-area-inset-top))] border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0 shadow-lg shadow-black/20 min-h-[3.75rem] sm:min-h-[4.25rem]">
      {/* User Rank & Avatar */}
      <button
        onClick={onOpenProfile}
        className="flex items-center gap-2.5 sm:gap-3 text-left group hover:opacity-95 transition-all min-w-0 flex-1 max-w-[52%] sm:max-w-[280px] md:max-w-none mr-1.5"
      >
        <div className="relative shrink-0 flex items-center justify-center">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.name}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-md border-2 border-amber-400/80 ring-1 ring-amber-400/30"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-xl shadow-md border-2 border-amber-300/70 ring-1 ring-amber-400/30">
              {player.avatar}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full border border-indigo-300/70 shadow-sm leading-none text-white tracking-tight z-10">
            Lv.{player.level}
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-amber-400 transition-colors truncate block leading-tight">
              {extractCleanUserName(player.name, player.email)}
            </span>
            <span className="text-[9px] sm:text-[10px] bg-slate-800/90 text-slate-300 px-1 py-0.5 rounded font-mono hidden xs:inline shrink-0 border border-slate-700/60">
              🇮🇳 IN
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-400/95 font-medium leading-tight mt-0.5">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-300/95 font-mono">{player.rankPoints} LP</span>
          </div>
        </div>
      </button>

      {/* Center/Right Stats, Streak, Premium Button & Sound Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Daily Streak Indicator */}
        <button
          onClick={() => {
            soundManager.playTap();
            onOpenStreak();
          }}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border ${
            dailyStreak.currentStreak > 0
              ? 'bg-orange-950/80 border-orange-500/60 text-orange-300 hover:border-orange-400 hover:bg-orange-900/60'
              : 'bg-slate-800/90 border-slate-700 text-slate-400 hover:bg-slate-800'
          }`}
          title={`Daily Streak: ${dailyStreak.currentStreak} Days (Resets to 0 if 1 day missed)`}
        >
          <Flame className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
            dailyStreak.currentStreak > 0 
              ? 'fill-orange-500 text-orange-400 animate-bounce' 
              : 'text-slate-500'
          }`} />
          <span className="font-mono text-xs font-bold">{dailyStreak.currentStreak}d</span>
        </button>

        {/* Premium Badge / Button */}
        <button
          onClick={() => {
            soundManager.playTap();
            onOpenPremium();
          }}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
            subscription.isPremium
              ? 'bg-purple-950/90 border border-purple-500/80 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.35)] ring-1 ring-purple-400/40'
              : 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white shadow-md shadow-purple-950/50 active:scale-95'
          }`}
          title={subscription.isPremium ? 'View Premium Benefits' : 'Upgrade to Premium'}
        >
          <Crown className={`w-3.5 h-3.5 shrink-0 ${subscription.isPremium ? 'text-purple-300 fill-purple-300/40' : 'text-amber-300 fill-amber-300/50'}`} />
          <span className="text-[11px] sm:text-xs tracking-tight font-black">
            {subscription.isPremium ? 'VIP' : 'PRO'}
          </span>
        </button>

        {/* Admin Quick Portal Access Icons */}
        {isAdmin && (
          <div className="flex items-center gap-1 sm:gap-1.5">
            {onOpenAdminArticles && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  onOpenAdminArticles();
                }}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all cursor-pointer"
                title="Open Articles Editorial Studio (/admin/articles)"
              >
                <span>✍️</span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold hidden md:inline">Articles</span>
              </button>
            )}
            {onOpenAdminImporter && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  onOpenAdminImporter();
                }}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-all cursor-pointer"
                title="Open Admin PYQ PDF Importer"
              >
                <span>📁</span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold hidden md:inline">PYQ Import</span>
              </button>
            )}
          </div>
        )}

        {/* Audio Toggle */}
        <button
          onClick={() => {
            soundManager.playTap();
            onToggleSound();
          }}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700/80 transition-all shrink-0 active:scale-95 shadow-sm"
          title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>
    </header>
  );
};
