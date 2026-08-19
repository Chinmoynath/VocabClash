import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { soundManager } from '../utils/audio';
import { generateSmartAnalysis, AiAnalysisResult } from '../utils/aiTutorEngine';
import { 
  Sparkles, 
  X, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle,
  Search,
  ChevronRight
} from 'lucide-react';

interface AiTutorModalProps {
  question: Question | null;
  onClose: () => void;
}

export const AiTutorModal: React.FC<AiTutorModalProps> = ({ question, onClose }) => {
  const [customWord, setCustomWord] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>(question?.wordOrPhrase || 'TACITURN');
  const [activeCategory, setActiveCategory] = useState<string>(question?.category || 'antonyms');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async (word: string, category: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordOrPhrase: word,
          category: category,
          meaning: question?.meaning || 'Exam vocabulary term',
          examHistory: question?.examHistory || ['SSC CGL 2023', 'RRB NTPC'],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis && data.analysis.mnemonicHook) {
          setAnalysis(data.analysis);
          return;
        }
      }
      
      // If server returned error or non-200, use smart knowledge engine
      const smartResult = generateSmartAnalysis(word, category);
      setAnalysis(smartResult);
    } catch (err: unknown) {
      console.warn('AI analysis fallback to smart engine:', err);
      const smartResult = generateSmartAnalysis(word, category);
      setAnalysis(smartResult);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (question) {
      setActiveWord(question.wordOrPhrase);
      setActiveCategory(question.category);
      fetchAnalysis(question.wordOrPhrase, question.category);
    } else {
      fetchAnalysis('TACITURN', 'antonyms');
    }
  }, [question]);

  const handleSearchCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWord.trim()) return;
    soundManager.playTap();
    setActiveWord(customWord.trim());
    fetchAnalysis(customWord.trim(), activeCategory);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col space-y-4">
        {/* Modal Top */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-950 border border-purple-600 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">AI Exam Vocabulary Coach</h3>
              <p className="text-[10px] text-purple-300">Powered by Gemini 3.7 Flash</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search any word */}
        <form onSubmit={handleSearchCustom} className="flex gap-2">
          <input
            type="text"
            placeholder="Ask AI about any English word or idiom..."
            value={customWord}
            onChange={e => setCustomWord(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 shadow-md"
          >
            <span>Analyze</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Current Word Banner */}
        <div className="bg-gradient-to-r from-purple-950/60 to-slate-800 border border-purple-700/60 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-mono font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-600/40">
            {activeCategory}
          </span>
          <h2 className="text-2xl font-black text-amber-300 mt-1 break-words">
            "{activeWord}"
          </h2>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="text-xs font-bold text-slate-300">
              Analyzing root words, Hinglish mnemonics & 100% Guaranteed PYQ Pool...
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-3 text-xs">
            {/* 1. Mnemonic Memory Hook */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Govt Exam Mnemonic Hook (Trick)</span>
              </div>
              <p className="text-slate-200 leading-relaxed font-medium bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                {analysis.mnemonicHook}
              </p>
            </div>

            {/* 2. Root Word Etymology */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sky-400">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Root Word & Etymology Breakdown</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {analysis.rootEtymology}
              </p>
            </div>

            {/* 3. Govt Exam Trap Tip */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Exam Trap & Repeats Insight</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {analysis.examTrapTip}
              </p>
            </div>

            {/* 4. Official Sentence Example */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Exam-Style Sentence Usage</span>
              </div>
              <p className="text-slate-300 italic">
                "{analysis.sampleUsage}"
              </p>
            </div>

            {/* 5. Related Exam Words */}
            {analysis.relatedWords && analysis.relatedWords.length > 0 && (
              <div className="space-y-1">
                <div className="font-bold text-slate-400 text-[11px]">Related Exam Words:</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.relatedWords.map((rw, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        soundManager.playTap();
                        setActiveWord(rw);
                        fetchAnalysis(rw, activeCategory);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg text-[11px] font-semibold"
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
    </div>
  );
};
