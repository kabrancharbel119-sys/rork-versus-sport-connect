import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, ViewStyle } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, UserPlus, MapPin, Medal, ChevronRight, Flame, Clock, Users, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { sportLabels } from '@/mocks/data';
import type { Tournament, Team } from '@/types';

const cardShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
}) as ViewStyle;

type FeedItem =
  | { kind: 'tournament'; data: Tournament; ts: number }
  | { kind: 'team'; data: Team; ts: number };

const getCountdownLabel = (startDate: string | Date | null | undefined) => {
  if (!startDate) return null;
  const now = new Date();
  const start = new Date(startDate);
  const diffMs = start.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffMs < 0) return 'En cours';
  if (diffHours < 1) return 'Bientôt';
  if (diffHours < 24) return `Dans ${diffHours}h`;
  if (diffDays === 1) return 'Demain';
  if (diffDays <= 7) return `Dans ${diffDays}j`;
  return null;
};

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

type FilterType = 'all' | 'tournament' | 'team';

export default function NewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tournaments, refetchTournaments } = useTournaments();
  const { teams, refetchTeams } = useTeams();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchTournaments(), refetchTeams()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTournaments, refetchTeams]);

  useFocusEffect(
    useCallback(() => {
      refetchTournaments();
      refetchTeams();
    }, [refetchTournaments, refetchTeams])
  );

  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...tournaments
        .filter((t) => t.status === 'registration' || t.status === 'in_progress')
        .map((t) => ({ kind: 'tournament' as const, data: t, ts: new Date(t.createdAt).getTime() })),
      ...teams
        .filter((t) => t.members.length < t.maxMembers)
        .map((t) => ({ kind: 'team' as const, data: t, ts: new Date(t.createdAt).getTime() })),
    ];
    return items.sort((a, b) => b.ts - a.ts);
  }, [tournaments, teams]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return feedItems;
    return feedItems.filter((i) => i.kind === filter);
  }, [feedItems, filter]);

  const counts = useMemo(() => ({
    all: feedItems.length,
    tournament: feedItems.filter((i) => i.kind === 'tournament').length,
    team: feedItems.filter((i) => i.kind === 'team').length,
  }), [feedItems]);

  const renderTournamentCard = (t: Tournament) => {
    const countdown = getCountdownLabel(t.startDate);
    const regPct = t.maxTeams > 0 ? t.registeredTeams.length / t.maxTeams : 0;
    return (
      <TouchableOpacity
        key={`t-${t.id}`}
        activeOpacity={0.88}
        onPress={() => router.push(`/tournament/${t.id}`)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          {t.sponsorLogo ? (
            <Avatar uri={t.sponsorLogo} name={t.name} size="small" />
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: '#F97316' + '20' }]}>
              <Trophy size={18} color="#F97316" strokeWidth={2.2} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
            <Text style={styles.cardTime}>{countdown ?? formatDate(t.startDate)}</Text>
          </View>
          {t.status === 'in_progress' && (
            <View style={styles.liveBadge}>
              <Flame size={10} color="#FFF" />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </View>
        {t.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>{t.description}</Text>
        ) : null}
        <View style={styles.chips}>
          <View style={styles.chip}><Text style={styles.chipText}>{sportLabels[t.sport]}</Text></View>
          <View style={styles.chip}><Text style={styles.chipText}>{t.format}</Text></View>
          {t.venue?.city && <View style={styles.chip}><Text style={styles.chipText}>{t.venue.city}</Text></View>}
        </View>
        <View style={styles.progress}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.min(regPct * 100, 100)}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{t.registeredTeams.length}/{t.maxTeams} équipes inscrites</Text>
            {t.prizePool > 0 && (
              <View style={styles.prize}>
                <Medal size={11} color="#FFD700" />
                <Text style={styles.prizeText}>{t.prizePool.toLocaleString('fr-FR')} FCFA</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTeamCard = (t: Team) => {
    const spotsLeft = t.maxMembers - t.members.length;
    return (
      <TouchableOpacity
        key={`team-${t.id}`}
        activeOpacity={0.88}
        onPress={() => router.push(`/team/${t.id}`)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: '#3B82F6' + '20' }]}>
            <UserPlus size={18} color="#3B82F6" strokeWidth={2.2} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardAction}>Équipe recrute</Text>
            <Text style={styles.cardTime}>{spotsLeft} place{spotsLeft > 1 ? 's' : ''} disponible{spotsLeft > 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.teamRow}>
          <Avatar uri={t.logo} name={t.name} size="medium" />
          <View style={styles.teamInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
            <View style={styles.chips}>
              <View style={styles.chip}><Text style={styles.chipText}>{sportLabels[t.sport]}</Text></View>
              {t.city && <View style={styles.chip}><Text style={styles.chipText}>{t.city}</Text></View>}
            </View>
          </View>
          <View style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>Rejoindre</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Tout', count: counts.all },
    { key: 'tournament', label: 'Tournois', count: counts.tournament },
    { key: 'team', label: 'Équipes', count: counts.team },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#070B12', '#0A0E16', Colors.background.dark, '#0B1018']}
          locations={[0, 0.25, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Fil d'actualité</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.filterRow}>
            {filterTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.filterCount, filter === tab.key && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, filter === tab.key && styles.filterCountTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {filteredItems.length > 0 ? (
              <View style={styles.list}>
                {filteredItems.map((item) =>
                  item.kind === 'tournament'
                    ? renderTournamentCard(item.data)
                    : renderTeamCard(item.data)
                )}
              </View>
            ) : (
              <View style={styles.empty}>
                <Zap size={32} color={Colors.text.muted} strokeWidth={1.5} />
                <Text style={styles.emptyText}>Aucune actualité pour le moment</Text>
              </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  placeholder: { width: 40 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
  },
  filterTabActive: {
    backgroundColor: Colors.primary.orange + '15',
    borderColor: Colors.primary.orange + '50',
  },
  filterTabText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  filterTabTextActive: {
    color: Colors.primary.orange,
  },
  filterCount: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: Colors.primary.orange + '20',
  },
  filterCountText: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  filterCountTextActive: {
    color: Colors.primary.orange,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  list: { gap: 12 },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  cardTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  cardAction: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  cardTime: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' as const },
  cardDescription: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.5 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  progress: { marginTop: 12, gap: 5 },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.background.cardLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.primary.orange,
  },
  progressLabel: { color: Colors.text.secondary, fontSize: 11, fontWeight: '600' as const },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prize: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  prizeText: { color: '#FFD700', fontSize: 11, fontWeight: '700' as const },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamInfo: { flex: 1, minWidth: 0, gap: 4 },
  joinBtn: {
    backgroundColor: '#3B82F6' + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6' + '30',
  },
  joinBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' as const },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
});
