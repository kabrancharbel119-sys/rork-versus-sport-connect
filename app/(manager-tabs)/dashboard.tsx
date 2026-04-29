import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, MapPin, Calendar, DollarSign, Clock, Check,
  ChevronRight, TrendingUp, Users, AlertCircle, Settings,
  Star, Activity, Eye, Trophy, ScanLine,
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
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 25 },
  android: { elevation: 10 },
}) as ViewStyle;

const GlassCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.glassCard, cardShadow, style]}>
    {Platform.OS === 'ios' ? (
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
    ) : null}
    <View style={styles.glassCardInner}>{children}</View>
  </View>
);

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

  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greeting = hour < 18 ? 'Bonjour' : 'Bonsoir';
  const firstName = user?.fullName?.split(' ')[0] || 'Gestionnaire';

  // ──── MAIN DASHBOARD ────
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a1628', '#070d1a', '#000000']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(30,60,120,0.35)', 'transparent']}
        style={styles.radialGlow}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerDate}>{todayLabel}</Text>
            <Text style={styles.headerTitle}>{greeting}, {firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            {venues.length > 0 && (
              <View style={styles.venuesBadge}>
                <MapPin size={11} color={Colors.primary.orange} />
                <Text style={styles.venuesBadgeText}>{venues.length} terrain{venues.length > 1 ? 's' : ''}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings' as any)}>
              <Settings size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
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
              {/* Compact toast alert */}
              {pendingBookings.length > 0 && (
                <TouchableOpacity style={styles.toastAlert} activeOpacity={0.85}>
                  <AlertCircle size={14} color={Colors.status.warning} />
                  <Text style={styles.toastAlertText}>
                    <Text style={styles.toastAlertBold}>{pendingBookings.length}</Text> réservation{pendingBookings.length > 1 ? 's' : ''} en attente · Onglet Réservations
                  </Text>
                  <ChevronRight size={13} color={Colors.status.warning + 'AA'} />
                </TouchableOpacity>
              )}

              {/* Bento metrics grid */}
              <View style={styles.bentoGrid}>
                <GlassCard style={styles.bentoWide}>
                  <View style={[styles.metricIconBento, { backgroundColor: Colors.primary.orange + '18' }]}>
                    <DollarSign size={15} color={Colors.primary.orange} />
                  </View>
                  <Text style={styles.metricValueLarge}>{todayRevenue.toLocaleString()}</Text>
                  <Text style={styles.metricLabelDim}>FCFA aujourd'hui</Text>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricFooter}>
                    <Activity size={10} color={Colors.primary.orange + '80'} />
                    <Text style={styles.metricFooterText}>{todayBookings.length} résa. confirmée{todayBookings.length > 1 ? 's' : ''}</Text>
                  </View>
                </GlassCard>

                <GlassCard style={styles.bentoSquare}>
                  <View style={[styles.metricIconBento, { backgroundColor: Colors.primary.blue + '18' }]}>
                    <Calendar size={15} color={Colors.primary.blue} />
                  </View>
                  <Text style={styles.metricValueLarge}>{todayBookings.length}</Text>
                  <Text style={styles.metricLabelDim}>Résa. aujourd'hui</Text>
                </GlassCard>

                <GlassCard style={styles.bentoWide}>
                  <View style={[styles.metricIconBento, { backgroundColor: '#10b98118' }]}>
                    <TrendingUp size={15} color="#10b981" />
                  </View>
                  <Text style={[styles.metricValueLarge, styles.metricValueEmerald]}>{monthRevenue.toLocaleString()}</Text>
                  <Text style={styles.metricLabelDim}>FCFA ce mois</Text>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricFooter}>
                    <Activity size={10} color='#10b98180' />
                    <Text style={styles.metricFooterText}>{thisMonthBookings.length} résa. ce mois</Text>
                  </View>
                </GlassCard>

                <GlassCard style={styles.bentoSquare}>
                  <View style={[styles.metricIconBento, { backgroundColor: Colors.status.warning + '18' }]}>
                    <Clock size={15} color={Colors.status.warning} />
                  </View>
                  <Text style={styles.metricValueLarge}>{pendingBookings.length}</Text>
                  <Text style={styles.metricLabelDim}>En attente</Text>
                </GlassCard>
              </View>

              {/* Action Buttons */}
              <View style={styles.sectionLabelRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>Actions du jour</Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonScan]}
                  onPress={() => router.push('/manager/scan-qr')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FF8C42', '#FF6B35', '#e85d20']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.actionButtonGradient}
                  >
                    <View style={styles.actionIconCircle}>
                      <ScanLine size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionButtonText}>Scanner QR</Text>
                      <Text style={styles.actionButtonSub}>Valider les arrivées des joueurs</Text>
                    </View>
                    <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonBookings]}
                  onPress={() => router.push('/(manager-tabs)/bookings')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionButtonGradient}>
                    <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(147,197,253,0.15)' }]}>
                      <Calendar size={18} color="#93c5fd" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionButtonText, { color: '#93c5fd' }]}>Réservations</Text>
                      <Text style={[styles.actionButtonSub, { color: 'rgba(147,197,253,0.5)' }]}>
                        {pendingBookings.length > 0 ? `${pendingBookings.length} en attente d'approbation` : 'Gérer les demandes'}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="rgba(147,197,253,0.4)" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* My Tournaments */}
              {tournaments.length > 0 && (
                <>
                  <View style={[styles.sectionLabelRow, { marginTop: 24 }]}>
                    <View style={[styles.sectionAccent, { backgroundColor: Colors.primary.orange }]} />
                    <Text style={styles.sectionTitle}>Mes tournois</Text>
                    <Text style={styles.sectionCount}>{tournaments.length}</Text>
                  </View>
                  {tournaments.slice(0, 3).map(tournament => {
                    const fillRatio = tournament.maxTeams > 0 ? tournament.registeredTeams.length / tournament.maxTeams : 0;
                    const statusColor = tournament.status === 'registration' ? Colors.status.success : tournament.status === 'in_progress' ? Colors.primary.orange : Colors.text.muted;
                    return (
                    <TouchableOpacity
                      key={tournament.id}
                      style={[styles.tournamentCard, cardShadow]}
                      onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.tournamentCardHeader}>
                        <View style={styles.tournamentCardLeft}>
                          <Text style={styles.tournamentCardName} numberOfLines={1}>{tournament.name}</Text>
                          {tournament.venue?.name && (
                            <View style={[styles.tournamentCardVenue, { marginTop: 3 }]}>
                              <MapPin size={11} color={Colors.text.muted} />
                              <Text style={styles.tournamentCardVenueText}>{tournament.venue.name}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.tournamentCardBadge, { backgroundColor: statusColor + '18' }]}>
                          <Text style={[styles.tournamentCardBadgeText, { color: statusColor }]}>
                            {tournament.status === 'registration' ? 'Inscriptions' :
                             tournament.status === 'in_progress' ? 'En cours' : 'Terminé'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tournamentProgress}>
                        <View style={styles.tournamentProgressTrack}>
                          <View style={[styles.tournamentProgressFill, { width: `${Math.min(fillRatio * 100, 100)}%` as any, backgroundColor: statusColor }]} />
                        </View>
                        <Text style={styles.tournamentProgressLabel}>
                          {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )})}
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
              <View style={[styles.sectionLabelRow, { marginTop: 24 }]}>
                <View style={[styles.sectionAccent, { backgroundColor: Colors.status.success }]} />
                <Text style={styles.sectionTitle}>Actions rapides</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
                {([
                  { icon: Plus, label: 'Nouveau\nterrain', color: Colors.primary.orange, route: '/create-venue' },
                  { icon: Trophy, label: 'Nouveau\ntournoi', color: Colors.primary.blue, route: '/create-tournament' },
                  { icon: Eye, label: 'Vue\npublique', color: Colors.status.success, route: '/venues' },
                  { icon: MapPin, label: 'Mes\nterrains', color: '#a78bfa', route: '/(manager-tabs)/my-venues' },
                ] as const).map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickChip}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.quickChipIcon, { backgroundColor: item.color + '18', borderColor: item.color + '30' }]}>
                      <item.icon size={22} color={item.color} />
                    </View>
                    <Text style={styles.quickChipLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
  radialGlow: {
    position: 'absolute', top: -120, left: -80, right: -80, height: 420,
    borderRadius: 300,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerDate: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '500', textTransform: 'capitalize', marginBottom: 2 },
  headerTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  venuesBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary.orange + '14',
    borderWidth: 1, borderColor: Colors.primary.orange + '30',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  venuesBadgeText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '600' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.text.muted, fontSize: 14 },

  // Glass card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  glassCardInner: { padding: 16 },

  // Bento grid
  bentoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  bentoWide: { flex: 1, minWidth: '55%' as any },
  bentoSquare: { flex: 0, width: '40%' as any },

  // Metric bento
  metricIconBento: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  metricValueLarge: {
    color: Colors.text.primary, fontSize: 26, fontWeight: '800',
    letterSpacing: -0.5, marginBottom: 4,
  },
  metricValueEmerald: {
    color: '#10b981',
  },
  metricLabelDim: {
    color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500',
  },

  // Metric footer
  metricDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },
  metricFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricFooterText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },

  // Toast alert
  toastAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 14,
  },
  toastAlertText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 11.5, lineHeight: 16 },
  toastAlertBold: { color: Colors.status.warning, fontWeight: '700' },

  // Section label
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary.orange },
  sectionCount: {
    marginLeft: 'auto' as any,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11, fontWeight: '600',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },

  // Upcoming bookings
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcomingDateBox: {
    width: 44, height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 0,
  },
  upcomingDateDay: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  upcomingDateMon: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  upcomingVenueName: { color: Colors.text.primary, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  upcomingTime: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  upcomingPrice: { color: '#10b981', fontSize: 13, fontWeight: '700' },

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

  // (legacy metric styles kept for onboarding screen)
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, padding: 14, alignItems: 'center', gap: 6 },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: Colors.text.muted, fontSize: 11, textAlign: 'center' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveText: { color: Colors.status.success, fontSize: 11, fontWeight: '700' },


  // Action row
  actionRow: { flexDirection: 'column', gap: 10, marginBottom: 4 },

  // Action icon circle
  actionIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionButtonSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },

  // Tournament progress
  tournamentProgress: { marginTop: 10 },
  tournamentProgressTrack: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2, marginBottom: 5, overflow: 'hidden',
  },
  tournamentProgressFill: { height: 3, borderRadius: 2 },
  tournamentProgressLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '500' },

  // Quick actions scroll
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 0 },
  quickActionsScroll: { paddingBottom: 4, gap: 10 },
  quickChip: { alignItems: 'center', gap: 8, width: 80 },
  quickChipIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickChipLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  quickAction: { width: '47%' as any },
  quickActionInner: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickActionText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Tournaments
  tournamentCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
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
  
  // Action buttons
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionButtonScan: {
    ...Platform.select({
      ios: { shadowColor: Colors.primary.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
  actionButtonBookings: {
    backgroundColor: 'rgba(30, 64, 120, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.2)',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  qrReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,53,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  qrReminderText: {
    flex: 1,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    lineHeight: 16,
  },
});
