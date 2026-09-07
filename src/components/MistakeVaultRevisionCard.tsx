import React, { useState } from 'react';
import { Question, SavedWord } from '../types';
import { buildMistakeVaultRevisionItem, NormalizedMistakeVaultItem } from '../utils/mistakeVaultCardResolver';
import { formatRepeatCount } from '../utils/questionFingerprint';
import { Star, Trash2, Flag, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface MistakeVaultRevisionCardProps {
  item: SavedWord;
  onToggleBookmark: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onReport?: (question: Question) => void;
}

export const MistakeVaultRevisionCard: React.FC<MistakeVaultRevisionCardProps> = ({
  item,
  onToggleBookmark,
  onDelete,
  onReport,
}) => {
  const [isOriginalQuestionOpen, setIsOriginalQuestionOpen] = useState(false);
  const card: NormalizedMistakeVaultItem = buildMistakeVaultRevisionItem(item.question, item);

  return (
    <div
      id={`vault-card-${card.id}`}
      className="bg-slate-850/95 border border-slate-750/90 hover:border-slate-700/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-sm"
    >
      <div className="space-y-3.5">
        {/* TOP ROW: Word / Category / Status Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-lg sm:text-xl text-slate-100 tracking-wide uppercase break-words leading-tight">
              {card.target}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block text-xs font-bold text-sky-400 capitalize">
                {card.categoryDisplay}
              </span>
              {card.targetSublabel && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {card.targetSublabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            {card.isSaved && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/80 flex items-center gap-1 whitespace-nowrap shadow-xs">
                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                Saved
              </span>
            )}
            {card.isMistake && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800 whitespace-nowrap shadow-xs">
                {card.mistakeCount}× Mistake{card.mistakeCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* TARGET MEANING SECTION (Shown when target has a separate definition or scenario) */}
        {(card.targetMeaning || card.targetHindiMeaning) && (
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/80 space-y-1">
            {card.isSituationBased && (
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Situation:
              </div>
            )}
            {card.targetMeaning && (
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {card.targetMeaning}
              </div>
            )}
            {card.targetHindiMeaning && (
              <div className="text-xs text-amber-300/90 font-medium pt-0.5">
                {card.targetHindiMeaning}
              </div>
            )}
          </div>
        )}

        {/* RELATIONSHIP & CORRECT ANSWER SECTION */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-emerald-900/40 space-y-1.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">
            {card.relation}
          </div>
          <div className="text-sm sm:text-base font-black text-emerald-300 tracking-wide uppercase flex items-center gap-1.5">
            <span>{card.answer}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          {card.answerMeaning && (
            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {card.answerMeaning}
            </div>
          )}
          {card.answerHindiMeaning && (
            <div className="text-xs text-amber-300/90 font-medium pt-0.5">
              {card.answerHindiMeaning}
            </div>
          )}
        </div>

        {/* MEMORY HOOK (One consistent label throughout Mistake Vault) */}
        {card.mnemonic && (
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>💡 Memory Hook</span>
            </div>
            <p className="text-slate-300 leading-relaxed mt-1">
              {card.mnemonic}
            </p>
          </div>
        )}

        {/* COLLAPSIBLE ORIGINAL PYQ (Collapsed by default) */}
        {isOriginalQuestionOpen && (
          <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5 text-left animate-fadeIn">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Original PYQ
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug">
              {card.originalQuestion}
            </p>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              {card.originalOptions.map((opt) => (
                <div
                  key={opt.label}
                  className={`p-2 rounded-lg border text-xs flex flex-col transition-colors ${
                    opt.isCorrect
                      ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200 font-semibold'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <span className={`font-bold mr-1.5 ${opt.isCorrect ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {opt.label}.
                      </span>
                      {opt.text}
                    </span>
                    {opt.isCorrect && (
                      <span className="text-emerald-400 text-xs font-bold shrink-0 ml-2">✓</span>
                    )}
                  </div>
                  {opt.meaning && (
                    <div className="text-[11px] text-slate-400 mt-1 pl-4 font-normal">
                      {opt.meaning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER SECTION: Source, Repeat Count, View PYQ Toggle, Actions */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800 whitespace-nowrap">
            {card.source}
          </span>
          {card.shouldShowRepeat && (
            <span 
              title={card.repeatCount > 5 ? `Repeated ${card.repeatCount} times across exam papers` : undefined}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/40 text-amber-300 border border-amber-800/40 whitespace-nowrap"
            >
              Repeated {formatRepeatCount(card.repeatCount)}
            </span>
          )}

          <button
            onClick={() => setIsOriginalQuestionOpen((prev) => !prev)}
            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors py-1 cursor-pointer"
          >
            {isOriginalQuestionOpen ? (
              <>
                Hide Original PYQ <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                View Original PYQ <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            onClick={() => onToggleBookmark(card.id)}
            title={card.isSaved ? 'Remove from Saved' : 'Save Word'}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              card.isSaved
                ? 'bg-amber-950/50 border-amber-700/60 text-amber-300 hover:bg-amber-900/60'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-300 hover:border-slate-700'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${card.isSaved ? 'fill-amber-300' : ''}`} />
          </button>

          {onReport && (
            <button
              onClick={() => onReport(item.question)}
              title="Report Question"
              className="p-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-300 hover:border-slate-700 transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onDelete(card.id)}
            title="Delete from Vault"
            className="p-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
