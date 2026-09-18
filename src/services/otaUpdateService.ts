import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isAndroidCapacitor } from '../utils/platform';

export const NATIVE_SHELL_VERSION = '1.0.0';
export const CURRENT_BUNDLE_VERSION = '1.0.0-base-20260917';

export interface OtaManifest {
  version: string;
  minNativeVersion: string;
  channel: 'production' | 'development';
  url: string;
  checksum?: string;
  releaseNotes?: string;
}

export interface OtaStatus {
  isSupported: boolean;
  activeVersion: string;
  baseVersion: string;
  nativeShellVersion: string;
  channel: string;
  isChecking: boolean;
  updateAvailable: boolean;
  downloadedVersion: string | null;
  lastError: string | null;
}

let otaStatus: OtaStatus = {
  isSupported: false,
  activeVersion: CURRENT_BUNDLE_VERSION,
  baseVersion: CURRENT_BUNDLE_VERSION,
  nativeShellVersion: NATIVE_SHELL_VERSION,
  channel: import.meta.env.DEV ? 'development' : 'production',
  isChecking: false,
  updateAvailable: false,
  downloadedVersion: null,
  lastError: null,
};

let isInitialized = false;

/**
 * Initializes the OTA update service when React boots.
 * MANDATORY: Calls notifyAppReady() immediately to signal to CapacitorUpdater
 * that the current web bundle mounted without JavaScript crash, preventing auto-rollback.
 */
export async function initOtaUpdateService(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  if (!isAndroidCapacitor()) {
    console.log('[OTA] Web environment detected. Native OTA updater bypassed.');
    return;
  }

  otaStatus.isSupported = true;

  try {
    // 1. Notify plugin that app booted cleanly
    console.log('[OTA] Notifying CapacitorUpdater that app is ready...');
    await CapacitorUpdater.notifyAppReady();

    // 2. Fetch active bundle info
    const current = await CapacitorUpdater.current();
    if (current && current.bundle) {
      otaStatus.activeVersion = current.bundle.version || current.bundle.id || CURRENT_BUNDLE_VERSION;
    }

    // 3. Listen for update download events
    CapacitorUpdater.addListener('downloadFailed', (info) => {
      console.warn('[OTA] Download failed for bundle:', info);
      otaStatus.lastError = 'Download failed';
      otaStatus.isChecking = false;
    });

    console.log(`[OTA] Initialized successfully. Active bundle: ${otaStatus.activeVersion}, Shell v${NATIVE_SHELL_VERSION}`);
  } catch (err: any) {
    console.warn('[OTA] Failed to initialize CapacitorUpdater:', err);
    otaStatus.lastError = err?.message || 'Initialization error';
  }
}

/**
 * Checks for a new OTA web-bundle update in the background.
 * Safe-by-design:
 * - Skips download if minNativeVersion > NATIVE_SHELL_VERSION
 * - Downloads in background without interrupting active user session
 * - Sets update to activate on NEXT cold app launch
 */
export async function checkForOtaUpdate(
  manifestUrl?: string,
  targetChannel: 'production' | 'development' = otaStatus.channel as 'production' | 'development'
): Promise<boolean> {
  if (!isAndroidCapacitor()) {
    return false;
  }

  if (otaStatus.isChecking) {
    console.log('[OTA] Check already in progress. Skipping...');
    return false;
  }

  otaStatus.isChecking = true;
  otaStatus.lastError = null;

  try {
    // If no manifest URL provided, check via CapacitorUpdater or return false
    if (!manifestUrl) {
      console.log('[OTA] No custom manifest URL configured. Checking local updater state...');
      otaStatus.isChecking = false;
      return false;
    }

    console.log(`[OTA] Checking manifest at ${manifestUrl} (Channel: ${targetChannel})...`);

    const response = await fetch(manifestUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      throw new Error(`Manifest fetch failed with status ${response.status}`);
    }

    const manifest: OtaManifest = await response.json();

    // Compatibility Check: Compare minNativeVersion
    if (manifest.minNativeVersion && isVersionHigher(manifest.minNativeVersion, NATIVE_SHELL_VERSION)) {
      console.warn(
        `[OTA] Update ${manifest.version} requires native shell v${manifest.minNativeVersion}, but device has v${NATIVE_SHELL_VERSION}. Update safely rejected.`
      );
      otaStatus.lastError = `Requires Play Store app update (v${manifest.minNativeVersion})`;
      otaStatus.isChecking = false;
      return false;
    }

    // Check if manifest version is newer than current active version
    if (manifest.version === otaStatus.activeVersion) {
      console.log(`[OTA] Already running latest version (${manifest.version}). No update needed.`);
      otaStatus.isChecking = false;
      return false;
    }

    console.log(`[OTA] New compatible update found: ${manifest.version}. Downloading in background...`);
    otaStatus.updateAvailable = true;

    // Download update in background
    const versionObj = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    if (versionObj && versionObj.id) {
      otaStatus.downloadedVersion = versionObj.id;
      console.log(`[OTA] Bundle ${versionObj.id} downloaded successfully. Set to activate on next app restart.`);
      
      // Set update for next cold launch (does NOT force immediate refresh)
      await CapacitorUpdater.set({ id: versionObj.id });
      otaStatus.isChecking = false;
      return true;
    }

    otaStatus.isChecking = false;
    return false;
  } catch (err: any) {
    console.warn('[OTA] Background update check failed silently:', err);
    otaStatus.lastError = err?.message || 'Update check failed';
    otaStatus.isChecking = false;
    return false;
  }
}

/**
 * Resets the application back to the original Play Store base bundle embedded in the APK/AAB
 */
export async function rollbackToBaseBundle(): Promise<void> {
  if (!isAndroidCapacitor()) return;
  try {
    console.log('[OTA] Rolling back to embedded base bundle...');
    await CapacitorUpdater.reset();
  } catch (err) {
    console.error('[OTA] Rollback failed:', err);
  }
}

/**
 * Helper: Compares semantic version strings
 */
function isVersionHigher(target: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const targetParts = parse(target);
  const currentParts = parse(current);

  for (let i = 0; i < Math.max(targetParts.length, currentParts.length); i++) {
    const t = targetParts[i] || 0;
    const c = currentParts[i] || 0;
    if (t > c) return true;
    if (t < c) return false;
  }
  return false;
}

/**
 * Diagnostic status for admin / troubleshooting views
 */
export function getOtaStatus(): OtaStatus {
  return { ...otaStatus };
}
