const STORAGE_KEY_LAST_AD = 'vocabclash_last_ad_ts_v1';
export const AD_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)

export function getLastAdTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(STORAGE_KEY_LAST_AD);
  if (!val) {
    // When someone first arrives, initialize to now so they get a full 10-minute grace period
    const init = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_AD, init.toString());
    return init;
  }
  return parseInt(val, 10) || 0;
}

export function recordAdShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_LAST_AD, Date.now().toString());
}

export function resetAdTimerForTest(): void {
  if (typeof window === 'undefined') return;
  const tenMinsAgo = Date.now() - AD_INTERVAL_MS - 1000;
  localStorage.setItem(STORAGE_KEY_LAST_AD, tenMinsAgo.toString());
}

export function isAdDue(isPremium: boolean, matchesPlayed?: number): boolean {
  if (isPremium) return false;
  // Never show an ad after or during the first duel to maximize new user retention
  if (typeof matchesPlayed === 'number' && matchesPlayed <= 1) {
    return false;
  }
  const lastAd = getLastAdTimestamp();
  const elapsed = Date.now() - lastAd;
  return elapsed >= AD_INTERVAL_MS;
}

export function getSecondsUntilNextAd(isPremium: boolean): number {
  if (isPremium) return 0;
  const lastAd = getLastAdTimestamp();
  const elapsed = Date.now() - lastAd;
  const remaining = Math.max(0, AD_INTERVAL_MS - elapsed);
  return Math.ceil(remaining / 1000);
}
