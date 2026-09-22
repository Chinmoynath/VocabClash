import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * =======================================================================
 * CENTRALIZED PLATFORM UTILITY FOR VOCABCLASH
 * =======================================================================
 * Determines whether the app is executing inside:
 * 1. Standard Web Browser (Desktop/Mobile Chrome, Safari, Edge, Firefox)
 * 2. Progressive Web App / Play-distributed TWA (Chrome custom tab container)
 * 3. Native Capacitor Android Shell (privileged native Android WebView)
 *
 * NOTE: Does NOT use brittle user-agent sniffing.
 * Uses official Capacitor runtime detection APIs with safe web fallbacks.
 * =======================================================================
 */

/**
 * Returns true if running inside a native Capacitor shell (Android or iOS).
 * Guaranteed to return false in standard web browsers, TWAs, and server-side contexts.
 */
export function isNativeCapacitor(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check official @capacitor/core API
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function') {
      return Capacitor.isNativePlatform();
    }

    // 2. Check injected window.Capacitor instance (used in server.url WebView loads)
    const winCap = (window as any).Capacitor;
    if (winCap && typeof winCap.isNativePlatform === 'function') {
      return winCap.isNativePlatform();
    }
  } catch {
    // Graceful fallback for non-Capacitor environments
  }

  return false;
}

/**
 * Returns true if running specifically inside a native Capacitor Android shell.
 */
export function isAndroidCapacitor(): boolean {
  if (!isNativeCapacitor()) return false;

  try {
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.getPlatform === 'function') {
      return Capacitor.getPlatform() === 'android';
    }

    const winCap = (window as any).Capacitor;
    if (winCap && typeof winCap.getPlatform === 'function') {
      return winCap.getPlatform() === 'android';
    }
  } catch {
    // Graceful fallback
  }

  return false;
}

/**
 * Returns true if running in standard desktop or mobile web browser / PWA / TWA.
 */
export function isWebBrowser(): boolean {
  return !isNativeCapacitor();
}

/**
 * Returns true if running inside an Android Trusted Web Activity (TWA) or Android standalone PWA.
 * In this environment, popup-based OAuth fails due to cross-window isolation in Chrome Custom Tabs,
 * and redirect-based OAuth (signInWithRedirect) must be used according to Google Play / Chrome guidelines.
 */
export function isAndroidTWA(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeCapacitor()) return false;

  // 1. Check if Digital Goods API is present (injected into TWAs by Chrome Custom Tabs on Google Play)
  if ('getDigitalGoodsService' in window && typeof (window as any).getDigitalGoodsService === 'function') {
    try {
      sessionStorage.setItem('vclash_is_twa', '1');
    } catch {}
    return true;
  }

  // 2. Check document.referrer (Android passes android-app://in.vocabclash.twa on launch)
  try {
    if (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://')) {
      try {
        sessionStorage.setItem('vclash_is_twa', '1');
      } catch {}
      return true;
    }
  } catch {}

  // 3. Check cached session flag (survives in-page navigations & OAuth redirects)
  try {
    if (sessionStorage.getItem('vclash_is_twa') === '1') {
      return true;
    }
  } catch {}

  // 4. Android Standalone display mode (Chrome Custom Tab TWA always operates in standalone/fullscreen)
  try {
    const isAndroid = /android/i.test(navigator.userAgent || '');
    const isStandalone = 
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: fullscreen)').matches) ||
      (window.navigator as any).standalone === true;

    if (isAndroid && isStandalone) {
      try {
        sessionStorage.setItem('vclash_is_twa', '1');
      } catch {}
      return true;
    }
  } catch {}

  return false;
}

/**
 * Cleanup helper for Native Capacitor Android:
 * If a user migrates from the older TWA / Chrome PWA to native Capacitor,
 * this unregisters any lingering service workers and clears stale cache storage
 * to guarantee that the native app always loads fresh assets and avoids white screens.
 * 
 * Has ZERO effect when running in a standard web browser.
 */
export function cleanupServiceWorkersIfNative(): void {
  if (typeof window === 'undefined') return;
  if (!isNativeCapacitor()) return;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          console.log('[Platform] Unregistering legacy service worker for native shell:', registration.scope);
          registration.unregister().catch(() => {});
        }
      }).catch(() => {});
    }

    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key.toLowerCase().includes('vocabclash')) {
            console.log('[Platform] Purging legacy SW cache for native shell:', key);
            caches.delete(key).catch(() => {});
          }
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Platform] Legacy SW cleanup notice:', err);
  }
}

/**
 * Ensures Android WebView content begins strictly below the native system status bar.
 * Disables WebView overlay and applies Dark style and status bar background.
 */
export async function configureNativeStatusBar(): Promise<void> {
  if (!isNativeCapacitor()) return;

  try {
    // 1. Critical: Disable WebView overlay so web content starts below the native status bar
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('[Platform] StatusBar.setOverlaysWebView notice:', err);
  }

  try {
    // 2. Ensure status bar is visible and formatted in dark theme
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (err) {
    console.warn('[Platform] StatusBar.setStyle notice:', err);
  }

  try {
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch (err) {
    console.warn('[Platform] StatusBar.setBackgroundColor notice:', err);
  }

  try {
    await StatusBar.show();
  } catch (err) {
    console.warn('[Platform] StatusBar.show notice:', err);
  }
}
