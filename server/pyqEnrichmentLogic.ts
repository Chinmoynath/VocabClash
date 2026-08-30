import { GoogleGenAI } from '@google/genai';

export interface EnrichmentQuestionInput {
  tempId?: string;
  id?: string;
  category: string;
  wordOrPhrase: string;
  question?: string;
  instruction?: string;
  options: string[];
  correctIndex: number | null;
  exam?: string;
  year?: number;
  examHistory?: string[];
  meaning?: string;
  englishMeaning?: string;
  hindiMeaning?: string;
  mnemonic?: string;
  mnemonicHook?: string;
  exampleSentence?: string;
  rootWordInfo?: string;
  rootEtymology?: string;
}

export interface EnrichedOptionDetail {
  option: string;
  englishMeaning: string;
  hindiMeaning: string;
  explanation: string;
  shortExplanation?: string;
  mnemonicHook?: string;
  isCorrect: boolean;
}

export interface EnrichedQuestionOutput {
  tempId: string;
  meaning: string;
  hindiMeaning: string;
  mnemonic: string;
  exampleSentence: string;
  rootWordInfo: string;
  explanation: string;
  enrichmentWarning?: string;
  optionDetails: EnrichedOptionDetail[];
}

export async function processPyqEnrichmentBatch(
  batch: EnrichmentQuestionInput[],
  ai: GoogleGenAI | null
): Promise<EnrichedQuestionOutput[]> {
  const safeBatch = batch.slice(0, 10);

  if (ai) {
    const prompt = `You are a distinguished English Faculty and Senior Vocabulary Master for Indian Govt Examinations (SSC CGL, CHSL, CPO, MTS, CDS, NDA, Banking PO).
Provide high-retention, dictionary-accurate educational enrichment for the following batch of ${safeBatch.length} competitive exam questions.

INPUT QUESTIONS:
${JSON.stringify(
  safeBatch.map(q => ({
    tempId: q.tempId || q.id || 'q_temp',
    category: q.category,
    wordOrPhrase: q.wordOrPhrase,
    question: q.question || q.wordOrPhrase,
    instruction: q.instruction || '',
    options: q.options,
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
    exam: q.exam || 'SSC CGL',
    year: q.year || 2024,
    existingMeaning: q.meaning || q.englishMeaning || '',
    existingHindiMeaning: q.hindiMeaning || '',
    existingMnemonic: q.mnemonic || q.mnemonicHook || '',
    existingExample: q.exampleSentence || '',
    existingRoot: q.rootWordInfo || q.rootEtymology || ''
  })),
  null,
  2
)}

STRICT EDUCATIONAL MANDATE (EVERY SINGLE QUESTION MUST BE FULLY ENRICHED):
1. NEVER leave meaning, hindiMeaning, rootWordInfo, mnemonic, exampleSentence, or optionDetails empty.
2. Word Meaning (Main target word/phrase):
   - "meaning": Accurate, concise English dictionary definition (e.g., "Very attentive to and concerned about accuracy and detail; difficult to please.").
   - "hindiMeaning": 2 to 4 natural Hindi synonyms separated by slashes (e.g., "तुनकमिजाज / जिसे संतुष्ट करना कठिन हो" or "प्रशंसा / स्तुति / गुणगान").
3. Root & Etymology:
   - Provide genuine Latin, Greek, French, or Sanskrit roots, prefixes, and suffixes.
   - Format example: 'Latin fastidium ("loathing, distaste")' or 'Greek panegyrikos (pan "all" + agyris "assembly")' or 'Prefix mal- (bad) + diction (speaking)'.
   - If exact ancient etymology is obscure, provide clear morphological breakdown (prefix/suffix/core meaning) or authentic historical origin. Never leave blank.
4. Mnemonic Hook:
   - Must be high-retention Hinglish/visual hooks tailored for Indian aspirants.
   - Use word-splitting, phonetic rhymes, situational Hindi imagery, or root associations.
   - Good examples:
     * FASTIDIOUS: "Fast + Hideous: Jo fast khana khane walo se chidh jaye aur ultra particular ho."
     * EQUANIMITY: "Equal + Enemy: Dushman ke saamne bhi equanimity (calmness) banaye rakhna."
     * PANEGYRIC: "Pan + Gym: Pan khakar gym jane wale bodybuilders ki sab panegyric (high praise) karte hain."
     * CASTIGATION: "Caste + Gate: Gate par caste ko lekar kisi ko castigate (severely criticize/punish) karna galat hai."
   - STRICTLY BANNED: Generic filler like "Associate this word with...", "Memory hook for X", "Remember this by...".
5. Example Sentence:
   - Natural, high-standard competitive examination usage sentence in quotes (e.g., "The editor is extremely fastidious about grammatical punctuation and formatting.").
6. Exam Rationale ("explanation"):
   - 1 to 2 clear sentences explaining why the correct option is right (Synonym nuance, Antonym direct contrast, OWS fit, or Idiom figurative sense).
7. ALL 4 Options Breakdown ("optionDetails"):
   - EXACTLY 4 items matching input options IN EXACT ORDER.
   - Every single option MUST have:
     * "option": Exact string of option.
     * "englishMeaning": Real dictionary definition of what that option actually means.
     * "hindiMeaning": Real Hindi meaning for that word (e.g., "प्रशंसा", "कठोर आलोचना", "श्रद्धांजलि").
     * "explanation": Why it is the correct answer, or why it differs as a distractor.
     * "mnemonicHook": Optional brief hook.
     * "isCorrect": true if index === correctIndex, else false.

Respond strictly with a JSON array matching this exact structure:
[
  {
    "tempId": "string",
    "meaning": "string",
    "hindiMeaning": "string",
    "rootWordInfo": "string",
    "mnemonic": "string",
    "exampleSentence": "string",
    "explanation": "string",
    "enrichmentWarning": "string (optional)",
    "optionDetails": [
      {
        "option": "string",
        "englishMeaning": "string",
        "hindiMeaning": "string",
        "explanation": "string",
        "mnemonicHook": "string",
        "isCorrect": boolean
      }
    ]
  }
]`;

    const modelCandidates = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const modelName of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '';
        if (responseText) {
          let parsedData: any = null;
          try {
            parsedData = JSON.parse(responseText);
          } catch {
            const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleaned);
          }

          if (Array.isArray(parsedData) && parsedData.length > 0) {
            // Validate and sanitize each item
            return safeBatch.map(q => {
              const qId = q.tempId || q.id || 'q_temp';
              const match = parsedData.find((p: any) => p.tempId === qId);
              const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
              const options = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];

              if (match && match.meaning && match.hindiMeaning) {
                // Ensure optionDetails has 4 items
                let optDetails: EnrichedOptionDetail[] = [];
                if (Array.isArray(match.optionDetails) && match.optionDetails.length === options.length) {
                  optDetails = options.map((opt, idx) => {
                    const od = match.optionDetails[idx] || {};
                    return {
                      option: opt,
                      englishMeaning: od.englishMeaning?.trim() || `Definition of "${opt}"`,
                      hindiMeaning: od.hindiMeaning?.trim() || `अर्थ: "${opt}"`,
                      explanation: od.explanation?.trim() || (idx === correctIdx ? 'Correct Answer' : 'Distractor'),
                      shortExplanation: od.explanation?.trim() || (idx === correctIdx ? 'Correct Answer' : undefined),
                      mnemonicHook: od.mnemonicHook?.trim() || undefined,
                      isCorrect: idx === correctIdx,
                    };
                  });
                } else {
                  optDetails = options.map((opt, idx) => ({
                    option: opt,
                    englishMeaning: idx === correctIdx ? match.meaning : `Meaning of "${opt}"`,
                    hindiMeaning: idx === correctIdx ? match.hindiMeaning : `अर्थ: "${opt}"`,
                    explanation: idx === correctIdx ? 'Correct Answer' : 'Distractor option',
                    shortExplanation: idx === correctIdx ? 'Correct Answer' : undefined,
                    isCorrect: idx === correctIdx,
                  }));
                }

                return {
                  tempId: qId,
                  meaning: match.meaning.trim(),
                  hindiMeaning: match.hindiMeaning.trim(),
                  rootWordInfo: match.rootWordInfo?.trim() || '',
                  mnemonic: match.mnemonic?.trim() || '',
                  exampleSentence: match.exampleSentence?.trim() || '',
                  explanation: match.explanation?.trim() || '',
                  enrichmentWarning: match.enrichmentWarning?.trim() || undefined,
                  optionDetails: optDetails,
                };
              }

              // Fallback for this single item
              return createFallbackOutput(q);
            });
          }
        }
      } catch (err: any) {
        console.warn(`[GEMINI ENRICHMENT] Model ${modelName} attempt failed (${err?.status || err?.message}), checking next...`);
      }
    }
  }

  // Fallback if AI unavailable or offline
  return safeBatch.map(createFallbackOutput);
}

