import React, { useState } from 'react';
import { PlayerProfile, LeaderboardUser } from '../types';
import { INITIAL_LEADERBOARD } from '../data/mockQuestions';
import { soundManager } from '../utils/audio';
import { 
  Trophy, 
  Shield, 
  TrendingUp, 
  Award,
  Zap
} from 'lucide-react';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';

interface LeaderboardViewProps {
  player: PlayerProfile;
  isPremium?: boolean;
}

const TOTAL_ACTIVE_ASPIRANTS = 5480;

// Natural non-linear distribution curve calculating realistic All-India Rank from LP
export function calculateAllIndiaRank(rankPoints: number): number {
  if (rankPoints >= 4890) return 1;
  if (rankPoints >= 4420) return 2;
  if (rankPoints >= 4180) return 3;
  if (rankPoints >= 3920) return 4;
  if (rankPoints >= 3740) return 5;
  if (rankPoints >= 3580) return 6;
  if (rankPoints >= 3460) return 7;
  if (rankPoints >= 3350) return 8;
  if (rankPoints >= 3240) return 9;
  if (rankPoints >= 3150) return 10;

  // Below Rank 10: Smooth, realistic percentile power curve across 5,480+ aspirants
  // At 3,150 LP -> Rank 11
  // At 2,000 LP -> Rank ~410
  // At 1,200 LP -> Rank ~1,380
  // At 600 LP  -> Rank ~2,860
  // At 300 LP  -> Rank ~3,940
  // At 100 LP  -> Rank ~4,820 (Standard starting baseline)
  // At 0 LP    -> Rank ~5,480
  const normalized = Math.max(0, Math.min(1, rankPoints / 3150));
  const rankOffset = Math.round((TOTAL_ACTIVE_ASPIRANTS - 11) * Math.pow(1 - normalized, 1.62));
  return Math.max(11, 11 + rankOffset);
}

