import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  runTransaction,
  writeBatch,
  Unsubscribe 
} from 'firebase/firestore';
import { db, sanitizeForFirestore, ensureAuthenticatedUser } from './firebaseService';
import { PlayerProfile, QuestionCategory, ExamType, Question, FriendLobby } from '../types';
import { getFilteredQuestions, getFirstMatchQuestions } from './matchmakingService';
import { LiveDuelRoom } from './realtimeMatchmaking';
import { isAndroidCapacitor } from '../utils/platform';

// In-memory cache of curated questions for the host to avoid re-generating or duplicating
const hostQuestionsCache = new Map<string, Question[]>();

/**
 * Generates a clean, unambiguous 6-digit numeric room code (100000 - 999999)
 */
export function generate6DigitLobbyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a custom 6-digit Friend Lobby in Firestore and backend
 * Writes a LIGHTWEIGHT lobby document (~500 bytes) without the 30-70 KB Question payload.
 */
export async function createFriendLobby(
  host: PlayerProfile,
  category: QuestionCategory | 'mixed',
  exam: ExamType,
  roundCount: number,
  t0: number = Date.now()
): Promise<{ success: boolean; code?: string; roomId?: string; lobby?: FriendLobby; error?: string }> {
  try {
    const c0 = t0;
    console.log(`[FriendLobbyTiming] C0: Create tapped at ${c0} for host: ${host.name || host.id}`);

    const authUser = await ensureAuthenticatedUser();
    if (!authUser || !authUser.uid) {
      throw new Error('Authentication required before creating lobby');
    }
    const c1 = Date.now();
    console.log(`[FriendLobbyTiming] C1: authentication ready in ${c1 - c0}ms`);

    const verifiedHost: PlayerProfile = {
      ...host,
      id: authUser.uid,
    };

    let code = generate6DigitLobbyCode();
    const c2 = Date.now();
    console.log(`[FriendLobbyTiming] C2: code generated in ${c2 - c0}ms (Code: ${code})`);

    let lobbyRef = doc(db, 'friend_lobbies', code);

    // Ensure no room-code collision in Firestore
    try {
      let existingSnap = await getDoc(lobbyRef);
      let attempts = 0;
      while (existingSnap.exists() && attempts < 5) {
        const data = existingSnap.data() as FriendLobby;
        if (data.status === 'waiting' && data.expiresAt > Date.now()) {
          code = generate6DigitLobbyCode();
          lobbyRef = doc(db, 'friend_lobbies', code);
          existingSnap = await getDoc(lobbyRef);
          attempts++;
        } else {
          break;
        }
      }
    } catch (checkErr) {
      console.warn('[FriendLobby] Collision check notice (safe to ignore if non-existent document):', checkErr);
    }

    const c3 = Date.now();
    console.log(`[FriendLobbyTiming] C3: collision check complete in ${c3 - c0}ms`);

    const roomId = `duel_friend_${code}_${Date.now()}`;
    const now = Date.now();

    // Curate synchronized questions locally (synchronous, in-memory)
    const questions = verifiedHost.matchesPlayed === 0 && roundCount === 10 && category === 'mixed'
      ? getFirstMatchQuestions(exam)
      : getFilteredQuestions(category, exam, roundCount);

    // Cache questions locally on host for authoritative match start
    hostQuestionsCache.set(roomId, questions);

    // LIGHTWEIGHT waiting-room document: metadata only, NO large questions array!
    const lightweightLobbyDoc = {
      code,
      roomId,
      host: verifiedHost,
      guest: null,
      category,
      exam,
      roundCount,
      status: 'waiting',
      questions: [], // 2-byte empty array for rule compatibility
      hostReady: true,
      guestReady: false,
      createdAt: now,
      expiresAt: now + 1800000, // 30 minutes TTL
      updatedAt: now,
    };

    // Payload comparison measurement
    const lightSize = JSON.stringify(lightweightLobbyDoc).length;
    const oldSimulatedSize = JSON.stringify({ ...lightweightLobbyDoc, questions }).length;
    console.log(`[FriendLobbyPayload] Lightweight lobby size: ${lightSize} bytes (Old full payload: ${oldSimulatedSize} bytes, saved: ${((oldSimulatedSize - lightSize) / 1024).toFixed(1)} KB / ${(((oldSimulatedSize - lightSize) / oldSimulatedSize) * 100).toFixed(1)}%)`);

    const sanitizedLightweightData = sanitizeForFirestore(lightweightLobbyDoc);

    // 1. Write to authoritative canonical Firestore collection (friend_lobbies)
    const c4 = Date.now();
    console.log(`[FriendLobbyTiming] C4: lightweight lobby write started in ${c4 - c0}ms`);

    await setDoc(lobbyRef, sanitizedLightweightData);

    const c5 = Date.now();
    console.log(`[FriendLobbyTiming] C5: lightweight lobby write resolved in ${c5 - c0}ms (${c5 - c4}ms Firestore write latency)`);

    // 2. Secondary non-blocking operation: friendRooms alias write
    (async () => {
      try {
        const aliasRef = doc(db, 'friendRooms', code);
        await setDoc(aliasRef, sanitizedLightweightData);
      } catch (aliasErr) {
        console.warn('[FriendLobby] Alias write notice (background):', aliasErr);
      }
    })();

    // 3. Secondary non-blocking operation: Server API registration
    if (!isAndroidCapacitor()) {
      (async () => {
        try {
          await fetch('/api/lobby/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              roomId,
              host: verifiedHost,
              category,
              exam,
              roundCount,
            }),
          });
        } catch (serverErr) {
          console.warn('[FriendLobby] Server registration notice (background):', serverErr);
        }
      })();
    }

    // Return the lobby with cached questions in host's memory so host is ready
    const returnLobby: FriendLobby = {
      ...lightweightLobbyDoc,
      guest: null as any,
      status: 'waiting',
      questions,
    };

    console.log('[FriendLobby] room created and returning immediately:', code);
    return { success: true, code, roomId, lobby: returnLobby };
  } catch (error: any) {
    console.error('[FriendLobby] Error creating friend lobby:', error);
    return { success: false, error: error.message || 'Failed to create lobby' };
  }
}

