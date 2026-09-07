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
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
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
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PlayerProfile, UserSubscription, DailyStreakState, SavedWord, QuestionCategory, ExamType } from '../types';

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

// Helper to create configured Google Auth Provider
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export const googleProvider = createGoogleProvider();

// Initialize Firestore with auto-detect long polling to establish fast streams and gracefully fallback
let dbInstance: ReturnType<typeof getFirestore>;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
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
  practiceFilters?: {
    category: QuestionCategory | 'mixed';
    exam: ExamType;
  };
  updatedAt: number;
}

// Human-readable auth error mapper
export function getFriendlyAuthErrorMessage(error: any): string {
  const code = (error?.code || '').toLowerCase();
  const rawMsg = (error?.message || (typeof error === 'string' ? error : '')).trim();
  const message = rawMsg.toLowerCase();

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

// Sign in with Google (Popup with optional redirect fallback)
export async function signInWithGoogle(forceRedirect = false): Promise<FirebaseUser | null> {
  try {
    const provider = createGoogleProvider();
    if (forceRedirect) {
      await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      return null;
    }
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    try {
      const addInfo = getAdditionalUserInfo(result);
      if (addInfo?.isNewUser) {
        trackSignup('google');
      }
    } catch {
      // ignore
    }
    return result.user;
  } catch (error: any) {
    const msg = String(error?.message || error || '').toLowerCase();
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
        return retryResult.user;
      } catch (retryErr) {
        console.warn('Retry after database closing error failed:', retryErr);
        throw retryErr;
      }
    }
    console.warn('Google Sign-In failed or was cancelled:', error);
    throw error;
  }
}

// Direct Google Sign-In via Full-Page Redirect
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = createGoogleProvider();
  await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
}

// Check for pending redirect sign-in result on page load
export async function checkRedirectAuthResult(): Promise<FirebaseUser | null> {
  try {
    const res = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (res?.user) {
      try {
        const addInfo = getAdditionalUserInfo(res);
        if (addInfo?.isNewUser) {
          trackSignup('google');
        }
      } catch {
        // ignore
      }
    }
    return res?.user || null;
  } catch (err: any) {
    console.warn('getRedirectResult check:', err);
    return null;
  }
}

// Create Account / Register with Email & Password
export async function registerWithEmailPassword(
  email: string, 
  password: string, 
  displayName?: string
): Promise<FirebaseUser> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(userCredential.user, {
        displayName: displayName.trim(),
      });
    }
    trackSignup('email');
    return userCredential.user;
  } catch (error: any) {
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

// Sign out
export async function logOut(): Promise<void> {
  await fbSignOut(auth);
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

// In-memory write tracking to prevent write stream flooding
const lastSavedPayloadMap = new Map<string, string>();
let isWritingUserData = false;

// Save complete user state to Firestore
export async function saveUserDataToFirestore(
  uid: string,
  data: {
    player: PlayerProfile;
    subscription: UserSubscription;
    streak: DailyStreakState;
    savedWords: SavedWord[];
    practiceFilters?: {
      category: QuestionCategory | 'mixed';
      exam: ExamType;
    };
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
      },
      streak: data.streak || null,
      savedWords: data.savedWords || [],
      practiceFilters: data.practiceFilters || data.player.practiceFilters || null,
      updatedAt: Date.now(),
    };
    
    const cleanPayload = sanitizeForFirestore(rawPayload);
    
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
      // If a write is currently in-flight, wait a short moment to avoid concurrent write stream overloading
      await new Promise(r => setTimeout(r, 200));
    }

    isWritingUserData = true;
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, cleanPayload, { merge: true });
    lastSavedPayloadMap.set(uid, serialized);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  } finally {
    isWritingUserData = false;
  }
}

// Fetch user state from Firestore (with local cloud backup fallback)
export async function fetchUserDataFromFirestore(uid: string): Promise<UserCloudData | null> {
  const path = `users/${uid}`;
  try {
    if (isFirestoreQuotaExhausted() && typeof window !== 'undefined') {
      const cached = localStorage.getItem(`vocabclash_cloud_backup_${uid}`);
      if (cached) {
        return JSON.parse(cached) as UserCloudData;
      }
    }

    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserCloudData;
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


