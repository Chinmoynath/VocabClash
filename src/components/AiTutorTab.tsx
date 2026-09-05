import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord, 
  Question, 
  QuestionCategory, 
  ExamType,
  MentorPeriod,
  MentorAiReport
} from '../types';
import { soundManager } from '../utils/audio';
import { 
  calculateMentorAnalytics 
} from '../services/mentorAnalyticsService';
import { 
  getVocabMentorReport, 
  buildWeakAreasDrillQuestions 
} from '../services/aiMentorCoachingService';
import { 
  getWordExplanationWithCache, 
  ExplanationResponse 
} from '../services/aiTutorCacheService';
import { HIGH_YIELD_EXAM_VOCAB } from '../utils/questionEducationResolver';
import { MentorDiagnosticsView } from './MentorDiagnosticsView';
import { RepeatedMistakesRow } from './RepeatedMistakesRow';
import { isItemSaved, isItemMistake } from '../utils/vaultManager';
import { 
  GraduationCap, 
  Sparkles, 
  Search, 
  X, 
  Volume2, 
  Bookmark, 
  BookmarkCheck, 
  Copy, 
  Check, 
  Shuffle, 
  Lightbulb, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  Languages, 
  Compass, 
  Flame, 
  RefreshCw,
  History
} from 'lucide-react';

export interface AiTutorTabProps {
  player?: PlayerProfile;
  streak?: DailyStreakState;
  savedWords?: SavedWord[];
  subscription?: { isPremium?: boolean };
  onStartTargetedPractice?: (questions: Question[], title: string) => void;
  onOpenUpgradeModal?: () => void;
  onBookmarkQuestion?: (question: Question) => void;
}

const DEFAULT_PLAYER_FALLBACK: PlayerProfile = {
  id: 'guest-aspirant',
  name: 'Aspirant',
  avatar: '👨‍🎓',
  country: 'India',
  countryCode: 'IN',
  targetExam: 'SSC CGL',
  tier: 'Aspirant',
  tierTitle: 'Aspirant',
  rankPoints: 1200,
  pyqScore: 0,
  level: 1,
  matchesPlayed: 0,
  matchesWon: 0,
  winStreak: 0,
  accuracyRate: 0,
  bestCategory: 'synonyms',
  badges: [],
};

interface CuratedExamWord {
  word: string;
  category: QuestionCategory;
  tag: string;
  hint: string;
}

const CURATED_EXAM_WORDS: CuratedExamWord[] = [
  { word: 'TACITURN', category: 'antonyms', tag: 'Latin: tacere', hint: 'अल्पभाषी / शांत' },
  { word: 'EPHEMERAL', category: 'synonyms', tag: 'Repeated 6x', hint: 'क्षणिक / अल्पकालिक' },
  { word: 'METICULOUS', category: 'synonyms', tag: 'SSC CHSL', hint: 'अति-सावधान' },
  { word: 'OBSEQUIOUS', category: 'synonyms', tag: 'Bank PO & CGL', hint: 'चापलूस' },
  { word: 'LACONIC', category: 'antonyms', tag: 'CPO SI & CDS', hint: 'संक्षिप्त / अल्पभाषी' },
  { word: 'BELLIGERENT', category: 'synonyms', tag: 'Latin: bellum', hint: 'लड़ाकू / युद्धरत' },
  { word: 'SANGUINE', category: 'antonyms', tag: 'Top PYQ Shift', hint: 'आशावादी' },
  { word: 'AMELIORATE', category: 'synonyms', tag: 'High-Frequency', hint: 'सुधारना / बेहतर बनाना' },
  { word: 'UBIQUITOUS', category: 'synonyms', tag: 'Latin: ubique', hint: 'सर्वव्यापी' },
  { word: 'PERNICIOUS', category: 'antonyms', tag: 'Exam Trap', hint: 'घातक / विनाशकारी' },
  { word: 'NADIR', category: 'antonyms', tag: 'Pair: Zenith', hint: 'पतन / निचला स्तर' },
  { word: 'ALTRUISTIC', category: 'synonyms', tag: 'Philanthropic', hint: 'परोपकारी / निस्वार्थी' },
  { word: 'SOMNAMBULIST', category: 'ows', tag: 'OWS Classic', hint: 'नींद में चलने वाला' },
  { word: 'FASTIDIOUS', category: 'synonyms', tag: 'CGL Tier-2', hint: 'नकचढ़ी' },
  { word: 'INDOLENT', category: 'antonyms', tag: 'High-Yield PYQ', hint: 'आलसी / निष्क्रिय' },
  { word: 'PANACEA', category: 'ows', tag: 'Cure for all', hint: 'रामबाण' },
  { word: 'ZENITH', category: 'antonyms', tag: 'Summit / Peak', hint: 'शीर्ष बिंदु' },
  { word: 'BURN THE MIDNIGHT OIL', category: 'idioms', tag: 'High Yield', hint: 'देर रात तक मेहनत करना' },
  { word: 'CALL IT A DAY', category: 'idioms', tag: 'Repeated Idiom', hint: 'काम बंद करना' },
  { word: 'A DIME A DOZEN', category: 'idioms', tag: 'Idiom Trap', hint: 'बहुत आम / साधारण' },
];

