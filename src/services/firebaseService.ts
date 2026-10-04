import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  getAdditionalUserInfo,
  User as FirebaseUser
} from 'firebase/auth';
import { trackSignup } from './analyticsService';
import { 
  getFirestore, 
  initializeFirestore,
  setLogLevel,
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  increment,
  runTransaction,
  deleteDoc,
  getDocFromServer,
  onSnapshot,
  collection,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { isAndroidCapacitor, isAndroidTWA } from '../utils/platform';
import { 
  normalizeDailyChallengeAttempt, 
  deduplicateDailyChallengeHistory 
} from '../utils/dailyChallengeHistoryUtils';
import { PlayerProfile, UserSubscription, DailyStreakState, SavedWord, QuestionCategory, ExamType } from '../types';
import { DailyTargetState } from '../utils/dailyTargetManager';
import { validateProperEmail } from '../utils/emailValidator';

// Suppress internal Firestore connection retry & offline warnings
try {
  setLogLevel('silent');
} catch {
  // Ignore in environments where setLogLevel is not available
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Standard Firebase Auth instance with browser popup/redirect resolver and multi-tier persistence
let authInstance: ReturnType<typeof getAuth>;
try {
  // getAuth(app) sets up browserPopupRedirectResolver and default persistence automatically in browser
  authInstance = getAuth(app);
} catch {
  try {
    authInstance = initializeAuth(app, {
      popupRedirectResolver: browserPopupRedirectResolver,
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    authInstance = getAuth(app);
  }
}
export const auth = authInstance;

/**
 * Ensures the client has an active authenticated Firebase user identity for online operations.
 * If already logged in (Google, email), returns auth.currentUser immediately.
 * If not logged in, signs in anonymously (or transparent transient guest account
 * if anonymous auth is not enabled in Firebase Console) so request.auth != null
 * and request.auth.uid is genuine for all Firestore security rules.
 */
let guestAuthPromise: Promise<FirebaseUser> | null = null;

export async function ensureAuthenticatedUser(): Promise<FirebaseUser> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (guestAuthPromise) {
    return guestAuthPromise;
  }

  guestAuthPromise = (async () => {
    try {
      // 1. First attempt native Firebase anonymous authentication
      const anonCred = await signInAnonymously(auth);
      return anonCred.user;
    } catch (anonErr: any) {
      console.info('[FIREBASE AUTH] Anonymous provider fallback:', anonErr?.code || anonErr?.message);
      // 2. Fallback to transient authenticated guest account if anonymous auth is not toggled in console
      const guestKey = 'vclash_guest_cred';
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(guestKey) || 'null');
      } catch {}

      if (saved?.email && saved?.password) {
        try {
          const cred = await signInWithEmailAndPassword(auth, saved.email, saved.password);
          return cred.user;
        } catch {}
      }

      // Generate secure transient guest credentials
      const guestEmail = `guest_${Date.now()}_${Math.floor(Math.random() * 1000000)}@guest.vocabclash.internal`;
      const guestPassword = `VC#${Math.random().toString(36).slice(2)}!${Date.now()}`;

      const created = await createUserWithEmailAndPassword(auth, guestEmail, guestPassword);
      try {
        localStorage.setItem(guestKey, JSON.stringify({ email: guestEmail, password: guestPassword }));
      } catch {}
      return created.user;
    } finally {
      guestAuthPromise = null;
    }
  })();

  return guestAuthPromise;
}

// Helper to create configured Google Auth Provider
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export const googleProvider = createGoogleProvider();

// Initialize standard Firestore instance with applet database ID (as required by SKILL.md)
let dbInstance: ReturnType<typeof getFirestore>;
try {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
} catch {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Circuit breaker for Firestore quota limit exhaustion to prevent write queue flooding
let quotaExhaustedUntil: number = 0;
let hasLoggedQuotaWarning = false;

export function isFirestoreQuotaExhausted(): boolean {
  if (quotaExhaustedUntil && Date.now() < quotaExhaustedUntil) {
    return true;
  }
  if (quotaExhaustedUntil && Date.now() >= quotaExhaustedUntil) {
    // Reset circuit breaker after cooldown
    quotaExhaustedUntil = 0;
    hasLoggedQuotaWarning = false;
  }
  return false;
}

export function markFirestoreQuotaExhausted(durationMs: number = 30 * 60 * 1000): void {
  quotaExhaustedUntil = Date.now() + durationMs;
  if (!hasLoggedQuotaWarning) {
    console.warn(
      `[Firestore Quota Protection] Free tier write quota reached. Circuit breaker engaged for ${Math.round(durationMs / 60000)} mins. State is securely persisted in local storage.`
    );
    hasLoggedQuotaWarning = true;
  }
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  isQuotaExhausted?: boolean;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = 
    errMsg.includes('resource-exhausted') || 
    errMsg.includes('Quota limit exceeded') || 
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('Free daily write units');
  const isOffline = 
    errMsg.includes('client is offline') || 
    errMsg.includes('unavailable') || 
    errMsg.includes('Could not reach Cloud Firestore backend');

  if (isQuota) {
    markFirestoreQuotaExhausted();
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    isQuotaExhausted: isQuota,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (!isQuota && !isOffline) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  } else if (isOffline) {
    console.warn(`[Firestore Offline Cache] Operating in offline mode for ${operationType} on ${path || 'doc'}`);
  }
  return errInfo;
}

// Initial connection test
export async function testFirestoreConnection(): Promise<void> {
  try {
    if (auth.currentUser) {
      await getDocFromServer(doc(db, 'users', auth.currentUser.uid));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline or connecting...');
    }
  }
}

export interface UserCloudData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  player: PlayerProfile;
  subscription: UserSubscription;
  streak: DailyStreakState;
  savedWords: SavedWord[];
  dailyChallengeHistory?: any[];
  practiceFilters?: {
    category: QuestionCategory | 'mixed';
    exam: ExamType;
  };
  dailyTarget?: DailyTargetState | null;
  updatedAt: number;
}

// Human-readable auth error mapper
export function getFriendlyAuthErrorMessage(error: any): string {
  const code = (error?.code || '').toLowerCase();
  const rawMsg = (error?.message || (typeof error === 'string' ? error : '')).trim();
  const message = rawMsg.toLowerCase();

  if (code.includes('native-google-auth-not-initialized') || message.includes('native_google_auth_not_initialized')) {
    return 'Native Google Sign-In is initializing for this Android app. Please use Email & Password or try again in the next build.';
  }

  if (code.includes('developer-error') || message.includes('developer_error')) {
    return 'Google Sign-In configuration check required (Code 10). Please verify Google Cloud OAuth Client ID, or sign in with Email & Password.';
  }

  if (code.includes('native-google-failed') || code.includes('missing-id-token')) {
    return 'Google account selection could not be completed. Please try again or sign in with Email & Password.';
  }

  if (code.includes('email-already-in-use') || message.includes('email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code.includes('invalid-email') || message.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code.includes('weak-password') || message.includes('weak-password')) {
    return 'Password should be at least 6 characters long.';
  }
  if (
    code.includes('user-not-found') || 
    code.includes('wrong-password') || 
    code.includes('invalid-credential') || 
    message.includes('invalid-credential') || 
    message.includes('user-not-found') || 
    message.includes('wrong-password')
  ) {
    return 'Invalid email or password. Please verify your credentials or create an account.';
  }
  if (code.includes('too-many-requests') || message.includes('too-many-requests')) {
    return 'Too many failed attempts. Please wait a moment and try again.';
  }
  if (code.includes('popup-closed-by-user') || message.includes('popup-closed-by-user') || message.includes('closed-by-user') || message.includes('closed')) {
    return 'Google sign-in popup was dismissed. Click Continue with Google again to sign in.';
  }
  if (code.includes('popup-blocked') || message.includes('popup-blocked') || message.includes('blocked')) {
    return 'Google sign-in popup was blocked by your browser. Please allow popups or use Email Sign-In.';
  }
  if (code.includes('unauthorized-domain') || message.includes('unauthorized-domain')) {
    return 'This preview domain is not yet in Firebase OAuth authorized domains list. Please sign in or register instantly using Email & Password below!';
  }
  if (code.includes('cancelled-popup-request') || message.includes('cancelled-popup-request')) {
    return 'Sign-in was interrupted. Please click Continue with Google again.';
  }
  if (code.includes('web-storage-unsupported') || message.includes('web-storage-unsupported')) {
    return 'Browser cookies or storage are restricted. Please enable cookies or sign in with Email & Password.';
  }
  if (code.includes('operation-not-allowed') || message.includes('operation-not-allowed')) {
    return 'Google sign-in provider is being configured. Please use direct Email & Password sign-in below!';
  }
  if (code.includes('network-request-failed') || message.includes('offline') || message.includes('network')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  if (
    message.includes('database is closing') ||
    message.includes('closing/hidden') ||
    message.includes('idbdatabase')
  ) {
    return 'Browser storage connection was refreshed. Please tap Sign In again or continue with Email.';
  }

  if (
    code.includes('argument-error') || 
    message.includes('argument-error')
  ) {
    return 'Authentication resolver was refreshed. Please tap Continue with Google again or use Email Sign-In.';
  }

  // Clean raw "Firebase: Error (auth/...)" strings into readable text
  if (rawMsg.includes('Firebase: Error (auth/') || rawMsg.includes('auth/')) {
    const clean = rawMsg
      .replace(/Firebase:\s*Error\s*\(auth\//gi, '')
      .replace(/\)\.?$/g, '')
      .replace(/auth\//g, '')
      .replace(/-/g, ' ');
    return `Authentication notice: ${clean}. You can also use Email & Password below.`;
  }

  return rawMsg || 'Authentication failed. Please try again.';
}

// Request 6-digit OTP for Email Signup
export async function sendSignupOtp(email: string, name?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name?.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send verification code.');
    }
    return data;
  } catch (err: any) {
    console.error('sendSignupOtp Error:', err);
    throw err;
  }
}

// Verify 6-digit OTP for Email Signup
export async function verifySignupOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid or expired OTP code.');
    }
    return data;
  } catch (err: any) {
    console.error('verifySignupOtp Error:', err);
    throw err;
  }
}

