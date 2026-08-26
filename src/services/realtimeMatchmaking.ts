import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  limit, 
  runTransaction,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from './firebaseService';
import { PlayerProfile, Question, QuestionCategory, ExamType, PlayerAnswerRecord } from '../types';
import { getFilteredQuestions, getFirstMatchQuestions } from './matchmakingService';

export type MatchmakingState = 'idle' | 'searching' | 'matched' | 'starting' | 'bot_fallback';

export interface MatchQueueTicket {
  id: string; // Ticket ID (e.g. ticket_${userId})
  userId: string;
  playerName: string;
  avatar: string;
  rankPoints: number;
  targetExam: string;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  roundCount: number;
  status: 'searching' | 'matched' | 'cancelled' | 'expired';
  matchedRoomId?: string;
  matchedOpponent?: PlayerProfile;
  questions?: Question[];
  createdAt: number;
  expiresAt: number;
}

export interface LiveRoomFinalResult {
  winnerId: string;
  loserId: string;
  player1FinalScore: number;
  player2FinalScore: number;
  player1LPChange: number;
  player2LPChange: number;
  finalised: boolean;
}

export interface LiveDuelRoom {
  id: string;
  roomId: string;
  mode: string;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  roundCount: number;
  player1: PlayerProfile;
  player2: PlayerProfile;
  questions: Question[];
  status: 'waiting' | 'in_progress' | 'completed';
  scores: Record<string, number>; // { [playerId]: score }
  combos: Record<string, number>; // { [playerId]: combo }
  answers: Record<string, PlayerAnswerRecord[]>; // { [playerId]: answers }
  completedPlayers: string[]; // [playerId]
  activeEmotes: { senderId: string; emoji: string; text?: string; timestamp: number }[];
  finalResult?: LiveRoomFinalResult;
  createdAt: number;
  updatedAt: number;
}

export interface MatchSuccessResult {
  roomId: string;
  opponent: PlayerProfile;
  questions: Question[];
  isRealPlayer: boolean;
}

export class RealtimeMatchmakingManager {
  private currentTicketId: string | null = null;
  private currentUserId: string | null = null;
  private unsubscribeMyTicket: Unsubscribe | null = null;
  private unsubscribePoolListener: Unsubscribe | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private currentState: MatchmakingState = 'idle';
  private hasMatched = false;
  private beforeUnloadHandler: (() => void) | null = null;

  public getState(): MatchmakingState {
    return this.currentState;
  }

