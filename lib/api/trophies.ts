import { supabase } from '@/lib/supabase';
import type { TrophyRarity } from '@/contexts/TrophiesContext';

export interface UserTrophy {
  id: string;
  userId: string;
  trophyId: string;
  progress: number;
  unlockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  trophy?: TrophyDefinition;
}

export interface TrophyDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: TrophyRarity;
  category: string;
  requirement: number;
  xpReward: number;
}

export const trophiesApi = {
  // Get all trophy definitions
  async getAllDefinitions(): Promise<TrophyDefinition[]> {
    const { data, error } = await supabase
      .from('trophy_definitions')
      .select('*');

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToDefinition);
  },

  // Get user's trophies
  async getUserTrophies(userId: string): Promise<UserTrophy[]> {
    const { data, error } = await supabase
      .from('user_trophies')
      .select(`
        *,
        trophy:trophy_id(*)
      `)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToUserTrophy);
  },

  // Get unlocked trophies for a user
  async getUnlockedTrophies(userId: string): Promise<UserTrophy[]> {
    const { data, error } = await supabase
      .from('user_trophies')
      .select(`
        *,
        trophy:trophy_id(*)
      `)
      .eq('user_id', userId)
      .eq('progress', 100)
      .order('unlocked_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToUserTrophy);
  },

  // Get in-progress trophies for a user
  async getInProgressTrophies(userId: string, limit = 3): Promise<UserTrophy[]> {
    const { data, error } = await supabase
      .from('user_trophies')
      .select(`
        *,
        trophy:trophy_id(*)
      `)
      .eq('user_id', userId)
      .gt('progress', 0)
      .lt('progress', 100)
      .order('progress', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToUserTrophy);
  },

  // Update or create trophy progress
  async updateProgress(userId: string, trophyId: string, progress: number): Promise<UserTrophy> {
    // Check if already exists
    const { data: existing } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', userId)
      .eq('trophy_id', trophyId)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('user_trophies')
        .update({ progress: Math.min(progress, 100) })
        .eq('id', existing.id)
        .select(`*, trophy:trophy_id(*)`)
        .single();

      if (error) throw new Error(error.message);
      return mapRowToUserTrophy(data);
    } else {
      // Create new
      const { data, error } = await supabase
        .from('user_trophies')
        .insert({
          user_id: userId,
          trophy_id: trophyId,
          progress: Math.min(progress, 100),
        })
        .select(`*, trophy:trophy_id(*)`)
        .single();

      if (error) throw new Error(error.message);
      return mapRowToUserTrophy(data);
    }
  },

  // Batch update multiple trophies
  async batchUpdateProgress(
    userId: string,
    updates: { trophyId: string; progress: number }[]
  ): Promise<UserTrophy[]> {
    const results: UserTrophy[] = [];
    for (const update of updates) {
      try {
        const trophy = await this.updateProgress(userId, update.trophyId, update.progress);
        results.push(trophy);
      } catch (e) {
        console.error('[TrophiesAPI] Failed to update trophy:', update.trophyId, e);
      }
    }
    return results;
  },

  // Get user stats
  async getUserStats(userId: string): Promise<{
    totalTrophies: number;
    unlockedCount: number;
    inProgressCount: number;
    totalXP: number;
  }> {
    const { data, error } = await supabase
      .from('user_trophies')
      .select(`
        progress,
        trophy:trophy_id(xp_reward)
      `)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    const trophies = data || [];
    const unlocked = trophies.filter(t => t.progress >= 100);
    const inProgress = trophies.filter(t => t.progress > 0 && t.progress < 100);

    return {
      totalTrophies: trophies.length,
      unlockedCount: unlocked.length,
      inProgressCount: inProgress.length,
      totalXP: (data || []).reduce((sum, t: any) => sum + (t.trophy?.xp_reward || 0), 0),
    };
  },

  // Check and update trophies based on stats
  async checkAndUnlockTrophies(
    userId: string,
    stats: {
      matchesPlayed: number;
      wins: number;
      goalsScored: number;
      assists: number;
      mvpAwards: number;
      tournamentWins: number;
      followers: number;
      isVerified: boolean;
      isPremium: boolean;
      isCaptain: boolean;
      fairPlayScore: number;
      hasTeam?: boolean;
      profileComplete?: boolean;
    }
  ): Promise<UserTrophy[]> {
    // Get all definitions
    const definitions = await this.getAllDefinitions();
    const userTrophies = await this.getUserTrophies(userId);
    const unlockedIds = userTrophies
      .filter(t => t.progress >= 100)
      .map(t => t.trophyId);

    const updates: { trophyId: string; progress: number }[] = [];

    for (const trophy of definitions) {
      if (unlockedIds.includes(trophy.id)) continue;

      let value = 0;
      switch (trophy.category) {
        case 'matches': value = stats.matchesPlayed; break;
        case 'wins': value = stats.wins; break;
        case 'goals': value = stats.goalsScored; break;
        case 'assists': value = stats.assists; break;
        case 'mvp': value = stats.mvpAwards; break;
        case 'tournaments': value = stats.tournamentWins; break;
        case 'social':
          if (trophy.id === 'first-team' && stats.hasTeam) value = 1;
          else value = stats.followers;
          break;
        case 'special':
          if (trophy.id === 'verified' && stats.isVerified) value = 1;
          if (trophy.id === 'premium' && stats.isPremium) value = 1;
          if (trophy.id === 'team-captain' && stats.isCaptain) value = 1;
          if (trophy.id === 'fair-play' && stats.fairPlayScore >= 4.5) value = 1;
          if (trophy.id === 'profile-complete' && stats.profileComplete) value = 1;
          break;
      }

      const progress = Math.min((value / trophy.requirement) * 100, 100);
      if (progress > 0) {
        const existing = userTrophies.find(t => t.trophyId === trophy.id);
        if (!existing || existing.progress < progress) {
          updates.push({ trophyId: trophy.id, progress });
        }
      }
    }

    return this.batchUpdateProgress(userId, updates);
  },
};

// Helpers
function mapRowToDefinition(row: any): TrophyDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    rarity: row.rarity,
    category: row.category,
    requirement: row.requirement,
    xpReward: row.xp_reward,
  };
}

function mapRowToUserTrophy(row: any): UserTrophy {
  return {
    id: row.id,
    userId: row.user_id,
    trophyId: row.trophy_id,
    progress: row.progress,
    unlockedAt: row.unlocked_at ? new Date(row.unlocked_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    trophy: row.trophy ? mapRowToDefinition(row.trophy) : undefined,
  };
}
