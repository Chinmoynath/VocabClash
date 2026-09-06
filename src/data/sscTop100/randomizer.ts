import { Question } from '../../types';

/**
 * Deterministically balances and randomizes question options so that:
 * 1. Correct answers are evenly and naturally distributed across A (0), B (1), C (2), D (3).
 * 2. No option (especially Option A) dominates or repeats across consecutive questions.
 * 3. optionDetails (if present) are reordered to match the new option order with 100% precision.
 * 4. correctIndex is updated to the exact new position of the correct answer.
 * 5. Deterministic based on question id and index, so options remain stable across re-renders.
 */
export function balanceAndRandomizeQuestions(questions: Question[]): Question[] {
  // Base balanced Latin-square pattern of option slots
  const baseSlots = [1, 2, 0, 3, 2, 0, 3, 1, 3, 1, 0, 2, 0, 3, 1, 2];
  let prevSlot = -1;

  return questions.map((q, idx) => {
    if (!q.options || q.options.length < 2) return q;

    const currentCorrectIndex =
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.options.length
        ? q.correctIndex
        : 0;

    const correctText = q.options[currentCorrectIndex];
    const distractors = q.options.filter((_, i) => i !== currentCorrectIndex);

    // Compute a pseudo-random hash offset from question id / word
    const seedStr = `${q.id || ''}_${q.wordOrPhrase || ''}`;
    let hashOffset = 0;
    for (let c = 0; c < seedStr.length; c++) {
      hashOffset = (hashOffset * 31 + seedStr.charCodeAt(c)) % 4;
    }

    // Determine target slot (0=A, 1=B, 2=C, 3=D)
    let targetSlot = (baseSlots[idx % baseSlots.length] + hashOffset) % q.options.length;

    // Strict Anti-Consecutive Rule: NEVER let 2 adjacent questions have the same correct answer option
    if (targetSlot === prevSlot) {
      targetSlot = (targetSlot + 1) % q.options.length;
    }
    prevSlot = targetSlot;

    // Deterministically permute the distractors using remaining hash bits
    const shuffledDistractors = [...distractors];
    const distractorSeed = (hashOffset * 7 + idx * 13) % 100;
    if (distractorSeed % 2 === 0 && shuffledDistractors.length >= 2) {
      const tmp = shuffledDistractors[0];
      shuffledDistractors[0] = shuffledDistractors[1];
      shuffledDistractors[1] = tmp;
    }
    if (distractorSeed % 3 === 0 && shuffledDistractors.length >= 3) {
      const tmp = shuffledDistractors[1];
      shuffledDistractors[1] = shuffledDistractors[2];
      shuffledDistractors[2] = tmp;
    }

    // Reconstruct options with correctText placed cleanly at targetSlot
    const newOptions: string[] = [];
    let dIdx = 0;
    for (let i = 0; i < q.options.length; i++) {
      if (i === targetSlot) {
        newOptions.push(correctText);
      } else {
        newOptions.push(shuffledDistractors[dIdx++]);
      }
    }

    // Accurately map optionDetails to new option positions
    let newOptionDetails = q.optionDetails;
    if (Array.isArray(q.optionDetails) && q.optionDetails.length > 0) {
      newOptionDetails = newOptions.map(opt => {
        const found = q.optionDetails?.find(od => od.option === opt);
        if (found) {
          return {
            ...found,
            isCorrect: opt === correctText,
          };
        }
        return {
          option: opt,
          englishMeaning: opt === correctText ? (q.meaning || 'Correct answer') : 'Distractor option',
          hindiMeaning: opt === correctText ? (q.hindiMeaning || '') : '',
          isCorrect: opt === correctText,
        };
      });
    }

    return {
      ...q,
      options: newOptions,
      correctIndex: targetSlot,
      optionDetails: newOptionDetails,
    };
  });
}
