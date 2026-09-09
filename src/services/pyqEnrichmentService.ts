import { Question, QuestionOptionDetail } from '../types';
import { ExtractedQuestion } from '../types/pyqImport';
import { backfillBatchEnrichments, fetchPublishedQuestionBank } from './pyqFirestoreService';
import { questionBankEngine } from './questionBankEngine';
import { resolveCardEducation, lookupMasterEntry } from '../utils/questionEducationResolver';

export interface EnrichmentProgress {
  current: number;
  total: number;
  stage: string;
}

/**
 * Detects whether a question contains robotic or placeholder fallback content
 * rather than rich, authentic Gemini AI educational vocabulary details.
 */
export function isFallbackEnrichment(q: Partial<ExtractedQuestion | Question> | null | undefined): boolean {
  if (!q) return false;
  if (q.enrichment?.provider === 'contextual_fallback' || q.enrichment?.version?.includes('fallback')) return true;
  if (q.enrichmentWarning?.toLowerCase().includes('fallback') || q.enrichmentWarning?.toLowerCase().includes('placeholder')) return true;

  const m = q.meaning || '';
  const h = q.hindiMeaning || '';
  const ex = q.exampleSentence || '';
  const root = q.rootWordInfo || '';
  const mn = q.mnemonic || '';

  // Generic fallback meanings
  if (
    m.includes('Accurately denotes the quality or attribute') ||
    m.includes('Expresses a state, action, or quality directly contrasting') ||
    m.includes('One who or that which fits the description:') ||
    m.includes('Figurative meaning: A common idiomatic phrase') ||
    m.includes('Accurately corresponds to') ||
    (m.includes('denoting "') && m.includes('serving as an exam distractor'))
  ) {
    return true;
  }

  // Generic fallback examples
  if (
    ex.includes('The official recognized the importance of') ||
    ex.includes('appeared in standard examination practice') ||
    ex.includes('appeared in administrative literature')
  ) {
    return true;
  }

  // Generic fallback roots
  if (
    root.includes('Classical root structure for') ||
    (root.includes('Root structure for') && root.includes('tested frequently'))
  ) {
    return true;
  }

  // Generic fallback mnemonics
  if (
    mn.includes('during exam revision') ||
    mn.includes('in daily usage') ||
    mn.includes('for rapid recall in the exam hall') ||
    mn.includes('as two opposite states')
  ) {
    return true;
  }

  // Generic fallback Hindi translations
  if (
    h.includes('का सटीक भावार्थ एवं समानार्थी शब्द') ||
    h.includes('का यथार्थ विलोमार्थी भाव') ||
    h.includes('का एक शब्द में सटीक अर्थ') ||
    h.includes('का लाक्षणिक अर्थ') ||
    h.includes('का स्वतंत्र अर्थ')
  ) {
    return true;
  }

  // Generic fallback optionDetails
  if (Array.isArray(q.optionDetails)) {
    const hasDistractorTemplate = q.optionDetails.some(od => {
      const eng = od.englishMeaning || '';
      const hin = od.hindiMeaning || '';
      return (
        eng.includes('serving as an exam distractor') ||
        eng.includes('serving as a distractor option') ||
        eng.includes('Distinct concept denoting') ||
        eng.includes('Accurately denotes the quality or attribute') ||
        hin.includes('का स्वतंत्र अर्थ') ||
        hin.includes('का सटीक भावार्थ एवं समानार्थी शब्द')
      );
    });
    if (hasDistractorTemplate) return true;
  }

  return false;
}

/**
 * Checks whether a question is missing critical educational enrichment fields
 * or only has robotic template fallbacks that need real AI enrichment.
 */
