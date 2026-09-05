import React, { useState, useMemo } from 'react';
import { RepeatedMistakeItem, QuestionCategory, SavedWord } from '../types';
import { soundManager } from '../utils/audio';
import { getStoredWordDetail, StoredWordDetail } from '../services/storedWordService';
import { 
  ShieldAlert, 
  Search, 
  X, 
  Sparkles, 
  ChevronRight, 
  Plus, 
  CheckCircle2,
  BookOpen,
  Volume2,
  Lightbulb,
  Compass,
  AlertTriangle,
  Copy,
  Check,
  Languages
} from 'lucide-react';

export interface RepeatedMistakesRowProps {
  items: RepeatedMistakeItem[];
  fallbackSavedWords?: SavedWord[];
  onAnalyzeWord?: (word: string, category?: QuestionCategory) => void;
  title?: string;
  subtitle?: string;
}

export const RepeatedMistakesRow: React.FC<RepeatedMistakesRowProps> = ({
  items = [],
  fallbackSavedWords = [],
  title = "Words You're Repeatedly Missing",
  subtitle = "Tap any word to view its stored meaning, mnemonic, and exam tricks."
}) => {
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Stored word detail modal state
  const [selectedWordDetail, setSelectedWordDetail] = useState<StoredWordDetail | null>(null);
  const [copiedTrick, setCopiedTrick] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Combine items with any mistake words from savedWords
  const allMissingWords: RepeatedMistakeItem[] = useMemo(() => {
    const map = new Map<string, RepeatedMistakeItem>();
    
    // 1. Add known repeated mistakes
    for (const it of items) {
      if (!it.wordOrPhrase) continue;
      map.set(it.wordOrPhrase.toLowerCase().trim(), { ...it });
    }

    // 2. Supplement from savedWords if marked as mistakes
    for (const sw of fallbackSavedWords) {
      const q = sw.question;
      if (!q || !q.wordOrPhrase) continue;
      const key = q.wordOrPhrase.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          wordOrPhrase: q.wordOrPhrase,
          category: q.category,
          wrongCount: sw.mistakeCount || 1,
          meaning: q.meaning,
          hindiMeaning: q.hindiMeaning,
          lastMissedAt: sw.savedAt,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.wrongCount - a.wrongCount);
  }, [items, fallbackSavedWords]);

  // Show first 3 cards + 1 "More" card if there are > 3 words
  const maxLineCards = 3;
  const hasMoreThanLimit = allMissingWords.length > maxLineCards;
  const visibleCards = useMemo(() => {
    return hasMoreThanLimit ? allMissingWords.slice(0, maxLineCards) : allMissingWords;
  }, [allMissingWords, hasMoreThanLimit]);

  const remainingCount = allMissingWords.length - visibleCards.length;

  // Filtered list for the "More" modal
  const modalFilteredWords = useMemo(() => {
    if (!searchFilter.trim()) return allMissingWords;
    const query = searchFilter.toLowerCase().trim();
    return allMissingWords.filter(w => 
      w.wordOrPhrase.toLowerCase().includes(query) ||
      (w.hindiMeaning && w.hindiMeaning.toLowerCase().includes(query)) ||
      (w.meaning && w.meaning.toLowerCase().includes(query)) ||
      w.category.toLowerCase().includes(query)
    );
  }, [allMissingWords, searchFilter]);

  // Touch handler: Show stored data directly without calling Gemini
  const handleInspectWord = (word: string, category?: QuestionCategory) => {
    soundManager.playTap();
    const detail = getStoredWordDetail(word, category, fallbackSavedWords);
    setSelectedWordDetail(detail);
  };

  const handleCloseDetailModal = () => {
    soundManager.playTap();
    setSelectedWordDetail(null);
    setCopiedTrick(false);
  };

  // Audio Speech Pronunciation
  const handleSpeak = (wordToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    soundManager.playTap();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);
    utterance.rate = 0.9;
    utterance.lang = 'en-US';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Copy Trick
  const handleCopyTrick = () => {
    if (!selectedWordDetail) return;
    soundManager.playTap();
    const text = `🎓 ${selectedWordDetail.wordOrPhrase}
📖 Meaning: ${selectedWordDetail.meaning}
🇮🇳 Hindi: ${selectedWordDetail.hindiMeaning}
💡 Mnemonic Trick: ${selectedWordDetail.mnemonic}
${selectedWordDetail.rootEtymology ? `🧬 Root: ${selectedWordDetail.rootEtymology}\n` : ''}${selectedWordDetail.sampleUsage ? `📝 Usage: ${selectedWordDetail.sampleUsage}` : ''}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedTrick(true);
        setTimeout(() => setCopiedTrick(false), 2000);
      });
    }
  };

  if (allMissingWords.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs sm:text-sm font-black text-slate-100">{title}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No repeated mistakes recorded yet! Words you miss during drills or practice will automatically appear here with their complete stored mnemonics, Hindi meanings, and exam tricks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        {/* Header with Title and "View More" option */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-100">
                  {title}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-bold text-[10px]">
                  {allMissingWords.length} Words
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Header "More" Button */}
          {allMissingWords.length > 1 && (
            <button
              onClick={() => {
                soundManager.playTap();
                setIsListModalOpen(true);
              }}
              className="flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer shrink-0"
              title="View all missing words"
            >
              <span>More ({allMissingWords.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 1-Line Cards Container */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 items-stretch">
          {visibleCards.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleInspectWord(item.wordOrPhrase, item.category)}
              className="p-3 rounded-xl bg-slate-950 border border-rose-900/30 hover:border-purple-500/70 hover:bg-purple-950/20 transition-all flex flex-col justify-between gap-2 cursor-pointer group shadow-sm hover:shadow-md"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="font-mono font-black text-xs sm:text-sm text-slate-100 tracking-wider group-hover:text-purple-300 transition-colors truncate">
                    {item.wordOrPhrase}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-[9px] shrink-0">
                    {item.wrongCount}x
                  </span>
                </div>

                {item.hindiMeaning && (
                  <div className="text-[11px] text-amber-400 font-bold truncate">
                    {item.hindiMeaning}
                  </div>
                )}

                {item.meaning && (
                  <div className="text-[10px] text-slate-400 line-clamp-1">
                    {item.meaning}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-900">
                <span className="uppercase tracking-wider font-semibold text-slate-400 text-[9px]">
                  {item.category}
                </span>
                <span className="text-purple-400/90 font-medium group-hover:underline text-[10px] flex items-center gap-0.5">
                  View Tricks →
                </span>
              </div>
            </div>
          ))}

          {/* The 4th "More" Card when there are extra missing words */}
          {hasMoreThanLimit && (
            <button
              onClick={() => {
                soundManager.playTap();
                setIsListModalOpen(true);
              }}
              className="p-3 rounded-xl bg-slate-950/70 border border-dashed border-rose-500/40 hover:border-purple-500 hover:bg-purple-950/20 transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer group min-h-[90px]"
              title="Open full list of missing words"
            >
              <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-300 group-hover:bg-purple-500/30 group-hover:text-purple-200 flex items-center justify-center transition-colors">
                <Plus className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-xs font-black text-slate-200 group-hover:text-purple-300 block">
                  +{remainingCount} More
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                  View All Words
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Full "More" Words List Modal Overlay */}
      {isListModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={() => {
            soundManager.playTap();
            setIsListModalOpen(false);
            setSearchFilter('');
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-slate-100 truncate">
                      {title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold text-xs">
                      {allMissingWords.length} Words
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    Tap any word to view its stored mnemonics, meaning, and tricks.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  soundManager.playTap();
                  setIsListModalOpen(false);
                  setSearchFilter('');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Input if multiple words */}
            {allMissingWords.length > 4 && (
              <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Search your missing words..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-500"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Modal Body: Scrollable Grid of All Missing Words */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 max-h-[60vh]">
              {modalFilteredWords.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {modalFilteredWords.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        handleInspectWord(item.wordOrPhrase, item.category);
                      }}
                      className="p-3.5 rounded-xl bg-slate-950 border border-rose-900/30 hover:border-purple-500 hover:bg-purple-950/20 transition-all flex flex-col justify-between gap-2.5 cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-slate-100 tracking-wider group-hover:text-purple-300 transition-colors">
                              {item.wordOrPhrase}
                            </span>
                            <Sparkles className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {item.hindiMeaning && (
                            <div className="text-xs text-amber-400 font-bold mt-0.5">
                              {item.hindiMeaning}
                            </div>
                          )}
                          {item.meaning && (
                            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {item.meaning}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-[10px] shrink-0">
                          {item.wrongCount}x Wrong
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                        <span className="uppercase tracking-wider font-semibold text-slate-400">
                          {item.category}
                        </span>
                        <span className="text-purple-400 font-bold group-hover:underline flex items-center gap-1">
                          <span>View Tricks</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Search className="w-6 h-6 mx-auto text-slate-600" />
                  <p className="text-xs">No missing words matching "{searchFilter}"</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Close Button */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500">
                Showing {modalFilteredWords.length} of {allMissingWords.length} missing words
              </span>
              <button
                onClick={() => {
                  soundManager.playTap();
                  setIsListModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rich Stored Word Details Modal (No Gemini, Direct Stored Data) */}
      {selectedWordDetail && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={handleCloseDetailModal}
        >
          <div 
            className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-black font-mono text-slate-100 tracking-wide">
                    {selectedWordDetail.wordOrPhrase}
                  </h2>
                  <button
                    onClick={() => handleSpeak(selectedWordDetail.wordOrPhrase)}
                    className={`p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition-colors cursor-pointer ${
                      isSpeaking ? 'animate-pulse text-purple-200' : ''
                    }`}
                    title="Listen to pronunciation"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold text-xs uppercase">
                    {selectedWordDetail.category}
                  </span>
                  {selectedWordDetail.wrongCount && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-xs">
                      Missed {selectedWordDetail.wrongCount}x
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Stored PYQ Question Bank & Master Vocabulary Data
                </p>
              </div>

              <button
                onClick={handleCloseDetailModal}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 max-h-[70vh]">
              {/* Meaning Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>English Definition</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  {selectedWordDetail.meaning}
                </p>

                {selectedWordDetail.hindiMeaning && (
                  <div className="pt-2 border-t border-slate-900 flex items-start gap-2">
                    <Languages className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        हिन्दी अर्थ:
                      </span>
                      <span className="text-sm font-bold text-amber-300">
                        {selectedWordDetail.hindiMeaning}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mnemonic Trick Card */}
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>Desi Hinglish Mnemonic & Memory Hook</span>
                  </div>
                  <button
                    onClick={handleCopyTrick}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/20 transition-all cursor-pointer"
                  >
                    {copiedTrick ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Trick</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed">
                  {selectedWordDetail.mnemonic}
                </p>
                <p className="text-[11px] text-amber-300/80 italic">
                  💡 5-Second Rule: Visualize this memory hook once, and you won't forget it in the exam hall.
                </p>
              </div>

              {/* Root Word & Etymology */}
              {selectedWordDetail.rootEtymology && (
                <div className="bg-slate-950/70 border border-sky-500/30 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                    <Compass className="w-4 h-4 text-sky-400" />
                    <span>Root Word & Etymology Tree</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {selectedWordDetail.rootEtymology}
                  </p>
                </div>
              )}

              {/* Exam Trap Tip */}
              {selectedWordDetail.examTrapTip && (
                <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Exam Trap & Misleading Options</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {selectedWordDetail.examTrapTip}
                  </p>
                </div>
              )}

              {/* Sentence Usage */}
              {selectedWordDetail.sampleUsage && (
                <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Exam Sentence Example</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 italic font-medium">
                    "{selectedWordDetail.sampleUsage}"
                  </p>
                </div>
              )}

              {/* Synonyms & Antonyms Chips */}
              {((selectedWordDetail.synonyms && selectedWordDetail.synonyms.length > 0) ||
                (selectedWordDetail.antonyms && selectedWordDetail.antonyms.length > 0)) && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  {selectedWordDetail.synonyms && selectedWordDetail.synonyms.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                        Synonyms:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedWordDetail.synonyms.map((syn, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-emerald-200 text-xs font-medium"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWordDetail.antonyms && selectedWordDetail.antonyms.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                        Antonyms:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedWordDetail.antonyms.map((ant, aIdx) => (
                          <span
                            key={aIdx}
                            className="px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs font-medium"
                          >
                            {ant}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end shrink-0">
              <button
                onClick={handleCloseDetailModal}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
