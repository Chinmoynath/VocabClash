import { Question, SavedWord } from '../types';

/**
 * Checks if a vault item was explicitly saved / bookmarked by the user.
 */
export function isItemSaved(item: SavedWord): boolean {
  if (!item) return false;
  if (typeof item.isSaved === 'boolean') return item.isSaved;
  if (typeof item.isUserSaved === 'boolean') return item.isUserSaved;
  // Legacy migration check: was bookmarked and had 0 mistakes (created via bookmark button in Practice/Summary)
  return Boolean(item.isBookmarked && (!item.mistakeCount || item.mistakeCount === 0));
}

/**
 * Checks if a vault item is recorded as an incorrect answer (mistake).
 */
export function isItemMistake(item: SavedWord): boolean {
  if (!item) return false;
  if (typeof item.isMistake === 'boolean') return item.isMistake;
  return typeof item.mistakeCount === 'number' && item.mistakeCount > 0;
}

/**
 * Normalizes and sanitizes a raw vault item into strict SavedWord schema.
 * Accurately repairs legacy mixed records without deleting user data.
 */
export function sanitizeVaultItem(raw: any): SavedWord | null {
  if (!raw || !raw.question || !raw.question.id) return null;

  // Determine explicit user saved state
  let isSaved = false;
  if (typeof raw.isSaved === 'boolean') {
    isSaved = raw.isSaved;
  } else if (typeof raw.isUserSaved === 'boolean') {
    isSaved = raw.isUserSaved;
  } else if (raw.isBookmarked === true && (!raw.mistakeCount || raw.mistakeCount === 0)) {
    // Legacy record created via bookmark button in Practice / Match Summary
    isSaved = true;
  } else {
    // Legacy record created automatically when user got a question wrong (isAutomaticMistake = true)
    isSaved = false;
  }

  const mistakeCount = Math.max(0, typeof raw.mistakeCount === 'number' ? raw.mistakeCount : 0);
  let isMistake = false;
  if (typeof raw.isMistake === 'boolean') {
    isMistake = raw.isMistake;
  } else {
    isMistake = mistakeCount > 0;
  }

  // If an item is neither saved nor a mistake, discard it
  if (!isSaved && !isMistake) {
    return null;
  }

  return {
    question: raw.question,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    mistakeCount,
    correctCount: Math.max(0, typeof raw.correctCount === 'number' ? raw.correctCount : 0),
    isSaved,
    isMistake,
    isBookmarked: isSaved,
    isUserSaved: isSaved,
    lastReviewedAt: typeof raw.lastReviewedAt === 'number' ? raw.lastReviewedAt : undefined,
  };
}

/**
 * Sanitizes and dedupes an entire list of vault items.
 */
export function sanitizeVaultList(list: any[]): SavedWord[] {
  if (!Array.isArray(list)) return [];
  const valid: SavedWord[] = [];
  const seenIds = new Set<string>();

  for (const raw of list) {
    const item = sanitizeVaultItem(raw);
    if (item && !seenIds.has(item.question.id)) {
      seenIds.add(item.question.id);
      valid.push(item);
    }
  }

  return valid;
}

/**
 * Purely records a mistake for a question when answered incorrectly.
 * CRITICAL: NEVER sets isSaved to true or bookmarks the question!
 */
export function recordMistakeInVault(vault: SavedWord[], question: Question): SavedWord[] {
  if (!question || !question.id) return vault;

  const existingIndex = vault.findIndex(item => item.question.id === question.id);

  if (existingIndex >= 0) {
    const existing = vault[existingIndex];
    const currentlySaved = isItemSaved(existing);
    const updated: SavedWord = {
      ...existing,
      mistakeCount: (existing.mistakeCount || 0) + 1,
      isMistake: true,
      // Saved state remains COMPLETELY UNCHANGED
      isSaved: currentlySaved,
      isUserSaved: currentlySaved,
      isBookmarked: currentlySaved,
    };

    const nextVault = [...vault];
    nextVault[existingIndex] = updated;
    return nextVault;
  } else {
    // Brand new mistake item (NOT saved)
    const newMistakeItem: SavedWord = {
      question,
      savedAt: Date.now(),
      mistakeCount: 1,
      correctCount: 0,
      isMistake: true,
      isSaved: false,
      isUserSaved: false,
      isBookmarked: false,
    };
    return [newMistakeItem, ...vault];
  }
}

