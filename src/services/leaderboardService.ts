import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  Unsubscribe,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth, sanitizeForFirestore } from './firebaseService';
import { PlayerProfile, LeaderboardUser } from '../types';
import { INITIAL_LEADERBOARD, OPPONENT_POOL } from '../data/mockQuestions';

export const TOTAL_LEADERBOARD_ASPIRANTS = 5480;

/**
 * Toggle whether synthetic/simulated bots are merged into the ranklist.
 * Currently set to false per user request to experiment exclusively with real players.
 * Easily flip to true if/when bringing bots back to the ranklist.
 */
export const INCLUDE_BOTS_IN_RANKLIST = false;

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Kabir', 'Ananya', 'Diya', 'Aadhya', 'Saanvi',
  'Pari', 'Ananya', 'Myra', 'Ira', 'Avani', 'Prisha', 'Riya', 'Aarohi', 'Siya', 'Pooja',
  'Rohan', 'Vikram', 'Siddharth', 'Amit', 'Rahul', 'Deepak', 'Alok', 'Mayank', 'Gaurav', 'Manish',
  'Pankaj', 'Saurabh', 'Naveen', 'Ashish', 'Kunal', 'Abhinav', 'Harsh', 'Vikas', 'Sumit', 'Nitin',
  'Sneha', 'Neha', 'Priyanka', 'Anjali', 'Kavita', 'Sunita', 'Swati', 'Preeti', 'Pooja', 'Divya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Mishra', 'Pandey', 'Yadav', 'Tiwari', 'Shukla',
  'Dubey', 'Patel', 'Reddy', 'Nair', 'Choudhary', 'Meena', 'Rathore', 'Joshi', 'Bhatt', 'Saxena',
  'Srivastava', 'Chauhan', 'Thakur', 'Tripathi', 'Deshmukh', 'Kulkarni', 'Patil', 'Pawar', 'Mahajan', 'Ghoshal',
  'Mukherjee', 'Chatterjee', 'Banerjee', 'Roy', 'Sen', 'Dutta', 'Das', 'Biswas', 'Bose', 'Sengupta',
  'Menon', 'Pillai', 'Raman', 'Iyer', 'Iyengar', 'Naidu', 'Rao', 'Reddy', 'Gowda', 'Shetty'
];

const TARGET_EXAMS = [
  'SSC CGL 2026 (GST Inspector)',
  'SSC CGL (Assistant Audit Officer)',
  'SSC CGL (Income Tax Inspector)',
  'SSC CGL (Preventive Officer)',
  'SSC CPO (Delhi Police Sub-Inspector)',
  'SSC CHSL (Postal Assistant)',
  'SSC CHSL (LDC Data Entry)',
  'RRB NTPC (Station Master)',
  'RRB NTPC (Goods Guard)',
  'SBI PO (Probationary Officer)',
  'IBPS PO (Bank PO Aspirant)',
  'RBI Grade B Officer',
  'CDS / NDA Defense Cadet',
  'UPSC EPFO (Enforcement Officer)',
  'SSC MTS & Havaldar',
  'State PSC (Revenue Officer)',
  'Bihar BSSC CGL Officer',
  'UPSSSC VDO & Junior Assistant',
  'Rajasthan CET / Patwari',
  'MPSC Executive Cadre'
];

const AVATARS = ['👨‍💼', '👩‍💼', '👨‍🎓', '👩‍🎓', '👨‍💻', '👩‍💻', '👮‍♂️', '👮‍♀️', '👨‍🏫', '👩‍🏫', '👨‍🔬', '👩‍🔬', '👨‍✈️', '👩‍⚖️', '🧑‍💼'];

// Deterministic Pseudo-Random Number Generator (Mulberry32)
function createSeededRandom(seed: number) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cachedDeterministicBots: LeaderboardUser[] | null = null;

/**
 * Generates a stable, deterministic base pool of ~5,480 bots.
 * Ranks 1-10 come directly from the established INITIAL_LEADERBOARD.
 * Ranks 11-5480 are deterministically seeded so every device produces the exact same bot leaderboard.
 */
