import React, { useState, useEffect, useMemo } from 'react';
import { PlayerProfile, LeaderboardUser } from '../types';
import { 
  getDeterministicBots, 
  subscribeToRealLeaderboardUsers, 
  buildMergedLeaderboard, 
  syncUserToLeaderboard,
  INCLUDE_BOTS_IN_RANKLIST
} from '../services/leaderboardService';
import { soundManager } from '../utils/audio';
import { 
  Trophy, 
  Shield, 
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
  Target
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT, ADS_ENABLED } from '../services/adSenseService';
import { 
  CATEGORY_CADRE_CONFIGS, 
  resolveExamCategoryKey, 
  ExamCategoryKey,
  CategoryCadreConfig 
} from '../utils/cadreCategoryService';
import { UserAvatar } from './UserAvatar';
import { DailyChallengeCard } from './DailyChallengeCard';

interface LeaderboardViewProps {
  player: PlayerProfile;
  isPremium?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ player, isPremium = false }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'tiers'>('leaderboard');
  const [realUsers, setRealUsers] = useState<LeaderboardUser[]>([]);

  // Category determination
  const userCategoryKey = useMemo<ExamCategoryKey>(() => {
    return resolveExamCategoryKey(player.targetExam);
  }, [player.targetExam]);

  const [selectedCategoryKey, setSelectedCategoryKey] = useState<ExamCategoryKey>(userCategoryKey);

  // Synchronize if user targetExam updates
  useEffect(() => {
    setSelectedCategoryKey(userCategoryKey);
  }, [userCategoryKey]);

  const activeCategoryConfig: CategoryCadreConfig = useMemo(() => {
    return CATEGORY_CADRE_CONFIGS[selectedCategoryKey] || CATEGORY_CADRE_CONFIGS['SSC'];
  }, [selectedCategoryKey]);

  // 1. Subscribe to real Firestore users in real-time & sync current player
  useEffect(() => {
    syncUserToLeaderboard(player);
    const unsubscribe = subscribeToRealLeaderboardUsers((users) => {
      setRealUsers(users);
    });

    return () => {
      unsubscribe();
    };
  }, [player]);

  // 2. Deterministic base bots kept available for matchmaking or future toggle
  const baseBots = useMemo(() => getDeterministicBots(), []);

  // 3. Build single real-player leaderboard (bots excluded per user request)
  const mergedLeaderboard = useMemo(() => {
    return buildMergedLeaderboard(baseBots, realUsers, player, INCLUDE_BOTS_IN_RANKLIST);
  }, [baseBots, realUsers, player]);

  const totalAspirantsCount = mergedLeaderboard.length;

  // 4. Find current user's position in the merged leaderboard
  const myIndex = useMemo(() => {
    const idx = mergedLeaderboard.findIndex(
      (u) => u.isCurrentUser || u.id === player.id
    );
    return idx !== -1 ? idx : 0;
  }, [mergedLeaderboard, player.id]);

  const currentUserEntry = mergedLeaderboard[myIndex];
  const userRank = currentUserEntry ? currentUserEntry.rank : 1;
  const isInTop10 = myIndex < 10;

  // 5. Percentile calculation across active real players
  const exactPercentile = useMemo(() => {
    if (totalAspirantsCount <= 1) return 100;
    const candidatesBelow = Math.max(0, totalAspirantsCount - userRank);
    return Math.min(
      99.9,
      Math.max(1.0, (candidatesBelow / (totalAspirantsCount - 1)) * 100)
    );
  }, [totalAspirantsCount, userRank]);

  // 6. Only show Top 10 for the primary leaderboard list
  const top10List = useMemo(() => {
    return mergedLeaderboard.slice(0, 10);
  }, [mergedLeaderboard]);

  // 7. Live Match Bracket (show players near the user's rank)
  const bracketSlice = useMemo(() => {
    if (mergedLeaderboard.length <= 1) return [];
    const start = Math.max(0, myIndex - 2);
    const end = Math.min(mergedLeaderboard.length, myIndex + 3);
    return mergedLeaderboard.slice(start, end);
  }, [mergedLeaderboard, myIndex]);

  // 8. Next Higher LP target calculation (one rank directly above the current user)
  const nextTargetInfo = useMemo(() => {
    if (myIndex <= 0 || !mergedLeaderboard[myIndex - 1]) return null;
    
    const playerAbove = mergedLeaderboard[myIndex - 1];
    const diff = playerAbove.rankPoints - player.rankPoints;
    const lpNeeded = diff > 0 ? diff + 1 : 10;

    return {
      lpNeeded,
      targetRank: playerAbove.rank,
    };
  }, [mergedLeaderboard, myIndex, player.rankPoints]);

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 pb-8 max-w-5xl mx-auto w-full">
      {/* Daily Challenge Card at top of ranks */}
      <DailyChallengeCard player={player} />

      {/* Top Standings Banner */}
      <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar
              photoURL={player.photoURL}
              avatar={player.avatar}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shadow-sm flex items-center justify-center text-xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-100">{player.name}</span>
                <span className="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                  🇮🇳 IN
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span className="text-amber-400 font-bold font-mono">{player.rankPoints} LP</span>
                <span>•</span>
                <span className="truncate max-w-[150px]">{player.tierTitle}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Leaderboard Rank</div>
            <div className="text-base font-black text-amber-400 font-mono leading-none mt-0.5">
              #{userRank.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              of {totalAspirantsCount.toLocaleString()} {totalAspirantsCount === 1 ? 'aspirant' : 'aspirants'}
            </div>
          </div>
        </div>

        {/* Micro Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center text-xs">
          <div className="bg-slate-900/60 rounded-xl p-1.5 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Percentile</div>
            <div className="font-mono font-bold text-amber-300 text-[11px]">
              {totalAspirantsCount <= 1 ? 'Top 1%ile' : `${exactPercentile.toFixed(1)}%ile`}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-1.5 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Standing</div>
            <div className="font-mono font-bold text-slate-200 text-[11px]">
              {userRank === 1 ? 'Rank #1 (Top)' : `Rank #${userRank}`}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-1.5 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Win Rate</div>
            <div className="font-mono font-bold text-emerald-400 text-[11px]">
              {player.accuracyRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-850 p-1 rounded-xl border border-slate-800 text-xs font-bold shadow-sm">
        <button
          onClick={() => {
            soundManager.playTap();
            setActiveTab('leaderboard');
          }}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'leaderboard' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Leaderboard</span>
        </button>

        <button
          onClick={() => {
            soundManager.playTap();
            setActiveTab('tiers');
          }}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'tiers' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Cadres & Perks</span>
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <div className="space-y-3">
          {/* PODIUM */}
          {mergedLeaderboard.length > 0 && (
            <div className={`grid gap-2 items-stretch ${
              mergedLeaderboard.length >= 3 
                ? 'grid-cols-3' 
                : mergedLeaderboard.length === 2 
                ? 'grid-cols-2 max-w-md mx-auto w-full' 
                : 'grid-cols-1 max-w-xs mx-auto w-full'
            }`}>
              {/* Rank 2 (Silver) - Shown on left in 3-column mode */}
              {mergedLeaderboard.length >= 3 && mergedLeaderboard[1] && (
                <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">#2</div>
                  <UserAvatar
                    photoURL={mergedLeaderboard[1].photoURL}
                    avatar={mergedLeaderboard[1].avatar}
                    className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xl mb-1.5 shadow-sm"
                  />
                  <div className="font-bold text-xs text-slate-200 truncate w-full">
                    {mergedLeaderboard[1].name}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                    {mergedLeaderboard[1].rankPoints} LP
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold Highlighted) */}
              {mergedLeaderboard[0] && (
                <div className="bg-slate-850/90 border border-amber-500/80 rounded-2xl p-3 flex flex-col items-center justify-center text-center relative shadow-lg shadow-amber-500/5">
                  <div className="text-[10px] font-extrabold text-amber-400 mb-1">👑 #1 RANK</div>
                  <UserAvatar
                    photoURL={mergedLeaderboard[0].photoURL}
                    avatar={mergedLeaderboard[0].avatar}
                    className="w-10 h-10 rounded-full bg-slate-800 border border-amber-400/80 flex items-center justify-center text-2xl mb-1.5 shadow-sm"
                  />
                  <div className="font-extrabold text-xs text-amber-200 truncate w-full">
                    {mergedLeaderboard[0].name}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-black mt-0.5">
                    {mergedLeaderboard[0].rankPoints} LP
                  </div>
                </div>
              )}

              {/* Rank 2 - Shown on right in 2-column mode */}
              {mergedLeaderboard.length === 2 && mergedLeaderboard[1] && (
                <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">#2</div>
                  <UserAvatar
                    photoURL={mergedLeaderboard[1].photoURL}
                    avatar={mergedLeaderboard[1].avatar}
                    className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xl mb-1.5 shadow-sm"
                  />
                  <div className="font-bold text-xs text-slate-200 truncate w-full">
                    {mergedLeaderboard[1].name}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                    {mergedLeaderboard[1].rankPoints} LP
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {mergedLeaderboard.length >= 3 && mergedLeaderboard[2] && (
                <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">#3</div>
                  <UserAvatar
                    photoURL={mergedLeaderboard[2].photoURL}
                    avatar={mergedLeaderboard[2].avatar}
                    className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xl mb-1.5 shadow-sm"
                  />
                  <div className="font-bold text-xs text-slate-200 truncate w-full">
                    {mergedLeaderboard[2].name}
                  </div>
                  <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                    {mergedLeaderboard[2].rankPoints} LP
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state when only 1 player */}
          {mergedLeaderboard.length === 1 && (
            <div className="text-center py-2.5 px-3 bg-slate-850/40 border border-slate-800/60 rounded-xl text-[11px] text-slate-400">
              You hold the #1 spot on the real players leaderboard! As new aspirants play matches, their ranks will update here live.
            </div>
          )}

          {/* TOP 10 RANKED LIST ITEMS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Top 10 Rankings
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Showing {top10List.length} of {totalAspirantsCount}
              </span>
            </div>

            {top10List.map((user) => {
              const isMe = user.isCurrentUser || user.id === player.id;
              return (
                <div
                  key={user.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    isMe
                      ? 'bg-slate-800/90 border-amber-500/70 text-slate-100 shadow-sm'
                      : 'bg-slate-850/70 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 font-mono font-extrabold text-slate-400 text-left text-xs">
                      #{user.rank}
                    </span>
                    <UserAvatar
                      photoURL={user.photoURL}
                      avatar={user.avatar}
                      className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-lg shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate flex items-center gap-1.5">
                        <span className="truncate">{user.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          {user.countryCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px] sm:max-w-xs">
                        {user.targetExam}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono font-black text-amber-400 text-xs">
                      {user.rankPoints} LP
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                      {user.winRate}% Win
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE NEIGHBORHOOD BRACKET (Players near your rank) */}
          {bracketSlice.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {userRank === 1 
                      ? 'Your Standing & Nearest Rivals' 
                      : isInTop10 
                      ? 'Your Live Rank Bracket' 
                      : 'Your Live Rank Bracket (Below Top 10)'}
                  </span>
                </div>
                {nextTargetInfo ? (
                  <span className="text-[10px] text-amber-400 font-medium">
                    +{nextTargetInfo.lpNeeded} LP to reach #{nextTargetInfo.targetRank}
                  </span>
                ) : userRank === 1 && mergedLeaderboard[1] ? (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    +{Math.max(0, player.rankPoints - mergedLeaderboard[1].rankPoints)} LP lead over #2
                  </span>
                ) : null}
              </div>

              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-2 space-y-1.5">
                {bracketSlice.map((neighbor) => {
                  const isMe = neighbor.isCurrentUser || neighbor.id === player.id;
                  if (isMe) {
                    return (
                      <div 
                        key={neighbor.id}
                        className="p-2.5 rounded-xl bg-slate-800/90 border border-amber-500/80 text-amber-200 flex items-center justify-between text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono font-black text-amber-400 w-12 text-left">
                            #{neighbor.rank.toLocaleString()}
                          </span>
                          <UserAvatar
                            photoURL={player.photoURL}
                            avatar={player.avatar}
                            className="w-6 h-6 rounded-full bg-slate-800 border border-amber-400/50 flex items-center justify-center text-xs shrink-0"
                          />
                          <span className="font-black text-slate-100 truncate">
                            {player.name} (You)
                          </span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-mono font-black text-amber-400">
                            {neighbor.rankPoints} LP
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={neighbor.id}
                      className="p-2 rounded-xl bg-slate-850/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-slate-500 w-12 text-left">
                          #{neighbor.rank.toLocaleString()}
                        </span>
                        <UserAvatar
                          photoURL={neighbor.photoURL}
                          avatar={neighbor.avatar}
                          className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xs shrink-0"
                        />
                        <span className="font-medium text-slate-300 truncate">
                          {neighbor.name}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-400 shrink-0 ml-2">
                        {neighbor.rankPoints} LP
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Cadres / Promotion Tiers Guide Dynamic By 4 Exam Categories */
        <div className="space-y-3.5">
          {/* 4 Category Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['ssc', 'defence', 'banking', 'railways'] as ExamCategoryKey[]).map((catKey) => {
              const isSelected = selectedCategoryKey === catKey;
              const isUserGoal = userCategoryKey === catKey;
              const cat = CATEGORY_CADRE_CONFIGS[catKey];
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setSelectedCategoryKey(catKey);
                  }}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between border ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-950/20 font-black'
                      : 'bg-slate-850/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{cat.icon}</span>
                    <span>{cat.shortName}</span>
                  </span>
                  {isUserGoal && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                      isSelected ? 'bg-slate-950 text-cyan-400' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      Goal
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Promotion Cadres Hierarchy Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCategoryConfig.cadres.map((cadre, i) => {
              const isCurrentTier = 
                player.rankPoints >= cadre.minLP && 
                player.rankPoints <= cadre.maxLP &&
                selectedCategoryKey === userCategoryKey;

              return (
                <div
                  key={i}
                  className={`rounded-2xl p-4 space-y-2.5 flex flex-col justify-between transition-all relative ${
                    isCurrentTier
                      ? 'bg-gradient-to-b from-amber-950/40 via-slate-850 to-slate-900 border-2 border-amber-500 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/40'
                      : 'bg-slate-850/80 border border-slate-800'
                  }`}
                >
                  {isCurrentTier && (
                    <div className="absolute -top-2.5 left-4 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <span>📍 Your Cadre</span>
                    </div>
                  )}

                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-extrabold text-xs sm:text-sm text-amber-300 leading-tight">
                        {cadre.title}
                      </div>
                      <span className="text-[11px] font-mono bg-slate-800/90 text-amber-400 px-2.5 py-0.5 rounded-full border border-slate-700/80 font-bold shrink-0">
                        {cadre.lpRange}
                      </span>
                    </div>

                    {cadre.perks && cadre.perks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {cadre.perks.map((cp, cpIdx) => (
                          <div key={cpIdx} className="flex items-start gap-1.5 text-xs text-slate-300">
                            <span className="text-amber-400/90 text-[11px] leading-tight shrink-0 mt-0.5">✦</span>
                            <span className="leading-snug">{cp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AdSense / AdMob Banner Slot (Free users only, gated by ADS_ENABLED) */}
      {ADS_ENABLED && !isPremium && (
        <div className="pt-2">
          <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" isPremium={isPremium} />
        </div>
      )}
    </div>
  );
};
