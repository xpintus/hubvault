import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '../auth';
import { db } from './db';
import { getQueueCount } from './syncQueue';
import {
  processSyncQueue,
  setupNetworkListeners,
  setSyncStatusCallback,
  setConflictCallback,
  SyncConflict
} from './syncEngine';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  currentConflict: SyncConflict | null;
  syncNow: () => Promise<void>;
  clearConflict: () => void;
  refreshQueueCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentConflict, setCurrentConflict] = useState<SyncConflict | null>(null);

  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setPendingCount(count);
    } catch (e) {
      console.error("Failed to read sync queue count:", e);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setupNetworkListeners();

    setSyncStatusCallback((syncing) => {
      setIsSyncing(syncing);
      if (!syncing) {
        setLastSyncTime(new Date());
        refreshQueueCount();
      }
    });

    setConflictCallback((conflict) => {
      setCurrentConflict(conflict);
    });

    // Initial check
    refreshQueueCount();

    // Poll queue count periodically
    const interval = setInterval(refreshQueueCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      setSyncStatusCallback(() => {});
      setConflictCallback(() => {});
    };
  }, [refreshQueueCount]);

  useEffect(() => {
      // Whenever the user logs in and we are online, process the queue
      if (session && isOnline) {
          processSyncQueue();
      }
  }, [session, isOnline]);

  const syncNow = async () => {
    if (!isOnline) return;
    await processSyncQueue(true);
    await refreshQueueCount();
  };

  const clearConflict = () => {
    setCurrentConflict(null);
    refreshQueueCount(); // Refresh count after conflict resolved
  };

  return (
    <SyncContext.Provider value={{
      isOnline,
      isSyncing,
      pendingCount,
      lastSyncTime,
      currentConflict,
      syncNow,
      clearConflict,
      refreshQueueCount
    }}>
      {children}
    </SyncContext.Provider>
  );
}
