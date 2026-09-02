import React, { useState, useEffect, useMemo } from 'react';
import { PlayerProfile, LeaderboardUser } from '../types';
import { 
  getDeterministicBots, 
  subscribeToRealLeaderboardUsers, 
  buildMergedLeaderboard, 
  syncUserToLeaderboard,
  TOTAL_LEADERBOARD_ASPIRANTS
} from '../services/leaderboardService';
import { soundManager } from '../utils/audio';
import { 
  Trophy, 
  Shield, 
  TrendingUp
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';

interface LeaderboardViewProps {
  player: PlayerProfile;
  isPremium?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ player, isPremium = false }) => {
  const [activeTab, setActiveTab] = useState<'all_india' | 'tiers'>('all_india');
  const [realUsers, setRealUsers] = useState<LeaderboardUser[]>([]);

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

  // 2. Load deterministic base bots (~5,480 deterministic competitors)
  const baseBots = useMemo(() => getDeterministicBots(), []);

  // 3. Build single unified merged leaderboard with Standard Competition Ranking
  const mergedLeaderboard = useMemo(() => {
    return buildMergedLeaderboard(baseBots, realUsers, player);
  }, [baseBots, realUsers, player]);

  const totalAspirantsCount = mergedLeaderboard.length;

  // 4. Find current user's position in the merged leaderboard
  const myIndex = useMemo(() => {
    const idx = mergedLeaderboard.findIndex(
      (u) => u.isCurrentUser || u.id === player.id
    );
    return idx !== -1 ? idx : mergedLeaderboard.length - 1;
  }, [mergedLeaderboard, player.id]);

  const currentUserEntry = mergedLeaderboard[myIndex];
  const userRank = currentUserEntry ? currentUserEntry.rank : 4820;
  const isInTop10 = myIndex < 10;

  // 5. Top 10 list for podium & main ranking display
  const top10List = useMemo(() => {
    return mergedLeaderboard.slice(0, 10);
  }, [mergedLeaderboard]);

  // 6. Psychometric Percentile calculation across entire merged pool
  const candidatesBelow = Math.max(0, totalAspirantsCount - userRank);
  const exactPercentile = Math.min(
    99.9,
    Math.max(0.1, (candidatesBelow / totalAspirantsCount) * 100)
  );

  // 7. Live Match Bracket from the SAME merged leaderboard
  const bracketSlice = useMemo(() => {
    if (isInTop10) return [];
    const start = Math.max(0, myIndex - 2);
    const end = Math.min(mergedLeaderboard.length, myIndex + 3);
    return mergedLeaderboard.slice(start, end);
  }, [mergedLeaderboard, myIndex, isInTop10]);

  // 8. Next Higher LP target calculation
  const nextTargetInfo = useMemo(() => {
    if (isInTop10 || myIndex <= 0) return null;
    
    let nextHigher: LeaderboardUser | null = null;
    for (let i = myIndex - 1; i >= 0; i--) {
      if (mergedLeaderboard[i].rankPoints > player.rankPoints) {
        nextHigher = mergedLeaderboard[i];
        break;
      }
    }

    if (!nextHigher) {
      return {
        lpNeeded: 10,
        targetRank: Math.max(1, userRank - 1),
      };
    }

    return {
      lpNeeded: Math.max(1, nextHigher.rankPoints - player.rankPoints + 1),
      targetRank: nextHigher.rank,
    };
  }, [mergedLeaderboard, myIndex, isInTop10, player.rankPoints, userRank]);

  const cadres = [
    { title: '👑 Apex Cadre Officer', lpRange: '4,500+ LP', badge: 'Level 14+', desc: 'Principal Commissioner, Joint Secretary Cadre' },
    { title: '🎖️ Gazetted Officer', lpRange: '3,000 - 4,499 LP', badge: 'Group A', desc: 'AAO, Ministry Section Officer (5400 GP)' },
    { title: '💎 GST & IT Inspector', lpRange: '2,000 - 2,999 LP', badge: '4600 GP', desc: 'Income Tax, Customs & Central Excise, CBI' },
    { title: '🥇 Auditor / Accountant', lpRange: '1,200 - 1,999 LP', badge: '2800 GP', desc: 'CAG Auditor, Postal Assistant, Junior Accounts' },
    { title: '🥈 Assistant / Clerk', lpRange: '600 - 1,199 LP', badge: '2400 GP', desc: 'LDC, Junior Clerk, Sub-Inspector Assistant' },
    { title: '🥉 Govt Job Aspirant', lpRange: '0 - 599 LP', badge: 'Cadet', desc: 'Starting preparation journey & foundational drill' },
  ];

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 pb-8 max-w-5xl mx-auto w-full">
      {/* Top Standings Banner */}
      <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {player.photoURL ? (
              <img
                src={player.photoURL}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shadow-sm">
                {player.avatar}
              </div>
            )}
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
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">All-India Rank</div>
            <div className="text-base font-black text-amber-400 font-mono leading-none mt-0.5">
              #{userRank.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              of {totalAspirantsCount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Micro Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center text-xs">
          <div className="bg-slate-900/60 rounded-xl p-1.5 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Percentile</div>
            <div className="font-mono font-bold text-amber-300 text-[11px]">
              {exactPercentile.toFixed(1)}%ile
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-1.5 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Standing</div>
            <div className="font-mono font-bold text-slate-200 text-[11px]">
              {userRank <= 100 
                ? `Top ${Math.max(0.1, (userRank / totalAspirantsCount * 100)).toFixed(1)}%`
                : `AIR #${userRank}`
              }
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
            setActiveTab('all_india');
          }}
          className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'all_india' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Top 10 All-India</span>
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

      {activeTab === 'all_india' ? (
        <div className="space-y-3">
          {/* TOP 3 PODIUM */}
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {/* Rank 2 */}
            {top10List[1] && (
              <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xl mb-1.5 shadow-sm">
                  {top10List[1].avatar}
                </div>
                <div className="font-bold text-xs text-slate-200 truncate w-full">
                  {top10List[1].name}
                </div>
                <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                  {top10List[1].rankPoints} LP
                </div>
              </div>
            )}

            {/* Rank 1 (Gold Highlighted) */}
            {top10List[0] && (
              <div className="bg-slate-850/90 border border-amber-500/80 rounded-2xl p-3 flex flex-col items-center justify-center text-center relative">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-400/80 flex items-center justify-center text-2xl mb-1.5 shadow-sm">
                  {top10List[0].avatar}
                </div>
                <div className="font-extrabold text-xs text-amber-200 truncate w-full">
                  {top10List[0].name}
                </div>
                <div className="text-xs text-amber-400 font-mono font-black mt-0.5">
                  {top10List[0].rankPoints} LP
                </div>
              </div>
            )}

            {/* Rank 3 */}
            {top10List[2] && (
              <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xl mb-1.5 shadow-sm">
                  {top10List[2].avatar}
                </div>
                <div className="font-bold text-xs text-slate-200 truncate w-full">
                  {top10List[2].name}
                </div>
                <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                  {top10List[2].rankPoints} LP
                </div>
              </div>
            )}
          </div>

          {/* RANKED LIST ITEMS */}
          <div className="space-y-2">
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
                    {isMe && player.photoURL ? (
                      <img
                        src={player.photoURL}
                        alt="avatar"
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-lg shrink-0">
                        {user.avatar}
                      </div>
                    )}
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
                      {user.winRate}% Win ({user.winStreak} streak)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE NEIGHBORHOOD BRACKET (From the exact same merged list) */}
          {!isInTop10 && bracketSlice.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                  <span>Your Live Match Bracket</span>
                </div>
                {nextTargetInfo && (
                  <span className="text-[10px] text-amber-400 font-medium">
                    +{nextTargetInfo.lpNeeded} LP to reach #{nextTargetInfo.targetRank}
                  </span>
                )}
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
                          <span className="font-mono font-black text-amber-400 w-14 text-left">
                            #{neighbor.rank.toLocaleString()}
                          </span>
                          <span className="shrink-0">{player.avatar}</span>
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
                        <span className="font-mono font-bold text-slate-500 w-14 text-left">
                          #{neighbor.rank.toLocaleString()}
                        </span>
                        <span className="shrink-0">{neighbor.avatar}</span>
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
        /* Cadres / Promotion Tiers Guide */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {cadres.map((cadre, i) => (
            <div
              key={i}
              className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold text-xs sm:text-sm text-amber-300">{cadre.title}</div>
                <span className="text-[10px] font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-slate-700 font-bold shrink-0">
                  {cadre.lpRange}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{cadre.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* AdSense / AdMob Banner Slot (Free users only) */}
      {!isPremium && (
        <div className="pt-2">
          <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" isPremium={isPremium} />
        </div>
      )}
    </div>
  );
};
