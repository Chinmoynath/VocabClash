import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Swords, 
  Award, 
  Layers, 
  Zap, 
  Users, 
  Calendar, 
  Trophy, 
  Search, 
  ChevronRight, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Flame, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface AppGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: 'arena' | 'practice' | 'mistakes' | 'leaderboard') => void;
  onStart1v1?: () => void;
  onStartFriendLobby?: () => void;
  onStartDailyChallenge?: () => void;
  onStartSpeedBlitz?: () => void;
}

type GuideSection = 
  | 'overview'
  | '1v1_arena'
  | 'ranks_lp'
  | 'mistake_vault'
  | 'pyq_drill'
  | 'daily_challenge'
  | 'speed_blitz'
  | 'play_friend'
  | 'leaderboard';

export const AppGuideModal: React.FC<AppGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onStart1v1,
  onStartFriendLobby,
  onStartDailyChallenge,
  onStartSpeedBlitz,
}) => {
  const [activeSection, setActiveSection] = useState<GuideSection>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const sections = [
    { id: 'overview' as GuideSection, label: 'Overview', icon: BookOpen },
    { id: '1v1_arena' as GuideSection, label: '1v1 Arena', icon: Swords },
    { id: 'ranks_lp' as GuideSection, label: 'Govt Ranks & LP', icon: Award },
    { id: 'mistake_vault' as GuideSection, label: 'Flashcards & Vault', icon: Layers },
    { id: 'pyq_drill' as GuideSection, label: 'PYQ Drill', icon: Target },
    { id: 'daily_challenge' as GuideSection, label: 'Daily Challenge', icon: Calendar },
    { id: 'speed_blitz' as GuideSection, label: 'Speed Blitz', icon: Zap },
    { id: 'play_friend' as GuideSection, label: 'Play a Friend', icon: Users },
    { id: 'leaderboard' as GuideSection, label: 'Leaderboard', icon: Trophy },
  ];

  return (
    <div 
      id="app-guide-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="app-guide-modal-container"
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>App Guide & Official Rules</span>
              </h2>
              <p className="text-xs text-slate-400">
                Complete rules for 1v1 battles, govt ranks, spaced repetition & exam modes
              </p>
            </div>
          </div>
          <button
            id="close-app-guide-btn"
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Navigation Tabs (Horizontal scroll on mobile, clean tabs on desktop) */}
        <div className="border-b border-slate-800 bg-slate-950/60 px-3 sm:px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                id={`guide-tab-${sec.id}`}
                onClick={() => {
                  soundManager.playTap();
                  setActiveSection(sec.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-sky-300 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Guide Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-sm leading-relaxed custom-scrollbar bg-slate-900/60">
          
          {/* SECTION: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Welcome to VocabClash</h3>
                <p className="text-slate-300 text-sm">
                  VocabClash is India's dedicated exam vocabulary platform for SSC (CGL, CHSL, CPO, MTS), Banking (IBPS, SBI), Defence (CDS, AFCAT, NDA), and DSSSB exams. We convert static textbook cramming into high-retention active recall through timed 1v1 duels, automated spaced repetition, and 24,000+ authentic PYQs.
                </p>
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveSection('1v1_arena')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Swords className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">1v1 Battle Arena</span>
                  </div>
                  <p className="text-xs text-slate-400">Head-to-head live battles, speed scoring, negative marking & combos.</p>
                </button>

                <button
                  onClick={() => setActiveSection('ranks_lp')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Award className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">Govt Ranks, LP & Level</span>
                  </div>
                  <p className="text-xs text-slate-400">How Level (Lv.) and LP work, promotions from Aspirant to Apex Officer.</p>
                </button>

                <button
                  onClick={() => setActiveSection('mistake_vault')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">Flashcards & Vault</span>
                  </div>
                  <p className="text-xs text-slate-400">Leitner 5-box spaced repetition and automated error capture.</p>
                </button>

                <button
                  onClick={() => setActiveSection('pyq_drill')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Target className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">PYQ Practice Drill</span>
                  </div>
                  <p className="text-xs text-slate-400">Untimed practice with exam filters, Hindi meanings & mnemonics.</p>
                </button>

                <button
                  onClick={() => setActiveSection('daily_challenge')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">Daily Challenge</span>
                  </div>
                  <p className="text-xs text-slate-400">20 synchronized daily questions to build your active streak.</p>
                </button>

                <button
                  onClick={() => setActiveSection('play_friend')}
                  className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-white text-xs">Play a Friend</span>
                  </div>
                  <p className="text-xs text-slate-400">Create private room codes to duel your batchmate in real-time.</p>
                </button>
              </div>

              {/* Core Philosophy */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  <span>The 3-Step Vocab Mastery Loop</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">1. Practice & Test</div>
                    <div>Solve targeted PYQs or compete in 1v1 Arena under strict 15-second exam clock pressure.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">2. Auto Mistake Vault</div>
                    <div>Every slip-up is captured automatically—no manual notebook notes or flashcard making required.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">3. Spaced Repetition</div>
                    <div>Review due words on days 1, 3, 7, and 14 using flip flashcards until permanently retained.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: 1v1 BATTLE ARENA */}
          {activeSection === '1v1_arena' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Swords className="w-5 h-5 text-sky-400" />
                  <span>1v1 Battle Arena Rules</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Real-time head-to-head vocabulary battles simulating real exam hall time constraints.
                </p>
              </div>

              {/* Scoring Table */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">Round Time & Speed Scoring</h4>
                <p className="text-xs text-slate-400">
                  Each round has a strict <strong>15-second countdown</strong>. Faster answers earn more points:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="text-sky-400 font-bold text-base font-mono">+150 pts</div>
                    <div className="text-slate-300 font-medium">Lightning Fast</div>
                    <div className="text-[10px] text-slate-500">&gt; 75% time left (&lt; 3.7s)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="text-sky-400 font-bold text-base font-mono">+125 pts</div>
                    <div className="text-slate-300 font-medium">Quick Recall</div>
                    <div className="text-[10px] text-slate-500">&gt; 50% time left (&lt; 7.5s)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="text-slate-300 font-bold text-base font-mono">+100 pts</div>
                    <div className="text-slate-300 font-medium">Deliberate</div>
                    <div className="text-[10px] text-slate-500">&gt; 25% time left (&lt; 11.2s)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="text-slate-400 font-bold text-base font-mono">+75 pts</div>
                    <div className="text-slate-300 font-medium">Last Second</div>
                    <div className="text-[10px] text-slate-500">&lt; 25% time left</div>
                  </div>
                </div>
              </div>

              {/* Penalties and Combos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Negative Marking (-40 Points)</span>
                  </div>
                  <p className="text-slate-300">
                    Just like in official SSC and government exams, wrong answers carry a <strong>-40 point penalty</strong>. Blind guessing hurts your rank score; eliminate distractors carefully.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1.5">
                    <Flame className="w-4 h-4" />
                    <span>Combo Streak Multipliers</span>
                  </div>
                  <p className="text-slate-300">
                    Consecutive correct answers build a combo streak. Each combo level adds <strong>+15% bonus points</strong> to your score (up to a maximum +50% bonus).
                  </p>
                </div>
              </div>

              {/* Matchmaking & Opponent Engine */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs">
                <div className="font-bold text-slate-200">How Matchmaking Works</div>
                <p className="text-slate-300">
                  When you press <strong>Find Match</strong>, the system searches for a live human aspirant for <strong>5 seconds</strong>. If no live player is currently in the queue, you are instantly paired with a calibrated aspirant bot matching your exact LP range and cadre.
                </p>
                <p className="text-slate-400 text-[11px]">
                  Bot opponents possess human-like reaction times (1.5s to 9s), varying accuracy levels based on question difficulty, and natural mistakes on tough questions.
                </p>
              </div>

              {onStart1v1 && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onStart1v1();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>Start 1v1 Battle Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: GOVT SERVICE RANKS & LP */}
          {activeSection === 'ranks_lp' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-sky-400" />
                  <span>Govt Service Ranks, LP & Player Level</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Understand how your Player Level (Lv.), League Points (LP), and competitive Government Cadre ranks work together.
                </p>
              </div>

              {/* Player Level (Lv.) vs League Points (LP) Explanation Card */}
              <div className="p-4 rounded-xl bg-slate-850 border border-sky-500/30 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold font-mono text-xs">
                    Lv.
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">How Player Level (Lv.) Works</h4>
                    <p className="text-[11px] text-sky-300">Lifetime Dedication & Experience Milestone</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="text-sky-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>1. Level (Lv.) = Permanent XP</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Your <strong>Player Level (e.g., Lv. 1, Lv. 12, Lv. 40+)</strong> measures total practice volume and cumulative consistency. Unlike LP, <strong>your Level never resets or drops</strong> on defeats.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="text-amber-400 font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      <span>2. How to Level Up</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Earn XP by battling in the <strong>1v1 Arena</strong>, practicing <strong>PYQ Drills</strong>, completing the <strong>Daily Challenge</strong>, and reviewing flashcards. Every <strong>~3 completed sessions</strong> advances your level milestone.
                    </p>
                  </div>
                </div>

                {/* Level vs LP comparison table */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-2">
                  <div className="font-bold text-slate-200">Level (Lv.) vs. League Points (LP) Comparison:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <div><strong className="text-slate-200">Player Level (Lv.):</strong> Measures overall effort, volume & veteran status. Always climbs upward.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div><strong className="text-slate-200">League Points (LP):</strong> Measures current competitive win-rate & dictates your Govt Cadre rank.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* What is LP */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">How League Points (LP) Are Calculated</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-emerald-400 font-bold font-mono">+25 to +40 LP</div>
                    <div className="text-slate-300 font-semibold mt-0.5">Victory</div>
                    <div className="text-[11px] text-slate-400">Earned by defeating an opponent in a ranked 1v1 battle.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-rose-400 font-bold font-mono">-15 to -25 LP</div>
                    <div className="text-slate-300 font-semibold mt-0.5">Defeat</div>
                    <div className="text-[11px] text-slate-400">Deducted on match loss. Scaled to protect against steep drops.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-sky-400 font-bold font-mono">+5 to +10 LP</div>
                    <div className="text-slate-300 font-semibold mt-0.5">Draw / Tie</div>
                    <div className="text-[11px] text-slate-400">Awarded when both competitors finish with identical scores.</div>
                  </div>
                </div>
              </div>

              {/* The 6 Cadre Tiers Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">The 6 Cadre Rank Tiers</h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <div className="grid grid-cols-12 bg-slate-850 p-2.5 font-bold text-slate-300 border-b border-slate-800">
                    <div className="col-span-3">Cadre Rank</div>
                    <div className="col-span-3">LP Required</div>
                    <div className="col-span-6">Description & Standard Profile</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 border-b border-slate-800/80 bg-slate-900 items-center">
                    <div className="col-span-3 font-semibold text-slate-300">Aspirant</div>
                    <div className="col-span-3 font-mono text-slate-400">0 – 599 LP</div>
                    <div className="col-span-6 text-slate-400">New entrant building foundational vocabulary and exam speed.</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 border-b border-slate-800/80 bg-slate-900/60 items-center">
                    <div className="col-span-3 font-semibold text-slate-300">Clerk / Assistant</div>
                    <div className="col-span-3 font-mono text-slate-400">600 – 1199 LP</div>
                    <div className="col-span-6 text-slate-400">Clearing basic cutoffs; solid grasp of high-frequency words.</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 border-b border-slate-800/80 bg-slate-900 items-center">
                    <div className="col-span-3 font-semibold text-slate-300">Auditor / Accountant</div>
                    <div className="col-span-3 font-mono text-slate-400">1200 – 1999 LP</div>
                    <div className="col-span-6 text-slate-400">Intermediate mastery; consistent recall on synonyms and antonyms.</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 border-b border-slate-800/80 bg-slate-900/60 items-center">
                    <div className="col-span-3 font-semibold text-sky-400">GST / IT Inspector</div>
                    <div className="col-span-3 font-mono text-slate-400">2000 – 2999 LP</div>
                    <div className="col-span-6 text-slate-400">Senior 4600 GP tier; high accuracy across OWS and tricky idioms.</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 border-b border-slate-800/80 bg-slate-900 items-center">
                    <div className="col-span-3 font-semibold text-amber-400">Gazetted Officer</div>
                    <div className="col-span-3 font-mono text-slate-400">3000 – 4499 LP</div>
                    <div className="col-span-6 text-slate-400">Elite ranker; long win streaks and master-level response times.</div>
                  </div>

                  <div className="grid grid-cols-12 p-2.5 bg-slate-900/60 items-center">
                    <div className="col-span-3 font-bold text-purple-400">Apex Officer</div>
                    <div className="col-span-3 font-mono text-slate-400">4500+ LP</div>
                    <div className="col-span-6 text-slate-400">Top 1% national rankers across India with near-flawless accuracy.</div>
                  </div>
                </div>
              </div>

              {/* Exam-Specific Cadre Adaptation */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs">
                <div className="font-bold text-slate-200">Exam-Specific Cadre Adaptation</div>
                <p className="text-slate-300">
                  Your Cadre Title dynamically reflects your chosen target exam:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-400">
                  <div><strong>SSC:</strong> GST/IT Inspector, ASO, AAO</div>
                  <div><strong>Banking:</strong> PO, Specialist, Manager</div>
                  <div><strong>Defence:</strong> Officer Cadet, Flying Officer</div>
                  <div><strong>DSSSB:</strong> DASS Grade-II, ASO, Head Clerk</div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: FLASHCARDS & MISTAKE VAULT */}
          {activeSection === 'mistake_vault' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>Flashcards & Mistake Vault</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Automated error retention using the proven scientific Leitner 5-box spaced repetition engine.
                </p>
              </div>

              {/* Automatic Capture */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-xs space-y-1.5">
                <div className="font-bold text-white">1. Automatic Error Capture</div>
                <p className="text-slate-300">
                  Whenever you answer a question incorrectly in <strong>1v1 Battles</strong>, <strong>Daily Challenge</strong>, or <strong>Practice Mode</strong>, it is instantly captured into your <strong>Mistake Vault</strong>. You never need to pause or manually write vocabulary down.
                </p>
              </div>

              {/* Leitner Box System */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">2. The Leitner 5-Box Spaced Repetition Schedule</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200">Box 1</div>
                    <div className="text-rose-400 font-semibold text-[11px]">Due Today</div>
                    <div className="text-[10px] text-slate-500 mt-1">Review Interval: 1 Day</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200">Box 2</div>
                    <div className="text-amber-400 font-semibold text-[11px]">Learning</div>
                    <div className="text-[10px] text-slate-500 mt-1">Review Interval: 3 Days</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200">Box 3</div>
                    <div className="text-sky-400 font-semibold text-[11px]">Reviewing</div>
                    <div className="text-[10px] text-slate-500 mt-1">Review Interval: 7 Days</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200">Box 4</div>
                    <div className="text-blue-400 font-semibold text-[11px]">Retaining</div>
                    <div className="text-[10px] text-slate-500 mt-1">Review Interval: 14 Days</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 text-center">
                    <div className="font-bold text-slate-200">Box 5</div>
                    <div className="text-emerald-400 font-semibold text-[11px]">Mastered</div>
                    <div className="text-[10px] text-slate-500 mt-1">Permanent Memory</div>
                  </div>
                </div>
                <p className="text-slate-400 text-[11px]">
                  When you successfully recall a card during revision, it advances to the next box. If you get it wrong, it resets to Box 1 for reinforcement.
                </p>
              </div>

              {/* Flashcard Anatomy */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs">
                <div className="font-bold text-white">3. What Every Flashcard Contains</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px] pt-1">
                  <div>• <strong>Hindi Meaning:</strong> Clear vernacular translation</div>
                  <div>• <strong>Memory Mnemonic:</strong> Visual memory hook & trick</div>
                  <div>• <strong>Root Word Etymology:</strong> Latin/Greek root origin</div>
                  <div>• <strong>Exam Appearance History:</strong> Exact exams & years repeated</div>
                  <div>• <strong>Example Sentence:</strong> High-yield formal usage</div>
                  <div>• <strong>Audio Pronunciation:</strong> Clean native voice readout</div>
                </div>
              </div>

              {onNavigate && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('mistakes');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
                  >
                    <span>Open Mistake Vault</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: PYQ PRACTICE DRILL */}
          {activeSection === 'pyq_drill' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-sky-400" />
                  <span>PYQ Practice Drill</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Untimed, self-paced mastery of 24,000+ authentic government exam questions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">How Practice Drills Differ From 1v1 Arena</h4>
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div><strong>No Timer Pressure:</strong> Study questions at your own speed without the 15-second clock.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div><strong>Zero Negative LP Impact:</strong> Experiment and learn new topics without risking your competitive rank points.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div><strong>Full Distractor Breakdown:</strong> Read comprehensive explanations for why the correct option is right, plus detailed meanings for all 3 incorrect distractor options.</div>
                  </div>
                </div>
              </div>

              {/* Filters Available */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-white">Filters Available</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200">By Exam Family</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">SSC (CGL, CHSL, CPO, MTS), Banking (SBI, IBPS), Defence (CDS, AFCAT, NDA), and DSSSB (ASO, DASS G2).</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200">By Question Category</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Synonyms, Antonyms, One Word Substitutions (OWS), and Idioms & Phrases.</div>
                  </div>
                </div>
              </div>

              {onNavigate && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('practice');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>Open PYQ Practice Drills</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: DAILY CHALLENGE */}
          {activeSection === 'daily_challenge' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-sky-400" />
                  <span>Daily Challenge</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  20 synchronized questions released worldwide every 24 hours at midnight.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">Key Rules & Format</h4>
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div><strong>Synchronized Across India:</strong> Every user gets the exact same 20 questions in the same sequence on any given calendar date.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div><strong>Balanced Syllabus:</strong> 5 Synonyms + 5 Antonyms + 5 One Word Substitutions + 5 Idioms.</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div><strong>Preserves Daily Streak:</strong> Completing the Daily Challenge guarantees streak continuation and earns bonus LP rewards.</div>
                  </div>
                </div>
              </div>

              {onStartDailyChallenge && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onStartDailyChallenge();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>Play Today's Daily Challenge</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: SPEED BLITZ */}
          {activeSection === 'speed_blitz' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-sky-400" />
                  <span>Speed Blitz Sprint</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  High-intensity rapid-fire vocabulary reflex sprints.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">What is Speed Blitz?</h4>
                <p className="text-slate-300">
                  Speed Blitz is designed for quick 2-minute study bursts between classes or daily commutes. It tests instant visual word recognition rather than slow, second-guessing reading.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-300">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <strong>High Time Pressure:</strong> Answer as many words as possible under a rapid countdown.
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <strong>Reflex Training:</strong> Teaches your subconscious to immediately spot Latin/Greek roots and prefixes.
                  </div>
                </div>
              </div>

              {onStartSpeedBlitz && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onStartSpeedBlitz();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>Launch Speed Blitz</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: PLAY A FRIEND */}
          {activeSection === 'play_friend' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  <span>Play a Friend (Custom Duel Lobby)</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Challenge your batchmate, coaching partner, or study group head-to-head.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">How to Host or Join a Private Duel</h4>
                <div className="space-y-2.5 text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">1</div>
                    <div>
                      <strong>Create a Room:</strong> Select your target exam and round count (10 or 20 questions) to generate a unique 6-character Room Code.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">2</div>
                    <div>
                      <strong>Share with Friend:</strong> Send the code or direct link via WhatsApp, Telegram, or SMS.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">3</div>
                    <div>
                      <strong>Duel in Real-Time:</strong> Both players see the exact same synchronized questions round-by-round with live score updates.
                    </div>
                  </div>
                </div>
              </div>

              {onStartFriendLobby && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onStartFriendLobby();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>Create / Join Friend Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: LEADERBOARD & RANKS */}
          {activeSection === 'leaderboard' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-sky-400" />
                  <span>Leaderboards & National Standings</span>
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  How national rankings, daily leagues, and state leaderboards work.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3 text-xs">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">Leaderboard Categories</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200">Daily Top Scorers</div>
                    <div className="text-[11px] text-slate-400 mt-1">Ranks players by LP and questions solved within the last 24 hours. Resets at midnight.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200">Weekly League</div>
                    <div className="text-[11px] text-slate-400 mt-1">Tracks weekly promotions across Cadres and active win streaks across India.</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="font-bold text-slate-200">All-Time Hall of Fame</div>
                    <div className="text-[11px] text-slate-400 mt-1">Lifetime ranking of India's top Apex and Gazetted Officers by total LP and win rate.</div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <div className="font-bold text-white">State Representation</div>
                <p>
                  Set your state in your Profile (e.g. Uttar Pradesh, Bihar, Rajasthan, Maharashtra, Delhi, West Bengal) to represent your home state on regional leaderboards!
                </p>
              </div>

              {onNavigate && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('leaderboard');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <span>View National Leaderboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>VocabClash v1.2</span>
            <span>•</span>
            <span>24,000+ Exam PYQs</span>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
