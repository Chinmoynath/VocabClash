import React, { useMemo } from 'react';
import { 
  Zap, 
  Users, 
  Calendar, 
  ArrowRight,
  Swords
} from 'lucide-react';
import { PlayerProfile } from '../types';
import { battleHistoryService } from '../services/battleHistoryService';
import { soundManager } from '../utils/audio';

interface OneVsOneArenaCardProps {
  player: PlayerProfile;
  onStartMatchmaking: (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => void;
  onOpenPlayModeSelector: () => void;
  onOpenFriendLobby: () => void;
}

export const OneVsOneArenaCard: React.FC<OneVsOneArenaCardProps> = ({
  player,
  onStartMatchmaking,
  onOpenPlayModeSelector,
  onOpenFriendLobby,
}) => {
  const stats = useMemo(() => {
    return battleHistoryService.get30DayStats(player);
  }, [player?.matchesPlayed, player?.matchesWon, player?.accuracyRate, player?.level, player?.rankPoints]);

  const handleStartClick = () => {
    soundManager.playTap();
    const mode = player.matchesPlayed === 0 ? 'quick_duel' : '1v1_ranked';
    onStartMatchmaking(mode);
  };

  const handleLiveClick = () => {
    soundManager.playTap();
    onStartMatchmaking(player.matchesPlayed === 0 ? 'quick_duel' : '1v1_ranked');
  };

  const handleFriendsClick = () => {
    soundManager.playTap();
    onOpenFriendLobby();
  };

  return (
    <div 
      id="one-vs-one-arena-hero-card"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c2438] via-[#091b2b] to-[#061420] border border-[#143952] p-5 sm:p-6 shadow-2xl transition-all"
    >
      {/* Subtle Background Glow Accents */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Left Side Faded Vocabulary Background Graphics */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-col items-start gap-3 pointer-events-none select-none z-0 opacity-15 sm:opacity-20 transition-opacity">
        <div className="transform -rotate-12 translate-x-1">
          <span className="font-serif italic font-extrabold text-lg sm:text-2xl tracking-widest text-cyan-300">
            UBIQUITOUS
          </span>
          <span className="block text-[8px] font-mono tracking-tighter text-cyan-400/60 uppercase">
            adj. present everywhere
          </span>
        </div>
        <div className="transform rotate-6 translate-x-3 hidden xs:block">
          <span className="font-sans font-black text-sm sm:text-lg tracking-wider text-teal-300">
            SAGACIOUS
          </span>
        </div>
        <div className="transform -rotate-6 -translate-x-1">
          <span className="font-mono font-bold text-xs sm:text-sm tracking-widest text-sky-200">
            ALACRITY ⚡
          </span>
        </div>
      </div>

      {/* Right Side Faded Vocabulary Background Graphics */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-3 pointer-events-none select-none z-0 opacity-15 sm:opacity-20 transition-opacity">
        <div className="transform rotate-12 -translate-x-1 text-right">
          <span className="font-serif italic font-extrabold text-lg sm:text-2xl tracking-widest text-rose-300">
            EPHEMERAL
          </span>
          <span className="block text-[8px] font-mono tracking-tighter text-rose-400/60 uppercase">
            adj. lasting short time
          </span>
        </div>
        <div className="transform -rotate-6 -translate-x-3 hidden xs:block text-right">
          <span className="font-sans font-black text-sm sm:text-lg tracking-wider text-amber-300">
            TENACIOUS
          </span>
        </div>
        <div className="transform rotate-6 translate-x-1 text-right">
          <span className="font-mono font-bold text-xs sm:text-sm tracking-widest text-pink-200">
            METICULOUS ⚔️
          </span>
        </div>
      </div>

      {/* Top Header Pills Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap mb-4">
        {/* Left Badge: 1V1 ARENA */}
        <div className="inline-flex items-center gap-1.5 bg-[#201520] border border-rose-900/60 text-rose-300 font-extrabold text-[11px] tracking-wider uppercase px-3.5 py-1 rounded-full shadow-xs">
          <span>1V1 ARENA</span>
        </div>

        {/* Right Buttons: Live and Friends */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLiveClick}
            className="bg-[#2d1b24] hover:bg-[#3f2231] active:scale-95 text-rose-100 border border-rose-800/40 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Instant Live Matchmaking"
          >
            <Zap className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            <span>Live</span>
          </button>

          <button
            onClick={handleFriendsClick}
            className="bg-[#102a3a] hover:bg-[#163b52] active:scale-95 text-cyan-200 border border-cyan-800/60 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Play with Friends (6-Digit Room)"
          >
            <Users className="w-3.5 h-3.5 text-cyan-300" />
            <span>Friends</span>
          </button>
        </div>
      </div>

      {/* Main Content Area with Centered Headline and Subtext */}
      <div className="relative z-10 py-2 sm:py-3 text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
          Enter the Vocab Duel
        </h2>
        <p className="text-xs sm:text-sm text-slate-300/90 font-normal leading-relaxed max-w-lg mx-auto">
          Think fast, choose right, build your vocabulary.
        </p>
      </div>

      {/* 30-Day Period Header */}
      <div className="relative z-10 flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-5 mb-2.5">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>Based on last 30 days</span>
      </div>

      {/* Bottom Row: Stats Capsule + Start CTA Button (Side-by-Side on all screen sizes) */}
      <div className="relative z-10 flex flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {/* 3-Column Stats Container */}
        <div className="flex-1 min-w-0 bg-[#091b2a]/95 border border-[#14364f] rounded-2xl px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between divide-x divide-slate-800/80 shadow-inner">
          {/* Wins */}
          <div className="pr-1.5 sm:pr-3 text-center sm:text-left flex-1 min-w-0">
            <div className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white font-mono tracking-tight leading-none whitespace-nowrap">
              {stats.wins}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-emerald-400 mt-1 whitespace-nowrap">
              Wins
            </div>
          </div>

          {/* Battles */}
          <div className="px-1.5 sm:px-3 text-center sm:text-left flex-1 min-w-0">
            <div className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white font-mono tracking-tight leading-none whitespace-nowrap">
              {stats.battles}
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-400 mt-1 whitespace-nowrap">
              Battles
            </div>
          </div>

          {/* Win Rate */}
          <div className="pl-1.5 sm:pl-3 text-center sm:text-left flex-1 min-w-0">
            <div className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white font-mono tracking-tight leading-none whitespace-nowrap">
              {stats.winRateFormatted}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-cyan-400 mt-1 whitespace-nowrap">
              Win rate
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartClick}
          className="bg-[#00708f] hover:bg-[#0087ad] active:scale-95 text-white font-black px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 shadow-xl shadow-cyan-950/80 text-sm sm:text-base transition-all group cursor-pointer shrink-0 border border-cyan-400/30 whitespace-nowrap"
        >
          <span>Start</span>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
