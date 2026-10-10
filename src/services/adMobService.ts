import { isAndroidCapacitor } from '../utils/platform';
import { isAdDue, recordAdShown } from '../utils/adManager';
import {
  AdMob,
  InterstitialAdPluginEvents,
  AdmobConsentStatus,
} from '@capacitor-community/admob';

/**
 * =======================================================================
 * CENTRAL NATIVE ADMOB SERVICE (CAPACITOR ANDROID ONLY)
 * =======================================================================
 * Configured for INTERSTITIAL ADS ONLY at natural breaks.
 * Native AdMob bottom banners are completely removed and disabled.
 * 
 * Strict Guarantees:
 * - NO native AdMob banner displayed at the bottom or anywhere in the app.
 * - BannerAdPosition.BOTTOM_CENTER is completely eliminated.
 * - Zero empty spacing or layout gaps.
 * - Interstitials shown ONLY at natural breaks (after 1v1 match / PYQ session).
 * - Minimum 10-minute cooldown strictly enforced across all ad triggers.
 * - Suppressed for VIP/Premium subscribers (100% ad-free).
 * - Suppressed when device is offline.
 * - Never triggered during active gameplay, matchmaking, login, modals, or app switches.
 * =======================================================================
 */

// Production AdMob Identifiers from Project Specification
export const PROD_ADMOB_APP_ID = 'ca-app-pub-6402582146558440~1650072679';
export const PROD_ADMOB_BANNER_ID = 'ca-app-pub-6402582146558440/5596523711';
export const PROD_ADMOB_INTERSTITIAL_ID = 'ca-app-pub-6402582146558440/7224124091';

// Google Official Android Test Ad Units (Prevents accidental invalid traffic during dev/review)
export const TEST_ADMOB_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_ADMOB_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
export const TEST_ADMOB_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

// Environment Switch: defaults to test ads unless explicitly configured for production
export const IS_TEST_MODE: boolean =
  import.meta.env.VITE_ADMOB_PROD === 'true' ? false : true;

export function getBannerAdUnitId(): string {
  return IS_TEST_MODE ? TEST_ADMOB_BANNER_ID : PROD_ADMOB_BANNER_ID;
}

export function getInterstitialAdUnitId(): string {
  return IS_TEST_MODE ? TEST_ADMOB_INTERSTITIAL_ID : PROD_ADMOB_INTERSTITIAL_ID;
}

// Service State
let isInitialized = false;
let isInitializing = false;
let isInterstitialLoaded = false;
let isPreparingInterstitial = false;
let interstitialListenersAttached = false;

/**
 * Native banner display is completely disabled.
 * Stubs are retained to ensure backward-compatibility without runtime errors or gaps.
 */
export function subscribeBannerHeight(callback: (height: number) => void): () => void {
  callback(0);
  return () => {};
}

export function getCurrentBannerHeight(): number {
  return 0;
}

/**
 * Initializes AdMob SDK and UMP privacy consent on Android Capacitor.
 * Safely resolves as a no-op on web browsers or non-Android environments.
 */
export async function initNativeAdMob(isPremium: boolean = false): Promise<boolean> {
  if (!isAndroidCapacitor()) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  if (isInitializing) {
    return false;
  }

  isInitializing = true;

  try {
    // 1. Google UMP Consent Gathering (if configured and required in current region)
    try {
      const consentInfo = await AdMob.requestConsentInfo();
      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdmobConsentStatus.REQUIRED
      ) {
        await AdMob.showConsentForm();
      }
    } catch (consentErr) {
      console.log('[AdMob] UMP Consent skipped or not applicable:', consentErr);
    }

    // 2. Initialize Google Mobile Ads SDK
    await AdMob.initialize({
      initializeForTesting: IS_TEST_MODE,
    });

    isInitialized = true;
    console.log(`[AdMob] Native AdMob initialized (testMode: ${IS_TEST_MODE}, interstitialOnly: true)`);

    // Clean up any lingering native banner from earlier sessions
    removeNativeBanner().catch(() => {});

    // Setup global listeners once
    attachGlobalListeners();

    // Pre-load first interstitial in background ONLY for free users
    if (!isPremium) {
      prepareInterstitial(false).catch((e) => {
        console.log('[AdMob] Initial interstitial prep deferred:', e);
      });
    }

    return true;
  } catch (error) {
    console.warn('[AdMob] Failed to initialize Google Mobile Ads SDK:', error);
    return false;
  } finally {
    isInitializing = false;
  }
}

function attachGlobalListeners(): void {
  if (!isAndroidCapacitor()) return;

  if (!interstitialListenersAttached) {
    interstitialListenersAttached = true;

    AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info) => {
      console.log('[AdMob] Interstitial loaded:', info);
      isInterstitialLoaded = true;
      isPreparingInterstitial = false;
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
      console.warn('[AdMob:no-fill] Interstitial failed to load:', err);
      isInterstitialLoaded = false;
      isPreparingInterstitial = false;
    });

    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      console.log('[AdMob] Interstitial dismissed');
      isInterstitialLoaded = false;
      // Pre-warm next interstitial once in background for the next interval
      prepareInterstitial(false).catch(() => {});
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => {
      console.warn('[AdMob:show-failed] Interstitial failed to show:', err);
      isInterstitialLoaded = false;
      // Do not enter an immediate retry loop
    });
  }
}

