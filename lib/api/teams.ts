import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, JoinRequest, TeamStats, TeamRole } from '@/types';

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
  async getAll() {
    console.log('[TeamsAPI] Getting all teams');
    const { data, error } = await (supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    return ((data || []) as TeamRow[]).map(row => mapTeamRowToTeam(row));
  },

  async getById(id: string) {
    console.log('[TeamsAPI] Getting team by id:', id);
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

    await (supabase.from('notifications').insert({
      user_id: team.captainId,
      type: 'team',
      title: 'Nouvelle demande',
      message: `Nouvelle demande pour ${team.name}`,
      data: { teamId: team.id, requestId: request.id }
    } as any) as any);

    return request;
  },

  async handleJoinRequest(teamId: string, requestId: string, action: 'accept' | 'reject' | 'wait', handlerId: string) {
    console.log('[TeamsAPI] Handling join request:', requestId, action);
    
    const team = await this.getById(teamId);
    
    if (team.captainId !== handlerId && !team.coCaptainIds.includes(handlerId)) {
      throw new Error('Non autorisé');
    }

    const requestIndex = team.joinRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) throw new Error('Demande non trouvée');

    const request = team.joinRequests[requestIndex];
    request.status = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'waiting';
    request.respondedAt = new Date();

    if (action === 'accept') {
      const newMember: TeamMember = {
        userId: request.userId,
        role: 'member',
        joinedAt: new Date()
      };
      
      const members = [...team.members, newMember];
      await this.update(teamId, { members, joinRequests: team.joinRequests });

      const { data: user } = await (supabase
        .from('users')
        .select('teams')
        .eq('id', request.userId)
        .single() as any);
      
      if (user) {
        const userTeams = user as { teams: string[] | null };
        const teams = [...((userTeams.teams as string[]) || []), team.id];
        await ((supabase.from('users') as any).update({ teams }).eq('id', request.userId));
      }

      await (supabase.from('notifications').insert({
        user_id: request.userId,
        type: 'team',
        title: 'Demande acceptée',
        message: `Vous êtes maintenant membre de ${team.name}!`
      } as any) as any);
    } else {
      await this.update(teamId, { joinRequests: team.joinRequests });
    }

    return request;
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
};
