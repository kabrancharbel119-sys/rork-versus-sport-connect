import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

jest.mock('@/lib/realtime', () => ({
  useRealtime: jest.fn(),
  emitRealtimeEvent: jest.fn(),
}));

jest.mock('@/lib/push-notifications', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve('mock-token')),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setBadgeCount: jest.fn(() => Promise.resolve()),
  sendLocalNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/api/notifications', () => ({
  notificationsApi: {
    getAll: jest.fn(() => Promise.resolve([])),
    send: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
    subscribeToNotifications: jest.fn(() => ({ unsubscribe: jest.fn() })),
  },
}));

const { AuthProvider } = require('@/contexts/AuthContext');
const { NotificationsProvider, useNotifications } = require('@/contexts/NotificationsContext');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('NotificationsContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('exposes notifications, getUnreadCount and refetchNotifications', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(Array.isArray(result.current.notifications)).toBe(true);
    });

    expect(typeof result.current.getUnreadCount).toBe('function');
    expect(result.current.getUnreadCount()).toBeGreaterThanOrEqual(0);
    expect(typeof result.current.refetchNotifications).toBe('function');
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.markAllAsRead).toBe('function');
  });
});