const STORAGE_KEY_RECENT_WORDS = 'vocabclash_recent_mentor_lookups';

export const AiTutorTab: React.FC<AiTutorTabProps> = ({
  player = DEFAULT_PLAYER_FALLBACK,
  streak,
  savedWords = [],
  subscription,
  onStartTargetedPractice,
  onBookmarkQuestion,
}) => {
  // Navigation View Toggle: Word & Mnemonic Mentor (Default) vs Diagnostics
  const [activeView, setActiveView] = useState<'mentor' | 'diagnostics'>('mentor');

  // Search & Mnemonic State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>('TACITURN');
  const [activeCategory, setActiveCategory] = useState<QuestionCategory | 'all'>('all');
  const [explanationData, setExplanationData] = useState<ExplanationResponse | null>(null);
  const [loadingWord, setLoadingWord] = useState<boolean>(false);
  const [copiedTrick, setCopiedTrick] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Recent Searches
  const [recentWords, setRecentWords] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECENT_WORDS);
      return stored ? JSON.parse(stored) : ['TACITURN', 'EPHEMERAL', 'METICULOUS', 'SANGUINE'];
    } catch {
      return ['TACITURN', 'EPHEMERAL', 'METICULOUS', 'SANGUINE'];
    }
  });

  // Diagnostics State
  const [selectedPeriod, setSelectedPeriod] = useState<MentorPeriod>('week');
  const analytics = useMemo(() => {
    return calculateMentorAnalytics(
      selectedPeriod,
      player,
      streak || { currentStreak: 0, highestStreak: 0, lastPlayedDate: '', streakFreezeActive: false },
      savedWords
    );
  }, [selectedPeriod, player, streak, savedWords]);

  const [mentorReport, setMentorReport] = useState<MentorAiReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [isPreparingDrill, setIsPreparingDrill] = useState<boolean>(false);

  // Load word explanation
  const fetchWordExplanation = useCallback(async (wordToFetch: string, cat?: QuestionCategory | 'all') => {
    const clean = wordToFetch.trim();
    if (!clean) return;

    setLoadingWord(true);
    try {
      const actualCategory = cat && cat !== 'all' ? cat : 'synonyms';
      const result = await getWordExplanationWithCache(
        clean,
        actualCategory,
        true, // All users have full free access in Vocab Mentor
        [player.targetExam || 'SSC CGL', 'Govt PYQ']
      );

      setExplanationData(result);
      setActiveWord(clean.toUpperCase());

      // Save to recent lookups
      setRecentWords(prev => {
        const next = [clean.toUpperCase(), ...prev.filter(w => w.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
        try {
          localStorage.setItem(STORAGE_KEY_RECENT_WORDS, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (err) {
      console.warn('Failed to fetch word explanation:', err);
    } finally {
      setLoadingWord(false);
    }
  }, [player.targetExam]);

  // Initial lookup on mount
  useEffect(() => {
    fetchWordExplanation(activeWord, activeCategory);
  }, []);

  // Handle Search Submission
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;
    soundManager.playTap();
    fetchWordExplanation(searchTerm.trim(), activeCategory);
  };

  // Handle Random Surprise Word
  const handleSurpriseWord = () => {
    soundManager.playTap();
    // Pick from curated or high yield dictionary
    const pool = CURATED_EXAM_WORDS;
    const randomPick = pool[Math.floor(Math.random() * pool.length)];
    setSearchTerm(randomPick.word);
    setActiveCategory(randomPick.category);
    fetchWordExplanation(randomPick.word, randomPick.category);
  };

  // Handle Audio Speech
  const handleSpeakWord = (wordToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    soundManager.playTap();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Check if currently active word is saved in user's vault
  const isWordSavedInVault = useMemo(() => {
    return savedWords.some(
      w => isItemSaved(w) && w.question.wordOrPhrase.toLowerCase() === activeWord.toLowerCase()
    );
  }, [savedWords, activeWord]);

  // Handle Bookmark / Save to Vault
  const handleSaveToVault = () => {
    if (!onBookmarkQuestion || !explanationData) return;
    soundManager.playTap();

    const analysis = explanationData.analysis;
    const mockQ: Question = {
      id: `mentor-${activeWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      wordOrPhrase: activeWord.toUpperCase(),
      category: (activeCategory === 'all' ? 'synonyms' : activeCategory) as QuestionCategory,
      question: `What is the meaning / synonym of "${activeWord.toUpperCase()}"?`,
      options: [
        analysis.meaning || activeWord,
        'Superficial or careless observation',
        'Contradictory or irregular condition',
        'Irrelevant or trivial detail',
      ],
      correctIndex: 0,
      meaning: analysis.meaning || activeWord,
      hindiMeaning: analysis.hindiMeaning || '',
      mnemonic: analysis.mnemonicHook || '',
      exampleSentence: analysis.sampleUsage || '',
      explanation: analysis.rootEtymology || analysis.meaning || '',
      difficulty: 'medium',
      importanceLevel: 'high',
      repeatCount: 1,
      examHistory: [player.targetExam || 'SSC CGL', 'Govt PYQ', 'AI Mentor'],
    };

    onBookmarkQuestion(mockQ);
  };

  // Handle Copy Trick to Clipboard
  const handleCopyTrick = () => {
    if (!explanationData) return;
    soundManager.playTap();
    const analysis = explanationData.analysis;
    const text = `🎓 ${activeWord.toUpperCase()}
📖 Meaning: ${analysis.meaning || 'N/A'}
🇮🇳 Hindi: ${analysis.hindiMeaning || 'N/A'}
💡 Desi Mnemonic: ${analysis.mnemonicHook || 'N/A'}
🧬 Root & Etymology: ${analysis.rootEtymology || 'N/A'}
📝 Usage: ${analysis.sampleUsage || 'N/A'}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedTrick(true);
        setTimeout(() => setCopiedTrick(false), 2000);
      });
    }
  };

  // Load diagnostics report if switching to diagnostics view
  useEffect(() => {
    if (activeView !== 'diagnostics') return;
    let isMounted = true;
    const loadReport = async () => {
      setReportLoading(true);
      try {
        const report = await getVocabMentorReport(analytics, false);
        if (isMounted) setMentorReport(report);
      } catch (err) {
        console.warn('Failed to load mentor report:', err);
      } finally {
        if (isMounted) setReportLoading(false);
      }
    };
    loadReport();
    return () => { isMounted = false; };
  }, [activeView, selectedPeriod, analytics.totalAttempted]);

  const handleRefreshReport = async () => {
    soundManager.playTap();
    setReportLoading(true);
    try {
      const fresh = await getVocabMentorReport(analytics, true);
      setMentorReport(fresh);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Targeted Practice Drill for weak areas
  const handleLaunchWeakAreasDrill = () => {
    soundManager.playTap();
    if (!onStartTargetedPractice) return;
    setIsPreparingDrill(true);
    try {
      const exam = (player.targetExam as ExamType) || 'SSC_CGL';
      const drillQuestions = buildWeakAreasDrillQuestions(analytics, exam, 10);
      const weakName = analytics.weakestCategory
        ? analytics.categoryStats[analytics.weakestCategory]?.name
        : 'Priority Vocab';
      onStartTargetedPractice(drillQuestions, `Weak Areas Drill · ${weakName}`);
    } catch (e) {
      console.error('Error starting targeted practice:', e);
    } finally {
      setIsPreparingDrill(false);
    }
  };

  // Mistake Words list from user's vault
  const mistakeWordsList = useMemo(() => {
    return savedWords
      .filter(w => isItemMistake(w))
      .slice(0, 10);
  }, [savedWords]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 pb-20 max-w-5xl mx-auto w-full">
      {/* 1. Header & Navigation Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-100">
                  AI Vocab Mentor
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold">
                  ✨ 100% Free
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-mono font-bold">
                  {player.targetExam || 'SSC CGL'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant Desi Hinglish Mnemonics, Latin & Greek Etymology & Exam Traps
              </p>
            </div>
          </div>

          {/* View Segmented Switcher */}
          <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl w-full md:w-auto self-start md:self-auto">
            <button
              onClick={() => {
                soundManager.playTap();
                setActiveView('mentor');
              }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'mentor'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Mnemonics & Word Lookup</span>
            </button>
            <button
              onClick={() => {
                soundManager.playTap();
                setActiveView('diagnostics');
              }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'diagnostics'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Performance Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main View Content */}
      {activeView === 'mentor' ? (
        <div className="space-y-4">
          {/* A. Search & Hero Input Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="vocab-mentor-search-input" className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-purple-400" />
                <span>Enter Any English Word, Idiom, or Root</span>
              </label>

              <button
                onClick={handleSurpriseWord}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all self-start sm:self-auto cursor-pointer hover:bg-amber-500/15"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>🎲 Surprise PYQ Word</span>
              </button>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="vocab-mentor-search-input"
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="e.g. Taciturn, Ephemeral, In a nutshell, Somnambulist..."
                  className="w-full pl-10 pr-9 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 text-slate-100 placeholder:text-slate-500 text-sm font-medium outline-none transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loadingWord || !searchTerm.trim()}
                className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-950/40 transition-all shrink-0 cursor-pointer"
              >
                {loadingWord ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Analyze Word</span>
                <span className="sm:hidden">Search</span>
              </button>
            </form>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-[11px] text-slate-500 font-semibold pr-1 shrink-0">Category:</span>
              {[
                { id: 'all', label: '🌟 All Types' },
                { id: 'synonyms', label: '📖 Synonyms' },
                { id: 'antonyms', label: '⚡ Antonyms' },
                { id: 'ows', label: '🧩 One Word (OWS)' },
                { id: 'idioms', label: '🎭 Idioms' },
              ].map(cat => {
                const isSelected = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      const newCat = cat.id as QuestionCategory | 'all';
                      setActiveCategory(newCat);
                      if (activeWord) {
                        fetchWordExplanation(activeWord, newCat);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/30 border border-purple-500/50 text-purple-200'
                        : 'bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Quick High-Yield Chips */}
            <div className="pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Frequently Tested in SSC & Govt Exams (Tap to Explore):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CURATED_EXAM_WORDS.map((item, idx) => {
                  const isActive = activeWord.toLowerCase() === item.word.toLowerCase();
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        soundManager.playTap();
                        setSearchTerm(item.word);
                        setActiveCategory(item.category);
                        fetchWordExplanation(item.word, item.category);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                          : 'bg-slate-950 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{item.word}</span>
                      <span className="text-[10px] text-slate-400 font-normal opacity-80">
                        {item.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* B. Loading Spinner */}
          {loadingWord && (
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-8 text-center space-y-3 shadow-md animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 mx-auto flex items-center justify-center text-purple-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">
                  Consulting Exam Knowledge Engine & Gemini AI...
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Deconstructing Latin & Greek roots, drafting Hinglish mnemonics, and mapping exam traps for "{activeWord}".
                </p>
              </div>
            </div>
          )}

          {/* Word Not Found State */}
          {!loadingWord && explanationData?.notFound && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Search className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-100">
                  We couldn't find this word. Check the spelling and try again.
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Please verify the spelling of <span className="text-purple-300 font-mono font-bold">"{activeWord}"</span> or try one of the high-frequency exam terms below.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                {['ABERRATION', 'TACITURN', 'EPHEMERAL', 'OBSEQUIOUS', 'METICULOUS', 'LACONIC'].map(sampleWord => (
                  <button
                    key={sampleWord}
                    onClick={() => {
                      soundManager.playTap();
                      setSearchTerm(sampleWord);
                      fetchWordExplanation(sampleWord, activeCategory);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    {sampleWord}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* C. The Active Word Breakdown Display */}
          {!loadingWord && explanationData && !explanationData.notFound && (
            <div className="space-y-4">
              {/* Word Header Hero Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                        {explanationData.analysis.partOfSpeech || 'Vocabulary Term'}
                      </span>
                      {activeCategory !== 'all' && (
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase">
                          {activeCategory}
                        </span>
                      )}
                      
                      {/* Priority Badging: Cached vs AI Enriched vs Basic Dictionary */}
                      {explanationData.fromCache ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>Cached</span>
                        </span>
                      ) : explanationData.source === 'gemini' || explanationData.aiEnrichmentAvailable ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>AI Enriched</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-sky-400" />
                          <span>Basic Dictionary</span>
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified Content</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wider font-mono">
                        {activeWord.toUpperCase()}
                      </h2>

                      {explanationData.analysis.phonetic && (
                        <span className="text-xs font-mono text-slate-400 font-normal">
                          {explanationData.analysis.phonetic}
                        </span>
                      )}

                      {/* Pronounce Button */}
                      <button
                        onClick={() => handleSpeakWord(activeWord)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          isSpeaking
                            ? 'bg-purple-600 border-purple-400 text-white animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-purple-300 hover:text-white'
                        }`}
                        title="Pronounce Word"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Hindi Meaning in Header */}
                    {explanationData.analysis.hindiMeaning && (
                      <div className="mt-1 text-sm font-bold text-amber-400 flex items-center gap-1.5">
                        <Languages className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{explanationData.analysis.hindiMeaning}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Save to Vault & Copy */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={handleSaveToVault}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isWordSavedInVault
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                      title={isWordSavedInVault ? 'Saved in your Vault' : 'Save to Mistake / Word Vault'}
                    >
                      {isWordSavedInVault ? (
                        <>
                          <BookmarkCheck className="w-4 h-4 text-amber-400" />
                          <span>Saved in Vault</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4 text-slate-400" />
                          <span>Save to Vault</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCopyTrick}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all cursor-pointer"
                      title="Copy mnemonic trick and breakdown"
                    >
                      {copiedTrick ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy Trick</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informative Notice Banner if Basic Dictionary was loaded */}
              {!explanationData.aiEnrichmentAvailable && (
                <div className="px-3.5 py-2.5 rounded-xl bg-sky-950/40 border border-sky-800/40 text-sky-300 text-xs flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Basic dictionary explanation loaded. Verified definition, synonyms, and examples are displayed below.</span>
                </div>
              )}

              {/* Breakdown Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Exam Definition */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span>English Definition</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">
                    {explanationData.analysis.meaning || 'Verified dictionary definition.'}
                  </p>
                </div>

                {/* 2. Desi Mnemonic Hook (याद रखने की धांसू Trick) */}
                <div className="bg-gradient-to-br from-amber-950/30 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-black text-amber-300">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span>देसी Mnemonic Trick (याद रखने का Hook)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                      Memory Hook
                    </span>
                  </div>
                  {explanationData.analysis.mnemonicHook ? (
                    <>
                      <p className="text-sm text-amber-100 font-semibold leading-relaxed">
                        {explanationData.analysis.mnemonicHook}
                      </p>
                      <p className="text-[11px] text-amber-300/80 italic">
                        💡 5-Second Rule: Visualize this story once, and you won't forget it in the exam hall.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-amber-200/70 italic leading-relaxed">
                      Mnemonic trick is currently unavailable for this word. Refer to the dictionary definition, examples, and synonyms below.
                    </p>
                  )}
                </div>

                {/* 3. Latin & Greek Root Etymology */}
                <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                    <Compass className="w-4 h-4 text-sky-400" />
                    <span>Root Word & Etymology Tree</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {explanationData.analysis.rootEtymology || 'Classical root breakdown unavailable. Standard dictionary origin applies.'}
                  </p>
                </div>

                {/* 4. Exam Trap & Examiner Tricks */}
                <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Exam Trap & Misleading Options</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {explanationData.analysis.examTrapTip || 'Examiners frequently place tempting near-synonyms as trap options. Always verify the required part of speech.'}
                  </p>
                </div>
              </div>

              {/* 5. Exam Sentence Usage */}
              {explanationData.analysis.sampleUsage && (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Sentence Example</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 italic font-medium">
                    "{explanationData.analysis.sampleUsage}"
                  </p>
                </div>
              )}

              {/* 6. Related & Confusable Words / Synonyms */}
              {explanationData.analysis.relatedWords && explanationData.analysis.relatedWords.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                  <span className="text-xs font-black text-slate-300">
                    Synonyms & Related Vocabulary:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {explanationData.analysis.relatedWords.map((relWord, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          soundManager.playTap();
                          setSearchTerm(relWord);
                          fetchWordExplanation(relWord, activeCategory);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-slate-300 hover:text-purple-200 text-xs font-semibold transition-all cursor-pointer"
                      >
                        {relWord} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* D. Words You're Repeatedly Missing (3-4 Cards in 1 Line + More Modal) */}
          <RepeatedMistakesRow
            items={analytics.repeatedMistakes}
            fallbackSavedWords={mistakeWordsList}
            onAnalyzeWord={(word, cat) => {
              setSearchTerm(word);
              if (cat) setActiveCategory(cat);
              fetchWordExplanation(word, cat);
            }}
          />

          {/* E. Recent Searches */}
          {recentWords.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto text-xs py-1 text-slate-400">
              <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">Recent:</span>
              {recentWords.map((rw, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    soundManager.playTap();
                    setSearchTerm(rw);
                    fetchWordExplanation(rw, activeCategory);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium shrink-0 cursor-pointer"
                >
                  {rw}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 3. Diagnostics View (Full Analytics Pipeline Preserved) */
        <MentorDiagnosticsView
          analytics={analytics}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          mentorReport={mentorReport}
          reportLoading={reportLoading}
          onRefreshReport={handleRefreshReport}
          onLaunchDrill={handleLaunchWeakAreasDrill}
          isPreparingDrill={isPreparingDrill}
          player={player}
          onAnalyzeWord={(word) => {
            setActiveView('mentor');
            setSearchTerm(word);
            fetchWordExplanation(word);
          }}
        />
      )}
    </div>
  );
};