// Sign in with Google (Popup with optional redirect fallback & debounce protection)
let isGoogleAuthInProgress = false;

export async function signInWithGoogle(forceRedirect = false): Promise<FirebaseUser | null> {
  const isCapacitor = isAndroidCapacitor();
  console.log(`[Auth Platform] ${isCapacitor ? 'capacitor_native' : 'web'}`);

  // BRANCH 1: NATIVE CAPACITOR ANDROID
  // Embedded Android WebViews fail Google OAuth with 403: disallowed_useragent.
  // We use the native Google Sign-In plugin to retrieve the Google ID token,
  // then hand it off to the existing Firebase Web SDK via signInWithCredential().
  // This guarantees the exact same Firebase UID, security rules, and Firestore profile.
  if (isCapacitor) {
    if (isGoogleAuthInProgress) {
      console.log('[Native Auth] Google Sign-In is already in progress in Capacitor.');
      return null;
    }
    isGoogleAuthInProgress = true;
    console.log('[Native Auth] native sign-in started (useCredentialManager: false)');

    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      
      let res;
      try {
        res = await FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: false,
        });
        console.log('[Native Auth] native sign-in returned', {
          resultExists: !!res,
          credentialExists: !!res?.credential,
          idTokenExists: !!res?.credential?.idToken,
        });
      } catch (nativeErr: any) {
        const nativeMsg = String(nativeErr?.message || nativeErr || '');
        const nativeCode = String(nativeErr?.code || '');
        console.error('[Native Auth] native sign-in failed', {
          code: nativeCode,
          message: nativeMsg,
        });

        // Accurate cancellation handling: user dismissed the sheet, tapped outside, or pressed back
        const lowerMsg = nativeMsg.toLowerCase();
        const lowerCode = nativeCode.toLowerCase();
        const isCancelled = 
          lowerMsg.includes('cancel') ||
          lowerCode.includes('cancel') ||
          lowerCode === '16' ||
          /^\s*16(\s*:|$)/.test(lowerMsg) ||
          lowerMsg.includes('12501') ||
          lowerMsg.includes('getcredentialcancellationexception');

        if (isCancelled) {
          console.log('[Native Auth] User cancelled native Google account selector.');
          return null;
        }

        (nativeErr as any).stage = 'native_google_failed';
        throw nativeErr;
      }

      // Explicit verification: result and credential object must exist
      if (!res || !res.credential) {
        console.error('[Native Auth] Native Google Sign-In returned empty response or missing credential object');
        const err = new Error('Native Google Sign-In failed: no credential received from account selector.');
        (err as any).code = 'auth/native-google-failed';
        (err as any).stage = 'native_google_failed';
        throw err;
      }

      // Explicit verification: idToken must exist (presence logged safely, never the raw token)
      const idToken = res.credential.idToken;
      if (!idToken) {
        console.error('[Native Auth] Native Google Sign-In returned credential without idToken');
        const err = new Error('Native Google Sign-In failed: missing ID token in credential from Google account selector.');
        (err as any).code = 'auth/missing-id-token';
        (err as any).stage = 'missing_id_token';
        throw err;
      }

      console.log('[Native Auth] Native Google account selection completed, received ID token. Bridging to Firebase Web SDK signInWithCredential...');
      let userCredential;
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        userCredential = await signInWithCredential(auth, credential);
        console.log('[Native Auth] Firebase Web SDK signInWithCredential success. User UID:', userCredential.user.uid);
      } catch (webCredErr: any) {
        console.error('[Native Auth] Firebase Web SDK signInWithCredential failure:', webCredErr);
        (webCredErr as any).stage = 'firebase_web_credential_failed';
        throw webCredErr;
      }

      try {
        const addInfo = getAdditionalUserInfo(userCredential);
        if (addInfo?.isNewUser) {
          trackSignup('google');
        }
      } catch {
        // ignore analytics tracking failure
      }

      return userCredential.user;
    } catch (error: any) {
      const msg = String(error?.message || error || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();

      // DEVELOPER_ERROR / Code 10 handling (accurate detection)
      const isDeveloperError = code === '10' || code === 'auth/developer-error' || msg.includes('developer_error') || /^\s*10(\s*:|$)/.test(msg);
      if (isDeveloperError) {
        console.error(
          '[Native Auth] Google Sign-In DEVELOPER_ERROR (code 10). ' +
          'Verify that the OAuth 2.0 Web Client ID in strings.xml and Google Cloud Console matches the release configuration.'
        );
        const devErr = new Error('Google Sign-In configuration error (Code 10). Please verify OAuth Client ID and package configuration, or sign in with Email & Password.');
        (devErr as any).code = 'auth/developer-error';
        (devErr as any).stage = 'native_google_failed';
        throw devErr;
      }

      // Network error (CommonStatusCodes.NETWORK_ERROR = 7)
      const isNetworkError = code === '7' || /^\s*7(\s*:|$)/.test(msg) || msg.includes('network') || msg.includes('offline');
      if (isNetworkError) {
        const netErr = new Error('Unable to connect to Google services. Please check your internet connection.');
        (netErr as any).code = 'auth/network-request-failed';
        (netErr as any).stage = 'native_google_failed';
        throw netErr;
      }

      console.warn('[Native Auth] Native Google Sign-In flow error:', error);
      throw error;
    } finally {
      isGoogleAuthInProgress = false;
    }
  }

  // BRANCH 2: ANDROID TRUSTED WEB ACTIVITY (TWA) & ANDROID STANDALONE PWA
  // In Chrome Custom Tabs (TWA container), window.open popups fail because CCT isolates
  // the popup from the TWA opener window, causing window.opener.postMessage to fail.
  // Google and Firebase guidelines mandate signInWithRedirect for TWAs.
  if (isAndroidTWA() || forceRedirect) {
    if (isGoogleAuthInProgress) {
      console.log('[Auth: TWA] Google Sign-In is already in progress, avoiding concurrent redirect conflict.');
      return null;
    }
    isGoogleAuthInProgress = true;
    console.log('[Auth: Diagnostic] Sign-in attempt started: method = twa_redirect, provider = google.com');

    try {
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem('vclash_auth_redirect_pending', '1');
        } catch {}
      }
      const provider = createGoogleProvider();
      await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      return null;
    } catch (redirectErr: any) {
      const code = String(redirectErr?.code || '').toLowerCase();
      const msg = String(redirectErr?.message || redirectErr || '').toLowerCase();
      console.error('[Auth: Diagnostic] signInWithRedirect failed:', { code, message: msg });
      throw redirectErr;
    } finally {
      isGoogleAuthInProgress = false;
    }
  }

  // BRANCH 3: STANDARD WEB BROWSER (DESKTOP & MOBILE BROWSER POPUP)
  if (isGoogleAuthInProgress) {
    console.log('Google sign-in is already in progress, avoiding concurrent popup conflict.');
    return null;
  }
  isGoogleAuthInProgress = true;
  console.log('[Auth: Diagnostic] Sign-in attempt started: method = web_popup, provider = google.com');

  try {
    const provider = createGoogleProvider();
    let result;
    try {
      result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (popupErr: any) {
      const pCode = String(popupErr?.code || '').toLowerCase();
      const pMsg = String(popupErr?.message || popupErr || '').toLowerCase();

      // If popup is blocked by browser, automatically fall back to signInWithRedirect
      if (pCode.includes('popup-blocked') || pMsg.includes('popup-blocked')) {
        console.log('[Auth: Diagnostic] Popup blocked by browser. Automatically falling back to signInWithRedirect...');
        await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
        return null;
      }
      throw popupErr;
    }

    try {
      const addInfo = getAdditionalUserInfo(result);
      if (addInfo?.isNewUser) {
        trackSignup('google');
      }
    } catch {
      // ignore
    }
    console.log('[Auth: Diagnostic] Web popup sign-in completed successfully! User UID:', result.user.uid);
    return result.user;
  } catch (error: any) {
    const code = String(error?.code || '').toLowerCase();
    const msg = String(error?.message || error || '').toLowerCase();

    // If the user closed or cancelled the popup, or a duplicate request was cancelled, resolve cleanly
    if (
      code.includes('cancelled-popup-request') || 
      msg.includes('cancelled-popup-request') ||
      code.includes('popup-closed-by-user') || 
      msg.includes('popup-closed-by-user')
    ) {
      console.log('[Auth: Diagnostic] Google Sign-In popup was closed or cancelled by user.');
      return null;
    }

    if (msg.includes('database is closing') || msg.includes('closing/hidden')) {
      console.warn('Transient IndexedDB closing during popup; retrying Google Sign-in after brief pause...');
      await new Promise(r => setTimeout(r, 400));
      try {
        const retryResult = await signInWithPopup(auth, createGoogleProvider(), browserPopupRedirectResolver);
        try {
          const addInfo = getAdditionalUserInfo(retryResult);
          if (addInfo?.isNewUser) {
            trackSignup('google');
          }
        } catch {
          // ignore
        }
        console.log('[Auth: Diagnostic] Retry popup sign-in completed successfully! User UID:', retryResult.user.uid);
        return retryResult.user;
      } catch (retryErr) {
        console.warn('Retry after database closing error failed:', retryErr);
        throw retryErr;
      }
    }
    console.warn('[Auth: Diagnostic] Google Sign-In error:', { code, message: msg });
    throw error;
  } finally {
    isGoogleAuthInProgress = false;
  }
}

