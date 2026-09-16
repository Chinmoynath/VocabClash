import { useSyncExternalStore } from 'react';
import { User } from 'firebase/auth';
import { Unsubscribe } from 'firebase/firestore';
import { PlayerProfile, LeaderboardUser } from '../types';
import { 
  getDeterministicBots, 
  buildMergedLeaderboard, 
  subscribeToRealLeaderboardUsers, 
  syncUserToLeaderboard,
  INCLUDE_BOTS_IN_RANKLIST
} from './leaderboardService';

export interface UserRankStats {
  uid: string | null;
  name: string;
  avatar: string;
  photoURL?: string | null;
  targetExam: string;
  wins: number;
  battles: number;
  lp: number;
  rank: number | null;
  percentile: number;
  level: number;
  streak: number;
  tierTitle: string;
  winRate: number;
  countryCode: string;
  totalAspirants: number;
}

export interface SharedLeaderboardState {
  realUsers: LeaderboardUser[];
  mergedLeaderboard: LeaderboardUser[];
  top10: LeaderboardUser[];
  totalAspirants: number;
  lastFetchedAt: number | null;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
}

export interface RankStoreSnapshot {
  userStats: UserRankStats | null;
  leaderboard: SharedLeaderboardState;
  userRank: number;
  exactPercentile: number;
  top10List: LeaderboardUser[];
  bracketSlice: LeaderboardUser[];
  nextTargetInfo: { lpNeeded: number; targetRank: number } | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

// 3-minute stale-while-revalidate threshold
const STALE_TTL_MS = 3 * 60 * 1000;
// 2-minute threshold for app background/resume revalidation
const RESUME_STALE_TTL_MS = 2 * 60 * 1000;

// Shared public storage key for fast cold-start hydration (only public data, no private user credentials)
const STORAGE_KEY_SHARED_LEADERBOARD = 'vocabclash_shared_leaderboard_cache_v1';

function getNamespacedUserStatsKey(uid?: string | null): string | null {
  if (!uid || uid === 'default_user' || uid.startsWith('guest_')) return null;
  return `vocabclash:user:${uid}:stats`;
}

class RankStore {
  private listeners = new Set<() => void>();
  private unsubscribeFirestore: Unsubscribe | null = null;
  private activeUid: string | null = null;
  private lastActiveTimestamp = Date.now();

  // In-Memory State
  private realUsers: LeaderboardUser[] = [];
  private mergedLeaderboard: LeaderboardUser[] = [];
  private currentPlayer: PlayerProfile | null = null;
  private lastFetchedAt: number | null = null;
  private hasLoadedOnce = false;
  private isRefreshing = false;

  // Cached computed snapshot for useSyncExternalStore referential stability
  private cachedSnapshot: RankStoreSnapshot | null = null;

  constructor() {
    // Attempt fast local hydration of shared public rankings for instant first render
    if (typeof window !== 'undefined') {
      try {
        const rawShared = localStorage.getItem(STORAGE_KEY_SHARED_LEADERBOARD);
        if (rawShared) {
          const parsed = JSON.parse(rawShared);
          if (Array.isArray(parsed.users) && parsed.users.length > 0) {
            this.realUsers = parsed.users;
            this.lastFetchedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : null;
            this.hasLoadedOnce = true;
          }
        }
      } catch {
        /* storage read failure ignored */
      }

      // Listen to app backgrounding / foregrounding
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleAppResume();
        } else {
          this.lastActiveTimestamp = Date.now();
        }
      });

