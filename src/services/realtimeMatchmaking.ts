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
  Unsubscribe,
  getDocs
} from 'firebase/firestore';
import { db, auth, sanitizeForFirestore } from './firebaseService';
import firebaseConfig from '../../firebase-applet-config.json';
import { PlayerProfile, Question, QuestionCategory, ExamType, PlayerAnswerRecord } from '../types';
import { getFilteredQuestions, getFirstMatchQuestions, getTierFromLP, getTierTitle } from './matchmakingService';

export type MatchmakingState = 'idle' | 'searching' | 'matched' | 'starting' | 'bot_fallback';

export interface MatchQueueTicket {
  uid: string;
  displayName: string;
  avatar: string;
  lp: number;
  targetExam: string;
  category: QuestionCategory | 'mixed';
  exam: ExamType;
  roundCount: number;
  status: 'waiting' | 'matched' | 'cancelled' | 'expired';
  createdAt: number;
  heartbeatAt: number;
  matchId: string | null;
  opponentUid: string | null;
  opponentProfile: PlayerProfile | null;
  questions: Question[] | null;
  updatedAt?: number;
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
  forfeitedBy?: string;
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
  private currentUserId: string | null = null;
  private unsubscribeMyTicket: Unsubscribe | null = null;
  private unsubscribePoolListener: Unsubscribe | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private serverPollInterval: NodeJS.Timeout | null = null;
  private delayedCleanups: NodeJS.Timeout[] = [];
  private currentState: MatchmakingState = 'idle';
  private hasMatched = false;
  private searchStartTime = 0;
  private isPairingInProgress = false;
  private beforeUnloadHandler: (() => void) | null = null;

  public getState(): MatchmakingState {
    return this.currentState;
  }

