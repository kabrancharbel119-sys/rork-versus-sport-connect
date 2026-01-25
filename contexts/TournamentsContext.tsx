import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Tournament, Sport, SkillLevel, Venue, TournamentPrize } from '@/types';
import { mockTournaments, mockVenues } from '@/mocks/data';

const TOURNAMENTS_STORAGE_KEY = 'vs_tournaments';

interface CreateTournamentData {
  name: string;
  description: string;
  sport: Sport;
  format: string;
  type: 'knockout' | 'league' | 'group_knockout';
  level: SkillLevel;
  maxTeams: number;
  entryFee: number;
  prizePool: number;
  prizes: TournamentPrize[];
  venue: Venue;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  sponsorName?: string;
  sponsorLogo?: string;
}

export const [TournamentsProvider, useTournaments] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const parseTournamentDates = (tournaments: Tournament[]): Tournament[] => {
    return tournaments.map(t => ({
      ...t,
      startDate: new Date(t.startDate),
      endDate: new Date(t.endDate),
      createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      matches: t.matches.map(m => ({
        ...m,
        dateTime: new Date(m.dateTime),
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
      })),
    }));
  };

  const tournamentsQuery = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      console.log('[Tournaments] Loading tournaments...');
      const stored = await AsyncStorage.getItem(TOURNAMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Tournament[];
        return parseTournamentDates(parsed);
      }
      await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(mockTournaments));
      return parseTournamentDates(mockTournaments);
    },
  });

  useEffect(() => {
    if (tournamentsQuery.data) setTournaments(tournamentsQuery.data);
  }, [tournamentsQuery.data]);

  const saveTournaments = useCallback(async (updatedTournaments: Tournament[]) => {
    await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(updatedTournaments));
    setTournaments(updatedTournaments);
    queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  }, [queryClient]);

  const createTournamentMutation = useMutation({
    mutationFn: async (data: CreateTournamentData) => {
      console.log('[Tournaments] Creating tournament:', data.name);
      const newTournament: Tournament = {
        id: `tournament-${Date.now()}`,
        name: data.name,
        description: data.description,
        sport: data.sport,
        format: data.format,
        type: data.type,
        status: 'registration',
        level: data.level,
        maxTeams: data.maxTeams,
        registeredTeams: [],
        entryFee: data.entryFee,
        prizePool: data.prizePool,
        prizes: data.prizes,
        venue: data.venue,
        startDate: data.startDate,
        endDate: data.endDate,
        matches: [],
        createdBy: data.createdBy,
        sponsorName: data.sponsorName,
        sponsorLogo: data.sponsorLogo,
        createdAt: new Date(),
      };
      await saveTournaments([...tournaments, newTournament]);
      return newTournament;
    },
  });

  const registerTeamMutation = useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      console.log('[Tournaments] Registering team:', teamId, 'to tournament:', tournamentId);
      const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
      if (tournamentIndex === -1) throw new Error('Tournoi non trouvé');
      
      const tournament = tournaments[tournamentIndex];
      if (tournament.registeredTeams.includes(teamId)) throw new Error('Équipe déjà inscrite');
      if (tournament.registeredTeams.length >= tournament.maxTeams) throw new Error('Tournoi complet');
      if (tournament.status !== 'registration') throw new Error('Inscriptions fermées');
      
      const updatedTournaments = [...tournaments];
      updatedTournaments[tournamentIndex] = {
        ...tournament,
        registeredTeams: [...tournament.registeredTeams, teamId],
      };
      await saveTournaments(updatedTournaments);
    },
  });

  const unregisterTeamMutation = useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      console.log('[Tournaments] Unregistering team:', teamId, 'from tournament:', tournamentId);
      const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
      if (tournamentIndex === -1) throw new Error('Tournoi non trouvé');
      
      const tournament = tournaments[tournamentIndex];
      if (tournament.status !== 'registration') throw new Error('Impossible de se désinscrire');
      
      const updatedTournaments = [...tournaments];
      updatedTournaments[tournamentIndex] = {
        ...tournament,
        registeredTeams: tournament.registeredTeams.filter(id => id !== teamId),
      };
      await saveTournaments(updatedTournaments);
    },
  });

  const updateTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, updates }: { tournamentId: string; updates: Partial<Pick<Tournament, 'name' | 'description' | 'startDate' | 'endDate' | 'entryFee' | 'prizePool' | 'prizes' | 'status'>> }) => {
      console.log('[Tournaments] Updating tournament:', tournamentId);
      const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
      if (tournamentIndex === -1) throw new Error('Tournoi non trouvé');
      
      const updatedTournaments = [...tournaments];
      updatedTournaments[tournamentIndex] = {
        ...updatedTournaments[tournamentIndex],
        ...updates,
      };
      await saveTournaments(updatedTournaments);
      return updatedTournaments[tournamentIndex];
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, userId }: { tournamentId: string; userId: string }) => {
      console.log('[Tournaments] Deleting tournament:', tournamentId);
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (!tournament) throw new Error('Tournoi non trouvé');
      if (tournament.createdBy !== userId) throw new Error('Seul le créateur peut supprimer ce tournoi');
      if (tournament.status !== 'registration') throw new Error('Impossible de supprimer un tournoi en cours');
      
      const updatedTournaments = tournaments.filter(t => t.id !== tournamentId);
      await saveTournaments(updatedTournaments);
    },
  });

  const getTournamentById = useCallback((id: string) => tournaments.find(t => t.id === id), [tournaments]);
  
  const getOpenTournaments = useCallback(() => {
    return tournaments
      .filter(t => t.status === 'registration')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [tournaments]);

  const getUserTournaments = useCallback((userId: string) => {
    return tournaments.filter(t => t.createdBy === userId);
  }, [tournaments]);

  const getTeamTournaments = useCallback((teamId: string) => {
    return tournaments.filter(t => t.registeredTeams.includes(teamId));
  }, [tournaments]);

  const getActiveTournaments = useCallback(() => {
    return tournaments.filter(t => t.status === 'registration' || t.status === 'in_progress');
  }, [tournaments]);

  return {
    tournaments,
    isLoading: tournamentsQuery.isLoading,
    createTournament: createTournamentMutation.mutateAsync,
    registerTeam: registerTeamMutation.mutateAsync,
    unregisterTeam: unregisterTeamMutation.mutateAsync,
    updateTournament: updateTournamentMutation.mutateAsync,
    deleteTournament: deleteTournamentMutation.mutateAsync,
    getTournamentById,
    getOpenTournaments,
    getUserTournaments,
    getTeamTournaments,
    getActiveTournaments,
    isCreating: createTournamentMutation.isPending,
    isUpdating: updateTournamentMutation.isPending,
  };
});
