import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, JoinRequest, TeamStats, TeamRole } from '@/types';
import { logger } from '@/lib/logger';

export interface TeamRow {
  id: string;
  name: string;
  logo: string | null;
  sport: string;
  format: string;
  level: string;
  ambiance: string;
  city: string;
  country: string;
  description: string | null;
  captain_id: string | null;
  co_captain_ids: string[];
  members: TeamMember[];
  fans: string[];
  max_members: number;
  stats: TeamStats;
  reputation: number;
  is_recruiting: boolean;
  join_requests: JoinRequest[];
  custom_roles: TeamRole[];
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
}

export const mapTeamRowToTeam = (row: TeamRow): Team => ({
  id: row.id,
  name: row.name,
  logo: row.logo ?? undefined,
  sport: row.sport as Team['sport'],
  format: row.format,
  level: row.level as Team['level'],
  ambiance: row.ambiance as Team['ambiance'],
  city: row.city,
  country: row.country,
  description: row.description ?? undefined,
  captainId: row.captain_id || '',
  coCaptainIds: (row.co_captain_ids as string[]) || [],
  members: ((row.members as unknown as TeamMember[]) || []).map(m => ({
    ...m,
    joinedAt: new Date(m.joinedAt)
  })),
  fans: (row.fans as string[]) || [],
  maxMembers: row.max_members ?? 15,
  stats: (row.stats as unknown as TeamStats) || {
    matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
    goalsFor: 0, goalsAgainst: 0, tournamentWins: 0, totalCashPrize: 0
  },
  reputation: row.reputation ?? 5.0,
  isRecruiting: row.is_recruiting ?? true,
  joinRequests: ((row.join_requests as unknown as JoinRequest[]) || []).map(r => ({
    ...r,
    createdAt: new Date(r.createdAt),
    respondedAt: r.respondedAt ? new Date(r.respondedAt) : undefined
  })),
  customRoles: (row.custom_roles as unknown as TeamRole[]) || [],
  location: row.location_lat && row.location_lng ? {
    latitude: row.location_lat,
    longitude: row.location_lng,
    city: row.city,
    country: row.country,
    lastUpdated: new Date()
  } : undefined,
  createdAt: new Date(row.created_at),
});

