import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

const OFFLINE_QUEUE_KEY = 'vs_offline_queue';
const LAST_SYNC_KEY = 'vs_last_sync';
const CACHE_PREFIX = 'vs_cache_';

interface OfflineAction { id: string; type: string; payload: any; timestamp: number; retries: number; }

class OfflineManager {
  private isOnline = true;
  private listeners: ((online: boolean) => void)[] = [];
  private syncInProgress = false;

  constructor() { this.init(); }

  private async init() {
    if (Platform.OS === 'web') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));
    } else {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? true;
      NetInfo.addEventListener(state => this.setOnline(state.isConnected ?? true));
    }
  }

  private setOnline(online: boolean) {
    if (this.isOnline !== online) {
      this.isOnline = online;
      this.listeners.forEach(l => l(online));
      if (online) this.processQueue();
    }
  }

  getIsOnline = () => this.isOnline;
  subscribe = (listener: (online: boolean) => void) => { this.listeners.push(listener); return () => { this.listeners = this.listeners.filter(l => l !== listener); }; };

  async queueAction(type: string, payload: any) {
    const action: OfflineAction = { id: `action-${Date.now()}`, type, payload, timestamp: Date.now(), retries: 0 };
    const queue = await this.getQueue();
    queue.push(action);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[Offline] Queued action:', type);
    if (this.isOnline) this.processQueue();
    return action.id;
  }

  async getQueue(): Promise<OfflineAction[]> {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async processQueue() {
    if (this.syncInProgress || !this.isOnline) return;
    this.syncInProgress = true;
    console.log('[Offline] Processing queue...');
    try {
      const queue = await this.getQueue();
      const processed: string[] = [];
      for (const action of queue) {
        try {
          await this.executeAction(action);
          processed.push(action.id);
        } catch (e) {
          console.log('[Offline] Failed to process action:', action.type, e);
          if (action.retries >= 3) processed.push(action.id);
          else action.retries++;
        }
      }
      const remaining = queue.filter(a => !processed.includes(a.id));
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      console.log('[Offline] Queue processed, remaining:', remaining.length);
    } finally { this.syncInProgress = false; }
  }

  private async executeAction(action: OfflineAction) {
    console.log('[Offline] Executing action:', action.type);
  }

  async cacheData(key: string, data: any, ttl = 3600000) {
    const cacheEntry = { data, timestamp: Date.now(), ttl };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheEntry));
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;
    const entry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > entry.ttl) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.data as T;
  }

  async getLastSync(): Promise<Date | null> {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return lastSync ? new Date(lastSync) : null;
  }

  async clearCache() {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  }

  async getPendingCount(): Promise<number> { return (await this.getQueue()).length; }
}

export const offlineManager = new OfflineManager();
