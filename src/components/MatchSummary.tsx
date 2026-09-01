import React, { useEffect, useState, useMemo } from 'react';
import { 
  Trophy, 
  Award, 
  Flame, 
  ArrowRight, 
  ArrowLeft,
  Bookmark, 
  BookmarkCheck,
  Sparkles, 
  RotateCcw, 
  Check, 
  X, 
  Shield, 
  HelpCircle, 
  Flag,
  Target,
  Zap,
  Filter,
  CheckCircle2,
  XCircle,
  Brain,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Eye,
  Share2,
  Info,
  Lightbulb
} from 'lucide-react';
import { MatchState, PlayerProfile, Question } from '../types';
import { soundManager } from '../utils/audio';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';
import { ReportQuestionModal } from './ReportQuestionModal';
import { ShareBattleResultModal } from './ShareBattleResultModal';
import { BattleShareData } from '../utils/shareCardGenerator';
import { getOptionBreakdown, OptionDetail } from '../utils/optionExplanations';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';
import { formatExamTag } from '../services/jsonPyqParser';

import { User as FirebaseUser } from 'firebase/auth';
import { AuthCard } from './AuthCard';

interface MatchSummaryProps {
  player: PlayerProfile;
  matchState: MatchState;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onBookmarkQuestion: (question: Question) => void;
  onOpenAiDeepDive: (question: Question) => void;
  bookmarkedIds: string[];
  isPremium?: boolean;
  currentUser?: FirebaseUser | null;
  onUserChange?: (user: FirebaseUser | null) => void;
}

interface MatchQuestionReviewCardProps {
  question: Question;
  originalIndex: number;
  isCorrect: boolean;
  selectedOptionIndex: number;
  isBookmarked: boolean;
  onBookmark: (q: Question) => void;
  onOpenAiDeepDive: (q: Question) => void;
  onReport: (q: Question) => void;
}

