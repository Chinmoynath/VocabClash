import React, { useState, useMemo } from 'react';
import { RepeatedMistakeItem, QuestionCategory, SavedWord } from '../types';
import { soundManager } from '../utils/audio';
import { getStoredWordDetail, StoredWordDetail } from '../services/storedWordService';
import { OWS_MASTER_EXTENDED } from '../data/owsMasterData';
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

// Check if string is a generic code key or question placeholder
function isPlaceholderConcept(str?: string): boolean {
  if (!str) return true;
  const s = str.toLowerCase().trim();
  if (['concept', 'uncategorized', 'question', 'questions', 'unknown', 'null', 'undefined', 'synonym', 'antonym', 'synonyms', 'antonyms', 'ows', 'idiom', 'idioms'].includes(s)) return true;
  if (/^(?:synonyms?|antonyms?|ows|idioms?)[_-\s]+(?:question|historical|attempt|summary)s?(?:_\d+)?$/i.test(s)) return true;
  if (/^(?:synonyms?|antonyms?|ows|idioms?)$/i.test(s)) return true;
  if (/^(?:synonym|antonym|ows|idiom)\s+questions?$/i.test(s)) return true;
  if (/^historical[_-\s]+(?:attempt|summary|question)?(?:_\d+)?$/i.test(s)) return true;
  if (/^(?:select|choose|find|what is|give|identify)\b/i.test(s)) return true;
  if (s.includes('question') && (s.includes('synonym') || s.includes('antonym') || s.includes('ows') || s.includes('idiom'))) return true;
  if (/^q(?:uestion)?_?(?:\d+|temp|id)$/i.test(s)) return true;
  if (s.length < 2) return true;
  return false;
}

// Clean and extract pure Hindi text, stripping nested prefixes, colons, and English repetitions
function formatCardHindi(rawHindi?: string): string {
  if (!rawHindi) return '';
  let str = rawHindi.trim();

  // If multiple parts separated by bullets or newlines, pick the richest Devanagari part
  const parts = str.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+)/);
  if (parts.length > 1) {
    let best = parts[0];
    let maxCount = (best.match(/[\u0900-\u097F]/g) || []).length;
    for (let i = 1; i < parts.length; i++) {
      const c = (parts[i].match(/[\u0900-\u097F]/g) || []).length;
      if (c > maxCount) {
        maxCount = c;
        best = parts[i];
      }
    }
    str = best.trim();
  }

  // Strip repetitive prefixes like "Something: ", "(Category):", etc.
  let prev = '';
  while (str !== prev) {
    prev = str;
    str = str.replace(/^[A-Za-z0-9\s\-',/()]+:\s*/, '').trim();
    str = str.replace(/^\([^)]*\)\s*:?\s*/, '').trim();
    str = str.replace(/^(?:सटीक उत्तर|एक शब्द|समानार्थी|विलोमार्थी|भावार्थ|अर्थ|हिन्दी|Target Word)\s*:\s*/i, '').trim();
  }

  // If Devanagari text exists, find the start of the first Devanagari character
  const devIdx = str.search(/[\u0900-\u097F]/);
  if (devIdx > 0) {
    const before = str.slice(0, devIdx).trim();
    if (!before.includes('/') && before.length < 50) {
      str = str.slice(devIdx).trim();
    }
  }

  // Remove trailing punctuation / danda
  str = str.replace(/[\s|।]+$/, '').trim();
  return str;
}