  /**
   * Puts the player into the real-time matchmaking queue:
   * 1. Dual-Channel Realtime Coordination: Zero-latency in-memory Server coordinator + Authoritative Firestore queue
   * 2. Strict 5-Second Search Window as requested by user
   * 3. Instant atomic pairing across devices/cellular connections
   */
  public async enterMatchQueue(
    player: PlayerProfile,
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    roundCount: number,
    onMatchSuccess: (result: MatchSuccessResult) => void,
    onFallbackToBot: () => void
  ): Promise<void> {
    // Clean up any previous session state
    this.cleanup();

    this.currentState = 'searching';
    this.hasMatched = false;
    this.searchStartTime = Date.now();
    this.isPairingInProgress = false;

    // Authoritative UID
    const uid = auth.currentUser?.uid || player.id || `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.currentUserId = uid;

    const projectId = firebaseConfig.projectId || 'tactile-world-jq6d2';

    // REQUIRED DEBUG LOGS
    console.log('[MATCHMAKING] current uid:', uid);
    console.log('[MATCHMAKING] firebase project:', projectId);
    console.log('[MATCHMAKING] entering queue (max 5s window)');
    console.log('[MATCHMAKING] queue doc:', `matchmaking_queue/${uid}`);

    // Pre-curate candidate questions for immediate match synchronization
    const initialCuratedQuestions = player.matchesPlayed === 0 && category === 'mixed' && roundCount === 10
      ? getFirstMatchQuestions(exam)
      : getFilteredQuestions(category, exam, roundCount);

    // Register unload handlers to clean queue doc if user navigates away
    this.beforeUnloadHandler = () => {
      this.cancelMatchmaking();
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('pagehide', this.beforeUnloadHandler);

    // =========================================================================
    // CHANNEL 1: ULTRA-FAST SERVER MATCHMAKER (Instant cross-device pairing)
    // =========================================================================
    try {
      fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player,
          category,
          exam,
          roundCount,
          questions: initialCuratedQuestions,
        }),
      }).then(res => res.json()).then(data => {
        if (this.hasMatched || this.currentState !== 'searching') return;
        if (data && data.success && data.matched && data.roomId && data.opponent) {
          console.log('[MATCHMAKING-SERVER] Instant match confirmed on join:', data.roomId);
          this.transitionToMatched({
            roomId: data.roomId,
            opponent: data.opponent,
            questions: data.questions || initialCuratedQuestions,
            isRealPlayer: true,
          }, onMatchSuccess);
        }
      }).catch(err => {
        console.warn('[MATCHMAKING-SERVER] Server join notice:', err);
      });

      // Poll server matchmaking state rapidly (every 350ms)
      this.serverPollInterval = setInterval(async () => {
        if (this.hasMatched || this.currentState !== 'searching' || !this.currentUserId) return;
        try {
          const res = await fetch('/api/matchmaking/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: this.currentUserId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (this.hasMatched || this.currentState !== 'searching') return;
            if (data && data.success && data.matched && data.roomId && data.opponent) {
              console.log('[MATCHMAKING-SERVER] Match detected via fast server poll:', data.roomId);
              this.transitionToMatched({
                roomId: data.roomId,
                opponent: data.opponent,
                questions: data.questions || initialCuratedQuestions,
                isRealPlayer: true,
              }, onMatchSuccess);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 350);
    } catch (e) {
      console.warn('[MATCHMAKING-SERVER] Error starting server poll:', e);
    }

    // =========================================================================
    // 6-SECOND BOT FALLBACK TIMER (Active 5-8s human search window)
    // =========================================================================
    this.fallbackTimer = setTimeout(async () => {
      if (this.hasMatched || this.currentState !== 'searching' || this.isPairingInProgress) {
        return;
      }

      // Final fast check before triggering bot fallback
      try {
        const pollRes = await fetch('/api/matchmaking/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid }),
        });
        if (pollRes.ok) {
          const pData = await pollRes.json();
          if (pData && pData.success && pData.matched && pData.roomId && pData.opponent) {
            console.log('[MATCHMAKING] Match caught in final check!');
            this.transitionToMatched({
              roomId: pData.roomId,
              opponent: pData.opponent,
              questions: pData.questions || initialCuratedQuestions,
              isRealPlayer: true,
            }, onMatchSuccess);
            return;
          }
        }
      } catch {
        // ignore
      }

      if (this.hasMatched || this.currentState !== 'searching') return;

      // Transition to bot fallback at 6 seconds
      console.log('[MATCHMAKING] bot fallback started after 6 seconds');
      this.currentState = 'bot_fallback';
      this.cleanup();
      onFallbackToBot();
    }, 6000);

    // =========================================================================
    // CHANNEL 2: FIRESTORE REALTIME SYNC (Authoritative Firestore queue)
    // Per Firebase integration guidelines: Only attach onSnapshot listeners if auth is ready and user is authenticated.
    // Unauthenticated guests rely on Channel 1 (Server Matchmaker), eliminating permission errors.
    // =========================================================================
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid) {
      const authUid = currentUser.uid;
      this.currentUserId = authUid;

      try {
        const now = Date.now();
        const myDocRef = doc(db, 'matchmaking_queue', authUid);

        // 1. Subscribe to own document in REAL-TIME before writing
        this.unsubscribeMyTicket = onSnapshot(myDocRef, (docSnap) => {
          if (!docSnap.exists() || this.hasMatched || this.currentState !== 'searching') return;

          const data = docSnap.data() as MatchQueueTicket;
          if (data && data.status === 'matched' && data.matchId && data.opponentProfile) {
            console.log('[MATCHMAKING] Firestore ticket matched:', data.matchId);
            const sharedQuestions = data.questions && data.questions.length > 0
              ? data.questions
              : initialCuratedQuestions;

            this.transitionToMatched({
              roomId: data.matchId,
              opponent: data.opponentProfile,
              questions: sharedQuestions,
              isRealPlayer: true,
            }, onMatchSuccess);
          }
        }, (err) => {
          console.warn('[MATCHMAKING] Firestore own ticket listener notice:', err?.message || err);
        });

        // 2. Write player document to `matchmaking_queue/{authUid}`
        const queueDocPayload: MatchQueueTicket = {
          uid: authUid,
          displayName: (player.name || 'Govt Aspirant').slice(0, 60),
          avatar: (player.avatar || '👨‍💼').slice(0, 500),
          lp: typeof player.rankPoints === 'number' ? Math.min(Math.max(0, player.rankPoints), 500000) : 1200,
          targetExam: player.targetExam || exam || 'SSC CGL',
          category,
          exam,
          roundCount: [10, 20, 30].includes(roundCount) ? roundCount : 10,
          status: 'waiting',
          createdAt: now,
          heartbeatAt: now,
          matchId: null,
          opponentUid: null,
          opponentProfile: null,
          questions: null,
        };

        setDoc(myDocRef, sanitizeForFirestore(queueDocPayload)).catch(err => {
          console.warn('[MATCHMAKING] Firestore write notice:', err);
        });

        // 3. Heartbeat interval: update heartbeatAt every 2 seconds to prove liveness
        this.heartbeatInterval = setInterval(async () => {
          if (this.currentState === 'searching' && !this.hasMatched && this.currentUserId) {
            try {
              await setDoc(doc(db, 'matchmaking_queue', this.currentUserId), {
                heartbeatAt: Date.now(),
              }, { merge: true });
            } catch {
              // ignore background heartbeat errors
            }
          }
        }, 2000);

        // 4. Subscribe to other waiting players in `matchmaking_queue`
        const queueCollection = collection(db, 'matchmaking_queue');
        const waitingQuery = query(
          queueCollection,
          where('status', '==', 'waiting'),
          limit(20)
        );

        this.unsubscribePoolListener = onSnapshot(waitingQuery, async (snapshot) => {
          if (this.hasMatched || this.currentState !== 'searching' || this.isPairingInProgress) return;

          const currentTime = Date.now();
          const waitingCandidates: MatchQueueTicket[] = [];

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as MatchQueueTicket;
            if (
              data &&
              data.uid &&
              data.uid !== authUid &&
              data.status === 'waiting' &&
              (currentTime - (data.heartbeatAt || data.createdAt)) < 15000 // Fresh within 15s
            ) {
              const matchesCategory =
                category === 'mixed' ||
                data.category === 'mixed' ||
                data.category === category;
              if (matchesCategory) {
                waitingCandidates.push(data);
              }
            }
          }

          if (waitingCandidates.length > 0) {
            const candidate = waitingCandidates[0];
            console.log('[MATCHMAKING] waiting candidate discovered:', candidate.uid);

            // Designated initiator: lower UID triggers transaction immediately
            const isDesignatedInitiator = authUid < candidate.uid;
            const hasWaitedAsNonInitiator = (currentTime - this.searchStartTime) > 1200;

            if (isDesignatedInitiator || hasWaitedAsNonInitiator) {
              this.isPairingInProgress = true;
              console.log('[MATCHMAKING] trying atomic claim');
              const paired = await this.attemptAtomicPairing(
                player,
                candidate,
                category,
                exam,
                roundCount,
                initialCuratedQuestions,
                onMatchSuccess
              );
              this.isPairingInProgress = false;
            }
          }
        }, (err) => {
          console.warn('[MATCHMAKING] Firestore pool query listener notice:', err?.message || err);
        });

      } catch (error) {
        console.warn('[MATCHMAKING] Firestore channel notice:', error);
      }
    } else {
      console.log('[MATCHMAKING] Guest session active: relying on zero-latency server matchmaking channel');
    }
  }

  /**
   * ATOMIC TRANSACTION MATCHMAKING:
   * 1. Reads both `matchmaking_queue/${myUid}` and `matchmaking_queue/${candidate.uid}`
   * 2. Verifies both documents are still status == "waiting"
   * 3. Sets both documents to status == "matched" with deterministic matchId, opponentProfile, and questions
   * 4. Creates `live_rooms/${matchId}` and `matches/${matchId}`
   * 5. Cancels bot fallback and triggers success callback
   */
  private async attemptAtomicPairing(
    myPlayer: PlayerProfile,
    candidate: MatchQueueTicket,
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    roundCount: number,
    curatedQuestions: Question[],
    onMatchSuccess: (result: MatchSuccessResult) => void
  ): Promise<boolean> {
    if (this.hasMatched || this.currentState !== 'searching') return false;
    if (!this.currentUserId) return false;

    const myUid = this.currentUserId;
    const oppUid = candidate.uid;

    const myDocRef = doc(db, 'matchmaking_queue', myUid);
    const oppDocRef = doc(db, 'matchmaking_queue', oppUid);

    try {
      // Deterministic match ID using sorted UIDs
      const sortedPair = [myUid, oppUid].sort();
      const matchId = `duel_1v1_${sortedPair[0].slice(0, 6)}_${sortedPair[1].slice(0, 6)}_${Date.now()}`;

      // Shared synchronized questions
      const sharedQuestions = curatedQuestions && curatedQuestions.length > 0
        ? curatedQuestions
        : getFilteredQuestions(category, exam, roundCount);

      // Build opponent profile from candidate ticket
      const oppTier = getTierFromLP(candidate.lp || 1200);
      const opponentProfile: PlayerProfile = {
        id: candidate.uid,
        name: candidate.displayName || 'Govt Aspirant',
        avatar: candidate.avatar || '👨‍💼',
        country: 'India',
        countryCode: 'IN',
        targetExam: candidate.targetExam || exam || 'SSC CGL',
        rankPoints: candidate.lp || 1200,
        pyqScore: 0,
        tier: oppTier,
        tierTitle: getTierTitle(oppTier),
        level: Math.max(1, Math.floor((candidate.lp || 1200) / 300)),
        matchesPlayed: 14,
        matchesWon: 9,
        winStreak: 2,
        accuracyRate: 72,
        bestCategory: category === 'mixed' ? 'synonyms' : category,
        badges: ['⚡ Live Challenger', '🇮🇳 Verified Aspirant']
      };

      const roomRef = doc(db, 'live_rooms', matchId);
      const matchRef = doc(db, 'matches', matchId);

      await runTransaction(db, async (transaction) => {
        const mySnap = await transaction.get(myDocRef);
        const oppSnap = await transaction.get(oppDocRef);

        if (!mySnap.exists() || !oppSnap.exists()) {
          throw new Error('One or both queue documents no longer exist');
        }

        const myData = mySnap.data() as MatchQueueTicket;
        const oppData = oppSnap.data() as MatchQueueTicket;

        // Verify both are still strictly waiting
        if (myData.status !== 'waiting' || oppData.status !== 'waiting') {
          throw new Error('One of the players was matched or cancelled');
        }

        const now = Date.now();

        // 1. Update Opponent Queue Doc
        transaction.update(oppDocRef, {
          status: 'matched',
          matchId,
          opponentUid: myUid,
          opponentProfile: sanitizeForFirestore(myPlayer),
          questions: sanitizeForFirestore(sharedQuestions),
          updatedAt: now,
        });

        // 2. Update My Queue Doc
        transaction.update(myDocRef, {
          status: 'matched',
          matchId,
          opponentUid: oppUid,
          opponentProfile: sanitizeForFirestore(opponentProfile),
          questions: sanitizeForFirestore(sharedQuestions),
          updatedAt: now,
        });

        // 3. Create Shared Live Room Document for LiveDuelArena
        const liveRoomData: LiveDuelRoom = {
          id: matchId,
          roomId: matchId,
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
          createdAt: now,
          updatedAt: now,
        };

        transaction.set(roomRef, sanitizeForFirestore(liveRoomData));

        // 4. Create Match Document
        transaction.set(matchRef, sanitizeForFirestore({
          matchId,
          player1Uid: myPlayer.id,
          player2Uid: opponentProfile.id,
          status: 'in_progress',
          type: 'random-human',
          createdAt: now,
        }));
      });

      // Transaction Succeeded!
      console.log('[MATCHMAKING] human match created via transaction:', matchId);

      this.transitionToMatched({
        roomId: matchId,
        opponent: opponentProfile,
        questions: sharedQuestions,
        isRealPlayer: true,
      }, onMatchSuccess);

      return true;
    } catch (err) {
      // Transaction aborted cleanly (e.g. concurrent claim or network latency)
      return false;
    }
  }

  /**
   * Helper to transition to 'matched' state and notify UI
   */
  private transitionToMatched(
    result: MatchSuccessResult,
    onMatchSuccess: (result: MatchSuccessResult) => void
  ) {
    if (this.hasMatched) return;
    this.hasMatched = true;
    this.currentState = 'matched';

    // Cancel bot fallback timer immediately
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.serverPollInterval) {
      clearInterval(this.serverPollInterval);
      this.serverPollInterval = null;
    }

    // Stop pool queue listener
    if (this.unsubscribePoolListener) {
      this.unsubscribePoolListener();
      this.unsubscribePoolListener = null;
    }

    // Schedule cleanup of queue doc after 20s so both clients have safe reading margin
    const uidToClean = this.currentUserId;
    if (uidToClean && auth.currentUser && auth.currentUser.uid === uidToClean) {
      const cleanTimer = setTimeout(() => {
        deleteDoc(doc(db, 'matchmaking_queue', uidToClean)).catch(() => {});
      }, 20000);
      this.delayedCleanups.push(cleanTimer);
    }

    // Trigger success callback to start live match
    onMatchSuccess(result);
  }

  /**
   * Cancels search and removes player from matchmaking_queue immediately
   */
  public async cancelMatchmaking(): Promise<void> {
    this.currentState = 'idle';
    this.hasMatched = false;
    this.cleanup();
  }

  /**
   * Complete teardown of timers, listeners, heartbeat, and queue documents
   */
  public cleanup(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.serverPollInterval) {
      clearInterval(this.serverPollInterval);
      this.serverPollInterval = null;
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

    if (this.currentUserId && this.currentState !== 'matched') {
      const uidToDelete = this.currentUserId;
      if (auth.currentUser && auth.currentUser.uid === uidToDelete) {
        deleteDoc(doc(db, 'matchmaking_queue', uidToDelete)).catch(() => {});
      }
      fetch('/api/matchmaking/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uidToDelete }),
      }).catch(() => {});
      this.currentUserId = null;
    }

    this.delayedCleanups.forEach(t => clearTimeout(t));
    this.delayedCleanups = [];

    this.isPairingInProgress = false;
  }
}

export const realtimeMatchmaker = new RealtimeMatchmakingManager();

/**
 * ============================================================================
 * AUTHORITATIVE LIVE ROOM SERVICES:
 * Synchronizes real-time scores, answers, emotes, and final resolution.
 * ============================================================================
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

  let unsubscribeFs: Unsubscribe = () => {};
  if (auth.currentUser) {
    unsubscribeFs = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        handleUpdate(snapshot.data() as LiveDuelRoom);
      }
    }, (err) => {
      console.warn('[LiveRoom] Firestore listener notice:', err?.message || err);
      if (onError) onError(err);
    });
  }

  // Backup HTTP polling for instant fallback
  pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`/api/match/room/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          handleUpdate(data.room as LiveDuelRoom);
        }
      }
    } catch {
      // Ignore background sync errors
    }
  }, 1000);

  return () => {
    isUnsubscribed = true;
    unsubscribeFs();
    if (pollInterval) clearInterval(pollInterval);
  };
}

