import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Settings, Edit2, Trophy, Star, Users, ChevronRight, Shield, Award, TrendingUp, Zap, MapPin, History, CheckCircle, Plus, Compass, Calendar, Ticket as TicketIcon, Receipt, Share2, UserPlus } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useSupport } from '@/contexts/SupportContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useTrophies, ALL_TROPHIES, RARITY_COLORS } from '@/contexts/TrophiesContext';
import { venuesApi } from '@/lib/api/venues';
import { ticketsApi } from '@/lib/api/tickets';
import { invoicesApi } from '@/lib/api/invoices';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels } from '@/mocks/data';
import { rankingApi } from '@/lib/api/ranking';
import { PlayerRanking, Badge } from '@/types/ranking';
import type { Ticket, Invoice } from '@/types';

const BOOKING_STATUS_UI: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.status.warning },
  confirmed: { label: 'Confirmée', color: Colors.status.success },
  rejected: { label: 'Refusée', color: Colors.status.error },
  cancelled: { label: 'Annulée', color: Colors.text.muted },
  completed: { label: 'Terminée', color: Colors.primary.blue },
};

type ProfileTab = 'overview' | 'purchases' | 'social';

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

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

  const ticketsQuery = useQuery({
    queryKey: ['myTickets', user?.id],
    queryFn: () => ticketsApi.getMyTickets(user!.id),
    enabled: !!user?.id,
  });

  const invoicesQuery = useQuery({
    queryKey: ['my-invoices', user?.id],
    queryFn: () => invoicesApi.getUserInvoices(user!.id),
    enabled: !!user?.id,
  });

  const ticketPreview = useMemo(() => {
    const tickets = (ticketsQuery.data || []) as Ticket[];
    if (tickets.length === 0) return [];
    const upcoming = tickets
      .filter(t => t.status === 'valid' || t.status === 'pending_payment')
      .sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime());
    const source = upcoming.length > 0 ? upcoming : [...tickets].sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
    return source.slice(0, 2);
  }, [ticketsQuery.data]);

  const invoicePreview = useMemo(() => {
    const invoices = (invoicesQuery.data || []) as Invoice[];
    if (invoices.length === 0) return [];
    return [...invoices].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()).slice(0, 2);
  }, [invoicesQuery.data]);

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
        ticketsQuery.refetch(),
        invoicesQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      if (user && now - lastRefresh.current > 2000) {
        refreshUser();
        lastRefresh.current = now;
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      checkAndUnlockTrophies(user.id, {
        matchesPlayed: user.stats?.matchesPlayed ?? 0,
        wins: user.stats?.wins ?? 0,
        goalsScored: user.stats?.goalsScored ?? 0,
        assists: user.stats?.assists ?? 0,
        mvpAwards: user.stats?.mvpAwards ?? 0,
        tournamentWins: user.stats?.tournamentWins ?? 0,
        followers: user.followers,
        isVerified: effectiveVerified,
        isPremium: effectivePremium,
        isCaptain: isCaptain || isAdmin,
        fairPlayScore: user.stats?.fairPlayScore ?? 0,
        hasTeam: userTeams.length > 0 || isAdmin,
        profileComplete: !!(user.fullName && user.city && user.sports?.length > 0) || isAdmin,
      });
      
      // Charger le classement du joueur
      loadPlayerRanking();
    }
  }, [user, isCaptain, userTeams.length, isAdmin, effectiveVerified, effectivePremium, checkAndUnlockTrophies]);

  const winRate = user?.stats ? Math.round((user.stats.wins / (user.stats.matchesPlayed || 1)) * 100) : 0;

  const tabs: { key: ProfileTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { key: 'overview', label: 'Aperçu', icon: (a) => <TrendingUp size={15} color={a ? '#FFFFFF' : Colors.text.muted} /> },
    { key: 'purchases', label: 'Achats', icon: (a) => <Calendar size={15} color={a ? '#FFFFFF' : Colors.text.muted} /> },
    { key: 'social', label: 'Social', icon: (a) => <Users size={15} color={a ? '#FFFFFF' : Colors.text.muted} /> },
  ];

  const stats = user?.stats;
  const totalResults = stats ? stats.wins + stats.losses + stats.draws : 0;
  const winPct = totalResults > 0 ? Math.round((stats!.wins / totalResults) * 100) : 0;
  const lossPct = totalResults > 0 ? Math.round((stats!.losses / totalResults) * 100) : 0;
  const drawPct = totalResults > 0 ? Math.round((stats!.draws / totalResults) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
      <View style={styles.safeArea}>
        <ScrollView testID="profile-scroll" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profil</Text>
            <TouchableOpacity testID="btn-settings" style={styles.settingsButton} onPress={() => router.push('/settings')}>
              <Settings size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileCard}>
            {user?.bannerImage ? (
              <>
                <Image source={{ uri: user.bannerImage }} style={styles.profileCoverBg} contentFit="cover" transition={200} />
                <View style={styles.profileCoverOverlay} />
              </>
            ) : (
              <LinearGradient colors={['#1E3A8A', '#0F1F3F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCoverBg} />
            )}
            <View style={styles.profileCardBody}>
              <View style={styles.profileTop}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    <Avatar uri={user?.avatar} name={user?.fullName} size="xlarge" />
                  </View>
                  {effectiveVerified && (
                    <View testID="verified-badge" style={styles.verifiedBadge}>
                      <CheckCircle size={16} color={Colors.status.success} />
                    </View>
                  )}
                </View>
                <TouchableOpacity testID="btn-edit-profile" style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                  <Edit2 size={15} color="#FFFFFF" />
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
                <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push('/followers')} activeOpacity={0.6}>
                  <Text style={styles.profileMetaValue}>{user?.followers || 0}</Text>
                  <Text style={styles.profileMetaLabel}>Abonnés</Text>
                </TouchableOpacity>
                <View style={styles.profileMetaDivider} />
                <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push('/following')} activeOpacity={0.6}>
                  <Text style={styles.profileMetaValue}>{user?.following || 0}</Text>
                  <Text style={styles.profileMetaLabel}>Abonnements</Text>
                </TouchableOpacity>
                <View style={styles.profileMetaDivider} />
                <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push('/my-teams')} activeOpacity={0.6}>
                  <Text style={styles.profileMetaValue}>{userTeams.length}</Text>
                  <Text style={styles.profileMetaLabel}>Équipe</Text>
                </TouchableOpacity>
              </View>
              {(user?.isPremium || isAdmin) && (
                <View style={styles.premiumBadge}>
                  <Shield size={14} color={isAdmin ? Colors.primary.orange : '#F59E0B'} />
                  <Text style={styles.premiumText}>{isAdmin ? 'Admin' : 'Premium'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                {tab.icon(activeTab === tab.key)}
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ==================== TAB 1: Aperçu & Stats ==================== */}
          {activeTab === 'overview' && (
            <>
              {/* Sports pratiqués */}
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
                  <TouchableOpacity style={styles.emptyStateCta} onPress={() => router.push('/edit-profile')}>
                    <Plus size={18} color={Colors.primary.blue} />
                    <Text style={styles.emptyStateCtaText}>Ajouter mon premier sport</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Statistiques — visual grid + W/L/D bar */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Statistiques</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statGridCard}>
                    <Zap size={18} color={Colors.primary.orange} />
                    <Text style={styles.statGridValue}>{user?.stats?.goalsScored || 0}</Text>
                    <Text style={styles.statGridLabel}>Buts</Text>
                  </View>
                  <View style={styles.statGridCard}>
                    <TrendingUp size={18} color={Colors.status.success} />
                    <Text style={styles.statGridValue}>{user?.stats?.assists || 0}</Text>
                    <Text style={styles.statGridLabel}>Passes D.</Text>
                  </View>
                  <View style={styles.statGridCard}>
                    <Trophy size={18} color="#F59E0B" />
                    <Text style={styles.statGridValue}>{user?.stats?.tournamentWins || 0}</Text>
                    <Text style={styles.statGridLabel}>Tournois</Text>
                  </View>
                </View>

                {/* Win/Loss/Draw bar */}
                {totalResults > 0 && (
                  <View style={styles.wldBarContainer}>
                    <View style={styles.wldBar}>
                      <View style={[styles.wldSegmentWin, { flex: winPct }]} />
                      <View style={[styles.wldSegmentDraw, { flex: drawPct }]} />
                      <View style={[styles.wldSegmentLoss, { flex: lossPct }]} />
                    </View>
                    <View style={styles.wldLegend}>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.status.success }]} /><Text style={styles.wldLegendText}>{stats?.wins || 0} V ({winPct}%)</Text></View>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.text.muted }]} /><Text style={styles.wldLegendText}>{stats?.draws || 0} N ({drawPct}%)</Text></View>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.status.error }]} /><Text style={styles.wldLegendText}>{stats?.losses || 0} D ({lossPct}%)</Text></View>
                    </View>
                  </View>
                )}
              </View>

              {/* Trophées — badges only with chevron */}
              {userTrophyList.length > 0 ? (
                <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/trophies')} activeOpacity={0.8}>
                  <View style={styles.rankingHeader}>
                    <Trophy size={18} color={Colors.primary.orange} />
                    <Text style={styles.rankingTitle}>Trophées</Text>
                    <View style={styles.countBadge}><Text style={styles.countBadgeText}>{unlockedTrophiesCount}</Text></View>
                    <ChevronRight size={16} color={Colors.text.muted} />
                  </View>
                  <View style={styles.trophiesBadges}>
                    {(userTrophyList ?? []).map((ut) => (
                      <View key={ut.trophyId} style={styles.trophyBadge}>
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
              ) : (
                <View style={styles.rankingCard}>
                  <View style={styles.rankingHeader}>
                    <Trophy size={18} color={Colors.primary.orange} />
                    <Text style={styles.rankingTitle}>Trophées</Text>
                  </View>
                  <View style={styles.emptyStateRow}>
                    <Text style={styles.emptyStateText}>Aucun trophée débloqué. Joue des matchs pour commencer !</Text>
                  </View>
                </View>
              )}

              {/* Achievements */}
              {playerRanking && playerRanking.achievements.length > 0 && (
                <TouchableOpacity style={styles.achievementsCard} onPress={() => router.push('/achievements' as any)} activeOpacity={0.8}>
                  <View style={styles.achievementsHeader}>
                    <Award size={18} color={Colors.primary.orange} />
                    <Text style={styles.achievementsTitle}>Succès</Text>
                    <View style={styles.countBadge}><Text style={styles.countBadgeText}>{playerRanking.achievements.length}</Text></View>
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

              {/* Bio */}
              {user?.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>À propos</Text>
                  <View style={styles.bioCard}>
                    <Text style={styles.bioText}>{user.bio}</Text>
                  </View>
                </View>
              )}

              {effectiveVerified && (
                <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/verification')} activeOpacity={0.8}>
                  <View style={styles.rankingHeader}>
                    <CheckCircle size={18} color={Colors.primary.blue} />
                    <Text style={[styles.rankingTitle, { color: Colors.primary.blue }]}>{isAdmin ? 'Compte admin ✓' : 'Compte vérifié ✓'}</Text>
                    <ChevronRight size={16} color={Colors.text.muted} />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ==================== TAB 2: Réservations & Achats ==================== */}
          {activeTab === 'purchases' && (
            <>
              {/* Mes réservations */}
              <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/my-bookings' as any)} activeOpacity={0.8}>
                <View style={styles.rankingHeader}>
                  <Calendar size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Mes réservations</Text>
                  {bookingPreview.length > 0 && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{bookingPreview.length}</Text></View>}
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
                  <TouchableOpacity style={styles.emptyStateCta} onPress={() => router.push('/(tabs)/venues' as any)}>
                    <MapPin size={18} color={Colors.primary.blue} />
                    <Text style={styles.emptyStateCtaText}>Réserver mon premier terrain</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Mes billets */}
              <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/my-tickets' as any)} activeOpacity={0.8}>
                <View style={styles.rankingHeader}>
                  <TicketIcon size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Mes billets</Text>
                  {ticketPreview.length > 0 && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{ticketPreview.length}</Text></View>}
                  <ChevronRight size={16} color={Colors.text.muted} />
                </View>
                {ticketsQuery.isLoading ? (
                  <View style={styles.rankingLoading}>
                    <Text style={styles.rankingLoadingText}>Chargement des billets...</Text>
                  </View>
                ) : ticketPreview.length > 0 ? (
                  <View style={styles.bookingPreviewList}>
                    {ticketPreview.map((ticket) => {
                      const isUpcoming = ticket.status === 'valid' || ticket.status === 'pending_payment';
                      const statusColor = isUpcoming ? Colors.status.success : Colors.text.muted;
                      const statusLabel = ticket.status === 'valid' ? 'Valide' : ticket.status === 'pending_payment' ? 'En attente' : ticket.status === 'used' ? 'Utilisé' : ticket.status === 'cancelled' ? 'Annulé' : 'Remboursé';
                      return (
                        <View key={ticket.id} style={styles.bookingPreviewItem}>
                          <View style={styles.bookingPreviewTop}>
                            <Text style={styles.bookingPreviewVenue} numberOfLines={1}>{ticket.eventInfo?.name || 'Billet'}</Text>
                            <View style={[styles.bookingPreviewStatusBadge, { backgroundColor: statusColor + '22' }]}>
                              <Text style={[styles.bookingPreviewStatusText, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.bookingPreviewMetaRow}>
                            <TicketIcon size={12} color={Colors.text.muted} />
                            <Text style={styles.bookingPreviewMetaText}>{ticket.ticketType?.name || 'Billet'} • {ticket.ticketCode}</Text>
                          </View>
                          {ticket.eventInfo?.date && (
                            <View style={styles.bookingPreviewMetaRow}>
                              <Calendar size={12} color={Colors.text.muted} />
                              <Text style={styles.bookingPreviewMetaText}>{new Date(ticket.eventInfo.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptyStateCta} onPress={() => router.push('/(tabs)/tournaments')}>
                    <TicketIcon size={18} color={Colors.primary.blue} />
                    <Text style={styles.emptyStateCtaText}>Acheter mon premier billet</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Mes factures */}
              <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/my-invoices' as any)} activeOpacity={0.8}>
                <View style={styles.rankingHeader}>
                  <Receipt size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Mes factures</Text>
                  {invoicePreview.length > 0 && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{invoicePreview.length}</Text></View>}
                  <ChevronRight size={16} color={Colors.text.muted} />
                </View>
                {invoicesQuery.isLoading ? (
                  <View style={styles.rankingLoading}>
                    <Text style={styles.rankingLoadingText}>Chargement des factures...</Text>
                  </View>
                ) : invoicePreview.length > 0 ? (
                  <View style={styles.bookingPreviewList}>
                    {invoicePreview.map((inv) => {
                      const statusColor = inv.status === 'paid' ? Colors.status.success : inv.status === 'issued' ? Colors.status.warning : inv.status === 'refunded' ? Colors.status.info : Colors.text.muted;
                      const statusLabel = inv.status === 'paid' ? 'Payée' : inv.status === 'issued' ? 'Émise' : inv.status === 'refunded' ? 'Remboursée' : 'Annulée';
                      const typeLabel = inv.contextType === 'booking' ? 'Réservation' : inv.contextType === 'tournament_registration' ? 'Tournoi' : inv.contextType === 'ticket_purchase' ? 'Billets' : inv.contextType === 'venue_advance' ? 'Avance terrain' : 'Paiement';
                      return (
                        <View key={inv.id} style={styles.bookingPreviewItem}>
                          <View style={styles.bookingPreviewTop}>
                            <Text style={styles.bookingPreviewVenue} numberOfLines={1}>{inv.invoiceNumber}</Text>
                            <View style={[styles.bookingPreviewStatusBadge, { backgroundColor: statusColor + '22' }]}>
                              <Text style={[styles.bookingPreviewStatusText, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.bookingPreviewMetaRow}>
                            <Receipt size={12} color={Colors.text.muted} />
                            <Text style={styles.bookingPreviewMetaText}>{typeLabel} • {inv.amount.toLocaleString()} {inv.currency || 'FCFA'}</Text>
                          </View>
                          <View style={styles.bookingPreviewMetaRow}>
                            <Calendar size={12} color={Colors.text.muted} />
                            <Text style={styles.bookingPreviewMetaText}>{new Date(inv.paidAt || inv.issuedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyStateRow}>
                    <Text style={styles.emptyStateText}>Aucune facture pour le moment</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ==================== TAB 3: Social ==================== */}
          {activeTab === 'social' && (
            <>
              {/* Mes équipes */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Mes équipes</Text>
                  {userTeams.length > 3 && (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/teams')}>
                      <Text style={styles.seeAllText}>Voir tout</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {userTeams.length > 0 ? (
                  <View style={styles.teamPreviewList}>
                    {userTeams.slice(0, 3).map((t) => (
                      <TouchableOpacity key={t.id} style={styles.teamPreviewItem} onPress={() => router.push('/(tabs)/teams')} activeOpacity={0.7}>
                        <View style={styles.teamPreviewIcon}>
                          <Text style={styles.teamPreviewEmoji}>
                            {t.sport === 'football' ? '⚽' : t.sport === 'basketball' ? '🏀' : t.sport === 'volleyball' ? '🏐' : t.sport === 'tennis' ? '🎾' : '🏃'}
                          </Text>
                        </View>
                        <View style={styles.teamPreviewInfo}>
                          <Text style={styles.teamPreviewName} numberOfLines={1}>{t.name}</Text>
                          <Text style={styles.teamPreviewMeta}>{t.sport} • {t.format}</Text>
                        </View>
                        {t.captainId === user?.id && (
                          <View style={styles.teamCaptainBadge}>
                            <Text style={styles.teamCaptainText}>Capitaine</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptyStateCta} onPress={() => router.push('/(tabs)/teams')}>
                    <Users size={18} color={Colors.primary.blue} />
                    <Text style={styles.emptyStateCtaText}>Rejoindre ou créer une équipe</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Abonnés / Abonnements */}
              <View style={styles.rankingCard}>
                <View style={styles.rankingHeader}>
                  <Users size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Abonnés & Abonnements</Text>
                </View>
                <View style={styles.socialStatsRow}>
                  <TouchableOpacity style={styles.socialStatTouchable} onPress={() => router.push('/followers')} activeOpacity={0.6}>
                    <Text style={styles.socialStatValue}>{user?.followers || 0}</Text>
                    <Text style={styles.socialStatLabel}>Abonnés</Text>
                  </TouchableOpacity>
                  <View style={styles.socialStatDivider} />
                  <TouchableOpacity style={styles.socialStatTouchable} onPress={() => router.push('/following')} activeOpacity={0.6}>
                    <Text style={styles.socialStatValue}>{user?.following || 0}</Text>
                    <Text style={styles.socialStatLabel}>Abonnements</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Communauté */}
              <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/(tabs)/teams')} activeOpacity={0.8}>
                <View style={styles.rankingHeader}>
                  <Compass size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Communauté</Text>
                  <ChevronRight size={16} color={Colors.text.muted} />
                </View>
                <View style={styles.emptyStateRow}>
                  <UserPlus size={20} color={Colors.primary.blue} />
                  <Text style={styles.emptyStateText}>Découvrir et rejoindre des équipes près de chez vous</Text>
                </View>
              </TouchableOpacity>

              {/* Inviter des amis */}
              <TouchableOpacity style={styles.rankingCard} onPress={() => Alert.alert('Inviter des amis', 'Partagez votre lien de profil')} activeOpacity={0.8}>
                <View style={styles.rankingHeader}>
                  <Share2 size={18} color={Colors.primary.orange} />
                  <Text style={styles.rankingTitle}>Inviter des amis</Text>
                  <ChevronRight size={16} color={Colors.text.muted} />
                </View>
                <Text style={styles.rankingSubtitle}>Partagez votre lien de profil</Text>
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity style={styles.rankingCard} onPress={() => router.push('/admin')} activeOpacity={0.8}>
                  <View style={styles.rankingHeader}>
                    <Shield size={18} color={Colors.primary.orange} />
                    <Text style={[styles.rankingTitle, { color: Colors.primary.orange }]}>Panneau Admin</Text>
                    <ChevronRight size={16} color={Colors.primary.orange} />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}

          <Text testID="version-number" style={[styles.menuSubtext, { textAlign: 'center', marginTop: 16 }]}>v1.0.0</Text>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d111d' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 35 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingVertical: 16, marginBottom: 8 },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  profileCard: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', backgroundColor: Colors.background.card },
  profileCoverBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%' },
  profileCoverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  profileCardBody: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 40 },
  profileTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  avatarRing: { position: 'relative', padding: 4, borderRadius: 60, backgroundColor: Colors.background.card },
  avatarInner: { borderRadius: 56, overflow: 'hidden' },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.background.dark, alignItems: 'center', justifyContent: 'center' },
  editButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
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

  // Tab Bar — segmented pill
  tabBar: { flexDirection: 'row', backgroundColor: Colors.background.cardLight, borderRadius: 16, padding: 4, marginBottom: 20, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  tabItemActive: { backgroundColor: Colors.primary.blue, shadowColor: Colors.primary.blue, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  tabLabel: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const, textAlign: 'center' },
  tabLabelActive: { color: '#FFFFFF' },

  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addSportBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  sportsBadgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  sportBadgeEmoji: { fontSize: 20 },
  sportBadgeInfo: { gap: 2 },
  sportBadgeName: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  sportBadgeMeta: { color: Colors.text.muted, fontSize: 11 },
  sportBadgePosition: { color: Colors.primary.blue, fontSize: 11, fontWeight: '500' as const, backgroundColor: 'rgba(21,101,192,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  detailCard: { paddingVertical: 8, borderRadius: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  lastRow: {},
  detailLabel: { color: Colors.text.secondary, fontSize: 14 },
  detailValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  menuSubtext: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },

  bottomSpacer: { height: 80 },

  // Cards (harmonized border-radius to 20)
  rankingCard: { backgroundColor: Colors.background.card, borderRadius: 20, padding: 16, marginBottom: 16 },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rankingTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  rankingSubtitle: { color: Colors.text.muted, fontSize: 13 },
  rankingLoading: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  rankingLoadingText: { color: Colors.text.muted, fontSize: 14 },
  rankingEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  rankingEmptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' },

  // Empty states
  emptyStateRow: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyStateText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' },
  emptyStateCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.cardLight, paddingVertical: 14, borderRadius: 16 },
  emptyStateCtaText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '600' as const },

  // Social stats
  socialStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  socialStatItem: { alignItems: 'center', paddingHorizontal: 24, gap: 4 },
  socialStatValue: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const },
  socialStatLabel: { color: Colors.text.muted, fontSize: 12 },
  socialStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
  socialStatTouchable: { alignItems: 'center', paddingHorizontal: 24, gap: 4 },

  // Trophies badges
  trophiesBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  trophyBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  trophyBadgeIcon: { fontSize: 22 },
  moreTrophiesBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  moreTrophiesText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },

  // Booking preview
  bookingPreviewList: { gap: 10 },
  bookingPreviewItem: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  bookingPreviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookingPreviewVenue: { flex: 1, color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  bookingPreviewStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  bookingPreviewStatusText: { fontSize: 10, fontWeight: '700' as const },
  bookingPreviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookingPreviewMetaText: { color: Colors.text.muted, fontSize: 12 },

  // Stat grid
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statGridCard: { flex: 1, backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  statGridValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' as const },
  statGridLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },

  // Win/Loss/Draw bar
  wldBarContainer: { marginTop: 4 },
  wldBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: Colors.background.cardLight },
  wldSegmentWin: { backgroundColor: Colors.status.success },
  wldSegmentDraw: { backgroundColor: Colors.text.muted },
  wldSegmentLoss: { backgroundColor: Colors.status.error },
  wldLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  wldLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wldDot: { width: 8, height: 8, borderRadius: 4 },
  wldLegendText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },

  // Bio
  bioCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 14 },
  bioText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20 },

  // See all link
  seeAllText: { color: Colors.primary.blue, fontSize: 13, fontWeight: '600' as const },

  // Count badge
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary.orange + '20', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700' as const },

  // Team preview
  teamPreviewList: { gap: 8 },
  teamPreviewItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, borderRadius: 14, padding: 10, gap: 10 },
  teamPreviewIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary.blue + '20', alignItems: 'center', justifyContent: 'center' },
  teamPreviewEmoji: { fontSize: 18 },
  teamPreviewInfo: { flex: 1, gap: 2 },
  teamPreviewName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  teamPreviewMeta: { color: Colors.text.muted, fontSize: 12 },
  teamCaptainBadge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  teamCaptainText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' as const },

  // Achievements
  achievementsCard: { backgroundColor: Colors.background.card, borderRadius: 20, padding: 16, marginBottom: 16 },
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
