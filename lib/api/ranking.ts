import { supabase } from '../supabase';
import { 
  PlayerRanking, 
  TeamRanking, 
  EloCalculation, 
  RankingUpdate,
  Achievement,
  Badge,
  Leaderboard,
  RankingCategory,
  RankingPeriod,
  AchievementType,
  BadgeType
} from '@/types/ranking';
import { Sport } from '@/types';
import { notificationsApi } from './notifications';

class RankingApi {
  // Constantes ELO
  private readonly INITIAL_ELO = 1200;
  private readonly K_FACTOR_BASE = 32;
  private readonly K_FACTOR_HIGH_ELO = 24; // Pour joueurs > 2000 ELO
  private readonly K_FACTOR_LOW_MATCHES = 40; // Pour joueurs < 30 matchs

  // ========== CALCULS ELO ==========

  /**
   * Calculer le changement ELO après un match
   */
  calculateElo(
    playerElo: number,
    opponentElo: number,
    result: 'win' | 'loss' | 'draw',
    matchesPlayed: number
  ): EloCalculation {
    // Déterminer le K-factor basé sur l'ELO et l'expérience
    let kFactor = this.K_FACTOR_BASE;
    if (matchesPlayed < 30) {
      kFactor = this.K_FACTOR_LOW_MATCHES;
    } else if (playerElo > 2000) {
      kFactor = this.K_FACTOR_HIGH_ELO;
    }

    // Calculer le score attendu (formule ELO)
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));

    // Score réel
    const actualScore = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;

    // Changement ELO
    const eloChange = Math.round(kFactor * (actualScore - expectedScore));

    // Nouveau ELO
    const newElo = Math.max(0, playerElo + eloChange);

    return {
      playerElo,
      opponentElo,
      result,
      kFactor,
      expectedScore,
      actualScore,
      eloChange,
      newElo,
    };
  }

  /**
   * Calculer l'ELO moyen d'une équipe
   */
  async calculateTeamAverageElo(teamId: string): Promise<number> {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    if (!members || members.length === 0) return this.INITIAL_ELO;

    const rankings = await Promise.all(
      members.map(m => this.getPlayerRanking(m.user_id))
    );

    const totalElo = rankings.reduce((sum, r) => sum + (r?.eloRating || this.INITIAL_ELO), 0);
    return Math.round(totalElo / rankings.length);
  }

  // ========== PLAYER RANKING ==========

  /**
   * Récupérer le classement d'un joueur
   */
  async getPlayerRanking(userId: string): Promise<PlayerRanking | null> {
    const { data, error } = await supabase
      .from('player_rankings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Créer un nouveau ranking si n'existe pas
        return await this.createPlayerRanking(userId);
      }
      throw error;
    }

    return this.mapPlayerRanking(data);
  }

  /**
   * Créer un nouveau classement pour un joueur
   */
  private async createPlayerRanking(userId: string): Promise<PlayerRanking> {
    const { data: user } = await supabase
      .from('users')
      .select('username, full_name, avatar, city')
      .eq('id', userId)
      .single();

    const newRanking = {
      user_id: userId,
      elo_rating: this.INITIAL_ELO,
      previous_elo_rating: this.INITIAL_ELO,
      elo_change: 0,
      rank: 0,
      previous_rank: 0,
      rank_change: 0,
      stats: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        totalGoals: 0,
        totalAssists: 0,
        averageRating: 0,
        currentWinStreak: 0,
        longestWinStreak: 0,
        currentLossStreak: 0,
        rankedMatches: 0,
        rankedWins: 0,
        rankedLosses: 0,
        recentForm: [],
        recentPerformance: 50,
      },
      sport_rankings: {},
      achievements: [],
      badges: [],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('player_rankings')
      .insert(newRanking)
      .select()
      .single();

    if (error) throw error;

    return {
      userId,
      username: user?.username || '',
      fullName: user?.full_name,
      avatar: user?.avatar,
      city: user?.city,
      eloRating: this.INITIAL_ELO,
      previousEloRating: this.INITIAL_ELO,
      eloChange: 0,
      rank: 0,
      previousRank: 0,
      rankChange: 0,
      stats: newRanking.stats,
      sportRankings: {} as Record<Sport, SportRanking>,
      achievements: [],
      badges: [],
      updatedAt: new Date(),
    };
  }

  /**
   * Mettre à jour le classement après un match
   */
  async updatePlayerRankingAfterMatch(
    userId: string,
    matchId: string,
    result: 'win' | 'loss' | 'draw',
    opponentElo: number,
    sport: Sport,
    goals: number = 0,
    assists: number = 0,
    rating: number = 0
  ): Promise<RankingUpdate> {
    const ranking = await this.getPlayerRanking(userId);
    if (!ranking) throw new Error('Ranking not found');

    // Calculer nouveau ELO
    const eloCalc = this.calculateElo(
      ranking.eloRating,
      opponentElo,
      result,
      ranking.stats.totalMatches
    );

    // Mettre à jour les statistiques
    const newStats = { ...ranking.stats };
    newStats.totalMatches += 1;
    if (result === 'win') newStats.wins += 1;
    else if (result === 'loss') newStats.losses += 1;
    else newStats.draws += 1;

    newStats.winRate = (newStats.wins / newStats.totalMatches) * 100;
    newStats.totalGoals += goals;
    newStats.totalAssists += assists;

    // Mettre à jour les streaks
    if (result === 'win') {
      newStats.currentWinStreak += 1;
      newStats.currentLossStreak = 0;
      if (newStats.currentWinStreak > newStats.longestWinStreak) {
        newStats.longestWinStreak = newStats.currentWinStreak;
      }
    } else if (result === 'loss') {
      newStats.currentLossStreak += 1;
      newStats.currentWinStreak = 0;
    } else {
      newStats.currentWinStreak = 0;
      newStats.currentLossStreak = 0;
    }

    // Mettre à jour la forme récente
    newStats.recentForm = [
      result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D',
      ...newStats.recentForm.slice(0, 9)
    ];

    // Calculer performance récente
    const recentWins = newStats.recentForm.filter(f => f === 'W').length;
    newStats.recentPerformance = (recentWins / Math.min(newStats.recentForm.length, 10)) * 100;

    // Mettre à jour rating moyen
    if (rating > 0) {
      const totalRating = (ranking.stats.averageRating * (newStats.totalMatches - 1)) + rating;
      newStats.averageRating = totalRating / newStats.totalMatches;
    }

    // Mettre à jour le classement par sport
    const sportRankings = { ...ranking.sportRankings };
    if (!sportRankings[sport]) {
      sportRankings[sport] = {
        sport,
        eloRating: this.INITIAL_ELO,
        rank: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        goals: 0,
        assists: 0,
        averageRating: 0,
      };
    }

    const sportRank = sportRankings[sport];
    sportRank.matches += 1;
    if (result === 'win') sportRank.wins += 1;
    else if (result === 'loss') sportRank.losses += 1;
    else sportRank.draws += 1;
    sportRank.winRate = (sportRank.wins / sportRank.matches) * 100;
    sportRank.goals += goals;
    sportRank.assists += assists;
    sportRank.eloRating = eloCalc.newElo;

    // Sauvegarder dans la base de données
    const { error } = await supabase
      .from('player_rankings')
      .update({
        elo_rating: eloCalc.newElo,
        previous_elo_rating: ranking.eloRating,
        elo_change: eloCalc.eloChange,
        stats: newStats,
        sport_rankings: sportRankings,
        last_match_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    // Recalculer les rangs
    await this.recalculateRanks();

    // Récupérer le nouveau rang
    const updatedRanking = await this.getPlayerRanking(userId);
    if (!updatedRanking) throw new Error('Failed to get updated ranking');

    // Vérifier les achievements
    const newAchievements = await this.checkAchievements(userId, updatedRanking);
    const newBadges = await this.checkBadges(userId, updatedRanking);

    // Créer l'historique
    await this.createRankingHistory(userId, updatedRanking);

    const rankingUpdate: RankingUpdate = {
      userId,
      matchId,
      oldElo: ranking.eloRating,
      newElo: eloCalc.newElo,
      eloChange: eloCalc.eloChange,
      oldRank: ranking.rank,
      newRank: updatedRanking.rank,
      rankChange: updatedRanking.rank - ranking.rank,
      achievementsUnlocked: newAchievements,
      badgesEarned: newBadges,
      timestamp: new Date(),
    };

    // Envoyer notification si changement significatif
    if (Math.abs(eloCalc.eloChange) >= 20 || newAchievements.length > 0 || newBadges.length > 0) {
      await this.sendRankingNotification(userId, rankingUpdate);
    }

    return rankingUpdate;
  }

  /**
   * Recalculer tous les rangs
   */
  private async recalculateRanks(): Promise<void> {
    const { data: rankings } = await supabase
      .from('player_rankings')
      .select('user_id, elo_rating, rank')
      .order('elo_rating', { ascending: false });

    if (!rankings) return;

    // Mettre à jour les rangs
    for (let i = 0; i < rankings.length; i++) {
      const newRank = i + 1;
      if (rankings[i].rank !== newRank) {
        await supabase
          .from('player_rankings')
          .update({
            previous_rank: rankings[i].rank,
            rank: newRank,
            rank_change: rankings[i].rank - newRank,
          })
          .eq('user_id', rankings[i].user_id);
      }
    }
  }

  // ========== LEADERBOARDS ==========

  /**
   * Récupérer le leaderboard global
   */
  async getGlobalLeaderboard(limit: number = 100): Promise<Leaderboard> {
    const { data } = await supabase
      .from('player_rankings')
      .select(`
        *,
        user:users(username, full_name, avatar, city)
      `)
      .order('elo_rating', { ascending: false })
      .limit(limit);

    const players = (data || []).map(d => this.mapPlayerRanking(d));

    return {
      category: 'global',
      period: 'all_time',
      players,
      totalPlayers: players.length,
      lastUpdate: new Date(),
    };
  }

  /**
   * Récupérer le leaderboard par sport
   */
  async getSportLeaderboard(sport: Sport, limit: number = 100): Promise<Leaderboard> {
    const { data } = await supabase
      .from('player_rankings')
      .select(`
        *,
        user:users(username, full_name, avatar, city)
      `)
      .order('elo_rating', { ascending: false })
      .limit(limit);

    if (!data) {
      return {
        category: 'sport',
        period: 'all_time',
        sport,
        players: [],
        totalPlayers: 0,
        lastUpdate: new Date(),
      };
    }

    // Filtrer et trier par ELO du sport
    const players = data
      .map(d => this.mapPlayerRanking(d))
      .filter(p => p.sportRankings[sport])
      .sort((a, b) => (b.sportRankings[sport]?.eloRating || 0) - (a.sportRankings[sport]?.eloRating || 0))
      .slice(0, limit);

    return {
      category: 'sport',
      period: 'all_time',
      sport,
      players,
      totalPlayers: players.length,
      lastUpdate: new Date(),
    };
  }

  /**
   * Récupérer le leaderboard par ville
   */
  async getCityLeaderboard(city: string, limit: number = 100): Promise<Leaderboard> {
    const { data } = await supabase
      .from('player_rankings')
      .select(`
        *,
        user:users!inner(username, full_name, avatar, city)
      `)
      .eq('user.city', city)
      .order('elo_rating', { ascending: false })
      .limit(limit);

    const players = (data || []).map(d => this.mapPlayerRanking(d));

    return {
      category: 'city',
      period: 'all_time',
      city,
      players,
      totalPlayers: players.length,
      lastUpdate: new Date(),
    };
  }

  // ========== ACHIEVEMENTS & BADGES ==========

  /**
   * Vérifier et débloquer les achievements
   */
  private async checkAchievements(userId: string, ranking: PlayerRanking): Promise<Achievement[]> {
    const newAchievements: Achievement[] = [];
    const existingAchievements = ranking.achievements.map(a => a.type);

    const achievementChecks: Array<{
      type: AchievementType;
      condition: boolean;
      name: string;
      description: string;
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
    }> = [
      {
        type: 'first_win',
        condition: ranking.stats.wins === 1 && !existingAchievements.includes('first_win'),
        name: 'Première victoire',
        description: 'Remportez votre premier match',
        rarity: 'common',
      },
      {
        type: 'win_streak_5',
        condition: ranking.stats.currentWinStreak === 5 && !existingAchievements.includes('win_streak_5'),
        name: 'Série de 5',
        description: 'Gagnez 5 matchs d\'affilée',
        rarity: 'rare',
      },
      {
        type: 'win_streak_10',
        condition: ranking.stats.currentWinStreak === 10 && !existingAchievements.includes('win_streak_10'),
        name: 'Série de 10',
        description: 'Gagnez 10 matchs d\'affilée',
        rarity: 'epic',
      },
      {
        type: 'goals_50',
        condition: ranking.stats.totalGoals >= 50 && !existingAchievements.includes('goals_50'),
        name: 'Buteur confirmé',
        description: 'Marquez 50 buts',
        rarity: 'rare',
      },
      {
        type: 'goals_100',
        condition: ranking.stats.totalGoals >= 100 && !existingAchievements.includes('goals_100'),
        name: 'Légende du but',
        description: 'Marquez 100 buts',
        rarity: 'epic',
      },
      {
        type: 'elo_1500',
        condition: ranking.eloRating >= 1500 && !existingAchievements.includes('elo_1500'),
        name: 'Joueur confirmé',
        description: 'Atteignez 1500 ELO',
        rarity: 'rare',
      },
      {
        type: 'elo_2000',
        condition: ranking.eloRating >= 2000 && !existingAchievements.includes('elo_2000'),
        name: 'Élite',
        description: 'Atteignez 2000 ELO',
        rarity: 'legendary',
      },
      {
        type: 'top_10_global',
        condition: ranking.rank <= 10 && !existingAchievements.includes('top_10_global'),
        name: 'Top 10 mondial',
        description: 'Entrez dans le top 10 global',
        rarity: 'legendary',
      },
    ];

    for (const check of achievementChecks) {
      if (check.condition) {
        const achievement: Achievement = {
          id: `${userId}_${check.type}_${Date.now()}`,
          type: check.type,
          name: check.name,
          description: check.description,
          icon: this.getAchievementIcon(check.type),
          rarity: check.rarity,
          unlockedAt: new Date(),
        };
        newAchievements.push(achievement);
      }
    }

    if (newAchievements.length > 0) {
      const allAchievements = [...ranking.achievements, ...newAchievements];
      await supabase
        .from('player_rankings')
        .update({ achievements: allAchievements })
        .eq('user_id', userId);
    }

    return newAchievements;
  }

  /**
   * Vérifier et attribuer les badges
   */
  private async checkBadges(userId: string, ranking: PlayerRanking): Promise<Badge[]> {
    const newBadges: Badge[] = [];
    const existingBadges = ranking.badges.map(b => b.type);

    const badgeChecks: Array<{
      type: BadgeType;
      condition: boolean;
      name: string;
      color: string;
    }> = [
      {
        type: 'top_1_global',
        condition: ranking.rank === 1 && !existingBadges.includes('top_1_global'),
        name: 'Champion du monde',
        color: '#FFD700',
      },
      {
        type: 'top_10_global',
        condition: ranking.rank <= 10 && !existingBadges.includes('top_10_global'),
        name: 'Top 10 mondial',
        color: '#C0C0C0',
      },
      {
        type: 'elite_player',
        condition: ranking.eloRating >= 2000 && !existingBadges.includes('elite_player'),
        name: 'Joueur élite',
        color: '#9333EA',
      },
      {
        type: 'goal_machine',
        condition: ranking.stats.totalGoals >= 100 && !existingBadges.includes('goal_machine'),
        name: 'Machine à buts',
        color: '#FF6B00',
      },
    ];

    for (const check of badgeChecks) {
      if (check.condition) {
        const badge: Badge = {
          id: `${userId}_${check.type}_${Date.now()}`,
          type: check.type,
          name: check.name,
          icon: this.getBadgeIcon(check.type),
          color: check.color,
          earnedAt: new Date(),
        };
        newBadges.push(badge);
      }
    }

    if (newBadges.length > 0) {
      const allBadges = [...ranking.badges, ...newBadges];
      await supabase
        .from('player_rankings')
        .update({ badges: allBadges })
        .eq('user_id', userId);
    }

    return newBadges;
  }

  // ========== HELPERS ==========

  private mapPlayerRanking(data: any): PlayerRanking {
    return {
      userId: data.user_id,
      username: data.user?.username || '',
      fullName: data.user?.full_name,
      avatar: data.user?.avatar,
      city: data.user?.city,
      eloRating: data.elo_rating,
      previousEloRating: data.previous_elo_rating,
      eloChange: data.elo_change,
      rank: data.rank,
      previousRank: data.previous_rank,
      rankChange: data.rank_change,
      stats: data.stats,
      sportRankings: data.sport_rankings || {},
      achievements: data.achievements || [],
      badges: data.badges || [],
      lastMatchDate: data.last_match_date ? new Date(data.last_match_date) : undefined,
      updatedAt: new Date(data.updated_at),
    };
  }

  private async createRankingHistory(userId: string, ranking: PlayerRanking): Promise<void> {
    await supabase.from('ranking_history').insert({
      user_id: userId,
      date: new Date().toISOString(),
      elo_rating: ranking.eloRating,
      rank: ranking.rank,
      matches_played: ranking.stats.totalMatches,
    });
  }

  private async sendRankingNotification(userId: string, update: RankingUpdate): Promise<void> {
    let message = '';
    
    if (update.eloChange > 0) {
      message = `🎉 +${update.eloChange} ELO ! Nouveau classement: ${update.newElo}`;
    } else {
      message = `${update.eloChange} ELO. Classement: ${update.newElo}`;
    }

    if (update.achievementsUnlocked.length > 0) {
      message += `\n🏆 ${update.achievementsUnlocked.length} achievement(s) débloqué(s) !`;
    }

    await notificationsApi.send(userId, {
      type: 'match',
      title: 'Classement mis à jour',
      message,
      data: { route: '/rankings' },
    });
  }

  private getAchievementIcon(type: AchievementType): string {
    const icons: Record<AchievementType, string> = {
      first_win: '🎯',
      win_streak_5: '🔥',
      win_streak_10: '⚡',
      win_streak_20: '💫',
      goals_10: '⚽',
      goals_50: '🎯',
      goals_100: '👑',
      assists_10: '🎁',
      assists_50: '🌟',
      matches_10: '🏃',
      matches_50: '💪',
      matches_100: '🦾',
      top_10_global: '🏆',
      top_10_city: '🏅',
      top_10_sport: '🥇',
      elo_1500: '📈',
      elo_1800: '🚀',
      elo_2000: '👑',
      perfect_month: '💯',
      comeback_king: '🔄',
      clean_sheet_master: '🛡️',
      hat_trick: '🎩',
      mvp_10: '⭐',
      tournament_winner: '🏆',
    };
    return icons[type] || '🏅';
  }

  private getBadgeIcon(type: BadgeType): string {
    const icons: Record<BadgeType, string> = {
      top_1_global: '👑',
      top_10_global: '🏆',
      top_100_global: '🥇',
      top_1_city: '🌟',
      top_10_city: '⭐',
      top_1_sport: '🏅',
      elite_player: '💎',
      rising_star: '🌠',
      veteran: '🎖️',
      goal_machine: '⚽',
      playmaker: '🎯',
      defensive_wall: '🛡️',
      consistent_performer: '📊',
    };
    return icons[type] || '🏅';
  }
}

export const rankingApi = new RankingApi();
