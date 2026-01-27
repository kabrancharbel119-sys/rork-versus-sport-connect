// Env pour Supabase : évite "supabaseUrl is required" au chargement de lib/supabase
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234-5678' }));

import '@testing-library/jest-native/extend-expect';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  launchImageLibraryAsync: jest.fn(() => 
    Promise.resolve({ canceled: false, assets: [{ uri: 'mock-uri' }] })
  ),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
}));

jest.mock('@/lib/push-notifications', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve('mock-token')),
}));

jest.mock('@/lib/trpc', () => ({
  trpc: {
    auth: {
      login: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      register: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      updateProfile: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    notifications: {
      registerPushToken: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    matches: {
      create: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      join: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      leave: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      updateScore: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    teams: {
      create: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      sendJoinRequest: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      handleRequest: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      updateMemberRole: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      promoteMember: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      leave: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}));

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Aide Jest à sortir proprement : timers / abonnements (React Query, Supabase, etc.)
afterAll(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
});
