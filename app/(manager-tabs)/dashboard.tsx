import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, MapPin, Calendar, DollarSign, Clock, Check,
  ChevronRight, TrendingUp, Users, AlertCircle, Settings,
  Star, Activity, Eye, Trophy,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { tournamentsApi } from '@/lib/api/tournaments';
import { Card } from '@/components/Card';
import type { Venue, Booking, Tournament } from '@/types';

const REFETCH_INTERVAL = 30_000;

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const cardShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  android: { elevation: 4 },
}) as ViewStyle;

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.status.warning },
  confirmed: { label: 'Confirmée', color: Colors.status.success },
  cancelled: { label: 'Annulée', color: Colors.text.muted },
  rejected: { label: 'Refusée', color: Colors.status.error },
  completed: { label: 'Terminée', color: Colors.primary.blue },
};

export default function ManagerDashboardTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const venuesQuery = useQuery({
    queryKey: ['myVenues', user?.id],
    queryFn: () => venuesApi.getByOwner(user!.id),
    enabled: !!user?.id,
    refetchInterval: REFETCH_INTERVAL,
  });

  const bookingsQuery = useQuery({
    queryKey: ['ownerBookings', user?.id],
    queryFn: () => venuesApi.getOwnerBookings(user!.id),
    enabled: !!user?.id,
    refetchInterval: REFETCH_INTERVAL,
  });

  const tournamentsQuery = useQuery({
    queryKey: ['myTournaments', user?.id],
    queryFn: () => tournamentsApi.getByCreator(user!.id),
    enabled: !!user?.id,
    refetchInterval: REFETCH_INTERVAL,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['myVenues'] }),
      queryClient.invalidateQueries({ queryKey: ['ownerBookings'] }),
      queryClient.invalidateQueries({ queryKey: ['myTournaments'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const venues: Venue[] = venuesQuery.data || [];
  const bookings: Booking[] = bookingsQuery.data || [];
  const tournaments: Tournament[] = tournamentsQuery.data || [];
  const todayStr = toLocalDateStr(new Date());

  const pendingBookings = useMemo(() => bookings.filter(b => b.status === 'pending'), [bookings]);
  const todayBookings = useMemo(() => bookings.filter(b => b.date === todayStr && (b.status === 'confirmed' || b.status === 'pending')), [bookings, todayStr]);
  const upcomingBookings = useMemo(() => bookings.filter(b => b.date >= todayStr && b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).slice(0, 10), [bookings, todayStr]);

  const todayRevenue = useMemo(() => todayBookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.totalPrice, 0), [todayBookings]);
  const thisMonthBookings = useMemo(() => {
    const monthStr = todayStr.slice(0, 7);
    return bookings.filter(b => b.date.startsWith(monthStr) && (b.status === 'confirmed' || b.status === 'completed'));
  }, [bookings, todayStr]);
  const monthRevenue = useMemo(() => thisMonthBookings.reduce((sum, b) => sum + b.totalPrice, 0), [thisMonthBookings]);

  const getVenueName = (venueId: string) => venues.find(v => v.id === venueId)?.name || 'Terrain';

  const isLoading = venuesQuery.isLoading || bookingsQuery.isLoading || tournamentsQuery.isLoading;

  // ──── ONBOARDING ────
  if (!isLoading && venues.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mon Espace</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings' as any)}>
              <Settings size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={[Colors.primary.orange + '15', 'transparent']} style={styles.onboardingGlow} />

            <View style={styles.onboardingIcon}>
              <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.onboardingIconBg}>
                <MapPin size={48} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.onboardingTitle}>Bienvenue, {user?.fullName?.split(' ')[0] || 'Gestionnaire'} !</Text>
            <Text style={styles.onboardingSubtitle}>
              Configurez votre premier terrain pour commencer à recevoir des réservations et générer des revenus.
            </Text>

            <View style={styles.onboardingSteps}>
              {[
                { num: '1', title: 'Créez votre terrain', desc: 'Nom, adresse, sports, prix, équipements...' },
                { num: '2', title: 'Configurez les réservations', desc: 'Approbation auto ou manuelle, horaires...' },
                { num: '3', title: 'Recevez des joueurs', desc: 'Votre terrain sera visible par tous les utilisateurs' },
              ].map((step, i) => (
                <View key={i} style={styles.onboardingStep}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{step.num}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.bigAddButton}
              onPress={() => router.push('/create-venue' as any)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.bigAddGradient}>
                <Plus size={28} color="#FFF" />
                <Text style={styles.bigAddText}>Ajouter terrain</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.onboardingFeatures}>
              <Text style={styles.featuresTitle}>Ce que vous pourrez faire :</Text>
              {[
                { icon: Calendar, text: 'Gérer les réservations en temps réel' },
                { icon: DollarSign, text: 'Suivre vos revenus et statistiques' },
                { icon: Users, text: 'Voir qui réserve vos terrains' },
                { icon: Settings, text: 'Configurer prix, horaires, équipements' },
                { icon: Star, text: 'Recevoir des avis et améliorer votre note' },
              ].map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <feat.icon size={16} color={Colors.primary.orange} />
                  </View>
                  <Text style={styles.featureText}>{feat.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ──── MAIN DASHBOARD ────
  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings' as any)}>
            <Settings size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <>
              {/* Pending alert */}
              {pendingBookings.length > 0 && (
                <TouchableOpacity style={styles.alertBanner} activeOpacity={0.85}>
                  <LinearGradient colors={[Colors.status.warning + '25', Colors.status.warning + '10']} style={styles.alertBannerGradient}>
                    <AlertCircle size={20} color={Colors.status.warning} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{pendingBookings.length} réservation{pendingBookings.length > 1 ? 's' : ''} en attente</Text>
                      <Text style={styles.alertDesc}>Voir l'onglet Réservations pour approuver</Text>
                    </View>
                    <ChevronRight size={18} color={Colors.status.warning} />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Key metrics */}
              <View style={styles.metricsRow}>
                <Card style={[styles.metricCard, cardShadow]}>
                  <View style={[styles.metricIcon, { backgroundColor: Colors.primary.orange + '20' }]}>
                    <DollarSign size={18} color={Colors.primary.orange} />
                  </View>
                  <Text style={styles.metricValue}>{todayRevenue.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>FCFA aujourd'hui</Text>
                </Card>
                <Card style={[styles.metricCard, cardShadow]}>
                  <View style={[styles.metricIcon, { backgroundColor: Colors.primary.blue + '20' }]}>
                    <Calendar size={18} color={Colors.primary.blue} />
                  </View>
                  <Text style={styles.metricValue}>{todayBookings.length}</Text>
                  <Text style={styles.metricLabel}>Résa. aujourd'hui</Text>
                </Card>
              </View>
              <View style={styles.metricsRow}>
                <Card style={[styles.metricCard, cardShadow]}>
                  <View style={[styles.metricIcon, { backgroundColor: Colors.status.success + '20' }]}>
                    <TrendingUp size={18} color={Colors.status.success} />
                  </View>
                  <Text style={styles.metricValue}>{monthRevenue.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>FCFA ce mois</Text>
                </Card>
                <Card style={[styles.metricCard, cardShadow]}>
                  <View style={[styles.metricIcon, { backgroundColor: Colors.status.warning + '20' }]}>
                    <Clock size={18} color={Colors.status.warning} />
                  </View>
                  <Text style={styles.metricValue}>{pendingBookings.length}</Text>
                  <Text style={styles.metricLabel}>En attente</Text>
                </Card>
              </View>

              {/* Today schedule */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Planning du jour</Text>
                <View style={styles.liveBadge}>
                  <Activity size={12} color={Colors.status.success} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              {todayBookings.length > 0 ? (
                todayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(booking => {
                  const sc = statusConfig[booking.status] || statusConfig.pending;
                  const now = new Date();
                  const [startH] = booking.startTime.split(':').map(Number);
                  const [endH] = booking.endTime.split(':').map(Number);
                  const currentH = now.getHours();
                  const isNow = booking.date === todayStr && currentH >= startH && currentH < endH;
                  return (
                    <Card key={booking.id} style={[styles.scheduleCard, isNow && styles.scheduleCardLive]}>
                      {isNow && <View style={styles.scheduleCardLiveBar} />}
                      <View style={styles.scheduleTime}>
                        <Text style={[styles.scheduleTimeText, isNow && { color: Colors.primary.orange }]}>{booking.startTime}</Text>
                        <Text style={styles.scheduleTimeSep}>-</Text>
                        <Text style={styles.scheduleTimeText}>{booking.endTime}</Text>
                      </View>
                      <View style={styles.scheduleInfo}>
                        <Text style={styles.scheduleVenue}>{getVenueName(booking.venueId)}</Text>
                        <Text style={styles.schedulePrice}>{booking.totalPrice.toLocaleString()} FCFA</Text>
                      </View>
                      <View style={[styles.scheduleBadge, { backgroundColor: sc.color + '20' }]}>
                        <Text style={[styles.scheduleBadgeText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    </Card>
                  );
                })
              ) : (
                <Card style={styles.emptySchedule}>
                  <Calendar size={24} color={Colors.text.muted} />
                  <Text style={styles.emptyScheduleText}>Aucune réservation aujourd'hui</Text>
                </Card>
              )}

              {/* Upcoming */}
              {upcomingBookings.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Prochaines réservations</Text>
                  {upcomingBookings.slice(0, 5).map(booking => (
                    <Card key={booking.id} style={styles.upcomingCard}>
                      <View style={styles.upcomingLeft}>
                        <Text style={styles.upcomingDate}>{booking.date}</Text>
                        <Text style={styles.upcomingTime}>{booking.startTime} - {booking.endTime}</Text>
                      </View>
                      <View style={styles.upcomingRight}>
                        <Text style={styles.upcomingVenue}>{getVenueName(booking.venueId)}</Text>
                        <Text style={styles.upcomingPrice}>{booking.totalPrice.toLocaleString()} FCFA</Text>
                      </View>
                    </Card>
                  ))}
                </>
              )}

              {/* My Tournaments */}
              {tournaments.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Mes tournois</Text>
                  {tournaments.slice(0, 3).map(tournament => (
                    <TouchableOpacity
                      key={tournament.id}
                      style={styles.tournamentCard}
                      onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.tournamentCardHeader}>
                        <View style={styles.tournamentCardLeft}>
                          <Text style={styles.tournamentCardName} numberOfLines={1}>{tournament.name}</Text>
                          <Text style={styles.tournamentCardInfo}>
                            {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
                          </Text>
                        </View>
                        <View style={[
                          styles.tournamentCardBadge,
                          tournament.status === 'registration' && { backgroundColor: Colors.status.success + '20' },
                          tournament.status === 'in_progress' && { backgroundColor: Colors.primary.orange + '20' },
                          tournament.status === 'completed' && { backgroundColor: Colors.text.muted + '20' },
                        ]}>
                          <Text style={[
                            styles.tournamentCardBadgeText,
                            tournament.status === 'registration' && { color: Colors.status.success },
                            tournament.status === 'in_progress' && { color: Colors.primary.orange },
                            tournament.status === 'completed' && { color: Colors.text.muted },
                          ]}>
                            {tournament.status === 'registration' ? 'Inscriptions' :
                             tournament.status === 'in_progress' ? 'En cours' : 'Terminé'}
                          </Text>
                        </View>
                      </View>
                      {tournament.venue?.name && (
                        <View style={styles.tournamentCardVenue}>
                          <MapPin size={12} color={Colors.text.muted} />
                          <Text style={styles.tournamentCardVenueText}>{tournament.venue.name}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  {tournaments.length > 3 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => router.push('/tournaments' as any)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.viewAllText}>Voir tous mes tournois ({tournaments.length})</Text>
                      <ChevronRight size={16} color={Colors.primary.orange} />
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Quick actions */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Actions rapides</Text>
              <View style={styles.quickActions}>
                <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => router.push('/create-venue' as any)}>
                  <LinearGradient colors={[Colors.primary.orange + '15', Colors.primary.orange + '05']} style={styles.quickActionBg}>
                    <Plus size={22} color={Colors.primary.orange} />
                    <Text style={styles.quickActionText}>Ajouter un terrain</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => router.push('/create-tournament' as any)}>
                  <LinearGradient colors={[Colors.primary.blue + '15', Colors.primary.blue + '05']} style={styles.quickActionBg}>
                    <Trophy size={22} color={Colors.primary.blue} />
                    <Text style={styles.quickActionText}>Créer un tournoi</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => router.push('/venues' as any)}>
                  <LinearGradient colors={[Colors.status.success + '15', Colors.status.success + '05']} style={styles.quickActionBg}>
                    <Eye size={22} color={Colors.status.success} />
                    <Text style={styles.quickActionText}>Vue publique</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.text.muted, fontSize: 14 },

  // Onboarding
  onboardingContent: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  onboardingGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, borderRadius: 200 },
  onboardingIcon: { marginTop: 20, marginBottom: 24 },
  onboardingIconBg: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  onboardingTitle: { color: Colors.text.primary, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  onboardingSubtitle: { color: Colors.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 320, marginBottom: 32 },
  onboardingSteps: { width: '100%', gap: 16, marginBottom: 32 },
  onboardingStep: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border.light },
  stepNum: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.orange + '20', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: Colors.primary.orange, fontSize: 16, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  stepDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  bigAddButton: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 32 },
  bigAddGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  bigAddText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  onboardingFeatures: { width: '100%', gap: 12, backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border.light },
  featuresTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary.orange + '15', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },

  // Alert
  alertBanner: { marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  alertBannerGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.status.warning + '30' },
  alertTitle: { color: Colors.status.warning, fontSize: 14, fontWeight: '700' },
  alertDesc: { color: Colors.text.muted, fontSize: 12 },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, padding: 14, alignItems: 'center', gap: 6 },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: Colors.text.muted, fontSize: 11, textAlign: 'center' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveText: { color: Colors.status.success, fontSize: 11, fontWeight: '700' },

  // Schedule
  scheduleCard: { marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleCardLive: { borderWidth: 1, borderColor: Colors.primary.orange + '50' },
  scheduleCardLiveBar: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 3, backgroundColor: Colors.primary.orange, borderRadius: 2 },
  scheduleTime: { alignItems: 'center', width: 55 },
  scheduleTimeText: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  scheduleTimeSep: { color: Colors.text.muted, fontSize: 10 },
  scheduleInfo: { flex: 1 },
  scheduleVenue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  schedulePrice: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600', marginTop: 2 },
  scheduleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scheduleBadgeText: { fontSize: 11, fontWeight: '600' },
  emptySchedule: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyScheduleText: { color: Colors.text.muted, fontSize: 14 },

  // Upcoming
  upcomingCard: { marginBottom: 6, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upcomingLeft: { gap: 2 },
  upcomingDate: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' },
  upcomingTime: { color: Colors.text.muted, fontSize: 11 },
  upcomingRight: { alignItems: 'flex-end', gap: 2 },
  upcomingVenue: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' },
  upcomingPrice: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' },

  // Quick actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '47%' as any, borderRadius: 14, overflow: 'hidden' },
  quickActionBg: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20, borderRadius: 14, borderWidth: 1, borderColor: Colors.border.light },
  quickActionText: { color: Colors.text.primary, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Tournaments
  tournamentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  tournamentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  tournamentCardName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  tournamentCardInfo: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tournamentCardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tournamentCardVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tournamentCardVenueText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllText: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600',
  },
});
