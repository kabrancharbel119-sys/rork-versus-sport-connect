import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { offlineManager } from '@/lib/offline';

export const [OfflineProvider, useOffline] = createContextHook(() => {
  const [isOnline, setIsOnline] = useState(offlineManager.getIsOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe(setIsOnline);
    offlineManager.getPendingCount().then(setPendingCount);
    offlineManager.getLastSync().then(setLastSync);
    return unsubscribe;
  }, []);

  const queueAction = useCallback(async (type: string, payload: any) => {
    const id = await offlineManager.queueAction(type, payload);
    setPendingCount(await offlineManager.getPendingCount());
    return id;
  }, []);

  const syncNow = useCallback(async () => {
    await offlineManager.processQueue();
    setPendingCount(await offlineManager.getPendingCount());
    setLastSync(await offlineManager.getLastSync());
  }, []);

  const cacheData = useCallback((key: string, data: any) => offlineManager.cacheData(key, data), []);
  const getCachedData = useCallback(<T,>(key: string) => offlineManager.getCachedData<T>(key), []);

  return { isOnline, pendingCount, lastSync, queueAction, syncNow, cacheData, getCachedData };
});
