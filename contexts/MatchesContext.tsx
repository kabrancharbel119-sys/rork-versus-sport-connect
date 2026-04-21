import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Match, Sport, SkillLevel, PlayStyle, Venue, UserLocation, MatchPlayerStats } from '@/types';
import { matchesApi } from '@/lib/api/matches';
import { venuesApi } from '@/lib/api/venues';
import { useAuth } from './AuthContext';

const MATCHES_REFETCH_INTERVAL_MS = 60_000;
const VENUES_REFETCH_INTERVAL_MS = 30_000;

const MATCHES_STORAGE_KEY = 'vs_matches';

interface CreateMatchData {
  sport: Sport;
  format: string;
  type: 'friendly' | 'ranked' | 'tournament';
  venue: Venue;
  dateTime: Date;
  duration: number;
  level: SkillLevel;
  ambiance: PlayStyle;
  maxPlayers: number;
  createdBy: string;
  homeTeamId?: string;
  awayTeamId?: string;
  tournamentId?: string;
  roundLabel?: string;
  entryFee?: number;
  prize?: number;
  needsPlayers?: boolean;
  location?: UserLocation;
}

export const [MatchesProvider, useMatches] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isAppActive, setIsAppActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const parseMatchDates = (matches: Match[]): Match[] => {
    return matches.map(m => ({
      ...m,
      dateTime: new Date(m.dateTime),
      createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
      location: m.location ? { ...m.location, lastUpdated: new Date(m.location.lastUpdated) } : undefined,
    }));
  };

  const matchesQuery = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      if (__DEV__) console.log('[Matches] Loading matches...');
      try {
        const serverMatches = await matchesApi.getAll();
        await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(serverMatches));
        return parseMatchDates(serverMatches);
      } catch (e) {
        if (__DEV__) console.log('[Matches] Server fetch failed, using local storage');
        const stored = await AsyncStorage.getItem(MATCHES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Match[];
          return parseMatchDates(parsed);
        }
        throw e;
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: isAppActive ? MATCHES_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      console.log('[Matches] Loading venues...');
      try {
        const serverVenues = await venuesApi.getAll();
        return serverVenues.filter((v) => v.isActive !== false);
      } catch (e) {
        console.log('[Matches] Venues fetch failed');
      }
      return [];
    },
    staleTime: 15 * 1000,
    refetchInterval: isAppActive ? VENUES_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (matchesQuery.data) setMatches(matchesQuery.data);
  }, [matchesQuery.data]);

  useEffect(() => {
    if (venuesQuery.data) setVenues(venuesQuery.data);
  }, [venuesQuery.data]);

  const saveMatches = useCallback(async (updatedMatches: Match[]) => {
    await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(updatedMatches));
    setMatches(updatedMatches);
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  }, [queryClient]);

  const createMatchMutation = useMutation({
    mutationFn: async (data: CreateMatchData) => {
      console.log('[Matches] Creating match...');
      
      // Validate user is authenticated
      const userId = user?.id || data.createdBy;
      if (!userId) {
        throw new Error('Utilisateur non connecté');
      }
      
      const result = await matchesApi.create({
        sport: data.sport,
        format: data.format,
        type: data.type,
        venueId: data.venue.id,
        dateTime: (() => {
          const d = data.dateTime;
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        })(),
        duration: data.duration,
        level: data.level,
        ambiance: data.ambiance,
        maxPlayers: data.maxPlayers,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        tournamentId: data.tournamentId,
        roundLabel: data.roundLabel,
        entryFee: data.entryFee,
        prize: data.prize,
        needsPlayers: data.needsPlayers ?? true,
        lat: data.location?.latitude,
        lng: data.location?.longitude,
      }, userId);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      return result;
    },
  });

  const joinMatchMutation = useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      console.log('[Matches] Joining match:', matchId);
      await matchesApi.join(matchId, userId);
      
      const updatedMatches = matches.map(m =>
        m.id === matchId
          ? { ...m, registeredPlayers: [...m.registeredPlayers, userId] }
          : m
      );
      await saveMatches(updatedMatches);
    },
  });

  const leaveMatchMutation = useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      console.log('[Matches] Leaving match:', matchId);
      await matchesApi.leave(matchId, userId);
      
      const updatedMatches = matches.map(m =>
        m.id === matchId
          ? { ...m, registeredPlayers: m.registeredPlayers.filter(id => id !== userId) }
          : m
      );
      await saveMatches(updatedMatches);
    },
  });

  const updateMatchScoreMutation = useMutation({
    mutationFn: async ({ matchId, homeScore, awayScore, playerStats }: { matchId: string; homeScore: number; awayScore: number; playerStats?: MatchPlayerStats[] }) => {
      console.log('[Matches] Updating match score:', matchId);
      const saved = await matchesApi.updateScore(matchId, homeScore, awayScore, playerStats);

      const updatedMatches = matches.map(m =>
        m.id === matchId
          ? { ...m, score: { home: homeScore, away: awayScore }, status: 'completed' as const, playerStats }
          : m
      );
      await saveMatches(updatedMatches);
      return saved;
    },
  });

  const updateMatchMutation = useMutation({
    mutationFn: async ({ matchId, updates }: { matchId: string; updates: Partial<Pick<Match, 'sport' | 'format' | 'type' | 'dateTime' | 'duration' | 'level' | 'ambiance' | 'maxPlayers' | 'entryFee' | 'prize' | 'venue'>> }) => {
      console.log('[Matches] Updating match:', matchId, updates);
      const matchIndex = matches.findIndex(m => m.id === matchId);
      if (matchIndex === -1) throw new Error('Match non trouvé');
      
      const updatedMatches = [...matches];
      updatedMatches[matchIndex] = {
        ...updatedMatches[matchIndex],
        ...updates,
      };
      await saveMatches(updatedMatches);
      return updatedMatches[matchIndex];
    },
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async ({ matchId, userId, asAdmin }: { matchId: string; userId: string; asAdmin?: boolean }) => {
      if (__DEV__) console.log('[Matches] Deleting match:', matchId, asAdmin ? '(admin)' : '');
      
      // Delete from Supabase database
      await matchesApi.delete(matchId, userId, asAdmin ?? false);
      
      // Update local cache
      const updatedMatches = matches.filter(m => m.id !== matchId);
      await saveMatches(updatedMatches);
    },
  });

  const getMatchById = useCallback((id: string) => matches.find(m => m.id === id), [matches]);
  
  const getUpcomingMatches = useCallback(() => {
    return matches
      .filter(m => m.status === 'open' || m.status === 'confirmed' || m.status === 'venue_pending')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [matches]);
  
  const getUserMatches = useCallback((userId: string) => {
    return matches.filter(m => m.registeredPlayers.includes(userId) || m.createdBy === userId);
  }, [matches]);

  const getCompletedUserMatches = useCallback((userId: string) => {
    return matches
      .filter(m => (m.registeredPlayers.includes(userId) || m.createdBy === userId) && m.status === 'completed')
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [matches]);

  const getMatchesNeedingPlayers = useCallback((userLocation?: UserLocation, radiusKm: number = 50) => {
    return matches.filter(m => {
      if ((m.status !== 'open' && m.status !== 'venue_pending') || !m.needsPlayers || m.registeredPlayers.length >= m.maxPlayers) return false;
      if (!userLocation || !m.location) return true;
      
      const R = 6371;
      const dLat = (m.location.latitude - userLocation.latitude) * Math.PI / 180;
      const dLon = (m.location.longitude - userLocation.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(m.location.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return distance <= radiusKm;
    }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [matches]);

  const getMatchesByCity = useCallback((city: string) => {
    return matches.filter(m => 
      (m.status === 'open' || m.status === 'confirmed') &&
      (m.venue?.city?.toLowerCase() === city.toLowerCase() || m.location?.city?.toLowerCase() === city.toLowerCase())
    );
  }, [matches]);

  const refetchMatches = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  }, [queryClient]);

  return {
    matches,
    venues,
    isLoading: matchesQuery.isLoading,
    isError: matchesQuery.isError,
    refetchMatches,
    createMatch: createMatchMutation.mutateAsync,
    joinMatch: joinMatchMutation.mutateAsync,
    leaveMatch: leaveMatchMutation.mutateAsync,
    updateMatchScore: updateMatchScoreMutation.mutateAsync,
    updateMatch: updateMatchMutation.mutateAsync,
    deleteMatch: deleteMatchMutation.mutateAsync,
    getMatchById,
    getUpcomingMatches,
    getUserMatches,
    getCompletedUserMatches,
    getMatchesNeedingPlayers,
    getMatchesByCity,
    isCreating: createMatchMutation.isPending,
    isUpdating: updateMatchMutation.isPending,
  };
});
