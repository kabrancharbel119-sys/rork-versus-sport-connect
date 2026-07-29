import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Trophy, Calendar, MapPin, Users, Plus, Clock, Flame, Shield, AlertCircle, Crown, ChevronRight } from 'lucide-react-native';
import { Colors, SPACING, CARD_RADIUS, OUTER_PAD, CARD_GAP } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { sportLabels, levelLabels } from '@/mocks/data';
import type { Tournament } from '@/types';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  registration: { label: 'Inscriptions ouvertes', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  in_progress: { label: 'En direct', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  completed: { label: 'Terminé', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
};

const sportEmojis: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  padel: '🏓',
  handball: '🤾',
  rugby: '🏉',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
};

type FilterStatus = 'all' | 'registration' | 'in_progress' | 'completed';

export default function TournamentsTabScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { tournaments, isLoading, isError, refetchTournaments } = useTournaments();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useFocusEffect(useCallback(() => {
    refetchTournaments();
  }, [refetchTournaments]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetchTournaments(); } finally { setRefreshing(false); }
  }, [refetchTournaments]);

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

  const liveTournaments = useMemo(() => filteredAndSorted.filter(t => t.status === 'in_progress'), [filteredAndSorted]);
  const registrationTournaments = useMemo(() => filteredAndSorted.filter(t => t.status === 'registration'), [filteredAndSorted]);
  const completedTournaments = useMemo(() => filteredAndSorted.filter(t => t.status === 'completed'), [filteredAndSorted]);

  const TournamentListCard = ({ tournament }: { tournament: Tournament }) => {
    const cfg = statusConfig[tournament.status] ?? statusConfig.completed;
    const regPct = tournament.maxTeams > 0 ? (tournament.registeredTeams ?? []).length / tournament.maxTeams : 0;
    const countdown = tournament.status === 'registration' ? getCountdown(tournament.startDate) : null;
    const isLive = tournament.status === 'in_progress';
    const isCompleted = tournament.status === 'completed';
    const bannerSource = tournament.bannerImage || tournament.sponsorLogo || null;
    const registeredCount = (tournament.registeredTeams ?? []).length;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/tournament/${tournament.id}`)}
        style={styles.tournamentCard}
      >
        {/* Banner section */}
        <View style={styles.bannerWrap}>
          {bannerSource ? (
            <Image source={{ uri: bannerSource }} style={styles.bannerImage} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient
              colors={isCompleted ? ['#1E293B', '#0F172A'] : isLive ? ['#1E3A5F', '#0C1A2E'] : ['#1A2E1A', '#0D1F0D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerImage}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.6)']}
            style={styles.bannerOverlay}
          />

          {/* Top row: status + prize */}
          <View style={styles.bannerTopRow}>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
              {isLive && <Flame size={11} color={cfg.color} strokeWidth={2.5} />}
              {!isLive && <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />}
              <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={styles.bannerTopRight}>
              {countdown && (
                <View style={styles.countdownChip}>
                  <Clock size={11} color="rgba(255,255,255,0.9)" strokeWidth={2} />
                  <Text style={styles.countdownChipText}>{countdown}</Text>
                </View>
              )}
              {tournament.prizePool > 0 && (
                <View style={styles.prizeChip}>
                  <Crown size={12} color="#FBBF24" strokeWidth={2} />
                  <Text style={styles.prizeChipText}>{tournament.prizePool.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sport emoji watermark */}
          <View style={styles.sportEmojiWrap}>
            <Text style={styles.sportEmoji}>{sportEmojis[tournament.sport] ?? '🏆'}</Text>
          </View>

          {/* Bottom: name + meta on banner */}
          <View style={styles.bannerBottom}>
            <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>
            <Text style={styles.tournamentMeta} numberOfLines={1}>
              {sportLabels[tournament.sport] ?? tournament.sport} • {tournament.format} • {levelLabels[tournament.level] ?? tournament.level}
            </Text>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          {tournament.description ? (
            <Text style={styles.tournamentDescription} numberOfLines={2}>{tournament.description}</Text>
          ) : null}

          {tournament.status === 'registration' && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLeft}>
                  <Users size={12} color={Colors.primary.orange} strokeWidth={2.5} />
                  <Text style={styles.progressLabel}>{registeredCount}/{tournament.maxTeams} équipes</Text>
                </View>
                <Text style={styles.progressPct}>{Math.round(regPct * 100)}%</Text>
              </View>
              <View style={styles.progressBg}>
                <LinearGradient
                  colors={['#F97316', '#FB923C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFillGrad, { width: `${Math.min(regPct * 100, 100)}%` }]}
                />
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoPill}>
              <Calendar size={12} color={Colors.text.muted} strokeWidth={2} />
              <Text style={styles.infoPillText}>{formatShortDate(tournament.startDate)}</Text>
            </View>
            {tournament.venue?.name && (
              <View style={styles.infoPill}>
                <MapPin size={12} color={Colors.text.muted} strokeWidth={2} />
                <Text style={styles.infoPillText} numberOfLines={1}>{tournament.venue.name}</Text>
              </View>
            )}
            {tournament.status !== 'registration' && (
              <View style={styles.infoPill}>
                <Users size={12} color={Colors.text.muted} strokeWidth={2} />
                <Text style={styles.infoPillText}>{registeredCount} éq.</Text>
              </View>
            )}
          </View>

          {tournament.sponsorName && (
            <View style={styles.sponsorRow}>
              <Shield size={11} color={Colors.text.muted} strokeWidth={2} />
              <Text style={styles.sponsorText}>Sponsor: {tournament.sponsorName}</Text>
            </View>
          )}

          <View style={styles.cardFooterRow}>
            <Text style={styles.cardFooterText}>Voir détails</Text>
            <ChevronRight size={15} color={Colors.primary.orange} strokeWidth={2.5} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#070B12', '#0A0E16', Colors.background.dark, '#0B1018']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tournois</Text>
            <Text style={styles.headerSubtitle}>{counts.all} tournoi{counts.all > 1 ? 's' : ''} au total</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.navigate('/create-tournament' as any)}
            activeOpacity={0.7}
          >
            <Plus size={20} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Segmented filter */}
        <View style={styles.segmentWrap}>
          {filters.map((f) => {
            const active = filter === f.key;
            const activeColor = f.key === 'in_progress' ? '#F97316' : f.key === 'registration' ? '#10B981' : f.key === 'completed' ? '#94A3B8' : Colors.primary.orange;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.segmentItem, active && { backgroundColor: activeColor }]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                {active && <View style={[styles.segmentIndicator, { backgroundColor: '#FFFFFF' }]} />}
                <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{f.label}</Text>
                {f.count > 0 && (
                  <View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                    <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>{f.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {isLoading && tournaments.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
              <Text style={styles.loadingText}>Chargement des tournois...</Text>
            </View>
          ) : isError && tournaments.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <AlertCircle size={32} color={Colors.status.error} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>Erreur de chargement</Text>
              <Text style={styles.emptyText}>Impossible de charger les tournois.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetchTournaments()}>
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : filteredAndSorted.length > 0 ? (
            <>
              {/* Live section */}
              {liveTournaments.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionLabelRow}>
                    <View style={[styles.sectionDot, { backgroundColor: '#F97316' }]} />
                    <Text style={styles.sectionLabelText}>En direct</Text>
                  </View>
                  {liveTournaments.map((t) => <TournamentListCard key={t.id} tournament={t} />)}
                </View>
              )}

              {/* Registration section */}
              {registrationTournaments.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionLabelRow}>
                    <View style={[styles.sectionDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.sectionLabelText}>Inscriptions ouvertes</Text>
                  </View>
                  {registrationTournaments.map((t) => <TournamentListCard key={t.id} tournament={t} />)}
                </View>
              )}

              {/* Completed section */}
              {completedTournaments.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionLabelRow}>
                    <View style={[styles.sectionDot, { backgroundColor: Colors.text.muted }]} />
                    <Text style={styles.sectionLabelTextMuted}>Terminés</Text>
                  </View>
                  {completedTournaments.map((t) => <TournamentListCard key={t.id} tournament={t} />)}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Trophy size={32} color={Colors.text.muted} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'Aucun tournoi' : 'Aucun tournoi ici'}
              </Text>
              <Text style={styles.emptyText}>
                {filter !== 'all'
                  ? 'Essayez un autre filtre ou créez un tournoi.'
                  : 'Les tournois apparaîtront ici.'}
              </Text>
              {filter !== 'all' ? (
                <TouchableOpacity style={[styles.retryBtn, { marginTop: 12 }]} onPress={() => setFilter('all')}>
                  <Text style={styles.retryBtnText}>Voir tous</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.retryBtn} onPress={() => router.navigate('/create-tournament' as any)}>
                  <Text style={styles.retryBtnText}>Créer un tournoi</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 35 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xs,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  createButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Segmented filter
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: SPACING.md,
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 14,
  },
  segmentIndicator: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  segmentItemActive: {
    backgroundColor: Colors.primary.orange,
  },
  segmentText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  segmentCount: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentCountText: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  segmentCountTextActive: {
    color: '#FFFFFF',
  },

  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 12 },

  // Card
  tournamentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
  },

  // Banner
  bannerWrap: { height: 160, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  bannerTopRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backdropFilter: 'blur(10px)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700' as const },

  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countdownChipText: { color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '600' as const },

  prizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  prizeChipText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' as const },

  sportEmojiWrap: {
    position: 'absolute',
    right: 16,
    bottom: 50,
    opacity: 0.15,
  },
  sportEmoji: { fontSize: 60 },

  bannerBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
  },
  tournamentName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tournamentMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500' as const,
  },

  // Card body
  cardBody: { padding: 14 },
  tournamentDescription: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },

  // Progress
  progressSection: { marginBottom: 12 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressLabel: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },
  progressPct: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' as const },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.background.cardLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary.orange,
  },
  progressFillGrad: {
    height: '100%',
    borderRadius: 3,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  infoPillText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoChipText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },

  sponsorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingTop: 10,
  },
  sponsorText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },

  // Card footer
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
  },
  cardFooterText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  // Section blocks
  sectionBlock: { marginBottom: 8 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabelText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  sectionLabelTextMuted: {
    color: Colors.text.muted,
    fontSize: 14,
    fontWeight: '700' as const,
  },

  // Empty / error
  emptyCard: { alignItems: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, lineHeight: 20 },
  retryBtn: {
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 8,
  },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
});