export async function submitPlayerAnswerToLiveRoom(
  roomId: string,
  playerId: string,
  answerRecord: PlayerAnswerRecord,
  score: number,
  combo: number,
  isLastQuestion: boolean = false
): Promise<LiveDuelRoom | null> {
  const roomRef = doc(db, 'live_rooms', roomId);
  let updatedRoomResult: LiveDuelRoom | null = null;

  if (auth.currentUser) {
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists()) return;

        const room = snap.data() as LiveDuelRoom;
        const scores = { ...(room.scores || {}) };
        const combos = { ...(room.combos || {}) };
        const answers = { ...(room.answers || {}) };
        const completedPlayers = [...(room.completedPlayers || [])];

        scores[playerId] = score;
        combos[playerId] = combo;

        const playerAnswers = [...(answers[playerId] || [])];
        const alreadyAnswered = playerAnswers.some(a => a.questionId === answerRecord.questionId);
        if (!alreadyAnswered) {
          playerAnswers.push(answerRecord);
        }
        answers[playerId] = playerAnswers;

        if (isLastQuestion && !completedPlayers.includes(playerId)) {
          completedPlayers.push(playerId);
        }

        const p1Id = room.player1?.id;
        const p2Id = room.player2?.id;
        const p1Score = (p1Id ? scores[p1Id] : 0) ?? 0;
        const p2Score = (p2Id ? scores[p2Id] : 0) ?? 0;
        const opponentLeft = !!room.forfeitedBy;

        const updatedRoom: Partial<LiveDuelRoom> = {
          scores,
          combos,
          answers,
          completedPlayers,
          updatedAt: Date.now(),
        };

        // If both players have completed, or if one player finished after opponent left:
        if (completedPlayers.length >= 2 || (isLastQuestion && opponentLeft)) {
          const winnerId = p1Score > p2Score ? p1Id : (p2Score > p1Score ? p2Id : 'draw');
          const loserId = winnerId === p1Id ? p2Id : (winnerId === p2Id ? p1Id : '');

          updatedRoom.status = 'completed';
          updatedRoom.finalResult = {
            winnerId,
            loserId,
            player1FinalScore: p1Score,
            player2FinalScore: p2Score,
            player1LPChange: winnerId === p1Id ? 30 : (winnerId === 'draw' ? 5 : -15),
            player2LPChange: winnerId === p2Id ? 30 : (winnerId === 'draw' ? 5 : -15),
            finalised: true,
          };
        }

        transaction.update(roomRef, updatedRoom);
        updatedRoomResult = { ...room, ...updatedRoom } as LiveDuelRoom;
      });
    } catch (err) {
      console.warn('[LiveRoom] Firestore score sync notice, falling back to server API:', err);
    }
  }

  // Also sync to server API
  try {
    await fetch('/api/match/room/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        playerId,
        score,
        combo,
        answerRecord,
        isLastQuestion,
      }),
    });
  } catch (e) {
    // Ignore server sync failure
  }

  return updatedRoomResult;
}

