import React, { useState, useMemo } from 'react';
import { RepeatedMistakeItem, QuestionCategory, SavedWord } from '../types';
import { soundManager } from '../utils/audio';
import { 
  ShieldAlert, 
  Search, 
  X, 
  Sparkles, 
  ChevronRight, 
  ArrowRight, 
  Plus, 
  CheckCircle2,
  BookOpen
} from 'lucide-react';

export interface RepeatedMistakesRowProps {
  items: RepeatedMistakeItem[];
  fallbackSavedWords?: SavedWord[];
  onAnalyzeWord: (word: string, category?: QuestionCategory) => void;
  title?: string;
  subtitle?: string;
}

export const RepeatedMistakesRow: React.FC<RepeatedMistakesRowProps> = ({
  items = [],
  fallbackSavedWords = [],
  onAnalyzeWord,
  title = "Words You're Repeatedly Missing",
  subtitle = "Click any word to unlock its Hinglish mnemonic and root etymology."
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Combine items with any mistake words from savedWords so the user always sees their actual mistakes
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

  // If there are more than 3 words, show first 3 cards + 1 "More" card in 1 line
  // If there are 3 or fewer words, show all of them in 1 line
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

  const handleOpenModal = () => {
    soundManager.playTap();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    soundManager.playTap();
    setIsModalOpen(false);
    setSearchFilter('');
  };

  const handleCardClick = (word: string, category?: QuestionCategory) => {
    soundManager.playTap();
    onAnalyzeWord(word, category);
  };

  if (allMissingWords.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs sm:text-sm font-black text-slate-100">{title}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Awesome! No repeated mistakes recorded yet. Words you miss during practice will automatically appear here with quick Hinglish mnemonics.
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
              onClick={handleOpenModal}
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
              onClick={() => handleCardClick(item.wordOrPhrase, item.category)}
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
                  Trick →
                </span>
              </div>
            </div>
          ))}

          {/* The 4th "More" Card when there are extra missing words */}
          {hasMoreThanLimit && (
            <button
              onClick={handleOpenModal}
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

      {/* Full "More" Words Modal Overlay */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={handleCloseModal}
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
                    Tap any word to unlock its Hinglish mnemonic hook and root etymology.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseModal}
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
                        handleCloseModal();
                        handleCardClick(item.wordOrPhrase, item.category);
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
                          <span>Unlock Mnemonic</span>
                          <ArrowRight className="w-3 h-3" />
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
                onClick={handleCloseModal}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