export function needsEnrichment(q: ExtractedQuestion | Question): boolean {
  if (!q.meaning || q.meaning.trim() === '') return true;
  if (!q.hindiMeaning || q.hindiMeaning.trim() === '') return true;
  if (!q.rootWordInfo || q.rootWordInfo.trim() === '') return true;
  if (!q.mnemonic || q.mnemonic.trim() === '') return true;
  if (!q.exampleSentence || q.exampleSentence.trim() === '') return true;
  if (!q.optionDetails || !Array.isArray(q.optionDetails) || q.optionDetails.length !== 4) return true;

  // If question is using robotic template fallback, it needs real AI enrichment
  if (isFallbackEnrichment(q)) return true;
  
  // Check if option details are empty or placeholder
  const hasIncompleteOptions = q.optionDetails.some(
    od => !od.englishMeaning || 
          od.englishMeaning.trim() === '' ||
          od.englishMeaning.toLowerCase().includes('vocabulary meaning') || 
          !od.hindiMeaning ||
          od.hindiMeaning.trim() === '' ||
          od.hindiMeaning.startsWith('अर्थ: "')
  );
  if (hasIncompleteOptions) return true;

  return false;
}

/**
 * Checks if enrichment is fully complete and high-quality
 */
export function isEnrichmentComplete(q: ExtractedQuestion | Question): boolean {
  return !needsEnrichment(q);
}

/**
 * Merges enriched fields into the original question while strictly protecting authoritative exam fields
 */
export function mergeEnrichment(
  original: ExtractedQuestion,
  enriched: Partial<ExtractedQuestion>
): ExtractedQuestion {
  // Normalize option details to match original 4 options exactly
  let finalOptionDetails: QuestionOptionDetail[] | undefined = original.optionDetails;

  if (Array.isArray(enriched.optionDetails) && enriched.optionDetails.length === 4) {
    finalOptionDetails = original.options.map((origOpt, idx) => {
      const incoming = enriched.optionDetails?.[idx];
      const isCorrect = idx === original.correctIndex;
      const masterLookup = lookupMasterEntry(origOpt);
      const fallbackEnglish = masterLookup?.english || (isCorrect && enriched.meaning ? enriched.meaning : `Exam concept: "${origOpt}"`);
      const fallbackHindi = masterLookup?.hindi || (isCorrect && enriched.hindiMeaning ? enriched.hindiMeaning : `"${origOpt}" का अर्थ`);
      return {
        option: origOpt,
        englishMeaning: incoming?.englishMeaning?.trim() || fallbackEnglish,
        hindiMeaning: incoming?.hindiMeaning?.trim() || fallbackHindi,
        explanation: incoming?.explanation?.trim() || incoming?.shortExplanation?.trim() || (isCorrect ? 'Correct Answer' : 'Distractor option'),
        shortExplanation: incoming?.shortExplanation?.trim() || (isCorrect ? 'Correct Answer' : undefined),
        mnemonicHook: incoming?.mnemonicHook?.trim() || masterLookup?.mnemonic || undefined,
        isCorrect,
      };
    });
  }

  const isFallback = isFallbackEnrichment(enriched) || (!enriched.meaning && isFallbackEnrichment(original));

  return {
    ...original,
    // Strictly preserve authoritative question facts
    tempId: original.tempId,
    question: original.question,
    wordOrPhrase: original.wordOrPhrase,
    options: original.options,
    correctIndex: original.correctIndex,
    category: original.category,
    examFamily: original.examFamily,
    exam: original.exam,
    year: original.year,
    tier: original.tier,
    shift: original.shift,
    questionNumber: original.questionNumber,
    paper: original.paper,
    reviewStatus: original.reviewStatus,
    duplicateConfidence: original.duplicateConfidence,
    duplicateOfId: original.duplicateOfId,
    duplicateOfQuestion: original.duplicateOfQuestion,
    sourceType: original.sourceType,
    sourceFileName: original.sourceFileName,
    pageNumber: original.pageNumber,
    rawText: original.rawText,

    // Merge educational fields with fallback to original
    instruction: original.instruction || enriched.instruction,
    meaning: enriched.meaning?.trim() || original.meaning || '',
    hindiMeaning: enriched.hindiMeaning?.trim() || original.hindiMeaning || '',
    mnemonic: enriched.mnemonic?.trim() || original.mnemonic || '',
    exampleSentence: enriched.exampleSentence?.trim() || original.exampleSentence || '',
    rootWordInfo: enriched.rootWordInfo?.trim() || original.rootWordInfo || '',
    explanation: enriched.explanation?.trim() || original.explanation || '',
    optionDetails: finalOptionDetails,
    enrichment: {
      status: (!isFallback && enriched.meaning && enriched.hindiMeaning && finalOptionDetails) ? 'complete' : 'partial',
      version: isFallback ? 'learning-fallback-v1' : 'learning-v1',
      enrichedAt: Date.now(),
      provider: enriched.enrichment?.provider || (isFallback ? 'contextual_fallback' : 'gemini-ai'),
      warnings: isFallback ? 'Template fallback generated. Real AI re-enrichment recommended.' : undefined,
    },
    enrichmentWarning: isFallback ? 'Template Fallback (Needs AI)' : (enriched.enrichmentWarning || original.enrichmentWarning),
  };
}

