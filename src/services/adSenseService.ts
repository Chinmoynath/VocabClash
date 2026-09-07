/**
 * Google AdSense & AdMob Web Integration Service
 * Manages dynamic script injection, client publisher ID setup,
 * responsive ad pushes, and error handling for web & hybrid app wrappers.
 */

/**
 * =======================================================================
 * CENTRAL ADVERTISING FEATURE FLAG
 * =======================================================================
 * Set to `false` to completely disable all user-facing ad UI, modals,
 * timers, countdowns, test ad buttons, and network requests.
 * 
 * To re-enable advertisements in the future:
 *   Option A: Change this default to `true`:
 *     export const ADS_ENABLED: boolean = true;
 *   Option B: Configure in your environment/.env:
 *     VITE_ADS_ENABLED=true
 * =======================================================================
 */
export const ADS_ENABLED: boolean = 
  typeof import.meta.env.VITE_ADS_ENABLED !== 'undefined'
    ? import.meta.env.VITE_ADS_ENABLED === 'true'
    : false;

// User Configured Publisher & AdMob IDs
export const ADSENSE_CLIENT_ID = 
  import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID || 'ca-pub-6402582146558440';

export const ADSENSE_INTERSTITIAL_SLOT = 
  import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_INTERSTITIAL || '5100703845';

export const ADSENSE_BANNER_SLOT = 
  import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_BANNER || '5596523711';

export const ADMOB_APP_ID = 
  import.meta.env.VITE_GOOGLE_ADMOB_APP_ID || 'ca-app-pub-6402582146558440~1650072679';

export const ADMOB_UNIT_ID =
  import.meta.env.VITE_GOOGLE_ADMOB_UNIT_ID || 'ca-app-pub-6402582146558440/5596523711';

export const ADMOB_INTERSTITIAL_UNIT_ID =
  import.meta.env.VITE_GOOGLE_ADMOB_UNIT_INTERSTITIAL || 'ca-app-pub-6402582146558440/5596523711';

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

let scriptInjected = false;

/**
 * Ensures the Google AdSense library script is injected into document head.
 */
export function initGoogleAdSense(): void {
  // Prevent SDK injection and network loading while ads are disabled
  if (!ADS_ENABLED) return;
  if (typeof window === 'undefined') return;
  if (scriptInjected) return;

  // Check if script tag already exists in HTML
  const existingScript = document.querySelector('script[src*="pagead2.googlesyndication.com"]');
  if (existingScript) {
    scriptInjected = true;
    return;
  }

  try {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      console.log('Google AdSense script loaded successfully.');
    };
    script.onerror = (err) => {
      console.warn('Google AdSense script failed to load (possible ad blocker or offline):', err);
    };
    document.head.appendChild(script);
    scriptInjected = true;
  } catch (e) {
    console.warn('Failed to inject Google AdSense script:', e);
  }
}

/**
 * Pushes an ad request to window.adsbygoogle queue safely.
 */
export function pushAdSenseRequest(): boolean {
  if (!ADS_ENABLED) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
    return true;
  } catch (err) {
    console.warn('Google AdSense push error:', err);
    return false;
  }
}
