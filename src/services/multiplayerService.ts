import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from './firebaseService';
import { PlayerProfile, ExamType, QuestionCategory, Question, PlayerAnswerRecord } from '../types';
import { getFilteredQuestions } from './matchmakingService';

export interface DuelRoomData {
  roomCode: string;
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge' | 'friend_duel';
  exam: ExamType;
  category: QuestionCategory | 'mixed';
  isPublic: boolean;
  host: PlayerProfile;
  guest: PlayerProfile | null;
  questions: Question[];
  status: 'waiting' | 'starting' | 'in_round' | 'finished' | 'abandoned';
  hostScore: number;
  guestScore: number;
  hostCurrentIndex: number;
  guestCurrentIndex: number;
  hostCombo: number;
  guestCombo: number;
  hostAnswers?: PlayerAnswerRecord[];
  guestAnswers?: PlayerAnswerRecord[];
  hostEmote: { emoji: string; text?: string; timestamp: number } | null;
  guestEmote: { emoji: string; text?: string; timestamp: number } | null;
  hostFinished: boolean;
  guestFinished: boolean;
  createdAt: number;
  updatedAt: number;
}

// Generate friendly, unambiguous 6-character room codes (e.g. 7KX4P9)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return code;
}

// Create a new Duel Room (for Friend Play or Public Matchmaking Host)
export async function createDuelRoom(
  host: PlayerProfile,
  exam: ExamType,
  category: QuestionCategory | 'mixed',
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge' | 'friend_duel' = '1v1_ranked',
  isPublic: boolean = false
): Promise<{ roomCode: string; roomData: DuelRoomData }> {
  const roundCount = mode === 'quick_duel' ? 10 : 20;
  const questions = getFilteredQuestions(category, exam, roundCount);

  let roomCode = generateRoomCode();
  let path = `duel_rooms/${roomCode}`;

  // Ensure code is unique by checking if exists
  try {
    const existingSnap = await getDoc(doc(db, 'duel_rooms', roomCode));
    if (existingSnap.exists()) {
      roomCode = generateRoomCode();
      path = `duel_rooms/${roomCode}`;
    }
  } catch {
    // proceed
  }

  const roomData: DuelRoomData = {
    roomCode,
    mode,
    exam,
    category,
    isPublic,
    host,
    guest: null,
    questions,
    status: 'waiting',
    hostScore: 0,
    guestScore: 0,
    hostCurrentIndex: 0,
    guestCurrentIndex: 0,
    hostCombo: 0,
    guestCombo: 0,
    hostAnswers: [],
    guestAnswers: [],
    hostEmote: null,
    guestEmote: null,
    hostFinished: false,
    guestFinished: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const cleanPayload = sanitizeForFirestore(roomData);
    await setDoc(doc(db, 'duel_rooms', roomCode), cleanPayload);
    return { roomCode, roomData };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Join an existing Duel Room with a 6-character Friend Code
export async function joinDuelRoom(
  roomCodeInput: string,
  guest: PlayerProfile
): Promise<DuelRoomData> {
  const roomCode = roomCodeInput.trim().toUpperCase();
  const path = `duel_rooms/${roomCode}`;

  if (!roomCode || roomCode.length < 4) {
    throw new Error('Please enter a valid 6-character room code.');
  }

  try {
    const roomRef = doc(db, 'duel_rooms', roomCode);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      throw new Error('Room not found. Check the code and try again.');
    }

    const data = snap.data() as DuelRoomData;

    // Check room status & age (expire after 1 hour)
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - (data.createdAt || 0) > ONE_HOUR) {
      throw new Error('This room code has expired. Please ask your friend to create a new room.');
    }

    if (data.status !== 'waiting' && data.status !== 'starting') {
      throw new Error('This battle has already started or ended.');
    }

    if (data.host.id === guest.id) {
      throw new Error('You are already the host of this room.');
    }

    if (data.guest && data.guest.id !== guest.id) {
      throw new Error('This room already has 2 players.');
    }

    // Join room and set status to starting
    const updatedPayload = sanitizeForFirestore({
      guest,
      status: 'starting',
      updatedAt: Date.now(),
    });

    await updateDoc(roomRef, updatedPayload);

    return {
      ...data,
      guest,
      status: 'starting',
      updatedAt: Date.now(),
    };
  } catch (error: any) {
    if (error.message && (
      error.message.includes('Room not found') ||
      error.message.includes('This room') ||
      error.message.includes('You are already') ||
      error.message.includes('Please enter')
    )) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Search or create a real online match against another connected human player
export async function findOrCreateRandomMatch(
  player: PlayerProfile,
  exam: ExamType,
  category: QuestionCategory | 'mixed',
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge' = '1v1_ranked'
): Promise<{ type: 'created' | 'joined'; roomCode: string; roomData: DuelRoomData }> {
  const path = 'duel_rooms';
  const TWO_MINUTES = 2 * 60 * 1000;
  const cutoffTime = Date.now() - TWO_MINUTES;

  try {
    // Look for active waiting public rooms
    const q = query(
      collection(db, 'duel_rooms'),
      where('isPublic', '==', true),
      where('status', '==', 'waiting')
    );

    const snapshot = await getDocs(q);
    let matchedRoom: DuelRoomData | null = null;

    for (const docSnap of snapshot.docs) {
      const room = docSnap.data() as DuelRoomData;
      // Ensure it's not our own room and created recently
      if (room.host?.id !== player.id && (room.createdAt || 0) > cutoffTime) {
        matchedRoom = room;
        break;
      }
    }

    if (matchedRoom) {
      // Join this real opponent's room!
      const joinedData = await joinDuelRoom(matchedRoom.roomCode, player);
      return {
        type: 'joined',
        roomCode: matchedRoom.roomCode,
        roomData: joinedData,
      };
    } else {
      // No open room currently waiting -> create one and wait for real opponent
      const { roomCode, roomData } = await createDuelRoom(player, exam, category, mode, true);
      return {
        type: 'created',
        roomCode,
        roomData,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

// Listen to room state in real-time
export function listenToDuelRoom(
  roomCode: string,
  onUpdate: (room: DuelRoomData) => void,
  onError?: (error: any) => void
): Unsubscribe {
  const path = `duel_rooms/${roomCode}`;
  const roomRef = doc(db, 'duel_rooms', roomCode);

  return onSnapshot(
    roomRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as DuelRoomData;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Duel room listener error:', err);
      handleFirestoreError(err, OperationType.GET, path);
      if (onError) onError(err);
    }
  );
}

// Update player progress during the live duel
export async function updatePlayerRoomProgress(
  roomCode: string,
  role: 'host' | 'guest',
  data: {
    score: number;
    currentIndex: number;
    combo: number;
    finished?: boolean;
    answerRecord?: PlayerAnswerRecord;
  }
): Promise<void> {
  const path = `duel_rooms/${roomCode}`;
  try {
    const roomRef = doc(db, 'duel_rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const currentRoom = snap.data() as DuelRoomData;
    const isHost = role === 'host';

    const prevAnswers = isHost ? (currentRoom.hostAnswers || []) : (currentRoom.guestAnswers || []);
    const updatedAnswers = data.answerRecord ? [...prevAnswers, data.answerRecord] : prevAnswers;

    const payload: Partial<DuelRoomData> = {
      updatedAt: Date.now(),
    };

    if (isHost) {
      payload.hostScore = data.score;
      payload.hostCurrentIndex = data.currentIndex;
      payload.hostCombo = data.combo;
      payload.hostAnswers = updatedAnswers;
      if (data.finished !== undefined) payload.hostFinished = data.finished;
    } else {
      payload.guestScore = data.score;
      payload.guestCurrentIndex = data.currentIndex;
      payload.guestCombo = data.combo;
      payload.guestAnswers = updatedAnswers;
      if (data.finished !== undefined) payload.guestFinished = data.finished;
    }

    // Check if both players finished
    const hostFin = isHost ? Boolean(data.finished) : Boolean(currentRoom.hostFinished);
    const guestFin = !isHost ? Boolean(data.finished) : Boolean(currentRoom.guestFinished);

    if (hostFin && guestFin) {
      payload.status = 'finished';
    }

    await updateDoc(roomRef, sanitizeForFirestore(payload));
  } catch (error) {
    console.warn('updatePlayerRoomProgress error:', error);
  }
}

// Send emote to duel room
export async function sendDuelRoomEmote(
  roomCode: string,
  role: 'host' | 'guest',
  emoji: string,
  text?: string
): Promise<void> {
  try {
    const roomRef = doc(db, 'duel_rooms', roomCode);
    const emoteData = { emoji, text, timestamp: Date.now() };

    if (role === 'host') {
      await updateDoc(roomRef, sanitizeForFirestore({ hostEmote: emoteData, updatedAt: Date.now() }));
    } else {
      await updateDoc(roomRef, sanitizeForFirestore({ guestEmote: emoteData, updatedAt: Date.now() }));
    }
  } catch (error) {
    console.warn('sendDuelRoomEmote error:', error);
  }
}

// Leave / Cancel room
export async function cancelOrLeaveDuelRoom(
  roomCode: string,
  role: 'host' | 'guest'
): Promise<void> {
  try {
    const roomRef = doc(db, 'duel_rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data() as DuelRoomData;
    if (data.status === 'waiting' && role === 'host') {
      await deleteDoc(roomRef);
    } else {
      await updateDoc(roomRef, sanitizeForFirestore({ status: 'abandoned', updatedAt: Date.now() }));
    }
  } catch (error) {
    console.warn('cancelOrLeaveDuelRoom error:', error);
  }
}
