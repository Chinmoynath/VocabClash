import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { SavedWord, Question } from '../types';
import { soundManager } from '../utils/audio';
import { isItemSaved, isItemMistake } from '../utils/vaultManager';
import { 
  BookOpen, 
  Trash2, 
  RotateCw, 
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
  Brain,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { ReportQuestionModal } from './ReportQuestionModal';
import { formatExamTag } from '../services/jsonPyqParser';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';
import { resolveCardEducation } from '../utils/questionEducationResolver';
import { QuestionSolutionBreakdown } from './QuestionSolutionBreakdown';
import { MistakeVaultRevisionCard } from './MistakeVaultRevisionCard';
import { resolveRevisionCard } from '../utils/mistakeVaultCardResolver';

const PAGE_SIZE = 20;

interface MistakeVaultProps {
  savedWords: SavedWord[];
  userId?: string;
  onRemoveWord: (questionId: string, scope?: 'all' | 'saved_by_me' | 'mistakes') => void;
  onToggleUserSaved?: (questionId: string, question?: Question) => void;
  onOpenAiTutor?: (question: Question) => void;
  onGoToArena?: () => void;
  onGoToPractice?: () => void;
}

export const MistakeVault: React.FC<MistakeVaultProps> = ({
  savedWords,
  userId,
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [swipeDirection, setSwipeDirection] = useState<number>(1);
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Debounce search query by 250ms to prevent expensive re-filters during rapid keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination window whenever user switches filters, search terms, or account identity
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setCurrentFlashcardIndex(0);
    setLoadError(null);
  }, [filterOrigin, filterCategory, debouncedSearchQuery, userId]);

  // Independent total counts for top tabs (always reflecting full dataset)
  const totalCount = savedWords.length;
  const userSavedCount = savedWords.filter(isItemSaved).length;
  const mistakesCount = savedWords.filter(isItemMistake).length;

  // Filtered dataset: strictly respects active tab filter, category filter, and search query
  const filteredWords = useMemo(() => {
    return savedWords.filter(item => {
      if (!item || !item.question) return false;

      // 1. Origin Filter: Saved vs Mistakes vs All
      if (filterOrigin === 'saved_by_me' && !isItemSaved(item)) return false;
      if (filterOrigin === 'mistakes' && !isItemMistake(item)) return false;

      // 2. Category Filter
      if (filterCategory !== 'all' && item.question.category !== filterCategory) return false;

      // 3. Search query: strictly filtered within the currently selected collection
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchWord = item.question.wordOrPhrase?.toLowerCase().includes(q) || false;
        const matchHindi = item.question.hindiMeaning?.toLowerCase().includes(q) || false;
        const matchMeaning = item.question.meaning?.toLowerCase().includes(q) || false;
        return matchWord || matchHindi || matchMeaning;
      }

      return true;
    });
  }, [savedWords, filterOrigin, filterCategory, debouncedSearchQuery]);

  // Deduplicate and window items for fast, incremental list rendering
  const paginatedWords = useMemo(() => {
    const seenIds = new Set<string>();
    const uniqueItems: SavedWord[] = [];
    for (const item of filteredWords) {
      if (item?.question?.id && !seenIds.has(item.question.id)) {
        seenIds.add(item.question.id);
        uniqueItems.push(item);
      }
    }
    return uniqueItems.slice(0, visibleLimit);
  }, [filteredWords, visibleLimit]);

  const hasMore = visibleLimit < filteredWords.length;

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setLoadError(null);

    // Controlled micro-tick to ensure responsive UI and smooth card rendering
    setTimeout(() => {
      try {
        setVisibleLimit(prev => Math.min(filteredWords.length, prev + PAGE_SIZE));
        setIsLoadingMore(false);
      } catch (err) {
        console.error('[Mistake Vault Pagination Error]', err);
        setLoadError('Failed to load next records. Please try again.');
        setIsLoadingMore(false);
      }
    }, 120);
  };

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

  const handleNextCard = () => {
    if (currentFlashcardIndex < filteredWords.length - 1) {
      soundManager.playTap();
      setSwipeDirection(1);
      setIsFlipped(false);
      setCurrentFlashcardIndex(prev => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentFlashcardIndex > 0) {
      soundManager.playTap();
      setSwipeDirection(-1);
      setIsFlipped(false);
      setCurrentFlashcardIndex(prev => prev - 1);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 45;
    const velocityThreshold = 250;

    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      if (currentFlashcardIndex < filteredWords.length - 1) {
        handleNextCard();
      }
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      if (currentFlashcardIndex > 0) {
        handlePrevCard();
      }
    }

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 80);
  };

  // Keyboard navigation for flashcards
  useEffect(() => {
    if (activeView !== 'flashcards') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        soundManager.playTap();
        setIsFlipped(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, currentFlashcardIndex, filteredWords.length]);

  const cardVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 360, damping: 28 },
        opacity: { duration: 0.18 },
        scale: { duration: 0.18 },
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.16,
      },
    }),
  };

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
        <div className="max-w-xl mx-auto space-y-3 pt-1 w-full flex-1 min-h-0 flex flex-col justify-between">
          {/* Card Counter & Badges & Progress */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">Card {currentFlashcardIndex + 1} of {filteredWords.length}</span>
                <span className="text-[10px] text-slate-500 font-mono">({Math.round(((currentFlashcardIndex + 1) / filteredWords.length) * 100)}%)</span>
              </div>
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

            {/* Deck Progress Bar */}
            <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${((currentFlashcardIndex + 1) / filteredWords.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Swipeable Flip Card Container */}
          <div className="relative w-full flex-1 min-h-[290px] flex items-center justify-center overflow-hidden py-1">
            {/* Desktop Side Quick Nav Arrows */}
            {currentFlashcardIndex > 0 && (
              <button
                onClick={handlePrevCard}
                className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white items-center justify-center transition-all shadow-lg hover:scale-105"
                title="Previous card (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {currentFlashcardIndex < filteredWords.length - 1 && (
              <button
                onClick={handleNextCard}
                className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white items-center justify-center transition-all shadow-lg hover:scale-105"
                title="Next card (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence mode="wait" custom={swipeDirection}>
              <motion.div
                key={currentCard.question.id || `card-${currentFlashcardIndex}`}
                custom={swipeDirection}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.65}
                onDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onDragEnd={handleDragEnd}
                onTap={() => {
                  if (isDraggingRef.current) return;
                  soundManager.playTap();
                  setIsFlipped(!isFlipped);
                }}
                className="w-full h-full min-h-[280px] bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col justify-between items-center text-center cursor-grab active:cursor-grabbing hover:border-amber-500/60 transition-colors relative overflow-hidden select-none touch-pan-y"
              >
                {(() => {
                  const card = resolveRevisionCard(currentCard.question, currentCard);
                  return !isFlipped ? (
                    /* Front of Card */
                    <div className="my-auto space-y-3 pointer-events-none w-full max-w-md">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] bg-slate-900 text-sky-300 border border-slate-750 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {card.categoryDisplay}
                        </span>
                        {card.targetSublabel && (
                          <span className="text-[10px] bg-slate-900/80 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-semibold">
                            {card.targetSublabel}
                          </span>
                        )}
                        <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-700/60 px-2.5 py-0.5 rounded-full font-bold">
                          TAP TO FLIP
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-amber-400 break-words leading-tight">
                        {card.target}
                      </h3>
                      <div className="text-xs text-slate-300 font-medium">
                        {card.prompt}
                      </div>
                      <div className="pt-1 flex items-center justify-center">
                        <ExamAppearancesBadge
                          appearances={currentCard.question.appearances}
                          exam={currentCard.question.exam}
                          year={currentCard.question.year}
                          tier={currentCard.question.tier}
                          examHistory={currentCard.question.examHistory}
                          repeatCount={currentCard.question.repeatCount}
                          showRepeatCount={true}
                          size="xs"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Back of Card */
                    <div className="my-auto space-y-2.5 animate-fadeIn w-full text-left">
                      {/* Target Section */}
                      {(card.targetMeaning || card.targetHindiMeaning) && (
                        <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 space-y-0.5">
                          {card.isSituationBased && (
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                              Situation:
                            </div>
                          )}
                          {card.targetMeaning && (
                            <div className="text-xs text-slate-300 leading-relaxed">
                              {card.targetMeaning}
                            </div>
                          )}
                          {card.targetHindiMeaning && (
                            <div className="text-xs text-amber-300/90 font-medium">
                              {card.targetHindiMeaning}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Answer & Relationship */}
                      <div className="bg-slate-900/80 rounded-xl p-2.5 border border-emerald-900/40 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400">
                          {card.relation}
                        </div>
                        <div className="text-sm font-black text-emerald-300 tracking-wide uppercase flex items-center gap-1.5">
                          <span>{card.answer}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                        {card.answerMeaning && (
                          <div className="text-xs text-slate-200 leading-relaxed">
                            {card.answerMeaning}
                          </div>
                        )}
                        {card.answerHindiMeaning && (
                          <div className="text-xs text-amber-300/90 font-medium">
                            {card.answerHindiMeaning}
                          </div>
                        )}
                      </div>

                      {/* Memory Hook */}
                      {card.mnemonic && (
                        <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-xs">
                          <div className="font-bold text-amber-400 flex items-center gap-1">
                            <span>💡 Memory Hook</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed mt-0.5 text-[11px]">
                            {card.mnemonic}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-3 pt-2">
                  <span className="flex items-center gap-1 text-slate-400">
                    <RotateCw className="w-3 h-3 text-amber-400/80" />
                    Tap to flip
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <ChevronsLeft className="w-3 h-3 text-sky-400/80" />
                    Swipe left/right to navigate
                    <ChevronsRight className="w-3 h-3 text-sky-400/80" />
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Flashcard Navigation */}
          <div className="flex items-center justify-between gap-2 sm:gap-2.5 shrink-0">
            <button
              disabled={currentFlashcardIndex === 0}
              onClick={handlePrevCard}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 p-2.5 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
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
              disabled={currentFlashcardIndex >= filteredWords.length - 1}
              onClick={handleNextCard}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
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
                    : 'Track your bookmarked questions and battle mistakes. Review them with flashcards, mnemonics, and detailed explanations.'}
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {paginatedWords.map((item) => (
                  <MistakeVaultRevisionCard
                    key={item.question.id}
                    item={item}
                    onToggleBookmark={(id) => {
                      soundManager.playTap();
                      if (onToggleUserSaved) {
                        onToggleUserSaved(id, item.question);
                      }
                    }}
                    onDelete={(id) => {
                      soundManager.playTap();
                      onRemoveWord(id, filterOrigin);
                    }}
                    onReport={(q) => {
                      soundManager.playTap();
                      setReportingQuestion(q);
                    }}
                  />
                ))}
              </div>

              {/* Incremental Load More Trigger */}
              {hasMore && (
                <div className="pt-2 pb-2 flex flex-col items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      handleLoadMore();
                    }}
                    disabled={isLoadingMore}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-bold shadow-md active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Loading next batch...</span>
                      </>
                    ) : (
                      <>
                        <span>Load more</span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                          {paginatedWords.length} of {filteredWords.length}
                        </span>
                      </>
                    )}
                  </button>

                  {loadError && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 px-3 py-1.5 rounded-lg">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{loadError}</span>
                      <button
                        onClick={handleLoadMore}
                        className="underline font-bold hover:text-rose-300 ml-1 cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}
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