function createFallbackOutput(q: EnrichmentQuestionInput): EnrichedQuestionOutput {
  const qId = q.tempId || q.id || 'q_temp';
  const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const options = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];
  const correctOption = options[correctIdx] || 'Option';
  const targetWord = (q.wordOrPhrase || q.question || '').trim();

  let meaning = q.meaning || q.englishMeaning || '';
  let hindiMeaning = q.hindiMeaning || '';
  let explanation = '';
  let mnemonic = q.mnemonic || q.mnemonicHook || '';
  let rootWordInfo = q.rootWordInfo || q.rootEtymology || '';
  let example = q.exampleSentence || '';

  // Determine root/etymology heuristic if not set
  if (!rootWordInfo) {
    const lowerWord = targetWord.toLowerCase();
    if (lowerWord.startsWith('pan')) {
      rootWordInfo = 'Greek pan- ("all, whole") -> encompassing public assembly or universal scope.';
    } else if (lowerWord.startsWith('castig') || lowerWord.startsWith('chast')) {
      rootWordInfo = 'Latin castigare (castus "pure" + agere "to drive") -> to discipline or severely criticize.';
    } else if (lowerWord.startsWith('bene') || lowerWord.startsWith('bon')) {
      rootWordInfo = 'Latin bene ("well, good") -> expressing kindness or favorable disposition.';
    } else if (lowerWord.startsWith('mal')) {
      rootWordInfo = 'Latin malus ("bad, ill") -> denoting harmful, defective, or hostile state.';
    } else if (lowerWord.startsWith('equ')) {
      rootWordInfo = 'Latin aequus ("even, equal") -> denoting calmness, balance, or fair proportion.';
    } else if (lowerWord.startsWith('fastid')) {
      rootWordInfo = 'Latin fastidium ("loathing, distaste") -> difficult to please; excessively particular.';
    } else if (lowerWord.startsWith('tacit')) {
      rootWordInfo = 'Latin tacere ("to be silent") -> expressing quietness or habitual lack of speech.';
    } else if (lowerWord.startsWith('loqu') || lowerWord.startsWith('locu')) {
      rootWordInfo = 'Latin loqui ("to speak") -> tending to speak fluently or at great length.';
    } else if (lowerWord.startsWith('garrul')) {
      rootWordInfo = 'Latin garrire ("to chatter") -> excessively talkative on trivial matters.';
    } else {
      rootWordInfo = `Classical root structure for "${targetWord}" tested frequently in competitive examinations.`;
    }
  }

  if (!meaning) {
    if (q.category === 'synonyms') {
      meaning = `Accurately denotes the quality or attribute closely matching "${correctOption}".`;
      hindiMeaning = `"${targetWord}" का सटीक भावार्थ एवं समानार्थी शब्द`;
      explanation = `"${correctOption}" is the most accurate synonym representing "${targetWord}".`;
      mnemonic = `Memory Hook: Connect "${targetWord}" directly with "${correctOption}" during exam revision.`;
    } else if (q.category === 'antonyms') {
      meaning = `Expresses a state, action, or quality directly contrasting with "${correctOption}".`;
      hindiMeaning = `"${targetWord}" का यथार्थ विलोमार्थी भाव`;
      explanation = `"${targetWord}" denotes a sense opposite to "${correctOption}", making it the correct antonym.`;
      mnemonic = `Memory Hook: Contrast "${targetWord}" vs "${correctOption}" as opposite states.`;
    } else if (q.category === 'ows') {
      meaning = `One who or that which fits the description: "${q.question || targetWord}".`;
      hindiMeaning = `"${correctOption}" का एक शब्द में सटीक अर्थ`;
      explanation = `Option ${String.fromCharCode(65 + correctIdx)} ("${correctOption}") accurately represents the described concept.`;
      mnemonic = `Memory Hook: Break down the root of "${correctOption}" to recall this substitution easily.`;
    } else {
      meaning = `Figurative meaning: Denotes "${correctOption}".`;
      hindiMeaning = `मुहावरे "${targetWord}" का लाक्षणिक अर्थ`;
      explanation = `The idiom "${targetWord}" is used to express "${correctOption}".`;
      mnemonic = `Memory Hook: Picture the literal situation of "${targetWord}" leading to its figurative sense.`;
    }
  }

  if (!mnemonic) {
    mnemonic = `Memory Hook: Link "${targetWord}" with "${correctOption}" for rapid recall in the exam hall.`;
  }

  if (!example) {
    example = `The official recognized the importance of "${targetWord}" in administrative literature.`;
  }

  const optionDetails: EnrichedOptionDetail[] = options.map((opt, idx) => {
    const isCorrect = idx === correctIdx;
    const cleanOpt = String(opt || '').trim();
    let optEnglish = '';
    let optHindi = '';
    let optExplanation = '';

    if (isCorrect) {
      optEnglish = meaning || `Accurate definition corresponding to "${targetWord}".`;
      optHindi = hindiMeaning || `"${cleanOpt}" का सही अर्थ`;
      optExplanation = `Correct Answer: Accurately satisfies the ${q.category || 'vocabulary'} requirement.`;
    } else {
      optEnglish = `Distinct concept denoting "${cleanOpt}", serving as an exam distractor.`;
      optHindi = `"${cleanOpt}" का स्वतंत्र अर्थ`;
      optExplanation = `Distractor Option: Differs in nuance and does not match the target meaning.`;
    }

    return {
      option: cleanOpt,
      englishMeaning: optEnglish,
      hindiMeaning: optHindi,
      explanation: optExplanation,
      shortExplanation: isCorrect ? 'Correct Option' : undefined,
      mnemonicHook: undefined,
      isCorrect,
    };
  });

  return {
    tempId: qId,
    meaning,
    hindiMeaning,
    rootWordInfo,
    mnemonic,
    exampleSentence: example,
    explanation,
    optionDetails,
  };
}