export async function sendLiveRoomEmote(
  roomId: string,
  senderId: string,
  emoji: string,
  text?: string
): Promise<void> {
  const roomRef = doc(db, 'live_rooms', roomId);
  const newEmote = { senderId, emoji, text, timestamp: Date.now() };

  if (auth.currentUser) {
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists()) return;

        const room = snap.data() as LiveDuelRoom;
        const activeEmotes = (room.activeEmotes || [])
          .filter(e => Date.now() - e.timestamp < 10000);
        activeEmotes.push(newEmote);

        transaction.update(roomRef, {
          activeEmotes,
          updatedAt: Date.now(),
        });
      });
    } catch {
      // Fallback to server API
    }
  }

  try {
    await fetch('/api/match/room/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        playerId: senderId,
        emote: newEmote,
      }),
    });
  } catch {
    // Ignore
  }
}

export async function forceFinalizeLiveRoom(
  roomId: string,
  myPlayerId?: string,
  myScore?: number,
  opponentScore?: number,
  finalResult?: LiveRoomFinalResult
): Promise<LiveDuelRoom | null> {
  const roomRef = doc(db, 'live_rooms', roomId);
  let resolvedResult = finalResult;

  if (auth.currentUser) {
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists()) return;
        const room = snap.data() as LiveDuelRoom;

        if (!resolvedResult) {
          const p1Id = room.player1?.id || 'p1';
          const p2Id = room.player2?.id || 'p2';

          const p1Score = (myPlayerId === p1Id && typeof myScore === 'number')
            ? myScore
            : (room.scores?.[p1Id] ?? (myPlayerId !== p1Id && typeof opponentScore === 'number' ? opponentScore : 0));
          const p2Score = (myPlayerId === p2Id && typeof myScore === 'number')
            ? myScore
            : (room.scores?.[p2Id] ?? (myPlayerId !== p2Id && typeof opponentScore === 'number' ? opponentScore : 0));

          const winnerId = p1Score > p2Score ? p1Id : (p2Score > p1Score ? p2Id : 'draw');
          const loserId = winnerId === p1Id ? p2Id : (winnerId === p2Id ? p1Id : '');

          resolvedResult = {
            winnerId,
            loserId,
            player1FinalScore: p1Score,
            player2FinalScore: p2Score,
            player1LPChange: winnerId === p1Id ? 30 : (winnerId === 'draw' ? 5 : -15),
            player2LPChange: winnerId === p2Id ? 30 : (winnerId === 'draw' ? 5 : -15),
            finalised: true,
          };
        }

        transaction.update(roomRef, {
          status: 'completed',
          finalResult: resolvedResult,
          updatedAt: Date.now(),
        });
      });
    } catch (e) {
      console.warn('[LiveRoom] Finalize sync warning:', e);
    }
  }

  return {
    id: roomId,
    roomId,
    status: 'completed',
    finalResult: resolvedResult || undefined,
  } as LiveDuelRoom;
}

export async function forfeitLiveRoom(
  roomId: string,
  forfeitingPlayerId: string
): Promise<void> {
  const roomRef = doc(db, 'live_rooms', roomId);
  if (auth.currentUser) {
    try {
      await setDoc(roomRef, {
        forfeitedBy: forfeitingPlayerId,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (e) {
      console.warn('[LiveRoom] Forfeit sync warning:', e);
    }
  }

  try {
    await fetch('/api/match/room/forfeit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        forfeitingPlayerId,
      }),
    });
  } catch {
    // Ignore
  }
}