/**
 * Joins an existing 6-digit Friend Lobby using an atomic Firestore transaction
 * Operates on a lightweight document without downloading heavy Question payloads.
 */
export async function joinFriendLobby(
  code: string,
  guest: PlayerProfile,
  j0: number = Date.now()
): Promise<{ success: boolean; lobby?: FriendLobby; error?: string }> {
  const cleanCode = code.trim().replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit numeric room code.' };
  }

  console.log(`[FriendLobbyTiming] J0: Join tapped at ${j0} for code: ${cleanCode}`);

  const authUser = await ensureAuthenticatedUser();
  if (!authUser || !authUser.uid) {
    return { success: false, error: 'Authentication required before joining lobby.' };
  }
  const j1 = Date.now();
  console.log(`[FriendLobbyTiming] J1: authentication ready in ${j1 - j0}ms`);

  const verifiedGuest: PlayerProfile = {
    ...guest,
    id: authUser.uid,
  };

  console.log('[FriendLobby] joining room', cleanCode, 'as verified guest:', verifiedGuest.id);

  try {
    const lobbyRef = doc(db, 'friend_lobbies', cleanCode);

    const j2 = Date.now();
    console.log(`[FriendLobbyTiming] J2: transaction started in ${j2 - j0}ms`);

    // Execute atomic transaction to prevent two people joining the same slot simultaneously
    const result = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(lobbyRef);
      console.log('[FriendLobby] room exists:', snapshot.exists());

      if (!snapshot.exists()) {
        // Try fallback to alias path
        return { notFound: true };
      }

      const lobbyData = snapshot.data() as FriendLobby;

      // Validate Host cannot join own room
      if (lobbyData.host.id === verifiedGuest.id) {
        return { 
          isSelf: true, 
          lobby: lobbyData,
          error: 'You created this room. To test cross-device play, open VocabClash on another device or private window and join from a different account.'
        };
      }

      // Validate Status
      if (lobbyData.status === 'cancelled') {
        return { error: 'This lobby was cancelled by the host.' };
      }

      if (lobbyData.status === 'in_progress') {
        return { error: 'The battle in this room has already started.' };
      }

      if (lobbyData.expiresAt && lobbyData.expiresAt < Date.now()) {
        return { error: 'This room has expired. Ask your friend to create a new lobby.' };
      }

      if (lobbyData.guest && lobbyData.guest.id !== verifiedGuest.id && lobbyData.status !== 'waiting') {
        return { error: 'This lobby already has two players.' };
      }

      // Atomic Guest Assignment on lightweight lobby document
      const updatedLobby: FriendLobby = {
        ...lobbyData,
        guest: verifiedGuest,
        guestReady: true,
        status: 'ready',
        updatedAt: Date.now(),
      };

      transaction.update(lobbyRef, sanitizeForFirestore({
        guest: verifiedGuest,
        guestReady: true,
        status: 'ready',
        updatedAt: Date.now(),
      }));

      return { success: true, lobby: updatedLobby };
    });

    const j3 = Date.now();
    console.log(`[FriendLobbyTiming] J3: transaction complete in ${j3 - j0}ms (${j3 - j2}ms Firestore transaction latency)`);

    if (result.notFound) {
      // Fallback check against server in-memory / Firestore alias
      let fallbackLobby: FriendLobby | null = null;

      try {
        const aliasRef = doc(db, 'friendRooms', cleanCode);
        const aliasSnap = await getDoc(aliasRef);
        if (aliasSnap.exists()) {
          fallbackLobby = aliasSnap.data() as FriendLobby;
        }
      } catch {
        // ignore
      }

      if (!fallbackLobby && !isAndroidCapacitor()) {
        try {
          const res = await fetch(`/api/lobby/${cleanCode}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.lobby) {
              fallbackLobby = json.lobby;
            }
          }
        } catch {
          // ignore
        }
      }

      if (fallbackLobby) {
        if (fallbackLobby.host.id === verifiedGuest.id) {
          return {
            success: false,
            error: 'You created this room. Join from a different account/device to duel as a challenger.'
          };
        }
        if (fallbackLobby.status === 'cancelled') {
          return { success: false, error: 'This lobby was cancelled by the host.' };
        }
        if (fallbackLobby.status === 'in_progress') {
          return { success: false, error: 'The battle in this room has already started.' };
        }
        if (fallbackLobby.guest && fallbackLobby.guest.id !== verifiedGuest.id && fallbackLobby.status !== 'waiting') {
          return { success: false, error: 'This lobby already has two players.' };
        }

        const updatedLobby: FriendLobby = {
          ...fallbackLobby,
          guest: verifiedGuest,
          guestReady: true,
          status: 'ready',
          updatedAt: Date.now(),
        };

        // Write back to Firestore main path
        await setDoc(lobbyRef, sanitizeForFirestore(updatedLobby), { merge: true }).catch(() => {});

        console.log('[FriendLobby] guest joined (fallback resolution)');
        return { success: true, lobby: updatedLobby };
      }

      return { 
        success: false, 
        error: `Room #${cleanCode} not found. Please confirm the 6-digit code with your friend.` 
      };
    }

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.isSelf) {
      return { success: false, error: result.error, lobby: result.lobby };
    }

    // Sync with server API (web browser only)
    if (!isAndroidCapacitor()) {
      try {
        fetch('/api/lobby/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: cleanCode,
            guest: verifiedGuest,
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }

    console.log('[FriendLobby] guest joined successfully');
    return { success: true, lobby: result.lobby };
  } catch (error: any) {
    console.error('[FriendLobby] Error joining friend lobby:', error);
    const msg = error.message || '';
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
      return { success: false, error: 'Unable to access this lobby. Please try again.' };
    }
    if (msg.includes('network') || msg.includes('unavailable')) {
      return { success: false, error: 'Unable to connect to the lobby. Check your internet connection and try again.' };
    }
    return { success: false, error: error.message || 'Failed to join lobby' };
  }
}