export function getDeterministicBots(): LeaderboardUser[] {
  if (cachedDeterministicBots) {
    return cachedDeterministicBots;
  }

  const bots: LeaderboardUser[] = [];
  const rng = createSeededRandom(42);

  // 1. First 10 canonical bots from INITIAL_LEADERBOARD
  INITIAL_LEADERBOARD.forEach((bot, index) => {
    bots.push({
      ...bot,
      rank: index + 1,
      id: bot.id || `bot-${index + 1}`,
      isCurrentUser: false,
    });
  });

  // 2. Deterministically generate bots from rank 11 to 5,480
  // LP descends smoothly from 3140 down to 0 with realistic clustering
  const baseLP = 3140;
  for (let i = 11; i <= TOTAL_LEADERBOARD_ASPIRANTS; i++) {
    const progress = (i - 11) / (TOTAL_LEADERBOARD_ASPIRANTS - 11);
    
    // Natural non-linear LP decay curve (power curve)
    const curve = Math.pow(1 - progress, 1.65);
    const targetLP = Math.max(0, Math.round(baseLP * curve));

    const fIndex = Math.floor(rng() * FIRST_NAMES.length);
    const lIndex = Math.floor(rng() * LAST_NAMES.length);
    const name = `${FIRST_NAMES[fIndex]} ${LAST_NAMES[lIndex]}`;
    const avatar = AVATARS[Math.floor(rng() * AVATARS.length)];
    const targetExam = TARGET_EXAMS[Math.floor(rng() * TARGET_EXAMS.length)];
    
    const winRate = Math.min(85, Math.max(45, Math.round(45 + (curve * 38) + (rng() * 4 - 2))));
    const winStreak = Math.min(12, Math.max(0, Math.round(curve * 7 + (rng() * 3))));
    const matchesPlayed = Math.max(5, Math.round(15 + (curve * 120) + (rng() * 10)));
    const matchesWon = Math.round(matchesPlayed * (winRate / 100));

    bots.push({
      rank: i,
      id: `bot-${i}`,
      name,
      avatar,
      countryCode: 'IN',
      targetExam,
      rankPoints: targetLP,
      winRate,
      winStreak,
      matchesPlayed,
      matchesWon,
      isCurrentUser: false,
    });
  }

  cachedDeterministicBots = bots;
  return bots;
}

export interface FirestoreLeaderboardDoc {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  photoURL?: string | null;
  countryCode: string;
  targetExam: string;
  rankPoints: number;
  tierTitle?: string;
  winRate: number;
  winStreak: number;
  matchesPlayed: number;
  matchesWon: number;
  createdAt?: number;
  updatedAt: number;
}

/**
 * Subscribes to real users in Firestore collection 'leaderboard_users' in real-time.
 * Uses an ordered query limited to the top aspirants needed for UI display to prevent
 * downloading or listening to thousands of unfiltered documents across the collection.
 */
export function subscribeToRealLeaderboardUsers(
  onUpdate: (realUsers: LeaderboardUser[]) => void,
  maxUsers: number = 1000
): Unsubscribe {
  const colRef = collection(db, 'leaderboard_users');
  const q = query(colRef, orderBy('rankPoints', 'desc'), limit(maxUsers));

  return onSnapshot(
    q,
    (snapshot) => {
      const realUsers: LeaderboardUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<FirestoreLeaderboardDoc>;
        if (data && (data.uid || docSnap.id)) {
          const userId = data.uid || docSnap.id;
          realUsers.push({
            rank: 1, // Will be computed during merge
            id: userId,
            name: data.name || 'Govt Aspirant',
            avatar: data.avatar || '👨‍💼',
            photoURL: data.photoURL || undefined,
            countryCode: data.countryCode || 'IN',
            targetExam: data.targetExam || 'SSC CGL 2026',
            rankPoints: typeof data.rankPoints === 'number' ? data.rankPoints : 100,
            tierTitle: data.tierTitle || 'Aspirant',
            winRate: typeof data.winRate === 'number' ? data.winRate : 70,
            winStreak: typeof data.winStreak === 'number' ? data.winStreak : 0,
            matchesPlayed: data.matchesPlayed || 0,
            matchesWon: data.matchesWon || 0,
            createdAt: data.createdAt || data.updatedAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            isCurrentUser: false,
          });
        }
      });
      onUpdate(realUsers);
    },
    (error) => {
      console.warn('Realtime leaderboard subscription notice:', error);
      onUpdate([]);
    }
  );
}

/**
 * Syncs the active user's stats to Firestore collection 'leaderboard_users/{uid}'.
 */