export const teamsApi = {
  async getAll(options?: { page?: number; limit?: number }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    logger.debug('TeamsAPI', 'Getting all teams (no filter by userId)', { page, limit });
    const { data, error, count } = await (supabase
      .from('teams')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    const teams = ((data || []) as TeamRow[]).map(row => mapTeamRowToTeam(row));
    logger.debug('TeamsAPI', 'All teams from DB:', teams.length);
    return {
      teams,
      total: count ?? 0,
      page,
      limit,
      hasMore: count ? (page * limit) < count : false,
    };
  },

  async getById(id: string) {
    logger.debug('TeamsAPI', 'Getting team by id:', id);
    const { data, error } = await (supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single() as any);
    
    if (error) throw error;
    if (!data) throw new Error('Équipe non trouvée');
    return mapTeamRowToTeam(data as TeamRow);
  },

  async create(userId: string, teamData: {
    name: string;
    sport: string;
    format: string;
    level: string;
    ambiance: string;
    city: string;
    country: string;
    description?: string;
    maxMembers: number;
    isRecruiting?: boolean;
    logo?: string;
  }) {
    console.log('[TeamsAPI] Creating team:', teamData.name);
    
    const members = [{
      userId,
      role: 'captain',
      customRole: 'Capitaine',
      joinedAt: new Date().toISOString()
    }];

    const { data, error } = await (supabase
      .from('teams')
      .insert({
        name: teamData.name,
        logo: teamData.logo,
        sport: teamData.sport,
        format: teamData.format,
        level: teamData.level,
        ambiance: teamData.ambiance,
        city: teamData.city,
        country: teamData.country,
        description: teamData.description,
        captain_id: userId,
        max_members: teamData.maxMembers,
        is_recruiting: teamData.isRecruiting ?? true,
        members,
      } as any)
      .select()
      .single() as any);
    
    if (error) throw error;

    const { data: user } = await (supabase
      .from('users')
      .select('teams')
      .eq('id', userId)
      .single() as any);
    
    if (user) {
      const userTeams = user as { teams: string[] | null };
      const teams = [...((userTeams.teams as string[]) || []), data.id];
      await ((supabase.from('users') as any).update({ teams }).eq('id', userId));
    }

    return mapTeamRowToTeam(data as TeamRow);
  },

  async update(id: string, updates: Partial<{
    name: string;
    logo: string;
    description: string;
    isRecruiting: boolean;
    maxMembers: number;
    members: TeamMember[];
    fans: string[];
    joinRequests: JoinRequest[];
    coCaptainIds: string[];
    stats: TeamStats;
  }>) {
    console.log('[TeamsAPI] Updating team:', id);
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.logo !== undefined) dbUpdates.logo = updates.logo;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isRecruiting !== undefined) dbUpdates.is_recruiting = updates.isRecruiting;
    if (updates.maxMembers !== undefined) dbUpdates.max_members = updates.maxMembers;
    if (updates.members !== undefined) dbUpdates.members = updates.members;
    if (updates.fans !== undefined) dbUpdates.fans = updates.fans;
    if (updates.joinRequests !== undefined) dbUpdates.join_requests = updates.joinRequests;
    if (updates.coCaptainIds !== undefined) dbUpdates.co_captain_ids = updates.coCaptainIds;
    if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
    
    const { data, error } = await ((supabase.from('teams') as any)
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single());
    
    if (error) throw error;
    return mapTeamRowToTeam(data as TeamRow);
  },

  async search(params: {
    query?: string;
    sport?: string;
    level?: string;
    city?: string;
    isRecruiting?: boolean;
  }) {
    console.log('[TeamsAPI] Searching teams:', params);
    let query = supabase.from('teams').select('*') as any;

    if (params.sport) query = query.eq('sport', params.sport);
    if (params.level) query = query.eq('level', params.level);
    if (params.city) query = query.ilike('city', params.city);
    if (params.isRecruiting !== undefined) query = query.eq('is_recruiting', params.isRecruiting);

    const { data, error } = await query;
    if (error) throw error;

    let teams = ((data || []) as TeamRow[]).map(row => mapTeamRowToTeam(row));

    if (params.query) {
      const q = params.query.toLowerCase();
      teams = teams.filter(t => t.name.toLowerCase().includes(q));
    }

    return teams;
  },

  async sendJoinRequest(teamId: string, userId: string, message?: string) {
    console.log('[TeamsAPI] ========== DÉBUT ENVOI DEMANDE ==========');
    console.log('[TeamsAPI] Sending join request:', userId, '->', teamId);
    
    const team = await this.getById(teamId);
    
    if (team.members.some(m => m.userId === userId)) {
      throw new Error('Déjà membre');
    }
    
    if (team.joinRequests.some(r => r.userId === userId && r.status === 'pending')) {
      throw new Error('Demande en attente');
    }

    const request: JoinRequest = {
      id: `req-${Date.now()}`,
      userId,
      teamId,
      message,
      status: 'pending',
      compatibilityScore: Math.floor(70 + Math.random() * 30),
      createdAt: new Date()
    };

    const joinRequests = [...team.joinRequests, request];
    await this.update(teamId, { joinRequests: joinRequests as JoinRequest[] });

    const { data: requester } = await (supabase
      .from('users')
      .select('full_name, username')
      .eq('id', userId)
      .single() as any);
    const requesterName = (requester as { full_name?: string | null; username?: string | null } | null)?.full_name
      || (requester as { full_name?: string | null; username?: string | null } | null)?.username
      || 'Un joueur';

    console.log('[TeamsAPI] Insertion notification pour capitaine:', team.captainId);
    console.log('[TeamsAPI] Message notif:', `${requesterName} souhaite rejoindre ${team.name}`);
    
    const notifResult = await (supabase.from('notifications').insert({
      user_id: team.captainId,
      type: 'team',
      title: 'Nouvelle demande',
      message: `${requesterName} souhaite rejoindre ${team.name}`,
      data: {
        route: `/user/${userId}?fromTeamRequest=1&teamId=${team.id}&requestId=${request.id}`,
        requesterId: userId,
        teamId: team.id,
        requestId: request.id,
      }
    } as any) as any);

    if (notifResult.error) {
      console.error('[TeamsAPI] ❌ ERREUR insertion notification:', notifResult.error);
    } else {
      console.log('[TeamsAPI] ✅ Notification insérée avec succès');
    }

    console.log('[TeamsAPI] ========== FIN ENVOI DEMANDE ==========');
    return request;
  },

  async handleJoinRequest(teamId: string, requestId: string, action: 'accept' | 'reject' | 'wait', handlerId: string) {
    console.log('[TeamsAPI] Handling join request:', requestId, action);
    
    const team = await this.getById(teamId);
    
    if (team.captainId !== handlerId) {
      throw new Error('Non autorisé');
    }

    const requestIndex = team.joinRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) throw new Error('Demande non trouvée');

    const request = team.joinRequests[requestIndex];
    if (request.status !== 'pending' && request.status !== 'waiting') {
      throw new Error('Cette demande a déjà été traitée');
    }

    const updatedRequest: JoinRequest = {
      ...request,
      status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'waiting',
      respondedAt: new Date(),
    };
    const updatedJoinRequests = [...team.joinRequests];
    updatedJoinRequests[requestIndex] = updatedRequest;

    if (action === 'accept') {
      if (team.members.some(m => m.userId === request.userId)) {
        throw new Error('Ce joueur est déjà membre');
      }
      if (team.members.length >= team.maxMembers) {
        throw new Error('Équipe complète');
      }

      const { data: user, error: userError } = await (supabase
        .from('users')
        .select('teams')
        .eq('id', request.userId)
        .single() as any);
      if (userError) throw userError;
      const userTeams = (((user as { teams?: string[] | null } | null)?.teams as string[] | null) ?? []).filter(Boolean);
      const otherTeams = userTeams.filter(id => id !== team.id);
      if (otherTeams.length > 0) {
        throw new Error('Ce joueur est déjà membre d\'une autre équipe');
      }

      const newMember: TeamMember = {
        userId: request.userId,
        role: 'member',
        joinedAt: new Date()
      };
      
      const members = [...team.members, newMember];
      const fans = (team.fans ?? []).filter(id => id !== request.userId);
      await this.update(teamId, { members, joinRequests: updatedJoinRequests, fans });
      const teams = [...new Set([...userTeams, team.id])];
      await ((supabase.from('users') as any).update({ teams }).eq('id', request.userId));

      await (supabase.from('notifications').insert({
        user_id: request.userId,
        type: 'team',
        title: 'Demande acceptée',
        message: `Vous êtes maintenant membre de ${team.name}!`
      } as any) as any);
    } else if (action === 'reject') {
      await this.update(teamId, { joinRequests: updatedJoinRequests });
      await (supabase.from('notifications').insert({
        user_id: request.userId,
        type: 'team',
        title: 'Demande refusée',
        message: `Votre demande pour rejoindre ${team.name} a été refusée.`
      } as any) as any);
    } else {
      await this.update(teamId, { joinRequests: updatedJoinRequests });
    }

    return updatedRequest;
  },

  async leave(teamId: string, userId: string) {
    console.log('[TeamsAPI] Leaving team:', userId, 'from', teamId);
    
    const team = await this.getById(teamId);
    
    if (team.captainId === userId) {
      throw new Error('Le capitaine ne peut pas quitter');
    }

    const members = team.members.filter(m => m.userId !== userId);
    const coCaptainIds = team.coCaptainIds.filter(id => id !== userId);
    
    await this.update(teamId, { members, coCaptainIds });

    const { data: user } = await (supabase
      .from('users')
      .select('teams')
      .eq('id', userId)
      .single() as any);
    
    if (user) {
      const userTeams = user as { teams: string[] | null };
      const teams = ((userTeams.teams as string[]) || []).filter(id => id !== teamId);
      await ((supabase.from('users') as any).update({ teams }).eq('id', userId));
    }

    return { success: true };
  },

  async promoteMember(teamId: string, userId: string, role: 'co-captain' | 'member', promoterId: string) {
    console.log('[TeamsAPI] Promoting member:', userId, 'to', role);
    
    const team = await this.getById(teamId);
    
    if (team.captainId !== promoterId) {
      throw new Error('Non autorisé');
    }

    const memberIndex = team.members.findIndex(m => m.userId === userId);
    if (memberIndex === -1) throw new Error('Membre non trouvé');

    team.members[memberIndex].role = role;
    
    let coCaptainIds = [...team.coCaptainIds];
    if (role === 'co-captain') {
      coCaptainIds = [...new Set([...coCaptainIds, userId])];
    } else {
      coCaptainIds = coCaptainIds.filter(id => id !== userId);
    }

    await this.update(teamId, { members: team.members, coCaptainIds });
    return team.members[memberIndex];
  },

  async followTeam(teamId: string, userId: string) {
    console.log('[TeamsAPI] Following team:', teamId, 'by user:', userId);
    
    const team = await this.getById(teamId);
    
    // Check if already a member
    if (team.members.some(m => m.userId === userId)) {
      throw new Error('Vous êtes déjà membre de cette équipe');
    }
    
    const fansList = team.fans ?? [];
    if (fansList.includes(userId)) {
      throw new Error('Vous suivez déjà cette équipe');
    }
    
    const fans = [...fansList, userId];
    await this.update(teamId, { fans });
    
    return { success: true };
  },

  async unfollowTeam(teamId: string, userId: string) {
    console.log('[TeamsAPI] Unfollowing team:', teamId, 'by user:', userId);
    
    const team = await this.getById(teamId);
    
    const fansList = team.fans ?? [];
    if (!fansList.includes(userId)) {
      throw new Error('Vous ne suivez pas cette équipe');
    }
    
    const fans = fansList.filter(id => id !== userId);
    await this.update(teamId, { fans });
    
    return { success: true };
  },

  async delete(teamId: string, userId: string, asAdmin: boolean = false) {
    console.log('[TeamsAPI] Deleting team:', teamId, asAdmin ? '(admin)' : '');
    
    if (!asAdmin) {
      const team = await this.getById(teamId);
      if (team.captainId !== userId) {
        throw new Error('Seul le capitaine peut dissoudre l\'équipe');
      }
    }
    
    // Delete from database
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);
    
    if (error) throw error;
    
    // Remove team from all members' team lists
    const team = await this.getById(teamId).catch(() => null);
    if (team) {
      for (const member of team.members) {
        const { data: user } = await (supabase
          .from('users')
          .select('teams')
          .eq('id', member.userId)
          .single() as any);
        
        if (user) {
          const userTeams = user as { teams: string[] | null };
          const teams = ((userTeams.teams as string[]) || []).filter(id => id !== teamId);
          await ((supabase.from('users') as any).update({ teams }).eq('id', member.userId));
        }
      }
    }
    
    return { success: true };
  },
};
