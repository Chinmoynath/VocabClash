import { useState, useEffect } from 'react';
import { networkManager } from '../utils/networkManager';

export interface NetworkStatus {
  isOnline: boolean;
  pingMs: number | null;
  quality: 'good' | 'fair' | 'poor' | 'offline';
  checkConnection: () => Promise<{ isOnline: boolean; pingMs: number | null }>;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<{
    isOnline: boolean;
    pingMs: number | null;
    quality: 'good' | 'fair' | 'poor' | 'offline';
  }>({
    isOnline: networkManager.isOnline(),
    pingMs: networkManager.getPing(),
    quality: networkManager.getQuality(),
  });

  useEffect(() => {
    const unsubscribe = networkManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const checkConnection = () => networkManager.checkLatency();

  return {
    ...status,
    checkConnection,
  };
}
