import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Edit2, Trophy, Star, Users, ChevronRight, Shield, Award, TrendingUp, Zap, MapPin, History, CheckCircle, Plus, Compass, Calendar } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSupport } from '@/contexts/SupportContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useTrophies, ALL_TROPHIES, RARITY_COLORS } from '@/contexts/TrophiesContext';
import { venuesApi } from '@/lib/api/venues';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels } from '@/mocks/data';
import { rankingApi } from '@/lib/api/ranking';
import { PlayerRanking, Badge } from '@/types/ranking';

const BOOKING_STATUS_UI: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.status.warning },
  confirmed: { label: 'Confirmée', color: Colors.status.success },
  rejected: { label: 'Refusée', color: Colors.status.error },
  cancelled: { label: 'Annulée', color: Colors.text.muted },
  completed: { label: 'Terminée', color: Colors.primary.blue },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin, refreshUser } = useAuth();
  const { verificationRequests } = useSupport();
  const effectiveVerified = user?.isVerified || isAdmin;
  const effectivePremium = user?.isPremium || isAdmin;
  const { getUserMatches } = useMatches();
  const { getUserTeams, teams } = useTeams();
  const { getUnlockedCount, getTotalXP, checkAndUnlockTrophies, getUserTrophies } = useTrophies();

  const userMatches = user ? (getUserMatches(user.id) ?? []) : [];
  const userTeams = user ? (getUserTeams(user.id) ?? []) : [];
  const unlockedTrophiesCount = user ? getUnlockedCount(user.id) : 0;
  const userTrophyList = user ? (getUserTrophies(user.id) ?? []).filter(t => t.progress >= 100).slice(0, 5) : [];
  const totalXP = user ? getTotalXP(user.id) : 0;
  const isCaptain = (teams ?? []).some(t => t.captainId === user?.id);
  const lastRefresh = useRef(0);

  // États pour le ranking
  const [playerRanking, setPlayerRanking] = useState<PlayerRanking | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const bookingsQuery = useQuery({
    queryKey: ['userBookings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        return await venuesApi.getUserBookings(user.id);
      } catch (e: any) {
        console.error('[Profile] Failed to load user bookings:', e?.message || e);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      try {
        return await venuesApi.getAll();
      } catch {
        return [];
      }
    },
  });

  const venueMap = useMemo(() => {
    const map: Record<string, { name: string; city: string }> = {};
    for (const v of (venuesQuery.data || [])) {
      map[v.id] = { name: v.name, city: v.city };
    }
    return map;
  }, [venuesQuery.data]);

  const bookingPreview = useMemo(() => {
    const bookings = bookingsQuery.data || [];
    if (bookings.length === 0) return [];

    const today = new Date().toISOString().split('T')[0];
    const upcoming = bookings
      .filter((b) => (b.status === 'pending' || b.status === 'confirmed') && b.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const source = upcoming.length > 0
      ? upcoming
      : [...bookings].sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

    return source.slice(0, 1);
  }, [bookingsQuery.data]);

  // Charger le classement du joueur
  const loadPlayerRanking = async () => {
    if (!user) return;

    try {
      const ranking = await rankingApi.getPlayerRanking(user.id);
      setPlayerRanking(ranking);
    } catch (error) {
      console.error('Error loading player ranking:', error);
    }
  };

  // Rafraîchir le classement
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUser(),
        loadPlayerRanking(),
        bookingsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      if (user && now - lastRefresh.current > 5000) {
        refreshUser();
        lastRefresh.current = now;
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      checkAndUnlockTrophies(user.id, {
        matchesPlayed: user.stats.matchesPlayed,
        wins: user.stats.wins,
        goalsScored: user.stats.goalsScored,
        assists: user.stats.assists,
        mvpAwards: user.stats.mvpAwards,
        tournamentWins: user.stats.tournamentWins,
        followers: user.followers,
        isVerified: effectiveVerified,
        isPremium: effectivePremium,
        isCaptain: isCaptain || isAdmin,
        fairPlayScore: user.stats.fairPlayScore,
        hasTeam: userTeams.length > 0 || isAdmin,
        profileComplete: !!(user.fullName && user.city && user.sports?.length > 0) || isAdmin,
      });
      
      // Charger le classement du joueur
      loadPlayerRanking();
    }
  }, [user, isCaptain, userTeams.length, isAdmin, effectiveVerified, effectivePremium, checkAndUnlockTrophies]);

  const winRate = user?.stats ? Math.round((user.stats.wins / (user.stats.matchesPlayed || 1)) * 100) : 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView testID="profile-scroll" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profil</Text>
            <TouchableOpacity testID="btn-settings" style={styles.settingsButton} onPress={() => router.push('/settings')}>
              <Settings size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <LinearGradient colors={[Colors.primary.blue, Colors.primary.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatarWithBadge}>
                <Avatar uri={user?.avatar} name={user?.fullName} size="xlarge" />
                {effectiveVerified && (
                  <View testID="verified-badge" style={styles.verifiedBadge}>
                    <CheckCircle size={16} color={Colors.status.success} />
                  </View>
                )}
              </View>
              <TouchableOpacity testID="btn-edit-profile" style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                <Edit2 size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{user?.fullName || 'Joueur'}</Text>
              {effectivePremium && !isAdmin && <Star size={18} color="#F59E0B" />}
            </View>
            <Text style={styles.profileUsername}>@{user?.username || 'username'}</Text>
            {user?.city && (
              <View style={styles.locationRow}>
                <MapPin size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.locationText}>{user.city}, {user.country}</Text>
              </View>
            )}
            
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Zap size={14} color={Colors.primary.orange} />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.matchesPlayed || 0}</Text>
                <Text style={styles.quickStatLabel}>Matchs</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <TrendingUp size={14} color={Colors.status.success} />
                </View>
                <Text style={styles.quickStatValue}>{winRate}%</Text>
                <Text style={styles.quickStatLabel}>Victoires</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Award size={14} color="#F59E0B" />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.mvpAwards || 0}</Text>
                <Text style={styles.quickStatLabel}>MVP</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Star size={14} color="#F59E0B" />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.fairPlayScore?.toFixed(1) || '5.0'}</Text>
                <Text style={styles.quickStatLabel}>Fair-Play</Text>
              </View>
            </View>
            
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.followers || 0}</Text><Text style={styles.profileMetaLabel}>Abonnés</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.following || 0}</Text><Text style={styles.profileMetaLabel}>Abonnements</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{(user?.teams ?? []).length}</Text><Text style={styles.profileMetaLabel}>Équipe</Text></View>
            </View>
            {(user?.isPremium || isAdmin) && (
              <View style={styles.premiumBadge}>
                <Shield size={14} color={isAdmin ? Colors.primary.orange : '#F59E0B'} />
                <Text style={styles.premiumText}>{isAdmin ? 'Admin' : 'Premium'}</Text>
              </View>
            )}
          </LinearGradient>

          {userTrophyList.length > 0 && (
            <TouchableOpacity style={styles.trophiesPreview} onPress={() => router.push('/trophies')} activeOpacity={0.8}>
              <View style={styles.trophiesPreviewHeader}>
                <Trophy size={18} color={Colors.primary.orange} />
                <Text style={styles.trophiesPreviewTitle}>Trophées ({unlockedTrophiesCount})</Text>
                <ChevronRight size={16} color={Colors.text.muted} />
              </View>
              <View style={styles.trophiesBadges}>
                {(userTrophyList ?? []).map((ut) => (
                  <View key={ut.trophyId} style={[styles.trophyBadge, { borderColor: RARITY_COLORS[ut.trophy?.rarity || 'common'] }]}>
                    <Text style={styles.trophyBadgeIcon}>{ut.trophy?.icon}</Text>
                  </View>
                ))}
                {unlockedTrophiesCount > 5 && (
                  <View style={styles.moreTrophiesBadge}>
                    <Text style={styles.moreTrophiesText}>+{unlockedTrophiesCount - 5}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Section Achievements */}
          {playerRanking && playerRanking.achievements.length > 0 && (
            <TouchableOpacity style={styles.achievementsCard} onPress={() => router.push('/achievements' as any)} activeOpacity={0.8}>
              <View style={styles.achievementsHeader}>
                <Award size={18} color={Colors.primary.orange} />
                <Text style={styles.achievementsTitle}>Succès ({playerRanking.achievements.length})</Text>
                <ChevronRight size={16} color={Colors.text.muted} />
              </View>
              
              <View style={styles.achievementsContent}>
                <View style={styles.achievementsGrid}>
                  {playerRanking.achievements.slice(0, 6).map((achievement, index) => (
                    <View key={achievement.id} style={styles.achievementItem}>
                      <View style={[styles.achievementIcon, { backgroundColor: Colors.primary.orange + '20' }]}>
                        <Text style={styles.achievementIconText}>{achievement.icon}</Text>
                      </View>
                      <Text style={styles.achievementName}>{achievement.name}</Text>
                      <Text style={styles.achievementDesc}>{achievement.description}</Text>
                      {achievement.unlockedAt && (
                        <Text style={styles.achievementDate}>
                          Débloqué le {new Date(achievement.unlockedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
                
                {playerRanking.achievements.length > 6 && (
                  <View style={styles.moreAchievements}>
                    <Text style={styles.moreAchievementsText}>Voir tous les succès ({playerRanking.achievements.length})</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Mes réservations */}
          <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/my-bookings' as any)} activeOpacity={0.8}>
            <View style={styles.rankingHeader}>
              <Calendar size={18} color={Colors.primary.orange} />
              <Text style={styles.rankingTitle}>Mes réservations</Text>
              <ChevronRight size={16} color={Colors.text.muted} />
            </View>
            {bookingsQuery.isLoading ? (
              <View style={styles.rankingLoading}>
                <Text style={styles.rankingLoadingText}>Chargement des réservations...</Text>
              </View>
            ) : bookingPreview.length > 0 ? (
              <View style={styles.bookingPreviewList}>
                {bookingPreview.map((booking) => {
                  const status = BOOKING_STATUS_UI[booking.status] || BOOKING_STATUS_UI.pending;
                  const venue = venueMap[booking.venueId];
                  const startH = parseInt((booking.startTime || '0').split('T').pop()!.split(':')[0], 10);
                  const endH = parseInt((booking.endTime || '0').split('T').pop()!.split(':')[0], 10);

                  return (
                    <View key={booking.id} style={styles.bookingPreviewItem}>
                      <View style={styles.bookingPreviewTop}>
                        <Text style={styles.bookingPreviewVenue} numberOfLines={1}>{venue?.name || 'Terrain'}</Text>
                        <View style={[styles.bookingPreviewStatusBadge, { backgroundColor: status.color + '22' }]}>
                          <Text style={[styles.bookingPreviewStatusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <View style={styles.bookingPreviewMetaRow}>
                        <Calendar size={12} color={Colors.text.muted} />
                        <Text style={styles.bookingPreviewMetaText}>{booking.date} • {startH}h-{endH}h</Text>
                      </View>
                      {venue?.city ? (
                        <View style={styles.bookingPreviewMetaRow}>
                          <MapPin size={12} color={Colors.text.muted} />
                          <Text style={styles.bookingPreviewMetaText}>{venue.city}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.rankingEmpty}>
                <MapPin size={24} color={Colors.text.muted} />
                <Text style={styles.rankingEmptyText}>Aucune réservation pour le moment</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sports pratiqués</Text>
              <TouchableOpacity onPress={() => router.push('/edit-profile')} style={styles.addSportBtn}>
                <Plus size={16} color={Colors.primary.blue} />
              </TouchableOpacity>
            </View>
            {(() => { if (__DEV__) console.log('User sports:', user?.sports); return (user?.sports ?? []).length > 0; })() ? (
              <View style={styles.sportsBadgesContainer}>
                {(user?.sports ?? []).map((sport, index) => (
                  <View key={index} style={styles.sportBadge}>
                    <Text style={styles.sportBadgeEmoji}>
                      {sport.sport === 'football' ? '⚽' : sport.sport === 'basketball' ? '🏀' : sport.sport === 'volleyball' ? '🏐' : sport.sport === 'tennis' ? '🎾' : '🏃'}
                    </Text>
                    <View style={styles.sportBadgeInfo}>
                      <Text style={styles.sportBadgeName}>{sportLabels[sport.sport] || sport.sport}</Text>
                      <Text style={styles.sportBadgeMeta}>{levelLabels[sport.level]}</Text>
                    </View>
                    {sport.position && <Text style={styles.sportBadgePosition}>{sport.position}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.emptySportsBadge} onPress={() => router.push('/edit-profile')}>
                <Plus size={18} color={Colors.text.muted} />
                <Text style={styles.emptySportsText}>Ajouter un sport</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques</Text>
            <Card style={styles.detailCard} variant="gradient">
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Buts marqués</Text><Text style={styles.detailValue}>{user?.stats?.goalsScored || 0}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Passes décisives</Text><Text style={styles.detailValue}>{user?.stats?.assists || 0}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Tournois gagnés</Text><Text style={styles.detailValue}>{user?.stats?.tournamentWins || 0}</Text></View>
              <View style={[styles.detailRow, styles.lastRow]}><Text style={styles.detailLabel}>Score Fair-Play</Text><View style={styles.fairPlayBadge}><Star size={14} color="#F59E0B" /><Text style={styles.fairPlayValue}>{user?.stats?.fairPlayScore?.toFixed(1) || '5.0'}</Text></View></View>
            </Card>
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trophies')}>
              <Trophy size={20} color={Colors.primary.orange} />
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Trophées et récompenses</Text>
                <Text style={styles.menuSubtext}>{unlockedTrophiesCount} débloqués • {totalXP} XP</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/matches')}>
              <History size={20} color={Colors.text.secondary} />
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Historique des matchs</Text>
                <Text style={styles.menuSubtext}>{userMatches.length} matchs joués</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            {effectiveVerified && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/verification')}>
                <CheckCircle size={20} color={Colors.primary.blue} />
                <Text style={[styles.menuText, { color: Colors.primary.blue }]}>{isAdmin ? 'Compte admin ✓' : 'Compte vérifié ✓'}</Text>
                <ChevronRight size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/teams')}>
              <Compass size={20} color={Colors.text.secondary} />
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Communauté • Équipes qui recrutent</Text>
                <Text style={styles.menuSubtext}>Découvrir et rejoindre des équipes</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Info', 'Partagez votre lien de profil')}>
              <Users size={20} color={Colors.text.secondary} /><Text style={styles.menuText}>Inviter des amis</Text><ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin')}>
                <Shield size={20} color={Colors.primary.orange} /><Text style={[styles.menuText, { color: Colors.primary.orange }]}>Panneau Admin</Text><ChevronRight size={20} color={Colors.primary.orange} />
              </TouchableOpacity>
            )}

          </View>
          <Text testID="version-number" style={[styles.menuSubtext, { textAlign: 'center', marginTop: 16 }]}>v1.0.0</Text>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, marginBottom: 8 },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  profileCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  profileTop: { position: 'relative', marginBottom: 16 },
  avatarWithBadge: { position: 'relative' },
  verifiedBadge: { position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.status.success },
  editButton: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.primary.blue },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' as const },
  profileUsername: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  quickStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, marginTop: 16, marginBottom: 8 },
  quickStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  quickStatIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  quickStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' as const },
  quickStatDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },
  profileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  profileMetaItem: { alignItems: 'center', paddingHorizontal: 20 },
  profileMetaValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' as const },
  profileMetaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  profileMetaDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 16 },
  premiumText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' as const },
  
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 12 },
  trophiesPreview: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  trophiesPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trophiesPreviewTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  trophiesBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  trophyBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  trophyBadgeIcon: { fontSize: 22 },
  moreTrophiesBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  moreTrophiesText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addSportBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  sportsBadgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light },
  sportBadgeEmoji: { fontSize: 20 },
  sportBadgeInfo: { gap: 2 },
  sportBadgeName: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  sportBadgeMeta: { color: Colors.text.muted, fontSize: 11 },
  sportBadgePosition: { color: Colors.primary.blue, fontSize: 11, fontWeight: '500' as const, backgroundColor: 'rgba(21,101,192,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  emptySportsBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, borderStyle: 'dashed' as const },
  emptySportsText: { color: Colors.text.muted, fontSize: 14 },
  detailCard: { paddingVertical: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { color: Colors.text.secondary, fontSize: 14 },
  detailValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  fairPlayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fairPlayValue: { color: '#F59E0B', fontSize: 16, fontWeight: '600' as const },
  menuSection: { backgroundColor: Colors.background.card, borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 12 },
  menuTextContainer: { flex: 1 },
  menuText: { color: Colors.text.primary, fontSize: 15 },
  menuSubtext: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },

  bottomSpacer: { height: 20 },

  // Styles pour la section Ranking
  rankingCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rankingTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  rankingLoading: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  rankingLoadingText: { color: Colors.text.muted, fontSize: 14 },
  rankingContent: { gap: 16 },
  rankingMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  rankingElo: { alignItems: 'center', gap: 4 },
  rankingEloValue: { fontSize: 32, fontWeight: '800', color: Colors.primary.orange },
  rankingEloLabel: { fontSize: 12, color: Colors.text.muted, fontWeight: '500' as const },
  rankingChange: { marginTop: 2 },
  rankingChangeText: { fontSize: 12, fontWeight: '600' as const },
  rankingRank: { alignItems: 'center', gap: 4 },
  rankingRankBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background.cardLight, borderWidth: 1, borderColor: Colors.border.light },
  rankingRankValue: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  rankingRankLabel: { fontSize: 11, color: Colors.text.muted, fontWeight: '500' as const },
  rankingStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  rankingStatItem: { alignItems: 'center', gap: 2 },
  rankingStatValue: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  rankingStatLabel: { fontSize: 10, color: Colors.text.muted, fontWeight: '500' as const },
  rankingBadges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rankingBadge: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankingBadgeIcon: { fontSize: 18 },
  moreBadgesBadge: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  moreBadgesText: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const },
  recentForm: { gap: 8 },
  recentFormLabel: { fontSize: 12, color: Colors.text.muted, fontWeight: '500' as const },
  recentFormRow: { flexDirection: 'row', gap: 6 },
  formBadge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  formWin: { backgroundColor: Colors.status.success + '20' },
  formLoss: { backgroundColor: Colors.status.error + '20' },
  formDraw: { backgroundColor: Colors.text.muted + '20' },
  formText: { fontSize: 11, fontWeight: '700', color: Colors.text.primary },
  rankingEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  rankingEmptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' },
  bookingPreviewList: { gap: 10 },
  bookingPreviewItem: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 10,
    gap: 5,
  },
  bookingPreviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookingPreviewVenue: { flex: 1, color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  bookingPreviewStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  bookingPreviewStatusText: { fontSize: 10, fontWeight: '700' as const },
  bookingPreviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookingPreviewMetaText: { color: Colors.text.muted, fontSize: 12 },

  // Styles pour la section Achievements
  achievementsCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  achievementsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  achievementsTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  achievementsContent: { gap: 16 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  achievementItem: { width: '48%', backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 12, gap: 6 },
  achievementIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  achievementIconText: { fontSize: 20 },
  achievementName: { fontSize: 12, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  achievementDesc: { fontSize: 10, color: Colors.text.muted, lineHeight: 14, marginBottom: 4 },
  achievementDate: { fontSize: 9, color: Colors.text.muted },
  moreAchievements: { alignItems: 'center', paddingTop: 8 },
  moreAchievementsText: { fontSize: 12, color: Colors.primary.blue, fontWeight: '500' as const },
});
