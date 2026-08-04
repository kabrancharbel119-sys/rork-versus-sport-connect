import { supabase } from '@/lib/supabase';
import type { Team, TeamMember, JoinRequest, TeamStats, TeamRole, TeamPhoto, TeamPost, TeamPostComment, CMAssignment, CMPermissions } from '@/types';
import { DEFAULT_CM_PERMISSIONS } from '@/types';
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
  creator_id: string | null;
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
  creatorId: row.creator_id || row.captain_id || undefined,
  coCaptainIds: (row.co_captain_ids as string[]) || [],
  members: ((row.members as unknown as TeamMember[]) || []).map(m => ({
    ...m,
    role: m.userId === (row.captain_id || '') ? 'captain' as const
      : m.role === 'captain' ? 'member' as const
      : m.role,
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
    let teams = ((data || []) as TeamRow[]).map(row => mapTeamRowToTeam(row));
    const total = count ?? 0;

    // If fetching the first page with default limit and there are more teams, fetch all remaining pages
    if (!options?.page && !options?.limit && total > teams.length) {
      const totalPages = Math.ceil(total / limit);
      for (let p = 2; p <= totalPages; p++) {
        const f = (p - 1) * limit;
        const t = f + limit - 1;
        const { data: moreData, error: moreError } = await (supabase
          .from('teams')
          .select('*')
          .range(f, t)
          .order('created_at', { ascending: false }) as any);
        if (moreError) {
          logger.error('TeamsAPI', `Error fetching page ${p}:`, moreError);
          break;
        }
        teams = teams.concat(((moreData || []) as TeamRow[]).map(row => mapTeamRowToTeam(row)));
      }
    }

    logger.debug('TeamsAPI', 'All teams from DB:', teams.length, 'total:', total);
    return {
      teams,
      total,
      page,
      limit,
      hasMore: !options?.page && !options?.limit ? false : (total ? (page * limit) < total : false),
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
    locationLat?: number;
    locationLng?: number;
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
        location_lat: teamData.locationLat,
        location_lng: teamData.locationLng,
        description: teamData.description,
        captain_id: userId,
        creator_id: userId,
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
    captainId: string;
    stats: TeamStats;
    customRoles: TeamRole[];
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
    if (updates.captainId !== undefined) dbUpdates.captain_id = updates.captainId;
    if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
    if (updates.customRoles !== undefined) dbUpdates.custom_roles = updates.customRoles;
    
    const { data, error } = await ((supabase.from('teams') as any)
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single());
    
    if (error) throw error;
    return mapTeamRowToTeam(data as TeamRow);
  },

  async addCustomRole(teamId: string, roleName: string, createdBy: string): Promise<TeamRole> {
    console.log('[TeamsAPI] Adding custom role:', roleName, 'to team', teamId);

    const team = await this.getById(teamId);

    if (team.customRoles.some(r => r.name.toLowerCase() === roleName.toLowerCase())) {
      throw new Error('Ce rôle existe déjà');
    }

    const newRole: TeamRole = { id: `role-${Date.now()}`, name: roleName, isCustom: true, createdBy };
    const updatedRoles = [...team.customRoles, newRole];

    await this.update(teamId, { customRoles: updatedRoles });
    return newRole;
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
      // Only check teams OTHER than this one where the player is actually a member in DB
      const otherTeamIds = userTeams.filter(id => id !== team.id);
      if (otherTeamIds.length > 0) {
        // Verify actual membership in DB (users.teams can be stale)
        const { data: otherTeamsData } = await (supabase
          .from('teams')
          .select('id, members')
          .in('id', otherTeamIds) as any);
        const actualOtherTeams = ((otherTeamsData as any[] | null) ?? []).filter((t: any) => {
          const members = t.members ?? [];
          return members.some((m: any) => m.userId === request.userId || m.user_id === request.userId);
        });
        if (actualOtherTeams.length > 0) {
          throw new Error('Ce joueur est déjà membre d\'une autre équipe');
        }
        // Stale — clean up users.teams
        const cleanedTeams = userTeams.filter(id => id === team.id);
        await ((supabase.from('users') as any).update({ teams: cleanedTeams }).eq('id', request.userId));
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

      // Ensure team chats exist and add the new member to all team chat rooms
      try {
        const { chatApi } = await import('@/lib/api/chat');
        const allMemberIds = members.map(m => m.userId);
        await chatApi.ensureTeamChatsAndAddMember(teamId, team.name, allMemberIds, request.userId);
      } catch (e) {
        console.log('[TeamsAPI] Failed to add member to team chats:', e);
      }

      await (supabase.from('notifications').insert({
        user_id: request.userId,
        type: 'team',
        title: '✅ Demande acceptée',
        message: `Vous êtes maintenant membre de ${team.name} ! Bienvenue dans l'équipe.`,
        data: { route: `/team/${teamId}`, teamId },
      } as any) as any);
    } else if (action === 'reject') {
      await this.update(teamId, { joinRequests: updatedJoinRequests });
      await (supabase.from('notifications').insert({
        user_id: request.userId,
        type: 'team',
        title: 'Demande refusée',
        message: `Votre demande pour rejoindre ${team.name} a été refusée.`,
        data: { route: '/teams' },
      } as any) as any);
    } else {
      await this.update(teamId, { joinRequests: updatedJoinRequests });
    }

    return updatedRequest;
  },

  async removeMember(teamId: string, userId: string) {
    console.log('[TeamsAPI] Removing member:', userId, 'from', teamId);

    const team = await this.getById(teamId);

    const members = team.members.filter(m => m.userId !== userId);
    const coCaptainIds = team.coCaptainIds.filter(id => id !== userId);

    await this.update(teamId, { members, coCaptainIds });

    const { data: user } = await (supabase
      .from('users')
      .select('teams')
      .eq('id', userId)
      .single() as any);

    if (user) {
      const userTeams = ((user as { teams: string[] | null }).teams || []).filter(id => id !== teamId);
      await ((supabase.from('users') as any).update({ teams: userTeams }).eq('id', userId));
    }

    return { success: true };
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

  async promoteMember(teamId: string, userId: string, role: 'co-captain' | 'member' | 'cm', promoterId: string) {
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

    const team = await this.getById(teamId);

    // Admin can delete directly
    if (asAdmin) {
      return this._performDelete(teamId, team);
    }

    // Creator can delete directly
    const isCreator = team.creatorId === userId;
    if (isCreator) {
      return this._performDelete(teamId, team);
    }

    // Current captain who is NOT the creator must request admin approval
    if (team.captainId === userId) {
      throw new Error('REQUIRES_ADMIN_APPROVAL: Seul le créateur peut dissoudre l\'équipe directement. En tant que capitaine non-créateur, vous devez soumettre une demande d\'approbation administrateur.');
    }

    throw new Error('Seul le créateur ou un administrateur peut dissoudre l\'équipe');
  },

  async _performDelete(teamId: string, team: Team) {
    // Delete from database
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;

    // Remove team from all members' team lists
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

    return { success: true };
  },

  // ── Dissolution requests ──

  async createDissolutionRequest(teamId: string, requesterId: string, reason: string) {
    const team = await this.getById(teamId);
    const { data, error } = await (supabase as any)
      .from('team_dissolution_requests')
      .insert({
        team_id: teamId,
        requester_id: requesterId,
        team_name: team.name,
        team_sport: team.sport,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getDissolutionRequests(status?: 'pending' | 'approved' | 'rejected') {
    let query = (supabase as any).from('team_dissolution_requests').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getMyDissolutionRequests(userId: string) {
    const { data, error } = await (supabase as any)
      .from('team_dissolution_requests')
      .select('*')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async approveDissolutionRequest(requestId: string, adminId: string, adminNote?: string) {
    // 1. Get the request
    const { data: req, error: reqError } = await (supabase as any)
      .from('team_dissolution_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (reqError) throw reqError;

    // 2. Mark request as approved
    const { error: updateError } = await (supabase as any)
      .from('team_dissolution_requests')
      .update({ status: 'approved', admin_id: adminId, admin_note: adminNote || null, reviewed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (updateError) throw updateError;

    // 3. Delete the team
    const team = await this.getById(req.team_id).catch(() => null);
    if (team) {
      await this._performDelete(req.team_id, team);
    }

    return { success: true, requesterId: req.requester_id, teamName: req.team_name };
  },

  async rejectDissolutionRequest(requestId: string, adminId: string, adminNote?: string) {
    const { error } = await (supabase as any)
      .from('team_dissolution_requests')
      .update({ status: 'rejected', admin_id: adminId, admin_note: adminNote || null, reviewed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw error;

    const { data: req } = await (supabase as any)
      .from('team_dissolution_requests')
      .select('requester_id, team_name')
      .eq('id', requestId)
      .single();
    return { success: true, requesterId: req?.requester_id, teamName: req?.team_name };
  },

  // ── Team photos gallery ──

  async getTeamPhotos(teamId: string): Promise<TeamPhoto[]> {
    const { data, error } = await (supabase
      .from('team_photos')
      .select('id, team_id, user_id, image_url, caption, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false }) as any);

    if (error) {
      logger.error('TeamsAPI', 'getTeamPhotos error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      imageUrl: row.image_url,
      caption: row.caption || undefined,
      createdAt: new Date(row.created_at),
    }));
  },

  async addTeamPhoto(teamId: string, userId: string, imageUrl: string, caption?: string): Promise<TeamPhoto> {
    const { data, error } = await (supabase
      .from('team_photos')
      .insert({
        team_id: teamId,
        user_id: userId,
        image_url: imageUrl,
        caption: caption || null,
      })
      .select('id, team_id, user_id, image_url, caption, created_at')
      .single() as any);

    if (error) throw error;

    return {
      id: data.id,
      teamId: data.team_id,
      userId: data.user_id,
      imageUrl: data.image_url,
      caption: data.caption || undefined,
      createdAt: new Date(data.created_at),
    };
  },

  async deleteTeamPhoto(photoId: string): Promise<void> {
    const { error } = await (supabase
      .from('team_photos')
      .delete()
      .eq('id', photoId) as any);

    if (error) throw error;
  },

  // ════ TEAM POSTS (Feed d'équipe) ════

  async getTeamPosts(teamId: string, limit: number = 20, offset: number = 0, userId?: string): Promise<TeamPost[]> {
    const { data, error } = await (supabase
      .from('team_posts')
      .select(`
        id, team_id, author_id, content, images,
        likes_count, comments_count, created_at,
        teams!inner(name, logo),
        users!inner(username, full_name, avatar)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1) as any);

    if (error) {
      logger.error('TeamsAPI', 'getTeamPosts error:', error);
      return [];
    }

    let likedPostIds = new Set<string>();
    if (userId && data && data.length > 0) {
      const postIds = data.map((row: any) => row.id);
      const { data: likes, error: likesError } = await supabase
        .from('team_post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      if (!likesError && likes) {
        likedPostIds = new Set(likes.map((l: any) => l.post_id));
      }
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      teamId: row.team_id,
      authorId: row.author_id,
      content: row.content || '',
      images: row.images || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      createdAt: new Date(row.created_at),
      teamName: row.teams?.name,
      teamLogo: row.teams?.logo || undefined,
      authorUsername: row.users?.username,
      authorFullName: row.users?.full_name,
      authorAvatar: row.users?.avatar || undefined,
      hasLiked: likedPostIds.has(row.id),
    }));
  },

  async createTeamPost(teamId: string, authorId: string, content: string, images: string[] = []): Promise<TeamPost> {
    const { data, error } = await (supabase
      .from('team_posts')
      .insert({
        team_id: teamId,
        author_id: authorId,
        content,
        images,
      })
      .select(`
        id, team_id, author_id, content, images,
        likes_count, comments_count, created_at,
        teams!inner(name, logo),
        users!inner(username, full_name, avatar)
      `)
      .single() as any);

    if (error) throw error;

    return {
      id: data.id,
      teamId: data.team_id,
      authorId: data.author_id,
      content: data.content || '',
      images: data.images || [],
      likesCount: data.likes_count || 0,
      commentsCount: data.comments_count || 0,
      createdAt: new Date(data.created_at),
      teamName: data.teams?.name,
      teamLogo: data.teams?.logo || undefined,
      authorUsername: data.users?.username,
      authorFullName: data.users?.full_name,
      authorAvatar: data.users?.avatar || undefined,
    };
  },

  async deleteTeamPost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('team_posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
  },

  async toggleTeamPostLike(postId: string, userId: string, hasLiked: boolean): Promise<void> {
    if (hasLiked) {
      const { error } = await supabase
        .from('team_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('team_post_likes')
        .insert({ post_id: postId, user_id: userId });
      if (error) throw error;
    }
  },

  async getTeamPostComments(postId: string): Promise<TeamPostComment[]> {
    const { data, error } = await (supabase
      .from('team_post_comments')
      .select(`
        id, post_id, user_id, content, parent_comment_id, created_at,
        users(username, full_name, avatar)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true }) as any);

    if (error) {
      logger.error('TeamsAPI', 'getTeamPostComments error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      content: row.content,
      parentCommentId: row.parent_comment_id || undefined,
      createdAt: new Date(row.created_at),
      username: row.users?.username,
      fullName: row.users?.full_name,
      avatar: row.users?.avatar || undefined,
    }));
  },

  async addTeamPostComment(postId: string, userId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('team_post_comments')
      .insert({ post_id: postId, user_id: userId, content });

    if (error) throw error;
  },

  // ════ CM (Community Manager) System ════

  async getCMs(teamId: string): Promise<CMAssignment[]> {
    const { data, error } = await supabase
      .from('team_cm_assignments')
      .select('*')
      .eq('team_id', teamId)
      .order('assigned_at', { ascending: false });

    if (error) {
      logger.debug('TeamsAPI', 'getCMs: table not available:', error.message);
      // Fallback: derive CMs from team.members where role === 'cm'
      try {
        const team = await this.getById(teamId);
        const cmMembers = (team?.members || []).filter(m => m.role === 'cm');
        if (cmMembers.length > 0) {
          return cmMembers.map(m => ({
            id: `fallback-cm-${teamId}-${m.userId}`,
            teamId,
            userId: m.userId,
            assignedBy: team?.captainId || '',
            status: 'active' as const,
            permissions: DEFAULT_CM_PERMISSIONS,
            assignedAt: new Date(),
            suspendedAt: undefined,
            suspendedReason: undefined,
          }));
        }
      } catch (e) {
        logger.debug('TeamsAPI', 'getCMs: fallback failed:', e);
      }
      return [];
    }

    const assignments = (data || []).map((row: any) => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      assignedBy: row.assigned_by,
      status: row.status,
      permissions: row.permissions || DEFAULT_CM_PERMISSIONS,
      assignedAt: new Date(row.assigned_at),
      suspendedAt: row.suspended_at ? new Date(row.suspended_at) : undefined,
      suspendedReason: row.suspended_reason || undefined,
    }));

    // If table exists but is empty, still check team.members for role 'cm'
    if (assignments.length === 0) {
      try {
        const team = await this.getById(teamId);
        const cmMembers = (team?.members || []).filter(m => m.role === 'cm');
        if (cmMembers.length > 0) {
          return cmMembers.map(m => ({
            id: `fallback-cm-${teamId}-${m.userId}`,
            teamId,
            userId: m.userId,
            assignedBy: team?.captainId || '',
            status: 'active' as const,
            permissions: DEFAULT_CM_PERMISSIONS,
            assignedAt: new Date(),
            suspendedAt: undefined,
            suspendedReason: undefined,
          }));
        }
      } catch (e) {
        logger.debug('TeamsAPI', 'getCMs: fallback failed:', e);
      }
    }

    return assignments;
  },

  async assignCM(teamId: string, userId: string, captainId: string, permissions?: Partial<CMPermissions>): Promise<CMAssignment> {
    const perms = { ...DEFAULT_CM_PERMISSIONS, ...permissions };

    const { data, error } = await supabase
      .from('team_cm_assignments')
      .upsert({
        team_id: teamId,
        user_id: userId,
        assigned_by: captainId,
        status: 'active',
        permissions: perms,
        assigned_at: new Date().toISOString(),
        suspended_at: null,
        suspended_reason: null,
      }, { onConflict: 'team_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    // Also update the member role in the teams table
    const team = await this.getById(teamId);
    const memberIndex = team.members.findIndex(m => m.userId === userId);
    if (memberIndex !== -1) {
      team.members[memberIndex].role = 'cm';
      await this.update(teamId, { members: team.members });
    }

    return {
      id: data.id,
      teamId: data.team_id,
      userId: data.user_id,
      assignedBy: data.assigned_by,
      status: data.status,
      permissions: data.permissions,
      assignedAt: new Date(data.assigned_at),
    };
  },

  async removeCM(teamId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('team_cm_assignments')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    // Also revert member role to 'member'
    const team = await this.getById(teamId);
    const memberIndex = team.members.findIndex(m => m.userId === userId);
    if (memberIndex !== -1 && team.members[memberIndex].role === 'cm') {
      team.members[memberIndex].role = 'member';
      await this.update(teamId, { members: team.members });
    }
  },

  async updateCMPermissions(teamId: string, userId: string, permissions: CMPermissions): Promise<void> {
    const { error } = await supabase
      .from('team_cm_assignments')
      .update({ permissions })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async suspendCM(teamId: string, userId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('team_cm_assignments')
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: reason || null,
      })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    // Revert member role to 'member' while suspended
    const team = await this.getById(teamId);
    const memberIndex = team.members.findIndex(m => m.userId === userId);
    if (memberIndex !== -1) {
      team.members[memberIndex].role = 'member';
      await this.update(teamId, { members: team.members });
    }
  },

  async reactivateCM(teamId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('team_cm_assignments')
      .update({
        status: 'active',
        suspended_at: null,
        suspended_reason: null,
      })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    // Restore member role to 'cm'
    const team = await this.getById(teamId);
    const memberIndex = team.members.findIndex(m => m.userId === userId);
    if (memberIndex !== -1) {
      team.members[memberIndex].role = 'cm';
      await this.update(teamId, { members: team.members });
    }
  },

  async getMyCMPermissions(teamId: string, userId: string): Promise<CMPermissions | null> {
    const { data, error } = await supabase
      .from('team_cm_assignments')
      .select('permissions, status')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    if (data.status !== 'active') return null;

    return data.permissions as CMPermissions;
  },
};
