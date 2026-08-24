import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { generateSmartAnalysis, AiAnalysisResult } from '../utils/aiTutorEngine';
import { 
  Sparkles, 
  BookOpen, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle,
  Search,
  ChevronRight,
  TrendingUp,
  Brain,
  GraduationCap
} from 'lucide-react';

const SUGGESTED_EXAM_WORDS = [
  { word: 'TACITURN', category: 'antonyms', tag: 'SSC CGL 4x' },
  { word: 'EPHEMERAL', category: 'synonyms', tag: 'Repeated 6x' },
  { word: 'OBSEQUIOUS', category: 'synonyms', tag: 'Bank PO' },
  { word: 'METICULOUS', category: 'synonyms', tag: 'SSC CHSL 5x' },
  { word: 'LACONIC', category: 'antonyms', tag: 'CPO SI' },
  { word: 'BELLIGERENT', category: 'synonyms', tag: 'CDS Exam' },
  { word: 'UBIQUITOUS', category: 'synonyms', tag: 'SSC CGL 2024' },
  { word: 'CANDID', category: 'antonyms', tag: 'Top PYQ' }
];

export const AiTutorTab: React.FC = () => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>('TACITURN');
  const [activeCategory, setActiveCategory] = useState<string>('antonyms');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(() => 
    generateSmartAnalysis('TACITURN', 'antonyms')
  );

  const fetchAnalysis = async (word: string, category: string) => {
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordOrPhrase: word,
          category: category,
          meaning: 'Exam vocabulary term',
          examHistory: ['SSC CGL 2024', 'SSC CPO', 'RRB NTPC'],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis && data.analysis.mnemonicHook) {
          setAnalysis(data.analysis);
          return;
        }
      }
      
      const smartResult = generateSmartAnalysis(word, category);
      setAnalysis(smartResult);
    } catch (err) {
      console.warn('AI analysis fallback to smart engine:', err);
      const smartResult = generateSmartAnalysis(word, category);
      setAnalysis(smartResult);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    soundManager.playTap();
    const query = searchInput.trim().toUpperCase();
    setActiveWord(query);
    fetchAnalysis(query, activeCategory);
  };

  const handleSelectWord = (word: string, cat: string) => {
    soundManager.playTap();
    setActiveWord(word);
    setActiveCategory(cat);
    fetchAnalysis(word, cat);
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 pb-8 max-w-5xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-800/40 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/40">
              <Brain className="w-5 h-5 text-purple-400" />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-100 flex items-center gap-1.5">
              AI Vocab Mentor
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full font-bold">
                Gemini 3.7 Flash
              </span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Instant Hinglish root word mnemonics, repeat trends & exam traps.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Type any word (e.g., Obsequious, Ephemeral)..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-slate-850 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 shadow-inner"
          />
        </div>
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1 shadow-md shadow-purple-950 transition-all shrink-0 cursor-pointer"
        >
          <span>Explain</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Quick PYQ Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-400">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>High-Frequency SSC / Banking Exam Words:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_EXAM_WORDS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectWord(item.word, item.category)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                activeWord === item.word
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
            >
              <span>{item.word}</span>
              <span className="text-[9px] bg-slate-900/80 text-amber-300 font-mono px-1.5 py-0.5 rounded">
                {item.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Word Focus Card */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border border-purple-600/40 rounded-2xl p-4 sm:p-6 text-center shadow-lg relative overflow-hidden">
        <div className="text-[10px] uppercase font-mono font-bold text-purple-300 bg-purple-900/60 px-2.5 py-0.5 rounded-full border border-purple-500/40 inline-block mb-1">
          {activeCategory}
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-300 tracking-wide break-words">
          "{activeWord}"
        </h1>
      </div>

      {/* Analysis Content */}
      {loading ? (
        <div className="py-14 text-center space-y-3 bg-slate-850/60 border border-slate-800 rounded-2xl">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs font-bold text-slate-300">
            Decoding root words, Hinglish mnemonics & exam trap traps...
          </div>
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* 1. Mnemonic Memory Hook (Full width on desktop) */}
          <div className="md:col-span-2 bg-slate-850 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-400 text-sm sm:text-base">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Govt Exam Mnemonic Hook (Desi Trick)</span>
            </div>
            <p className="text-slate-200 leading-relaxed font-medium bg-slate-900/90 p-3 sm:p-4 rounded-xl border border-slate-750 text-xs sm:text-sm">
              {analysis.mnemonicHook}
            </p>
          </div>

          {/* 2. Root Word Etymology */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-2 shadow-sm flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sky-400 text-sm">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Root Word & Etymology Breakdown</span>
              </div>
              <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs sm:text-sm">
                {analysis.rootEtymology}
              </p>
            </div>
          </div>

          {/* 3. Govt Exam Trap Tip */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-2 shadow-sm flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Exam Trap & Examiner Tricks</span>
              </div>
              <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs sm:text-sm">
                {analysis.examTrapTip}
              </p>
            </div>
          </div>

          {/* 4. Sentence Example */}
          <div className="md:col-span-2 bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Real Exam Sentence Usage</span>
            </div>
            <p className="text-slate-300 italic bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs sm:text-sm">
              "{analysis.sampleUsage}"
            </p>
          </div>

          {/* 5. Related Words */}
          {analysis.relatedWords && analysis.relatedWords.length > 0 && (
            <div className="md:col-span-2 bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-300 text-xs sm:text-sm">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span>Related Vocabulary to Master:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.relatedWords.map((rw, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectWord(rw, activeCategory)}
                    className="bg-slate-850 hover:bg-purple-600 hover:text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    {rw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
