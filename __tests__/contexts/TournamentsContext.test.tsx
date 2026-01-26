import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TournamentsProvider, useTournaments } from '@/contexts/TournamentsContext';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TournamentsProvider>{children}</TournamentsProvider>
    </QueryClientProvider>
  );
};

describe('TournamentsContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('exposes isLoading, tournaments, getOpenTournaments, refetchTournaments', async () => {
    const { result } = renderHook(() => useTournaments(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(Array.isArray(result.current.tournaments)).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.getOpenTournaments).toBe('function');
    expect(typeof result.current.refetchTournaments).toBe('function');
  });
});