// Clean English meaning, stripping duplicate self-prefixes and bullet chains
function formatCardMeaning(rawMeaning?: string, title?: string): string {
  if (!rawMeaning) return '';
  let str = rawMeaning.trim();

  const parts = str.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+)/);
  if (parts.length > 1) {
    str = parts[0].trim();
  }

  if (title) {
    const titleRegex = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\([^)]*\\))?\\s*[-–:]\\s*`, 'i');
    str = str.replace(titleRegex, '').trim();
  }

  str = str.replace(/^(?:Target Word|Meaning|One Word|Synonym|Antonym)\s*[-–:]\s*/i, '').trim();
  str = str.replace(/^[A-Za-z0-9\s\-]+\s*[-–]\s*/, '').trim();

  return str;
}

// Resolve title and optional prompt for OWS/Idioms/Synonyms/Antonyms
function formatCardTitleAndPrompt(item: RepeatedMistakeItem): { title: string; prompt?: string } {
  const isOws = item.category === 'ows' || (item.category as string) === 'one_word';
  let raw = (item.wordOrPhrase || '').trim();

  // If raw has an instruction pattern, isolate the target word
  const instructionMatch = raw.match(/(?:synonym|antonym|meaning)\s+(?:of|for)\s+(?:the\s+(?:given\s+)?word\s+)?["'“]?([A-Za-z\-]{2,35})["'”]?/i);
  if (instructionMatch && instructionMatch[1]) {
    return { title: instructionMatch[1].toUpperCase() };
  }

  // Strip standard instruction prefixes
  raw = raw.replace(/^(?:select|choose|give|find|what is|in the following question,? select|in the following question)\s+(?:the\s+)?(?:one\s+word|most\s+appropriate|synonym|antonym|meaning)[^:]*:\s*/i, '').trim();

  // If raw contains ":", take the portion after ":" if it looks like a word
  if (raw.includes(':') && raw.split(':').length === 2) {
    const afterColon = raw.split(':')[1].trim().replace(/^["'“]+|["'”]+$/g, '');
    if (afterColon.length >= 2 && afterColon.length <= 35 && !/[.?!]/.test(afterColon)) {
      return { title: afterColon.toUpperCase() };
    }
  }

  // If quoted word exists: "ACCRUE" -> ACCRUE
  const quoteMatch = raw.match(/["'“]([A-Za-z\-]{2,35})["'”]/);
  if (quoteMatch) {
    return { title: quoteMatch[1].toUpperCase() };
  }

  if (isOws) {
    // If raw is a phrase (more than 2 words, e.g. "One who knows everything")
    if (raw.split(/\s+/).length > 2) {
      const owsMatch = OWS_MASTER_EXTENDED.find(
        o => o.phrase.toLowerCase() === raw.toLowerCase() ||
             raw.toLowerCase().includes(o.phrase.toLowerCase().slice(0, 20)) ||
             o.phrase.toLowerCase().includes(raw.toLowerCase().slice(0, 20))
      );
      if (owsMatch) {
        return {
          title: owsMatch.answer,
          prompt: raw,
        };
      }
    }
  }

  return { title: raw };
}

// Category visual styling badges
function getCategoryBadge(cat: string): { label: string; bg: string; text: string; border: string } {
  const c = (cat || '').toLowerCase();
  if (c === 'synonyms' || c === 'synonym') {
    return { label: 'SYNONYM', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  }
  if (c === 'antonyms' || c === 'antonym') {
    return { label: 'ANTONYM', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
  }
  if (c === 'ows' || c === 'one_word') {
    return { label: 'ONE WORD', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
  }
  if (c === 'idioms' || c === 'idiom') {
    return { label: 'IDIOM', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
  }
  return { label: (cat || 'VOCAB').toUpperCase(), bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
}

export const RepeatedMistakesRow: React.FC<RepeatedMistakesRowProps> = ({
  items = [],
  fallbackSavedWords = [],
  title = "Words You're Repeatedly Missing",
  subtitle = "Words missed 3+ times. Tap any word to view stored mnemonics, Hindi, and exam tricks."
}) => {
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Stored word detail modal state
  const [selectedWordDetail, setSelectedWordDetail] = useState<StoredWordDetail | null>(null);
  const [copiedTrick, setCopiedTrick] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Combine items with genuine mistake words (strict >= 3 wrongCount requirement)
  const allMissingWords: RepeatedMistakeItem[] = useMemo(() => {
    const map = new Map<string, RepeatedMistakeItem>();
    
    // 1. Add known repeated mistakes (only >= 3 wrongCount and strictly valid vocabulary)
    for (const it of items) {
      if (!it.wordOrPhrase) continue;
      const count = it.wrongCount || 0;
      if (count < 3) continue; // STRICT >= 3 THRESHOLD

      const { title: resolvedTitle, prompt } = formatCardTitleAndPrompt(it);
      if (isPlaceholderConcept(resolvedTitle) || isPlaceholderConcept(it.wordOrPhrase)) continue;

      const key = resolvedTitle.toLowerCase().trim();
      if (!map.has(key) || (map.get(key)!.wrongCount || 0) < count) {
        map.set(key, { ...it, wordOrPhrase: resolvedTitle, wrongCount: count });
      }
    }

    // 2. Supplement from savedWords ONLY if marked as mistakes with strict >= 3 mistakeCount
    for (const sw of fallbackSavedWords) {
      const q = sw.question;
      if (!q || !q.wordOrPhrase) continue;
      const count = typeof sw.mistakeCount === 'number' ? sw.mistakeCount : 0;
      if (count < 3) continue; // STRICT >= 3 THRESHOLD: MUST BE MISSED 3 OR MORE TIMES

      const { title: cleanTarget } = formatCardTitleAndPrompt({ wordOrPhrase: q.wordOrPhrase, category: q.category, wrongCount: count });
      const candidateTitle = cleanTarget && !isPlaceholderConcept(cleanTarget) ? cleanTarget : q.wordOrPhrase;
      if (isPlaceholderConcept(candidateTitle)) continue;

      const key = candidateTitle.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          wordOrPhrase: candidateTitle,
          category: q.category,
          wrongCount: count,
          meaning: q.meaning,
          hindiMeaning: q.hindiMeaning,
          lastMissedAt: sw.savedAt,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
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
    return allMissingWords.filter(w => {
      const { title: cardTitle, prompt } = formatCardTitleAndPrompt(w);
      const cleanH = formatCardHindi(w.hindiMeaning);
      const cleanM = formatCardMeaning(w.meaning, cardTitle);
      return (
        w.wordOrPhrase.toLowerCase().includes(query) ||
        cardTitle.toLowerCase().includes(query) ||
        (prompt && prompt.toLowerCase().includes(query)) ||
        cleanH.toLowerCase().includes(query) ||
        cleanM.toLowerCase().includes(query) ||
        w.category.toLowerCase().includes(query)
      );
    });
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
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs sm:text-sm font-black text-slate-100">{title}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No repeated mistakes recorded! Words you miss 3 or more times during battles, drills, or practice will automatically appear here with their complete stored mnemonics, Hindi meanings, and exam revision tricks.
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
                  {allMissingWords.length} Words (Missed ≥3x)
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
          {visibleCards.map((item, idx) => {
            const { title: cardTitle, prompt } = formatCardTitleAndPrompt(item);
            const cleanHindi = formatCardHindi(item.hindiMeaning);
            const cleanMeaning = formatCardMeaning(item.meaning, cardTitle);
            const categoryMeta = getCategoryBadge(item.category);

            return (
              <div
                key={idx}
                onClick={() => handleInspectWord(cardTitle || item.wordOrPhrase, item.category)}
                className="p-3 rounded-xl bg-slate-950 border border-rose-900/30 hover:border-purple-500/70 hover:bg-purple-950/20 transition-all flex flex-col justify-between gap-2 cursor-pointer group shadow-sm hover:shadow-md"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-mono font-black text-xs sm:text-sm text-slate-100 tracking-wider group-hover:text-purple-300 transition-colors truncate">
                      {cardTitle}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-[9px] shrink-0">
                      {item.wrongCount}x
                    </span>
                  </div>

                  {prompt && (
                    <div className="text-[10px] text-purple-300/80 italic truncate leading-tight">
                      "{prompt}"
                    </div>
                  )}

                  {cleanHindi && (
                    <div className="text-[11px] text-amber-400 font-bold truncate">
                      {cleanHindi}
                    </div>
                  )}

                  {cleanMeaning && (
                    <div className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                      {cleanMeaning}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-900">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}>
                    {categoryMeta.label}
                  </span>
                  <span className="text-purple-400/90 font-medium group-hover:underline text-[10px] flex items-center gap-0.5">
                    View Tricks →
                  </span>
                </div>
              </div>
            );
          })}

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
                    Words missed 3+ times. Tap any card to inspect mnemonics and exam tricks.
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
                  {modalFilteredWords.map((item, idx) => {
                    const { title: cardTitle, prompt } = formatCardTitleAndPrompt(item);
                    const cleanHindi = formatCardHindi(item.hindiMeaning);
                    const cleanMeaning = formatCardMeaning(item.meaning, cardTitle);
                    const categoryMeta = getCategoryBadge(item.category);

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          handleInspectWord(cardTitle || item.wordOrPhrase, item.category);
                        }}
                        className="p-3.5 rounded-xl bg-slate-950 border border-rose-900/30 hover:border-purple-500 hover:bg-purple-950/20 transition-all flex flex-col justify-between gap-2.5 cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-sm text-slate-100 tracking-wider group-hover:text-purple-300 transition-colors">
                                {cardTitle}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border ${categoryMeta.bg} ${categoryMeta.text} ${categoryMeta.border}`}>
                                {categoryMeta.label}
                              </span>
                              <Sparkles className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            {prompt && (
                              <div className="text-xs text-purple-300/80 italic">
                                "{prompt}"
                              </div>
                            )}

                            {cleanHindi && (
                              <div className="text-xs text-amber-400 font-bold">
                                {cleanHindi}
                              </div>
                            )}

                            {cleanMeaning && (
                              <div className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                {cleanMeaning}
                              </div>
                            )}
                          </div>

                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-[10px] shrink-0">
                            {item.wrongCount}x Wrong
                          </span>
                        </div>

                        <div className="flex items-center justify-end text-[10px] pt-2 border-t border-slate-900/80">
                          <span className="text-purple-400 font-bold group-hover:underline flex items-center gap-1">
                            <span>View Stored Tricks</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
              {searchFilter ? (
                <span className="text-xs text-slate-400 font-medium">
                  {modalFilteredWords.length} {modalFilteredWords.length === 1 ? 'word' : 'words'} found
                </span>
              ) : (
                <div />
              )}
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
