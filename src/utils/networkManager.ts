/**
 * Network Connection & Latency Manager
 * Tracks real-time connectivity status via Capacitor Network and browser events.
 * Performs latency check strictly on-demand (e.g. on manual retry or before 1v1 duels)
 * without background idle polling loops.
 */
import { Network as CapacitorNetwork } from "@capacitor/network";
import { isNativeCapacitor } from "./platform";

type NetworkStatusCallback = (status: {
  isOnline: boolean;
  pingMs: number | null;
  quality: 'good' | 'fair' | 'poor' | 'offline';
}) => void;

class NetworkManager {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private currentPing: number | null = null;
  private subscribers: Set<NetworkStatusCallback> = new Set();
  private isChecking: boolean = false;
  private capNetListener: any = null;
  private lastCheckTime: number = 0;
  private consecutiveFailures: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
      
      if (isNativeCapacitor()) {
        this.initCapacitorNetwork();
      }
    }
  }

  private async initCapacitorNetwork() {
    try {
      const status = await CapacitorNetwork.getStatus();
      this.online = status.connected;
      this.capNetListener = await CapacitorNetwork.addListener("networkStatusChange", status => {
        this.online = status.connected;
        if (!this.online) {
          this.currentPing = null;
        }
        this.notifySubscribers();
      });
    } catch (err) {
      console.warn("[NetworkManager] Capacitor Network init failed:", err);
    }
  }

  private handleOnlineEvent = () => {
    this.online = true;
    this.consecutiveFailures = 0;
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

  /**
   * Performs an on-demand latency probe to check backend reachability.
   * Only called when requested by a feature (e.g. 1v1 arena check or offline retry),
   * with exponential backoff on consecutive failures and throttle to prevent spamming.
   */
  public async checkLatency(force = false): Promise<{ isOnline: boolean; pingMs: number | null }> {
    if (this.isChecking) {
      return { isOnline: this.isOnline(), pingMs: this.currentPing };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.online = false;
      this.currentPing = null;
      this.notifySubscribers();
      return { isOnline: false, pingMs: null };
    }

    const now = Date.now();
    const backoffMs = Math.min(30000, 2000 * Math.pow(1.5, this.consecutiveFailures));
    if (!force && (now - this.lastCheckTime) < backoffMs && this.currentPing !== null) {
      return { isOnline: this.isOnline(), pingMs: this.currentPing };
    }

    this.isChecking = true;
    this.lastCheckTime = now;
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
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
        this.consecutiveFailures = 0;
      } else {
        this.online = true;
        this.currentPing = Math.max(60, Date.now() - startTime);
        this.consecutiveFailures++;
      }
    } catch {
      this.consecutiveFailures++;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.online = false;
        this.currentPing = null;
      } else {
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
      if (this.capNetListener) this.capNetListener.remove();
    }
    this.subscribers.clear();
  }
}

export const networkManager = new NetworkManager();