// Direct Google Sign-In via Full-Page Redirect
export async function signInWithGoogleRedirect(): Promise<void> {
  if (isAndroidCapacitor()) {
    // In Capacitor Android, redirect OAuth in WebView is disallowed by Google (403).
    // Delegate directly to the native Google Sign-In flow:
    await signInWithGoogle();
    return;
  }
  const provider = createGoogleProvider();
  await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
}

// Check for pending redirect sign-in result on page load
export async function checkRedirectAuthResult(): Promise<FirebaseUser | null> {
  if (isAndroidCapacitor()) {
    return null;
  }
  try {
    console.log('[Auth: Diagnostic] Checking redirect auth result via getRedirectResult...');
    const res = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('vclash_auth_redirect_pending');
      } catch {}
    }
    if (res?.user) {
      console.log('[Auth: Diagnostic] getRedirectResult completed successfully! Authenticated User UID:', res.user.uid);
      try {
        const addInfo = getAdditionalUserInfo(res);
        if (addInfo?.isNewUser) {
          trackSignup('google');
        }
      } catch {
        // ignore
      }
      return res.user;
    } else {
      console.log('[Auth: Diagnostic] getRedirectResult returned null (no pending redirect callback).');
    }
    return null;
  } catch (err: any) {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('vclash_auth_redirect_pending');
      } catch {}
    }
    const code = String(err?.code || '').toLowerCase();
    const msg = String(err?.message || err || '').toLowerCase();
    console.error('[Auth: Diagnostic] getRedirectResult error:', { code, message: msg });
    return null;
  }
}