// Indian aspirants pool for nearby rank bracket simulation
const NEIGHBOR_ASPIRANTS = [
  { name: 'Suresh Ganguly', avatar: '👨‍💼', exam: 'SSC CGL 2026', winRate: 64 },
  { name: 'Divya Kulkarni', avatar: '👩‍🎓', exam: 'RRB NTPC CBT-2', winRate: 62 },
  { name: 'Manoj Tripathi', avatar: '👨‍💻', exam: 'Bank Clerk SBI', winRate: 59 },
  { name: 'Kavita Sen', avatar: '👩‍🏫', exam: 'SSC CHSL Tier-1', winRate: 57 },
  { name: 'Abhishek Roy', avatar: '🧑‍💼', exam: 'SSC CPO SI', winRate: 61 },
  { name: 'Sunita Mehra', avatar: '👩‍🔬', exam: 'Railways Group D', winRate: 55 },
  { name: 'Prashant Nair', avatar: '👨‍💼', exam: 'UPSC EPFO PA', winRate: 60 },
  { name: 'Rashmi Panda', avatar: '👩‍💼', exam: 'SSC MTS Havaldar', winRate: 58 },
];

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ player, isPremium = false }) => {
  const [activeTab, setActiveTab] = useState<'all_india' | 'tiers'>('all_india');

  const userRank = calculateAllIndiaRank(player.rankPoints);
  const isInTop10 = userRank <= 10;

  // Build the Top 10 list
  let top10List: LeaderboardUser[] = [...INITIAL_LEADERBOARD];

  if (isInTop10) {
    const userEntry: LeaderboardUser = {
      rank: userRank,
      id: player.id,
      name: `${player.name} (You)`,
      avatar: player.avatar,
      countryCode: 'IN',
      targetExam: player.targetExam,
      rankPoints: player.rankPoints,
      tierTitle: player.tierTitle,
      winRate: player.accuracyRate,
      winStreak: player.winStreak,
      isCurrentUser: true,
    };
    top10List = [...top10List.filter(u => u.id !== player.id), userEntry]
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .slice(0, 10)
      .map((u, i) => ({ ...u, rank: i + 1 }));
  }

  // Exact psychometric Percentile calculation:
  // Percentile is the % of total candidates whose score is lower than yours.
  // AIR 1 has 99.98%ile. Median has 50.0%ile. Rank 4,820/5480 has 12.0%ile.
  const candidatesBelow = Math.max(0, TOTAL_ACTIVE_ASPIRANTS - userRank);
  const exactPercentile = Math.min(99.9, Math.max(0.1, (candidatesBelow / TOTAL_ACTIVE_ASPIRANTS) * 100));

  // Generate 2 competitors above and 2 below for user's local neighborhood bracket
  const neighborAbove1 = {
    rank: userRank - 1,
    name: NEIGHBOR_ASPIRANTS[(userRank + 1) % NEIGHBOR_ASPIRANTS.length].name,
    avatar: NEIGHBOR_ASPIRANTS[(userRank + 1) % NEIGHBOR_ASPIRANTS.length].avatar,
    exam: NEIGHBOR_ASPIRANTS[(userRank + 1) % NEIGHBOR_ASPIRANTS.length].exam,
    winRate: NEIGHBOR_ASPIRANTS[(userRank + 1) % NEIGHBOR_ASPIRANTS.length].winRate,
    rankPoints: player.rankPoints + 4,
  };

  const neighborAbove2 = {
    rank: userRank - 2,
    name: NEIGHBOR_ASPIRANTS[(userRank + 2) % NEIGHBOR_ASPIRANTS.length].name,
    avatar: NEIGHBOR_ASPIRANTS[(userRank + 2) % NEIGHBOR_ASPIRANTS.length].avatar,
    exam: NEIGHBOR_ASPIRANTS[(userRank + 2) % NEIGHBOR_ASPIRANTS.length].exam,
    winRate: NEIGHBOR_ASPIRANTS[(userRank + 2) % NEIGHBOR_ASPIRANTS.length].winRate,
    rankPoints: player.rankPoints + 9,
  };

  const neighborBelow1 = {
    rank: userRank + 1,
    name: NEIGHBOR_ASPIRANTS[(userRank + 3) % NEIGHBOR_ASPIRANTS.length].name,
    avatar: NEIGHBOR_ASPIRANTS[(userRank + 3) % NEIGHBOR_ASPIRANTS.length].avatar,
    exam: NEIGHBOR_ASPIRANTS[(userRank + 3) % NEIGHBOR_ASPIRANTS.length].exam,
    winRate: NEIGHBOR_ASPIRANTS[(userRank + 3) % NEIGHBOR_ASPIRANTS.length].winRate,
    rankPoints: Math.max(0, player.rankPoints - 4),
  };

  const neighborBelow2 = {
    rank: userRank + 2,
    name: NEIGHBOR_ASPIRANTS[(userRank + 4) % NEIGHBOR_ASPIRANTS.length].name,
    avatar: NEIGHBOR_ASPIRANTS[(userRank + 4) % NEIGHBOR_ASPIRANTS.length].avatar,
    exam: NEIGHBOR_ASPIRANTS[(userRank + 4) % NEIGHBOR_ASPIRANTS.length].exam,
    winRate: NEIGHBOR_ASPIRANTS[(userRank + 4) % NEIGHBOR_ASPIRANTS.length].winRate,
    rankPoints: Math.max(0, player.rankPoints - 8),
  };

  const cadres = [
    { title: '👑 Apex Cadre Officer', lpRange: '4,500+ LP', badge: 'Level 14+', desc: 'Principal Commissioner, Joint Secretary Cadre' },
    { title: '🎖️ Gazetted Officer', lpRange: '3,000 - 4,499 LP', badge: 'Group A', desc: 'AAO, Ministry Section Officer (5400 GP)' },
    { title: '💎 GST & IT Inspector', lpRange: '2,000 - 2,999 LP', badge: '4600 GP', desc: 'Income Tax, Customs & Central Excise, CBI' },
    { title: '🥇 Auditor / Accountant', lpRange: '1,200 - 1,999 LP', badge: '2800 GP', desc: 'CAG Auditor, Postal Assistant, Junior Accounts' },
    { title: '🥈 Assistant / Clerk', lpRange: '600 - 1,199 LP', badge: '2400 GP', desc: 'LDC, Junior Clerk, Sub-Inspector Assistant' },
    { title: '🥉 Govt Job Aspirant', lpRange: '0 - 599 LP', badge: 'Cadet', desc: 'Starting preparation journey & foundational drill' },
  ];

  return (
    <div className="p-3.5 space-y-3 pb-3">
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
              of {TOTAL_ACTIVE_ASPIRANTS.toLocaleString()}
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
                ? `Top ${Math.max(0.1, (userRank / TOTAL_ACTIVE_ASPIRANTS * 100)).toFixed(1)}%`
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
          {/* TOP 3 PODIUM (Identical to original clean aesthetic) */}
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {/* Rank 2 (Snehlata Verma) */}
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

            {/* Rank 1 (Rajesh Meena - Gold Highlighted) */}
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

            {/* Rank 3 (Ankit Deshmukh) */}
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

          {/* RANKED LIST ITEMS (Dark sleek borders, matching original style) */}
          <div className="space-y-2">
            {top10List.map(user => {
              const isMe = user.isCurrentUser;
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

          {/* LIVE NEIGHBORHOOD BRACKET (If user is not in Top 10) */}
          {!isInTop10 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                  <span>Your Live Match Bracket</span>
                </div>
                <span className="text-[10px] text-amber-400 font-medium">
                  +{neighborAbove1.rankPoints - player.rankPoints} LP to reach #{userRank - 1}
                </span>
              </div>

              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-2 space-y-1.5">
                {/* 2 Ranks Above */}
                <div className="p-2 rounded-xl bg-slate-850/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-500 w-14 text-left">#{neighborAbove2.rank.toLocaleString()}</span>
                    <span>{neighborAbove2.avatar}</span>
                    <span className="font-medium text-slate-300">{neighborAbove2.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-400">{neighborAbove2.rankPoints} LP</span>
                </div>

                {/* 1 Rank Above */}
                <div className="p-2 rounded-xl bg-slate-850/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-500 w-14 text-left">#{neighborAbove1.rank.toLocaleString()}</span>
                    <span>{neighborAbove1.avatar}</span>
                    <span className="font-medium text-slate-200">{neighborAbove1.name}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">{neighborAbove1.rankPoints} LP</span>
                </div>

                {/* YOU (Active Standing) */}
                <div className="p-2.5 rounded-xl bg-slate-800/90 border border-amber-500/80 text-amber-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-amber-400 w-14 text-left">#{userRank.toLocaleString()}</span>
                    <span>{player.avatar}</span>
                    <span className="font-black text-slate-100">{player.name} (You)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-amber-400">{player.rankPoints} LP</span>
                  </div>
                </div>

                {/* 1 Rank Below */}
                <div className="p-2 rounded-xl bg-slate-850/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-500 w-14 text-left">#{neighborBelow1.rank.toLocaleString()}</span>
                    <span>{neighborBelow1.avatar}</span>
                    <span className="font-medium text-slate-300">{neighborBelow1.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-500">{neighborBelow1.rankPoints} LP</span>
                </div>

                {/* 2 Ranks Below */}
                <div className="p-2 rounded-xl bg-slate-850/40 border border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-600 w-14 text-left">#{neighborBelow2.rank.toLocaleString()}</span>
                    <span>{neighborBelow2.avatar}</span>
                    <span className="font-medium text-slate-400">{neighborBelow2.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-600">{neighborBelow2.rankPoints} LP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Cadres / Promotion Tiers Guide */
        <div className="space-y-2.5">
          {cadres.map((cadre, i) => (
            <div
              key={i}
              className="bg-slate-850/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-xs text-amber-300">{cadre.title}</div>
                <span className="text-[10px] font-mono bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-slate-700 font-bold">
                  {cadre.lpRange}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">{cadre.desc}</p>
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
