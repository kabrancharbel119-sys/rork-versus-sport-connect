import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, Calendar, MapPin, Users, Plus, Shield, ChevronRight, AlertCircle, Clock, CheckCircle, Flame, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { Skeleton } from '@/components/LoadingSkeleton';
import { sportLabels, levelLabels } from '@/mocks/data';
import type { Tournament } from '@/types';

const statusGradients: Record<string, [string, string]> = {
  registration: [Colors.gradient.orangeStart, Colors.gradient.orangeEnd],
  in_progress: ['#1E6B3A', '#0F4A26'],
  completed: ['#1A1A2E', '#16213E'],
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  registration: { label: 'Inscriptions', color: Colors.status.success, icon: 'zap' },
  in_progress: { label: 'En cours', color: Colors.primary.orange, icon: 'flame' },
  completed: { label: 'Terminé', color: Colors.text.muted, icon: 'check' },
};

export default function TournamentsScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { tournaments, isLoading, isError, refetchTournaments } = useTournaments();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetchTournaments(); } finally { setRefreshing(false); }
  }, [refetchTournaments]);

  useFocusEffect(
    useCallback(() => { refetchTournaments(); }, [refetchTournaments])
  );

  type FilterStatus = 'all' | 'registration' | 'in_progress' | 'completed';
  const [filter, setFilter] = useState<FilterStatus>('all');

  const counts = useMemo(() => ({
    all: tournaments.length,
    registration: tournaments.filter(t => t.status === 'registration').length,
    in_progress: tournaments.filter(t => t.status === 'in_progress').length,
    completed: tournaments.filter(t => t.status === 'completed').length,
  }), [tournaments]);

  const filteredAndSorted = useMemo(() => {
    let list = tournaments;
    if (filter !== 'all') {
      list = list.filter(t => t.status === filter);
    }
    const order: Record<string, number> = { in_progress: 0, registration: 1, completed: 2 };
    return [...list].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tournaments, filter]);

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: counts.all },
    { key: 'registration', label: 'Inscriptions', count: counts.registration },
    { key: 'in_progress', label: 'En cours', count: counts.in_progress },
    { key: 'completed', label: 'Terminés', count: counts.completed },
  ];

  const formatShortDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getCountdown = (startDate: Date | string) => {
    const diff = Math.ceil((new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    if (diff <= 7) return `Dans ${diff}j`;
    return null;
  };

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(home)' as any);
  }, [router]);

  const TournamentListCard = ({ tournament }: { tournament: Tournament }) => {
    const cfg = statusConfig[tournament.status] ?? statusConfig.completed;
    const gradient = statusGradients[tournament.status] ?? statusGradients.completed;
    const regPct = tournament.maxTeams > 0 ? (tournament.registeredTeams ?? []).length / tournament.maxTeams : 0;
    const countdown = tournament.status === 'registration' ? getCountdown(tournament.startDate) : null;
    const isCompleted = tournament.status === 'completed';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/tournament/${tournament.id}`)}
        style={styles.tournamentCard}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tournamentGradient, isCompleted && { opacity: 0.85 }]}
        >
          {/* Top badges */}
          <View style={styles.cardTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.color + '28' }]}>
              <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={styles.cardTopRight}>
              {countdown && (
                <View style={styles.countdownChip}>
                  <Clock size={10} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.countdownChipText}>{countdown}</Text>
                </View>
              )}
              {tournament.prizePool > 0 && (
                <View style={styles.prizeBadge}>
                  <Trophy size={12} color="#FFD700" />
                  <Text style={styles.prizeText}>{tournament.prizePool.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Main content */}
          <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>
          <Text style={styles.tournamentMeta}>
            {sportLabels[tournament.sport] ?? tournament.sport} • {tournament.format} • {levelLabels[tournament.level] ?? tournament.level}
          </Text>

          {tournament.description ? (
            <Text style={styles.tournamentDescription} numberOfLines={2}>{tournament.description}</Text>
          ) : null}

          {/* Progress bar for registration */}
          {tournament.status === 'registration' && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(regPct * 100, 100)}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                {(tournament.registeredTeams ?? []).length}/{tournament.maxTeams} équipes inscrites
              </Text>
            </View>
          )}

          {/* Info chips */}
          <View style={styles.infoChipsRow}>
            <View style={styles.infoChip}>
              <Calendar size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.infoChipText}>{formatShortDate(tournament.startDate)}</Text>
            </View>
            {tournament.venue?.name && (
              <View style={styles.infoChip}>
                <MapPin size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.infoChipText} numberOfLines={1}>{tournament.venue.name}</Text>
              </View>
            )}
            {tournament.status !== 'registration' && (
              <View style={styles.infoChip}>
                <Users size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.infoChipText}>{(tournament.registeredTeams ?? []).length} éq.</Text>
              </View>
            )}
          </View>

          {tournament.sponsorName && (
            <View style={styles.sponsorRow}>
              <Shield size={11} color="rgba(255,255,255,0.5)" />
              <Text style={styles.sponsorText}>{tournament.sponsorName}</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>Voir le tournoi</Text>
          <ChevronRight size={16} color={Colors.primary.orange} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Tournois</Text>
              <Text style={styles.headerSubtitle}>{counts.all} tournoi{counts.all > 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.navigate('/create-tournament' as any)}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <View style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, filter === f.key && styles.filterCountTextActive]}>{f.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {isLoading && tournaments.length === 0 ? (
              <View style={styles.skeletonList}>
                {[1, 2, 3].map((i) => (
                  <Card key={i} style={styles.skeletonCard}>
                    <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                    <Skeleton width="80%" height={18} style={{ marginBottom: 12 }} />
                    <Skeleton width="60%" height={12} />
                  </Card>
                ))}
              </View>
            ) : isError && tournaments.length === 0 ? (
              <Card style={styles.emptyCard}>
                <AlertCircle size={48} color={Colors.status.error} />
                <Text style={styles.emptyTitle}>Erreur de chargement</Text>
                <Text style={styles.emptyText}>Impossible de charger les tournois.</Text>
                <Button title="Réessayer" onPress={() => refetchTournaments()} variant="orange" size="medium" style={{ marginTop: 12 }} />
              </Card>
            ) : filteredAndSorted.length > 0 ? (
              <>
                {filteredAndSorted.map((t) => (
                  <TournamentListCard key={t.id} tournament={t} />
                ))}
              </>
            ) : (
              <Card style={styles.emptyCard}>
                <Trophy size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>
                  {filter === 'all' ? 'Aucun tournoi' : 'Aucun tournoi ici'}
                </Text>
                <Text style={styles.emptyText}>
                  {filter !== 'all'
                    ? 'Essayez un autre filtre ou créez un tournoi.'
                    : 'Les tournois apparaîtront ici.'}
                </Text>
                {filter !== 'all' ? (
                  <TouchableOpacity style={[styles.filterChip, styles.filterChipActive, { marginTop: 12 }]} onPress={() => setFilter('all')}>
                    <Text style={styles.filterChipTextActive}>Voir tous</Text>
                  </TouchableOpacity>
                ) : (
                  <Button title="Créer un tournoi" onPress={() => router.navigate('/create-tournament' as any)} variant="orange" size="medium" style={{ marginTop: 12 }} />
                )}
              </Card>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  headerSubtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 1 },
  createButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },

  filterScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background.card },
  filterChipActive: { backgroundColor: Colors.primary.orange },
  filterChipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '600' as const },
  filterChipTextActive: { color: '#FFF' },
  filterCount: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' as const },
  filterCountTextActive: { color: '#FFF' },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },

  tournamentCard: { backgroundColor: Colors.background.card, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  tournamentGradient: { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  countdownChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countdownChipText: { color: '#FFF', fontSize: 10, fontWeight: '600' as const },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prizeText: { color: '#FFD700', fontSize: 11, fontWeight: '700' as const },

  tournamentName: { color: '#FFF', fontSize: 18, fontWeight: '700' as const, marginBottom: 3, letterSpacing: -0.2 },
  tournamentMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 6 },
  tournamentDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginBottom: 8 },

  progressWrap: { marginBottom: 8 },
  progressBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  progressLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 4 },

  infoChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  sponsorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  sponsorText: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  cardFooterText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '600' as const },
  emptyText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const },

  skeletonList: { gap: 12 },
  skeletonCard: { padding: 20 },
});
