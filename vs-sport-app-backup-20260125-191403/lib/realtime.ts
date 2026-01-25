import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';

type RealtimeEvent = {
  type: 'chat' | 'notification' | 'match' | 'team';
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
};

type RealtimeCallback = (event: RealtimeEvent) => void;

class RealtimeManager {
  private listeners: Map<string, Set<RealtimeCallback>> = new Map();
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isActive: boolean = true;
  private lastEventTime: number = Date.now();

  subscribe(channel: string, callback: RealtimeCallback): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);
    console.log(`[Realtime] Subscribed to ${channel}`);
    return () => {
      this.listeners.get(channel)?.delete(callback);
      console.log(`[Realtime] Unsubscribed from ${channel}`);
    };
  }

  emit(channel: string, event: RealtimeEvent): void {
    console.log(`[Realtime] Emitting to ${channel}:`, event.type, event.action);
    this.listeners.get(channel)?.forEach(callback => {
      try { callback(event); } catch (e) { console.error('[Realtime] Callback error:', e); }
    });
    this.listeners.get('*')?.forEach(callback => {
      try { callback(event); } catch (e) { console.error('[Realtime] Global callback error:', e); }
    });
  }

  startPolling(channel: string, fetchFn: () => Promise<void>, intervalMs: number = 3000): void {
    if (this.pollingIntervals.has(channel)) return;
    console.log(`[Realtime] Starting polling for ${channel} every ${intervalMs}ms`);
    const interval = setInterval(async () => {
      if (!this.isActive) return;
      try { await fetchFn(); } catch (e) { console.error(`[Realtime] Polling error for ${channel}:`, e); }
    }, intervalMs);
    this.pollingIntervals.set(channel, interval);
  }

  stopPolling(channel: string): void {
    const interval = this.pollingIntervals.get(channel);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(channel);
      console.log(`[Realtime] Stopped polling for ${channel}`);
    }
  }

  setActive(active: boolean): void {
    this.isActive = active;
    console.log(`[Realtime] Active state: ${active}`);
  }

  destroy(): void {
    this.pollingIntervals.forEach((interval) => clearInterval(interval));
    this.pollingIntervals.clear();
    this.listeners.clear();
  }
}

export const realtimeManager = new RealtimeManager();

export const useRealtime = (channel: string, callback: RealtimeCallback) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(channel, (event) => callbackRef.current(event));
    return unsubscribe;
  }, [channel]);
};

export const useRealtimeQuery = (queryKey: string[], intervalMs: number = 3000) => {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(true);
  const queryKeyStr = queryKey.join('-');

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      const active = state === 'active';
      setIsPolling(active);
      realtimeManager.setActive(active);
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isPolling) return;
    realtimeManager.startPolling(
      queryKeyStr,
      async () => { await queryClient.invalidateQueries({ queryKey }); },
      intervalMs
    );
    return () => realtimeManager.stopPolling(queryKeyStr);
  }, [queryKeyStr, queryKey, intervalMs, isPolling, queryClient]);
};

export const emitRealtimeEvent = (type: RealtimeEvent['type'], action: RealtimeEvent['action'], data: Record<string, unknown>) => {
  const event: RealtimeEvent = { type, action, data, timestamp: Date.now() };
  realtimeManager.emit(type, event);
  realtimeManager.emit('*', event);
};

export const useChatRealtime = (roomId: string, onNewMessage: (message: unknown) => void) => {
  const queryClient = useQueryClient();

  useRealtime('chat', (event) => {
    if (event.action === 'create' && event.data.roomId === roomId) {
      onNewMessage(event.data);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  });

  useRealtimeQuery(['chats', roomId], 2000);
};

export const useNotificationsRealtime = (userId: string, onNewNotification: (notification: unknown) => void) => {
  const queryClient = useQueryClient();

  useRealtime('notification', (event) => {
    if (event.data.userId === userId || event.data.userId === 'all') {
      onNewNotification(event.data);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  useRealtimeQuery(['notifications'], 5000);
};
