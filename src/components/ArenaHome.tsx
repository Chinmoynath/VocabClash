import React, { useState, useEffect, useRef } from 'react';
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
  Play,
  Cloud,
  LogIn,
  BookOpen
} from 'lucide-react';
import { PlayerProfile, QuestionCategory, ExamType, UserSubscription, DailyStreakState } from '../types';
import { soundManager } from '../utils/audio';
import { ADS_ENABLED } from '../utils/adManager';
import { User as FirebaseUser } from 'firebase/auth';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';
import { DailyTargetCard } from './DailyTargetCard';
import { CadreRankCard } from './CadreRankCard';
import { DailyCommandCenterCard } from './DailyCommandCenterCard';
import { OneVsOneArenaCard } from './OneVsOneArenaCard';
// import { SscTop100Section } from './SscTop100Section'; // Temporarily hidden; will bring back later
import { SscTop100Category } from '../data/sscTop100';
import { 
  EXAM_FAMILY_PILLS, 
  EXAM_FAMILY_SUB_TAGS, 
  normalizeFilterToFamily, 
  getExamFilterDisplayName 
} from '../utils/examFamilyUtils';
import { SavedWord } from '../types';

interface ArenaHomeProps {
  player: PlayerProfile;
  subscription: UserSubscription;
  dailyStreak: DailyStreakState;
  savedWords?: SavedWord[];
  selectedCategory: QuestionCategory | 'mixed';
  selectedExam: ExamType;
  currentUser?: FirebaseUser | null;
  isAdmin?: boolean;
  onSelectCategory: (cat: QuestionCategory | 'mixed') => void;
  onSelectExam: (exam: ExamType) => void;
  onStartMatchmaking: (mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge') => void;
  onOpenPlayModeSelector: () => void;
  onOpenFriendLobby: () => void;
  onOpenPremium: () => void;
  onOpenStreak: () => void;
  onOpenProfile?: () => void;
  onOpenEditProfile?: () => void;
  onOpenTour?: () => void;
  onOpenAppGuide?: () => void;
  onNavigateTab?: (tab: 'arena' | 'practice' | 'leaderboard' | 'mistakes' | 'ai_coach') => void;
  onRewardLP: (lpDelta: number, reason: string) => void;
  onTriggerTestAd: () => void;
  onStartSscTop100Drill?: (category: SscTop100Category, resumeIndex?: number) => void;
  onStartDueRevision?: (dueWords: SavedWord[]) => void;
}

export const ArenaHome: React.FC<ArenaHomeProps> = ({
  player,
  subscription,
  dailyStreak,
  savedWords = [],
  selectedCategory,
  selectedExam,
  currentUser,
  isAdmin = false,
  onSelectCategory,
  onSelectExam,
  onStartMatchmaking,
  onOpenPlayModeSelector,
  onOpenFriendLobby,
  onOpenPremium,
  onOpenStreak,
  onOpenProfile,
  onOpenEditProfile,
  onOpenTour,
  onOpenAppGuide,
  onNavigateTab,
  onRewardLP,
  onTriggerTestAd,
  onStartSscTop100Drill,
  onStartDueRevision,
}) => {
  // Current selected exam family
  const activeFamily = normalizeFilterToFamily(selectedExam);

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 max-w-7xl mx-auto w-full pb-8">
      
      {/* Main Responsive Grid: 1-Column on Mobile, 2-Column Dashboard on Desktop/Laptop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        
        {/* LEFT COLUMN: Daily Command Center, Duel Actions, Exam Selector, Categories, Quick Modes (7 Cols on Desktop) */}
        <div className="order-1 lg:col-span-7 xl:col-span-7 space-y-4">
          
          {/* Personal Daily Command Center (Today's Next Best Action) */}
          <DailyCommandCenterCard
            player={player}
            currentUser={currentUser}
            dailyStreak={dailyStreak}
            savedWords={savedWords}
            onStartDueRevision={(dueWords) => {
              if (onStartDueRevision) {
                onStartDueRevision(dueWords);
              } else if (onNavigateTab) {
                onNavigateTab('mistakes');
              }
            }}
            onNavigateTab={onNavigateTab}
            onStartMatchmaking={onStartMatchmaking}
            onSelectCategory={onSelectCategory}
            onStartSscTop100Drill={onStartSscTop100Drill}
          />

          {/* Instant 1v1 Matchmaking Active Status Ticker */}
          <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-300 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-emerald-200">Instant 1v1 Matchmaking Active</span>
            </div>
            <span className="text-[11px] text-emerald-400/90 font-mono font-bold">Avg Queue: 5.0s</span>
          </div>

          {/* Target Govt Exam Filter Pills */}
          <div className="space-y-1.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                Target Govt Exam:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {activeFamily === 'all'
                  ? 'All Board PYQs'
                  : activeFamily === 'ssc'
                  ? 'All SSC Exams'
                  : activeFamily === 'dsssb'
                  ? 'All DSSSB Exams'
                  : activeFamily === 'banking'
                  ? 'All Banking Exams'
                  : 'All Defence Exams'}
              </span>
            </div>

