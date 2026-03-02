import { supabase } from '../supabase';
import { MatchEvent, LiveMatchStats, MatchEventType, MatchPeriod, MatchCommentary } from '@/types/live-scoring';
import { notificationsApi } from './notifications';

class LiveScoringApi {
  // Créer un événement de match
  async createMatchEvent(event: Omit<MatchEvent, 'id' | 'createdAt'>): Promise<MatchEvent> {
    const { data, error } = await supabase
      .from('match_events')
      .insert({
        match_id: event.matchId,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        minute: event.minute,
        period: event.period,
        team_id: event.teamId,
        player_id: event.playerId,
        player_name: event.playerName,
        assist_player_id: event.assistPlayerId,
        assist_player_name: event.assistPlayerName,
        description: event.description,
        metadata: event.metadata,
        created_by: event.createdBy,
      })
      .select()
      .single();

    if (error) throw error;

    const matchEvent: MatchEvent = {
      id: data.id,
      matchId: data.match_id,
      type: data.type,
      timestamp: new Date(data.timestamp),
      minute: data.minute,
      period: data.period,
      teamId: data.team_id,
      playerId: data.player_id,
      playerName: data.player_name,
      assistPlayerId: data.assist_player_id,
      assistPlayerName: data.assist_player_name,
      description: data.description,
      metadata: data.metadata,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
    };

    // Envoyer notification en temps réel
    await this.sendEventNotification(matchEvent);

    return matchEvent;
  }

  // Récupérer tous les événements d'un match
  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('minute', { ascending: true });

    if (error) throw error;