/**
 * Subscribes to real-time changes of a Friend Lobby (room joins, readiness, match start)
 * Uses simultaneous Firestore onSnapshot + active server polling for 100% reliable cross-device sync on web.
 * On Capacitor Android, uses purely Firestore onSnapshot to prevent relative HTTP calls to localhost.
 */
export function subscribeToFriendLobby(
  code: string,
  onUpdate: (lobby: FriendLobby) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const cleanCode = code.trim().replace(/\D/g, '');
  const lobbyRef = doc(db, 'friend_lobbies', cleanCode);

  let lastUpdatedAt = 0;
  let isUnsubscribed = false;

  const handleUpdateSafe = (data: FriendLobby) => {
    if (isUnsubscribed || !data) return;
    if (data.updatedAt && data.updatedAt >= lastUpdatedAt) {
      lastUpdatedAt = data.updatedAt;
      onUpdate(data);
    } else if (!lastUpdatedAt) {
      lastUpdatedAt = data.updatedAt || Date.now();
      onUpdate(data);
    }
  };

  // 1. Real-time Firestore snapshot (Primary source on all platforms)
  let unsubscribeFirestore: Unsubscribe = () => {};
  try {
    unsubscribeFirestore = onSnapshot(
      lobbyRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FriendLobby;
          handleUpdateSafe(data);
        }
      },
      (err) => {
        console.warn('[FriendLobby] Firestore snapshot notification:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('[FriendLobby] Firestore subscribe error:', err);
  }

  // 2. Active server polling heartbeat (every 800ms) - Web browser only
  let pollInterval: any = null;
  if (!isAndroidCapacitor()) {
    pollInterval = setInterval(async () => {
      if (isUnsubscribed) return;
      try {
        const res = await fetch(`/api/lobby/${cleanCode}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.lobby) {
            handleUpdateSafe(json.lobby);
          }
        }
      } catch {
        // ignore network blips
      }
    }, 800);
  }

  return () => {
    isUnsubscribed = true;
    if (pollInterval) clearInterval(pollInterval);
    try {
      unsubscribeFirestore();
    } catch {
      // ignore
    }
  };
}

/**
 * Host launches the match from the lobby:
 * 1. Creates the synchronized LiveDuelRoom in Firestore with the authoritative questions
 * 2. Updates lobby status to 'in_progress' (lightweight update without questions)
 * 3. Updates Server API (web browser background)
 */
export async function launchFriendLobbyDuel(
  lobby: FriendLobby,
  s0: number = Date.now()
): Promise<{ success: boolean; roomId?: string; questions?: Question[]; error?: string }> {
  try {
    console.log(`[FriendLobbyTiming] S0: Start match requested at ${s0} for code: ${lobby.code}`);

    if (!lobby.guest) {
      return { success: false, error: 'Cannot start duel without a second player.' };
    }

    const authUser = await ensureAuthenticatedUser();
    if (!authUser || !authUser.uid) {
      return { success: false, error: 'Authentication required before launching duel.' };
    }

    // Diagnostic validation: host identity must match authUser.uid
    if (lobby.host.id !== authUser.uid) {
      console.warn(`[FriendLobby] Host ID mismatch in lobby object: lobby.host.id=${lobby.host.id}, authUser.uid=${authUser.uid}. Enforcing authenticated UID.`);
    }

    const verifiedHost: PlayerProfile = {
      ...lobby.host,
      id: authUser.uid,
    };

    const roomId = lobby.roomId || `duel_friend_${lobby.code}_${Date.now()}`;
    const roomRef = doc(db, 'live_rooms', roomId);
    const lobbyRef = doc(db, 'friend_lobbies', lobby.code);

    // Retrieve curated questions: either from host's in-memory cache, lobby object, or generate synchronously
    const questions = (lobby.questions && lobby.questions.length > 0)
      ? lobby.questions
      : (hostQuestionsCache.get(roomId) || (verifiedHost.matchesPlayed === 0 && lobby.roundCount === 10 && lobby.category === 'mixed'
          ? getFirstMatchQuestions(lobby.exam)
          : getFilteredQuestions(lobby.category, lobby.exam, lobby.roundCount)));

    // Ensure cache has the authoritative match questions
    hostQuestionsCache.set(roomId, questions);

    const liveRoomData: LiveDuelRoom = {
      id: roomId,
      roomId,
      mode: 'friend_lobby',
      category: lobby.category,
      exam: lobby.exam,
      roundCount: lobby.roundCount,
      player1: verifiedHost,
      player2: lobby.guest,
      questions, // Authoritative match questions stored in live_rooms/{roomId}
      status: 'in_progress',
      scores: {
        [verifiedHost.id]: 0,
        [lobby.guest.id]: 0,
      },
      combos: {
        [verifiedHost.id]: 0,
        [lobby.guest.id]: 0,
      },
      answers: {
        [verifiedHost.id]: [],
        [lobby.guest.id]: [],
      },
      completedPlayers: [],
      activeEmotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const sanitizedLiveRoom = sanitizeForFirestore(liveRoomData);

    const s1 = Date.now();
    console.log(`[FriendLobbyTiming] S1: atomic writeBatch start in ${s1 - s0}ms (roomId: ${roomId}, host: ${verifiedHost.id})`);

    // Execute atomic writeBatch commit: live_rooms and friend_lobbies commit together
    try {
      const batch = writeBatch(db);
      batch.set(roomRef, sanitizedLiveRoom);
      batch.set(lobbyRef, sanitizeForFirestore({
        status: 'in_progress',
        roomId,
        updatedAt: Date.now(),
      }), { merge: true });

      await batch.commit();
    } catch (writeErr: any) {
      console.error('[FriendLobby] Firestore atomic writeBatch commit failed:', writeErr);
      const isPerm = writeErr?.code === 'permission-denied' || (writeErr?.message && writeErr.message.includes('permission'));
      return {
        success: false,
        error: isPerm
          ? 'Unable to start match: permission denied. Please verify both players are in the lobby.'
          : (writeErr?.message || 'Failed to start match due to database write failure.')
      };
    }

    const s2 = Date.now();
    console.log(`[FriendLobbyTiming] S2: atomic batch commit complete in ${s2 - s0}ms (${s2 - s1}ms Firestore batch write latency)`);

    // 3. Update Server API non-blocking in background (web browser only)
    if (!isAndroidCapacitor()) {
      fetch('/api/lobby/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: lobby.code,
          hostId: lobby.host.id,
          questions,
        }),
      }).catch((serverErr) => {
        console.warn('[FriendLobby] Server match start notice:', serverErr);
      });
    }

    return { success: true, roomId, questions };
  } catch (error: any) {
    console.error('[FriendLobby] Error launching friend lobby duel:', error);
    return { success: false, error: error.message || 'Failed to start duel' };
  }
}

export interface FetchLiveRoomQuestionsResult {
  success: boolean;
  questions: Question[];
  error?: string;
  isPermissionDenied?: boolean;
}

/**
 * Fetches authoritative match questions from live_rooms/{roomId} for the Guest.
 * Because the Host commits both live_rooms and friend_lobbies in an atomic writeBatch,
 * a direct getDoc resolves immediately without waiting for listener propagation.
 * Includes short bounded retries (250ms, 500ms, 1000ms) for transient network anomalies.
 * If retries fail or if permission is denied, NO emergency local questions are generated.
 * Returns a clear result object so the Guest can retry fetching the authoritative room.
 */
export async function fetchLiveRoomQuestions(
  roomId: string,
  guestPlayer?: PlayerProfile,
  g4: number = Date.now()
): Promise<FetchLiveRoomQuestionsResult> {
  const g4a = Date.now();
  console.log(`[FriendLobbyTiming] G4A: live_rooms getDoc started at ${g4a} (${g4a - g4}ms from G4) for room: ${roomId}`);

  // Confirm authenticated Firebase UID exists before reading live_rooms/{roomId}
  const authUser = await ensureAuthenticatedUser();
  const currentUid = authUser?.uid || null;

  if (!currentUid) {
    console.error(`[FriendLobby] Auth Guard Warning: Guest has no authenticated Firebase UID before reading live_rooms/${roomId}`);
  }

  const roomRef = doc(db, 'live_rooms', roomId);
  const retryDelays = [250, 500, 1000];

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const snap = await getDoc(roomRef);
      const g4b = Date.now();
      const fromCache = snap.metadata?.fromCache ?? false;
      console.log(`[FriendLobbyTiming] G4B: live_rooms getDoc resolved in ${g4b - g4a}ms (attempt ${attempt + 1}, exists: ${snap.exists()}, fromCache: ${fromCache})`);

      if (snap.exists()) {
        const data = snap.data() as LiveDuelRoom;
        const questions = data.questions;
        if (questions && Array.isArray(questions) && questions.length > 0) {
          const g4c = Date.now();
          console.log(`[FriendLobbyTiming] G4C: questions extracted in ${g4c - g4a}ms total from G4A (${g4c - g4}ms from G4, ${questions.length} questions)`);
          return {
            success: true,
            questions,
          };
        } else {
          console.warn(`[FriendLobby] live_rooms/${roomId} exists but questions array is missing or empty on attempt ${attempt + 1}`);
        }
      } else {
        console.warn(`[FriendLobby] live_rooms/${roomId} unavailable (does not exist yet) on attempt ${attempt + 1}`);
      }
    } catch (err: any) {
      const g4b = Date.now();
      const isPermissionDenied = err?.code === 'permission-denied' || (err?.message && err.message.includes('permission'));
      console.error(`[FriendLobbyTiming] G4B: live_rooms getDoc rejected in ${g4b - g4a}ms on attempt ${attempt + 1}:`, {
        code: err?.code,
        message: err?.message,
        isPermissionDenied,
        activeUID: currentUid,
        roomId,
        guestId: guestPlayer?.id,
      });

      if (isPermissionDenied) {
        console.error(`[FriendLobby] Diagnostic PERMISSION-DENIED reading live_rooms/${roomId}:`, {
          activeUID: currentUid,
          roomId,
          guestPlayerId: guestPlayer?.id,
          errorCode: err?.code,
          errorMessage: err?.message,
        });
        // Fail immediately on permission-denied; do not retry as a network failure
        return {
          success: false,
          questions: [],
          error: 'Permission denied reading duel room.',
          isPermissionDenied: true,
        };
      }
    }

    if (attempt < retryDelays.length) {
      const delay = retryDelays[attempt];
      console.log(`[FriendLobbyTiming] retry attempted in ${delay}ms (attempt ${attempt + 1}/${retryDelays.length}) for room: ${roomId}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  console.warn(`[FriendLobby] Bounded retries exhausted for live_rooms/${roomId}. No emergency fallback questions will be generated.`);
  return {
    success: false,
    questions: [],
    error: "Couldn't load the battle. Tap to retry.",
    isPermissionDenied: false,
  };
}

/**
 * Leaves or cancels the lobby
 */
export async function leaveOrCancelLobby(
  code: string,
  playerId: string,
  isHost: boolean
): Promise<void> {
  const cleanCode = code.trim().replace(/\D/g, '');
  if (!cleanCode) return;

  try {
    const lobbyRef = doc(db, 'friend_lobbies', cleanCode);

    if (isHost) {
      await updateDoc(lobbyRef, {
        status: 'cancelled',
        updatedAt: Date.now(),
      }).catch(() => {});
      setTimeout(() => {
        deleteDoc(lobbyRef).catch(() => {});
      }, 5000);
    } else {
      await updateDoc(lobbyRef, {
        guest: null,
        guestReady: false,
        status: 'waiting',
        updatedAt: Date.now(),
      }).catch(() => {});
    }

    // Call server endpoint (web browser only)
    if (!isAndroidCapacitor()) {
      fetch('/api/lobby/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          playerId,
        }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[FriendLobby] Error leaving lobby:', err);
  }
}