  /**
   * Puts the player into the real-time matchmaking queue with:
   * 1. Immediate Firestore onSnapshot listener on own ticket for match notifications
   * 2. Real-time active queue listener for matching compatible waiting players
   * 3. Atomic Firestore transaction ensuring race-condition-free pairings and shared matchId + questions
   * 4. Strict 5.0 second timer fallback if no real human joins
   */
  public async enterMatchQueue(
    player: PlayerProfile,
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    roundCount: number,
    onMatchSuccess: (result: MatchSuccessResult) => void,
    onFallbackToBot: () => void
  ): Promise<void> {
    // Clean up any stale state first
    this.cleanup();

    this.currentState = 'searching';
    this.hasMatched = false;

    const userId = auth.currentUser?.uid || player.id || `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const ticketId = `ticket_${userId}`;
    this.currentUserId = userId;
    this.currentTicketId = ticketId;

    // Window unload/leave safety handler
    this.beforeUnloadHandler = () => {
      this.cancelMatchmaking();
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('pagehide', this.beforeUnloadHandler);

    try {
      const myTicketRef = doc(db, 'match_queue', ticketId);
      const now = Date.now();
      const expiresAt = now + 12000; // 12 seconds max TTL for queue validity

      // 1. Subscribe to own ticket in REAL-TIME immediately BEFORE publishing to guarantee no missed events
      this.unsubscribeMyTicket = onSnapshot(myTicketRef, (docSnap) => {
        if (!docSnap.exists() || this.hasMatched || this.currentState !== 'searching') return;

        const data = docSnap.data() as MatchQueueTicket;
        if (data && data.status === 'matched' && data.matchedRoomId && data.matchedOpponent) {
          // Transition state: searching -> matched
          this.transitionToMatched({
            roomId: data.matchedRoomId,
            opponent: data.matchedOpponent,
            questions: data.questions || (player.matchesPlayed === 0 ? getFirstMatchQuestions(exam) : getFilteredQuestions(category, exam, roundCount)),
            isRealPlayer: true,
          }, onMatchSuccess);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `match_queue/${ticketId}`);
      });

      // 2. Publish player's searching ticket to the real-time queue
      const myTicketPayload: MatchQueueTicket = {
        id: ticketId,
        userId,
        playerName: player.name,
        avatar: player.avatar,
        rankPoints: player.rankPoints,
        targetExam: player.targetExam || 'SSC CGL',
        category,
        exam,
        roundCount,
        status: 'searching',
        createdAt: now,
        expiresAt,
      };

      await setDoc(myTicketRef, myTicketPayload);

      // 3. Start 5.0 second fallback timer. If no real player matches before this, trigger bot fallback.
      this.fallbackTimer = setTimeout(() => {
        if (this.hasMatched || this.currentState !== 'searching') return;

        // Transition state: searching -> bot_fallback
        this.currentState = 'bot_fallback';
        this.cleanup();
        onFallbackToBot();
      }, 5000);

      // 4. Real-time listener for compatible waiting players entering the queue
      const queueCollection = collection(db, 'match_queue');
      const poolQuery = query(
        queueCollection,
        where('status', '==', 'searching'),
        limit(10)
      );

      this.unsubscribePoolListener = onSnapshot(poolQuery, async (snapshot) => {
        if (this.hasMatched || this.currentState !== 'searching') return;

        const currentTime = Date.now();
        // Look for another searching ticket (not our own, not expired)
        for (const docChange of snapshot.docChanges()) {
          if (this.hasMatched || this.currentState !== 'searching') break;

          const candidateData = docChange.doc.data() as MatchQueueTicket;
          if (
            candidateData &&
            candidateData.userId !== userId &&
            candidateData.status === 'searching' &&
            candidateData.createdAt > (currentTime - 10000) // Within valid 10s window
          ) {
            // Attempt atomic pairing transaction!
            await this.attemptAtomicPairing(
              player,
              candidateData,
              category,
              exam,
              roundCount,
              onMatchSuccess
            );
            break;
          }
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'match_queue');
      });

    } catch (error) {
      console.warn('Real-time matchmaking initialization fallback:', error);
      if (!this.hasMatched && this.currentState === 'searching') {
        this.currentState = 'bot_fallback';
        this.cleanup();
        onFallbackToBot();
      }
    }
  }

  /**
   * ATOMIC TRANSACTION MATCHMAKING:
   * Prevents race conditions when two or more players queue at the exact same millisecond.
   * Ensures:
   * - Both tickets are atomically verified to still be 'searching'
   * - Both tickets are updated to 'matched' with the EXACT SAME match/room ID and questions
   * - Creates the shared Live Room document
   * - If another process matched either ticket first, transaction aborts cleanly
   */
  private async attemptAtomicPairing(
    myPlayer: PlayerProfile,
    opponentTicket: MatchQueueTicket,
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    roundCount: number,
    onMatchSuccess: (result: MatchSuccessResult) => void
  ): Promise<boolean> {
    if (this.hasMatched || this.currentState !== 'searching') return false;
    if (!this.currentTicketId || !this.currentUserId) return false;

    const myTicketRef = doc(db, 'match_queue', this.currentTicketId);
    const oppTicketRef = doc(db, 'match_queue', opponentTicket.id);

    try {
      const sharedRoomId = `duel_${this.currentUserId.slice(0, 5)}_${opponentTicket.userId.slice(0, 5)}_${Date.now()}`;
      const sharedQuestions = myPlayer.matchesPlayed === 0 && category === 'mixed'
        ? getFirstMatchQuestions(exam)
        : getFilteredQuestions(category, exam, roundCount);

      const opponentProfile: PlayerProfile = {
        id: opponentTicket.userId,
        name: opponentTicket.playerName,
        avatar: opponentTicket.avatar,
        country: 'India',
        countryCode: 'IN',
        targetExam: opponentTicket.targetExam || 'SSC CGL',
        rankPoints: opponentTicket.rankPoints || 1200,
        pyqScore: 0,
        tier: 'Aspirant',
        tierTitle: 'Aspirant',
        level: Math.max(1, Math.floor((opponentTicket.rankPoints || 1200) / 300)),
        matchesPlayed: 12,
        matchesWon: 8,
        winStreak: 2,
        accuracyRate: 75,
        bestCategory: category === 'mixed' ? 'synonyms' : category,
        badges: ['⚡ Live Challenger', '🇮🇳 Verified Aspirant']
      };

      const roomRef = doc(db, 'live_rooms', sharedRoomId);

      await runTransaction(db, async (transaction) => {
        const mySnap = await transaction.get(myTicketRef);
        const oppSnap = await transaction.get(oppTicketRef);

        if (!mySnap.exists() || !oppSnap.exists()) {
          throw new Error('Ticket no longer exists');
        }

        const myData = mySnap.data() as MatchQueueTicket;
        const oppData = oppSnap.data() as MatchQueueTicket;

        // Check if both tickets are strictly still in 'searching' state
        if (myData.status !== 'searching' || oppData.status !== 'searching') {
          throw new Error('One of the tickets is already matched or cancelled');
        }

        // 1. Mark Opponent Ticket as 'matched' with the shared matchId and questions
        transaction.update(oppTicketRef, {
          status: 'matched',
          matchedRoomId: sharedRoomId,
          matchedOpponent: myPlayer,
          questions: sharedQuestions,
        });

        // 2. Mark My Ticket as 'matched' with the shared matchId and questions
        transaction.update(myTicketRef, {
          status: 'matched',
          matchedRoomId: sharedRoomId,
          matchedOpponent: opponentProfile,
          questions: sharedQuestions,
        });

        // 3. Create the shared Live Room Document with authoritative score maps
        const liveRoomData: LiveDuelRoom = {
          id: sharedRoomId,
          roomId: sharedRoomId,
          mode: roundCount === 10 ? 'quick_duel' : '1v1_ranked',
          category,
          exam,
          roundCount,
          player1: myPlayer,
          player2: opponentProfile,
          questions: sharedQuestions,
          status: 'in_progress',
          scores: {
            [myPlayer.id]: 0,
            [opponentProfile.id]: 0,
          },
          combos: {
            [myPlayer.id]: 0,
            [opponentProfile.id]: 0,
          },
          answers: {
            [myPlayer.id]: [],
            [opponentProfile.id]: [],
          },
          completedPlayers: [],
          activeEmotes: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        transaction.set(roomRef, liveRoomData);
      });

      // Transaction succeeded! Transition initiator to matched
      this.transitionToMatched({
        roomId: sharedRoomId,
        opponent: opponentProfile,
        questions: sharedQuestions,
        isRealPlayer: true,
      }, onMatchSuccess);

      return true;
    } catch (err) {
      // Transaction failed or opponent was matched concurrently.
      return false;
    }
  }

  /**
   * Helper to perform clean state transition to 'matched'
   */
  private transitionToMatched(
    result: MatchSuccessResult,
    onMatchSuccess: (result: MatchSuccessResult) => void
  ) {
    if (this.hasMatched) return;
    this.hasMatched = true;
    this.currentState = 'matched';

    // Cancel 5-second timer immediately
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    // Stop queue listeners
    if (this.unsubscribePoolListener) {
      this.unsubscribePoolListener();
      this.unsubscribePoolListener = null;
    }

    // Clean up ticket in background
    if (this.currentTicketId) {
      const ticketRef = doc(db, 'match_queue', this.currentTicketId);
      deleteDoc(ticketRef).catch(() => {});
    }

    // Fire success callback
    onMatchSuccess(result);
  }

  /**
   * Cancels search and removes player ticket from queue immediately
   */
  public async cancelMatchmaking(): Promise<void> {
    this.currentState = 'idle';
    this.hasMatched = false;
    this.cleanup();
  }

  /**
   * Complete teardown of timers, listeners, and window hooks
   */
  public cleanup(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (this.unsubscribeMyTicket) {
      this.unsubscribeMyTicket();
      this.unsubscribeMyTicket = null;
    }

    if (this.unsubscribePoolListener) {
      this.unsubscribePoolListener();
      this.unsubscribePoolListener = null;
    }

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.currentTicketId) {
      const ticketRef = doc(db, 'match_queue', this.currentTicketId);
      deleteDoc(ticketRef).catch(() => {});
      this.currentTicketId = null;
    }

    this.currentUserId = null;
  }
}

export const realtimeMatchmaker = new RealtimeMatchmakingManager();

/**
 * ============================================================================
 * AUTHORITATIVE LIVE ROOM SERVICES:
 * Synchronizes real-time scores, answers, emotes, and final resolution.
 * ============================================================================
 */

/**
 * Subscribes to live room state changes.
 */
export function subscribeToLiveRoom(
  roomId: string,
  onUpdate: (room: LiveDuelRoom) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const roomRef = doc(db, 'live_rooms', roomId);

  let pollInterval: NodeJS.Timeout | null = null;
  let isUnsubscribed = false;

  const handleUpdate = (room: LiveDuelRoom) => {
    if (!isUnsubscribed && room) {
      onUpdate(room);
    }
  };

  const unsubscribeFs = onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      handleUpdate(snapshot.data() as LiveDuelRoom);
    }
  }, (err) => {
    if (onError) onError(err);
    handleFirestoreError(err, OperationType.GET, `live_rooms/${roomId}`);
  });

  // Server polling fallback (every 800ms)
  pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`/api/match/room/${roomId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.room) {
          handleUpdate(json.room as LiveDuelRoom);
        }
      }
    } catch {
      // ignore
    }
  }, 800);

  return () => {
    isUnsubscribed = true;
    if (pollInterval) clearInterval(pollInterval);
    try {
      unsubscribeFs();
    } catch {
      // ignore
    }
  };
}

