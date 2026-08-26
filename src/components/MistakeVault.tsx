import React, { useState } from 'react';
import { SavedWord, Question } from '../types';
import { soundManager } from '../utils/audio';
import { isItemSaved, isItemMistake } from '../utils/vaultManager';
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
  AlertCircle,
  Flag,
  Swords,
  Target,
  ArrowRight,
  Brain
} from 'lucide-react';
import { ReportQuestionModal } from './ReportQuestionModal';

interface MistakeVaultProps {
  savedWords: SavedWord[];
  onRemoveWord: (questionId: string, scope?: 'all' | 'saved_by_me' | 'mistakes') => void;
  onToggleUserSaved?: (questionId: string, question?: Question) => void;
  onOpenAiTutor: (question: Question) => void;
  onGoToArena?: () => void;
  onGoToPractice?: () => void;
}

export const MistakeVault: React.FC<MistakeVaultProps> = ({
  savedWords,
  onRemoveWord,
  onToggleUserSaved,
  onOpenAiTutor,
  onGoToArena,
  onGoToPractice,
}) => {
  const [activeView, setActiveView] = useState<'list' | 'flashcards'>('list');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'saved_by_me' | 'mistakes'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);

  // Independent counts for top tabs
  const totalCount = savedWords.length;
  const userSavedCount = savedWords.filter(isItemSaved).length;
  const mistakesCount = savedWords.filter(isItemMistake).length;

  // Filtered dataset: strictly respects active tab filter, category filter, and search query
  const filteredWords = savedWords.filter(item => {
    // 1. Origin Filter: Saved vs Mistakes vs All
    if (filterOrigin === 'saved_by_me' && !isItemSaved(item)) return false;
    if (filterOrigin === 'mistakes' && !isItemMistake(item)) return false;

    // 2. Category Filter
    if (filterCategory !== 'all' && item.question.category !== filterCategory) return false;

    // 3. Search query: strictly filtered within the currently selected collection
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
      if (filterOrigin === 'saved_by_me' && !isItemSaved(item)) return false;
      if (filterOrigin === 'mistakes' && !isItemMistake(item)) return false;
      if (cat === 'all') return true;
      return item.question.category === cat;
    }).length;
  };

  const currentCard = filteredWords[currentFlashcardIndex];

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-5 lg:p-6 space-y-3 sm:space-y-4 pb-3 sm:pb-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-100 flex items-center gap-2 truncate">
            <BookOpen className="w-5 h-5 text-rose-400 shrink-0" />
            <span>Mistake Vault & Revision</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">
            {savedWords.length} Total PYQs • {userSavedCount} Saved • {mistakesCount} Mistakes
          </p>
        </div>

        {/* View Toggle (List vs Flashcards) */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs shadow-sm shrink-0">
          <button
            onClick={() => {
              soundManager.playTap();
              setActiveView('list');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all text-xs ${
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
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all text-xs ${
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
      <div className="space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              filterOrigin === 'saved_by_me'
                ? "Search within your Saved words..."
                : filterOrigin === 'mistakes'
                ? "Search within your Mistakes..."
                : "Search all vault words, meanings, or Hindi..."
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
        <div className="max-w-xl mx-auto space-y-4 pt-1 w-full flex-1 min-h-0 flex flex-col justify-between">
          {/* Card Counter & Badges */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium shrink-0">
            <span>Card {currentFlashcardIndex + 1} of {filteredWords.length}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isItemSaved(currentCard) && (
                <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-700/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                  Saved
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
            className="w-full flex-1 min-h-[260px] bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col justify-between items-center text-center cursor-pointer hover:border-amber-500/60 transition-all relative overflow-hidden"
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
              <div className="my-auto space-y-2.5 animate-fadeIn w-full">
                <div className="text-sm font-extrabold text-emerald-400">
                  Correct: {currentCard.question.options[currentCard.question.correctIndex]}
                </div>
                {/* Meaning & Hindi Meaning for Synonyms / Antonyms / Vocab */}
                {currentCard.question.category !== 'idioms' && currentCard.question.category !== 'ows' && (
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
          <div className="flex items-center justify-between gap-2 sm:gap-2.5 shrink-0">
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
                  onToggleUserSaved(currentCard.question.id, currentCard.question);
                }}
                className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                  isItemSaved(currentCard)
                    ? 'bg-amber-950/90 border-amber-600 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                }`}
                title={isItemSaved(currentCard) ? "Remove from Saved" : "Save question"}
              >
                <Star className={`w-3.5 h-3.5 ${isItemSaved(currentCard) ? 'fill-amber-400' : ''}`} />
                <span>{isItemSaved(currentCard) ? 'Saved' : 'Save'}</span>
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
        <div className="flex-1 min-h-0 flex flex-col space-y-3">
          {filteredWords.length === 0 ? (
            <div className="flex-1 min-h-[300px] sm:min-h-[360px] bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-slate-800/80 rounded-3xl p-5 sm:p-8 text-center space-y-4 flex flex-col items-center justify-center shadow-xl my-1">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center mx-auto shadow-xl ring-4 ring-slate-800/30">
                  {filterOrigin === 'saved_by_me' ? (
                    <BookmarkCheck className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
                  ) : filterOrigin === 'mistakes' ? (
                    <Flame className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400" />
                  ) : (
                    <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-sky-400" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 border-2 border-slate-950 shadow-md">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <div className="font-black text-base sm:text-lg text-slate-100 tracking-tight">
                  {filterOrigin === 'saved_by_me'
                    ? searchQuery ? 'No Saved items match your search' : 'No Items Saved Yet'
                    : filterOrigin === 'mistakes'
                    ? searchQuery ? 'No Mistakes match your search' : 'Mistake Log is Clear!'
                    : searchQuery ? 'No PYQ items matched your filter' : 'Your Revision Vault is Ready'}
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                  {filterOrigin === 'saved_by_me'
                    ? 'Tap the ⭐ Star icon during any 1v1 battle or practice session to bookmark difficult words for instant revision.'
                    : filterOrigin === 'mistakes'
                    ? 'Questions answered incorrectly during live battles automatically sync here for smart spaced repetition drills.'
                    : 'Track your bookmarked questions and battle mistakes. Review them with flashcards, mnemonics, and AI explanations.'}
                </p>
              </div>

              {/* Action Jump Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-xs sm:max-w-md">
                {onGoToArena && (
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onGoToArena();
                    }}
                    className="w-full sm:w-auto flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    <Swords className="w-4 h-4 shrink-0" />
                    <span>Play 1v1 Duel</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}

                {onGoToPractice && (
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onGoToPractice();
                    }}
                    className="w-full sm:w-auto flex-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                  >
                    <Target className="w-4 h-4 shrink-0 text-sky-400" />
                    <span>Practice PYQs</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>

              {/* Smart Spaced Repetition Indicator */}
              <div className="inline-flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3.5 py-1.5 rounded-full font-medium shadow-inner mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Active Spaced Repetition Enabled • 24,000+ Exam Pool</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {filteredWords.map(item => {
              const userSaved = isItemSaved(item);
              const mistake = isItemMistake(item);

              return (
                <div
                  key={item.question.id}
                  className="bg-slate-850 border border-slate-750/90 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-slate-100 break-words">
                          {item.question.wordOrPhrase}
                        </span>
                        <span className="text-[9px] bg-slate-750 text-slate-300 px-2 py-0.5 rounded-full uppercase font-mono font-bold shrink-0">
                          {item.question.category === 'ows' ? 'ONE WORD' : item.question.category}
                        </span>
                        {userSaved && (
                          <span className="text-[9px] bg-amber-950/90 text-amber-300 border border-amber-700/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                            Saved
                          </span>
                        )}
                        {mistake && (
                          <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                            {item.mistakeCount}x Mistake
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-amber-300/90 mt-1 font-medium break-words">
                        {item.question.hindiMeaning}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Star / Bookmark Toggle Button: modifies ONLY Saved state */}
                      {onToggleUserSaved && (
                        <button
                          onClick={() => onToggleUserSaved(item.question.id, item.question)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            userSaved
                              ? 'bg-amber-950/90 border-amber-600 text-amber-400 shadow-sm'
                              : 'bg-slate-900 text-slate-500 hover:text-amber-400 border-slate-800'
                          }`}
                          title={userSaved ? "Remove from Saved" : "Save question"}
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

                      {/* Report Question Button */}
                      <button
                        onClick={() => {
                          soundManager.playTap();
                          setReportingQuestion(item.question);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-800"
                        title="Report issue in question (support@vocabclash.in)"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete from Vault / Current Scope */}
                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onRemoveWord(item.question.id, filterOrigin);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-800"
                        title={
                          filterOrigin === 'mistakes'
                            ? "Remove from Mistakes (keeps Saved if bookmarked)"
                            : filterOrigin === 'saved_by_me'
                            ? "Remove from Saved (keeps Mistake record if present)"
                            : "Remove completely from Vault"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Meaning for Vocab */}
                  {item.question.category !== 'idioms' && item.question.category !== 'ows' && item.question.meaning && (
                    <div className="text-xs text-slate-300 bg-slate-900/70 p-2 rounded-xl border border-slate-800 break-words">
                      <span className="font-bold text-sky-400">Meaning: </span>
                      {item.question.meaning}
                    </div>
                  )}

                  {/* Correct Option */}
                  <div className="text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/50 px-2.5 py-1 rounded-lg break-words">
                    Correct: {item.question.options[item.question.correctIndex]}
                  </div>

                  {/* Mnemonic Hook */}
                  <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800 break-words">
                    <span className="font-bold text-amber-400">💡 Trick: </span>
                    {item.question.mnemonic}
                  </div>

                  {/* Exam Attribution */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5 gap-2">
                    <span className="truncate">Asked in: {item.question.examHistory.slice(0, 2).join(', ')}</span>
                    <span className="text-amber-400 font-bold shrink-0">Repeated {item.question.repeatCount}x</span>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Report Question Modal */}
      {reportingQuestion && (
        <ReportQuestionModal
          question={reportingQuestion}
          onClose={() => setReportingQuestion(null)}
        />
      )}
    </div>
  );
};
