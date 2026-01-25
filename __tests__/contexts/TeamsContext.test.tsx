import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamsProvider, useTeams } from '@/contexts/TeamsContext';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TeamsProvider>{children}</TeamsProvider>
    </QueryClientProvider>
  );
};

describe('TeamsContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('initializes with loading state', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('loads teams from storage', async () => {
    const mockTeams = [
      {
        id: 'team-1',
        name: 'Les Champions',
        sport: 'football',
        format: '5v5',
        level: 'intermediate',
        ambiance: 'competitive',
        city: 'Abidjan',
        country: 'Côte d\'Ivoire',
        captainId: 'user-1',
        coCaptainIds: [],
        members: [{ userId: 'user-1', role: 'captain', joinedAt: new Date().toISOString() }],
        maxMembers: 15,
        stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 },
        reputation: 5.0,
        isRecruiting: true,
        joinRequests: [],
        customRoles: [],
        createdAt: new Date().toISOString(),
      },
    ];

    await AsyncStorage.setItem('vs_teams', JSON.stringify(mockTeams));

    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teams.length).toBeGreaterThanOrEqual(1);
  });

  it('provides createTeam function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.createTeam).toBe('function');
  });

  it('provides sendJoinRequest function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.sendJoinRequest).toBe('function');
  });

  it('provides handleRequest function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.handleRequest).toBe('function');
  });

  it('provides getTeamById function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getTeamById).toBe('function');
  });

  it('provides getUserTeams function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getUserTeams).toBe('function');
    const userTeams = result.current.getUserTeams('user-1');
    expect(Array.isArray(userTeams)).toBe(true);
  });

  it('provides getRecruitingTeams function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getRecruitingTeams).toBe('function');
    const recruitingTeams = result.current.getRecruitingTeams();
    expect(Array.isArray(recruitingTeams)).toBe(true);
  });

  it('provides getPendingRequests function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.getPendingRequests).toBe('function');
    const pendingRequests = result.current.getPendingRequests('team-1');
    expect(Array.isArray(pendingRequests)).toBe(true);
  });

  it('provides updateMemberRole function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.updateMemberRole).toBe('function');
  });

  it('provides promoteMember function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.promoteMember).toBe('function');
  });

  it('provides leaveTeam function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.leaveTeam).toBe('function');
  });

  it('provides removeMember function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.removeMember).toBe('function');
  });

  it('provides addCustomRole function', async () => {
    const { result } = renderHook(() => useTeams(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.addCustomRole).toBe('function');
  });
});