let pendingRegistrationDisplayName: string | null = null;

export function getPendingRegistrationDisplayName(): string | null {
  if (pendingRegistrationDisplayName) return pendingRegistrationDisplayName;
  if (typeof window !== 'undefined') {
    try {
      return sessionStorage.getItem('vocabclash_pending_display_name');
    } catch {}
  }
  return null;
}

export function setPendingRegistrationDisplayName(name: string | null): void {
  pendingRegistrationDisplayName = name;
  if (typeof window !== 'undefined') {
    try {
      if (name) {
        sessionStorage.setItem('vocabclash_pending_display_name', name);
      } else {
        sessionStorage.removeItem('vocabclash_pending_display_name');
      }
    } catch {}
  }
}

// Create Account / Register with Email & Password
export async function registerWithEmailPassword(
  email: string, 
  password: string, 
  displayName?: string
): Promise<FirebaseUser> {
  const cleanEmail = email.trim().toLowerCase();
  const validation = validateProperEmail(cleanEmail);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Please enter a valid, non-disposable email address.');
  }

  const trimmedName = displayName?.trim();
  if (trimmedName) {
    setPendingRegistrationDisplayName(trimmedName);
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (trimmedName) {
      await updateProfile(userCredential.user, {
        displayName: trimmedName,
      });
      try {
        await userCredential.user.reload();
      } catch {}
    }
    trackSignup('email');
    return auth.currentUser || userCredential.user;
  } catch (error: any) {
    setPendingRegistrationDisplayName(null);
    console.error('Email Registration Error:', error);
    throw error;
  }
}

// Sign In with Email & Password
export async function signInWithEmailPassword(
  email: string, 
  password: string
): Promise<FirebaseUser> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
}

// Send Password Reset Link
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: any) {
    console.error('Password Reset Error:', error);
    throw error;
  }
}

// Sign out with timeout guard so user is never stuck in infinite loading
export async function logOut(): Promise<void> {
  try {
    if (isAndroidCapacitor()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await withTimeout(FirebaseAuthentication.signOut(), 1000, undefined);
      } catch (nativeErr) {
        console.warn('Native signOut notice:', nativeErr);
      }
    }
    await withTimeout(fbSignOut(auth), 1200, undefined);
  } catch (e) {
    console.warn('Notice during sign out:', e);
  }
}

// Clean deeply to remove any `undefined` fields which Firestore rejects
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object' && data !== null) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return data;
}

// Helper to wrap promises with guaranteed timeout fallback
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// In-memory write tracking to prevent write stream flooding
const lastSavedPayloadMap = new Map<string, string>();
let isWritingUserData = false;

// Canonical latest cloud profile tracker to prevent stale local cache overwrites
export const latestCloudLPMap = new Map<string, { rankPoints: number; matchesPlayed: number; matchesWon: number }>();
export const latestCloudStreakMap = new Map<string, { currentStreak: number; longestStreak: number; lastActiveDate: string; lastActiveTimestamp: number }>();

