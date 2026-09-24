import React, { useState } from 'react';
import { X, Save, AlertTriangle, BookOpen, Sparkles, UploadCloud, RefreshCw } from 'lucide-react';
import { Question } from '../types';
import { normalizeText } from '../services/pyqQualityValidator';
import { enrichSingleQuestion } from '../services/pyqEnrichmentService';

interface AdminQuestionEditModalProps {
  question: Question;
  onSave: (updatedFields: Partial<Question>, pushDirectly?: boolean) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export const AdminQuestionEditModal: React.FC<AdminQuestionEditModalProps> = ({
  question,
  onSave,
  onClose,
  isSaving,
}) => {
  const [wordOrPhrase, setWordOrPhrase] = useState<string>(question.wordOrPhrase || '');
  const [instruction, setInstruction] = useState<string>(
    question.instruction || `Select the most appropriate ${question.category.toUpperCase()} of the given word:`
  );
  const [options, setOptions] = useState<string[]>([
    question.options[0] || '',
    question.options[1] || '',
    question.options[2] || '',
    question.options[3] || '',
  ]);
  const [correctIndex, setCorrectIndex] = useState<number>(
    typeof question.correctIndex === 'number' && question.correctIndex >= 0 && question.correctIndex < 4
      ? question.correctIndex
      : 0
  );
  const [meaning, setMeaning] = useState<string>(question.meaning || '');
  const [hindiMeaning, setHindiMeaning] = useState<string>(question.hindiMeaning || '');
  const [explanation, setExplanation] = useState<string>(question.explanation || '');
  const [mnemonic, setMnemonic] = useState<string>(question.mnemonic || '');
  const [exampleSentence, setExampleSentence] = useState<string>(question.exampleSentence || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichSuccess, setEnrichSuccess] = useState<string | null>(null);

  const handleOptionChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = val;
    setOptions(next);
  };

  const handleAutoEnrich = async () => {
    try {
      setIsEnriching(true);
      setValidationError(null);
      setEnrichSuccess(null);

      const draftQuestion = {
        ...question,
        wordOrPhrase: wordOrPhrase.trim() || question.wordOrPhrase,
        options,
        correctIndex,
        instruction,
      };

      const enriched = await enrichSingleQuestion(draftQuestion as any, true);

      if (enriched.meaning) setMeaning(enriched.meaning);
      if (enriched.hindiMeaning) setHindiMeaning(enriched.hindiMeaning);
      if (enriched.explanation) setExplanation(enriched.explanation);
      if (enriched.mnemonic) setMnemonic(enriched.mnemonic);
      if (enriched.exampleSentence) setExampleSentence(enriched.exampleSentence);

      setEnrichSuccess('✨ Auto-enrichment successful! Meanings, Hindi definition, and rationale populated.');
    } catch (err: any) {
      setValidationError(`Enrichment error: ${err?.message || 'Could not enrich with AI'}`);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, pushDirectly: boolean = false) => {
    e.preventDefault();
    setValidationError(null);

    if (!wordOrPhrase.trim()) {
      setValidationError('Target Word/Phrase cannot be empty.');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      setValidationError('All 4 options must be non-empty.');
      return;
    }

    // Check for target equals option in synonyms/antonyms/idioms
    const normTarget = normalizeText(wordOrPhrase);
    const cat = question.category.toLowerCase();
    if (cat === 'synonyms' || cat === 'antonyms' || cat === 'idioms') {
      const matchIdx = options.findIndex(opt => normalizeText(opt) === normTarget);
      if (matchIdx !== -1) {
        setValidationError(`Target word "${wordOrPhrase}" cannot appear as Option ${String.fromCharCode(65 + matchIdx)} in ${question.category.toUpperCase()}.`);
        return;
      }
    }

    // Check for duplicate options
    const normOpts = options.map(o => normalizeText(o));
    const unique = new Set(normOpts);
    if (unique.size !== 4) {
      setValidationError('All 4 options must be distinct. Duplicate options detected.');
      return;
    }

    await onSave({
      wordOrPhrase: wordOrPhrase.trim(),
      instruction: instruction.trim(),
      options: options.map(o => o.trim()),
      correctIndex,
      meaning: meaning.trim(),
      hindiMeaning: hindiMeaning.trim(),
      explanation: explanation.trim(),
      mnemonic: mnemonic.trim(),
      exampleSentence: exampleSentence.trim(),
    }, pushDirectly);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto space-y-4 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                Safe Question Edit
              </span>
              <button
                type="button"
                onClick={handleAutoEnrich}
                disabled={isEnriching}
                className="px-2.5 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-full flex items-center gap-1.5 shadow transition disabled:opacity-50"
                title="Automatically generate English/Hindi meanings, explanation, and mnemonics using AI"
              >
                {isEnriching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>{isEnriching ? 'Enriching with AI...' : 'Auto-Enrich with AI'}</span>
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Edit PYQ Record ({question.category.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-400">
              Preserves Question ID (<code className="text-slate-300 font-mono">{question.id}</code>), appearances & exam tags.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {enrichSuccess && (
          <div className="p-3 bg-purple-950/60 border border-purple-800/80 rounded-xl text-purple-200 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{enrichSuccess}</span>
          </div>
        )}

        {validationError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-sm">
          {/* Instruction */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instruction / Prompt
            </label>
            <input
              type="text"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Word or Phrase */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Target Word / Phrase / Idiom <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={wordOrPhrase}
              onChange={e => setWordOrPhrase(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              required
            />
          </div>

          {/* 4 Options & Correct Answer Radio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Options (Select radio button for Correct Answer) <span className="text-rose-400">*</span>
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => {
                const label = String.fromCharCode(65 + idx);
                const isSelected = correctIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-600/80'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="correctIndex"
                        checked={isSelected}
                        onChange={() => setCorrectIndex(idx)}
                        className="w-4 h-4 text-emerald-500 accent-emerald-500"
                      />
                      <span className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {label}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${label}`}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meanings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                English Meaning / Definition
              </label>
              <textarea
                value={meaning}
                onChange={e => setMeaning(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hindi Meaning
              </label>
              <textarea
                value={hindiMeaning}
                onChange={e => setHindiMeaning(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Explanation / Rationale
            </label>
            <textarea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Mnemonic & Example */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mnemonic / Memory Trick (Optional)
              </label>
              <input
                type="text"
                value={mnemonic}
                onChange={e => setMnemonic(e.target.value)}
                placeholder="e.g. Abhor = hear horror..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Example Sentence (Optional)
              </label>
              <input
                type="text"
                value={exampleSentence}
                onChange={e => setExampleSentence(e.target.value)}
                placeholder="e.g. He abhors all forms of cruelty."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-600 transition-all"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Save Locally</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSaving}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Pushing to Firestore...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Save & Push to Firestore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