/**
 * Submits a player's answer atomically to the shared Live Room in Firestore.
 * Prevents race conditions and computes the final synchronized match result
 * once all players finish the round series.
 */
export async function submitPlayerAnswerToLiveRoom(
  roomId: string,
  playerId: string,
  answer: PlayerAnswerRecord,
  isLastQuestion: boolean
): Promise<LiveDuelRoom | null> {
  // Sync to server API backup
  try {
    fetch('/api/match/room/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        playerId,
        score: answer.scoreGained,
        answerRecord: answer,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  const roomRef = doc(db, 'live_rooms', roomId);

  try {
    const updatedRoom = await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error(`Live room ${roomId} not found`);
      }

      const room = roomSnap.data() as LiveDuelRoom;
      const currentScores = room.scores || {};
      const currentCombos = room.combos || {};
      const currentAnswers = room.answers || {};
      const completedPlayers = [...(room.completedPlayers || [])];

      // Update player score & combo
      const playerCurrentScore = currentScores[playerId] || 0;
      const playerNewScore = Math.max(0, playerCurrentScore + answer.scoreGained);
      currentScores[playerId] = playerNewScore;

      const playerCurrentCombo = currentCombos[playerId] || 0;
      currentCombos[playerId] = answer.isCorrect ? playerCurrentCombo + 1 : 0;

      // Append answer record
      const playerExistingAnswers = currentAnswers[playerId] || [];
      currentAnswers[playerId] = [...playerExistingAnswers, answer];

      // If last question, record player completion
      if (isLastQuestion && !completedPlayers.includes(playerId)) {
        completedPlayers.push(playerId);
      }

      const p1Id = room.player1.id;
      const p2Id = room.player2.id;

      let status = room.status;
      let finalResult = room.finalResult;

      // Check if both players have now completed all questions
      const isBothCompleted = completedPlayers.includes(p1Id) && completedPlayers.includes(p2Id);

      if (isBothCompleted && (!finalResult || !finalResult.finalised)) {
        const p1Score = currentScores[p1Id] || 0;
        const p2Score = currentScores[p2Id] || 0;

        const isP1Winner = p1Score > p2Score;
        const isP2Winner = p2Score > p1Score;
        const isDraw = p1Score === p2Score;

        const winnerId = isP1Winner ? p1Id : isP2Winner ? p2Id : 'draw';
        const loserId = isP1Winner ? p2Id : isP2Winner ? p1Id : 'draw';

        const p1LP = isP1Winner ? 30 : isDraw ? 5 : -15;
        const p2LP = isP2Winner ? 30 : isDraw ? 5 : -15;

        status = 'completed';
        finalResult = {
          winnerId,
          loserId,
          player1FinalScore: p1Score,
          player2FinalScore: p2Score,
          player1LPChange: p1LP,
          player2LPChange: p2LP,
          finalised: true,
        };
      }

      const updatedPayload: Record<string, any> = {
        scores: currentScores,
        combos: currentCombos,
        answers: currentAnswers,
        completedPlayers,
        status,
        updatedAt: Date.now(),
      };

      if (finalResult !== undefined) {
        updatedPayload.finalResult = finalResult;
      }

      transaction.update(roomRef, updatedPayload);

      return {
        ...room,
        ...updatedPayload,
      } as LiveDuelRoom;
    });

    return updatedRoom;
  } catch (error) {
    console.error('Error submitting answer to live room:', error);
    return null;
  }
}