            {/* Main Single-Row Slidable Pills (Phone Slidable, No 2 Rows) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs pt-0.5">
              {EXAM_FAMILY_PILLS.map(pill => {
                const isFamilyActive = (pill.id === 'ALL' && activeFamily === 'all') || (pill.family && activeFamily === pill.family);
                return (
                  <button
                    key={pill.id}
                    id={`exam-family-pill-${pill.id.toLowerCase()}`}
                    onClick={() => {
                      soundManager.playTap();
                      onSelectExam(pill.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all border text-xs font-bold cursor-pointer shrink-0 ${
                      isFamilyActive
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-950/60 font-black ring-1 ring-cyan-400/40'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border-slate-750 font-semibold'
                    }`}
                  >
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Subtle non-touchable preview tags (Compact, no extra vertical bloat) */}
            {activeFamily !== 'all' && EXAM_FAMILY_SUB_TAGS[activeFamily]?.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-slate-400 select-none pointer-events-none">
                <span className="text-slate-500 font-semibold shrink-0 text-[10px] uppercase tracking-wider">Includes:</span>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {EXAM_FAMILY_SUB_TAGS[activeFamily].map((tag, idx) => (
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

          {/* Hero Action: 1v1 Live Arena Card with 30-Day Stats */}
          <div className="space-y-2.5 pt-1">
            <OneVsOneArenaCard
              player={player}
              onStartMatchmaking={onStartMatchmaking}
              onOpenPlayModeSelector={onOpenPlayModeSelector}
              onOpenFriendLobby={onOpenFriendLobby}
            />

            {/* Secondary Quick Modes Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Play Online Quick Blitz */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartMatchmaking('quick_duel');
                }}
                className="bg-slate-800/90 hover:bg-slate-750 active:scale-[0.97] border border-slate-700 p-2.5 sm:p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base sm:text-lg">⚡</span>
                  <span className="text-[9px] bg-slate-700 text-slate-300 font-mono px-1.5 py-0.5 rounded font-bold">
                    10 Qs
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs text-slate-100 truncate">Speed Blitz</div>
                  <div className="text-[9px] text-slate-400 truncate">Instant Queue</div>
                </div>
              </button>

              {/* Play with Friend (6-Digit Room) */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onOpenFriendLobby();
                }}
                className="bg-gradient-to-br from-sky-950/80 to-slate-850 hover:bg-sky-900/40 active:scale-[0.97] border border-sky-600/50 hover:border-sky-400 p-2.5 sm:p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base sm:text-lg">👥</span>
                  <span className="text-[9px] bg-sky-950 text-sky-300 font-mono px-1.5 py-0.5 rounded border border-sky-700/60 font-bold">
                    6-Digit
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs text-sky-200 group-hover:text-sky-100 truncate">Play Friend</div>
                  <div className="text-[9px] text-sky-400/80 truncate">Custom Lobby</div>
                </div>
              </button>

              {/* Daily 20-Round PYQ Sprint */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartMatchmaking('daily_challenge');
                }}
                className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 hover:opacity-95 active:scale-[0.97] border border-indigo-700/60 p-2.5 sm:p-3 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base sm:text-lg">🔥</span>
                  <span className="text-[9px] bg-indigo-900/90 text-indigo-200 font-bold px-1 py-0.5 rounded border border-indigo-600/50">
                    +100 Bonus
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs text-indigo-100 truncate">Daily Sprint</div>
                  <div className="text-[9px] text-indigo-300/80 truncate">20 PYQs</div>
                </div>
              </button>
            </div>
          </div>

          {/* 🔥 Top 100 Vocab Drill Module (temporarily disabled per user request; will bring back later) */}
          {/*
          {onStartSscTop100Drill && (
            <div className="w-full pt-1">
              <SscTop100Section
                userId={currentUser?.uid || player.id}
                isAdmin={isAdmin}
                onStartDrill={onStartSscTop100Drill}
              />
            </div>
          )}
          */}
        </div>

        {/* RIGHT COLUMN: Cadre Rank Card, Daily Target Missions, VIP / Auth (5 Cols on Desktop) */}
        <div className="order-2 lg:col-span-5 xl:col-span-5 space-y-4">
          
          {/* Govt Service Cadre Rank & Promotion Progress Card */}
          <CadreRankCard 
            player={player} 
            onOpenProfile={onOpenProfile} 
            onOpenEditProfile={onOpenEditProfile}
          />

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

          {/* AdSense Unit (Rendered only when ADS_ENABLED is true) */}
          {ADS_ENABLED && !subscription.isPremium && (
            <div className="pt-1">
              <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" />
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
