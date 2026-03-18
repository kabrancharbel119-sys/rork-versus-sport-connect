import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Tournament, Sport, SkillLevel, Venue, TournamentPrize } from '@/types';
import { tournamentsApi } from '@/lib/api/tournaments';

const TOURNAMENTS_REFETCH_INTERVAL_MS = 60_000;

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
  const [isAppActive, setIsAppActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

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
      if (__DEV__) console.log('[Tournaments] Loading tournaments...');
      try {
        const serverTournaments = await tournamentsApi.getAll();
        const parsed = parseTournamentDates(serverTournaments);
        await AsyncStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      } catch (e) {
        if (__DEV__) console.log('[Tournaments] Server fetch failed, using local storage');
      }
      const stored = await AsyncStorage.getItem(TOURNAMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Tournament[];
        return parseTournamentDates(parsed);
      }
      return [];
    },
    staleTime: 30 * 1000,
    refetchInterval: isAppActive ? TOURNAMENTS_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
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
      try {
        const result = await tournamentsApi.create(data.createdBy, {
          name: data.name,
          description: data.description,
          sport: data.sport,
          format: data.format,
          type: data.type,
          level: data.level,
          maxTeams: data.maxTeams,
          entryFee: data.entryFee,
          prizePool: data.prizePool,
          prizes: data.prizes,
          venue: data.venue,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          sponsorName: data.sponsorName,
          sponsorLogo: data.sponsorLogo,
        });
        await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
        return result;
      } catch (err: unknown) {
        console.log('[Tournaments] API error, creating locally:', (err as Error)?.message);
        const current = (queryClient.getQueryData(['tournaments']) as Tournament[] | undefined) ?? [];
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
        await saveTournaments([...current, newTournament]);
        return newTournament;
      }
    },
  });

  const registerTeamMutation = useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      console.log('[Tournaments] Registering team:', teamId, 'to tournament:', tournamentId);
      const current = (queryClient.getQueryData(['tournaments']) as Tournament[] | undefined) ?? [];
      let tournament = current.find(t => t.id === tournamentId);
      
      // Si le tournoi n'est pas dans le cache, le récupérer depuis l'API
      if (!tournament) {
        console.log('[Tournaments] Tournament not in cache, fetching from API...');
        try {
          tournament = await tournamentsApi.getById(tournamentId);
        } catch (err) {
          throw new Error('Tournoi non trouvé');
        }
      }
      
      if (tournament.registeredTeams.includes(teamId)) throw new Error('Équipe déjà inscrite');
      if (tournament.registeredTeams.length >= tournament.maxTeams) throw new Error('Tournoi complet');
      if (tournament.status !== 'registration') throw new Error('Inscriptions fermées');
      
      try {
        await tournamentsApi.registerTeam(tournamentId, teamId);
        await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
        await queryClient.invalidateQueries({ queryKey: ['myTournaments'] });
      } catch (err) {
        // Fallback optimiste si l'API échoue
        const tournamentIndex = current.findIndex(t => t.id === tournamentId);
        if (tournamentIndex !== -1) {
          const updated = [...current];
          updated[tournamentIndex] = { ...current[tournamentIndex], registeredTeams: [...current[tournamentIndex].registeredTeams, teamId] };
          await saveTournaments(updated);
        }
      }
    },
  });

  const unregisterTeamMutation = useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
      console.log('[Tournaments] Unregistering team:', teamId, 'from tournament:', tournamentId);
      const current = (queryClient.getQueryData(['tournaments']) as Tournament[] | undefined) ?? [];
      let tournament = current.find(t => t.id === tournamentId);
      
      // Si le tournoi n'est pas dans le cache, le récupérer depuis l'API
      if (!tournament) {
        console.log('[Tournaments] Tournament not in cache, fetching from API...');
        try {
          tournament = await tournamentsApi.getById(tournamentId);
        } catch (err) {
          throw new Error('Tournoi non trouvé');
        }
      }
      
      if (tournament.status !== 'registration') throw new Error('Impossible de se désinscrire');
      
      try {
        await tournamentsApi.unregisterTeam(tournamentId, teamId);
        await queryClient.refetchQueries({ queryKey: ['tournaments'] });
        await queryClient.invalidateQueries({ queryKey: ['myTournaments'] });
      } catch (err) {
        if (isBusinessError(err)) throw err;
        // Fallback optimiste si l'API échoue
        const tournamentIndex = current.findIndex(t => t.id === tournamentId);
        if (tournamentIndex !== -1) {
          const updated = [...current];
          updated[tournamentIndex] = { ...current[tournamentIndex], registeredTeams: current[tournamentIndex].registeredTeams.filter(id => id !== teamId) };
          await saveTournaments(updated);
        }
      }
    },
  });

  const updateTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, updates }: { tournamentId: string; updates: Partial<Pick<Tournament, 'name' | 'description' | 'startDate' | 'endDate' | 'entryFee' | 'prizePool' | 'prizes' | 'status' | 'winnerId' | 'managers'>> }) => {
      console.log('[Tournaments] Updating tournament:', tournamentId);
      const current = (queryClient.getQueryData(['tournaments']) as Tournament[] | undefined) ?? [];
      const tournamentIndex = current.findIndex(t => t.id === tournamentId);
      if (tournamentIndex === -1) throw new Error('Tournoi non trouvé');
      const next = { ...current[tournamentIndex], ...updates };
      try {
        await tournamentsApi.update(tournamentId, {
          name: updates.name,
          description: updates.description,
          startDate: updates.startDate?.toISOString?.() ?? (next.startDate instanceof Date ? next.startDate.toISOString() : undefined),
          endDate: updates.endDate?.toISOString?.() ?? (next.endDate instanceof Date ? next.endDate.toISOString() : undefined),
          entryFee: updates.entryFee,
          prizePool: updates.prizePool,
          prizes: updates.prizes,
          status: updates.status,
          winnerId: updates.winnerId,
          managers: updates.managers,
        });
        await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
        return next;
      } catch (err) {
        const updated = [...current];
        updated[tournamentIndex] = next;
        await saveTournaments(updated);
        return next;
      }
    },
  });

  const addMatchToTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
      await tournamentsApi.addMatchToTournament(tournamentId, matchId);
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      await queryClient.invalidateQueries({ queryKey: ['tournament-matches', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const setTournamentWinnerMutation = useMutation({
    mutationFn: async ({ tournamentId, winnerTeamId }: { tournamentId: string; winnerTeamId: string }) => {
      await tournamentsApi.setWinner(tournamentId, winnerTeamId);
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  const removeMatchFromTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
      await tournamentsApi.removeMatchFromTournament(tournamentId, matchId);
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      await queryClient.invalidateQueries({ queryKey: ['tournament-matches', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, userId, isAdmin }: { tournamentId: string; userId: string; isAdmin?: boolean }) => {
      console.log('[Tournaments] Deleting tournament:', tournamentId);
      const current = (queryClient.getQueryData(['tournaments']) as Tournament[] | undefined) ?? [];
      const tournament = current.find(t => t.id === tournamentId);
      if (!tournament) throw new Error('Tournoi non trouvé');
      if (!isAdmin && tournament.createdBy !== userId) throw new Error('Seul le créateur peut supprimer ce tournoi');
      if (!isAdmin && tournament.status !== 'registration') throw new Error('Impossible de supprimer un tournoi en cours');
      try {
        await tournamentsApi.delete(tournamentId);
        await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      } catch (err) {
        await saveTournaments(current.filter(t => t.id !== tournamentId));
      }
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

  const refetchTournaments = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ['tournaments'] });
  }, [queryClient]);

  const isBusinessError = useCallback((err: unknown) => {
    const msg = (err as Error)?.message ?? '';
    return [
      'Tournoi non trouvé',
      'Équipe déjà inscrite',
      'Tournoi complet',
      'Inscriptions fermées',
      'Équipe non inscrite',
      'Impossible de se désinscrire',
      'Données invalides',
    ].some((s) => msg.includes(s));
  }, []);

  return {
    tournaments,
    isLoading: tournamentsQuery.isLoading,
    isError: tournamentsQuery.isError,
    refetchTournaments,
    isRegistering: registerTeamMutation.isPending,
    createTournament: createTournamentMutation.mutateAsync,
    registerTeam: registerTeamMutation.mutateAsync,
    unregisterTeam: unregisterTeamMutation.mutateAsync,
    updateTournament: updateTournamentMutation.mutateAsync,
    deleteTournament: deleteTournamentMutation.mutateAsync,
    addMatchToTournament: addMatchToTournamentMutation.mutateAsync,
    setTournamentWinner: setTournamentWinnerMutation.mutateAsync,
    removeMatchFromTournament: removeMatchFromTournamentMutation.mutateAsync,
    getTournamentById,
    getOpenTournaments,
    getUserTournaments,
    getTeamTournaments,
    getActiveTournaments,
    isCreating: createTournamentMutation.isPending,
    isUpdating: updateTournamentMutation.isPending,
  };
});
