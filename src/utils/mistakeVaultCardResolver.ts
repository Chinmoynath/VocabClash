import { Question, SavedWord, QuestionCategory, QuestionOptionDetail } from '../types';
import { lookupMasterEntry } from './questionEducationResolver';
import { OWS_MASTER_EXTENDED } from '../data/owsMasterData';
import { IDIOM_MASTER_EXTENDED } from '../data/idiomMasterData';
import { isItemSaved, isItemMistake } from './vaultManager';

export interface RevisionPyqOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
  meaning?: string;
}

/**
 * Normalized Mistake Vault Revision Object
 * Guaranteed clean, non-duplicative, and strictly mapped by category.
 */
export interface NormalizedMistakeVaultItem {
  id: string;
  category: QuestionCategory;
  categoryDisplay: 'Synonym' | 'Antonym' | 'One Word' | 'Idiom' | 'Vocabulary';
  relation: 'SYNONYM →' | 'ANTONYM →' | 'ONE WORD →' | 'MEANING →' | 'ANSWER →' | 'CORRECT ANSWER →';

  // Card Status
  mistakeCount: number;
  isMistake: boolean;
  isSaved: boolean;

  // Target Definition & Translations (tested vocabulary concept)
  target: string;
  targetSublabel?: string;
  targetMeaning?: string;
  targetHindiMeaning?: string;
  isSituationBased?: boolean;

  // Recall Prompt
  prompt: string;

  // Correct Answer Definition & Translations (never duplicates target meaning)
  answer: string;
  answerMeaning?: string;
  answerHindiMeaning?: string;

  // Memory Hook
  mnemonic: string;

  // Source & Repetitions
  source: string;
  repeatCount: number;
  shouldShowRepeat: boolean;

  // Collapsible Original PYQ Data
  originalQuestion: string;
  originalOptions: RevisionPyqOption[];
  correctIndex: number;
  optionDetails?: QuestionOptionDetail[];

  // Compatibility aliases
  targetWord: string;
  targetDisplay: string;
  targetHindi?: string;
  relationLabel: 'SYNONYM →' | 'ANTONYM →' | 'ONE WORD →' | 'MEANING →' | 'ANSWER →' | 'CORRECT ANSWER →';
  correctAnswer: string;
  correctMeaning: string;
  correctHindi?: string;
  sourceExam: string;
  questionPrompt: string;
  options: RevisionPyqOption[];
}

export type CleanRevisionCard = NormalizedMistakeVaultItem;

/**
 * Strips duplicate repeated strings, redundant category tags, and punctuation artifacts.
 */
export function cleanEnrichmentText(rawText: string, wordsToStrip: string[] = []): string {
  if (!rawText) return '';

  let text = String(rawText).trim();

  // 1. Remove redundant category annotations in parentheses
  text = text.replace(/\((?:synonym|antonym|samanarthi|vilomarthi|समानार्थी|विलोमार्थी|one word|idiom|meaning|definition)[^)]*\)/gi, ' ');

  // 2. Remove leading bullet symbols, dashes, colons
  text = text.replace(/^[•·\-\*–—:]+\s*/, '');

  // 3. Remove known word prefixes if they appear at the very beginning (e.g. "fertile: ")
  for (const w of wordsToStrip) {
    if (!w) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i');
    text = text.replace(prefixRegex, '').trim();
  }

  // 4. Also remove generic headers like "Meaning:", "Definition:", "Target Word:"
  text = text.replace(/^(?:target\s*word|word|meaning|definition|correct\s*meaning|answer)\s*[-–—:]\s*/i, '').trim();

  // 5. Deduplicate identical adjacent chunks separated by bullets, newlines, or dots
  const segments = text.split(/(?:\r?\n|\s*[•·|]\s*)/).map(s => s.trim()).filter(Boolean);
  const uniqueSegments: string[] = [];
  for (const seg of segments) {
    const cleanSeg = seg.replace(/^[•·\-\*–—:]+\s*/, '').trim();
    if (!cleanSeg) continue;
    const isDuplicate = uniqueSegments.some(
      u => u.toLowerCase() === cleanSeg.toLowerCase() ||
           (cleanSeg.length > 15 && u.toLowerCase().includes(cleanSeg.toLowerCase())) ||
           (u.length > 15 && cleanSeg.toLowerCase().includes(u.toLowerCase()))
    );
    if (!isDuplicate) {
      uniqueSegments.push(cleanSeg);
    }
  }

  text = uniqueSegments.join('; ');

  // 6. Fix repeated words inside text (e.g. "Productive Productive")
  text = text.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // 7. Clean whitespace and trailing punctuation
  text = text.replace(/\s+/g, ' ').replace(/\s*([,;])\s*$/, '').trim();

  return text;
}

