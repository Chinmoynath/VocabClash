import { GoogleGenAI, Type } from '@google/genai';

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
  enrichment?: {
    status: 'complete' | 'partial' | 'failed';
    version: string;
    enrichedAt?: number;
    provider?: string;
    warnings?: string;
  };
}

/**
 * Robust JSON extraction helper that handles markdown code blocks,
 * trailing text/brackets after JSON, and individual object fallback.
 */
function extractJsonArray(raw: string): any[] | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Direct JSON parse
  try {
    const direct = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === 'object') {
      for (const val of Object.values(direct)) {
        if (Array.isArray(val)) return val as any[];
      }
    }
  } catch {}

  // 2. Strip code fences
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const cleanedParsed = JSON.parse(cleaned);
    if (Array.isArray(cleanedParsed)) return cleanedParsed;
    if (cleanedParsed && typeof cleanedParsed === 'object') {
      for (const val of Object.values(cleanedParsed)) {
        if (Array.isArray(val)) return val as any[];
      }
    }
  } catch {}

  // 3. Balanced bracket extraction: find the FIRST '[' and scan until bracket depth reaches 0
  const firstBracket = cleaned.indexOf('[');
  if (firstBracket !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstBracket; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) {
            const candidate = cleaned.slice(firstBracket, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (Array.isArray(parsed)) return parsed;
            } catch {
              try {
                const sanitized = candidate.replace(/,\s*([\]}])/g, '$1');
                const parsed = JSON.parse(sanitized);
                if (Array.isArray(parsed)) return parsed;
              } catch {}
            }
            break;
          }
        }
      }
    }
  }

  // 4. Substring between first '[' and last ']'
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arraySubstring = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsedSlice = JSON.parse(arraySubstring);
      if (Array.isArray(parsedSlice)) return parsedSlice;
    } catch {}

    try {
      const sanitized = arraySubstring.replace(/,\s*([\]}])/g, '$1');
      const sanitizedParsed = JSON.parse(sanitized);
      if (Array.isArray(sanitizedParsed)) return sanitizedParsed;
    } catch {}
  }

  // 5. Individual object extraction fallback: extract each top-level {...}
  const extractedObjects: any[] = [];
  let braceDepth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (ch === '{') {
        if (braceDepth === 0) objStart = i;
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
        if (braceDepth === 0 && objStart !== -1) {
          const objCandidate = cleaned.slice(objStart, i + 1);
          try {
            const parsedObj = JSON.parse(objCandidate);
            if (parsedObj && typeof parsedObj === 'object') {
              extractedObjects.push(parsedObj);
            }
          } catch {
            try {
              const sanitizedObj = objCandidate.replace(/,\s*([\]}])/g, '$1');
              const parsedObj = JSON.parse(sanitizedObj);
              if (parsedObj && typeof parsedObj === 'object') {
                extractedObjects.push(parsedObj);
              }
            } catch {}
          }
          objStart = -1;
        }
      }
    }
  }

  if (extractedObjects.length > 0) {
    return extractedObjects;
  }

  return null;
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
   - "meaning": Format explicitly pairing the word and definition: "<targetWord> – <Accurate, concise English dictionary definition>". For synonym or antonym questions where the correct answer option has a distinctive dictionary meaning, also include it: e.g., "puritanical – having or displaying excessively strict moral or religious views. | prudish (synonym) – excessively proper or easily shocked by matters relating to modesty."
   - "hindiMeaning": Format with word name: "<targetWord>: 2 to 4 natural Hindi synonyms. / <correctOption>: Hindi meaning."
3. Root & Etymology:
   - Provide genuine Latin, Greek, French, or Sanskrit roots, prefixes, and suffixes.
   - Format example: 'Latin fastidium ("loathing, distaste")' or 'Greek panegyrikos (pan "all" + agyris "assembly")'.
4. Mnemonic Hook:
   - Must be high-retention Hinglish/visual hooks tailored for Indian aspirants (e.g., "Fast + Hideous: Jo fast khana khane walo se chidh jaye aur ultra particular ho.").
5. Example Sentence:
   - Natural, high-standard competitive examination usage sentence in quotes.
6. Exam Rationale ("explanation"):
   - 1 to 2 clear sentences explaining why the correct option is right.
7. ALL 4 Options Breakdown ("optionDetails"):
   - EXACTLY 4 items matching input options IN EXACT ORDER.
   - Every single option MUST have:
     * "option": Exact string of option.
     * "englishMeaning": Real dictionary definition of what that option actually means.
     * "hindiMeaning": Real Hindi meaning for that word.
     * "explanation": Why it is the correct answer, or why it differs as a distractor.
     * "mnemonicHook": Optional brief hook.
     * "isCorrect": true if index === correctIndex, else false.