const MatchQuestionReviewCard: React.FC<MatchQuestionReviewCardProps> = ({
  question: q,
  originalIndex: idx,
  isCorrect,
  selectedOptionIndex,
  isBookmarked,
  onBookmark,
  onOpenAiDeepDive,
  onReport,
}) => {
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);

  // Compute detailed breakdowns for all 4 options
  const optionDetails: OptionDetail[] = useMemo(() => {
    if (Array.isArray(q.optionDetails) && q.optionDetails.length === 4) {
      return q.optionDetails.map((od, optIdx) => ({
        option: od.option || q.options[optIdx] || `Option ${String.fromCharCode(65 + optIdx)}`,
        englishMeaning: od.englishMeaning || 'Option explanation',
        hindiMeaning: od.hindiMeaning || '',
        isCorrect: optIdx === q.correctIndex,
        mnemonicHook: od.mnemonicHook,
      }));
    }
    return getOptionBreakdown(
      q.options,
      q.correctIndex,
      q.category,
      q.wordOrPhrase,
      q.meaning,
      q.hindiMeaning
    );
  }, [q]);

  // Guaranteed educational fields resolution
  const eduDetails = useMemo(() => {
    const targetWord = (q.wordOrPhrase || '').trim();
    const correctOpt = q.options[q.correctIndex] || 'Option';
    const lower = targetWord.toLowerCase();

    let root = q.rootWordInfo?.trim() || '';
    if (!root) {
      if (lower.startsWith('pan')) {
        root = 'Greek pan- ("all, whole") -> formal speech of praise delivered in a public gathering.';
      } else if (lower.startsWith('castig') || lower.startsWith('chast')) {
        root = 'Latin castigare (castus "pure" + agere "to drive") -> to discipline or severely criticize.';
      } else if (lower.startsWith('fastid')) {
        root = 'Latin fastidium ("loathing, distaste") -> difficult to please; excessively particular.';
      } else if (lower.startsWith('bene') || lower.startsWith('bon')) {
        root = 'Latin bene ("well, good") -> expressing kindness or favorable disposition.';
      } else if (lower.startsWith('mal')) {
        root = 'Latin malus ("bad, ill") -> denoting harmful, defective, or hostile state.';
      } else if (lower.startsWith('equ')) {
        root = 'Latin aequus ("even, equal") -> denoting calmness, balance, or fair proportion.';
      } else if (lower.startsWith('tacit')) {
        root = 'Latin tacere ("to be silent") -> expressing quietness or habitual lack of speech.';
      } else if (lower.startsWith('loqu') || lower.startsWith('locu')) {
        root = 'Latin loqui ("to speak") -> tending to speak fluently or at great length.';
      } else {
        root = `Root and morphological structure of "${targetWord}" tested frequently in competitive examinations.`;
      }
    }

    let meaning = q.meaning?.trim() || '';
    let hindiMeaning = q.hindiMeaning?.trim() || '';

    if (!meaning) {
      if (q.category === 'synonyms') {
        meaning = `Shows characteristics or qualities closely corresponding to "${correctOpt}".`;
        hindiMeaning = `"${targetWord}" का यथार्थ शब्दार्थ एवं भावार्थ`;
      } else if (q.category === 'antonyms') {
        meaning = `Denotes a state or quality in direct contrast to "${correctOpt}".`;
        hindiMeaning = `"${targetWord}" का सटीक विलोमार्थी भाव`;
      } else if (q.category === 'ows') {
        meaning = `One who or that which corresponds to: "${targetWord}".`;
        hindiMeaning = `"${correctOpt}" का एक शब्द में सटीक अर्थ`;
      } else {
        meaning = `Figurative meaning: Denotes "${correctOpt}".`;
        hindiMeaning = `मुहावरे "${targetWord}" का लाक्षणिक अर्थ`;
      }
    }

    const mnemonic = q.mnemonic?.trim() || `Memory Hook: Connect "${targetWord}" with "${correctOpt}" for rapid recall during revision.`;
    const example = q.exampleSentence?.trim() || `The examination sentence tested the precise contextual nuance of "${targetWord}".`;

    return {
      meaning,
      hindiMeaning,
      rootWordInfo: root,
      mnemonic,
      exampleSentence: example,
    };
  }, [q]);

  const examTagText = (() => {
    if (q.exam || q.year || q.tier) {
      return formatExamTag(q.exam, q.year, q.tier);
    }
    return (q.examHistory && q.examHistory.length > 0)
      ? q.examHistory.slice(0, 2).join(' • ')
      : 'Govt Exam PYQ';
  })();

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 shadow-lg transition-all ${
        isCorrect
          ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/40'
          : 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 border-rose-900/40 hover:border-rose-600/60'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Outcome badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${
              isCorrect
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
            }`}
          >
            {isCorrect ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Q{idx + 1} • Correct</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Q{idx + 1} • Missed</span>
              </>
            )}
          </div>

          {/* Category Badge */}
          <span className="text-[11px] font-mono uppercase bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded-md border border-slate-700 font-bold">
            {q.category}
          </span>

          {/* Repeat Frequency */}
          <span className="text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-md">
            🔥 {q.repeatCount}x in SSC
          </span>
        </div>

        {/* Action Buttons: Star/Save, AI Tutor, Report */}
        <div className="flex items-center gap-1.5">
          {/* Bookmark/Star to Vault */}
          <button
            onClick={() => {
              soundManager.playTap();
              onBookmark(q);
            }}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isBookmarked
                ? 'bg-amber-950 border-amber-600 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title={isBookmarked ? 'Saved in Vault' : 'Save to Mistake Vault'}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline text-[11px]">
              {isBookmarked ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Ask AI Deep Dive */}
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenAiDeepDive(q);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="AI Root Word & Mnemonic Breakdown"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px]">AI Tutor</span>
          </button>

          {/* Report Question */}
          <button
            onClick={() => {
              soundManager.playTap();
              onReport(q);
            }}
            className="p-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
            title="Report discrepancy in question"
          >
            <Flag className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Question Statement Box */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {q.instruction || 'Select the most appropriate option:'}
        </div>
        <h3 className="text-base sm:text-lg font-black text-amber-300 tracking-wide">
          "{q.wordOrPhrase}"
        </h3>
        <div className="pt-1">
          <ExamAppearancesBadge
            appearances={q.appearances}
            exam={q.exam}
            year={q.year}
            tier={q.tier}
            examHistory={q.examHistory}
            repeatCount={q.repeatCount}
            showRepeatCount={false}
            size="xs"
          />
        </div>
      </div>

      {/* 4 Options Grid (Clearly shows what was picked vs correct) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {q.options.map((opt, optIdx) => {
          const isCorrectOpt = optIdx === q.correctIndex;
          const isUserChoice = optIdx === selectedOptionIndex;

          let optClass = 'bg-slate-950/50 border-slate-800 text-slate-400';
          let badgeIcon = (
            <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
              {String.fromCharCode(65 + optIdx)}
            </span>
          );

          if (isCorrectOpt) {
            optClass = 'bg-emerald-950/70 border-emerald-500/80 text-emerald-200 font-bold ring-1 ring-emerald-500/50';
            badgeIcon = (
              <span className="w-5 h-5 rounded-md bg-emerald-600 text-slate-950 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            );
          } else if (isUserChoice && !isCorrectOpt) {
            optClass = 'bg-rose-950/70 border-rose-500/80 text-rose-200 font-bold ring-1 ring-rose-500/50';
            badgeIcon = (
              <span className="w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center shrink-0">
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            );
          }

          return (
            <div
              key={optIdx}
              className={`p-2.5 sm:p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 ${optClass}`}
            >
              <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                {badgeIcon}
                <span className="font-semibold break-words leading-snug flex-1">{opt}</span>
              </div>
              {isCorrectOpt && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide shrink-0">
                  Correct
                </span>
              )}
              {isUserChoice && !isCorrectOpt && (
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wide shrink-0">
                  Your Choice
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Hindi Explanation & Memory Hook Mnemonics Box */}
      <div className="bg-slate-950/90 rounded-xl p-3 sm:p-3.5 border border-slate-800 text-xs space-y-2">
        <div className="flex items-start gap-2">
          <span className="font-black text-amber-400 shrink-0">हिन्दी अर्थ:</span>
          <span className="text-slate-200 font-medium">{q.hindiMeaning || eduDetails.hindiMeaning}</span>
        </div>

        {(q.mnemonic || eduDetails.mnemonic) && (
          <div className="text-[11px] text-sky-200 bg-sky-950/40 border border-sky-800/40 p-2.5 rounded-lg flex items-start gap-2">
            <span className="font-black text-sky-400 shrink-0">💡 Memory Hook:</span>
            <span className="leading-relaxed">{q.mnemonic || eduDetails.mnemonic}</span>
          </div>
        )}

        {/* Exam Occurrences */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] text-slate-400">
          <span className="font-bold text-slate-400">Past SSC Papers:</span>
          {q.examHistory && q.examHistory.length > 0 ? (
            q.examHistory.map((ex, i) => (
              <span
                key={i}
                className="bg-slate-850 border border-slate-700/80 px-2 py-0.5 rounded text-sky-300 font-medium"
              >
                🏛️ {ex}
              </span>
            ))
          ) : (
            <span className="bg-slate-850 border border-slate-700/80 px-2 py-0.5 rounded text-sky-300 font-medium">
              🏛️ {examTagText}
            </span>
          )}
        </div>

        {/* Interactive "More" Toggle Button */}
        <button
          onClick={() => {
            soundManager.playTap();
            setShowMoreDetails(prev => !prev);
          }}
          className={`w-full mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs transition-colors group cursor-pointer ${
            showMoreDetails ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-expanded={showMoreDetails}
        >
          <div className="flex items-center gap-1.5 font-bold text-[11px]">
            <BookOpen className={`w-3.5 h-3.5 ${showMoreDetails ? 'text-sky-400' : 'text-amber-400'}`} />
            <span>
              {showMoreDetails 
                ? 'Hide Word Meaning & 4 Options Details' 
                : 'More: Word Meaning & All 4 Options Breakdown'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold">
            <span className="hidden sm:inline">{showMoreDetails ? 'Less' : 'View Deep Details'}</span>
            {showMoreDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-sky-400 group-hover:-translate-y-0.5 transition-transform" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            )}
          </div>
        </button>
      </div>

      {/* Expandable Rich Educational Breakdown (Same as PYQ Drill) */}
      {showMoreDetails && (
        <div className="space-y-3 pt-1 animate-fadeIn">
          {/* Word Meaning & Etymology Details */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <div className="flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wider text-[11px]">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {q.category === 'idioms' 
                    ? 'Idiom Meaning & Usage' 
                    : q.category === 'ows' 
                    ? 'One Word Substitution Concept' 
                    : 'Word Meaning & Morphological Insight (शब्दार्थ)'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/60">
              {eduDetails.meaning && (
                <div className="text-xs text-slate-100 font-medium">
                  <span className="font-bold text-sky-400">English: </span>
                  <span>{eduDetails.meaning}</span>
                </div>
              )}
              {eduDetails.hindiMeaning && (
                <div className="text-xs text-amber-300/90 font-medium">
                  <span className="font-bold text-amber-400">हिन्दी भावार्थ: </span>
                  <span>{eduDetails.hindiMeaning}</span>
                </div>
              )}
              {eduDetails.rootWordInfo && (
                <div className="text-[11px] text-teal-300/90 pt-1 border-t border-slate-800/60">
                  <span className="font-bold text-teal-400">Root & Etymology: </span>
                  <span>{eduDetails.rootWordInfo}</span>
                </div>
              )}
              {eduDetails.exampleSentence && (
                <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                  <span className="font-semibold text-slate-500 not-italic">Example: </span>
                  "{eduDetails.exampleSentence}"
                </div>
              )}
            </div>
          </div>

          {/* Exam Rationale / Explanation if available */}
          {q.explanation && (
            <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-2.5 sm:p-3 text-xs space-y-1 text-slate-200">
              <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>Why this answer (Exam Rationale):</span>
              </div>
              <div className="leading-relaxed pl-4 text-[12px] text-sky-100">
                {q.explanation}
              </div>
            </div>
          )}

          {/* All 4 Options Meaning & Explanation */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                All 4 Options Meaning & Explanation:
              </span>
            </div>

            <div className="space-y-2">
              {optionDetails.map((detail, optIdx) => {
                const letter = String.fromCharCode(65 + optIdx);
                const isCorrect = detail.isCorrect;
                const isUserChoice = selectedOptionIndex === optIdx;

                return (
                  <div
                    key={optIdx}
                    className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                      isCorrect
                        ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-100 shadow-sm ring-1 ring-emerald-500/30'
                        : isUserChoice
                        ? 'bg-rose-950/60 border-rose-600/70 text-slate-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md font-mono text-[10px] font-black flex items-center justify-center border shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-800 border-emerald-400 text-emerald-100'
                              : isUserChoice
                              ? 'bg-rose-800 border-rose-400 text-rose-100'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="font-extrabold text-slate-100 text-xs sm:text-[13px] break-words">
                          {detail.option}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-900/90 text-emerald-300 border-emerald-600'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isCorrect ? '✓ Correct Option' : 'Option Meaning'}
                      </span>
                    </div>

                    <div className="pl-7 space-y-0.5">
                      {detail.hindiMeaning && (
                        <div className="text-amber-300 font-semibold text-[11px]">
                          {detail.hindiMeaning}
                        </div>
                      )}
                      {detail.englishMeaning && (
                        <div className="text-slate-300 text-[11px] leading-relaxed">
                          {detail.englishMeaning}
                        </div>
                      )}
                      {detail.mnemonicHook && (
                        <div className="text-[10px] text-sky-400 flex items-center gap-1 pt-0.5">
                          <Lightbulb className="w-3 h-3 text-sky-400 shrink-0" />
                          <span><b>Hook:</b> {detail.mnemonicHook}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MatchSummary: React.FC<MatchSummaryProps> = ({
  player,
  matchState,
  onPlayAgain,
  onBackToLobby,
  onBookmarkQuestion,
  onOpenAiDeepDive,
  bookmarkedIds,
  isPremium = false,
  currentUser = null,
  onUserChange,
}) => {
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);
  const [showSignupCard, setShowSignupCard] = useState<boolean>(!currentUser);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'solutions'>('summary');
  const [filterType, setFilterType] = useState<'all' | 'mistakes' | 'correct'>('all');
  
  const isWinner = matchState.finalResult 
    ? (matchState.finalResult.winnerId === player.id || (matchState.finalResult.winnerId !== 'draw' && matchState.playerScore > matchState.opponentScore))
    : matchState.playerScore > matchState.opponentScore;
  const isDraw = matchState.finalResult
    ? (matchState.finalResult.winnerId === 'draw' || matchState.playerScore === matchState.opponentScore)
    : matchState.playerScore === matchState.opponentScore;

  // Authoritative LP calculation
  const playerLpChange = isWinner ? 30 : isDraw ? 5 : -15;
  const opponentLpChange = isWinner ? -15 : isDraw ? 5 : 30;

  // Match statistics calculations
  const totalQuestions = matchState.questions.length;
  let correctCount = 0;
  let mistakeCount = 0;
  let maxCombo = 0;
  let currentCombo = 0;

  matchState.questions.forEach((_, idx) => {
    const pAns = matchState.playerAnswers[idx];
    if (pAns?.isCorrect) {
      correctCount++;
      currentCombo++;
      if (currentCombo > maxCombo) maxCombo = currentCombo;
    } else {
      mistakeCount++;
      currentCombo = 0;
    }
  });

  const accuracyPct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Authoritative share data package
  const shareData: BattleShareData = {
    playerName: player.name || 'Govt Aspirant',
    playerAvatar: player.avatar,
    playerScore: matchState.playerScore,
    playerLpChange,
    opponentName: matchState.opponent.name || 'Opponent',
    opponentAvatar: matchState.opponent.avatar,
    opponentScore: matchState.opponentScore,
    isWinner,
    isDraw,
    exam: matchState.examFilter,
    category: matchState.categoryFilter,
    accuracyPct,
    totalQuestions,
  };

  useEffect(() => {
    if (isWinner) {
      soundManager.playVictory();
    } else {
      soundManager.playWrong();
    }
  }, [isWinner]);

  // Filter questions based on user selection
  const filteredQuestions = matchState.questions.map((q, idx) => {
    const pAns = matchState.playerAnswers[idx];
    return {
      question: q,
      originalIndex: idx,
      playerAnswer: pAns,
      isCorrect: pAns?.isCorrect ?? false,
      selectedOptionIndex: pAns?.selectedOption ?? -1,
    };
  }).filter(item => {
    if (filterType === 'mistakes') return !item.isCorrect;
    if (filterType === 'correct') return item.isCorrect;
    return true;
  });

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 bg-slate-950/40">
      <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-12">

        {activeTab === 'summary' ? (
          /* ========================================================
             VIEW 1: MATCH SUMMARY OVERVIEW (FOCUSED & COMPACT)
             ======================================================== */
          <div className="space-y-5 sm:space-y-6 animate-fadeIn">
            {/* HERO RESULT CARD (Centered, Boxed, Non-Flat) */}
            <div
              className={`rounded-3xl border p-5 sm:p-7 shadow-2xl relative overflow-hidden text-center transition-all ${
                isWinner
                  ? 'bg-gradient-to-b from-amber-950/60 via-slate-900/90 to-slate-950 border-amber-500/60 shadow-amber-950/30'
                  : isDraw
                  ? 'bg-gradient-to-b from-slate-850 via-slate-900/90 to-slate-950 border-slate-700 shadow-slate-950/50'
                  : 'bg-gradient-to-b from-rose-950/60 via-slate-900/90 to-slate-950 border-rose-600/60 shadow-rose-950/30'
              }`}
            >
              {/* Ambient Glow Aura */}
              <div
                className={`absolute top-0 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-40 rounded-full blur-3xl opacity-30 pointer-events-none ${
                  isWinner ? 'bg-amber-400' : isDraw ? 'bg-sky-400' : 'bg-rose-500'
                }`}
              />

              {/* Outcome Emblem & Title */}
              <div className="relative z-10 space-y-1.5 sm:space-y-2">
                <div className="inline-flex p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg text-3xl sm:text-4xl">
                  {isWinner ? '🏆' : isDraw ? '🤝' : '💔'}
                </div>

                <h1
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-wider ${
                    isWinner ? 'text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]' : isDraw ? 'text-slate-100' : 'text-rose-400 drop-shadow-[0_2px_10px_rgba(244,63,94,0.3)]'
                  }`}
                >
                  {isWinner ? 'VICTORY!' : isDraw ? 'DRAW MATCH' : 'DEFEAT'}
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  {isWinner
                    ? 'Splendid Performance! Promoted higher in Govt Exam Leaderboard.'
                    : isDraw
                    ? 'Well fought match! Both aspirants demonstrated strong vocabulary.'
                    : 'Close fight! Review mistakes and mnemonics to master these PYQs.'}
                </p>
              </div>

              {/* HEAD-TO-HEAD DUEL BOX (Focused, Boxed, Non-Flat Layout) */}
              <div className="relative z-10 mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-xl mx-auto items-stretch">
                {/* Player Box */}
                <div className="bg-slate-900/90 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between text-center relative shadow-lg">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow">
                    YOU
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/80 flex items-center justify-center text-2xl shadow-inner mt-1 mb-2">
                    {player.avatar}
                  </div>
                  <div className="min-w-0 w-full mb-2">
                    <div className="font-extrabold text-sm sm:text-base text-slate-100 truncate">{player.name}</div>
                    <div className="text-[11px] text-amber-400/90 font-medium truncate">{player.title || 'Govt Job Aspirant'}</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2 px-4 w-full relative group/score">
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
                      {matchState.playerScore}
                    </div>
                    <div className={`text-xs font-bold font-mono mt-0.5 ${playerLpChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {playerLpChange >= 0 ? `+${playerLpChange} LP` : `${playerLpChange} LP`}
                    </div>

                    {/* Aesthetic Share2 icon button in top-right of points/score area */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundManager.playTap();
                        setShowShareModal(true);
                      }}
                      aria-label="Share result"
                      title="Share result"
                      className="absolute top-2 right-2 w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700/60 hover:border-amber-500/40 transition-all active:scale-90 cursor-pointer shadow-sm group/btn z-10"
                    >
                      <Share2 className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                      {/* Desktop Tooltip */}
                      <span className="hidden sm:group-hover/btn:block absolute -top-8 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg border border-slate-700 whitespace-nowrap pointer-events-none z-30">
                        Share result
                      </span>
                    </button>
                  </div>
                </div>

                {/* Opponent Box */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between text-center relative shadow-lg">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full shadow">
                    OPPONENT
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border-2 border-orange-400/80 flex items-center justify-center text-2xl shadow-inner mt-1 mb-2">
                    {matchState.opponent.avatar}
                  </div>
                  <div className="min-w-0 w-full mb-2">
                    <div className="font-extrabold text-sm sm:text-base text-slate-100 truncate">{matchState.opponent.name}</div>
                    <div className="text-[11px] text-orange-400/90 font-medium truncate">{matchState.opponent.tierTitle}</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2 px-4 w-full">
                    <div className="text-2xl sm:text-3xl font-black text-orange-400 font-mono tracking-tight">
                      {matchState.opponentScore}
                    </div>
                    <div className={`text-xs font-bold font-mono mt-0.5 ${opponentLpChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {opponentLpChange >= 0 ? `+${opponentLpChange} LP` : `${opponentLpChange} LP`}
                    </div>
                  </div>
                </div>
              </div>

              {/* MATCH METRICS SQUARE TILES (Focused 3-Square Grid with Solution Trigger) */}
              <div className="relative z-10 mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl mx-auto">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3 text-center">
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Target className="w-3 h-3 text-sky-400" />
                    <span>Accuracy</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-sky-300 font-mono mt-1">
                    {accuracyPct}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {correctCount}/{totalQuestions} Correct
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3 text-center">
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Max Streak</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-400 font-mono mt-1">
                    {maxCombo}x
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Combo Multiplier
                  </div>
                </div>

                {/* Solution Launcher Tile */}
                <button
                  onClick={() => {
                    soundManager.playTap();
                    setActiveTab('solutions');
                  }}
                  className="bg-gradient-to-br from-indigo-950/90 to-purple-950/90 hover:from-indigo-900/90 hover:to-purple-900/90 border border-indigo-500/50 hover:border-indigo-400 rounded-xl p-2.5 sm:p-3 text-center transition-all active:scale-95 group cursor-pointer shadow-md"
                >
                  <div className="text-[10px] sm:text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Brain className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>Solutions</span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-white mt-1 flex items-center justify-center gap-1">
                    <span>{totalQuestions} PYQs</span>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="text-[10px] text-amber-300 font-semibold">
                    {mistakeCount} Mistakes
                  </div>
                </button>
              </div>
            </div>

            {/* BIG PROMINENT "VIEW SOLUTIONS" HERO BUTTON */}
            <div className="max-w-xl mx-auto">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('solutions');
                }}
                className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black p-3.5 sm:p-4 rounded-2xl shadow-xl shadow-indigo-900/30 border border-indigo-400/40 flex items-center justify-between px-5 transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg shadow-inner">
                    📖
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-black tracking-wide flex items-center gap-2">
                      <span>SEE MATCH SOLUTIONS & MNEMONICS</span>
                      <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full uppercase">
                        {mistakeCount} to revise
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-200 font-medium">
                      Inspect all questions, Hindi meanings, root-words & memory hooks
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-300 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
            </div>

            {/* PRIMARY ACTION BUTTONS (Play Next Match & Lobby) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
              <button
                onClick={() => {
                  soundManager.playTap();
                  onPlayAgain();
                }}
                className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black p-3.5 sm:p-4 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PLAY NEXT MATCH</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  onBackToLobby();
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold p-3.5 sm:p-4 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] cursor-pointer shadow-md"
              >
                <span>RETURN TO LOBBY</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* POST-MATCH SIGNUP/SAVE CARD (If guest) */}
            {!currentUser && showSignupCard && (
              <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border-2 border-purple-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-fadeIn max-w-xl mx-auto">
                <button
                  onClick={() => {
                    soundManager.playTap();
                    setShowSignupCard(false);
                  }}
                  className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-all cursor-pointer z-10"
                  title="Dismiss for now"
                  aria-label="Close signup banner"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shrink-0">
                    ☁️
                  </div>
                  <div className="pr-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">
                        Save Match Progress
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        +{matchState.playerScore} Pts
                      </span>
                    </div>
                    <h3 className="text-base font-black text-white mt-1 leading-tight">
                      Don't lose your match LP & All-India Rank!
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Sign in with 1-Tap Google or Email to save this match result to your profile and unlock the leaderboard.
                    </p>
                  </div>
                </div>

                <div className="mt-3 bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-purple-800/40">
                  <AuthCard
                    currentUser={currentUser}
                    onUserChange={user => {
                      if (onUserChange) onUserChange(user);
                      setShowSignupCard(false);
                    }}
                    onSuccessClose={() => setShowSignupCard(false)}
                  />
                </div>
              </div>
            )}

            {/* AdSense Unit */}
            {!isPremium && (
              <div className="py-1 max-w-xl mx-auto">
                <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" isPremium={isPremium} />
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
             VIEW 2: DEDICATED SOLUTION & MNEMONICS PAGE
             ======================================================== */
          <div className="space-y-4 animate-fadeIn">
            {/* Top Navigation & Fast Action Header */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-md sticky top-0 z-20 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      setActiveTab('summary');
                    }}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Result</span>
                  </button>

                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-amber-400" />
                      <span>Match Solutions ({totalQuestions} PYQs)</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Score: <span className="text-amber-400 font-bold">{matchState.playerScore}</span> vs{' '}
                      <span className="text-orange-400 font-bold">{matchState.opponentScore}</span> • Accuracy:{' '}
                      <span className="text-emerald-400 font-bold">{accuracyPct}%</span>
                    </p>
                  </div>
                </div>

                {/* Quick Match Triggers right in the header */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onPlayAgain();
                    }}
                    className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Play Next</span>
                  </button>

                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onBackToLobby();
                    }}
                    className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <span>Lobby</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs Bar */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 justify-start overflow-x-auto no-scrollbar">
                <button
                  onClick={() => {
                    soundManager.playTap();
                    setFilterType('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 ${
                    filterType === 'all'
                      ? 'bg-slate-800 text-amber-400 shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>All ({totalQuestions})</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    setFilterType('mistakes');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 ${
                    filterType === 'mistakes'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-rose-300'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Mistakes ({mistakeCount})</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    setFilterType('correct');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 ${
                    filterType === 'correct'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Correct ({correctCount})</span>
                </button>
              </div>
            </div>

            {/* Questions List: Centered Cards with rich visual breakdown */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-10 text-center space-y-3 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-2xl">
                    🎉
                  </div>
                  <div className="font-extrabold text-base text-slate-200">No questions match this filter</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {filterType === 'mistakes'
                      ? 'Great job! You had zero mistakes in this category.'
                      : 'Switch filters to inspect the other questions from this match.'}
                  </p>
                  <button
                    onClick={() => setFilterType('all')}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer"
                  >
                    View All Questions
                  </button>
                </div>
              ) : (
                filteredQuestions.map(({ question: q, originalIndex: idx, isCorrect, selectedOptionIndex }) => (
                  <MatchQuestionReviewCard
                    key={q.id || `match-q-${idx}`}
                    question={q}
                    originalIndex={idx}
                    isCorrect={isCorrect}
                    selectedOptionIndex={selectedOptionIndex}
                    isBookmarked={bookmarkedIds.includes(q.id)}
                    onBookmark={onBookmarkQuestion}
                    onOpenAiDeepDive={onOpenAiDeepDive}
                    onReport={(questionToReport) => setReportingQuestion(questionToReport)}
                  />
                ))
              )}
            </div>

            {/* Bottom Sticky Action Bar in Solution view */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  soundManager.playTap();
                  onPlayAgain();
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 text-sm transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PLAY NEXT MATCH</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  onBackToLobby();
                }}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold px-6 py-3.5 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 text-sm transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <span>RETURN TO LOBBY</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Question Modal */}
      {reportingQuestion && (
        <ReportQuestionModal
          question={reportingQuestion}
          userName={player.name}
          onClose={() => setReportingQuestion(null)}
        />
      )}

      {/* Share Battle Result Modal */}
      {showShareModal && (
        <ShareBattleResultModal
          data={shareData}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