/**
 * Normalizes Hindi translations by removing English prefixes, repetitive fragments, and extraneous tags.
 */
export function cleanHindiText(rawHindi: string, wordsToStrip: string[] = []): string {
  if (!rawHindi) return '';

  let text = String(rawHindi).trim();

  // 1. Remove category and English annotations
  text = text.replace(/\((?:synonym|antonym|samanarthi|vilomarthi|समानार्थी|विलोमार्थी|one word|idiom|meaning|definition)[^)]*\)/gi, ' ');
  text = text.replace(/^[•·\-\*–—:]+\s*/, '');

  // 2. Remove English prefixes
  for (const w of wordsToStrip) {
    if (!w) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i');
    text = text.replace(prefixRegex, '').trim();
  }

  // 3. Remove Hindi generic labels
  text = text.replace(/^(?:हिन्दी|भावार्थ|अर्थ|शब्दार्थ|सटीक\s*अर्थ)\s*[-–—:]\s*/i, '').trim();

  // 4. Deduplicate segments separated by bullets, slashes, or newlines
  const parts = text.split(/(?:\r?\n|\s*[•·|]\s*)/).map(s => s.trim()).filter(Boolean);
  const cleanParts: string[] = [];
  for (const p of parts) {
    const cp = p.replace(/^[•·\-\*–—:]+\s*/, '').trim();
    if (!cp) continue;
    if (!cleanParts.some(x => x === cp || x.includes(cp))) {
      cleanParts.push(cp);
    }
  }

  text = cleanParts.join(' / ');

  // 5. Deduplicate slashes and trailing full stops/dandas
  text = text.replace(/\s*\/\s*\/\s*/g, ' / ').replace(/\s*।\s*$/, '').trim();

  return text;
}

/**
 * Formats a clean 1-2 line mnemonic hook.
 */
export function cleanMnemonic(rawMnemonic: string): string {
  if (!rawMnemonic) return '';

  let text = String(rawMnemonic).trim();
  text = text.replace(/^(?:💡\s*)?(?:memory\s*hook|memory\s*hack|trick|mnemonic|hook|origin\s*hook)\s*[-–—:]\s*/i, '').trim();
  text = text.replace(/^(?:💡\s*)?(?:memory\s*hook|memory\s*hack|trick|mnemonic|hook)\s*[-–—:]\s*/i, '').trim();
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Common stop words to ignore when isolating the tested word in a sentence.
 */
const SENTENCE_STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by',
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
  'should', 'now', 'know', 'truth', 'sentence', 'given', 'word', 'words', 'appropriate',
  'most', 'select', 'choose', 'find', 'marked', 'underlined', 'meaning', 'opposite', 'similar',
  'group', 'option', 'phrase', 'bracketed', 'highlighted', 'italicized', 'capitalized', 'substitute',
  'question', 'following', 'stated', 'context', 'alternative', 'blank', 'fill'
]);

/**
 * PROBLEM 1: Extracts the pure TARGET WORD for Synonyms and Antonyms.
 * Strictly prevents sentences or instruction blocks from becoming card titles.
 */
