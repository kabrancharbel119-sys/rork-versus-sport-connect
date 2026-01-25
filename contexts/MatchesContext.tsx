import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Match, Sport, SkillLevel, PlayStyle, Venue, UserLocation, MatchPlayerStats } from '@/types';
import { mockMatches, mockVenues } from '@/mocks/data';
import { matchesApi } from '@/lib/api/matches';
import { venuesApi } from '@/lib/api/venues';

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
  entryFee?: number;
  prize?: number;
  needsPlayers?: boolean;
  location?: UserLocation;
}

export const [MatchesProvider, useMatches] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>(mockVenues);

  const matchesQuery = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      console.log('[Matches] Loading matches...');
      try {
        const serverMatches = await matchesApi.getAll();
        if (serverMatches.length > 0) {
          await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(serverMatches));
          return serverMatches;
        }
      } catch (e) {
        console.log('[Matches] Server fetch failed, using local storage');
      }
      
      const stored = await AsyncStorage.getItem(MATCHES_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Match[];
      await AsyncStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(mockMatches));
      return mockMatches;
    },
  });

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      console.log('[Matches] Loading venues...');
      try {
        const serverVenues = await venuesApi.getAll();
        if (serverVenues.length > 0) return serverVenues;
      } catch (e) {
        console.log('[Matches] Venues fetch failed, using mock data');
      }
      return mockVenues;
    },
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
      try {
        const result = await matchesApi.create(data.createdBy, {
          sport: data.sport,
          format: data.format,
          type: data.type,
          venueId: data.venue.id,
          dateTime: data.dateTime.toISOString(),
          duration: data.duration,
          level: data.level,
          ambiance: data.ambiance,
          maxPlayers: data.maxPlayers,
          homeTeamId: data.homeTeamId,
          entryFee: data.entryFee,
          prize: data.prize,
          needsPlayers: data.needsPlayers ?? true,
          lat: data.location?.latitude,
          lng: data.location?.longitude,
        });
        await saveMatches([...matches, result]);
        return result;
      } catch (err: any) {
        console.log('[Matches] Supabase error, using local:', err.message);
        const newMatch: Match = {
          id: `match-${Date.now()}`,
          sport: data.sport,
          format: data.format,
          type: data.type,
          status: 'open',
          venue: data.venue,
          dateTime: data.dateTime,
          duration: data.duration,
          level: data.level,
          ambiance: data.ambiance,
          maxPlayers: data.maxPlayers,
          registeredPlayers: [data.createdBy],
          createdBy: data.createdBy,
          homeTeamId: data.homeTeamId,
          entryFee: data.entryFee,
          prize: data.prize,
          needsPlayers: data.needsPlayers ?? true,
          location: data.location,
          createdAt: new Date(),
        };
        await saveMatches([...matches, newMatch]);
        return newMatch;
      }
    },
  });

  const joinMatchMutation = useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      console.log('[Matches] Joining match:', matchId);
      try {
        await matchesApi.join(matchId, userId);
      } catch (err: any) {
        console.log('[Matches] Supabase error:', err.message);
      }
      
      const matchIndex = matches.findIndex(m => m.id === matchId);
      if (matchIndex === -1) throw new Error('Match non trouvé');
      
      const match = matches[matchIndex];
      if (match.registeredPlayers.includes(userId)) throw new Error('Déjà inscrit');
      if (match.registeredPlayers.length >= match.maxPlayers) throw new Error('Match complet');
      
      const updatedMatches = [...matches];
      updatedMatches[matchIndex] = {
        ...match,
        registeredPlayers: [...match.registeredPlayers, userId],
      };
      await saveMatches(updatedMatches);
    },
  });

  const leaveMatchMutation = useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      console.log('[Matches] Leaving match:', matchId);
      try {
        await matchesApi.leave(matchId, userId);
      } catch (err: any) {
        console.log('[Matches] Supabase error:', err.message);
      }
      
      const matchIndex = matches.findIndex(m => m.id === matchId);
      if (matchIndex === -1) throw new Error('Match non trouvé');
      
      const updatedMatches = [...matches];
      updatedMatches[matchIndex] = {
        ...updatedMatches[matchIndex],
        registeredPlayers: updatedMatches[matchIndex].registeredPlayers.filter(id => id !== userId),
      };
      await saveMatches(updatedMatches);
    },
  });

  const updateMatchScoreMutation = useMutation({
    mutationFn: async ({ matchId, homeScore, awayScore, playerStats }: { matchId: string; homeScore: number; awayScore: number; playerStats?: MatchPlayerStats[] }) => {
      console.log('[Matches] Updating match score:', matchId);
      try {
        await matchesApi.updateScore(matchId, homeScore, awayScore, playerStats);
      } catch (err: any) {
        console.log('[Matches] Supabase error:', err.message);
      }
      
      const matchIndex = matches.findIndex(m => m.id === matchId);
      if (matchIndex === -1) throw new Error('Match non trouvé');
      
      const updatedMatches = [...matches];
      updatedMatches[matchIndex] = {
        ...updatedMatches[matchIndex],
        score: { home: homeScore, away: awayScore },
        status: 'completed',
        playerStats,
      };
      await saveMatches(updatedMatches);
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
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      console.log('[Matches] Deleting match:', matchId);
      const match = matches.find(m => m.id === matchId);
      if (!match) throw new Error('Match non trouvé');
      if (match.createdBy !== userId) throw new Error('Seul le créateur peut supprimer ce match');
      
      const updatedMatches = matches.filter(m => m.id !== matchId);
      await saveMatches(updatedMatches);
    },
  });

  const getMatchById = useCallback((id: string) => matches.find(m => m.id === id), [matches]);
  
  const getUpcomingMatches = useCallback(() => {
    return matches
      .filter(m => m.status === 'open' || m.status === 'confirmed')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [matches]);
  
  const getUserMatches = useCallback((userId: string) => {
    return matches.filter(m => m.registeredPlayers.includes(userId) || m.createdBy === userId);
  }, [matches]);

  const getMatchesNeedingPlayers = useCallback((userLocation?: UserLocation, radiusKm: number = 50) => {
    return matches.filter(m => {
      if (m.status !== 'open' || !m.needsPlayers || m.registeredPlayers.length >= m.maxPlayers) return false;
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
      (m.venue.city.toLowerCase() === city.toLowerCase() || m.location?.city.toLowerCase() === city.toLowerCase())
    );
  }, [matches]);

  return {
    matches,
    venues,
    isLoading: matchesQuery.isLoading,
    createMatch: createMatchMutation.mutateAsync,
    joinMatch: joinMatchMutation.mutateAsync,
    leaveMatch: leaveMatchMutation.mutateAsync,
    updateMatchScore: updateMatchScoreMutation.mutateAsync,
    updateMatch: updateMatchMutation.mutateAsync,
    deleteMatch: deleteMatchMutation.mutateAsync,
    getMatchById,
    getUpcomingMatches,
    getUserMatches,
    getMatchesNeedingPlayers,
    getMatchesByCity,
    isCreating: createMatchMutation.isPending,
    isUpdating: updateMatchMutation.isPending,
  };
});