/**
 * Force finalizes the live room if one player finished and the opponent timed out or disconnected.
 */
export async function forceFinalizeLiveRoom(roomId: string): Promise<LiveDuelRoom | null> {
  const roomRef = doc(db, 'live_rooms', roomId);

  try {
    return await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) return null;

      const room = roomSnap.data() as LiveDuelRoom;
      if (room.finalResult && room.finalResult.finalised) {
        return room;
      }

      const p1Id = room.player1.id;
      const p2Id = room.player2.id;
      const p1Score = (room.scores && room.scores[p1Id]) || 0;
      const p2Score = (room.scores && room.scores[p2Id]) || 0;

      const isP1Winner = p1Score > p2Score;
      const isP2Winner = p2Score > p1Score;
      const isDraw = p1Score === p2Score;

      const winnerId = isP1Winner ? p1Id : isP2Winner ? p2Id : 'draw';
      const loserId = isP1Winner ? p2Id : isP2Winner ? p1Id : 'draw';

      const p1LP = isP1Winner ? 30 : isDraw ? 5 : -15;
      const p2LP = isP2Winner ? 30 : isDraw ? 5 : -15;

      const finalResult: LiveRoomFinalResult = {
        winnerId,
        loserId,
        player1FinalScore: p1Score,
        player2FinalScore: p2Score,
        player1LPChange: p1LP,
        player2LPChange: p2LP,
        finalised: true,
      };

      transaction.update(roomRef, {
        status: 'completed',
        finalResult,
        updatedAt: Date.now(),
      });

      return {
        ...room,
        status: 'completed',
        finalResult,
      } as LiveDuelRoom;
    });
  } catch (error) {
    console.error('Error force finalizing live room:', error);
    return null;
  }
}

/**
 * Sends a real-time emote to the shared Live Room.
 */
export async function sendLiveRoomEmote(
  roomId: string,
  senderId: string,
  emoji: string,
  text?: string
): Promise<void> {
  const roomRef = doc(db, 'live_rooms', roomId);
  try {
    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) return;
      const room = roomSnap.data() as LiveDuelRoom;
      const emotes = (room.activeEmotes || []).filter(e => Date.now() - e.timestamp < 10000);
      const newEmote: { senderId: string; emoji: string; text?: string; timestamp: number } = {
        senderId,
        emoji,
        timestamp: Date.now(),
      };
      if (text) {
        newEmote.text = text;
      }
      emotes.push(newEmote);
      transaction.update(roomRef, {
        activeEmotes: emotes,
        updatedAt: Date.now(),
      });
    });
  } catch (err) {
    console.warn('Failed to send live room emote:', err);
  }
}
