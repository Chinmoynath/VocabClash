import React, { useState } from 'react';
import { 
  Swords, 
  Target, 
  BookOpen, 
  Flame, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  X, 
  Award, 
  HelpCircle, 
  Zap, 
  ShieldCheck, 
  GraduationCap, 
  RotateCcw,
  Volume2,
  Check,
  Lightbulb
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFirstMatch?: () => void;
}

interface TourStep {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  taglineHindi: string;
  description: string;
  highlights: { title: string; desc: string; icon: string }[];
  visualPreview: React.ReactNode;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onStartFirstMatch,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'walkthrough' | 'demo' | 'faq'>('walkthrough');

  // Interactive Mini Demo State
  const [selectedDemoOption, setSelectedDemoOption] = useState<number | null>(null);
  const [demoAnswerSubmitted, setDemoAnswerSubmitted] = useState<boolean>(false);
  const [demoStreakPoints, setDemoStreakPoints] = useState<number>(0);

  if (!isOpen) return null;

  const handleFinish = () => {
    soundManager.playTap();
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocabclash_onboarding_seen_v1', 'true');
    }
    onClose();
  };

  const handleNext = () => {
    soundManager.playTap();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    soundManager.playTap();
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleDemoSelect = (index: number) => {
    if (demoAnswerSubmitted) return;
    setSelectedDemoOption(index);
    setDemoAnswerSubmitted(true);
    if (index === 2) {
      // Correct (Option 2: Permanent)
      soundManager.playCorrect();
      setDemoStreakPoints(120);
    } else {
      soundManager.playWrong();
      setDemoStreakPoints(0);
    }
  };

  const handleResetDemo = () => {
    soundManager.playTap();
    setSelectedDemoOption(null);
    setDemoAnswerSubmitted(false);
    setDemoStreakPoints(0);
  };

  const steps: TourStep[] = [
    {
      id: 'what_is_it',
      badge: 'Step 1 of 5 • Core Arena',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
      title: 'Head-to-Head 1v1 Live Battles',
      subtitle: 'Real-time English vocabulary battle against real govt exam aspirants',
      icon: <Swords className="w-6 h-6 text-amber-400" />,
      iconBg: 'bg-gradient-to-tr from-amber-600 to-orange-500',
      taglineHindi: 'असली अभ्यर्थियों के साथ लाइव 1v1 मुकाबला',
      description: 'Test your vocabulary reflexes! Compete head-to-head in real time. Each duel contains 20 authentic past exam questions with a 15-second timer per round.',
      highlights: [
        { title: 'Speed & Accuracy Combos', desc: 'Answer faster than your opponent to build combo multipliers (+100 to +150 pts).', icon: '⚡' },
        { title: 'League Points (LP) & Tiers', desc: 'Win battles to earn +30 LP and get promoted from Aspirant ➡️ Inspector ➡️ Officer.', icon: '🏆' },
        { title: 'In-Game Powerups', desc: 'Use 50:50, Freeze Timer, and Root-Word Hint during crucial moments.', icon: '🛡️' },
      ],
      visualPreview: (
        <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 space-y-2 font-sans">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>You (1,840 LP)</span>
            </div>
            <div className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono font-bold text-[10px]">
              Round 4 / 20 • 9s left
            </div>
            <div className="font-bold text-sky-400">Aspirant Rahul (1,815 LP)</div>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-center">
            <div className="text-[10px] text-amber-400 uppercase font-semibold">Select ANTONYM</div>
            <div className="text-sm font-black text-white mt-0.5">METICULOUS</div>
            <div className="text-[10px] text-slate-400">Hindi: अति सावधान / सतर्क</div>
          </div>
        </div>
      ),
    },
    {
      id: 'pyq_pool',
      badge: 'Step 2 of 5 • Exam Content',
      badgeColor: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
      title: '24,000+ Authentic Govt PYQs',
      subtitle: 'Targeted syllabus for SSC CGL, CHSL, MTS, CPO, RRB NTPC & CDS',
      icon: <Target className="w-6 h-6 text-sky-400" />,
      iconBg: 'bg-gradient-to-tr from-sky-600 to-blue-600',
      taglineHindi: '100% पिछले वर्षों के पूछे गए प्रश्न (PYQs)',
      description: 'Filter your questions by your exact target exam and topic. Master words with high exam repeat counts (10+ times asked in TCS and SSC papers).',
      highlights: [
        { title: '4 Core Vocabulary Pillars', desc: 'Antonyms, Synonyms, One-Word Substitution (OWS), and Idioms & Phrases.', icon: '📚' },
        { title: 'Exam Tag Filters', desc: 'Switch instantly between SSC CGL (4600 GP), CHSL 10+2, Delhi Police SI, and Railway CBT.', icon: '🎯' },
        { title: 'Hindi Meanings & Mnemonic', desc: 'Every question includes verified Hindi translation and Hinglish memory hooks.', icon: '💡' },
      ],
      visualPreview: (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-950/90 p-2 rounded-xl border border-sky-500/40 flex items-center gap-2">
            <span className="text-base">🔀</span>
            <div>
              <div className="font-bold text-white">Antonyms</div>
              <div className="text-[10px] text-sky-300">6,000+ PYQs</div>
            </div>
          </div>
          <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-base">🔁</span>
            <div>
              <div className="font-bold text-white">Synonyms</div>
              <div className="text-[10px] text-slate-400">6,000+ PYQs</div>
            </div>
          </div>
          <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-base">🎯</span>
            <div>
              <div className="font-bold text-white">One Word (OWS)</div>
              <div className="text-[10px] text-slate-400">6,000+ PYQs</div>
            </div>
          </div>
          <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-base">📜</span>
            <div>
              <div className="font-bold text-white">Idioms & Phrases</div>
              <div className="text-[10px] text-slate-400">6,000+ PYQs</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'mistake_vault',
      badge: 'Step 3 of 5 • Smart Revision',
      badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
      title: 'Mistake Vault (Zero-Forgetting)',
      subtitle: 'Every wrong answer is automatically captured for guaranteed revision',
      icon: <BookOpen className="w-6 h-6 text-rose-400" />,
      iconBg: 'bg-gradient-to-tr from-rose-600 to-pink-600',
      taglineHindi: 'गलत उत्तर स्वतः सेव हो जाते हैं रिवीजन के लिए',
      description: 'Never lose a mark on the same word twice. Whenever you pick a wrong option in a 1v1 battle or practice drill, VocabClash auto-adds it to your Mistake Vault.',
      highlights: [
        { title: 'Auto-Saved Mistakes', desc: 'No manual bookmarking required; wrong answers are instantly collected.', icon: '📕' },
        { title: 'Custom Retry Drills', desc: 'Re-test your weak words until accuracy hits 100%.', icon: '🔄' },
        { title: 'Starred Bookmarks', desc: 'Star ultra-hard words for quick one-tap revision right before exam day.', icon: '⭐' },
      ],
      visualPreview: (
        <div className="bg-slate-950/90 rounded-xl p-2.5 border border-rose-500/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-rose-400 flex items-center gap-1">
              <span>📕 Mistake Auto-Saved</span>
            </span>
            <span className="text-[10px] bg-rose-900/60 text-rose-200 px-1.5 py-0.2 rounded font-mono font-bold">
              Repeated in CGL 3x
            </span>
          </div>
          <div className="text-xs font-bold text-white">EPHEMERAL (क्षणभंगुर)</div>
          <div className="text-[10px] text-slate-400">Correct Antonym: Permanent • Your Choice: Fleeting ❌</div>
        </div>
      ),
    },
    {
      id: 'daily_streak',
      badge: 'Step 4 of 5 • Habit & Ranks',
      badgeColor: 'bg-orange-950/80 text-orange-300 border-orange-500/40',
      title: 'Daily Streaks & Civil Service Ranks',
      subtitle: 'Build a winning daily habit and unlock prestigious Govt Job titles',
      icon: <Flame className="w-6 h-6 text-orange-400" />,
      iconBg: 'bg-gradient-to-tr from-amber-600 to-orange-600',
      taglineHindi: 'रोजाना अभ्यास से स्ट्रीक बनाएं और रैंक बढ़ाएं',
      description: 'Consistency is key for SSC & Govt examinations. Solve at least 1 question every day to protect your flame streak and earn daily bonus LP.',
      highlights: [
        { title: 'Daily Flame Streak', desc: 'Keep your streak alive every 24 hours. Resets to 0 if a day is missed.', icon: '🔥' },
        { title: 'Civil Servant Ranks', desc: 'Climb tiers: Aspirant ➡️ Auditor ➡️ GST/IT Inspector ➡️ Section Officer.', icon: '🏛️' },
        { title: 'All-India Leaderboard', desc: 'Compare your score with top aspirants across India in real time.', icon: '📈' },
      ],
      visualPreview: (
        <div className="bg-slate-950/90 rounded-xl p-2.5 border border-orange-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-600/30 border border-orange-500/50 flex items-center justify-center text-lg text-orange-400">
              🔥
            </div>
            <div>
              <div className="text-xs font-black text-white">7-Day Streak Active</div>
              <div className="text-[10px] text-orange-300">+50 Bonus LP Claimed Today</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-amber-400">Tier: Inspector</div>
            <div className="text-[10px] text-slate-400">1,840 LP</div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai_coach',
      badge: 'Step 5 of 5 • AI Superpowers',
      badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
      title: 'AI Gemini 3.7 Vocabulary Studio',
      subtitle: 'Root words, Hinglish mnemonics & exam repeat analysis on demand',
      icon: <Sparkles className="w-6 h-6 text-purple-400" />,
      iconBg: 'bg-gradient-to-tr from-purple-700 to-indigo-600',
      taglineHindi: 'Gemini AI द्वारा रूट वर्ड्स एवं याद रखने की देसी ट्रिक्स',
      description: 'Get deep breakdowns of confusing English words. Powered by Gemini 3.7 Flash to give you mnemonic hooks, Latin/Greek roots, and exam context.',
      highlights: [
        { title: 'Hinglish Memory Tricks', desc: 'Fun, relatable mnemonics tailored for Indian competitive exams.', icon: '💡' },
        { title: 'Root Word Etymology', desc: 'Learn prefixes & suffixes (e.g., "Bene-", "Mal-", "Chron-") to guess unknown words.', icon: '🧬' },
        { title: 'Repeat Pattern Analysis', desc: 'Understand how SSC and TCS have framed this word over the last 10 years.', icon: '📊' },
      ],
      visualPreview: (
        <div className="bg-slate-950/90 rounded-xl p-2.5 border border-purple-500/40 space-y-1">
          <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Desi Memory Trick:</span>
          </div>
          <div className="text-[11px] text-slate-300 italic bg-purple-950/40 p-2 rounded-lg border border-purple-900/50">
            &quot;<strong>LOQUACIOUS</strong> = 'Lock-ki-awaz' yaani jo bohot bolta ho (Talkative). Root: Loqu = To speak.&quot;
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[currentStepIndex];

  return (
    <div 
      id="onboarding-tour-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Modal Header */}
        <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-black shadow-md">
              VC
            </div>
            <div>
              <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>Welcome to VocabClash</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold border border-emerald-500/30">
                  Quick Guide
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Govt Exam English Arena (SSC, RRB, CDS)</p>
            </div>
          </div>

          <button
            id="close-onboarding-btn"
            onClick={handleFinish}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            title="Close and enter arena"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-950/50 px-3 pt-2 border-b border-slate-800 flex gap-2 shrink-0 text-xs font-bold">
          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('walkthrough');
            }}
            className={`pb-2 px-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'walkthrough'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Interactive Tour</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('demo');
            }}
            className={`pb-2 px-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'demo'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Try 1 Demo Duel Q</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('faq');
            }}
            className={`pb-2 px-2.5 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'faq'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>App FAQs</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

          {/* TAB 1: INTERACTIVE STEP-BY-STEP WALKTHROUGH */}
          {activeTab === 'walkthrough' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Step indicator pill */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStep.badgeColor}`}>
                  {currentStep.badge}
                </span>
                {/* Progress Dots */}
                <div className="flex items-center gap-1.5">
                  {steps.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        soundManager.playTap();
                        setCurrentStepIndex(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentStepIndex
                          ? 'w-6 bg-amber-400'
                          : idx < currentStepIndex
                          ? 'w-2 bg-emerald-400'
                          : 'w-2 bg-slate-700'
                      }`}
                      title={s.title}
                    />
                  ))}
                </div>
              </div>

              {/* Title & Icon Header */}
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl ${currentStep.iconBg} flex items-center justify-center shadow-lg shrink-0 border border-white/20`}>
                  {currentStep.icon}
                </div>
                <div>
                  <h2 id="tour-title" className="text-base font-black text-white leading-tight">
                    {currentStep.title}
                  </h2>
                  <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                    {currentStep.taglineHindi}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {currentStep.subtitle}
                  </p>
                </div>
              </div>

              {/* Visual Preview Box */}
              <div className="border border-slate-700/80 rounded-2xl p-2.5 bg-slate-950/60 shadow-inner">
                {currentStep.visualPreview}
              </div>

              {/* Detailed Highlights */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Key Rules & Features:
                </div>
                {currentStep.highlights.map((h, i) => (
                  <div key={i} className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-2.5 flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">{h.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{h.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{h.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE SAMPLE QUESTION DEMO */}
          {activeTab === 'demo' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="bg-sky-950/50 border border-sky-800/40 rounded-xl p-2.5 text-xs text-sky-200">
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-400" />
                  <span>Try a Live Duel Simulation Right Now!</span>
                </div>
                <p className="text-[11px] text-sky-300/80 mt-1">
                  Experience how question timers, Hindi clues, and combo points work in real 1v1 duels:
                </p>
              </div>

              {/* Sample Question Card */}
              <div className="bg-slate-950/90 border border-slate-700/90 rounded-2xl p-3.5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono font-bold">
                    SSC CGL Tier 1 • Repeated 6 Times
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">Sample Duel Timer: 10s</span>
                </div>

                <div className="text-center py-1">
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wide">
                    Select the most appropriate ANTONYM (विलोम शब्द)
                  </div>
                  <div className="text-lg font-black text-white mt-1 tracking-wide">
                    EPHEMERAL
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Hindi Meaning: <span className="text-slate-200 font-medium">क्षणभंगुर / अल्पकालिक</span>
                  </div>
                </div>

                {/* 4 Options */}
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { text: 'A. Transient (क्षणिक)', isCorrect: false },
                    { text: 'B. Fleeting (अल्पकालिक)', isCorrect: false },
                    { text: 'C. Permanent (स्थायी)', isCorrect: true },
                    { text: 'D. Momentary (तात्कालिक)', isCorrect: false },
                  ].map((opt, idx) => {
                    const isSelected = selectedDemoOption === idx;
                    let btnClass = 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 text-slate-200';
                    
                    if (demoAnswerSubmitted) {
                      if (opt.isCorrect) {
                        btnClass = 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-1 ring-emerald-400 font-bold';
                      } else if (isSelected) {
                        btnClass = 'bg-rose-950 border-rose-500 text-rose-200 font-bold';
                      } else {
                        btnClass = 'opacity-50 bg-slate-900 border-slate-800 text-slate-500';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={demoAnswerSubmitted}
                        onClick={() => handleDemoSelect(idx)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between ${btnClass}`}
                      >
                        <span>{opt.text}</span>
                        {demoAnswerSubmitted && opt.isCorrect && (
                          <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded">
                            CORRECT! +120 PTS
                          </span>
                        )}
                        {demoAnswerSubmitted && isSelected && !opt.isCorrect && (
                          <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded">
                            WRONG
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback result */}
                {demoAnswerSubmitted && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 animate-fadeIn ${
                    selectedDemoOption === 2
                      ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-600/50 text-rose-200'
                  }`}>
                    <div className="font-extrabold flex items-center justify-between">
                      <span>{selectedDemoOption === 2 ? '🎉 Excellent! +120 Combo Points' : '📕 Wrong! Auto-Saved to Mistake Vault'}</span>
                      <button
                        onClick={handleResetDemo}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Try Again</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      <strong>Explanation:</strong> 'Ephemeral' means lasting for a very short time (क्षणभंगुर). Hence, its exact opposite is <strong>Permanent</strong> (स्थायी).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FAQs & QUICK CHEAT SHEET */}
          {activeTab === 'faq' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🏆 What is LP (League Points)?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  LP reflects your competitive skill rating. You gain <strong>+30 LP</strong> for each 1v1 victory and combo bonuses. As your LP grows, you promote through Civil Service Ranks (Aspirant ➡️ Auditor ➡️ Inspector ➡️ Officer).
                </p>
              </div>

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-1">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <span>📕 How does the Mistake Vault work?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Whenever you make an error in any duel or PYQ drill, that question is automatically stored in your Mistake Vault. You can review all your wrong words anytime, practice re-tests, and delete them once mastered.
                </p>
              </div>

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-1">
                <div className="font-bold text-orange-300 flex items-center gap-1.5">
                  <span>🔥 How do I maintain my Daily Streak?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Solve just 1 question every calendar day (in 1v1 Duel or Practice Drill) to advance your streak. If you skip a day, the streak resets to 0. Keeping a high streak awards free bonus LP!
                </p>
              </div>

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-1">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>🤖 What can the AI Vocabulary Coach do?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Powered by Gemini 3.7 Flash, it explains etymology, Greek/Latin prefixes, Hinglish mnemonics, and previous 10-year exam repeat trends for any tough word.
                </p>
              </div>

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>☁️ How do I save my progress across phones?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tap your profile at the top left and sign in with Google or Email. Your LP, win records, and mistake vault sync to the secure cloud instantly!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-950/95 px-4 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          {activeTab === 'walkthrough' ? (
            <>
              <button
                id="tour-prev-btn"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                  currentStepIndex === 0
                    ? 'opacity-30 cursor-not-allowed text-slate-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="tour-skip-btn"
                  onClick={handleFinish}
                  className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
                >
                  Skip Tour
                </button>

                <button
                  id="tour-next-btn"
                  onClick={handleNext}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-orange-950/50 active:scale-95 transition-all"
                >
                  <span>{currentStepIndex === steps.length - 1 ? 'Start Playing 🚀' : 'Next Step'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('walkthrough')}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tour</span>
              </button>

              <button
                onClick={handleFinish}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <span>Enter Arena & Duel ⚔️</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