Respond strictly with a JSON array.`;

    // Candidate models ordered for maximum availability, low latency, and reliability
    const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.8-flash'];
    
    for (const modelName of modelCandidates) {
      let succeeded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
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
            const parsedData = extractJsonArray(responseText);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
              // Validate and sanitize each item
              succeeded = true;
              return safeBatch.map((q, qIndex) => {
                const qId = q.tempId || q.id || 'q_temp';
                const match = parsedData.find((p: any) => p && (p.tempId === qId || p.id === qId))
                  || parsedData.find((p: any) => p && p.wordOrPhrase && q.wordOrPhrase && String(p.wordOrPhrase).toLowerCase().trim() === String(q.wordOrPhrase).toLowerCase().trim())
                  || (parsedData[qIndex] && typeof parsedData[qIndex] === 'object' ? parsedData[qIndex] : null);
                const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
                const options = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];

                if (match && (match.meaning || match.englishMeaning || match.hindiMeaning)) {
                  const resolvedMeaning = match.meaning?.trim() || match.englishMeaning?.trim() || `Definition of ${q.wordOrPhrase}`;
                  const resolvedHindi = match.hindiMeaning?.trim() || `"${q.wordOrPhrase}" का भावार्थ`;

                  // Ensure optionDetails has 4 items
                  let optDetails: EnrichedOptionDetail[] = [];
                  if (Array.isArray(match.optionDetails) && match.optionDetails.length === options.length) {
                    optDetails = options.map((opt, idx) => {
                      const od = match.optionDetails[idx] || {};
                      return {
                        option: opt,
                        englishMeaning: od.englishMeaning?.trim() || (idx === correctIdx ? resolvedMeaning : `Definition of "${opt}"`),
                        hindiMeaning: od.hindiMeaning?.trim() || (idx === correctIdx ? resolvedHindi : `अर्थ: "${opt}"`),
                        explanation: od.explanation?.trim() || (idx === correctIdx ? 'Correct Answer' : 'Distractor'),
                        shortExplanation: od.explanation?.trim() || (idx === correctIdx ? 'Correct Answer' : undefined),
                        mnemonicHook: od.mnemonicHook?.trim() || undefined,
                        isCorrect: idx === correctIdx,
                      };
                    });
                  } else {
                    optDetails = options.map((opt, idx) => ({
                      option: opt,
                      englishMeaning: idx === correctIdx ? resolvedMeaning : `Meaning of "${opt}"`,
                      hindiMeaning: idx === correctIdx ? resolvedHindi : `अर्थ: "${opt}"`,
                      explanation: idx === correctIdx ? 'Correct Answer' : 'Distractor option',
                      shortExplanation: idx === correctIdx ? 'Correct Answer' : undefined,
                      isCorrect: idx === correctIdx,
                    }));
                  }

                  return {
                    tempId: qId,
                    meaning: resolvedMeaning,
                    hindiMeaning: resolvedHindi,
                    rootWordInfo: match.rootWordInfo?.trim() || match.rootEtymology?.trim() || '',
                    mnemonic: match.mnemonic?.trim() || match.mnemonicHook?.trim() || '',
                    exampleSentence: match.exampleSentence?.trim() || '',
                    explanation: match.explanation?.trim() || '',
                    enrichmentWarning: match.enrichmentWarning?.trim() || undefined,
                    optionDetails: optDetails,
                    enrichment: {
                      status: 'complete',
                      version: 'learning-v1',
                      enrichedAt: Date.now(),
                      provider: 'gemini-ai',
                    },
                  };
                }

                // Fallback for this single item
                return createFallbackOutput(q);
              });
            }
          }
        } catch (err: any) {
          const isTransient = err?.status === 503 || err?.status === 429 || err?.message?.includes('503') || err?.message?.includes('429');
          if (attempt === 1 && isTransient) {
            const delay = 1000 + Math.floor(Math.random() * 600);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          console.warn(`[GEMINI ENRICHMENT] Model ${modelName} attempt ${attempt} notice (${err?.status || err?.message || 'Unavailable'}).`);
          break;
        }
      }
      if (succeeded) break;
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
    enrichmentWarning: 'AI service temporarily unavailable; generated fallback template.',
    enrichment: {
      status: 'partial',
      version: 'learning-fallback-v1',
      enrichedAt: Date.now(),
      provider: 'contextual_fallback',
      warnings: 'AI service temporarily unavailable; generated fallback template.',
    },
  };
}