// Save complete user state to Firestore
export async function saveUserDataToFirestore(
  uid: string,
  data: {
    player: PlayerProfile;
    subscription: UserSubscription;
    streak: DailyStreakState;
    savedWords: SavedWord[];
    dailyChallengeHistory?: any[];
    practiceFilters?: {
      category: QuestionCategory | 'mixed';
      exam: ExamType;
    };
    dailyTarget?: DailyTargetState | null;
  },
  currentUser?: FirebaseUser | null
): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}`;
  
  try {
    const rawPayload = {
      uid,
      email: currentUser?.email || data.player.email || null,
      displayName: currentUser?.displayName || data.player.name || null,
      photoURL: currentUser?.photoURL || data.player.photoURL || null,
      player: {
        ...data.player,
        photoURL: currentUser?.photoURL || data.player.photoURL || null,
        email: currentUser?.email || data.player.email || null,
        practiceFilters: data.practiceFilters || data.player.practiceFilters || null,
      },
      subscription: {
        isPremium: Boolean(data.subscription?.isPremium),
        planId: data.subscription?.planId || null,
        planName: data.subscription?.planName || null,
        subscribedAt: data.subscription?.subscribedAt || null,
        renewalDate: data.subscription?.renewalDate || null,
        autoRenew: Boolean(data.subscription?.autoRenew),
        provider: data.subscription?.provider || null,
        purchaseToken: data.subscription?.purchaseToken || null,
        orderId: data.subscription?.orderId || null,
        purchaseType: data.subscription?.purchaseType || null,
        expiresAt: data.subscription?.expiresAt || null,
        verifiedAt: data.subscription?.verifiedAt || null,
      },
      streak: data.streak || null,
      savedWords: data.savedWords || [],
      ...(data.dailyChallengeHistory ? { dailyChallengeHistory: data.dailyChallengeHistory } : {}),
      practiceFilters: data.practiceFilters || data.player.practiceFilters || null,
      dailyTarget: data.dailyTarget || null,
      updatedAt: Date.now(),
    };
    
    const cleanPayload = sanitizeForFirestore(rawPayload);

    // ANTI-CONFLICT SAFEGUARD: Stale local cache must NEVER overwrite a higher cloud LP
    const knownCloud = latestCloudLPMap.get(uid);
    if (knownCloud && cleanPayload.player) {
      if (typeof cleanPayload.player.rankPoints === 'number' && cleanPayload.player.rankPoints < knownCloud.rankPoints) {
        console.log(`[Sync] Prevented stale LP overwrite: incoming local ${cleanPayload.player.rankPoints} < known cloud ${knownCloud.rankPoints}`);
        cleanPayload.player.rankPoints = knownCloud.rankPoints;
      }
      cleanPayload.player.matchesPlayed = Math.max(cleanPayload.player.matchesPlayed || 0, knownCloud.matchesPlayed || 0);
      cleanPayload.player.matchesWon = Math.max(cleanPayload.player.matchesWon || 0, knownCloud.matchesWon || 0);
    }

    // ANTI-CONFLICT SAFEGUARD: Stale local cache must NEVER overwrite a legitimate cloud streak with 0
    const knownStreak = latestCloudStreakMap.get(uid);
    if (knownStreak && cleanPayload.streak) {
      if ((cleanPayload.streak.currentStreak || 0) === 0 && knownStreak.currentStreak > 0) {
        const today = new Date().toISOString().split('T')[0];
        const lastActive = knownStreak.lastActiveDate || today;
        const diffDays = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(lastActive + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          console.log(`[Sync] Prevented accidental streak wipe for ${uid}: preserving known cloud streak ${knownStreak.currentStreak}`);
          cleanPayload.streak.currentStreak = knownStreak.currentStreak;
          cleanPayload.streak.longestStreak = Math.max(cleanPayload.streak.longestStreak || 0, knownStreak.longestStreak);
          cleanPayload.streak.lastActiveDate = knownStreak.lastActiveDate;
          cleanPayload.streak.lastActiveTimestamp = Math.max(cleanPayload.streak.lastActiveTimestamp || 0, knownStreak.lastActiveTimestamp);
        }
      }
    }
    
    // Always keep a clean client-side snapshot backup
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`vocabclash_cloud_backup_${uid}`, JSON.stringify(cleanPayload));
      } catch { /* storage full */ }
    }

    // Check if Firestore quota is currently exhausted
    if (isFirestoreQuotaExhausted()) {
      return; // Local backup is safe, avoid triggering Firestore SDK retry loops
    }

    // Check if substantial payload (ignoring exact updatedAt timestamp) has actually changed
    const comparablePayload = { ...cleanPayload, updatedAt: 0 };
    const serialized = JSON.stringify(comparablePayload);
    const lastSaved = lastSavedPayloadMap.get(uid);
    if (lastSaved === serialized) {
      return; // Skip duplicate identical write
    }

    if (isWritingUserData) {
      // If a write is currently in-flight, continue without queuing deep lag
      await new Promise(r => setTimeout(r, 100));
    }

    isWritingUserData = true;
    const userDocRef = doc(db, 'users', uid);
    await withTimeout(setDoc(userDocRef, cleanPayload, { merge: true }), 2500, undefined);
    lastSavedPayloadMap.set(uid, serialized);
    if (cleanPayload.player && typeof cleanPayload.player.rankPoints === 'number') {
      latestCloudLPMap.set(uid, {
        rankPoints: cleanPayload.player.rankPoints,
        matchesPlayed: cleanPayload.player.matchesPlayed || 0,
        matchesWon: cleanPayload.player.matchesWon || 0,
      });
    }
    if (cleanPayload.streak && typeof cleanPayload.streak.currentStreak === 'number') {
      latestCloudStreakMap.set(uid, {
        currentStreak: cleanPayload.streak.currentStreak,
        longestStreak: cleanPayload.streak.longestStreak || 0,
        lastActiveDate: cleanPayload.streak.lastActiveDate || '',
        lastActiveTimestamp: cleanPayload.streak.lastActiveTimestamp || 0,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  } finally {
    isWritingUserData = false;
  }
}

/**
 * Atomically increments or adjusts user LP in Firestore and updates leaderboard & caches.
 * Uses atomic Firestore transactions / field increments so concurrent devices never overwrite each other.
 */
export async function atomicIncrementLPInFirestore(
  uid: string,
  lpDelta: number,
  additionalUpdates?: {
    matchesPlayedDelta?: number;
    matchesWonDelta?: number;
    winStreak?: number;
    pyqScoreDelta?: number;
    targetExam?: string;
  }
): Promise<number | null> {
  if (!uid || uid === 'default_user' || uid.startsWith('guest_') || lpDelta === 0) {
    return null;
  }

  const userDocRef = doc(db, 'users', uid);
  const leaderboardDocRef = doc(db, 'leaderboard', uid);

  try {
    let finalLP = 0;
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : null;
      const currentLP = (userData?.player?.rankPoints as number) ?? (userData?.rankPoints as number) ?? 0;
      const newLP = Math.max(0, currentLP + lpDelta);
      finalLP = newLP;

      const currentMatchesPlayed = (userData?.player?.matchesPlayed as number) ?? 0;
      const currentMatchesWon = (userData?.player?.matchesWon as number) ?? 0;
      const newMatchesPlayed = currentMatchesPlayed + (additionalUpdates?.matchesPlayedDelta || 0);
      const newMatchesWon = currentMatchesWon + (additionalUpdates?.matchesWonDelta || 0);
      const accuracyRate = newMatchesPlayed > 0 ? Math.round((newMatchesWon / newMatchesPlayed) * 100) : 0;

      const userUpdate: Record<string, any> = {
        'player.rankPoints': newLP,
        'player.matchesPlayed': newMatchesPlayed,
        'player.matchesWon': newMatchesWon,
        'player.accuracyRate': accuracyRate,
        updatedAt: Date.now(),
      };

      if (additionalUpdates?.winStreak !== undefined) {
        userUpdate['player.winStreak'] = additionalUpdates.winStreak;
      }
      if (additionalUpdates?.pyqScoreDelta) {
        const currentPyq = (userData?.player?.pyqScore as number) ?? 0;
        userUpdate['player.pyqScore'] = Math.max(0, currentPyq + additionalUpdates.pyqScoreDelta);
      }
      if (additionalUpdates?.targetExam) {
        userUpdate['player.targetExam'] = additionalUpdates.targetExam;
      }

      transaction.set(userDocRef, userUpdate, { merge: true });

      // Keep public leaderboard doc in sync
      const leaderboardUpdate: Record<string, any> = {
        uid,
        rankPoints: newLP,
        matchesPlayed: newMatchesPlayed,
        matchesWon: newMatchesWon,
        winRate: accuracyRate,
        updatedAt: Date.now(),
      };
      if (userData?.player?.name) leaderboardUpdate.name = userData.player.name;
      if (userData?.player?.avatar) leaderboardUpdate.avatar = userData.player.avatar;
      if (userData?.player?.photoURL) leaderboardUpdate.photoURL = userData.player.photoURL;
      if (userData?.player?.targetExam) leaderboardUpdate.targetExam = userData.player.targetExam;
      transaction.set(leaderboardDocRef, leaderboardUpdate, { merge: true });
    });

    latestCloudLPMap.set(uid, {
      rankPoints: finalLP,
      matchesPlayed: (latestCloudLPMap.get(uid)?.matchesPlayed || 0) + (additionalUpdates?.matchesPlayedDelta || 0),
      matchesWon: (latestCloudLPMap.get(uid)?.matchesWon || 0) + (additionalUpdates?.matchesWonDelta || 0),
    });

    console.log(`[Atomic LP] Successfully updated Firestore LP for ${uid}: delta=${lpDelta >= 0 ? '+' : ''}${lpDelta} -> new LP=${finalLP}`);
    return finalLP;
  } catch (err) {
    console.warn('[Atomic LP] Transaction fallback to updateDoc:', err);
    try {
      await updateDoc(userDocRef, {
        'player.rankPoints': increment(lpDelta),
        updatedAt: Date.now(),
      });
      await updateDoc(leaderboardDocRef, {
        rankPoints: increment(lpDelta),
        updatedAt: Date.now(),
      }).catch(() => {});
      return null;
    } catch (fallbackErr) {
      console.error('[Atomic LP] Update failed:', fallbackErr);
      return null;
    }
  }
}

/**
 * Saves a daily challenge attempt to Firestore for authoritative cross-device sync.
 * Writes to both `users/{uid}/dailyChallenges/{date}` and `users/{uid}/daily_challenges/{date}`
 * as well as the root document's `dailyChallenges` map and `dailyChallengeHistory` array.
 */
export async function saveDailyChallengeToFirestore(
  uid: string,
  attempt: any,
  fullHistory: any[]
): Promise<void> {
  if (!uid || uid === 'default_user' || uid.startsWith('guest_')) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const cleanHistory = sanitizeForFirestore(fullHistory || []);
    const cleanAttempt = attempt ? sanitizeForFirestore(attempt) : null;

    const normalizedAttempt = cleanAttempt ? {
      completed: true,
      date: cleanAttempt.date,
      timestamp: cleanAttempt.timestamp ?? Date.now(),
      totalQuestions: cleanAttempt.totalQuestions ?? 20,
      answeredCount: cleanAttempt.answeredCount ?? cleanAttempt.totalQuestions ?? 20,
      correctCount: cleanAttempt.correctCount ?? cleanAttempt.score ?? 0,
      wrongCount: cleanAttempt.wrongCount ?? 0,
      score: cleanAttempt.score ?? 0,
      maxMarks: cleanAttempt.maxMarks ?? cleanAttempt.totalQuestions ?? 20,
      percentage: cleanAttempt.percentage ?? 0,
      timeTakenSeconds: cleanAttempt.timeTakenSeconds ?? 0,
      rankPointsAwarded: cleanAttempt.rankPointsAwarded ?? 0,
      uid,
      userEmail: cleanAttempt.userEmail || auth.currentUser?.email || null,
      updatedAt: Date.now(),
      ...(cleanAttempt.categoryBreakdown ? { categoryBreakdown: cleanAttempt.categoryBreakdown } : {}),
    } : null;

    // 1. Update root document dailyChallenges map and history array
    const rootUpdate: Record<string, any> = {
      dailyChallengeHistory: cleanHistory,
      updatedAt: Date.now(),
    };
    if (normalizedAttempt && normalizedAttempt.date) {
      rootUpdate[`dailyChallenges.${normalizedAttempt.date}`] = normalizedAttempt;
    }

    await withTimeout(
      setDoc(userDocRef, rootUpdate, { merge: true }),
      3500,
      undefined
    );

    // 2. Write specific day record in users/{uid}/dailyChallenges/{date} (canonical path)
    if (normalizedAttempt && normalizedAttempt.date) {
      const dayDocRef1 = doc(db, 'users', uid, 'dailyChallenges', normalizedAttempt.date);
      await withTimeout(
        setDoc(dayDocRef1, normalizedAttempt, { merge: true }),
        3000,
        undefined
      ).catch(() => {});

      // 3. Write specific day record in users/{uid}/daily_challenges/{date} (legacy compatibility path)
      const dayDocRef2 = doc(db, 'users', uid, 'daily_challenges', normalizedAttempt.date);
      await withTimeout(
        setDoc(dayDocRef2, normalizedAttempt, { merge: true }),
        3000,
        undefined
      ).catch(() => {});
    }

    console.log(`[Daily Challenge] Saved to Firestore for ${uid}: date=${normalizedAttempt?.date}, score=${normalizedAttempt?.score}`);
  } catch (err) {
    console.warn('[DAILY CHALLENGE FIRESTORE] Notice saving attempt:', err);
  }
}

/**
 * Deletes a specific day attempt from a user's dailyChallenges subcollection
 */
export async function deleteDailyChallengeDayFromFirestore(uid: string, date: string): Promise<void> {
  if (!uid || uid === 'default_user' || !date) return;
  try {
    const dayDocRef1 = doc(db, 'users', uid, 'dailyChallenges', date);
    const dayDocRef2 = doc(db, 'users', uid, 'daily_challenges', date);
    await Promise.allSettled([
      withTimeout(deleteDoc(dayDocRef1), 2000, undefined),
      withTimeout(deleteDoc(dayDocRef2), 2000, undefined)
    ]);
  } catch (err) {
    console.warn('[DAILY CHALLENGE FIRESTORE] Notice deleting day attempt:', err);
  }
}

/**
 * Fetches daily challenge history from Firestore for cross-device sync.
 * Reads both the root document, the `dailyChallenges` subcollection, and `daily_challenges` subcollection,
 * merging and deduplicating by date so no historical attempts are ever lost.
 */
export async function fetchDailyChallengeHistoryFromFirestore(uid: string): Promise<any[]> {
  if (!uid || uid === 'default_user' || uid.startsWith('guest_')) return [];
  const map = new Map<string, any>();

  try {
    // 1. Fetch from users/{uid} root document
    const userDocRef = doc(db, 'users', uid);
    const snap = await withTimeout(getDoc(userDocRef), 3000, null);
    if (snap && snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.dailyChallengeHistory)) {
        data.dailyChallengeHistory.forEach((item: any) => {
          if (item) {
            const normalized = normalizeDailyChallengeAttempt(item);
            if (normalized && normalized.date) {
              const existing = map.get(normalized.date);
              if (!existing || normalized.score >= existing.score) {
                map.set(normalized.date, normalized);
              }
            }
          }
        });
      }
      if (data?.dailyChallenges && typeof data.dailyChallenges === 'object') {
        Object.entries(data.dailyChallenges).forEach(([d, item]: [string, any]) => {
          if (item && typeof item === 'object') {
            const normalized = normalizeDailyChallengeAttempt({ ...item, date: item.date || d });
            if (normalized && normalized.date) {
              const existing = map.get(normalized.date);
              if (!existing || normalized.score >= existing.score) {
                map.set(normalized.date, normalized);
              }
            }
          }
        });
      }
    }

    // 2. Fetch all day documents from users/{uid}/dailyChallenges subcollection
    const subColRef1 = collection(db, 'users', uid, 'dailyChallenges');
    const subSnap1 = await withTimeout(getDocs(subColRef1), 3000, null).catch(() => null);
    if (subSnap1 && !subSnap1.empty) {
      subSnap1.forEach((docItem) => {
        const item = docItem.data();
        if (item) {
          const normalized = normalizeDailyChallengeAttempt({ ...item, date: item.date || docItem.id });
          if (normalized && normalized.date) {
            const existing = map.get(normalized.date);
            if (!existing || normalized.score >= existing.score) {
              map.set(normalized.date, normalized);
            }
          }
        }
      });
    }

    // 3. Fetch from legacy users/{uid}/daily_challenges subcollection
    const subColRef2 = collection(db, 'users', uid, 'daily_challenges');
    const subSnap2 = await withTimeout(getDocs(subColRef2), 3000, null).catch(() => null);
    if (subSnap2 && !subSnap2.empty) {
      subSnap2.forEach((docItem) => {
        const item = docItem.data();
        if (item) {
          const normalized = normalizeDailyChallengeAttempt({ ...item, date: item.date || docItem.id });
          if (normalized && normalized.date) {
            const existing = map.get(normalized.date);
            if (!existing || normalized.score >= existing.score) {
              map.set(normalized.date, normalized);
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn('[DAILY CHALLENGE FIRESTORE] Notice fetching history:', err);
  }

  return deduplicateDailyChallengeHistory(Array.from(map.values()));
}

/**
 * Fast targeted update for player profile (name, avatar, photoURL, targetExam, etc.)
 * Writes directly to `users/{uid}` with merge: true without serializing huge savedWords arrays.
 * This executes in milliseconds and ensures the chosen target exam and profile details are instantly persisted.
 */
export async function saveUserProfileFieldsToFirestore(
  uid: string,
  player: PlayerProfile,
  currentUser?: FirebaseUser | null
): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}`;
  try {
    const rawPayload = {
      uid,
      displayName: player.name || currentUser?.displayName || null,
      photoURL: player.photoURL !== undefined ? player.photoURL : (currentUser?.photoURL || null),
      email: player.email || currentUser?.email || null,
      player: {
        ...player,
        photoURL: player.photoURL !== undefined ? player.photoURL : (currentUser?.photoURL || null),
        email: player.email || currentUser?.email || null,
      },
      updatedAt: Date.now(),
    };
    const cleanPayload = sanitizeForFirestore(rawPayload);

    // Save local backup snapshot
    if (typeof window !== 'undefined') {
      try {
        const key = `vocabclash_cloud_backup_${uid}`;
        const existingRaw = localStorage.getItem(key);
        const existingData = existingRaw ? JSON.parse(existingRaw) : {};
        existingData.player = cleanPayload.player;
        existingData.displayName = cleanPayload.displayName;
        existingData.photoURL = cleanPayload.photoURL;
        existingData.updatedAt = cleanPayload.updatedAt;
        localStorage.setItem(key, JSON.stringify(existingData));
      } catch { /* storage full */ }
    }

    const userDocRef = doc(db, 'users', uid);
    await withTimeout(setDoc(userDocRef, cleanPayload, { merge: true }), 2000, undefined);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch user state from Firestore (with local cloud backup fallback)
export async function fetchUserDataFromFirestore(uid: string, timeoutMs: number = 4500): Promise<UserCloudData | null> {
  const path = `users/${uid}`;
  try {
    if (isFirestoreQuotaExhausted() && typeof window !== 'undefined') {
      const cached = localStorage.getItem(`vocabclash_cloud_backup_${uid}`);
      if (cached) {
        return JSON.parse(cached) as UserCloudData;
      }
    }

    const userDocRef = doc(db, 'users', uid);
    const [docSnap, challengeHistory] = await Promise.all([
      withTimeout(getDoc(userDocRef), timeoutMs, null),
      fetchDailyChallengeHistoryFromFirestore(uid).catch(() => [])
    ]);

    if (docSnap && docSnap.exists()) {
      const data = docSnap.data() as UserCloudData;

      // Attach complete subcollection daily challenge history to the user cloud data
      if (Array.isArray(challengeHistory) && challengeHistory.length > 0) {
        data.dailyChallengeHistory = challengeHistory;
      }

      if (data.player && typeof data.player.rankPoints === 'number') {
        latestCloudLPMap.set(uid, {
          rankPoints: data.player.rankPoints,
          matchesPlayed: data.player.matchesPlayed || 0,
          matchesWon: data.player.matchesWon || 0,
        });
        console.log(`[Sync] Fetched authoritative cloud profile for ${uid}: LP=${data.player.rankPoints}`);
      }
      if (data.streak && typeof data.streak.currentStreak === 'number') {
        latestCloudStreakMap.set(uid, {
          currentStreak: data.streak.currentStreak,
          longestStreak: data.streak.longestStreak || 0,
          lastActiveDate: data.streak.lastActiveDate || '',
          lastActiveTimestamp: data.streak.lastActiveTimestamp || 0,
        });
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`vocabclash_cloud_backup_${uid}`, JSON.stringify(data));
        } catch { /* ignore */ }
      }
      return data;
    }

    // Check if local backup exists
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`vocabclash_cloud_backup_${uid}`);
      if (cached) {
        return JSON.parse(cached) as UserCloudData;
      }
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`vocabclash_cloud_backup_${uid}`);
        if (cached) {
          return JSON.parse(cached) as UserCloudData;
        }
      } catch { /* ignore */ }
    }
    return null;
  }
}

