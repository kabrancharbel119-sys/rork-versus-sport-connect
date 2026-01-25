import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchesProvider, useMatches } from '@/contexts/MatchesContext';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MatchesProvider>{children}</MatchesProvider>
    </QueryClientProvider>
  );
};

describe('MatchesContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('initializes with loading state', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('loads matches from storage', async () => {
    const mockMatches = [
      {
        id: 'match-1',
        sport: 'football',
        format: '5v5',
        type: 'friendly',
        status: 'open',
        venue: { id: 'v1', name: 'Stade Test', address: '123 Rue', city: 'Abidjan', country: 'CI' },
        dateTime: new Date().toISOString(),
        duration: 90,
        level: 'intermediate',
        ambiance: 'competitive',
        maxPlayers: 10,
        registeredPlayers: ['user-1'],
        createdBy: 'user-1',
        needsPlayers: true,
        createdAt: new Date().toISOString(),
      },
    ];

    await AsyncStorage.setItem('vs_matches', JSON.stringify(mockMatches));

    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('provides createMatch function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.createMatch).toBe('function');
  });

  it('provides joinMatch function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.joinMatch).toBe('function');
  });

  it('provides leaveMatch function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.leaveMatch).toBe('function');
  });

  it('provides getMatchById function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getMatchById).toBe('function');
  });

  it('provides getUpcomingMatches function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getUpcomingMatches).toBe('function');
    const upcoming = result.current.getUpcomingMatches();
    expect(Array.isArray(upcoming)).toBe(true);
  });

  it('provides getUserMatches function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getUserMatches).toBe('function');
    const userMatches = result.current.getUserMatches('user-1');
    expect(Array.isArray(userMatches)).toBe(true);
  });

  it('provides getMatchesNeedingPlayers function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getMatchesNeedingPlayers).toBe('function');
    const needingPlayers = result.current.getMatchesNeedingPlayers();
    expect(Array.isArray(needingPlayers)).toBe(true);
  });

  it('provides getMatchesByCity function', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getMatchesByCity).toBe('function');
    const cityMatches = result.current.getMatchesByCity('Abidjan');
    expect(Array.isArray(cityMatches)).toBe(true);
  });

  it('provides venues array', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(Array.isArray(result.current.venues)).toBe(true);
  });

  it('filters matches needing players by location', async () => {
    const { result } = renderHook(() => useMatches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const userLocation = { latitude: 5.3600, longitude: -4.0083, city: 'Abidjan', country: 'CI', lastUpdated: new Date() };
    const nearbyMatches = result.current.getMatchesNeedingPlayers(userLocation, 100);
    expect(Array.isArray(nearbyMatches)).toBe(true);
  });
});
