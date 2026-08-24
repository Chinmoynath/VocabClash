import React, { useState, useEffect } from 'react';
import { 
  Swords, 
  Zap, 
  Flame, 
  Award, 
  Sparkles, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Filter,
  Crown,
  ShieldCheck,
  HelpCircle,
  Play,
  Cloud,
  LogIn
} from 'lucide-react';
import { PlayerProfile, QuestionCategory, ExamType, UserSubscription, DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { getSecondsUntilNextAd } from '../utils/adManager';
import { User as FirebaseUser } from 'firebase/auth';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';
import { DailyTargetCard } from './DailyTargetCard';
import { VocabClashLogo } from './VocabClashLogo';

interface ArenaHomeProps {
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  selectedCategory: QuestionCategory | 'mixed';
  selectedExam: ExamType;
  currentUser?: FirebaseUser | null;
  onSelectCategory: (cat: QuestionCategory | 'mixed') => void;
  onSelectExam: (exam: ExamType) => void;
  onStartMatchmaking: (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => void;
  onOpenPremium: () => void;
  onOpenStreak: () => void;
  onOpenProfile?: () => void;
  onOpenTour?: () => void;
  onNavigateTab?: (tab: 'arena' | 'practice' | 'leaderboard' | 'mistakes' | 'ai_coach') => void;
  onRewardLP: (lpDelta: number, reason: string) => void;
  onTriggerTestAd: () => void;
}

export const ArenaHome: React.FC<ArenaHomeProps> = ({
  player,
  subscription,
  dailyStreak,
  selectedCategory,
  selectedExam,
  currentUser,
  onSelectCategory,
  onSelectExam,
  onStartMatchmaking,
  onOpenPremium,
  onOpenStreak,
  onOpenProfile,
  onOpenTour,
  onNavigateTab,
  onRewardLP,
  onTriggerTestAd,
}) => {
  const [secondsToAd, setSecondsToAd] = useState<number>(() => getSecondsUntilNextAd(subscription.isPremium));

  useEffect(() => {
    if (subscription.isPremium) return;
    const interval = setInterval(() => {
      setSecondsToAd(getSecondsUntilNextAd(subscription.isPremium));
    }, 1000);
    return () => clearInterval(interval);
  }, [subscription.isPremium]);

  const categories: { id: QuestionCategory | 'mixed'; label: string; hindi: string; icon: string; countBadge: string }[] = [
    { id: 'mixed', label: 'All Mixed', hindi: 'सभी 24,000+ प्रश्न', icon: '⚡', countBadge: '24k+ Pool' },
    { id: 'antonyms', label: 'Antonyms', hindi: 'विलोम शब्द', icon: '🔀', countBadge: '6,000+ PYQs' },
    { id: 'synonyms', label: 'Synonyms', hindi: 'पर्यायवाची', icon: '🔁', countBadge: '6,000+ PYQs' },
    { id: 'ows', label: 'One Word', hindi: 'अनेक शब्दों के लिए एक शब्द', icon: '🎯', countBadge: '6,000+ PYQs' },
    { id: 'idioms', label: 'Idioms & Phrases', hindi: 'मुहावरे एवं लोकोक्तियां', icon: '📜', countBadge: '6,000+ PYQs' },
  ];

  const exams: { id: ExamType; label: string; tag: string }[] = [
    { id: 'ALL', label: 'All Govt Exams', tag: 'High Yield' },
    { id: 'SSC_CGL', label: 'SSC CGL Tier 1/2', tag: '4600 GP' },
    { id: 'SSC_CHSL', label: 'SSC CHSL 10+2', tag: 'DEO/LDC' },
    { id: 'SSC_CPO', label: 'SSC CPO SI', tag: 'Delhi Police' },
    { id: 'SSC_MTS', label: 'SSC MTS / Havaldar', tag: 'Govt PYQs' },
    { id: 'RRB_NTPC', label: 'RRB NTPC CBT 1/2', tag: 'Railway' },
    { id: 'CDS_NDA', label: 'CDS / NDA Defense', tag: 'Officer' },
  ];

  // LP Tier progress computation
  const currentLP = player.rankPoints;
  let nextTierLP = 2000;
  let prevTierLP = 1200;
  if (currentLP < 600) { prevTierLP = 0; nextTierLP = 600; }
  else if (currentLP < 1200) { prevTierLP = 600; nextTierLP = 1200; }
  else if (currentLP < 2000) { prevTierLP = 1200; nextTierLP = 2000; }
  else if (currentLP < 3000) { prevTierLP = 2000; nextTierLP = 3000; }
  else { prevTierLP = 3000; nextTierLP = 4500; }

  const progressPercent = Math.min(100, Math.max(0, Math.round(((currentLP - prevTierLP) / (nextTierLP - prevTierLP)) * 100)));

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 max-w-7xl mx-auto w-full pb-8">
      
      {/* Top Status & Queue Banner */}
      <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-300 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-200">Instant 1v1 Matchmaking Active</span>
          <span className="hidden sm:inline text-emerald-400/60">• 24,000+ PYQ Verified Pool</span>
        </div>
        <span className="text-[11px] text-emerald-400/90 font-mono font-bold">Avg Queue: 1.8s</span>
      </div>

      {/* Main Responsive Grid: 1-Column on Mobile, 2-Column Dashboard on Desktop/Laptop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        
        {/* LEFT COLUMN: Duel Actions, Exam Selector, Categories, Quick Modes (7 Cols on Desktop) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          
          {/* Target Exam Filter Pills */}
          <div className="space-y-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-sky-400" />
                Target Govt Exam:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Customized PYQ Pool</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs pt-1">
              {exams.map(exam => {
                const isSelected = selectedExam === exam.id;
                return (
                  <button
                    key={exam.id}
                    onClick={() => {
                      soundManager.playTap();
                      onSelectExam(exam.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                      isSelected
                        ? 'bg-sky-600 text-white font-bold border-sky-400 shadow-md shadow-sky-950'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 border-slate-700/60 font-medium'
                    }`}
                  >
                    <span>{exam.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-sky-800 text-sky-100' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {exam.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Selection Grid */}
          <div className="space-y-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
              <span>Topic / Section:</span>
              <span className="text-[11px] text-amber-400 font-medium">Prioritizes 10+ Repeat PYQs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 pt-1">
              {categories.map(cat => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      soundManager.playTap();
                      onSelectCategory(cat.id);
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all relative group cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/50 border-amber-500/80 shadow-md text-slate-100 ring-1 ring-amber-400'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base group-hover:scale-110 transition-transform">{cat.icon}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' : 'bg-slate-900/80 text-slate-400'
                      }`}>
                        {cat.countBadge}
                      </span>
                    </div>
                    <div className="font-bold text-xs mt-1 text-slate-100">{cat.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{cat.hindi}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero Action: Primary Ranked 1v1 Battle Button */}
          <div className="space-y-3 pt-1">
            <button
              onClick={() => {
                soundManager.playTap();
                onStartMatchmaking('1v1_ranked');
              }}
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 p-4 sm:p-5 rounded-2xl shadow-xl shadow-orange-950/70 flex items-center justify-between gap-3 border-2 border-amber-300/60 transition-all group relative overflow-hidden cursor-pointer"
            >
              {/* Subtle light shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

              <div className="flex items-center gap-3.5 min-w-0 flex-1 relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950/25 border border-slate-950/20 flex items-center justify-center text-2xl sm:text-3xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform shrink-0">
                  ⚔️
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base lg:text-lg font-black tracking-wide uppercase text-slate-950 leading-tight">
                      1V1 VOCAB ONLINE DUEL
                    </span>
                    <span className="text-[10px] bg-slate-950/35 text-amber-100 font-extrabold px-2 py-0.5 rounded-md border border-slate-950/20 whitespace-nowrap shadow-sm">
                      20 Qs
                    </span>
                  </div>
                  <div className="text-xs text-slate-950/85 font-bold mt-1">
                    Full 20-Round Battle • <span className="text-slate-950 font-black">+30 LP on Victory</span>
                  </div>
                </div>
              </div>

              {/* Aesthetic High-Contrast START Button */}
              <div className="relative z-10 flex items-center gap-1.5 bg-gradient-to-b from-slate-950 to-slate-900 text-amber-300 hover:text-amber-200 border border-amber-400/40 hover:border-amber-300 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase shrink-0 shadow-lg shadow-slate-950/60 group-hover:scale-105 transition-all">
                <span>START</span>
                <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Secondary Quick Modes Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Quick 10-Round Blitz */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartMatchmaking('quick_duel');
                }}
                className="bg-slate-800/90 hover:bg-slate-750 active:scale-[0.97] border border-slate-700 p-3 sm:p-3.5 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg sm:text-xl">⚡</span>
                  <span className="text-[10px] bg-slate-700 text-slate-300 font-mono px-1.5 py-0.5 rounded font-bold">
                    10 Rounds
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs sm:text-sm text-slate-100">Speed Blitz</div>
                  <div className="text-[10px] text-slate-400">Fast 10-Round Duel</div>
                </div>
              </button>

              {/* Daily 20-Round PYQ Sprint */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartMatchmaking('daily_challenge');
                }}
                className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 hover:opacity-95 active:scale-[0.97] border border-indigo-700/60 p-3 sm:p-3.5 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg sm:text-xl">🔥</span>
                  <span className="text-[10px] bg-indigo-900/90 text-indigo-200 font-bold px-1.5 py-0.5 rounded border border-indigo-600/50">
                    20 Qs • +100 Bonus
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs sm:text-sm text-indigo-100">Daily PYQ Sprint</div>
                  <div className="text-[10px] text-indigo-300/80">20 High-repeat PYQs</div>
                </div>
              </button>
            </div>
          </div>

          {/* How VocabClash Works - Guide Banner */}
          {onOpenTour && (
            <div
              id="arena-onboarding-banner-bottom"
              onClick={() => {
                soundManager.playTap();
                onOpenTour();
              }}
              className="bg-gradient-to-r from-slate-900 via-sky-950/60 to-slate-900 border border-sky-600/40 hover:border-sky-400 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-md active:scale-99 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <HelpCircle className="w-5 h-5 text-sky-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-white">How VocabClash Works?</span>
                    <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded font-bold uppercase tracking-wide">
                      Quick Guide
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
                    1v1 Battles • 24k PYQs • Mistake Vault • LP Ranks & Streaks
                  </p>
                </div>
              </div>

              <div className="bg-sky-600/90 group-hover:bg-sky-500 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-1 shadow-sm">
                <span>Learn</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Cadre Rank Card, Daily Target Missions, VIP / Auth (5 Cols on Desktop) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          
          {/* Govt Service Rank & Promotion Progress Card */}
          <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/60 to-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                  <span>Govt Service Rank</span>
                  <span className="px-1.5 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded text-[9px] font-bold">
                    SEASON 2026
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-amber-300 mt-0.5 flex items-center gap-1.5">
                  {player.tierTitle}
                </h2>
                <div 
                  onClick={() => {
                    if (onOpenProfile) {
                      soundManager.playTap();
                      onOpenProfile();
                    }
                  }}
                  className="text-xs text-slate-300 mt-1 cursor-pointer hover:text-white transition-colors flex items-center gap-1 group"
                  title="Click to switch your target post"
                >
                  <span>Target:</span>
                  <span className="text-emerald-400 font-semibold group-hover:underline underline-offset-2 truncate max-w-[180px]">
                    {player.targetExam}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-amber-400">✏️</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
                  {player.rankPoints} <span className="text-xs font-normal text-slate-400">LP</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Win Rate: <span className="text-emerald-400 font-bold">{player.accuracyRate}%</span> ({player.matchesWon}W / {player.matchesPlayed}M)
                </div>
              </div>
            </div>

            {/* Tier Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Cadre Promotion</span>
                <span className="text-amber-300 font-bold">{nextTierLP - currentLP} LP to Next Cadre</span>
              </div>
              <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Daily Target Missions Card */}
          <DailyTargetCard
            onStartMatchmaking={onStartMatchmaking}
            onNavigateTab={onNavigateTab}
            onRewardLP={onRewardLP}
          />

          {/* Guest Sign-In Banner if not signed in */}
          {!currentUser && onOpenProfile ? (
            <div
              onClick={() => {
                soundManager.playTap();
                onOpenProfile();
              }}
              className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-900/80 border border-indigo-500/50 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-all shadow-md active:scale-99"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/90 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-100">Sign In to Save Progress</span>
                  </div>
                  <p className="text-[10px] text-indigo-300/90">
                    Protect your LP, win streaks & mistake vault across devices
                  </p>
                </div>
              </div>

              <div className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                <span>Sign In</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          ) : null}

          {/* Premium VIP Banner (Free users) */}
          {!subscription.isPremium && (
            <div 
              onClick={() => {
                soundManager.playTap();
                onOpenPremium();
              }}
              className="rounded-2xl p-3.5 border cursor-pointer transition-all flex items-center justify-between gap-3 shadow-lg bg-gradient-to-r from-[#24123b] via-[#1a1329] to-[#161026] border-purple-500/50 hover:border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.15)]"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <VocabClashLogo size="md" className="rounded-xl ring-2 ring-purple-400/50 shadow-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      VocabClash Premium
                    </span>
                    <span className="text-[9px] bg-purple-900/90 text-purple-200 border border-purple-400/40 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider whitespace-nowrap shadow-sm">
                      ₹19/mo
                    </span>
                  </div>
                  <p className="text-[10px] text-purple-300/90 truncate mt-0.5">
                    Ad-Free • Unlimited 1v1 Battles • Offline Mode
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 shadow-md shadow-purple-950/50 border border-purple-400/30 transition-all ml-2">
                <span>Upgrade</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Free-Tier Ad Status Helper */}
          {!subscription.isPremium && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span>Ad Cooldown:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {secondsToAd === 0 ? 'Due after match' : `${Math.floor(secondsToAd / 60)}m ${secondsToAd % 60}s`}
                </span>
              </div>
              <button
                onClick={() => {
                  soundManager.playTap();
                  onTriggerTestAd();
                }}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-sky-300 px-2 py-0.5 rounded border border-slate-700 font-medium cursor-pointer"
                title="Simulate 10-min interval expiry"
              >
                ⚡ Test Ad
              </button>
            </div>
          )}

          {/* AdSense Unit */}
          {!subscription.isPremium && (
            <div className="pt-1">
              <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" />
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
