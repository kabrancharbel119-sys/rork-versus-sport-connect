import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Team, JoinRequest, TeamRole, Sport, SkillLevel, PlayStyle, UserLocation } from '@/types';
import { mockTeams } from '@/mocks/data';
import { teamsApi } from '@/lib/api/teams';

const TEAMS_STORAGE_KEY = 'vs_teams';

interface CreateTeamData {
  name: string;
  logo?: string;
  sport: Sport;
  format: string;
  level: SkillLevel;
  ambiance: PlayStyle;
  city: string;
  country: string;
  description?: string;
  maxMembers: number;
  captainId: string;
  isRecruiting?: boolean;
  customRoles?: TeamRole[];
  location?: UserLocation;
}

export const [TeamsProvider, useTeams] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [teams, setTeams] = useState<Team[]>([]);

  const parseTeamDates = (teams: Team[]): Team[] => {
    return teams.map(t => ({
      ...t,
      createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      members: t.members.map(m => ({ ...m, joinedAt: new Date(m.joinedAt) })),
      joinRequests: t.joinRequests.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt),
        respondedAt: r.respondedAt ? new Date(r.respondedAt) : undefined,
      })),
      location: t.location ? { ...t.location, lastUpdated: new Date(t.location.lastUpdated) } : undefined,
    }));
  };

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      console.log('[Teams] Loading teams...');
      const stored = await AsyncStorage.getItem(TEAMS_STORAGE_KEY);
      const localTeams = stored ? parseTeamDates(JSON.parse(stored)) : [];
      
      try {
        const serverTeams = await teamsApi.getAll();
        if (serverTeams.length > 0) {
          const serverParsed = parseTeamDates(serverTeams);
          const localOnly = localTeams.filter(lt => !serverParsed.some(st => st.id === lt.id));
          const merged = [...serverParsed, ...localOnly];
          await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(merged));
          console.log('[Teams] Merged teams - server:', serverParsed.length, 'local only:', localOnly.length);
          return merged;
        }
      } catch {
        console.log('[Teams] Server fetch failed, using local storage');
      }
      
      if (localTeams.length > 0) {
        console.log('[Teams] Using local teams:', localTeams.length);
        return localTeams;
      }
      
      await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(mockTeams));
      return parseTeamDates(mockTeams);
    },
  });

  useEffect(() => {
    if (teamsQuery.data) setTeams(teamsQuery.data);
  }, [teamsQuery.data]);

  const saveTeams = useCallback(async (updatedTeams: Team[]) => {
    await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams));
    setTeams(updatedTeams);
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  }, [queryClient]);

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamData) => {
      console.log('[Teams] Creating team:', data.name, 'for captain:', data.captainId);
      
      const currentTeams = await AsyncStorage.getItem(TEAMS_STORAGE_KEY);
      const existingTeams: Team[] = currentTeams ? parseTeamDates(JSON.parse(currentTeams)) : [];
      console.log('[Teams] Current teams count:', existingTeams.length);
      
      try {
        const result = await teamsApi.create(data.captainId, {
          name: data.name,
          sport: data.sport,
          format: data.format,
          level: data.level,
          ambiance: data.ambiance,
          city: data.city,
          country: data.country,
          description: data.description,
          maxMembers: data.maxMembers,
          isRecruiting: data.isRecruiting ?? true,
          logo: data.logo,
        });
        const updatedTeams = [...existingTeams, result];
        await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams));
        setTeams(updatedTeams);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        console.log('[Teams] Team created successfully via API:', result.id);
        return result;
      } catch (err: any) {
        console.log('[Teams] API error, creating locally:', err.message);
        const newTeam: Team = {
          id: `team-local-${Date.now()}`,
          name: data.name,
          logo: data.logo,
          sport: data.sport,
          format: data.format,
          level: data.level,
          ambiance: data.ambiance,
          city: data.city,
          country: data.country,
          description: data.description,
          captainId: data.captainId,
          coCaptainIds: [],
          members: [{ userId: data.captainId, role: 'captain', customRole: 'Capitaine', joinedAt: new Date() }],
          maxMembers: data.maxMembers,
          stats: { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0, tournamentWins: 0, totalCashPrize: 0 },
          reputation: 5.0,
          isRecruiting: data.isRecruiting ?? true,
          joinRequests: [],
          customRoles: data.customRoles || [],
          location: data.location,
          createdAt: new Date(),
        };
        const updatedTeams = [...existingTeams, newTeam];
        await AsyncStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams));
        setTeams(updatedTeams);
        console.log('[Teams] Team created locally:', newTeam.id, 'Total teams:', updatedTeams.length);
        return newTeam;
      }
    },
  });

  const joinRequestMutation = useMutation({
    mutationFn: async ({ teamId, userId, message }: { teamId: string; userId: string; message?: string }) => {
      console.log('[Teams] Sending join request to team:', teamId);
      try {
        const request = await teamsApi.sendJoinRequest(teamId, userId, message);
        const teamIndex = teams.findIndex(t => t.id === teamId);
        if (teamIndex !== -1) {
          const updatedTeams = [...teams];
          updatedTeams[teamIndex] = {
            ...updatedTeams[teamIndex],
            joinRequests: [...updatedTeams[teamIndex].joinRequests, request],
          };
          await saveTeams(updatedTeams);
        }
        return request;
      } catch (err: any) {
        console.log('[Teams] Supabase error:', err.message);
        const teamIndex = teams.findIndex(t => t.id === teamId);
        if (teamIndex === -1) throw new Error('Équipe non trouvée');
        if (teams[teamIndex].joinRequests.find(r => r.userId === userId)) throw new Error('Demande déjà envoyée');
        if (teams[teamIndex].members.find(m => m.userId === userId)) throw new Error('Déjà membre');
        
        const newRequest: JoinRequest = {
          id: `request-${Date.now()}`,
          userId,
          teamId,
          message,
          status: 'pending',
          compatibilityScore: Math.floor(Math.random() * 30) + 70,
          createdAt: new Date(),
        };
        const updatedTeams = [...teams];
        updatedTeams[teamIndex] = {
          ...updatedTeams[teamIndex],
          joinRequests: [...updatedTeams[teamIndex].joinRequests, newRequest],
        };
        await saveTeams(updatedTeams);
        return newRequest;
      }
    },
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ teamId, requestId, action, handlerId }: { teamId: string; requestId: string; action: 'accept' | 'reject' | 'wait'; handlerId: string }) => {
      console.log('[Teams] Handling request:', requestId, action);
      try {
        await teamsApi.handleJoinRequest(teamId, requestId, action, handlerId);
      } catch (err: any) {
        console.log('[Teams] Supabase error:', err.message);
      }
      
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const requestIndex = teams[teamIndex].joinRequests.findIndex(r => r.id === requestId);
      if (requestIndex === -1) throw new Error('Demande non trouvée');
      
      const updatedTeams = [...teams];
      const request = updatedTeams[teamIndex].joinRequests[requestIndex];
      
      if (action === 'accept') {
        updatedTeams[teamIndex].members.push({ userId: request.userId, role: 'member', joinedAt: new Date() });
        updatedTeams[teamIndex].joinRequests[requestIndex] = { ...request, status: 'accepted', respondedAt: new Date() };
      } else if (action === 'reject') {
        updatedTeams[teamIndex].joinRequests[requestIndex] = { ...request, status: 'rejected', respondedAt: new Date() };
      } else {
        updatedTeams[teamIndex].joinRequests[requestIndex] = { ...request, status: 'waiting' };
      }
      
      await saveTeams(updatedTeams);
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ teamId, userId, customRole, position }: { teamId: string; userId: string; customRole?: string; position?: string }) => {
      console.log('[Teams] Updating member role:', userId);
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const updatedTeams = [...teams];
      const memberIndex = updatedTeams[teamIndex].members.findIndex(m => m.userId === userId);
      if (memberIndex === -1) throw new Error('Membre non trouvé');
      
      updatedTeams[teamIndex].members[memberIndex] = {
        ...updatedTeams[teamIndex].members[memberIndex],
        customRole,
        position,
      };
      await saveTeams(updatedTeams);
    },
  });

  const addCustomRoleMutation = useMutation({
    mutationFn: async ({ teamId, roleName, createdBy }: { teamId: string; roleName: string; createdBy: string }) => {
      console.log('[Teams] Adding custom role:', roleName);
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const newRole: TeamRole = { id: `role-${Date.now()}`, name: roleName, isCustom: true, createdBy };
      const updatedTeams = [...teams];
      updatedTeams[teamIndex] = {
        ...updatedTeams[teamIndex],
        customRoles: [...updatedTeams[teamIndex].customRoles, newRole],
      };
      await saveTeams(updatedTeams);
      return newRole;
    },
  });

  const promoteMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId, role, promoterId }: { teamId: string; userId: string; role: 'co-captain' | 'member'; promoterId: string }) => {
      console.log('[Teams] Promoting member:', userId, role);
      try {
        await teamsApi.promoteMember(teamId, userId, role, promoterId);
      } catch (err: any) {
        console.log('[Teams] Supabase error:', err.message);
      }
      
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const updatedTeams = [...teams];
      const memberIndex = updatedTeams[teamIndex].members.findIndex(m => m.userId === userId);
      if (memberIndex === -1) throw new Error('Membre non trouvé');
      
      updatedTeams[teamIndex].members[memberIndex].role = role;
      if (role === 'co-captain') {
        updatedTeams[teamIndex].coCaptainIds = [...new Set([...updatedTeams[teamIndex].coCaptainIds, userId])];
      } else {
        updatedTeams[teamIndex].coCaptainIds = updatedTeams[teamIndex].coCaptainIds.filter(id => id !== userId);
      }
      await saveTeams(updatedTeams);
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      console.log('[Teams] Leaving team:', teamId);
      try {
        await teamsApi.leave(teamId, userId);
      } catch (err: any) {
        console.log('[Teams] Supabase error:', err.message);
      }
      
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      if (teams[teamIndex].captainId === userId) throw new Error('Le capitaine ne peut pas quitter');
      
      const updatedTeams = [...teams];
      updatedTeams[teamIndex] = {
        ...updatedTeams[teamIndex],
        members: updatedTeams[teamIndex].members.filter(m => m.userId !== userId),
        coCaptainIds: updatedTeams[teamIndex].coCaptainIds.filter(id => id !== userId),
      };
      await saveTeams(updatedTeams);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      console.log('[Teams] Removing member:', userId);
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const updatedTeams = [...teams];
      updatedTeams[teamIndex] = {
        ...updatedTeams[teamIndex],
        members: updatedTeams[teamIndex].members.filter(m => m.userId !== userId),
        coCaptainIds: updatedTeams[teamIndex].coCaptainIds.filter(id => id !== userId),
      };
      await saveTeams(updatedTeams);
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, updates }: { teamId: string; updates: Partial<Pick<Team, 'name' | 'description' | 'logo' | 'isRecruiting' | 'maxMembers' | 'level' | 'ambiance'>> }) => {
      console.log('[Teams] Updating team:', teamId, updates);
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      
      const updatedTeams = [...teams];
      updatedTeams[teamIndex] = {
        ...updatedTeams[teamIndex],
        ...updates,
      };
      await saveTeams(updatedTeams);
      return updatedTeams[teamIndex];
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      console.log('[Teams] Deleting team:', teamId);
      const team = teams.find(t => t.id === teamId);
      if (!team) throw new Error('Équipe non trouvée');
      if (team.captainId !== userId) throw new Error('Seul le capitaine peut dissoudre l\'équipe');
      
      const updatedTeams = teams.filter(t => t.id !== teamId);
      await saveTeams(updatedTeams);
    },
  });

  const transferCaptaincyMutation = useMutation({
    mutationFn: async ({ teamId, newCaptainId, currentCaptainId }: { teamId: string; newCaptainId: string; currentCaptainId: string }) => {
      console.log('[Teams] Transferring captaincy:', teamId, newCaptainId);
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) throw new Error('Équipe non trouvée');
      if (teams[teamIndex].captainId !== currentCaptainId) throw new Error('Seul le capitaine peut transférer');
      
      const updatedTeams = [...teams];
      const oldCaptainIndex = updatedTeams[teamIndex].members.findIndex(m => m.userId === currentCaptainId);
      const newCaptainIndex = updatedTeams[teamIndex].members.findIndex(m => m.userId === newCaptainId);
      
      if (newCaptainIndex === -1) throw new Error('Nouveau capitaine non trouvé');
      
      updatedTeams[teamIndex].captainId = newCaptainId;
      updatedTeams[teamIndex].members[newCaptainIndex].role = 'captain';
      if (oldCaptainIndex !== -1) {
        updatedTeams[teamIndex].members[oldCaptainIndex].role = 'member';
      }
      updatedTeams[teamIndex].coCaptainIds = updatedTeams[teamIndex].coCaptainIds.filter(id => id !== newCaptainId);
      
      await saveTeams(updatedTeams);
    },
  });

  const getTeamById = useCallback((id: string) => teams.find(t => t.id === id), [teams]);
  const getUserTeams = useCallback((userId: string) => teams.filter(t => t.members.some(m => m.userId === userId)), [teams]);
  const getRecruitingTeams = useCallback(() => teams.filter(t => t.isRecruiting && t.members.length < t.maxMembers), [teams]);
  const getPendingRequests = useCallback((teamId: string) => teams.find(t => t.id === teamId)?.joinRequests.filter(r => r.status === 'pending') || [], [teams]);

  return {
    teams,
    isLoading: teamsQuery.isLoading,
    createTeam: createTeamMutation.mutateAsync,
    sendJoinRequest: joinRequestMutation.mutateAsync,
    handleRequest: handleRequestMutation.mutateAsync,
    updateMemberRole: updateMemberRoleMutation.mutateAsync,
    addCustomRole: addCustomRoleMutation.mutateAsync,
    promoteMember: promoteMemberMutation.mutateAsync,
    leaveTeam: leaveTeamMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    updateTeam: updateTeamMutation.mutateAsync,
    deleteTeam: deleteTeamMutation.mutateAsync,
    transferCaptaincy: transferCaptaincyMutation.mutateAsync,
    getTeamById,
    getUserTeams,
    getRecruitingTeams,
    getPendingRequests,
    isCreating: createTeamMutation.isPending,
    isUpdating: updateTeamMutation.isPending,
  };
});
