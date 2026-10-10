import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  runTransaction,
  Unsubscribe 
} from 'firebase/firestore';
import { db, sanitizeForFirestore, ensureAuthenticatedUser } from './firebaseService';
import { PlayerProfile, QuestionCategory, ExamType, Question, FriendLobby } from '../types';
import { getFilteredQuestions, getFirstMatchQuestions } from './matchmakingService';
import { LiveDuelRoom } from './realtimeMatchmaking';
import { isAndroidCapacitor } from '../utils/platform';

/**
 * Generates a clean, unambiguous 6-digit numeric room code (100000 - 999999)
 */
export function generate6DigitLobbyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a custom 6-digit Friend Lobby in Firestore and backend
 */
export async function createFriendLobby(
  host: PlayerProfile,
  category: QuestionCategory | 'mixed',
  exam: ExamType,
  roundCount: number,
  t0: number = Date.now()
): Promise<{ success: boolean; code?: string; roomId?: string; lobby?: FriendLobby; error?: string }> {
  try {
    console.log('[FriendLobby] initializing lobby creation for host:', host.displayName || host.username || host.id);
    const authUser = await ensureAuthenticatedUser();
    if (!authUser || !authUser.uid) {
      throw new Error('Authentication required before creating lobby');
    }
    const verifiedHost: PlayerProfile = {
      ...host,
      id: authUser.uid,
    };

    let code = generate6DigitLobbyCode();
    const t1 = Date.now();
    console.log(`[FriendLobbyTiming] T1: code generated in ${t1 - t0}ms (Code: ${code})`);

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

    const t2 = Date.now();
    console.log(`[FriendLobbyTiming] T2: collision check ready in ${t2 - t0}ms`);

    console.log('[FriendLobby] creating room', code);

    const roomId = `duel_friend_${code}_${Date.now()}`;
    const now = Date.now();

    // Curate synchronized questions
    const questions = verifiedHost.matchesPlayed === 0 && roundCount === 10 && category === 'mixed'
      ? getFirstMatchQuestions(exam)
      : getFilteredQuestions(category, exam, roundCount);

    const lobbyData: FriendLobby = {
      code,
      roomId,
      host: verifiedHost,
      guest: null as any,
      category,
      exam,
      roundCount,
      status: 'waiting',
      questions,
      hostReady: true,
      guestReady: false,
      createdAt: now,
      expiresAt: now + 1800000, // 30 minutes TTL
      updatedAt: now,
    };

    const sanitizedData = sanitizeForFirestore(lobbyData);

    // 1. Write to authoritative canonical Firestore collection (friend_lobbies)
    await setDoc(lobbyRef, sanitizedData);

    const t3 = Date.now();
    console.log(`[FriendLobbyTiming] T3: canonical friend_lobbies write complete in ${t3 - t0}ms`);

    // 2. Secondary non-blocking operation: friendRooms alias write
    (async () => {
      try {
        const aliasRef = doc(db, 'friendRooms', code);
        await setDoc(aliasRef, sanitizedData);
        const t5 = Date.now();
        console.log(`[FriendLobbyTiming] T5: alias write complete in ${t5 - t0}ms`);
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
              host,
              category,
              exam,
              roundCount,
              questions,
            }),
          });
          const t6 = Date.now();
          console.log(`[FriendLobbyTiming] T6: /api/lobby/create complete in ${t6 - t0}ms`);
        } catch (serverErr) {
          console.warn('[FriendLobby] Server registration notice (background):', serverErr);
        }
      })();
    } else {
      const t6 = Date.now();
      console.log(`[FriendLobbyTiming] T6: /api/lobby/create skipped on Android (${t6 - t0}ms from tap)`);
    }

    console.log('[FriendLobby] room created and returning immediately:', code);
    return { success: true, code, roomId, lobby: lobbyData };
  } catch (error: any) {
    console.error('[FriendLobby] Error creating friend lobby:', error);
    return { success: false, error: error.message || 'Failed to create lobby' };
  }
}

/**
 * Joins an existing 6-digit Friend Lobby using an atomic Firestore transaction
 */
export async function joinFriendLobby(
  code: string,
  guest: PlayerProfile
): Promise<{ success: boolean; lobby?: FriendLobby; error?: string }> {
  const cleanCode = code.trim().replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit numeric room code.' };
  }

  const authUser = await ensureAuthenticatedUser();
  if (!authUser || !authUser.uid) {
    return { success: false, error: 'Authentication required before joining lobby.' };
  }
  const verifiedGuest: PlayerProfile = {
    ...guest,
    id: authUser.uid,
  };

  console.log('[FriendLobby] joining room', cleanCode, 'as verified guest:', verifiedGuest.id);

  try {
    const lobbyRef = doc(db, 'friend_lobbies', cleanCode);

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

      // Atomic Guest Assignment
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

    console.log('[FriendLobby] guest joined');
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
 * 1. Creates the synchronized LiveDuelRoom in Firestore
 * 2. Updates lobby status to 'in_progress'
 * 3. Updates Server API (web browser background)
 */
export async function launchFriendLobbyDuel(
  lobby: FriendLobby
): Promise<{ success: boolean; roomId?: string; questions?: Question[]; error?: string }> {
  try {
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

    const questions = (lobby.questions && lobby.questions.length > 0)
      ? lobby.questions
      : getFilteredQuestions(lobby.category, lobby.exam, lobby.roundCount);

    const liveRoomData: LiveDuelRoom = {
      id: roomId,
      roomId,
      mode: 'friend_lobby',
      category: lobby.category,
      exam: lobby.exam,
      roundCount: lobby.roundCount,
      player1: verifiedHost,
      player2: lobby.guest,
      questions,
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

    const h3 = Date.now();
    console.log(`[FriendLobbyTiming] H3: launch Firestore writes started (roomId: ${roomId}, host: ${verifiedHost.id}) at ${h3}`);

    // Execute writes with explicit diagnostic logging to isolate any individual failure or permission error
    try {
      await Promise.all([
        setDoc(roomRef, sanitizedLiveRoom).catch((err) => {
          console.error(`[FriendLobby] setDoc live_rooms/${roomId} failed:`, err);
          throw err;
        }),
        setDoc(lobbyRef, sanitizeForFirestore({
          status: 'in_progress',
          roomId,
          updatedAt: Date.now(),
        }), { merge: true }).catch((err) => {
          console.error(`[FriendLobby] setDoc friend_lobbies/${lobby.code} failed:`, err);
          throw err;
        }),
      ]);
    } catch (writeErr: any) {
      console.error('[FriendLobby] Firestore start writes failed:', writeErr);
      const isPerm = writeErr?.code === 'permission-denied' || (writeErr?.message && writeErr.message.includes('permission'));
      return {
        success: false,
        error: isPerm
          ? 'Unable to start match: permission denied. Please verify both players are in the lobby.'
          : (writeErr?.message || 'Failed to start match due to database write failure.')
      };
    }

    const h4 = Date.now();
    console.log(`[FriendLobbyTiming] H4: both Firestore writes complete in ${h4 - h3}ms`);

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

