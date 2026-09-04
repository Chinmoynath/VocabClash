import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { soundManager } from '../utils/audio';
import { generateSmartAnalysis, AiAnalysisResult } from '../utils/aiTutorEngine';
import { auth } from '../services/firebaseService';
import { 
  Sparkles, 
  X, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle,
  Search,
  ChevronRight,
  BookMarked,
  Languages,
  Crown
} from 'lucide-react';

interface DailyUsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
}

interface AiTutorModalProps {
  question: Question | null;
  onClose: () => void;
  onOpenPremium?: () => void;
}

export const AiTutorModal: React.FC<AiTutorModalProps> = ({ question, onClose, onOpenPremium }) => {
  const [customWord, setCustomWord] = useState<string>('');
  const [activeWord, setActiveWord] = useState<string>(question?.wordOrPhrase || 'TACITURN');
  const [activeCategory, setActiveCategory] = useState<string>(question?.category || 'antonyms');
  const [loading, setLoading] = useState<boolean>(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageInfo | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageStats = async () => {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : undefined;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const url = user ? `/api/gemini/usage?userId=${encodeURIComponent(user.uid)}` : '/api/gemini/usage';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setDailyUsage({
          used: data.used ?? 0,
          limit: data.limit ?? 5,
          remaining: data.remaining ?? 5,
          isPremium: Boolean(data.isPremium),
        });
      }
    } catch (e) {
      console.warn('Failed to fetch AI usage stats:', e);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchAnalysis = async (word: string, category: string) => {
    setLoading(true);
    setError(null);
    setLimitNotice(null);

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          wordOrPhrase: word,
          category: category,
          meaning: question?.meaning || 'Exam vocabulary term',
          examHistory: question?.examHistory || ['SSC CGL 2023', 'RRB NTPC'],
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.limitReached) {
        setLimitNotice(data.message || 'Daily AI explanation limit reached.');
        if (data.used !== undefined) {
          setDailyUsage(prev => ({
            used: data.used,
            limit: data.limit,
            remaining: 0,
            isPremium: Boolean(data.isPremium),
          }));
        }
        return;
      }

      if (res.ok) {
        if (data.dailyUsage) {
          setDailyUsage(data.dailyUsage);
        } else {
          fetchUsageStats();
        }

        if (data.analysis && data.analysis.mnemonicHook) {
          setAnalysis(data.analysis);
          return;
        }
      }
      
      // Fallback to local offline smart engine if server had an error
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
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-purple-300">Gemini Flash AI</p>
                {dailyUsage && (
                  <span className="text-[10px] text-slate-400">
                    • Quota: <strong className={dailyUsage.remaining === 0 ? 'text-amber-400' : 'text-emerald-400'}>{dailyUsage.used}/{dailyUsage.limit}</strong>
                  </span>
                )}
              </div>
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

        {/* Limit Warning if reached */}
        {limitNotice && (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-3.5 text-xs text-amber-200 flex flex-col gap-2 shadow-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Daily Limit Reached</p>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{limitNotice}</p>
                <p className="text-slate-400 text-[10px] mt-1">
                  Cached words & PYQ terms are always free and unlimited!
                </p>
              </div>
            </div>
            {onOpenPremium && !dailyUsage?.isPremium && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onOpenPremium();
                }}
                className="self-start mt-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Upgrade to Pro (50/day)</span>
              </button>
            )}
          </div>
        )}

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
            {/* 1. Meaning & Definition */}
            <div className="bg-gradient-to-br from-slate-800 to-indigo-950/30 border border-indigo-500/40 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                  <BookMarked className="w-4 h-4 text-indigo-400" />
                  <span>Meaning & Definition</span>
                </div>
                {analysis.partOfSpeech && (
                  <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded-full">
                    {analysis.partOfSpeech}
                  </span>
                )}
              </div>

              <p className="text-slate-100 font-semibold leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                {analysis.meaning || `Primary exam definition for "${activeWord}".`}
              </p>

              {analysis.hindiMeaning && (
                <div className="bg-purple-950/40 p-2.5 rounded-xl border border-purple-800/40 flex items-start gap-2">
                  <Languages className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase block mb-0.5">हिंदी अर्थ</span>
                    <span className="text-amber-200 font-bold">{analysis.hindiMeaning}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Mnemonic Memory Hook */}
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
