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
  isAdmin = false,
}) => {
  return (
    <header className="w-full bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
      {/* User Rank & Avatar */}
      <button
        onClick={onOpenProfile}
        className="flex items-center gap-2 text-left group hover:opacity-90 transition-opacity"
      >
        <div className="relative">
          {player.photoURL ? (
            <img
              src={player.photoURL}
              alt={player.name}
              className="w-9 h-9 rounded-full object-cover shadow-md border border-amber-300/60"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-lg shadow-md border border-amber-300/40">
              {player.avatar}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-[9px] font-bold px-1 rounded-full border border-indigo-400">
            Lv.{player.level}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors truncate max-w-[110px] sm:max-w-[150px]">
              {extractCleanUserName(player.name, player.email)}
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-mono hidden xs:inline">
              🇮🇳 IN
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-400/90 font-medium">
            <Shield className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{player.rankPoints} LP</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 truncate max-w-[70px] sm:max-w-[100px]">{player.tierTitle.replace(/[^\w\s]/gi, '')}</span>
          </div>
        </div>
      </button>

      {/* Center/Right Stats, Streak, Premium Button & Sound Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Daily Streak Indicator */}
        <button
          onClick={() => {
            soundManager.playTap();
            onOpenStreak();
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all shadow-inner border ${
            dailyStreak.currentStreak > 0
              ? 'bg-orange-950/80 border-orange-600/70 text-orange-300 hover:border-orange-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
          title={`Daily Streak: ${dailyStreak.currentStreak} Days (Resets to 0 if 1 day missed)`}
        >
          <Flame className={`w-3.5 h-3.5 shrink-0 ${
            dailyStreak.currentStreak > 0 
              ? 'fill-orange-500 text-orange-400 animate-bounce' 
              : 'text-slate-500'
          }`} />
          <span className="font-mono">{dailyStreak.currentStreak}d</span>
        </button>

        {/* Premium Badge / Button */}
        <button
          onClick={() => {
            soundManager.playTap();
            onOpenPremium();
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
            subscription.isPremium
              ? 'bg-purple-950/80 border border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/40'
              : 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white shadow-purple-950/50 active:scale-95 animate-pulse'
          }`}
          title={subscription.isPremium ? 'View Premium Benefits' : 'Upgrade to Premium'}
        >
          <Crown className={`w-3.5 h-3.5 ${subscription.isPremium ? 'text-purple-300 fill-purple-300/30' : 'text-amber-300 fill-amber-300/40'}`} />
          <span className="text-[11px] tracking-tight">
            {subscription.isPremium ? 'VIP' : 'PRO'}
          </span>
        </button>

        {/* Admin Quick Portal Access Icon */}
        {isAdmin && onOpenAdminImporter && (
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenAdminImporter();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30 transition-all cursor-pointer animate-pulse"
            title="Open Admin PYQ PDF Importer"
          >
            <span>📁</span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold hidden sm:inline">PYQ Import</span>
          </button>
        )}

        {/* Audio Toggle */}
        <button
          onClick={() => {
            soundManager.playTap();
            onToggleSound();
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition-colors shrink-0"
          title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>
    </header>
  );
};
