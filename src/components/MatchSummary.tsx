import React, { useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Flame, 
  ArrowRight, 
  Bookmark, 
  Sparkles, 
  RotateCcw, 
  Check, 
  X, 
  ChevronDown,
  Shield,
  HelpCircle
} from 'lucide-react';
import { MatchState, PlayerProfile, Question } from '../types';
import { soundManager } from '../utils/audio';
import { AdSenseUnit } from './AdSenseUnit';
import { ADSENSE_BANNER_SLOT } from '../services/adSenseService';

interface MatchSummaryProps {
  player: PlayerProfile;
  matchState: MatchState;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onBookmarkQuestion: (question: Question) => void;
  onOpenAiDeepDive: (question: Question) => void;
  bookmarkedIds: string[];
  isPremium?: boolean;
}

export const MatchSummary: React.FC<MatchSummaryProps> = ({
  player,
  matchState,
  onPlayAgain,
  onBackToLobby,
  onBookmarkQuestion,
  onOpenAiDeepDive,
  bookmarkedIds,
  isPremium = false,
}) => {
  const isWinner = matchState.playerScore > matchState.opponentScore;
  const isDraw = matchState.playerScore === matchState.opponentScore;

  // LP calculation
  const lpChange = isWinner ? 30 + (matchState.comboStreak > 2 ? 5 : 0) : isDraw ? 5 : -15;

  useEffect(() => {
    if (isWinner) {
      soundManager.playVictory();
    } else {
      soundManager.playWrong();
    }
  }, [isWinner]);

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-8">
      {/* Victory/Defeat Banner */}
      <div
        className={`p-5 rounded-3xl border text-center shadow-xl relative overflow-hidden ${
          isWinner
            ? 'bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-950 border-amber-500/80'
            : isDraw
            ? 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-700'
            : 'bg-gradient-to-b from-rose-950/70 via-slate-900 to-slate-950 border-rose-600/80'
        }`}
      >
        <div className="text-4xl mb-2 animate-bounce">
          {isWinner ? '🏆' : isDraw ? '🤝' : '💔'}
        </div>

        <h2
          className={`text-2xl font-black uppercase tracking-wider ${
            isWinner ? 'text-amber-400' : isDraw ? 'text-slate-200' : 'text-rose-400'
          }`}
        >
          {isWinner ? 'VICTORY!' : isDraw ? 'DRAW MATCH' : 'DEFEAT'}
        </h2>

        <p className="text-xs text-slate-400 mt-0.5">
          {isWinner
            ? 'Splendid Performance! Promoted higher in Govt Cadre.'
            : isDraw
            ? 'Well fought! Both aspirants scored equally.'
            : 'Close fight! Review mistakes below to boost accuracy.'}
        </p>

        {/* Scoreboard Badge */}
        <div className="grid grid-cols-2 gap-3 mt-4 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{player.name} (You)</div>
            <div className="text-2xl font-black text-amber-400 font-mono">{matchState.playerScore}</div>
            <div className="text-[10px] text-emerald-400 font-semibold font-mono">
              {lpChange >= 0 ? `+${lpChange}` : lpChange} LP
            </div>
          </div>

          <div className="text-center border-l border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold uppercase">{matchState.opponent.name}</div>
            <div className="text-2xl font-black text-orange-400 font-mono">{matchState.opponentScore}</div>
            <div className="text-[10px] text-slate-400 font-semibold font-mono">
              {matchState.opponent.tierTitle.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            soundManager.playTap();
            onPlayAgain();
          }}
          className="bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black p-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-xs transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>NEXT MATCH</span>
        </button>

        <button
          onClick={() => {
            soundManager.playTap();
            onBackToLobby();
          }}
          className="bg-slate-800 hover:bg-slate-750 active:scale-[0.98] text-slate-200 font-bold p-3 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 text-xs transition-all"
        >
          <span>LOBBY</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* AdSense / AdMob Banner Slot (Free users only) */}
      {!isPremium && (
        <div className="py-1">
          <AdSenseUnit slotId={ADSENSE_BANNER_SLOT} format="horizontal" isPremium={isPremium} />
        </div>
      )}

      {/* Question-by-Question Detailed Review */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold px-1">
          <span>Match Question Analysis ({matchState.questions.length} Items):</span>
          <span className="text-[11px] text-amber-400">Save to Mistake Vault</span>
        </div>

        <div className="space-y-3">
          {matchState.questions.map((q, idx) => {
            const pAns = matchState.playerAnswers[idx];
            const isPlayerCorrect = pAns?.isCorrect ?? false;
            const isBookmarked = bookmarkedIds.includes(q.id);

            return (
              <div
                key={q.id}
                className="bg-slate-850 border border-slate-750 rounded-2xl p-3.5 space-y-2.5 shadow-md"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isPlayerCorrect ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'
                      }`}
                    >
                      {isPlayerCorrect ? '✓' : '✗'}
                    </span>
                    <span className="font-bold text-slate-200">Q{idx + 1}. {q.wordOrPhrase}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Bookmark Button */}
                    <button
                      onClick={() => {
                        soundManager.playTap();
                        onBookmarkQuestion(q);
                      }}
                      className={`p-1.5 rounded-lg border text-xs transition-colors ${
                        isBookmarked
                          ? 'bg-amber-950 border-amber-600 text-amber-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Save to Mistake Vault"
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Ask AI Button */}
                    <button
                      onClick={() => {
                        soundManager.playTap();
                        onOpenAiDeepDive(q);
                      }}
                      className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 text-xs flex items-center gap-1"
                      title="AI Root Word & Mnemonic Analysis"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">AI Tutor</span>
                    </button>
                  </div>
                </div>

                {/* Correct Answer & Hindi Meaning */}
                <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="text-emerald-400 font-bold shrink-0">Correct Answer:</span>
                    <span className="text-slate-100 font-semibold">{q.options[q.correctIndex]}</span>
                  </div>

                  <div className="text-[11px] text-amber-300/90">
                    <span className="font-semibold text-amber-400">हिन्दी अर्थ: </span>
                    {q.hindiMeaning}
                  </div>

                  <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg mt-1">
                    <span className="font-semibold text-sky-400">💡 Memory Hook: </span>
                    {q.mnemonic}
                  </div>
                </div>

                {/* Exam Occurrences */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                  <span className="font-bold text-amber-400/90">Asked In:</span>
                  {q.examHistory.map((ex, i) => (
                    <span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