export function extractSynonymAntonymTarget(question: Question, rawCorrect: string): string {
  // 1. Structured candidate fields from question metadata
  const candidateFields = [
    (question as any).targetWord,
    (question as any).underlinedWord,
    (question as any).testedWord,
    (question as any).word,
    (question as any).term,
  ];

  for (const cand of candidateFields) {
    if (typeof cand === 'string' && cand.trim()) {
      const clean = cand.replace(/^["'“]+|["'”]+$/g, '').trim();
      if (clean.length >= 2 && clean.length <= 35 && !/[.?!\n]/.test(clean)) {
        return clean.toUpperCase();
      }
    }
  }

  // Check conceptKey (e.g. "synonyms_astonished" or "antonyms_succumb" or "astonished")
  if (typeof question.conceptKey === 'string' && question.conceptKey.trim()) {
    const key = question.conceptKey.trim();
    const parts = key.split('_').filter(p => p && !['synonyms', 'antonyms', 'ows', 'idioms'].includes(p.toLowerCase()));
    if (parts.length > 0) {
      const derived = parts.join(' ').trim();
      if (derived.length >= 2 && derived.length <= 35) {
        return derived.toUpperCase();
      }
    }
  }

  // 2. Inspect question.wordOrPhrase
  const rawWordOrPhrase = String(question.wordOrPhrase || '').trim();
  const isInstructionLike = /^(?:select|choose|find|identify|in the following|which of|what is|give the|the sentence|read the)\b/i.test(rawWordOrPhrase);

  // If wordOrPhrase is short, has no sentence termination, and doesn't start with instruction words:
  if (rawWordOrPhrase && !isInstructionLike && rawWordOrPhrase.length <= 35 && !/[.?!\n]/.test(rawWordOrPhrase) && rawWordOrPhrase.split(/\s+/).length <= 3) {
    return rawWordOrPhrase.replace(/^["'“]+|["'”]+$/g, '').toUpperCase();
  }

  // 3. Fallback: Parse the sentence or question text to isolate the targeted word
  const fullText = `${rawWordOrPhrase} ${question.question || ''} ${question.instruction || ''}`.trim();

  // Pattern A: HTML/Markdown markup: <u>WORD</u>, <b>WORD</b>, *WORD*, _WORD_, [WORD], "WORD", 'WORD'
  const markupPatterns = [
    /<u>([A-Za-z\s\-]{2,30})<\/u>/i,
    /<b>([A-Za-z\s\-]{2,30})<\/b>/i,
    /\[([A-Za-z\s\-]{2,30})\]/,
    /\*([A-Za-z\s\-]{2,30})\*/,
    /_([A-Za-z\s\-]{2,30})_/,
    /["'“‘]([A-Za-z\s\-]{2,30})["'”’]/,
  ];

  for (const pattern of markupPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const lower = candidate.toLowerCase();
      if (!SENTENCE_STOP_WORDS.has(lower) && !/^(?:synonym|antonym|word|phrase|sentence|option)$/i.test(lower)) {
        return candidate.toUpperCase();
      }
    }
  }

  // Pattern B: Explicit descriptive markers in sentence
  const explicitMarkerPatterns = [
    /underlined\s+(?:word|phrase)\s*[:\-\s]+['"“]?([A-Za-z\-]{2,30})['"”]?/i,
    /bracketed\s+(?:word|phrase)\s*[:\-\s]+['"“]?([A-Za-z\-]{2,30})['"”]?/i,
    /highlighted\s+(?:word|phrase)\s*[:\-\s]+['"“]?([A-Za-z\-]{2,30})['"”]?/i,
    /given\s+(?:word|phrase)\s*[:\-\s]+['"“]?([A-Za-z\-]{2,30})['"”]?/i,
    /(?:synonym|antonym)\s+of\s+(?:the\s+)?(?:underlined\s+)?(?:word\s+)?['"“]?([A-Za-z\-]{2,30})['"”]?/i,
    /(?:synonym|antonym)\s+for\s+['"“]?([A-Za-z\-]{2,30})['"”]?/i,
  ];

  for (const pattern of explicitMarkerPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const cand = match[1].trim();
      if (!SENTENCE_STOP_WORDS.has(cand.toLowerCase())) {
        return cand.toUpperCase();
      }
    }
  }

  // Pattern C: Strip instruction sentence, isolate remaining sentence words and check against dictionary
  let strippedSentence = fullText
    .replace(/^select\s+the\s+(?:most\s+appropriate\s+)?(?:synonym|antonym)\s+of\s+the\s+underlined\s+word\.?\s*/i, '')
    .replace(/^select\s+the\s+(?:most\s+appropriate\s+)?(?:synonym|antonym)[^.]*\.?\s*/i, '')
    .replace(/^in\s+the\s+following\s+question[^.]*\.?\s*/i, '')
    .replace(/^choose\s+the\s+(?:word|synonym|antonym)[^.]*\.?\s*/i, '')
    .replace(/^identify\s+the\s+(?:synonym|antonym)[^.]*\.?\s*/i, '')
    .trim();

  // Clean punctuation
  const wordsInSentence = strippedSentence
    .replace(/[^a-zA-Z\s\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  // Check if any word in the sentence matches a known dictionary entry
  for (const w of wordsInSentence) {
    const lower = w.toLowerCase();
    if (SENTENCE_STOP_WORDS.has(lower)) continue;
    if (lower === rawCorrect.toLowerCase()) continue; // don't pick the answer itself

    const master = lookupMasterEntry(w);
    if (master) {
      return w.toUpperCase();
    }
  }

  // Check non-stop words with highest length in the sentence
  const filteredCandidates = wordsInSentence.filter(w => {
    const lower = w.toLowerCase();
    return !SENTENCE_STOP_WORDS.has(lower) && lower !== rawCorrect.toLowerCase() && w.length >= 4;
  });

  if (filteredCandidates.length > 0) {
    // Pick the longest non-stop word (typically the vocabulary term)
    filteredCandidates.sort((a, b) => b.length - a.length);
    return filteredCandidates[0].toUpperCase();
  }

  return rawWordOrPhrase ? rawWordOrPhrase.replace(/^["'“]+|["'”]+$/g, '').slice(0, 30).toUpperCase() : 'VOCABULARY WORD';
}

/**
 * PROBLEM 2: Strips generic instructional text from One Word Substitution definitions.
 * Leaves ONLY the core prompt/phrase to recall.
 */
export function cleanOwsPhrase(rawPrompt: string): string {
  if (!rawPrompt) return 'Given phrase';

  let cleaned = String(rawPrompt).trim();

  // Strip generic instruction prefixes
  cleaned = cleaned.replace(/^select\s+the\s+option\s+that\s+can\s+be\s+used\s+as\s+a\s+one-word\s+substitute\s+for\s+the\s+(?:given|underlined)?\s+group\s+of\s+words\.?\s*:?/i, '');
  cleaned = cleaned.replace(/^select\s+the\s+(?:most\s+appropriate\s+)?one-word\s+substitut(?:e|ion)\s+for\s+the\s+(?:given|underlined)?\s+(?:group\s+of\s+words|phrase)\.?\s*:?/i, '');
  cleaned = cleaned.replace(/^choose\s+the\s+correct\s+one\s+word\s+for\s+the\s+(?:given|underlined)?\s+(?:group\s+of\s+words|phrase)\.?\s*:?/i, '');
  cleaned = cleaned.replace(/^select\s+the\s+one-word\s+substitute\s+for:?\s*/i, '');
  cleaned = cleaned.replace(/^in\s+the\s+following\s+question[^.]*best\s+substitute\s+of\s+the\s+phrase\.?\s*:?/i, '');
  cleaned = cleaned.replace(/^give\s+(?:the\s+)?one\s+word\s+substitute\s+for:?\s*/i, '');
  cleaned = cleaned.replace(/^which\s+of\s+the\s+following\s+is\s+a\s+one-word\s+substitute\s+for:?\s*/i, '');
  cleaned = cleaned.replace(/^one\s+word\s+substitute\s+for:?\s*/i, '');
  cleaned = cleaned.replace(/^what\s+is\s+a\s+one\s+word\s+for:?\s*/i, '');
  cleaned = cleaned.replace(/^a\s+substitute\s+for\s+the\s+phrase:?\s*/i, '');

  // Strip surrounding quotes
  cleaned = cleaned.replace(/^["'“]+|["'”]+$/g, '').trim();

  // If first letter is lowercase and was after an instruction, capitalize
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || 'Group of words definition';
}

/**
 * PROBLEM 4: Detects situation-based idiom questions and extracts a clean scenario.
 */
export function isSituationBasedIdiom(question: Question, targetText: string): boolean {
  const combined = `${question.question || ''} ${question.instruction || ''} ${targetText}`.toLowerCase();
  return (
    combined.includes('situation') ||
    combined.includes('context') ||
    combined.includes('fits the given') ||
    combined.includes('fits this situation') ||
    (targetText.length > 80 && targetText.split(/\s+/).length > 12)
  );
}

/**
 * Normalizes and builds a single authoritative Mistake Vault Revision object.
 * Strictly separates TARGET and ANSWER information.
 */
export function buildMistakeVaultRevisionItem(question: Question, item?: SavedWord): NormalizedMistakeVaultItem {
  const category = question.category || 'synonyms';
  const isSynonym = category === 'synonyms';
  const isAntonym = category === 'antonyms';
  const isOWS = category === 'ows';
  const isIdiom = category === 'idioms';

  // 1. Resolve Correct Answer text
  const correctIdx = typeof question.correctIndex === 'number' && question.correctIndex >= 0
    ? question.correctIndex
    : 0;

  let rawCorrect = '';
  if (Array.isArray(question.options) && question.options[correctIdx]) {
    rawCorrect = String(question.options[correctIdx]).replace(/^["'“]+|["'”]+$/g, '').trim();
  } else if ((question as any).answer) {
    rawCorrect = String((question as any).answer).replace(/^["'“]+|["'”]+$/g, '').trim();
  } else if ((question as any).correctAnswer) {
    rawCorrect = String((question as any).correctAnswer).replace(/^["'“]+|["'”]+$/g, '').trim();
  } else {
    rawCorrect = 'CORRECT OPTION';
  }

  // Clean option labels like "(A) ", "A. " if embedded in answer text
  rawCorrect = rawCorrect.replace(/^(?:\([A-Da-d]\)|[A-Da-d][.)]|Option\s+[A-Da-d]:?)\s*/i, '').trim();

  // 2. Resolve Category Display and Relation Label
  let categoryDisplay: NormalizedMistakeVaultItem['categoryDisplay'] = 'Vocabulary';
  let relation: NormalizedMistakeVaultItem['relation'] = 'CORRECT ANSWER →';
  let defaultPrompt = 'What is the correct answer?';

  if (isSynonym) {
    categoryDisplay = 'Synonym';
    relation = 'SYNONYM →';
    defaultPrompt = 'What is the synonym?';
  } else if (isAntonym) {
    categoryDisplay = 'Antonym';
    relation = 'ANTONYM →';
    defaultPrompt = 'What is the antonym?';
  } else if (isOWS) {
    categoryDisplay = 'One Word';
    relation = 'ONE WORD →';
    defaultPrompt = 'Find the one-word substitute';
  } else if (isIdiom) {
    categoryDisplay = 'Idiom';
    relation = 'MEANING →';
    defaultPrompt = 'What is the meaning of this idiom?';
  }

  // 3. TARGET RESOLUTION (Problems 1, 2, 4)
  let target = '';
  let targetSublabel: string | undefined = undefined;
  let targetMeaning = '';
  let targetHindiMeaning = '';
  let isSituation = false;
  let prompt = defaultPrompt;

  if (isSynonym || isAntonym) {
    // Problem 1: CARD TITLE = TARGET WORD
    target = extractSynonymAntonymTarget(question, rawCorrect);
    targetSublabel = undefined; // No extra sublabel needed when title is clean tested word
  } else if (isOWS) {
    // Problem 2: Recall prompt is ONLY the definition / phrase
    const rawOwsPrompt = question.wordOrPhrase || question.question || question.instruction || '';
    target = cleanOwsPhrase(rawOwsPrompt);
    targetSublabel = 'Definition / Phrase';
    prompt = 'Think of the word:';
  } else if (isIdiom) {
    // Problem 4: Check if situation-based or standard idiom
    const rawIdiomText = question.wordOrPhrase || question.question || '';
    if (isSituationBasedIdiom(question, rawIdiomText)) {
      isSituation = true;
      target = 'IDIOM PYQ';
      targetSublabel = 'Situation Based';
      relation = 'ANSWER →';
      prompt = 'What idiom fits this situation?';

      // Clean the situation scenario
      let situationText = rawIdiomText
        .replace(/^select\s+the\s+(?:most\s+appropriate\s+)?idiom\s+for\s+the\s+given\s+situation\.?\s*:?/i, '')
        .replace(/^which\s+of\s+the\s+following\s+idioms\s+fits\s+the\s+given\s+situation\.?\s*:?/i, '')
        .replace(/^["'“]+|["'”]+$/g, '')
        .trim();
      targetMeaning = situationText;
    } else {
      // Standard idiom where the idiom itself is tested
      let cleanIdiom = rawIdiomText
        .replace(/^select\s+the\s+(?:most\s+appropriate\s+)?meaning\s+of\s+(?:the\s+)?(?:given\s+)?(?:underlined\s+)?idiom\.?\s*:?/i, '')
        .replace(/^what\s+does\s+['"“]?([^'"”]+)['"”]?\s+mean\??/i, '$1')
        .replace(/^meaning\s+of\s+(?:the\s+)?idiom:?\s*/i, '')
        .replace(/^["'“]+|["'”]+$/g, '')
        .trim();
      target = cleanIdiom.toUpperCase();
      targetSublabel = 'Idiom';
      relation = 'MEANING →';
      prompt = 'What does this idiom mean?';
    }
  }

  // 4. TARGET MEANING RESOLUTION (Problems 2 & 3)
  // Master lookups
  const targetMaster = (isSynonym || isAntonym) ? lookupMasterEntry(target) : null;
  const correctMaster = lookupMasterEntry(rawCorrect);

  let owsMasterMatch: any = null;
  if (isOWS) {
    owsMasterMatch = OWS_MASTER_EXTENDED.find(
      o => o.answer.toLowerCase() === rawCorrect.toLowerCase() ||
           o.phrase.toLowerCase() === target.toLowerCase() ||
           o.phrase.toLowerCase().includes(target.toLowerCase().slice(0, 25)) ||
           target.toLowerCase().includes(o.phrase.toLowerCase().slice(0, 25))
    );
  }

  let idiomMasterMatch: any = null;
  if (isIdiom) {
    idiomMasterMatch = IDIOM_MASTER_EXTENDED.find(
      idm => idm.idiom.toLowerCase() === target.toLowerCase() ||
             idm.idiom.toLowerCase() === rawCorrect.toLowerCase() ||
             target.toLowerCase().includes(idm.idiom.toLowerCase())
    );
  }

  if (isSynonym || isAntonym) {
    // Separate TARGET meaning: strictly describe TARGET
    if (targetMaster?.english) {
      targetMeaning = targetMaster.english;
    }
    if (targetMaster?.hindi) {
      targetHindiMeaning = targetMaster.hindi;
    }

    // If master entry missing, inspect question.meaning (checking for multi-line or clean target line)
    if (!targetMeaning && question.meaning) {
      const splitLines = question.meaning.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+|\s*\|\s*)/);
      const firstLine = splitLines[0]?.trim() || '';

      // Validate that firstLine describes target and does NOT describe rawCorrect
      const describesAnswer = rawCorrect && firstLine.toLowerCase().startsWith(rawCorrect.toLowerCase());
      if (!describesAnswer && firstLine.length > 3) {
        targetMeaning = firstLine;
      }
    }

    if (!targetHindiMeaning && question.hindiMeaning) {
      const splitHindi = question.hindiMeaning.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+|\s*\|\s*)/);
      const firstHindi = splitHindi[0]?.trim() || '';
      const describesAnswerHindi = rawCorrect && firstHindi.toLowerCase().startsWith(rawCorrect.toLowerCase());
      if (!describesAnswerHindi && firstHindi.length > 1) {
        targetHindiMeaning = firstHindi;
      }
    }
  } else if (isOWS) {
    // For OWS, target IS the phrase/definition, so do NOT duplicate in targetMeaning!
    targetMeaning = '';
    targetHindiMeaning = owsMasterMatch?.hindi || '';
  }

  // 5. ANSWER MEANING RESOLUTION (Problem 3: Strict Separation)
  // Preference 1: Option Details matching correct answer
  let answerMeaning = '';
  let answerHindiMeaning = '';

  const optionDetailsList = Array.isArray(question.optionDetails) ? question.optionDetails : [];
  const correctOptDetail = optionDetailsList[correctIdx] ||
    optionDetailsList.find(od => od && od.option && od.option.trim().toLowerCase() === rawCorrect.toLowerCase());

  if (correctOptDetail) {
    const odEng = (correctOptDetail.englishMeaning || (correctOptDetail as any).meaning || '').trim();
    // Verify odEng does not erroneously describe the target word instead of the answer
    const repeatsTarget = target && odEng.toLowerCase().startsWith(target.toLowerCase()) && odEng.length > target.length + 5;
    if (odEng && !repeatsTarget) {
      answerMeaning = odEng;
    }

    const odHin = (correctOptDetail.hindiMeaning || '').trim();
    if (odHin) {
      answerHindiMeaning = odHin;
    }
  }

  // Preference 2: Master lookups for Answer
  if (isOWS) {
    if (!answerMeaning && owsMasterMatch) {
      answerMeaning = owsMasterMatch.meaning || owsMasterMatch.phrase;
    }
    if (!answerHindiMeaning && owsMasterMatch) {
      answerHindiMeaning = owsMasterMatch.hindi;
    }
  } else if (isIdiom) {
    if (isSituation && idiomMasterMatch) {
      if (!answerMeaning) answerMeaning = idiomMasterMatch.meaning;
      if (!answerHindiMeaning) answerHindiMeaning = idiomMasterMatch.hindi;
    } else if (!isSituation) {
      // For standard idiom, answer is the definition itself
      // We don't need a redundant duplicate answerMeaning
      answerMeaning = '';
    }
  }

  if (!answerMeaning && correctMaster?.english) {
    answerMeaning = correctMaster.english;
  }
  if (!answerHindiMeaning && correctMaster?.hindi) {
    answerHindiMeaning = correctMaster.hindi;
  }

  // Preference 3: Multi-line question.meaning line 2 (which describes the correct answer)
  if (!answerMeaning && question.meaning) {
    const splitLines = question.meaning.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+|\s*\|\s*)/);
    if (splitLines.length > 1) {
      const secondLine = splitLines[1].trim();
      answerMeaning = secondLine;
    }
  }

  if (!answerHindiMeaning && question.hindiMeaning) {
    const splitHindi = question.hindiMeaning.split(/(?:\r?\n\s*[•·\-\*]\s*|\s+[•·]\s+|\s*\|\s*)/);
    if (splitHindi.length > 1) {
      answerHindiMeaning = splitHindi[1].trim();
    }
  }

  // CRITICAL ANTI-COLLISION CHECK (Problem 3)
  // Never reuse target meaning inside the answer box!
  if (answerMeaning && targetMeaning && answerMeaning.toLowerCase() === targetMeaning.toLowerCase()) {
    answerMeaning = '';
  }
  if (answerMeaning && target && answerMeaning.toLowerCase().startsWith(`${target.toLowerCase()} means`)) {
    answerMeaning = '';
  }

  // Clean strings
  targetMeaning = cleanEnrichmentText(targetMeaning, [target, rawCorrect]);
  targetHindiMeaning = cleanHindiText(targetHindiMeaning, [target, rawCorrect]);

  answerMeaning = cleanEnrichmentText(answerMeaning, [rawCorrect, target]);
  answerHindiMeaning = cleanHindiText(answerHindiMeaning, [rawCorrect, target]);

  // 6. MEMORY HOOK RESOLUTION
  let mnemonic = '';
  if (question.mnemonic && question.mnemonic.length > 3) {
    mnemonic = cleanMnemonic(question.mnemonic);
  } else if (owsMasterMatch?.mnemonic) {
    mnemonic = cleanMnemonic(owsMasterMatch.mnemonic);
  } else if (idiomMasterMatch?.origin) {
    mnemonic = cleanMnemonic(idiomMasterMatch.origin);
  } else if (targetMaster?.mnemonic) {
    mnemonic = cleanMnemonic(targetMaster.mnemonic);
  } else if (correctMaster?.mnemonic) {
    mnemonic = cleanMnemonic(correctMaster.mnemonic);
  } else if (correctOptDetail?.mnemonicHook) {
    mnemonic = cleanMnemonic(correctOptDetail.mnemonicHook);
  }

  if (!mnemonic) {
    if (isSynonym) {
      mnemonic = `${target} → link with ${rawCorrect} for instant recall in the exam.`;
    } else if (isAntonym) {
      mnemonic = `${target} = contrasting pole to ${rawCorrect}.`;
    } else if (isOWS) {
      mnemonic = `Break down "${rawCorrect}" to cement its connection with this definition.`;
    } else if (isIdiom) {
      mnemonic = `Visualize the literal action in "${rawCorrect || target}" to remember the meaning.`;
    } else {
      mnemonic = `Associate "${target}" with "${rawCorrect}".`;
    }
  }

  // 7. SOURCE EXAM & STATS
  const examParts: string[] = [];
  if (question.exam && question.exam.trim()) examParts.push(question.exam.trim());
  if (question.year) examParts.push(String(question.year).trim());
  if (question.tier && question.tier.trim() && question.tier !== '-' && question.tier !== 'null') {
    examParts.push(question.tier.trim());
  }

  const sourceExam = examParts.join(' • ') || 'Govt Exam PYQ';
  const repeatCount = typeof question.repeatCount === 'number' ? question.repeatCount : 0;
  const shouldShowRepeat = repeatCount > 1;

  // 8. ORIGINAL PYQ OPTIONS (for collapsible section)
  const alphabet = ['A', 'B', 'C', 'D'] as const;
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const options: RevisionPyqOption[] = rawOptions.slice(0, 4).map((opt, idx) => {
    const isThisCorrect = idx === correctIdx;
    const optDetail = Array.isArray(question.optionDetails) && question.optionDetails[idx];
    const optMeaning = optDetail ? (optDetail.englishMeaning || (optDetail as any).meaning || undefined) : undefined;
    return {
      label: alphabet[idx] || 'A',
      text: String(opt || '').trim(),
      isCorrect: isThisCorrect,
      meaning: optMeaning ? cleanEnrichmentText(optMeaning, [String(opt)]) : undefined,
    };
  });

  const originalQuestion = question.question || question.instruction || `Select the most appropriate option:`;

  // 9. Status metadata
  const mistakeCount = item?.mistakeCount || 1;
  const isMistake = item ? isItemMistake(item) : true;
  const isSaved = item ? isItemSaved(item) : false;

  return {
    id: question.id,
    category,
    categoryDisplay,
    relation,
    mistakeCount,
    isMistake,
    isSaved,

    // Target
    target,
    targetSublabel,
    targetMeaning: targetMeaning || undefined,
    targetHindiMeaning: targetHindiMeaning || undefined,
    isSituationBased: isSituation,

    // Prompt
    prompt,

    // Answer
    answer: rawCorrect,
    answerMeaning: answerMeaning || undefined,
    answerHindiMeaning: answerHindiMeaning || undefined,

    // Memory Hook
    mnemonic,

    // Source & Stats
    source: sourceExam,
    repeatCount,
    shouldShowRepeat,

    // Collapsible Original PYQ Data
    originalQuestion,
    originalOptions: options,
    correctIndex: correctIdx,
    optionDetails: question.optionDetails,

    // Backward compatibility aliases
    targetWord: target,
    targetDisplay: target,
    targetHindi: targetHindiMeaning || undefined,
    relationLabel: relation,
    correctAnswer: rawCorrect,
    correctMeaning: answerMeaning || '',
    correctHindi: answerHindiMeaning || undefined,
    sourceExam,
    questionPrompt: originalQuestion,
    options,
  };
}

/**
 * Backward compatibility alias for resolveRevisionCard
 */
export const resolveRevisionCard = buildMistakeVaultRevisionItem;
