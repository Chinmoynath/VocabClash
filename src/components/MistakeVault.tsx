import React, { useState } from 'react';
import { SavedWord, Question } from '../types';
import { soundManager } from '../utils/audio';
import { 
  BookOpen, 
  Trash2, 
  RotateCw, 
  Sparkles, 
  Bookmark, 
  BookmarkCheck,
  Search,
  Star,
  Flame,
  Layers,
  AlertCircle
} from 'lucide-react';

interface MistakeVaultProps {
  savedWords: SavedWord[];
  onRemoveWord: (questionId: string) => void;
  onToggleUserSaved?: (questionId: string) => void;
  onOpenAiTutor: (question: Question) => void;
}

export const MistakeVault: React.FC<MistakeVaultProps> = ({
  savedWords,
  onRemoveWord,
  onToggleUserSaved,
  onOpenAiTutor,
}) => {
  const [activeView, setActiveView] = useState<'list' | 'flashcards'>('list');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'saved_by_me' | 'mistakes'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const isItemSavedByMe = (item: SavedWord) => {
    return item.isUserSaved === true || (item.isBookmarked === true && item.isUserSaved !== false);
  };

  const isItemMistake = (item: SavedWord) => {
    return (item.mistakeCount || 0) > 0;
  };

  // Counts for Top Filters
  const totalCount = savedWords.length;
  const userSavedCount = savedWords.filter(isItemSavedByMe).length;
  const mistakesCount = savedWords.filter(isItemMistake).length;

  // Filtered dataset
  const filteredWords = savedWords.filter(item => {
    // 1. Origin Filter
    if (filterOrigin === 'saved_by_me' && !isItemSavedByMe(item)) return false;
    if (filterOrigin === 'mistakes' && !isItemMistake(item)) return false;

    // 2. Category Filter
    if (filterCategory !== 'all' && item.question.category !== filterCategory) return false;

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchWord = item.question.wordOrPhrase.toLowerCase().includes(q);
      const matchHindi = item.question.hindiMeaning?.toLowerCase().includes(q) || false;
      const matchMeaning = item.question.meaning?.toLowerCase().includes(q) || false;
      return matchWord || matchHindi || matchMeaning;
    }

    return true;
  });

  // Calculate category count under current origin filter
  const getCategoryCount = (cat: string) => {
    return savedWords.filter(item => {
      if (filterOrigin === 'saved_by_me' && !isItemSavedByMe(item)) return false;
      if (filterOrigin === 'mistakes' && !isItemMistake(item)) return false;
      if (cat === 'all') return true;
      return item.question.category === cat;
    }).length;
  };

  const currentCard = filteredWords[currentFlashcardIndex];

  return (
    <div className="flex-1 p-4 space-y-3.5 overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-rose-400" />
            Mistake Vault & Revision
          </h2>
          <p className="text-xs text-slate-400">
            {savedWords.length} Saved PYQs for Spaced Repetition & Weak-Spot Mastery
          </p>
        </div>

        {/* View Toggle (List vs Flashcards) */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs shadow-sm">
          <button
            onClick={() => {
              soundManager.playTap();
              setActiveView('list');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeView === 'list' ? 'bg-slate-700 text-amber-300 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            List
          </button>
          <button
            onClick={() => {
              soundManager.playTap();
              setActiveView('flashcards');
              setIsFlipped(false);
              setCurrentFlashcardIndex(0);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeView === 'flashcards' ? 'bg-slate-700 text-amber-300 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Primary Origin Segmented Filter (All vs Saved vs Mistakes) */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800/90">
        <button
          onClick={() => {
            soundManager.playTap();
            setFilterOrigin('all');
            setCurrentFlashcardIndex(0);
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            filterOrigin === 'all'
              ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>All</span>
          <span className="text-[10px] bg-slate-950/70 text-slate-300 px-1.5 py-0.5 rounded-md font-mono leading-none">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => {
            soundManager.playTap();
            setFilterOrigin('saved_by_me');
            setCurrentFlashcardIndex(0);
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            filterOrigin === 'saved_by_me'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-600/70 shadow-sm'
              : 'text-slate-400 hover:text-amber-300/90'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
          <span>Saved</span>
          <span className="text-[10px] bg-slate-950/70 text-amber-300 px-1.5 py-0.5 rounded-md font-mono leading-none">
            {userSavedCount}
          </span>
        </button>

        <button
          onClick={() => {
            soundManager.playTap();
            setFilterOrigin('mistakes');
            setCurrentFlashcardIndex(0);
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            filterOrigin === 'mistakes'
              ? 'bg-rose-950/80 text-rose-300 border border-rose-600/70 shadow-sm'
              : 'text-slate-400 hover:text-rose-300/90'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Mistakes</span>
          <span className="text-[10px] bg-slate-950/70 text-rose-300 px-1.5 py-0.5 rounded-md font-mono leading-none">
            {mistakesCount}
          </span>
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              filterOrigin === 'saved_by_me'
                ? "Search your saved words, meanings, or Hindi..."
                : "Search saved words, meanings, or Hindi..."
            }
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentFlashcardIndex(0);
            }}
            className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Topic / Category Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'synonyms', label: 'Synonyms' },
            { id: 'antonyms', label: 'Antonyms' },
            { id: 'ows', label: 'One Word' },
            { id: 'idioms', label: 'Idioms' },
          ].map(cat => {
            const count = getCategoryCount(cat.id);
            const isSelected = filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundManager.playTap();
                  setFilterCategory(cat.id);
                  setCurrentFlashcardIndex(0);
                }}
                className={`px-2.5 py-1 rounded-lg border whitespace-nowrap text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? filterOrigin === 'saved_by_me'
                      ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 shadow-sm'
                      : 'bg-slate-750 border-slate-600 text-slate-100 shadow-sm'
                    : 'bg-slate-850/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isSelected ? 'bg-slate-900/90 text-white font-bold' : 'bg-slate-900/60 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FLASHCARD VIEW */}
      {activeView === 'flashcards' && currentCard ? (
        <div className="space-y-4 pt-2">
          {/* Card Counter & Badges */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Card {currentFlashcardIndex + 1} of {filteredWords.length}</span>
            <div className="flex items-center gap-1.5">
              {isItemSavedByMe(currentCard) && (
                <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-700/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                  Saved by Me
                </span>
              )}
              {isItemMistake(currentCard) && (
                <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full font-bold">
                  {currentCard.mistakeCount}x Mistake
                </span>
              )}
              <span className="text-sky-400 uppercase font-mono text-[10px] bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800">
                {currentCard.question.category}
              </span>
            </div>
          </div>

          {/* Flip Container */}
          <div
            onClick={() => {
              soundManager.playTap();
              setIsFlipped(!isFlipped);
            }}
            className="w-full min-h-[260px] bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col justify-between items-center text-center cursor-pointer hover:border-amber-500/60 transition-all relative overflow-hidden"
          >
            {!isFlipped ? (
              /* Front of Card */
              <div className="my-auto space-y-3">
                <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-700/60 px-2.5 py-0.5 rounded-full font-bold">
                  TAP TO FLIP
                </span>
                <h3 className="text-2xl font-black text-amber-400 break-words">
                  {currentCard.question.wordOrPhrase}
                </h3>
                <div className="text-xs text-slate-400">
                  {currentCard.question.instruction || 'What is the meaning and correct answer?'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Repeated {currentCard.question.repeatCount}x in SSC / Railway
                </div>
              </div>
            ) : (
              /* Back of Card */
              <div className="my-auto space-y-2.5 animate-fadeIn">
                <div className="text-sm font-extrabold text-emerald-400">
                  Correct: {currentCard.question.options[currentCard.question.correctIndex]}
                </div>
                {/* Meaning & Hindi Meaning for Synonyms / Antonyms / Vocab */}
                {currentCard.question.category !== 'idioms' && currentCard.question.category !== 'one-word' && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl text-left border border-slate-800 space-y-1">
                    <div className="text-xs text-slate-100 font-medium">
                      <span className="font-bold text-sky-400">Meaning: </span>
                      {currentCard.question.meaning}
                    </div>
                    <div className="text-xs text-amber-300 font-medium">
                      <span className="font-bold text-amber-400">हिन्दी अर्थ: </span>
                      {currentCard.question.hindiMeaning}
                    </div>
                  </div>
                )}
                <div className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl text-left border border-slate-800/80">
                  <span className="font-bold text-sky-400">💡 Memory Hack: </span>
                  {currentCard.question.mnemonic}
                </div>
                <div className="text-[11px] text-slate-400 italic">
                  "{currentCard.question.exampleSentence}"
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              <span>Tap anywhere to toggle answer & mnemonic</span>
            </div>
          </div>

          {/* Flashcard Navigation */}
          <div className="flex items-center justify-between gap-2.5">
            <button
              disabled={currentFlashcardIndex === 0}
              onClick={() => {
                soundManager.playTap();
                setIsFlipped(false);
                setCurrentFlashcardIndex(prev => Math.max(0, prev - 1));
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2.5 rounded-xl text-xs font-bold border border-slate-700 text-slate-200"
            >
              Previous
            </button>

            {onToggleUserSaved && (
              <button
                onClick={() => {
                  onToggleUserSaved(currentCard.question.id);
                }}
                className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                  isItemSavedByMe(currentCard)
                    ? 'bg-amber-950/90 border-amber-600 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                }`}
                title="Toggle Saved by Me"
              >
                <Star className={`w-3.5 h-3.5 ${isItemSavedByMe(currentCard) ? 'fill-amber-400' : ''}`} />
                <span>{isItemSavedByMe(currentCard) ? 'Saved' : 'Save'}</span>
              </button>
            )}

            <button
              onClick={() => {
                soundManager.playTap();
                onOpenAiTutor(currentCard.question);
              }}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-300 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Coach
            </button>

            <button
              disabled={currentFlashcardIndex >= filteredWords.length - 1}
              onClick={() => {
                soundManager.playTap();
                setIsFlipped(false);
                setCurrentFlashcardIndex(prev => Math.min(filteredWords.length - 1, prev + 1));
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl text-xs font-black shadow-md"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-2.5">
          {filteredWords.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center space-y-2.5">
              <BookmarkCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="font-bold text-xs text-slate-300">
                {filterOrigin === 'saved_by_me'
                  ? 'No Items Saved by You Yet'
                  : filterOrigin === 'mistakes'
                  ? 'No Match Mistakes Recorded'
                  : 'No Saved Words Found'}
              </div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {filterOrigin === 'saved_by_me'
                  ? 'Tap the ⭐️ Save button on any question during Practice or 1v1 Duels to store your personal revision items here.'
                  : filterOrigin === 'mistakes'
                  ? 'When you get questions wrong in 1v1 Arena duels, they will automatically be logged here for spaced repetition.'
                  : 'Bookmark challenging questions after any 1v1 battle or practice round to review them here.'}
              </p>
            </div>
          ) : (
            filteredWords.map(item => {
              const userSaved = isItemSavedByMe(item);
              const mistake = isItemMistake(item);

              return (
                <div
                  key={item.question.id}
                  className="bg-slate-850 border border-slate-750/90 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-100">
                          {item.question.wordOrPhrase}
                        </span>
                        <span className="text-[9px] bg-slate-750 text-slate-300 px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                          {item.question.category === 'ows' ? 'ONE WORD' : item.question.category}
                        </span>
                        {userSaved && (
                          <span className="text-[9px] bg-amber-950/90 text-amber-300 border border-amber-700/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                            Saved by Me
                          </span>
                        )}
                        {mistake && (
                          <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full font-bold">
                            {item.mistakeCount}x Mistake
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-amber-300/90 mt-1 font-medium">
                        {item.question.hindiMeaning}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Star / Bookmark Toggle Button */}
                      {onToggleUserSaved && (
                        <button
                          onClick={() => onToggleUserSaved(item.question.id)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            userSaved
                              ? 'bg-amber-950/90 border-amber-600 text-amber-400 shadow-sm'
                              : 'bg-slate-900 text-slate-500 hover:text-amber-400 border-slate-800'
                          }`}
                          title={userSaved ? "Remove from 'Saved by Me'" : "Mark as 'Saved by Me'"}
                        >
                          <Star className={`w-3.5 h-3.5 ${userSaved ? 'fill-amber-400' : ''}`} />
                        </button>
                      )}

                      {/* AI Tutor Deep Dive */}
                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onOpenAiTutor(item.question);
                        }}
                        className="p-1.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-800 hover:bg-purple-900"
                        title="AI Root Word Deep Dive"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete from Vault */}
                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onRemoveWord(item.question.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-800"
                        title="Remove completely from Vault"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Meaning for Vocab */}
                  {item.question.category !== 'idioms' && item.question.category !== 'one-word' && item.question.meaning && (
                    <div className="text-xs text-slate-300 bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                      <span className="font-bold text-sky-400">Meaning: </span>
                      {item.question.meaning}
                    </div>
                  )}

                  {/* Correct Option */}
                  <div className="text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
                    Correct: {item.question.options[item.question.correctIndex]}
                  </div>

                  {/* Mnemonic Hook */}
                  <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="font-bold text-amber-400">💡 Trick: </span>
                    {item.question.mnemonic}
                  </div>

                  {/* Exam Attribution */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>Asked in: {item.question.examHistory.slice(0, 2).join(', ')}</span>
                    <span className="text-amber-400 font-bold">Repeated {item.question.repeatCount}x</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