/**
 * Real-time listener for cross-device synchronization.
 * When a user solves a question on mobile/desktop, the cloud update is instantly
 * pushed to all other active devices without needing a manual refresh.
 */
export function subscribeToUserCloudData(
  uid: string,
  onUpdate: (data: UserCloudData) => void
): () => void {
  if (!uid || uid === 'default_user' || isFirestoreQuotaExhausted()) {
    return () => {};
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserCloudData;
          if (data.player && typeof data.player.rankPoints === 'number') {
            latestCloudLPMap.set(uid, {
              rankPoints: data.player.rankPoints,
              matchesPlayed: data.player.matchesPlayed || 0,
              matchesWon: data.player.matchesWon || 0,
            });
          }
          if (data.streak && typeof data.streak.currentStreak === 'number') {
            latestCloudStreakMap.set(uid, {
              currentStreak: data.streak.currentStreak,
              longestStreak: data.streak.longestStreak || 0,
              lastActiveDate: data.streak.lastActiveDate || '',
              lastActiveTimestamp: data.streak.lastActiveTimestamp || 0,
            });
          }
          onUpdate(data);
        }
      },
      (err) => {
        console.warn('[User Cloud Listener Notice]:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('[User Cloud Listener Setup]:', err);
    return () => {};
  }
}

// Delete user account and all Firestore documents
export async function deleteUserAccountAndData(
  currentUser: FirebaseUser,
  password?: string
): Promise<{ success: boolean; requiresReauth?: boolean; error?: string }> {
  try {
    // 1. Delete Firestore user document
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userDocRef);
    } catch (dbErr) {
      console.warn("Notice deleting user doc:", dbErr);
    }

    // 2. Delete Firebase Auth user
    try {
      await deleteUser(currentUser);
      return { success: true };
    } catch (authErr: any) {
      if (authErr?.code === 'auth/requires-recent-login') {
        if (password && currentUser.email) {
          const credential = EmailAuthProvider.credential(currentUser.email, password);
          await reauthenticateWithCredential(currentUser, credential);
          await deleteUser(currentUser);
          return { success: true };
        }
        return { 
          success: false, 
          requiresReauth: true, 
          error: 'Please re-authenticate with your password to delete your account.' 
        };
      }
      throw authErr;
    }
  } catch (err: any) {
    console.error("Account Deletion Error:", err);
    return { 
      success: false, 
      error: err?.message || 'Failed to delete account. Please try again.' 
    };
  }
}


