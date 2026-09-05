import { QuestionCategory, SavedWord, Question } from '../types';
import { VOCAB_MASTER_EXTENDED, WordEntry } from '../data/vocabMasterData';
import { OWS_MASTER_EXTENDED, OWSEntry } from '../data/owsMasterData';
import { IDIOM_MASTER_EXTENDED, IdiomEntry } from '../data/idiomMasterData';
import { HIGH_YIELD_EXAM_VOCAB, resolveCardEducation } from '../utils/questionEducationResolver';
import { questionBankEngine } from './questionBankEngine';

export interface StoredWordDetail {
  wordOrPhrase: string;
  category: QuestionCategory;
  meaning: string;
  hindiMeaning: string;
  mnemonic: string;
  rootEtymology?: string;
  examTrapTip?: string;
  sampleUsage?: string;
  synonyms?: string[];
  antonyms?: string[];
  options?: string[];
  correctOption?: string;
  examHistory?: string[];
  repeats?: number;
  wrongCount?: number;
}

/**
 * Normalizes text for clean dictionary and question matching
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Resolves full educational and mnemonic details for any word from local stored data
 * (imported question bank, master vocab sets, OWS, idioms, and high-yield dictionaries)
 * without invoking any external API or Gemini calls.
 */
export function getStoredWordDetail(
  wordOrPhrase: string,
  preferredCategory?: QuestionCategory,
  savedWords: SavedWord[] = []
): StoredWordDetail {
  const cleanWord = wordOrPhrase.trim();
  const lowerWord = cleanWord.toLowerCase();
  const normKey = normalizeKey(cleanWord);

  let category: QuestionCategory = preferredCategory || 'synonyms';
  let meaning = '';
  let hindiMeaning = '';
  let mnemonic = '';
  let rootEtymology = '';
  let examTrapTip = '';
  let sampleUsage = '';
  let synonyms: string[] = [];
  let antonyms: string[] = [];
  let options: string[] = [];
  let correctOption = '';
  let examHistory: string[] = [];
  let repeats: number | undefined;
  let wrongCount: number | undefined;

  // 1. Check user's Saved Words / Mistake Vault first
  const matchedSaved = savedWords.find(sw => {
    const q = sw.question;
    if (!q) return false;
    return (
      normalizeKey(q.wordOrPhrase) === normKey ||
      q.wordOrPhrase.toLowerCase().trim() === lowerWord
    );
  });

  if (matchedSaved && matchedSaved.question) {
    const q = matchedSaved.question;
    const edu = resolveCardEducation(q);
    category = (q.category as QuestionCategory) || category;
    meaning = edu.meaning || q.meaning || '';
    hindiMeaning = edu.hindiMeaning || q.hindiMeaning || '';
    mnemonic = edu.mnemonic || q.mnemonic || '';
    rootEtymology = edu.rootWordInfo || q.rootWordInfo || q.explanation || '';
    sampleUsage = edu.exampleSentence || q.exampleSentence || '';
    options = q.options || [];
    correctOption = q.options && q.options[q.correctIndex] ? q.options[q.correctIndex] : '';
    examHistory = q.examHistory || [];
    wrongCount = matchedSaved.mistakeCount;
  }

  // 2. Check questionBankEngine imported and playable pools
  if (!meaning || !mnemonic) {
    try {
      const importedPool = questionBankEngine.getImportedPool();
      const matchedQ = importedPool.find(
        q => normalizeKey(q.wordOrPhrase) === normKey || q.wordOrPhrase.toLowerCase().trim() === lowerWord
      );

      if (matchedQ) {
        const edu = resolveCardEducation(matchedQ);
        category = (matchedQ.category as QuestionCategory) || category;
        if (!meaning) meaning = edu.meaning || matchedQ.meaning || '';
        if (!hindiMeaning) hindiMeaning = edu.hindiMeaning || matchedQ.hindiMeaning || '';
        if (!mnemonic) mnemonic = edu.mnemonic || matchedQ.mnemonic || '';
        if (!rootEtymology) rootEtymology = edu.rootWordInfo || matchedQ.rootWordInfo || matchedQ.explanation || '';
        if (!sampleUsage) sampleUsage = edu.exampleSentence || matchedQ.exampleSentence || '';
        if (options.length === 0) options = matchedQ.options || [];
        if (!correctOption && matchedQ.options) {
          correctOption = matchedQ.options[matchedQ.correctIndex] || '';
        }
        if (examHistory.length === 0) examHistory = matchedQ.examHistory || [];
      }
    } catch {
      // Safe fallback if engine not initialized
    }
  }

  // 3. Check VOCAB_MASTER_EXTENDED
  const vocabMasterMatch: WordEntry | undefined = VOCAB_MASTER_EXTENDED.find(
    v => normalizeKey(v.word) === normKey || v.word.toLowerCase() === lowerWord
  );

  if (vocabMasterMatch) {
    if (!meaning) meaning = vocabMasterMatch.meaning;
    if (!hindiMeaning) hindiMeaning = vocabMasterMatch.hindi;
    if (!mnemonic) mnemonic = vocabMasterMatch.mnemonic;
    if (!rootEtymology) rootEtymology = vocabMasterMatch.root;
    if (!sampleUsage) sampleUsage = vocabMasterMatch.example;
    if (synonyms.length === 0 && vocabMasterMatch.synonyms) synonyms = [...vocabMasterMatch.synonyms];
    if (antonyms.length === 0 && vocabMasterMatch.antonyms) antonyms = [...vocabMasterMatch.antonyms];
    if (!repeats) repeats = vocabMasterMatch.repeats;
  }

  // 4. Check HIGH_YIELD_EXAM_VOCAB
  const highYieldMatch = HIGH_YIELD_EXAM_VOCAB[lowerWord] || HIGH_YIELD_EXAM_VOCAB[cleanWord.toUpperCase()];
  if (highYieldMatch) {
    if (!meaning) meaning = highYieldMatch.english;
    if (!hindiMeaning) hindiMeaning = highYieldMatch.hindi;
    if (!mnemonic) mnemonic = highYieldMatch.mnemonic;
    if (!rootEtymology && highYieldMatch.root) rootEtymology = highYieldMatch.root;
    if (!sampleUsage && highYieldMatch.example) sampleUsage = highYieldMatch.example;
  }

  // 5. Check OWS_MASTER_EXTENDED if relevant or category is ows
  if (!meaning || category === 'ows') {
    const owsMatch: OWSEntry | undefined = OWS_MASTER_EXTENDED.find(
      o => normalizeKey(o.answer) === normKey || o.answer.toLowerCase() === lowerWord ||
           normalizeKey(o.phrase).includes(normKey)
    );
    if (owsMatch) {
      category = 'ows';
      if (!meaning) meaning = owsMatch.phrase || owsMatch.meaning;
      if (!hindiMeaning) hindiMeaning = owsMatch.hindi;
      if (!mnemonic) mnemonic = owsMatch.mnemonic;
      if (!sampleUsage) sampleUsage = owsMatch.example;
      if (!repeats) repeats = owsMatch.repeats;
    }
  }

  // 6. Check IDIOM_MASTER_EXTENDED if relevant or category is idioms
  if (!meaning || category === 'idioms') {
    const idiomMatch: IdiomEntry | undefined = IDIOM_MASTER_EXTENDED.find(
      i => normalizeKey(i.idiom) === normKey || i.idiom.toLowerCase() === lowerWord ||
           normKey.includes(normalizeKey(i.idiom))
    );
    if (idiomMatch) {
      category = 'idioms';
      if (!meaning) meaning = idiomMatch.meaning;
      if (!hindiMeaning) hindiMeaning = idiomMatch.hindi;
      if (!mnemonic) mnemonic = idiomMatch.origin || idiomMatch.meaning;
      if (!sampleUsage) sampleUsage = idiomMatch.example;
      if (!repeats) repeats = idiomMatch.repeats;
    }
  }

  // 7. Fallback: Run resolveCardEducation on a synthetic Question to ensure 100% field coverage
  if (!meaning || !hindiMeaning || !mnemonic) {
    const syntheticQ: Question = {
      id: `synthetic-${normKey}`,
      wordOrPhrase: cleanWord.toUpperCase(),
      category: category,
      question: `What is the meaning of "${cleanWord.toUpperCase()}"?`,
      options: [cleanWord, 'Incorrect alternative', 'Second alternative', 'Third alternative'],
      correctIndex: 0,
      meaning: meaning || '',
      hindiMeaning: hindiMeaning || '',
      mnemonic: mnemonic || '',
      exampleSentence: sampleUsage || '',
      explanation: rootEtymology || '',
      difficulty: 'medium',
      importanceLevel: 'high',
      repeatCount: repeats || 1,
      examHistory: ['Govt Exam PYQ'],
    };

    const resolved = resolveCardEducation(syntheticQ);
    if (!meaning) meaning = resolved.meaning;
    if (!hindiMeaning) hindiMeaning = resolved.hindiMeaning;
    if (!mnemonic) mnemonic = resolved.mnemonic;
    if (!rootEtymology && resolved.rootWordInfo) rootEtymology = resolved.rootWordInfo;
    if (!sampleUsage && resolved.exampleSentence) sampleUsage = resolved.exampleSentence;
  }

  // 8. Exam Trap Tip
  if (!examTrapTip) {
    if (category === 'synonyms') {
      examTrapTip = `Examiners frequently place tempting near-synonyms or antonyms as trap options for "${cleanWord.toUpperCase()}". Always check the exact contextual nuance.`;
    } else if (category === 'antonyms') {
      examTrapTip = `Common Trap: Aspirants often pick a synonym in an antonym question by rushing. Ensure you select the exact opposite for "${cleanWord.toUpperCase()}".`;
    } else if (category === 'ows') {
      examTrapTip = `Pay close attention to subtle root suffixes (-ist, -phile, -phobe, -cide) to avoid confusing closely related OWS choices.`;
    } else if (category === 'idioms') {
      examTrapTip = `Beware of literal word interpretations. Idioms tested in SSC exams always demand their figurative, real-world context.`;
    } else {
      examTrapTip = `Verify the part of speech (noun vs. adjective vs. verb) before confirming your choice in high-stakes papers.`;
    }
  }

  return {
    wordOrPhrase: cleanWord.toUpperCase(),
    category,
    meaning: meaning || `Meaning and contextual definition of ${cleanWord.toUpperCase()}`,
    hindiMeaning: hindiMeaning || `${cleanWord.toUpperCase()} का हिन्दी शब्दार्थ`,
    mnemonic: mnemonic || `Memory Trick: Break down "${cleanWord.toUpperCase()}" to anchor it with its core meaning in the exam hall.`,
    rootEtymology: rootEtymology || undefined,
    examTrapTip,
    sampleUsage: sampleUsage || `The word "${cleanWord.toUpperCase()}" frequently features in Tier-1 and Tier-2 examination shifts.`,
    synonyms: synonyms.length > 0 ? synonyms : undefined,
    antonyms: antonyms.length > 0 ? antonyms : undefined,
    options: options.length > 0 ? options : undefined,
    correctOption: correctOption || undefined,
    examHistory: examHistory.length > 0 ? examHistory : undefined,
    repeats,
    wrongCount,
  };
}
