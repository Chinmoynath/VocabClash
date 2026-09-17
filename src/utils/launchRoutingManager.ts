/**
 * VocabClash Smart Reopen & Cold-Launch Routing Manager
 *
 * Persists the user's last meaningful main section in lightweight device storage
 * to determine the initial destination for the next cold launch.
 *
 * Rules:
 * - Only TWO valid startup destinations: 'pyq' (PYQ Drill) and 'arena' (1v1 Arena).
 * - Last section PYQ Drill -> Reopen to 'pyq'.
 * - Last section 1v1 Arena, Ranks, Vault, AI Mentor -> Reopen to 'arena'.
 * - Fallback / invalid / uninitialized -> 'arena'.
 * - Compatible with web localStorage and future Capacitor Preferences abstraction.
 */

export type LaunchDestination = 'pyq' | 'arena';

export const LAUNCH_DESTINATION_STORAGE_KEY = 'vocabclash_launch_destination';

/**
 * Reads the stored launch destination synchronously.
 * Safe against missing, invalid, or corrupted localStorage values.
 */
export function getLaunchDestination(): LaunchDestination {
  if (typeof window === 'undefined') return 'arena';
  try {
    const val = localStorage.getItem(LAUNCH_DESTINATION_STORAGE_KEY);
    if (val === 'pyq') return 'pyq';
    if (val === 'arena') return 'arena';
  } catch {
    // Catch potential localStorage access / SecurityError exceptions
  }
  return 'arena';
}

/**
 * Stores the chosen launch destination ('pyq' or 'arena').
 * Does NOT touch Firebase or make network calls.
 */
export function setLaunchDestination(destination: LaunchDestination): void {
  if (typeof window === 'undefined') return;
  try {
    if (destination === 'pyq' || destination === 'arena') {
      localStorage.setItem(LAUNCH_DESTINATION_STORAGE_KEY, destination);
    }
  } catch {
    // Catch potential localStorage quota / permission exceptions
  }
}

/**
 * Updates the stored next launch destination whenever the user changes main tabs.
 * Maps:
 * - 'practice' (PYQ Drill) -> 'pyq'
 * - 'arena', 'leaderboard', 'mistakes', 'ai_coach' -> 'arena'
 */
export function recordTabForLaunch(tab: string): void {
  if (tab === 'practice') {
    setLaunchDestination('pyq');
  } else if (tab === 'arena' || tab === 'leaderboard' || tab === 'mistakes' || tab === 'ai_coach') {
    setLaunchDestination('arena');
  }
}

/**
 * Resolves the initial TabType for cold launch.
 * Returns 'practice' if the launch destination is 'pyq', otherwise 'arena'.
 */
export function resolveInitialTab(): 'arena' | 'practice' {
  const destination = getLaunchDestination();
  return destination === 'pyq' ? 'practice' : 'arena';
}