    return data.map(d => ({
      id: d.id,
      matchId: d.match_id,
      type: d.type,
      timestamp: new Date(d.timestamp),
      minute: d.minute,
      period: d.period,
      teamId: d.team_id,
      playerId: d.player_id,
      playerName: d.player_name,
      assistPlayerId: d.assist_player_id,
      assistPlayerName: d.assist_player_name,
      description: d.description,
      metadata: d.metadata,
      createdBy: d.created_by,
      createdAt: new Date(d.created_at),
    }));
  }

  // Supprimer un événement
  async deleteMatchEvent(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }

  // Récupérer les statistiques live d'un match
  async getLiveMatchStats(matchId: string): Promise<LiveMatchStats | null> {
    const { data, error } = await supabase
      .from('live_match_stats')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      matchId: data.match_id,
      homeTeamId: data.home_team_id,
      awayTeamId: data.away_team_id,
      homeScore: data.home_score,
      awayScore: data.away_score,
      currentPeriod: data.current_period,
      currentMinute: data.current_minute,
      isLive: data.is_live,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      stats: data.stats,
      events: data.events || [],
      lastUpdate: new Date(data.last_update),
    };
  }

  // Mettre à jour les statistiques live
  async updateLiveMatchStats(matchId: string, stats: Partial<LiveMatchStats>): Promise<void> {
    const { error } = await supabase
      .from('live_match_stats')
      .upsert({
        match_id: matchId,
        home_team_id: stats.homeTeamId,
        away_team_id: stats.awayTeamId,
        home_score: stats.homeScore,
        away_score: stats.awayScore,
        current_period: stats.currentPeriod,
        current_minute: stats.currentMinute,
        is_live: stats.isLive,
        started_at: stats.startedAt?.toISOString(),
        stats: stats.stats,
        events: stats.events,
        last_update: new Date().toISOString(),
      });

    if (error) throw error;
  }

  // Démarrer un match en live
  async startLiveMatch(matchId: string, homeTeamId: string, awayTeamId: string): Promise<void> {
    await this.updateLiveMatchStats(matchId, {
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore: 0,
      awayScore: 0,
      currentPeriod: 'first_half',
      currentMinute: 0,
      isLive: true,
      startedAt: new Date(),
      stats: {
        home: this.getEmptyTeamStats(),
        away: this.getEmptyTeamStats(),
      },
      events: [],
      lastUpdate: new Date(),
    });

    // Créer événement de début de match
    await this.createMatchEvent({
      matchId,
      type: 'match_start',
      timestamp: new Date(),
      minute: 0,
      period: 'first_half',
      teamId: homeTeamId,
      description: 'Début du match',
      createdBy: 'system',
    });
  }

  // Terminer un match en live
  async endLiveMatch(matchId: string): Promise<void> {
    const stats = await this.getLiveMatchStats(matchId);
    if (!stats) return;

    await this.updateLiveMatchStats(matchId, {
      ...stats,
      isLive: false,
    });

    // Créer événement de fin de match
    await this.createMatchEvent({
      matchId,
      type: 'match_end',
      timestamp: new Date(),
      minute: stats.currentMinute,
      period: stats.currentPeriod,
      teamId: stats.homeTeamId,
      description: `Fin du match - Score final: ${stats.homeScore}-${stats.awayScore}`,
      createdBy: 'system',
    });
  }

  // Ajouter un but
  async addGoal(
    matchId: string,
    teamId: string,
    playerId: string,
    playerName: string,
    minute: number,
    period: MatchPeriod,
    assistPlayerId?: string,
    assistPlayerName?: string,
    metadata?: any
  ): Promise<void> {
    const stats = await this.getLiveMatchStats(matchId);
    if (!stats) throw new Error('Match stats not found');

    // Mettre à jour le score
    const isHomeTeam = teamId === stats.homeTeamId;
    const newHomeScore = isHomeTeam ? stats.homeScore + 1 : stats.homeScore;
    const newAwayScore = !isHomeTeam ? stats.awayScore + 1 : stats.awayScore;

    // Mettre à jour les stats de l'équipe
    const teamStats = isHomeTeam ? stats.stats.home : stats.stats.away;
    teamStats.goals += 1;

    // Mettre à jour les stats du joueur
    let playerStats = teamStats.playerStats.find(p => p.playerId === playerId);
    if (!playerStats) {
      playerStats = {
        playerId,
        playerName,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        passes: 0,
        passesCompleted: 0,
        tackles: 0,
        interceptions: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: minute,
      };
      teamStats.playerStats.push(playerStats);
    }
    playerStats.goals += 1;

    // Si assist, mettre à jour les stats de l'assistant
    if (assistPlayerId) {
      let assistStats = teamStats.playerStats.find(p => p.playerId === assistPlayerId);
      if (!assistStats) {
        assistStats = {
          playerId: assistPlayerId,
          playerName: assistPlayerName || '',
          goals: 0,
          assists: 0,
          shots: 0,
          shotsOnTarget: 0,
          passes: 0,
          passesCompleted: 0,
          tackles: 0,
          interceptions: 0,
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          minutesPlayed: minute,
        };
        teamStats.playerStats.push(assistStats);
      }
      assistStats.assists += 1;
    }

    await this.updateLiveMatchStats(matchId, {
      ...stats,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      currentMinute: minute,
    });

    // Créer l'événement
    await this.createMatchEvent({
      matchId,
      type: 'goal',
      timestamp: new Date(),
      minute,
      period,
      teamId,
      playerId,
      playerName,
      assistPlayerId,
      assistPlayerName,
      description: assistPlayerId 
        ? `⚽ But de ${playerName} (passe de ${assistPlayerName})` 
        : `⚽ But de ${playerName}`,
      metadata,
      createdBy: 'system',
    });
  }

  // Ajouter un carton
  async addCard(
    matchId: string,
    teamId: string,
    playerId: string,
    playerName: string,
    minute: number,
    period: MatchPeriod,
    cardType: 'yellow_card' | 'red_card',
    reason?: string
  ): Promise<void> {
    const stats = await this.getLiveMatchStats(matchId);
    if (!stats) throw new Error('Match stats not found');

    const isHomeTeam = teamId === stats.homeTeamId;
    const teamStats = isHomeTeam ? stats.stats.home : stats.stats.away;

    if (cardType === 'yellow_card') {
      teamStats.yellowCards += 1;
    } else {
      teamStats.redCards += 1;
    }

    // Mettre à jour les stats du joueur
    let playerStats = teamStats.playerStats.find(p => p.playerId === playerId);
    if (!playerStats) {
      playerStats = {
        playerId,
        playerName,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        passes: 0,
        passesCompleted: 0,
        tackles: 0,
        interceptions: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: minute,
      };
      teamStats.playerStats.push(playerStats);
    }

    if (cardType === 'yellow_card') {
      playerStats.yellowCards += 1;
    } else {
      playerStats.redCards += 1;
    }

    await this.updateLiveMatchStats(matchId, {
      ...stats,
      currentMinute: minute,
    });

    const cardEmoji = cardType === 'yellow_card' ? '🟨' : '🟥';
    await this.createMatchEvent({
      matchId,
      type: cardType,
      timestamp: new Date(),
      minute,
      period,
      teamId,
      playerId,
      playerName,
      description: `${cardEmoji} Carton ${cardType === 'yellow_card' ? 'jaune' : 'rouge'} pour ${playerName}${reason ? ` - ${reason}` : ''}`,
      metadata: { cardReason: reason },
      createdBy: 'system',
    });
  }

  // S'abonner aux événements en temps réel
  subscribeToMatchEvents(matchId: string, callback: (event: MatchEvent) => void) {
    const channel = supabase
      .channel(`match_events:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const data = payload.new;
          const event: MatchEvent = {
            id: data.id,
            matchId: data.match_id,
            type: data.type,
            timestamp: new Date(data.timestamp),
            minute: data.minute,
            period: data.period,
            teamId: data.team_id,
            playerId: data.player_id,
            playerName: data.player_name,
            assistPlayerId: data.assist_player_id,
            assistPlayerName: data.assist_player_name,
            description: data.description,
            metadata: data.metadata,
            createdBy: data.created_by,
            createdAt: new Date(data.created_at),
          };
          callback(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Envoyer une notification pour un événement
  private async sendEventNotification(event: MatchEvent): Promise<void> {
    if (!['goal', 'red_card', 'match_start', 'match_end'].includes(event.type)) {
      return; // Ne notifier que pour les événements importants
    }

    const { data: match } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('id', event.matchId)
      .single();

    if (!match) return;

    const homeTeam = match.home_team?.name || 'Équipe domicile';
    const awayTeam = match.away_team?.name || 'Équipe extérieur';

    let title = '';
    let message = '';

    switch (event.type) {
      case 'goal':
        title = '⚽ But !';
        message = event.description || `But marqué dans ${homeTeam} vs ${awayTeam}`;
        break;
      case 'red_card':
        title = '🟥 Carton rouge !';
        message = event.description || `Carton rouge dans ${homeTeam} vs ${awayTeam}`;
        break;
      case 'match_start':
        title = '🏁 Match commencé';
        message = `${homeTeam} vs ${awayTeam} - Le match a commencé !`;
        break;
      case 'match_end':
        title = '🏁 Match terminé';
        message = event.description || `${homeTeam} vs ${awayTeam} - Match terminé`;
        break;
    }

    // Récupérer les joueurs inscrits au match pour envoyer les notifications
    const { data: registeredPlayers } = await supabase
      .from('match_players')
      .select('user_id')
      .eq('match_id', event.matchId);

    if (registeredPlayers) {
      for (const player of registeredPlayers) {
        await notificationsApi.create({
          userId: player.user_id,
          type: 'match',
          title,
          message,
          data: {
            route: `/match/${event.matchId}`,
            matchId: event.matchId,
            eventType: event.type,
          },
        });
      }
    }
  }

  private getEmptyTeamStats() {
    return {
      goals: 0,
      shots: 0,
      shotsOnTarget: 0,
      possession: 50,
      passes: 0,
      passesCompleted: 0,
      fouls: 0,
      corners: 0,
      offsides: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      playerStats: [],
    };
  }
}

export const liveScoringApi = new LiveScoringApi();