/**
 * Purely toggles the Saved / Bookmarked state when user explicitly clicks Save.
 * CRITICAL: NEVER alters or overwrites the mistake state or mistakeCount!
 */
export function toggleSaveInVault(
  vault: SavedWord[],
  question: Question,
  explicitState?: boolean
): { updatedVault: SavedWord[]; isNowSaved: boolean } {
  if (!question || !question.id) return { updatedVault: vault, isNowSaved: false };

  const existingIndex = vault.findIndex(item => item.question.id === question.id);

  if (existingIndex >= 0) {
    const existing = vault[existingIndex];
    const currentSaved = isItemSaved(existing);
    const nextSaved = explicitState !== undefined ? explicitState : !currentSaved;
    const currentMistake = isItemMistake(existing);

    // If user un-saves an item and it is NOT a mistake, remove it completely from vault
    if (!nextSaved && !currentMistake) {
      const filtered = vault.filter(item => item.question.id !== question.id);
      return { updatedVault: filtered, isNowSaved: false };
    }

    const updated: SavedWord = {
      ...existing,
      isSaved: nextSaved,
      isUserSaved: nextSaved,
      isBookmarked: nextSaved,
      // Mistake state remains COMPLETELY UNCHANGED
      isMistake: currentMistake,
      mistakeCount: existing.mistakeCount || 0,
    };

    const nextVault = [...vault];
    nextVault[existingIndex] = updated;
    return { updatedVault: nextVault, isNowSaved: nextSaved };
  } else {
    const nextSaved = explicitState !== undefined ? explicitState : true;
    if (!nextSaved) {
      return { updatedVault: vault, isNowSaved: false };
    }

    // Brand new saved item (NOT a mistake)
    const newSavedItem: SavedWord = {
      question,
      savedAt: Date.now(),
      mistakeCount: 0,
      correctCount: 0,
      isSaved: true,
      isUserSaved: true,
      isBookmarked: true,
      isMistake: false,
    };

    return { updatedVault: [newSavedItem, ...vault], isNowSaved: true };
  }
}

/**
 * Removes an item from the vault with respect to the user's active filter/scope.
 * - 'saved_by_me': removes Saved status. If it was a mistake, mistake remains.
 * - 'mistakes': clears Mistake status. If it was saved, saved item remains.
 * - 'all' / undefined: removes the item completely from both.
 */
export function removeVaultItem(
  vault: SavedWord[],
  questionId: string,
  scope?: 'all' | 'saved_by_me' | 'mistakes'
): SavedWord[] {
  if (!questionId) return vault;

  const existingIndex = vault.findIndex(item => item.question.id === questionId);
  if (existingIndex < 0) return vault;

  const existing = vault[existingIndex];

  if (scope === 'mistakes') {
    const isSaved = isItemSaved(existing);
    if (!isSaved) {
      // If not saved, remove completely
      return vault.filter(item => item.question.id !== questionId);
    }
    // If it was saved by the user, keep it in Saved with 0 mistakes
    const updated: SavedWord = {
      ...existing,
      isMistake: false,
      mistakeCount: 0,
      isSaved: true,
      isUserSaved: true,
      isBookmarked: true,
    };
    const nextVault = [...vault];
    nextVault[existingIndex] = updated;
    return nextVault;
  }

  if (scope === 'saved_by_me') {
    const isMistake = isItemMistake(existing);
    if (!isMistake) {
      // If not a mistake, remove completely
      return vault.filter(item => item.question.id !== questionId);
    }
    // If it was a mistake, keep it in Mistakes without saved flag
    const updated: SavedWord = {
      ...existing,
      isSaved: false,
      isUserSaved: false,
      isBookmarked: false,
      isMistake: true,
    };
    const nextVault = [...vault];
    nextVault[existingIndex] = updated;
    return nextVault;
  }

  // Default: remove completely
  return vault.filter(item => item.question.id !== questionId);
}