      window.addEventListener('focus', () => {
        this.handleAppResume();
      });
    }
  }

  // --- External Store Subscription API ---
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.cachedSnapshot = null; // Invalidate memoized snapshot
    for (const listener of this.listeners) {
      listener();
    }
  }

  // --- Computations ---
  private recomputeMergedLeaderboard() {
    const baseBots = getDeterministicBots();
    if (this.currentPlayer) {
      this.mergedLeaderboard = buildMergedLeaderboard(
        baseBots,
        this.realUsers,
        this.currentPlayer,
        INCLUDE_BOTS_IN_RANKLIST
      );
    } else {
      this.mergedLeaderboard = [];
    }
  }

  public getSnapshot = (): RankStoreSnapshot => {
    if (this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    const totalAspirants = this.mergedLeaderboard.length;
    let myIndex = 0;
    let userRank = 1;
    let exactPercentile = 100;

    if (this.currentPlayer && totalAspirants > 0) {
      const idx = this.mergedLeaderboard.findIndex(
        (u) => u.isCurrentUser || u.id === this.currentPlayer?.id || (this.activeUid && u.id === this.activeUid)
      );
      if (idx !== -1) {
        myIndex = idx;
        const entry = this.mergedLeaderboard[myIndex];
        userRank = entry?.rank ?? myIndex + 1;
      }

      if (totalAspirants > 1) {
        const candidatesBelow = Math.max(0, totalAspirants - userRank);
        exactPercentile = Math.min(
          99.9,
          Math.max(1.0, (candidatesBelow / (totalAspirants - 1)) * 100)
        );
      }
    }

    const top10List = this.mergedLeaderboard.slice(0, 10);

    let bracketSlice: LeaderboardUser[] = [];
    if (this.mergedLeaderboard.length > 1) {
      const start = Math.max(0, myIndex - 2);
      const end = Math.min(this.mergedLeaderboard.length, myIndex + 3);
      bracketSlice = this.mergedLeaderboard.slice(start, end);
    }

    let nextTargetInfo: { lpNeeded: number; targetRank: number } | null = null;
    if (this.currentPlayer && myIndex > 0 && this.mergedLeaderboard[myIndex - 1]) {
      const playerAbove = this.mergedLeaderboard[myIndex - 1];
      const diff = playerAbove.rankPoints - (this.currentPlayer.rankPoints || 0);
      nextTargetInfo = {
        lpNeeded: diff > 0 ? diff + 1 : 10,
        targetRank: playerAbove.rank,
      };
    }

    // User rank stats
    let userStats: UserRankStats | null = null;
    if (this.currentPlayer) {
      userStats = {
        uid: this.activeUid,
        name: this.currentPlayer.name,
        avatar: this.currentPlayer.avatar,
        photoURL: this.currentPlayer.photoURL,
        targetExam: this.currentPlayer.targetExam,
        wins: this.currentPlayer.matchesWon || 0,
        battles: this.currentPlayer.matchesPlayed || 0,
        lp: this.currentPlayer.rankPoints || 0,
        rank: userRank,
        percentile: exactPercentile,
        level: this.currentPlayer.level || 1,
        streak: this.currentPlayer.winStreak || 0,
        tierTitle: this.currentPlayer.tierTitle || 'Aspirant',
        winRate: this.currentPlayer.accuracyRate || 0,
        countryCode: this.currentPlayer.countryCode || 'IN',
        totalAspirants,
      };
    }

    // True first load is active only if no data has ever arrived and we have no cached users
    const isLoading = !this.hasLoadedOnce && this.realUsers.length === 0;

    this.cachedSnapshot = {
      userStats,
      leaderboard: {
        realUsers: this.realUsers,
        mergedLeaderboard: this.mergedLeaderboard,
        top10: top10List,
        totalAspirants,
        lastFetchedAt: this.lastFetchedAt,
        isRefreshing: this.isRefreshing,
        hasLoadedOnce: this.hasLoadedOnce,
      },
      userRank,
      exactPercentile,
      top10List,
      bracketSlice,
      nextTargetInfo,
      isLoading,
      isRefreshing: this.isRefreshing,
    };

    return this.cachedSnapshot;
  };

  // --- Auth Lifecycle Management ---

  /**
   * Called on auth state changes and initial load.
   * Handles User A -> User B account switching safely, ensuring no data leakage.
   */
  public handleAuthChange(user: User | null, player: PlayerProfile | null) {
    const newUid = user?.uid || null;

    // If switching between different authenticated accounts:
    if (this.activeUid && newUid !== this.activeUid) {
      this.cleanupPreviousUser(this.activeUid);
    }

    this.activeUid = newUid;
    this.currentPlayer = player ? { ...player } : null;
    this.recomputeMergedLeaderboard();

    // If authenticated user logged in and we don't have a listener running for this UID:
    if (newUid) {
      this.ensureListenerStarted(newUid);
      // Persist user-namespaced stats in memory / storage
      this.saveUserScopedStats(newUid);
    } else {
      // Guest or logged out
      this.ensureListenerStarted(null);
    }

    this.notify();
  }

  /**
   * Updates player stats in memory immediately (e.g. after LP changes, profile edit).
   */
  public updatePlayer(player: PlayerProfile) {
    this.currentPlayer = { ...player };
    this.recomputeMergedLeaderboard();
    if (this.activeUid) {
      this.saveUserScopedStats(this.activeUid);
    }
    this.notify();
  }

  /**
   * Called immediately when a 1v1 battle finishes.
   * Instantly updates user stats and recalculates rank position in memory,
   * then syncs to Firestore in the background.
   */
  public handleBattleCompleted(updatedPlayer: PlayerProfile, authUid?: string | null) {
    this.currentPlayer = { ...updatedPlayer };
    this.recomputeMergedLeaderboard();

    const effectiveUid = authUid || this.activeUid || updatedPlayer.id;
    if (effectiveUid) {
      this.saveUserScopedStats(effectiveUid);
      // Asynchronously sync user to Firestore leaderboard collection
      syncUserToLeaderboard(updatedPlayer, effectiveUid).catch((err) => {
        console.warn('Battle completion leaderboard sync notice:', err);
      });
    }

    this.notify();
  }

  /**
   * Called on user sign out.
   * Completely clears user-specific state, unhooks listeners, wipes user-scoped storage,
   * and resets user stats to guest/default.
   */
  public handleLogout(loggedOutUid?: string | null) {
    const uidToClean = loggedOutUid || this.activeUid;

    // 1. Unsubscribe from Firestore snapshot listener
    if (this.unsubscribeFirestore) {
      try {
        this.unsubscribeFirestore();
      } catch {}
      this.unsubscribeFirestore = null;
    }

    // 2. Clear user-scoped cache from localStorage
    if (uidToClean) {
      this.cleanupPreviousUser(uidToClean);
    }

    // 3. Reset internal active user state
    this.activeUid = null;
    this.currentPlayer = null;
    this.recomputeMergedLeaderboard();

    // 4. Start fresh anonymous/guest listener
    this.ensureListenerStarted(null);

    this.notify();
  }

  /**
   * Helper to clean up user-scoped data
   */
  private cleanupPreviousUser(uid: string) {
    if (typeof window === 'undefined') return;
    try {
      const userKey = getNamespacedUserStatsKey(uid);
      if (userKey) {
        localStorage.removeItem(userKey);
      }
      localStorage.removeItem(`vocabclash_player_profile_${uid}`);
      // Remove any temporary session keys
      sessionStorage.removeItem(`vocabclash:user:${uid}:session`);
    } catch {}
  }

  private saveUserScopedStats(uid: string) {
    if (typeof window === 'undefined') return;
    const userKey = getNamespacedUserStatsKey(uid);
    if (!userKey || !this.currentPlayer) return;

    try {
      const statsPayload = {
        uid,
        lp: this.currentPlayer.rankPoints,
        wins: this.currentPlayer.matchesWon,
        battles: this.currentPlayer.matchesPlayed,
        winRate: this.currentPlayer.accuracyRate,
        streak: this.currentPlayer.winStreak,
        level: this.currentPlayer.level,
        targetExam: this.currentPlayer.targetExam,
        savedAt: Date.now(),
      };
      localStorage.setItem(userKey, JSON.stringify(statsPayload));
    } catch {}
  }

  // --- Realtime Firestore Subscription Management ---

  private ensureListenerStarted(_uid: string | null) {
    if (this.unsubscribeFirestore) {
      // Listener is already active across the session
      return;
    }

    this.isRefreshing = true;

    this.unsubscribeFirestore = subscribeToRealLeaderboardUsers((incomingUsers) => {
      this.realUsers = incomingUsers;
      this.lastFetchedAt = Date.now();
      this.hasLoadedOnce = true;
      this.isRefreshing = false;

      // Recompute rankings with fresh data
      this.recomputeMergedLeaderboard();

      // Persist shared public rankings for instant cold load
      if (typeof window !== 'undefined' && incomingUsers.length > 0) {
        try {
          localStorage.setItem(
            STORAGE_KEY_SHARED_LEADERBOARD,
            JSON.stringify({
              users: incomingUsers.slice(0, 100), // Cache top 100 public entries
              savedAt: Date.now(),
            })
          );
        } catch {}
      }

      this.notify();
    });
  }

  // --- Stale-While-Revalidate Checks ---

  /**
   * Check if leaderboard data is stale. Called when user visits Rank tab.
   * Does NOT refetch if fresh. If stale, revalidates silently in background.
   */
  public checkAndRevalidateIfStale() {
    if (!this.lastFetchedAt) return;
    const age = Date.now() - this.lastFetchedAt;

    if (age > STALE_TTL_MS && !this.isRefreshing) {
      this.silentRevalidate();
    }
  }

  /**
   * Called when app is reopened or becomes visible after being backgrounded.
   */
  public handleAppResume() {
    const elapsedSinceActive = Date.now() - this.lastActiveTimestamp;
    const dataAge = this.lastFetchedAt ? Date.now() - this.lastFetchedAt : Infinity;

    if (elapsedSinceActive > RESUME_STALE_TTL_MS || dataAge > STALE_TTL_MS) {
      this.silentRevalidate();
    }
    this.lastActiveTimestamp = Date.now();
  }

  /**
   * Performs silent background revalidation without blocking UI or showing skeletons
   */
  public silentRevalidate() {
    // If we have an active listener, restarting it or touching it pulls latest
    if (!this.unsubscribeFirestore) {
      this.ensureListenerStarted(this.activeUid);
      return;
    }

    // Listener is continuous; to ensure fresh sync if connection was paused:
    if (this.currentPlayer) {
      syncUserToLeaderboard(this.currentPlayer, this.activeUid).catch(() => {});
    }
  }
}

// Global Singleton Instance
export const rankStore = new RankStore();

/**
 * Custom React Hook for consuming the Rank Store.
 * Uses useSyncExternalStore for tear-free, instant synchronous renders.
 */
export function useRankStore(): RankStoreSnapshot {
  return useSyncExternalStore(
    rankStore.subscribe,
    rankStore.getSnapshot,
    rankStore.getSnapshot
  );
}
