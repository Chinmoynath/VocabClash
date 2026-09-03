/**
 * Network Connection & Latency Manager
 * Tracks real-time connectivity status (online/offline events + active ping probe)
 * for 1v1 duels, matchmaking, and offline fallback modes.
 */

type NetworkStatusCallback = (status: {
  isOnline: boolean;
  pingMs: number | null;
  quality: 'good' | 'fair' | 'poor' | 'offline';
}) => void;

class NetworkManager {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private currentPing: number | null = null;
  private subscribers: Set<NetworkStatusCallback> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
      // Run initial check
      this.checkLatency();
      // Periodic background probe every 15s if online
      this.pingInterval = setInterval(() => {
        if (this.online) {
          this.checkLatency();
        }
      }, 15000);
    }
  }

  private handleOnlineEvent = () => {
    this.online = true;
    this.checkLatency();
    this.notifySubscribers();
  };

  private handleOfflineEvent = () => {
    this.online = false;
    this.currentPing = null;
    this.notifySubscribers();
  };

  public isOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine && this.online;
    }
    return this.online;
  }

  public getPing(): number | null {
    return this.currentPing;
  }

  public getQuality(): 'good' | 'fair' | 'poor' | 'offline' {
    if (!this.isOnline()) return 'offline';
    if (this.currentPing === null) return 'good';
    if (this.currentPing < 150) return 'good';
    if (this.currentPing < 350) return 'fair';
    return 'poor';
  }

  public async checkLatency(): Promise<{ isOnline: boolean; pingMs: number | null }> {
    if (this.isChecking) {
      return { isOnline: this.isOnline(), pingMs: this.currentPing };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.online = false;
      this.currentPing = null;
      this.notifySubscribers();
      return { isOnline: false, pingMs: null };
    }

    this.isChecking = true;
    const startTime = Date.now();

    try {
      // Lightweight fetch to health endpoint with cache-busting
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`/api/health?t=${startTime}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const ping = Date.now() - startTime;
        this.online = true;
        this.currentPing = ping;
      } else {
        this.online = true;
        this.currentPing = Math.max(50, Date.now() - startTime);
      }
    } catch {
      // Check if navigator says offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.online = false;
        this.currentPing = null;
      } else {
        // May be sandbox / iframe restricted, but browser considers online
        this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.currentPing = this.online ? 80 : null;
      }
    } finally {
      this.isChecking = false;
      this.notifySubscribers();
    }

    return { isOnline: this.isOnline(), pingMs: this.currentPing };
  }

  public subscribe(callback: NetworkStatusCallback): () => void {
    this.subscribers.add(callback);
    // Immediately inform new subscriber
    callback({
      isOnline: this.isOnline(),
      pingMs: this.currentPing,
      quality: this.getQuality(),
    });

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    const status = {
      isOnline: this.isOnline(),
      pingMs: this.currentPing,
      quality: this.getQuality(),
    };
    this.subscribers.forEach(cb => {
      try {
        cb(status);
      } catch (err) {
        console.warn('[NetworkManager] Error notifying subscriber:', err);
      }
    });
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
      if (this.pingInterval) clearInterval(this.pingInterval);
    }
    this.subscribers.clear();
  }
}

export const networkManager = new NetworkManager();