/**
 * Enriches a batch of extracted questions using the server Gemini endpoint
 */
export async function enrichQuestionBatch(
  questions: ExtractedQuestion[],
  onProgress?: (progress: EnrichmentProgress) => void,
  force: boolean = false
): Promise<{
  enrichedQuestions: ExtractedQuestion[];
  successCount: number;
  failedCount: number;
}> {
  console.log(`[PYQ ENRICHMENT] ${questions.length} questions received (force=${force})`);

  const incompleteQuestions = force ? questions : questions.filter(q => needsEnrichment(q));
  const completeQuestions = force ? [] : questions.filter(q => !needsEnrichment(q));

  console.log(`[PYQ ENRICHMENT] ${incompleteQuestions.length} require enrichment (${completeQuestions.length} already complete)`);

  if (incompleteQuestions.length === 0) {
    if (onProgress) {
      onProgress({
        current: questions.length,
        total: questions.length,
        stage: 'All questions already fully enriched with AI!',
      });
    }
    console.log('[PYQ ENRICHMENT] Ready to publish');
    return {
      enrichedQuestions: questions,
      successCount: questions.length,
      failedCount: 0,
    };
  }

  const enrichedMap = new Map<string, ExtractedQuestion>();
  // Pre-fill complete questions into result map
  for (const q of completeQuestions) {
    enrichedMap.set(q.tempId, q);
  }

  let successCount = completeQuestions.length;
  let failedCount = 0;

  const totalToEnrich = incompleteQuestions.length;
  const CHUNK_SIZE = 3; // 3 items per chunk is ideal for ultra-reliable LLM JSON generation without token cutoff
  const totalChunks = Math.ceil(totalToEnrich / CHUNK_SIZE);

  for (let i = 0; i < incompleteQuestions.length; i += CHUNK_SIZE) {
    const chunk = incompleteQuestions.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

    console.log(`[PYQ ENRICHMENT] Sending Gemini batch ${chunkIndex} of ${totalChunks} (${chunk.length} questions)`);

    if (onProgress) {
      onProgress({
        current: Math.min(completeQuestions.length + i + chunk.length, questions.length),
        total: questions.length,
        stage: `✨ Generating AI educational vocabulary… ${Math.min(completeQuestions.length + i + chunk.length, questions.length)} / ${questions.length} complete`,
      });
    }

    try {
      const response = await fetch('/api/gemini/enrich-pyq-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: chunk.map(q => {
            const isFallback = isFallbackEnrichment(q);
            return {
              tempId: q.tempId,
              id: q.tempId,
              category: q.category,
              wordOrPhrase: q.wordOrPhrase,
              question: q.question,
              instruction: q.instruction,
              options: q.options,
              correctIndex: q.correctIndex,
              exam: q.exam,
              year: q.year,
              // Strip robotic placeholder text so Gemini generates fresh, authentic explanations
              meaning: isFallback ? '' : (q.meaning || ''),
              englishMeaning: isFallback ? '' : (q.meaning || ''),
              hindiMeaning: isFallback ? '' : (q.hindiMeaning || ''),
              mnemonic: isFallback ? '' : (q.mnemonic || ''),
              exampleSentence: isFallback ? '' : (q.exampleSentence || ''),
              rootWordInfo: isFallback ? '' : (q.rootWordInfo || ''),
            };
          }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const enrichedArray: any[] = Array.isArray(data.enrichedQuestions) ? data.enrichedQuestions : [];

      console.log(`[PYQ ENRICHMENT] Received enriched batch ${chunkIndex} (${enrichedArray.length} items)`);

      for (let cIdx = 0; cIdx < chunk.length; cIdx++) {
        const orig = chunk[cIdx];
        const matchingEnriched = enrichedArray.find((e: any) => e && (e.tempId === orig.tempId || e.id === orig.tempId))
          || enrichedArray.find((e: any) => e && e.wordOrPhrase && orig.wordOrPhrase && e.wordOrPhrase.toLowerCase().trim() === orig.wordOrPhrase.toLowerCase().trim())
          || enrichedArray[cIdx];

        if (matchingEnriched && (matchingEnriched.meaning || matchingEnriched.hindiMeaning)) {
          const merged = mergeEnrichment(orig, matchingEnriched);
          enrichedMap.set(orig.tempId, merged);
          successCount++;
        } else {
          // Fallback with contextual templates so it's never blank
          const fallback = generateContextualFallback(orig);
          enrichedMap.set(orig.tempId, mergeEnrichment(orig, fallback));
          successCount++;
        }
      }
    } catch (err) {
      console.warn(`[PYQ ENRICHMENT] Error enriching batch ${chunkIndex}, using contextual fallback:`, err);
      for (const orig of chunk) {
        const fallback = generateContextualFallback(orig);
        enrichedMap.set(orig.tempId, mergeEnrichment(orig, fallback));
        failedCount++;
      }
    }

    // Small delay between batches to respect rate limits
    if (i + CHUNK_SIZE < incompleteQuestions.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log('[PYQ ENRICHMENT] Ready to publish');

  if (onProgress) {
    onProgress({
      current: questions.length,
      total: questions.length,
      stage: '✨ AI enrichment complete and ready to publish!',
    });
  }

  // Preserve original ordering
  const finalOrderedQuestions = questions.map(q => enrichedMap.get(q.tempId) || q);

  return {
    enrichedQuestions: finalOrderedQuestions,
    successCount,
    failedCount,
  };
}

/**
 * Enriches a single question with Gemini AI (defaults to force=true to bypass previous template fallbacks)
 */
export async function enrichSingleQuestion(
  question: ExtractedQuestion,
  force: boolean = true
): Promise<ExtractedQuestion> {
  const { enrichedQuestions } = await enrichQuestionBatch([question], undefined, force);
  return enrichedQuestions[0] || question;
}

/**
 * Backfill & enrich an array of published Questions, updating both Firestore and local engine
 */
export async function enrichFirestoreQuestions(
  questions: Question[],
  onProgress?: (progress: EnrichmentProgress) => void
): Promise<{ updatedCount: number; failedCount: number }> {
  const toEnrich = questions.filter(needsEnrichment);
  if (toEnrich.length === 0) {
    return { updatedCount: 0, failedCount: 0 };
  }

  // Convert to ExtractedQuestion format for the enrichment pipeline
  const extractedFormat: ExtractedQuestion[] = toEnrich.map(q => ({
    tempId: q.id,
    question: q.question || q.wordOrPhrase,
    wordOrPhrase: q.wordOrPhrase,
    options: q.options,
    correctIndex: q.correctIndex,
    category: q.category,
    examFamily: q.examFamily || 'SSC',
    exam: q.exam || (q.examHistory?.[0] || 'SSC CGL'),
    year: q.year || 2023,
    tier: q.tier,
    shift: q.shift,
    questionNumber: q.questionNumber,
    instruction: q.instruction,
    meaning: q.meaning,
    hindiMeaning: q.hindiMeaning,
    mnemonic: q.mnemonic,
    exampleSentence: q.exampleSentence,
    rootWordInfo: q.rootWordInfo,
    explanation: q.explanation,
    optionDetails: q.optionDetails,
    reviewStatus: 'approved',
    sourceType: 'verified_pyq',
  }));

  const { enrichedQuestions } = await enrichQuestionBatch(
    extractedFormat,
    onProgress,
    true
  );

  // Prepare updates for Firestore
  const updates = enrichedQuestions.map(eq => ({
    id: eq.tempId,
    fields: {
      meaning: eq.meaning,
      hindiMeaning: eq.hindiMeaning,
      mnemonic: eq.mnemonic,
      exampleSentence: eq.exampleSentence,
      rootWordInfo: eq.rootWordInfo,
      explanation: eq.explanation,
      optionDetails: eq.optionDetails,
      enrichment: eq.enrichment,
      enrichmentWarning: eq.enrichmentWarning,
    },
  }));

  if (onProgress) {
    onProgress({
      current: enrichedQuestions.length,
      total: enrichedQuestions.length,
      stage: `Persisting ${updates.length} enrichments to Firestore question_bank...`,
    });
  }

  // Persist to Firestore
  const firestoreRes = await backfillBatchEnrichments(updates);

  // Update local runtime QuestionBankEngine
  const updatedQuestionsMap = new Map(enrichedQuestions.map(eq => [eq.tempId, eq]));
  const fullUpdatedQuestions: Question[] = questions.map(orig => {
    const enriched = updatedQuestionsMap.get(orig.id);
    if (!enriched) return orig;
    return {
      ...orig,
      meaning: enriched.meaning || orig.meaning,
      hindiMeaning: enriched.hindiMeaning || orig.hindiMeaning,
      mnemonic: enriched.mnemonic || orig.mnemonic,
      exampleSentence: enriched.exampleSentence || orig.exampleSentence,
      rootWordInfo: enriched.rootWordInfo || orig.rootWordInfo,
      explanation: enriched.explanation || orig.explanation,
      optionDetails: enriched.optionDetails || orig.optionDetails,
      enrichment: enriched.enrichment || orig.enrichment,
      enrichmentWarning: enriched.enrichmentWarning || orig.enrichmentWarning,
    };
  });

  questionBankEngine.registerApprovedQuestions(fullUpdatedQuestions, false);

  return {
    updatedCount: firestoreRes.updatedCount,
    failedCount: firestoreRes.failedCount,
  };
}

/**
 * Comprehensive Backfill Engine for full Firestore question bank
 */
export async function backfillQuestionBankEnrichment(
  onProgress?: (progress: { current: number; total: number; stage: string; updated: number; currentExam?: string }) => void
): Promise<{ totalChecked: number; totalUpdated: number; durationMs: number }> {
  const startTime = Date.now();
  if (onProgress) {
    onProgress({ current: 0, total: 0, stage: 'Fetching existing published questions from Firestore...', updated: 0 });
  }

  const published = await fetchPublishedQuestionBank();
  const toEnrich = published.filter(needsEnrichment);

  if (toEnrich.length === 0) {
    return { totalChecked: published.length, totalUpdated: 0, durationMs: Date.now() - startTime };
  }

  let totalUpdated = 0;
  const res = await enrichFirestoreQuestions(toEnrich, (prog) => {
    if (onProgress) {
      onProgress({
        current: prog.current,
        total: toEnrich.length,
        stage: prog.stage,
        updated: totalUpdated,
      });
    }
  });

  totalUpdated = res.updatedCount;
  return {
    totalChecked: published.length,
    totalUpdated,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Intelligent contextual fallback when offline or API is unavailable
 */
function generateContextualFallback(q: ExtractedQuestion): Partial<ExtractedQuestion> {
  const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const correctOption = q.options[correctIdx] || 'Correct Option';
  const targetWord = (q.wordOrPhrase || q.question || '').trim();

  // Resolve educational fields with comprehensive dictionary & fallback logic
  const cardEdu = resolveCardEducation(q as any);

  let meaning = q.meaning || cardEdu.meaning;
  let hindiMeaning = q.hindiMeaning || cardEdu.hindiMeaning;
  let explanation = q.explanation || '';
  let mnemonic = q.mnemonic || cardEdu.mnemonic;
  let exampleSentence = q.exampleSentence || cardEdu.exampleSentence;
  let rootWordInfo = q.rootWordInfo || '';

  // Determine root/etymology heuristic if not set
  if (!rootWordInfo) {
    const lower = targetWord.toLowerCase();
    if (lower.startsWith('pan')) {
      rootWordInfo = 'Greek pan- ("all, whole") -> formal speech of praise delivered in public gathering.';
    } else if (lower.startsWith('castig') || lower.startsWith('chast')) {
      rootWordInfo = 'Latin castigare (castus "pure" + agere "to drive") -> to punish or criticize severely.';
    } else if (lower.startsWith('fastid')) {
      rootWordInfo = 'Latin fastidium ("loathing, distaste") -> difficult to please; excessively particular.';
    } else if (lower.startsWith('bene') || lower.startsWith('bon')) {
      rootWordInfo = 'Latin bene ("well, good") -> expressing kindness or favorable disposition.';
    } else if (lower.startsWith('mal')) {
      rootWordInfo = 'Latin malus ("bad, ill") -> denoting harmful or hostile condition.';
    } else if (lower.startsWith('equ')) {
      rootWordInfo = 'Latin aequus ("even, equal") -> denoting calmness, balance, or fair proportion.';
    } else if (lower.startsWith('tacit')) {
      rootWordInfo = 'Latin tacere ("to be silent") -> expressing quietness or habitual lack of speech.';
    } else if (lower.startsWith('loqu') || lower.startsWith('locu')) {
      rootWordInfo = 'Latin loqui ("to speak") -> tending to speak fluently or at great length.';
    } else {
      rootWordInfo = `Root structure for "${targetWord}" tested frequently in competitive examinations.`;
    }
  }

  if (!meaning) {
    if (q.category === 'synonyms') {
      meaning = `Accurately denotes the quality or attribute closely matching "${correctOption}".`;
      hindiMeaning = `"${targetWord}" का सटीक भावार्थ एवं समानार्थी शब्द`;
      explanation = `"${correctOption}" is the most accurate synonym representing "${targetWord}".`;
      mnemonic = `Memory Hook: Relate "${targetWord}" with "${correctOption}" in daily usage.`;
    } else if (q.category === 'antonyms') {
      meaning = `Expresses a state, action, or quality directly contrasting with "${correctOption}".`;
      hindiMeaning = `"${targetWord}" का यथार्थ विलोमार्थी भाव`;
      explanation = `"${targetWord}" contrasts directly with "${correctOption}", making it the opposite.`;
      mnemonic = `Memory Hook: Visualize "${targetWord}" vs "${correctOption}" as two opposite states.`;
    } else if (q.category === 'ows') {
      meaning = `One who or that which fits the description: "${q.question || targetWord}".`;
      hindiMeaning = `"${correctOption}" का एक शब्द में सटीक अर्थ`;
      explanation = `Option ${String.fromCharCode(65 + correctIdx)} ("${correctOption}") is the precise one-word substitution for the description.`;
      mnemonic = `Memory Hook: Break down the root of "${correctOption}" to remember the description.`;
    } else if (q.category === 'idioms') {
      meaning = `Figurative meaning: A common idiomatic phrase denoting "${correctOption}".`;
      hindiMeaning = `मुहावरे "${targetWord}" का लाक्षणिक अर्थ`;
      explanation = `The idiom "${targetWord}" figuratively conveys "${correctOption}".`;
      mnemonic = `Memory Hook: Picture the literal phrase "${targetWord}" leading to its figurative meaning.`;
    }
  }

  if (!mnemonic) {
    mnemonic = `Memory Hook: Link "${targetWord}" with "${correctOption}" for rapid recall in the exam hall.`;
  }

  const optionDetails: QuestionOptionDetail[] = q.options.map((opt, idx) => {
    const isCorrect = idx === correctIdx;
    const cleanOpt = String(opt || '').trim();
    return {
      option: cleanOpt,
      englishMeaning: isCorrect && meaning ? meaning : `Concept denoting "${cleanOpt}", serving as a distractor option.`,
      hindiMeaning: isCorrect && hindiMeaning ? hindiMeaning : `"${cleanOpt}" का स्वतंत्र अर्थ`,
      explanation: isCorrect ? 'Correct Answer: Accurately satisfies the exam requirement.' : 'Distractor Option: Differs in nuance from the target requirement.',
      shortExplanation: isCorrect ? 'Correct Option' : undefined,
      mnemonicHook: undefined,
      isCorrect,
    };
  });

  return {
    meaning,
    hindiMeaning,
    explanation,
    mnemonic,
    exampleSentence: q.exampleSentence || `The term "${targetWord}" appeared in standard examination practice.`,
    rootWordInfo,
    optionDetails,
    enrichment: {
      status: 'partial',
      version: 'learning-fallback-v1',
      enrichedAt: Date.now(),
      provider: 'contextual_fallback',
    },
  };
}
