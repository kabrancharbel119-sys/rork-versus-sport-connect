import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Swords, Calendar, MapPin, Users, Filter, Clock, Trophy, UserPlus, X, Check, History } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
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
  const { getUserById } = useUsers();
  const openTournaments = getOpenTournaments() ?? [];
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Filters>({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' });

  const allMatches = getUpcomingMatches() ?? [];
  const myMatches = user ? (getUserMatches(user.id) ?? []) : [];
  const completedMatches = user ? (getCompletedUserMatches(user.id) ?? []) : [];
  const matchesNeedingPlayers = getMatchesNeedingPlayers(user?.location, filters.maxDistance) ?? [];

  const filteredMatches = useMemo(() => {
    let result = activeTab === 'all' ? allMatches : activeTab === 'my-matches' ? myMatches : activeTab === 'need-players' ? matchesNeedingPlayers : activeTab === 'history' ? [] : [];
    if (activeTab !== 'history') {
      if (filters.sport !== 'all') result = result.filter(m => m.sport === filters.sport);
      if (filters.level !== 'all') result = result.filter(m => m.level === filters.level);
      if (filters.ambiance !== 'all') result = result.filter(m => m.ambiance === filters.ambiance);
      if (filters.matchType === 'ranked') result = result.filter(m => m.type === 'ranked');
      if (filters.matchType === 'friendly') result = result.filter(m => m.type === 'friendly');
    }
    return result;
  }, [activeTab, allMatches, myMatches, matchesNeedingPlayers, filters]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Matches] matches (raw):', matches?.length ?? 0, matches);
      console.log('[Matches] allMatches:', allMatches?.length ?? 0);
      console.log('[Matches] filteredMatches to render:', filteredMatches?.length ?? 0, filteredMatches);
    }
  }, [matches, allMatches, filteredMatches]);

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
  const getStatusColor = (status: string) => ({ open: Colors.status.success, confirmed: Colors.primary.blue, in_progress: Colors.primary.orange }[status] || Colors.text.muted);
  const getStatusLabel = (status: string) => ({ open: 'Ouvert', confirmed: 'Confirmé', in_progress: 'En cours', completed: 'Terminé' }[status] || status);

  const hasActiveFilters = filters.sport !== 'all' || filters.level !== 'all' || filters.ambiance !== 'all' || filters.matchType !== 'all';

  const matchesList = matches ?? [];
  const renderMatchCard = (match: typeof matchesList[0], showNeedsPlayers = false) => {
    if (__DEV__) console.log('[Matches] Rendering match:', match.id, match.sport, match.format);
    const creator = getUserById(match.createdBy);
    const isRanked = match.type === 'ranked';
    return (
      <Card
        key={match.id}
        style={[styles.matchCard, isRanked && styles.matchCardRanked]}
        onPress={() => router.push(`/match/${match.id}`)}
        variant="gradient"
      >
        <View style={styles.matchHeader}>
          <View style={styles.matchTypeRow}>
            <View style={[styles.typeBadge, styles.typeBadgeRow, { backgroundColor: isRanked ? Colors.primary.orange : Colors.primary.blue }]}>
              {isRanked && <Trophy size={12} color="#FFFFFF" />}
              <Text style={styles.typeText}>{match.type === 'friendly' ? 'Amical' : isRanked ? 'Classé' : 'Tournoi'}</Text>
            </View>
            {isRanked && (
              <View style={styles.rankedStakeBadge}>
                <Text style={styles.rankedStakeText}>Rang & stats</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(match.status)}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(match.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(match.status) }]}>{getStatusLabel(match.status)}</Text>
            </View>
            {showNeedsPlayers && match.needsPlayers && (
              <View style={styles.needsPlayersBadge}><UserPlus size={12} color="#FFFFFF" /><Text style={styles.needsPlayersText}>Cherche joueurs</Text></View>
            )}
          </View>
        </View>
        {isRanked && <Text style={styles.rankedTagline}>Compte pour le classement et la réputation</Text>}
        <Text style={styles.matchTitle}>{(sportLabels as Record<string, string>)[match.sport] || match.sport} • {match.format}</Text>
        <Text style={styles.matchLevel}>{levelLabels[match.level]} • {ambianceLabels[match.ambiance]}</Text>
        <View style={styles.matchDetails}>
          <View style={styles.matchDetail}><Calendar size={16} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{formatDate(match.dateTime)}</Text></View>
          <View style={styles.matchDetail}><Clock size={16} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{formatTime(match.dateTime)}</Text></View>
        </View>
        {match.venue && (
          <View style={styles.matchDetail}><MapPin size={16} color={Colors.text.muted} /><Text style={styles.matchDetailText}>{match.venue.name}</Text></View>
        )}
        {creator && <Text style={styles.organizerText}>Organisé par {creator.fullName || creator.username}</Text>}
        <View style={styles.matchFooter}>
          <View style={styles.playersInfo}><Users size={16} color={Colors.primary.blue} /><Text style={styles.playersText}>{(match.registeredPlayers ?? []).length}/{match.maxPlayers} joueurs</Text></View>
          {!isRanked && match.prize && <View style={styles.prizeInfo}><Text style={styles.prizeText}>💰 {match.prize.toLocaleString()} FCFA</Text></View>}
          {isRanked && <View style={styles.rankedFooterBadge}><Text style={styles.rankedFooterText}>Compte pour le classement</Text></View>}
        </View>
      </Card>
    );
  };

  const renderTournamentCard = (tournament: typeof openTournaments[0]) => (
    <TouchableOpacity key={tournament.id} activeOpacity={0.8} onPress={() => router.push(`/tournament/${tournament.id}`)}>
      <LinearGradient colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tournamentCard}>
        <View style={styles.tournamentHeader}><Trophy size={20} color="#FFFFFF" /><Text style={styles.tournamentPrize}>{tournament.prizePool.toLocaleString()} FCFA</Text></View>
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        <Text style={styles.tournamentInfo}>{sportLabels[tournament.sport]} • {tournament.format} • {levelLabels[tournament.level]}</Text>
        <View style={styles.tournamentMeta}>
          <View style={styles.tournamentMetaItem}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.tournamentMetaText}>{formatDate(tournament.startDate)}</Text></View>
          <View style={styles.tournamentMetaItem}><Users size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.tournamentMetaText}>{(tournament.registeredTeams ?? []).length}/{tournament.maxTeams}</Text></View>
        </View>
        <View style={styles.tournamentFee}><Text style={styles.tournamentFeeText}>Inscription: {tournament.entryFee.toLocaleString()} FCFA</Text></View>
        <View style={styles.teamOnlyBadge}><Users size={12} color="#FFFFFF" /><Text style={styles.teamOnlyText}>Équipes uniquement</Text></View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderEmptyState = (icon: React.ReactNode, title: string, text: string, action?: { title: string; onPress: () => void }) => (
    <View style={styles.emptyState}>
      {icon}<Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text>
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
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matchs</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]} onPress={() => setShowFilterModal(true)}>
              <Filter size={20} color={hasActiveFilters ? '#FFFFFF' : Colors.text.primary} />
              {hasActiveFilters && <View style={styles.filterDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create-match')}><Plus size={20} color="#FFFFFF" /></TouchableOpacity>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {([['all', 'Tous', <Swords key="s" size={16} />], ['my-matches', 'Mes matchs', <Calendar key="c" size={16} />], ['need-players', 'Cherche joueurs', <UserPlus key="u" size={16} />], ['history', 'Historique', <History key="h" size={16} />], ['tournaments', 'Tournois', <Trophy key="t" size={16} />]] as const).map(([key, label, icon]) => (
            <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
              {React.cloneElement(icon, { color: activeTab === key ? '#FFFFFF' : Colors.text.secondary })}
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
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
                {completedMatches.map((m) => (
                  <TouchableOpacity key={m.id} style={styles.historyRow} onPress={() => router.push(`/match/${m.id}`)} activeOpacity={0.7}>
                    <View style={styles.historyRowLeft}>
                      <Text style={styles.historyRowSport}>{(sportLabels as Record<string, string>)[m.sport] || m.sport} • {m.format}</Text>
                      <Text style={styles.historyRowVenue}>{m.venue?.name || 'Lieu non spécifié'} • {formatDate(m.dateTime)}</Text>
                    </View>
                    <View style={styles.historyScoreBadge}>
                      <Text style={styles.historyScoreText}>{m.score ? `${m.score.home ?? 0} - ${m.score.away ?? 0}` : '–'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : renderEmptyState(<History size={64} color={Colors.text.muted} />, 'Aucun match joué', 'Vos matchs terminés avec résultat apparaîtront ici.')
          )}
          {activeTab !== 'tournaments' && activeTab !== 'history' && (filteredMatches.length > 0 ? filteredMatches.map(m => renderMatchCard(m, activeTab === 'need-players')) : renderEmptyState(<Swords size={64} color={Colors.text.muted} />, hasActiveFilters ? 'Aucun match trouvé' : 'Aucun match', hasActiveFilters ? 'Essayez de modifier vos filtres' : activeTab === 'need-players' ? 'Aucun match ne cherche de joueurs dans votre zone' : 'Soyez le premier à créer un match !', { title: hasActiveFilters ? 'Effacer les filtres' : 'Créer un match', onPress: hasActiveFilters ? () => setFilters({ sport: 'all', level: 'all', ambiance: 'all', maxDistance: 50, matchType: 'all' }) : () => router.push('/create-match') }))}
          {activeTab === 'tournaments' && (openTournaments.length > 0 ? openTournaments.map(renderTournamentCard) : renderEmptyState(<Trophy size={64} color={Colors.text.muted} />, 'Aucun tournoi', 'Tirez pour actualiser ou créez un tournoi'))}
          </>
          )}
        </ScrollView>
      </SafeAreaView>

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
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: Colors.primary.blue },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  tabsScroll: { maxHeight: 50, marginBottom: 16 },
  tabs: { paddingHorizontal: 20, gap: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Colors.background.card },
  tabActive: { backgroundColor: Colors.primary.blue },
  tabText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  tabTextActive: { color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(21, 101, 192, 0.1)', padding: 14, borderRadius: 12, marginBottom: 16 },
  infoText: { flex: 1, color: Colors.text.secondary, fontSize: 13 },
  activeFiltersRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  activeFiltersLabel: { color: Colors.text.muted, fontSize: 12 },
  activeFiltersChips: { flexDirection: 'row', gap: 6 },
  activeFilterChip: { backgroundColor: Colors.primary.blue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeFilterText: { color: '#FFFFFF', fontSize: 12 },
  clearFilters: { color: Colors.primary.orange, fontSize: 12, fontWeight: '500' as const },
  matchCard: { marginBottom: 16 },
  matchCardRanked: { borderLeftWidth: 4, borderLeftColor: Colors.primary.orange },
  matchHeader: { marginBottom: 12 },
  matchTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' as const },
  rankedStakeBadge: { backgroundColor: Colors.primary.orange + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rankedStakeText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '600' as const },
  rankedTagline: { color: Colors.primary.orange, fontSize: 11, fontWeight: '500' as const, marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '500' as const },
  needsPlayersBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  needsPlayersText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' as const },
  matchTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 4 },
  matchLevel: { color: Colors.text.secondary, fontSize: 13, marginBottom: 12 },
  matchDetails: { flexDirection: 'row', gap: 20, marginBottom: 8 },
  matchDetail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  matchDetailText: { color: Colors.text.secondary, fontSize: 13 },
  organizerText: { color: Colors.text.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic' as const },
  matchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  playersInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playersText: { color: Colors.text.secondary, fontSize: 13 },
  prizeInfo: { backgroundColor: 'rgba(255, 107, 0, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  prizeText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
  rankedFooterBadge: { backgroundColor: Colors.primary.orange + '25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rankedFooterText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' as const },
  tournamentCard: { padding: 20, borderRadius: 16, marginBottom: 16 },
  tournamentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tournamentPrize: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  tournamentName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' as const, marginBottom: 4 },
  tournamentInfo: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 12 },
  tournamentMeta: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  tournamentMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tournamentMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  tournamentFee: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  tournamentFeeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' as const },
  teamOnlyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  teamOnlyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '600' as const, marginTop: 20 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  emptyButton: { marginTop: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalScroll: { maxHeight: 450 },
  filterLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' as const, marginTop: 16, marginBottom: 12 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  filterChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  filterChipText: { color: Colors.text.secondary, fontSize: 13 },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  distanceOptions: { flexDirection: 'row', gap: 12 },
  distanceChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  distanceChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  distanceText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  distanceTextActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1 },
  historyList: { marginBottom: 20 },
  historySectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background.card, padding: 16, borderRadius: 12, marginBottom: 10 },
  historyRowLeft: { flex: 1 },
  historyRowSport: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  historyRowVenue: { color: Colors.text.muted, fontSize: 13, marginTop: 4 },
  historyScoreBadge: { backgroundColor: Colors.primary.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  historyScoreText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
});
