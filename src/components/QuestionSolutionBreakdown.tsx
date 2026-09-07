import React from 'react';
import { QuestionMeaningsBreakdown } from '../utils/questionEducationResolver';
import { CheckCircle2, HelpCircle } from 'lucide-react';

interface QuestionSolutionBreakdownProps {
  breakdown?: QuestionMeaningsBreakdown;
  meaning?: string;
  hindiMeaning?: string;
  rootWordInfo?: string;
  category?: string;
  compact?: boolean;
}

/**
 * Renders an educational breakdown for questions (OWS, Idioms, Synonyms, Antonyms, Vocab).
 * Strictly guarantees that the target prompt/word (e.g. pachyderm) and the correct answer
 * (e.g. A thick-skinned mammal) are displayed on distinct, clearly differentiated lines/cards
 * with their own English meanings and Hindi translations.
 */
export const QuestionSolutionBreakdown: React.FC<QuestionSolutionBreakdownProps> = ({
  breakdown,
  meaning,
  hindiMeaning,
  rootWordInfo,
  category,
  compact = false,
}) => {
  // If no structured breakdown exists, attempt fallback extraction
  const targetWord = breakdown?.targetWord || '';
  const targetMeaning = breakdown?.targetMeaning || '';
  const targetHindi = breakdown?.targetHindi || '';
  const targetLabel = breakdown?.targetLabel || (category === 'ows' ? 'Question Term' : category === 'idioms' ? 'Idiom / Phrase' : 'Given Word');

  const correctOption = breakdown?.correctOption;
  const correctMeaning = breakdown?.correctMeaning;
  const correctHindi = breakdown?.correctHindi;
  const categoryLabel = breakdown?.categoryLabel || (category === 'ows' ? 'One Word Substitution' : category === 'idioms' ? 'Correct Meaning' : 'Correct Answer');

  const hasDistinctOption = Boolean(
    correctOption &&
    (correctMeaning || correctHindi) &&
    correctOption.trim().toLowerCase() !== targetWord.trim().toLowerCase()
  );

  return (
    <div className="space-y-2.5">
      {/* 1. SEPARATE LINE/SECTION FOR TARGET WORD / PROMPT (e.g., pachyderm) */}
      {(targetWord || targetMeaning || targetHindi) ? (
        <div
          id="solution-target-breakdown-card"
          className="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-750/90 space-y-1.5 shadow-xs"
        >
          {/* Header Badge & Word Name */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-1">
              <HelpCircle className="w-2.5 h-2.5" />
              {targetLabel}
            </span>
            {targetWord && (
              <span className="text-xs sm:text-sm font-black text-sky-200 capitalize tracking-wide">
                {targetWord}
              </span>
            )}
          </div>

          {/* English Meaning of Target Word */}
          {targetMeaning && (
            <div className="text-xs text-slate-100 font-medium leading-relaxed pl-0.5">
              <span className="text-sky-400 font-bold">Meaning: </span>
              <span className="text-slate-200">{targetMeaning}</span>
            </div>
          )}

          {/* Hindi Meaning of Target Word */}
          {targetHindi && (
            <div className="text-xs text-amber-300/95 font-medium leading-relaxed pt-1 border-t border-slate-800/60 pl-0.5">
              <span className="text-amber-400 font-bold">हिन्दी भावार्थ: </span>
              <span className="text-amber-200/95">{targetHindi}</span>
            </div>
          )}
        </div>
      ) : meaning ? (
        /* Fallback if target info couldn't be extracted */
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-750/90 space-y-1">
          <div className="text-xs text-slate-100 font-medium whitespace-pre-line leading-relaxed">
            <span className="font-bold text-sky-400">Meaning: </span>
            <span>{meaning}</span>
          </div>
          {hindiMeaning && (
            <div className="text-xs text-amber-300/95 font-medium whitespace-pre-line leading-relaxed pt-1 border-t border-slate-800/60">
              <span className="font-bold text-amber-400">हिन्दी भावार्थ: </span>
              <span>{hindiMeaning}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 2. SEPARATE LINE/SECTION FOR CORRECT ANSWER (e.g., A thick-skinned mammal) */}
      {hasDistinctOption && (
        <div
          id="solution-answer-breakdown-card"
          className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1.5 shadow-xs animate-fadeIn"
        >
          {/* Header Badge & Answer Option */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {categoryLabel}
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-300 capitalize tracking-wide">
              {correctOption}
            </span>
          </div>

          {/* English Meaning of Correct Answer */}
          {correctMeaning && (
            <div className="text-xs text-emerald-100/95 font-medium leading-relaxed pl-0.5">
              <span className="text-emerald-400 font-bold">Meaning: </span>
              <span className="text-slate-200">{correctMeaning}</span>
            </div>
          )}

          {/* Hindi Meaning of Correct Answer */}
          {correctHindi && (
            <div className="text-xs text-amber-200/95 font-medium leading-relaxed pt-1 border-t border-emerald-800/40 pl-0.5">
              <span className="text-amber-400 font-bold">हिन्दी भावार्थ: </span>
              <span className="text-amber-200/90">{correctHindi}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Performance Diagnostic / Root Word Info */}
      {rootWordInfo && (
        <div
          id="solution-root-diagnostic"
          className="text-[11px] text-teal-300/95 bg-teal-950/30 border border-teal-800/40 rounded-lg p-2 leading-relaxed"
        >
          <span className="font-bold text-teal-400">Performance Diagnostic: </span>
          <span className="text-teal-200/90">{rootWordInfo}</span>
        </div>
      )}
    </div>
  );
};
