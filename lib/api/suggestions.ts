import { supabase } from '@/lib/supabase';
import { mapUserRowToUser, type UserRow } from '@/lib/api/users';
import type { User, Sport, SkillLevel, UserSport } from '@/types';

const LEVEL_ORDER: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export interface PlayerSuggestion extends User {
  matchReasons: string[];
  compatibilityScore: number;
}

export const suggestionsApi = {
  /**
   * Suggest players for a team based on sport, city, and skill level.
   * Excludes current members, pending requesters, and users already in another team.
   */
  async suggestPlayersForTeam(teamId: string, opts: {
    sport: Sport;
    level: SkillLevel;
    city?: string;
    excludeUserIds?: string[];
    limit?: number;
  }): Promise<PlayerSuggestion[]> {
    const { sport, level, city, excludeUserIds = [], limit = 10 } = opts;
    const targetLevel = LEVEL_ORDER[level] ?? 1;

    let query = supabase
      .from('users')
      .select('*')
      .eq('is_profile_visible', true)
      .eq('is_banned', false)
      .neq('id', excludeUserIds[0] || '00000000-0000-0000-0000-000000000000')
      .limit(50) as any;

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as UserRow[];
    const excludeSet = new Set(excludeUserIds);

    const scored: PlayerSuggestion[] = rows
      .filter((row) => !excludeSet.has(row.id))
      .map((row) => {
        const user = mapUserRowToUser(row);
        const reasons: string[] = [];
        let score = 0;

        const userSports: UserSport[] = user.sports || [];
        const hasSport = userSports.some((s: UserSport) => s.sport === sport);
        if (hasSport) {
          score += 40;
          reasons.push(`Pratique ${sport}`);
        }

        const userLevel = userSports.find((s: UserSport) => s.sport === sport)?.level;
        if (userLevel) {
          const levelDiff = Math.abs(LEVEL_ORDER[userLevel as SkillLevel] - targetLevel);
          if (levelDiff === 0) {
            score += 30;
            reasons.push('Même niveau');
          } else if (levelDiff === 1) {
            score += 15;
            reasons.push('Niveau proche');
          }
        }

        if (city && user.city && user.city.toLowerCase() === city.toLowerCase()) {
          score += 20;
          reasons.push('Même ville');
        }

        if (user.isVerified) {
          score += 5;
        }

        if (user.teams && user.teams.length > 0) {
          score -= 25;
        }

        return { ...user, matchReasons: reasons, compatibilityScore: Math.min(100, score) };
      })
      .filter((s) => s.compatibilityScore > 0)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    return scored;
  },

  /**
   * Suggest players for a user to connect with (follow/befriend)
   * based on shared sports, city, and skill level proximity.
   */
  async suggestPlayersForUser(userId: string, opts: {
    userSports?: User['sports'];
    city?: string;
    followingIds?: string[];
    teamMemberIds?: string[];
    limit?: number;
  }): Promise<PlayerSuggestion[]> {
    const { userSports = [], city, followingIds = [], teamMemberIds = [], limit = 8 } = opts;
    const sportSet = new Set(userSports.map((s) => s.sport));
    const excludeSet = new Set([userId, ...followingIds, ...teamMemberIds]);

    let query = supabase
      .from('users')
      .select('*')
      .eq('is_profile_visible', true)
      .eq('is_banned', false)
      .limit(60) as any;

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as UserRow[];

    const scored: PlayerSuggestion[] = rows
      .filter((row) => !excludeSet.has(row.id))
      .map((row) => {
        const user = mapUserRowToUser(row);
        const reasons: string[] = [];
        let score = 0;

        const sharedSports: UserSport[] = (user.sports || []).filter((s: UserSport) => sportSet.has(s.sport));
        if (sharedSports.length > 0) {
          score += 30 * sharedSports.length;
          reasons.push(
            sharedSports.length === 1
              ? `Pratique ${sharedSports[0].sport}`
              : `${sharedSports.length} sports en commun`
          );
        }

        if (city && user.city && user.city.toLowerCase() === city.toLowerCase()) {
          score += 25;
          reasons.push('Même ville');
        }

        const myLevels: SkillLevel[] = userSports.map((s: UserSport) => s.level);
        const theirLevels: SkillLevel[] = sharedSports.map((s: UserSport) => s.level);
        if (myLevels.length > 0 && theirLevels.length > 0) {
          const avgMine = myLevels.reduce((sum: number, l: SkillLevel) => sum + (LEVEL_ORDER[l] ?? 1), 0) / myLevels.length;
          const avgTheirs = theirLevels.reduce((sum: number, l: SkillLevel) => sum + (LEVEL_ORDER[l] ?? 1), 0) / theirLevels.length;
          if (Math.abs(avgMine - avgTheirs) <= 1) {
            score += 15;
            reasons.push('Niveau similaire');
          }
        }

        if (user.isVerified) {
          score += 5;
        }

        if (user.followers > 0) {
          score += Math.min(10, user.followers);
        }

        return { ...user, matchReasons: reasons, compatibilityScore: Math.min(100, score) };
      })
      .filter((s) => s.compatibilityScore > 0)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    return scored;
  },
};