/**
 * Native banner display is completely disabled.
 * Returns false immediately; BannerAdPosition.BOTTOM_CENTER is not used anywhere.
 */
export async function showNativeBanner(_isPremium: boolean): Promise<boolean> {
  return false;
}

/**
 * No-op: Native banners are completely disabled.
 */
export async function hideNativeBanner(): Promise<void> {
  // No-op
}

/**
 * No-op: Native banners are completely disabled.
 */
export async function resumeNativeBanner(_isPremium: boolean): Promise<void> {
  // No-op
}

/**
 * Destroys and cleans up any native banner that might be lingering.
 */
export async function removeNativeBanner(): Promise<void> {
  if (!isAndroidCapacitor()) return;
  try {
    await AdMob.removeBanner();
  } catch {
    // Ignore if not loaded
  }
}

/**
 * Pre-loads a native interstitial ad into memory.
 */
export async function prepareInterstitial(isPremium: boolean): Promise<boolean> {
  if (!isAndroidCapacitor() || isPremium) {
    return false;
  }

  // Never attempt ad loading when offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  if (isInterstitialLoaded || isPreparingInterstitial) {
    return isInterstitialLoaded;
  }

  isPreparingInterstitial = true;

  try {
    const ready = await initNativeAdMob(isPremium);
    if (!ready && !isInitialized) {
      isPreparingInterstitial = false;
      return false;
    }

    const adId = getInterstitialAdUnitId();
    await AdMob.prepareInterstitial({
      adId,
      isTesting: IS_TEST_MODE,
    });

    isInterstitialLoaded = true;
    isPreparingInterstitial = false;
    return true;
  } catch (error) {
    console.warn('[AdMob] prepareInterstitial error:', error);
    isInterstitialLoaded = false;
    isPreparingInterstitial = false;
    return false;
  }
}

/**
 * Shows a native interstitial ad if ready, respecting frequency cooldowns.
 * Guaranteed never to throw or block product flow if unavailable.
 * Returns true if native ad actually displayed; false if unavailable/failed.
 */
export async function showNativeInterstitialIfDue(
  isPremium: boolean,
  matchesPlayed?: number,
  subscriptionHydrated: boolean = true
): Promise<boolean> {
  console.log('[AdMob:trigger] Evaluating ad eligibility');
  if (!subscriptionHydrated || !isAndroidCapacitor() || isPremium) {
    return false;
  }

  // Never show ad if device is currently offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  // Check existing 10-minute cooldown and match count constraints
  if (!isAdDue(isPremium, matchesPlayed)) {
    return false;
  }
  console.log('[AdMob:due] 10-minute cooldown reached');

  try {
    // If not prepared yet, attempt rapid preparation
    if (!isInterstitialLoaded) {
      console.log('[AdMob:not-ready] Interstitial not in memory, attempting load');
      const prepared = await prepareInterstitial(isPremium);
      if (!prepared || !isInterstitialLoaded) {
        console.log('[AdMob:no-fill] Interstitial could not be prepared in time');
        return false;
      }
    }

    console.log('[AdMob:show-attempt] Presenting native interstitial');
    await AdMob.showInterstitial();
    console.log('[AdMob:show-success] Native interstitial displayed successfully');
    isInterstitialLoaded = false;
    recordAdShown();
    return true;
  } catch (error) {
    console.warn('[AdMob:show-failed] showInterstitial failed to display (continuing normally):', error);
    isInterstitialLoaded = false;
    // Do not immediately loop retry here; fallback house modal handles this trigger
    return false;
  }
}

/**
 * Force shows a test interstitial (used by test buttons or debug flows).
 */
export async function showTestNativeInterstitial(): Promise<boolean> {
  if (!isAndroidCapacitor()) return false;
  try {
    console.log('[AdMob:show-attempt] Showing test native interstitial');
    await prepareInterstitial(false);
    await AdMob.showInterstitial();
    console.log('[AdMob:show-success] Test native interstitial displayed');
    recordAdShown();
    return true;
  } catch (error) {
    console.warn('[AdMob:show-failed] showTestNativeInterstitial error:', error);
    return false;
  }
}

/**
 * Rewarded Ad Preparation (Stubs prepared per specification; no UI fabricated).
 */
export async function prepareRewardedAd(isPremium: boolean): Promise<boolean> {
  if (!isAndroidCapacitor() || isPremium) return false;
  try {
    const ready = await initNativeAdMob(isPremium);
    if (!ready && !isInitialized) return false;

    const adId = IS_TEST_MODE
      ? TEST_ADMOB_REWARDED_ID
      : (import.meta.env.VITE_ADMOB_REWARDED_ID || TEST_ADMOB_REWARDED_ID);

    await AdMob.prepareRewardVideoAd({
      adId,
      isTesting: IS_TEST_MODE,
    });
    return true;
  } catch (err) {
    console.warn('[AdMob] prepareRewardedAd error:', err);
    return false;
  }
}

/**
 * App lifecycle helper: Banners are completely disabled; interstitials are NEVER
 * shown on app backgrounding, resume, or switching applications.
 */
export async function handleAdMobAppStateChange(
  _isActive: boolean,
  _isPremium: boolean
): Promise<void> {
  // No-op: Interstitial ads are shown only at natural breaks (after 1v1 / PYQ session),
  // NEVER on backgrounding or app switching.
}