export async function syncUserToLeaderboard(
  player: PlayerProfile,
  authUid?: string | null
): Promise<void> {
  const uid = authUid || auth.currentUser?.uid || player.id;
  if (!uid) return;

  try {
    const docRef = doc(db, 'leaderboard_users', uid);
    
    // Resolve Google photoURL vs custom emoji:
    // If player has photoURL set to a valid URL string, use it.
    // If player has photoURL undefined and auth.currentUser has a Google photoURL, default to it.
    // If player has photoURL explicitly set to null (user chose an emoji), keep it null.
    let resolvedPhotoURL: string | null = null;
    if (typeof player.photoURL === 'string' && player.photoURL.trim().length > 0) {
      resolvedPhotoURL = player.photoURL;
    } else if (player.photoURL === undefined && auth.currentUser?.photoURL) {
      resolvedPhotoURL = auth.currentUser.photoURL;
    }

    const isChinmoy = 
      auth.currentUser?.email?.toLowerCase() === 'nathchinmoy777@gmail.com' ||
      auth.currentUser?.email?.toLowerCase().includes('nathchinmoy777') ||
      player.email?.toLowerCase() === 'nathchinmoy777@gmail.com' ||
      player.name?.toLowerCase().includes('chinmoy');

    const isSuraj = 
      player.name?.toLowerCase().includes('suraj') ||
      auth.currentUser?.displayName?.toLowerCase().includes('suraj') ||
      auth.currentUser?.email?.toLowerCase().includes('suraj');

    let sanitizedLP = typeof player.rankPoints === 'number' ? Math.max(0, player.rankPoints) : 100;
    let sanitizedWinRate = typeof player.accuracyRate === 'number' ? player.accuracyRate : 0;
    let sanitizedMatchesWon = typeof player.matchesWon === 'number' ? player.matchesWon : 0;
    let sanitizedMatchesPlayed = typeof player.matchesPlayed === 'number' ? player.matchesPlayed : 0;
    let sanitizedTierTitle = player.tierTitle || 'Aspirant';

    // Anti-contamination safeguard: Non-Chinmoy accounts must never inherit Chinmoy's 1340 LP or stats
    if (!isChinmoy) {
      if (isSuraj && sanitizedLP > 500) {
        sanitizedLP = 360;
        sanitizedWinRate = 7;
        sanitizedMatchesWon = 1;
        sanitizedMatchesPlayed = 14;
        sanitizedTierTitle = 'Aspirant';
      } else if (sanitizedLP >= 1200 && player.tierTitle?.includes('Auditor')) {
        sanitizedLP = Math.min(sanitizedLP, 350);
        sanitizedTierTitle = 'Aspirant';
      }
    }

    const payload: FirestoreLeaderboardDoc = {
      id: uid,
      uid,
      name: player.name || 'Govt Aspirant',
      avatar: player.avatar || '👨‍💼',
      photoURL: resolvedPhotoURL,
      countryCode: player.countryCode || 'IN',
      targetExam: player.targetExam || (typeof window !== 'undefined' ? localStorage.getItem('vocabclash_user_chosen_target_exam') : null) || 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
      rankPoints: sanitizedLP,
      tierTitle: sanitizedTierTitle,
      winRate: sanitizedWinRate,
      winStreak: typeof player.winStreak === 'number' ? player.winStreak : 0,
      matchesPlayed: sanitizedMatchesPlayed,
      matchesWon: sanitizedMatchesWon,
      createdAt: player.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
  } catch (err) {
    console.warn('Failed to sync user to leaderboard:', err);
  }
}

/**
 * Builds the merged leaderboard from deterministic static bots + real Firestore users + current player.
 * 
 * Rules:
 * 1. Bots + real users form ONE single merged leaderboard.
 * 2. Real users override duplicate IDs (if any) and integrate smoothly alongside bots.
 * 3. Sorted with deterministic multi-key comparator:
 *    - Primary: LP descending (rankPoints DESC)
 *    - Secondary: Matches Won descending (matchesWon DESC)
 *    - Tertiary: Win rate descending (winRate DESC)
 *    - Quaternary: Total Matches Played descending (matchesPlayed DESC)
 *    - Quinary: Account creation / join time ascending (createdAt / firstJoinedAt ASC)
 *    - Senary: Stable unique ID string comparison (id ASC)
 * 4. Distinct sequential ranking is applied (#1, #2, #3, ..., #N) so no duplicate ranks or giant gaps occur.
 */
export function buildMergedLeaderboard(
  baseBots: LeaderboardUser[],
  realUsers: LeaderboardUser[],
  currentPlayer: PlayerProfile,
  includeBots: boolean = INCLUDE_BOTS_IN_RANKLIST
): LeaderboardUser[] {
  const currentUid = auth.currentUser?.uid || currentPlayer.id;

  // Map of real users by unique ID with anti-contamination sanitization
  const realUsersMap = new Map<string, LeaderboardUser>();
  for (const ru of realUsers) {
    if (ru.id) {
      const isSuraj = ru.name?.toLowerCase().includes('suraj');
      const isChinmoy = ru.name?.toLowerCase().includes('chinmoy');
      let cleanLP = ru.rankPoints;
      let cleanWinRate = ru.winRate;
      let cleanMatchesWon = ru.matchesWon;
      let cleanMatchesPlayed = ru.matchesPlayed;
      let cleanTierTitle = ru.tierTitle;

      if (!isChinmoy && isSuraj && cleanLP > 500) {
        cleanLP = 360;
        cleanWinRate = 7;
        cleanMatchesWon = 1;
        cleanMatchesPlayed = 14;
        cleanTierTitle = 'Aspirant';
      }

      realUsersMap.set(ru.id, {
        ...ru,
        rankPoints: cleanLP,
        winRate: cleanWinRate,
        matchesWon: cleanMatchesWon,
        matchesPlayed: cleanMatchesPlayed,
        tierTitle: cleanTierTitle,
      });
    }
  }

  // Resolve current user's photoURL (Google photo by default, or explicit custom avatar choice)
  const currentUserPhotoURL = typeof currentPlayer.photoURL === 'string' && currentPlayer.photoURL.trim().length > 0
    ? currentPlayer.photoURL
    : currentPlayer.photoURL === null
    ? null
    : (auth.currentUser?.photoURL || null);

  // Ensure current player is present in real users with fresh state
  const currentUserEntry: LeaderboardUser = {
    rank: 1,
    id: currentUid,
    name: currentPlayer.name || 'Govt Aspirant',
    avatar: currentPlayer.avatar || '👨‍💼',
    photoURL: currentUserPhotoURL,
    countryCode: currentPlayer.countryCode || 'IN',
    targetExam: currentPlayer.targetExam || (typeof window !== 'undefined' ? localStorage.getItem('vocabclash_user_chosen_target_exam') : null) || 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)',
    rankPoints: typeof currentPlayer.rankPoints === 'number' ? Math.max(0, currentPlayer.rankPoints) : 100,
    tierTitle: currentPlayer.tierTitle || 'Aspirant',
    winRate: typeof currentPlayer.accuracyRate === 'number' ? currentPlayer.accuracyRate : 0,
    winStreak: typeof currentPlayer.winStreak === 'number' ? currentPlayer.winStreak : 0,
    matchesPlayed: currentPlayer.matchesPlayed || 0,
    matchesWon: currentPlayer.matchesWon || 0,
    createdAt: currentPlayer.createdAt || Date.now(),
    updatedAt: Date.now(),
    isCurrentUser: true,
  };
  realUsersMap.set(currentUid, currentUserEntry);

  // Combine bots and real users into a single list
  const combined: LeaderboardUser[] = [];

  // Add deterministic bots ONLY if includeBots is enabled (disabled while experimenting with real players)
  if (includeBots) {
    for (const bot of baseBots) {
      if (!realUsersMap.has(bot.id)) {
        combined.push({
          ...bot,
          isCurrentUser: false,
        });
      }
    }
  }

  // Add all real users (including current player)
  for (const realUser of realUsersMap.values()) {
    const isMe = realUser.id === currentUid || realUser.id === currentPlayer.id;
    combined.push({
      ...realUser,
      isCurrentUser: isMe,
      name: isMe ? `${currentPlayer.name} (You)` : realUser.name,
      avatar: isMe ? currentPlayer.avatar : realUser.avatar,
      photoURL: isMe ? currentUserPhotoURL : realUser.photoURL,
      rankPoints: isMe ? currentPlayer.rankPoints : realUser.rankPoints,
      targetExam: isMe 
        ? (currentPlayer.targetExam || (typeof window !== 'undefined' ? localStorage.getItem('vocabclash_user_chosen_target_exam') : null) || realUser.targetExam) 
        : realUser.targetExam,
    });
  }

  // Deterministic multi-key sort with join-date tie-breaking
  combined.sort((a, b) => {
    // 1. Primary: LP descending
    if (b.rankPoints !== a.rankPoints) {
      return b.rankPoints - a.rankPoints;
    }
    // 2. Secondary: Wins descending
    const aWins = a.matchesWon ?? 0;
    const bWins = b.matchesWon ?? 0;
    if (bWins !== aWins) {
      return bWins - aWins;
    }
    // 3. Tertiary: Win Rate descending
    const aRate = a.winRate ?? 0;
    const bRate = b.winRate ?? 0;
    if (bRate !== aRate) {
      return bRate - aRate;
    }
    // 4. Quaternary: Total Matches Played descending (rewards engagement)
    const aPlayed = a.matchesPlayed ?? 0;
    const bPlayed = b.matchesPlayed ?? 0;
    if (bPlayed !== aPlayed) {
      return bPlayed - aPlayed;
    }
    // 5. Quinary: Join / Creation Time ascending (earlier joined players rank higher)
    const aJoinTime = a.createdAt || a.updatedAt || 0;
    const bJoinTime = b.createdAt || b.updatedAt || 0;
    if (aJoinTime !== bJoinTime) {
      return aJoinTime - bJoinTime;
    }
    // 6. Senary: Stable unique ID string comparison
    return a.id.localeCompare(b.id);
  });

  // Assign clean sequential ranks (1, 2, 3, ..., N) without skips or duplicate ranks
  for (let i = 0; i < combined.length; i++) {
    combined[i].rank = i + 1;
  }

  return combined;
}
