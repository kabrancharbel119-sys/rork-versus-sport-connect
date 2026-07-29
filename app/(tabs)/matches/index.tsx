import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Plus, Swords, Calendar, MapPin, Users, Filter, Clock, Trophy, UserPlus, X, Check, History, ChevronRight, MapPinned, Crown } from 'lucide-react-native';
import { Colors, SPACING, CARD_RADIUS, CARD_INNER_PAD, OUTER_PAD, SECTION_GAP, CARD_GAP, cardGlow } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useUsers } from '@/contexts/UsersContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { NetworkError } from '@/components/NetworkError';
import { sportLabels, levelLabels, ALL_SPORTS, ambianceLabels } from '@/mocks/data';
import { Sport, SkillLevel, PlayStyle } from '@/types';

type TabType = 'all' | 'my-matches' | 'need-players' | 'tournaments' | 'history';

type MatchTypeFilter = 'all' | 'friendly' | 'ranked';

interface Filters {
  sport: Sport | 'all';
  level: SkillLevel | 'all';
  ambiance: PlayStyle | 'all';
  maxDistance: number;
  matchType: MatchTypeFilter;
}

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { matches, getUpcomingMatches, getUserMatches, getCompletedUserMatches, getMatchesNeedingPlayers, refetchMatches, isLoading, isError } = useMatches();
  const { getOpenTournaments, refetchTournaments } = useTournaments();
  const { getUserByIdSync } = useUsers();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Filters>({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' });

  const allMatches = useMemo(() => getUpcomingMatches() ?? [], [getUpcomingMatches]);
  const myMatches = useMemo(() => user ? (getUserMatches(user.id) ?? []) : [], [getUserMatches, user]);
  const completedMatches = useMemo(() => user ? (getCompletedUserMatches(user.id) ?? []) : [], [getCompletedUserMatches, user]);
  const matchesNeedingPlayers = useMemo(() => getMatchesNeedingPlayers(user?.location, filters.maxDistance) ?? [], [getMatchesNeedingPlayers, user?.location, filters.maxDistance]);
  const openTournaments = useMemo(() => getOpenTournaments() ?? [], [getOpenTournaments]);

  const filteredMatches = useMemo(() => {
    let result = activeTab === 'all' ? allMatches : activeTab === 'my-matches' ? myMatches : activeTab === 'need-players' ? matchesNeedingPlayers : activeTab === 'history' ? completedMatches : [];
    if (activeTab !== 'history') {
      if (filters.sport !== 'all') result = result.filter(m => m.sport === filters.sport);
      if (filters.level !== 'all') result = result.filter(m => m.level === filters.level);
      if (filters.ambiance !== 'all') result = result.filter(m => m.ambiance === filters.ambiance);
      if (filters.matchType === 'ranked') result = result.filter(m => m.type === 'ranked');
      if (filters.matchType === 'friendly') result = result.filter(m => m.type === 'friendly');
    }
    return result;
  }, [activeTab, allMatches, myMatches, completedMatches, matchesNeedingPlayers, filters]);


  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchMatches(), refetchTournaments()]);
    } finally {
      setRefreshing(false);
    }
  };
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return '-';
    }
  };
  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };
  const getStatusColor = (status: string) => ({ venue_pending: Colors.status.warning, open: Colors.status.success, confirmed: Colors.primary.blue, in_progress: Colors.primary.orange }[status] || Colors.text.muted);
  const getStatusLabel = (status: string) => ({ venue_pending: 'Terrain en attente', open: 'Ouvert', confirmed: 'Confirmé', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' }[status] || status);

  const hasActiveFilters = filters.sport !== 'all' || filters.level !== 'all' || filters.ambiance !== 'all' || filters.matchType !== 'all';

  const matchesList = matches ?? [];
  const renderMatchCard = (match: typeof matchesList[0], showNeedsPlayers = false) => {
    const creator = getUserByIdSync(match.createdBy);
    const isRanked = match.type === 'ranked';
    const isTournament = match.type === 'tournament';
    const playerCount = (match.registeredPlayers ?? []).length;
    const playerPct = match.maxPlayers > 0 ? playerCount / match.maxPlayers : 0;
    const sportEmoji: Record<string, string> = { football: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', padel: '🏓', handball: '🤾', rugby: '🏉', running: '🏃', cycling: '🚴', swimming: '🏊' };

    return (
      <TouchableOpacity
        key={match.id}
        activeOpacity={0.85}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.matchCard}
      >
        {/* Top accent bar */}
        <View style={[styles.matchAccentBar, { backgroundColor: isRanked ? Colors.primary.orange : isTournament ? '#8B5CF6' : Colors.primary.blue }]} />

        <View style={styles.matchCardBody}>
          {/* Header row */}
          <View style={styles.matchHeaderRow}>
            <View style={styles.matchHeaderLeft}>
              <View style={[styles.matchTypePill, { backgroundColor: isRanked ? 'rgba(249,115,22,0.15)' : isTournament ? 'rgba(139,92,246,0.15)' : 'rgba(21,101,192,0.15)' }]}>
                {isRanked && <Crown size={11} color={Colors.primary.orange} strokeWidth={2.5} />}
                {!isRanked && !isTournament && <Swords size={11} color={Colors.primary.blue} strokeWidth={2.5} />}
                {isTournament && <Trophy size={11} color="#8B5CF6" strokeWidth={2.5} />}
                <Text style={[styles.matchTypePillText, { color: isRanked ? Colors.primary.orange : isTournament ? '#8B5CF6' : Colors.primary.blue }]}>
                  {match.type === 'friendly' ? 'Amical' : isRanked ? 'Classé' : 'Tournoi'}
                </Text>
              </View>
              <View style={[styles.matchStatusPill, { backgroundColor: `${getStatusColor(match.status)}20` }]}>
                <View style={[styles.matchStatusDot, { backgroundColor: getStatusColor(match.status) }]} />
                <Text style={[styles.matchStatusText, { color: getStatusColor(match.status) }]}>{getStatusLabel(match.status)}</Text>
              </View>
            </View>
            {showNeedsPlayers && match.needsPlayers && (
              <View style={styles.needsPlayersBadge}>
                <UserPlus size={11} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.needsPlayersText}>Cherche joueurs</Text>
              </View>
            )}
          </View>

          {/* Title + sport emoji */}
          <View style={styles.matchTitleRow}>
            <View style={styles.matchTitleLeft}>
              <Text style={styles.matchEmoji}>{sportEmoji[match.sport] ?? '🏆'}</Text>
              <View style={styles.matchTitleInfo}>
                <Text style={styles.matchTitle}>{(sportLabels as Record<string, string>)[match.sport] || match.sport} • {match.format}</Text>
                <Text style={styles.matchLevel}>{levelLabels[match.level]} • {ambianceLabels[match.ambiance]}</Text>
              </View>
            </View>
          </View>

          {/* Info pills */}
          <View style={styles.matchInfoPills}>
            <View style={styles.matchInfoPill}>
              <Calendar size={12} color={Colors.text.muted} strokeWidth={2} />
              <Text style={styles.matchInfoPillText}>{formatDate(match.dateTime)}</Text>
            </View>
            <View style={styles.matchInfoPill}>
              <Clock size={12} color={Colors.text.muted} strokeWidth={2} />
              <Text style={styles.matchInfoPillText}>{formatTime(match.dateTime)}</Text>
            </View>
            {match.venue && (
              <View style={styles.matchInfoPill}>
                <MapPin size={12} color={Colors.text.muted} strokeWidth={2} />
                <Text style={styles.matchInfoPillText} numberOfLines={1}>{match.venue.name}</Text>
              </View>
            )}
          </View>

          {/* Venue pending banner */}
          {match.status === 'venue_pending' && (
            <View style={styles.venuePendingBanner}>
              <Clock size={12} color={Colors.status.warning} strokeWidth={2} />
              <Text style={styles.venuePendingText}>En attente de confirmation du terrain</Text>
            </View>
          )}

          {/* Players progress */}
          <View style={styles.matchProgressSection}>
            <View style={styles.matchProgressHeader}>
              <View style={styles.matchProgressLeft}>
                <Users size={12} color={Colors.primary.blue} strokeWidth={2.5} />
                <Text style={styles.matchProgressLabel}>{playerCount}/{match.maxPlayers} joueurs</Text>
              </View>
              {match.prize && !isRanked && (
                <View style={styles.matchPrizePill}>
                  <Text style={styles.matchPrizeText}>{match.prize.toLocaleString()} FCFA</Text>
                </View>
              )}
            </View>
            <View style={styles.matchProgressBg}>
              <View style={[styles.matchProgressFill, { width: `${Math.min(playerPct * 100, 100)}%`, backgroundColor: isRanked ? Colors.primary.orange : Colors.primary.blue }]} />
            </View>
          </View>

          {/* Footer */}
          {(creator || isRanked) && (
            <View style={styles.matchFooterRow}>
              {creator && <Text style={styles.organizerText}>par {creator.fullName || creator.username}</Text>}
              {isRanked && <Text style={styles.rankedTag}>Compte pour le classement</Text>}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTournamentCard = (tournament: typeof openTournaments[0]) => (
    <TouchableOpacity key={tournament.id} activeOpacity={0.85} onPress={() => router.push(`/tournament/${tournament.id}`)} style={styles.tournamentCardWrap}>
      <LinearGradient colors={['#7C3AED', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tournamentCard}>
        <View style={styles.tournamentHeaderRow}>
          <View style={styles.tournamentIconWrap}><Trophy size={18} color="#FFFFFF" strokeWidth={2.5} /></View>
          <View style={styles.tournamentPrizeWrap}><Crown size={14} color="#FBBF24" strokeWidth={2} /><Text style={styles.tournamentPrize}>{tournament.prizePool.toLocaleString()} FCFA</Text></View>
        </View>
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        <Text style={styles.tournamentInfo}>{sportLabels[tournament.sport]} • {tournament.format} • {levelLabels[tournament.level]}</Text>
        <View style={styles.tournamentMetaRow}>
          <View style={styles.tournamentMetaPill}><Calendar size={12} color="rgba(255,255,255,0.8)" /><Text style={styles.tournamentMetaText}>{formatDate(tournament.startDate)}</Text></View>
          <View style={styles.tournamentMetaPill}><Users size={12} color="rgba(255,255,255,0.8)" /><Text style={styles.tournamentMetaText}>{(tournament.registeredTeams ?? []).length}/{tournament.maxTeams} éq.</Text></View>
        </View>
        <View style={styles.tournamentFooterRow}>
          <View style={styles.tournamentFeePill}><Text style={styles.tournamentFeeText}>{tournament.entryFee.toLocaleString()} FCFA</Text></View>
          <View style={styles.teamOnlyBadge}><Users size={11} color="#FFFFFF" strokeWidth={2} /><Text style={styles.teamOnlyText}>Équipes</Text></View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderEmptyState = (icon: React.ReactNode, title: string, text: string, action?: { title: string; onPress: () => void }) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action && <Button title={action.title} onPress={action.onPress} variant="orange" style={styles.emptyButton} />}
    </View>
  );

  const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      {active && <Check size={14} color="#FFFFFF" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#070B12', '#0A0E16', Colors.background.dark, '#0B1018']} locations={[0, 0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Matchs</Text>
            <Text style={styles.headerSubtitle}>{filteredMatches.length} match{filteredMatches.length > 1 ? 's' : ''}{activeTab === 'all' ? ' à venir' : activeTab === 'history' ? ' joués' : ''}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]} onPress={() => setShowFilterModal(true)} activeOpacity={0.7}>
              <Filter size={20} color={hasActiveFilters ? '#FFFFFF' : Colors.text.primary} strokeWidth={2} />
              {hasActiveFilters && <View style={styles.filterDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create-match')} activeOpacity={0.7}>
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Segmented tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
          {([['all', 'Tous'], ['my-matches', 'Mes matchs'], ['need-players', 'Cherche joueurs'], ['history', 'Historique'], ['tournaments', 'Tournois']] as const).map(([key, label]) => {
            const active = activeTab === key;
            const activeColor = key === 'tournaments' ? '#8B5CF6' : key === 'need-players' ? '#10B981' : key === 'history' ? '#64748B' : key === 'my-matches' ? Colors.primary.blue : Colors.primary.orange;
            const count = key === 'all' ? allMatches.length : key === 'my-matches' ? myMatches.length : key === 'need-players' ? matchesNeedingPlayers.length : key === 'history' ? completedMatches.length : openTournaments.length;
            return (
              <TouchableOpacity key={key} style={[styles.tab, active && { backgroundColor: activeColor }]} onPress={() => setActiveTab(key)} activeOpacity={0.7}>
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{label}</Text>
                {count > 0 && (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}>
          {isError && !matchesList.length ? (
            <NetworkError onRetry={onRefresh} isRetrying={refreshing} />
          ) : isLoading && !matchesList.length ? (
            <View style={styles.loadingWrap}><ActivityIndicator size="large" color={Colors.primary.orange} /><Text style={styles.loadingText}>Chargement des matchs...</Text></View>
          ) : (
          <>
          {activeTab === 'need-players' && (
            <View style={styles.infoCard}>
              <MapPin size={18} color={Colors.primary.blue} />
              <Text style={styles.infoText}>Matchs dans un rayon de {filters.maxDistance}km autour de {user?.location?.city || user?.city || 'votre position'}</Text>
            </View>
          )}
          {hasActiveFilters && activeTab !== 'tournaments' && activeTab !== 'history' && (
            <View style={styles.activeFiltersRow}>
              <Text style={styles.activeFiltersLabel}>Filtres actifs:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersChips}>
                {filters.sport !== 'all' && <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{sportLabels[filters.sport]}</Text></View>}
                {filters.level !== 'all' && <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{levelLabels[filters.level]}</Text></View>}
                {filters.ambiance !== 'all' && <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{ambianceLabels[filters.ambiance]}</Text></View>}
                {filters.matchType !== 'all' && <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{filters.matchType === 'ranked' ? 'Classés' : 'Amicaux'}</Text></View>}
              </ScrollView>
              <TouchableOpacity onPress={() => setFilters({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' })}><Text style={styles.clearFilters}>Effacer</Text></TouchableOpacity>
            </View>
          )}
          {activeTab === 'history' && (
            completedMatches.length > 0 ? (
              <View style={styles.historyList}>
                <Text style={styles.historySectionTitle}>Matchs joués avec résultat</Text>
                {completedMatches.map((m) => {
                  const sportEmoji: Record<string, string> = { football: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', padel: '🏓', handball: '🤾', rugby: '🏉', running: '🏃', cycling: '🚴', swimming: '🏊' };
                  return (
                    <TouchableOpacity key={m.id} style={styles.historyRow} onPress={() => router.push(`/match/${m.id}`)} activeOpacity={0.7}>
                      <View style={styles.historyRowLeft}>
                        <Text style={styles.historyRowEmoji}>{sportEmoji[m.sport] ?? '🏆'}</Text>
                        <View style={styles.historyRowInfo}>
                          <Text style={styles.historyRowSport}>{(sportLabels as Record<string, string>)[m.sport] || m.sport} • {m.format}</Text>
                          <Text style={styles.historyRowVenue}>{m.venue?.name || 'Lieu non spécifié'} • {formatDate(m.dateTime)}</Text>
                        </View>
                      </View>
                      <View style={styles.historyScoreBadge}>
                        <Text style={styles.historyScoreText}>{m.score ? `${m.score.home ?? 0} - ${m.score.away ?? 0}` : '–'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : renderEmptyState(<History size={32} color={Colors.text.muted} />, 'Aucun match joué', 'Vos matchs terminés avec résultat apparaîtront ici.')
          )}
          {activeTab !== 'tournaments' && activeTab !== 'history' && (filteredMatches.length > 0 ? filteredMatches.map(m => renderMatchCard(m, activeTab === 'need-players')) : renderEmptyState(<Swords size={32} color={Colors.text.muted} />, hasActiveFilters ? 'Aucun match trouvé' : 'Aucun match', hasActiveFilters ? 'Essayez de modifier vos filtres' : activeTab === 'need-players' ? 'Aucun match ne cherche de joueurs dans votre zone' : 'Soyez le premier à créer un match !', { title: hasActiveFilters ? 'Effacer les filtres' : 'Créer un match', onPress: hasActiveFilters ? () => setFilters({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' }) : () => router.push('/create-match') }))}
          {activeTab === 'tournaments' && (openTournaments.length > 0 ? openTournaments.map(renderTournamentCard) : renderEmptyState(<Trophy size={32} color={Colors.text.muted} />, 'Aucun tournoi', 'Tirez pour actualiser ou créez un tournoi.', { title: 'Créer un tournoi', onPress: () => router.navigate('/create-tournament' as any) }))}
          </>
          )}
        </ScrollView>
      </View>

      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrer les matchs</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Type de match</Text>
              <View style={styles.filterOptions}>
                <FilterChip label="Tous" active={filters.matchType === 'all'} onPress={() => setFilters(f => ({ ...f, matchType: 'all' }))} />
                <FilterChip label="Amicaux" active={filters.matchType === 'friendly'} onPress={() => setFilters(f => ({ ...f, matchType: 'friendly' }))} />
                <FilterChip label="Classés" active={filters.matchType === 'ranked'} onPress={() => setFilters(f => ({ ...f, matchType: 'ranked' }))} />
              </View>
              <Text style={styles.filterLabel}>Sport</Text>
              <View style={styles.filterOptions}>
                <FilterChip label="Tous" active={filters.sport === 'all'} onPress={() => setFilters(f => ({ ...f, sport: 'all' }))} />
                {ALL_SPORTS.slice(0, 10).map(sport => (
                  <FilterChip key={sport} label={sportLabels[sport]} active={filters.sport === sport} onPress={() => setFilters(f => ({ ...f, sport }))} />
                ))}
              </View>
              <Text style={styles.filterLabel}>Niveau</Text>
              <View style={styles.filterOptions}>
                <FilterChip label="Tous" active={filters.level === 'all'} onPress={() => setFilters(f => ({ ...f, level: 'all' }))} />
                {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map(level => (
                  <FilterChip key={level} label={levelLabels[level]} active={filters.level === level} onPress={() => setFilters(f => ({ ...f, level }))} />
                ))}
              </View>
              <Text style={styles.filterLabel}>Ambiance</Text>
              <View style={styles.filterOptions}>
                <FilterChip label="Toutes" active={filters.ambiance === 'all'} onPress={() => setFilters(f => ({ ...f, ambiance: 'all' }))} />
                {(['competitive', 'casual', 'mixed'] as const).map(amb => (
                  <FilterChip key={amb} label={ambianceLabels[amb]} active={filters.ambiance === amb} onPress={() => setFilters(f => ({ ...f, ambiance: amb }))} />
                ))}
              </View>
              <Text style={styles.filterLabel}>Distance max (km): {filters.maxDistance}</Text>
              <View style={styles.distanceOptions}>
                {[10, 25, 50, 100].map(d => (
                  <TouchableOpacity key={d} style={[styles.distanceChip, filters.maxDistance === d && styles.distanceChipActive]} onPress={() => setFilters(f => ({ ...f, maxDistance: d }))}>
                    <Text style={[styles.distanceText, filters.maxDistance === d && styles.distanceTextActive]}>{d} km</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Réinitialiser" onPress={() => setFilters({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' })} variant="outline" style={styles.modalBtn} />
              <Button title="Appliquer" onPress={() => setShowFilterModal(false)} variant="primary" style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 35 },

  // Header — padding direct sur le composant
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: SPACING.md, paddingTop: SPACING.xs },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.8 },
  headerSubtitle: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' as const, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: Colors.primary.blue },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange },
  addButton: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: Colors.primary.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },

  // Tabs — ScrollView edge-to-edge, padding dans contentContainerStyle
  tabsScroll: { maxHeight: 52, marginBottom: SPACING.md, width: '100%' },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: Colors.background.card },
  tabText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' as const },
  tabCount: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 18, alignItems: 'center' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { color: Colors.text.muted, fontSize: 10, fontWeight: '700' as const },
  tabCountTextActive: { color: '#FFFFFF' },

  // Scroll vertical — edge-to-edge, padding dans contentContainerStyle
  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(21, 101, 192, 0.1)', padding: 14, borderRadius: 14, marginBottom: 16 },
  infoText: { flex: 1, color: Colors.text.secondary, fontSize: 13 },
  activeFiltersRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  activeFiltersLabel: { color: Colors.text.muted, fontSize: 12 },
  activeFiltersChips: { flexDirection: 'row', gap: 6 },
  activeFilterChip: { backgroundColor: Colors.primary.blue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeFilterText: { color: '#FFFFFF', fontSize: 12 },
  clearFilters: { color: Colors.primary.orange, fontSize: 12, fontWeight: '500' as const },

  // Match card
  matchCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
  },
  matchAccentBar: { height: 3, width: '100%' },
  matchCardBody: { padding: 14 },

  matchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  matchHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },

  matchTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  matchTypePillText: { fontSize: 11, fontWeight: '700' as const },

  matchStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  matchStatusDot: { width: 6, height: 6, borderRadius: 3 },
  matchStatusText: { fontSize: 11, fontWeight: '600' as const },

  needsPlayersBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  needsPlayersText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },

  // Title row
  matchTitleRow: { marginBottom: 12 },
  matchTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchEmoji: { fontSize: 28 },
  matchTitleInfo: { flex: 1 },
  matchTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginBottom: 2, letterSpacing: -0.2 },
  matchLevel: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },

  // Info pills
  matchInfoPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  matchInfoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.background.cardLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  matchInfoPillText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },

  // Venue pending
  venuePendingBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: `${Colors.status.warning}15`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12, gap: 6 },
  venuePendingText: { color: Colors.status.warning, fontSize: 11, fontWeight: '500' as const, flex: 1 },

  // Progress
  matchProgressSection: { marginBottom: 4 },
  matchProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  matchProgressLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchProgressLabel: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },
  matchPrizePill: { backgroundColor: 'rgba(249,115,22,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  matchPrizeText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700' as const },
  matchProgressBg: { height: 5, borderRadius: 3, backgroundColor: Colors.background.cardLight, overflow: 'hidden' },
  matchProgressFill: { height: '100%', borderRadius: 3 },

  // Footer
  matchFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10 },
  organizerText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  rankedTag: { color: Colors.primary.orange, fontSize: 11, fontWeight: '600' as const },

  // Tournament card
  tournamentCardWrap: { marginBottom: CARD_GAP, borderRadius: 18, overflow: 'hidden' },
  tournamentCard: { padding: 16, borderRadius: 18, overflow: 'hidden' },
  tournamentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tournamentIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tournamentPrizeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tournamentPrize: { color: '#FBBF24', fontSize: 13, fontWeight: '700' as const },
  tournamentName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' as const, marginBottom: 4, letterSpacing: -0.3 },
  tournamentInfo: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 12 },
  tournamentMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tournamentMetaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  tournamentMetaText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' as const },
  tournamentFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tournamentFeePill: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  tournamentFeeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  teamOnlyBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  teamOnlyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' as const },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, lineHeight: 20 },
  emptyButton: { marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalScroll: { maxHeight: 450 },
  filterLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' as const, marginTop: 16, marginBottom: 12 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background.card },
  filterChipActive: { backgroundColor: Colors.primary.blue },
  filterChipText: { color: Colors.text.secondary, fontSize: 13 },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  distanceOptions: { flexDirection: 'row', gap: 12 },
  distanceChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background.card },
  distanceChipActive: { backgroundColor: Colors.primary.blue },
  distanceText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  distanceTextActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1 },

  // History
  historyList: { marginBottom: 20 },
  historySectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background.card, padding: 14, borderRadius: 16, marginBottom: 10 },
  historyRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  historyRowEmoji: { fontSize: 24 },
  historyRowInfo: { flex: 1 },
  historyRowSport: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  historyRowVenue: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  historyScoreBadge: { backgroundColor: Colors.primary.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  historyScoreText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
});
