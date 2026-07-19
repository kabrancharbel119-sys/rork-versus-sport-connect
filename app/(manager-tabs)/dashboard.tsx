import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, ViewStyle, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, MapPin, Calendar, DollarSign, Clock,
  ChevronRight, Users, AlertCircle, Settings,
  Star, Eye, Trophy, ScanLine, Bell, Wallet,
  BarChart3, Users2,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { tournamentsApi } from '@/lib/api/tournaments';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Avatar } from '@/components/Avatar';
import type { Venue, Booking, Tournament } from '@/types';

const REFETCH_INTERVAL = 30_000;
const PAD = 20;

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const cardShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 3 },
}) as ViewStyle;

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.status.warning },
  confirmed: { label: 'Confirmée', color: Colors.status.success },
  cancelled: { label: 'Annulée', color: Colors.text.muted },
  rejected: { label: 'Refusée', color: Colors.status.error },
  completed: { label: 'Terminée', color: Colors.primary.blue },
};

/* Animated pulsing dot for live indicators */
const PulseDot = ({ color = '#10B981', size = 6 }: { color?: string; size?: number }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }} />
  );
};

/* Pressable card with scale feedback */
const PressableCard = ({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], ...style }}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

/* Section header component */
const SectionHeader = ({ title, accentColor, count, onSeeAll }: { title: string; accentColor?: string; count?: number; onSeeAll?: () => void }) => (
  <View style={styles.sectionLabelRow}>
    <View style={[styles.sectionAccent, accentColor ? { backgroundColor: accentColor } : undefined]} />
    <Text style={styles.sectionTitle}>{title}</Text>
    {count !== undefined && (
      <View style={styles.sectionCountBadge}><Text style={styles.sectionCountText}>{count}</Text></View>
    )}
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
        <Text style={styles.seeAllText}>Tout voir</Text>
        <ChevronRight size={14} color={Colors.primary.orange} />
      </TouchableOpacity>
    )}
  </View>
);

export default function ManagerDashboardTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { notifications } = useNotifications();
  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

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

  const todayRevenue = useMemo(() => todayBookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.totalPrice, 0), [todayBookings]);
  const getVenueName = (venueId: string) => venues.find(v => v.id === venueId)?.name || 'Terrain';

  const isLoading = venuesQuery.isLoading || bookingsQuery.isLoading || tournamentsQuery.isLoading;

  const firstName = user?.fullName?.split(' ')[0] || 'Gestionnaire';

  // ──── ONBOARDING ────
  if (!isLoading && venues.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mon Espace</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(manager-tabs)/notifications' as any)}>
                <Bell size={18} color={Colors.text.secondary} />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/settings' as any)}>
                <Settings size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
            <View style={styles.onboardingIcon}>
              <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.onboardingIconBg}>
                <MapPin size={48} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.onboardingTitle}>Bienvenue, {firstName} !</Text>
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

            <PressableCard onPress={() => router.push('/create-venue' as any)} style={styles.bigAddButtonWrap}>
              <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.bigAddGradient}>
                <Plus size={24} color="#FFF" />
                <Text style={styles.bigAddText}>Ajouter un terrain</Text>
              </LinearGradient>
            </PressableCard>

            <View style={styles.onboardingFeatures}>
              <Text style={styles.featuresTitle}>Ce que vous pourrez faire</Text>
              {[
                { icon: Calendar, text: 'Gérer les réservations en temps réel' },
                { icon: DollarSign, text: 'Suivre vos revenus et statistiques' },
                { icon: Users, text: 'Voir qui réserve vos terrains' },
                { icon: Settings, text: 'Configurer prix, horaires, équipements' },
                { icon: Star, text: 'Recevoir des avis et améliorer votre note' },
              ].map((feat, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <feat.icon size={15} color={Colors.primary.orange} />
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ════ HEADER ════ */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PressableCard onPress={() => router.push('/(manager-tabs)/manager-profile' as any)} style={styles.avatarRingWrap}>
              <View style={styles.avatarRing}>
                <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
              </View>
            </PressableCard>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{firstName}</Text>
              <Text style={styles.headerRole}>Gestionnaire</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {venues.length > 0 && (
              <View style={styles.venuesBadge}>
                <MapPin size={11} color={Colors.primary.orange} />
                <Text style={styles.venuesBadgeText}>{venues.length}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(manager-tabs)/notifications' as any)}>
              <Bell size={17} color={Colors.text.secondary} />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/settings' as any)}>
              <Settings size={17} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.ScrollView
          style={[styles.scrollView, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
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
              {/* ════ PENDING ALERT BANNER ════ */}
              {pendingBookings.length > 0 && (
                <PressableCard onPress={() => router.push('/(manager-tabs)/bookings')} style={styles.alertBannerWrap}>
                  <LinearGradient
                    colors={[Colors.status.warning + '20', Colors.status.warning + '08']}
                    style={styles.alertBanner}
                  >
                    <View style={styles.alertIconWrap}>
                      <AlertCircle size={16} color={Colors.status.warning} />
                    </View>
                    <View style={styles.alertTextWrap}>
                      <Text style={styles.alertTitle}>{pendingBookings.length} réservation{pendingBookings.length > 1 ? 's' : ''} en attente</Text>
                      <Text style={styles.alertSub}>Appuyez pour approuver ou refuser</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.status.warning + 'AA'} />
                  </LinearGradient>
                </PressableCard>
              )}

              {/* ════ METRICS — 2 cards ════ */}
              <View style={styles.metricsRow}>
                <PressableCard onPress={() => router.push('/(manager-tabs)/bookings')} style={styles.metricCardWrap}>
                  <View style={[styles.metricCard, cardShadow]}>
                    <View style={[styles.metricIconBox, { backgroundColor: Colors.primary.orange + '15' }]}>
                      <Wallet size={16} color={Colors.primary.orange} />
                    </View>
                    <View style={styles.metricTextCol}>
                      <Text style={styles.metricValue}>{todayRevenue.toLocaleString()}<Text style={styles.metricUnit}> FCFA</Text></Text>
                      <Text style={styles.metricLabel}>{`Aujourd'hui · ${todayBookings.length} résa.`}</Text>
                    </View>
                  </View>
                </PressableCard>

                <PressableCard onPress={() => router.push('/(manager-tabs)/bookings')} style={styles.metricCardWrap}>
                  <View style={[styles.metricCard, cardShadow]}>
                    <View style={[styles.metricIconBox, { backgroundColor: pendingBookings.length > 0 ? Colors.status.warning + '15' : Colors.status.success + '15' }]}>
                      <Clock size={16} color={pendingBookings.length > 0 ? Colors.status.warning : Colors.status.success} />
                    </View>
                    <View style={styles.metricTextCol}>
                      <Text style={styles.metricValue}>{pendingBookings.length}</Text>
                      <Text style={styles.metricLabel}>En attente</Text>
                    </View>
                  </View>
                </PressableCard>
              </View>

              {/* ════ QR SCAN — primary CTA ════ */}
              <PressableCard onPress={() => router.push('/manager/scan-qr')} style={styles.scanCtaWrap}>
                <LinearGradient
                  colors={['#FF8C42', '#FF6B35', '#e85d20']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.scanCta}
                >
                  <View style={styles.scanIconCircle}>
                    <ScanLine size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanCtaTitle}>Scanner QR</Text>
                    <Text style={styles.scanCtaSub}>Valider les arrivées des joueurs</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </PressableCard>

              {/* ════ PLANNING DU JOUR ════ */}
              <SectionHeader title="Planning du jour" accentColor={Colors.status.success} count={todayBookings.length} onSeeAll={() => router.push('/(manager-tabs)/bookings')} />
              {todayBookings.length > 0 ? (
                <View style={styles.timeline}>
                  {todayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((booking, idx) => {
                    const sc = statusConfig[booking.status] || statusConfig.pending;
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    const [sH, sM] = booking.startTime.split(':').map(Number);
                    const [eH, eM] = booking.endTime.split(':').map(Number);
                    const startMin = sH * 60 + sM;
                    const endMin = eH * 60 + eM;
                    const isNow = booking.date === todayStr && nowMin >= startMin && nowMin < endMin;
                    const isPast = booking.date === todayStr && nowMin >= endMin;
                    return (
                      <PressableCard key={booking.id} onPress={() => router.push('/(manager-tabs)/bookings')} style={styles.timelineItemWrap}>
                        <View style={[styles.timelineItem, isNow && styles.timelineItemLive, isPast && styles.timelineItemPast]}>
                          {isNow && <View style={styles.timelineLiveBar} />}
                          <View style={styles.timelineTime}>
                            <Text style={[styles.timelineTimeText, isNow && { color: Colors.primary.orange }]}>{booking.startTime}</Text>
                            <Text style={styles.timelineTimeSep}>→</Text>
                            <Text style={styles.timelineTimeText}>{booking.endTime}</Text>
                          </View>
                          <View style={styles.timelineInfo}>
                            <Text style={styles.timelineVenue} numberOfLines={1}>{getVenueName(booking.venueId)}</Text>
                            <View style={styles.timelineMetaRow}>
                              {isNow && (
                                <View style={styles.timelineLiveBadge}>
                                  <PulseDot color={Colors.status.success} size={5} />
                                  <Text style={styles.timelineLiveText}>EN COURS</Text>
                                </View>
                              )}
                              <Text style={styles.timelinePrice}>{booking.totalPrice.toLocaleString()} FCFA</Text>
                            </View>
                          </View>
                          <View style={[styles.timelineStatusPill, { backgroundColor: sc.color + '18' }]}>
                            <Text style={[styles.timelineStatusText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        {idx < todayBookings.length - 1 && <View style={styles.timelineConnector} />}
                      </PressableCard>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.emptyCard, cardShadow]}>
                  <Calendar size={28} color={Colors.text.muted} />
                  <Text style={styles.emptyCardText}>{`Aucune réservation aujourd'hui`}</Text>
                </View>
              )}

              {/* ════ MES TOURNOIS ════ */}
              {tournaments.length > 0 && (
                <>
                  <SectionHeader
                    title="Mes tournois"
                    accentColor={Colors.primary.orange}
                    count={tournaments.length}
                    onSeeAll={() => router.push('/tournaments' as any)}
                  />
                  {tournaments.slice(0, 3).map(tournament => {
                    const fillRatio = tournament.maxTeams > 0 ? tournament.registeredTeams.length / tournament.maxTeams : 0;
                    const statusColor = tournament.status === 'registration' ? Colors.status.success : tournament.status === 'in_progress' ? Colors.primary.orange : tournament.status === 'cancelled' ? Colors.status.error : Colors.text.muted;
                    const statusLabel = tournament.status === 'registration' ? 'Inscriptions' : tournament.status === 'in_progress' ? 'En cours' : tournament.status === 'cancelled' ? 'Annulé' : 'Terminé';
                    const tDate = tournament.startDate ? new Date(tournament.startDate) : null;
                    const dateLabel = tDate ? tDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                    return (
                      <PressableCard key={tournament.id} onPress={() => router.push(`/tournament/${tournament.id}` as any)} style={styles.tournamentCardWrap}>
                        <View style={[styles.tournamentCard, cardShadow]}>
                          <View style={styles.tournamentCardHeader}>
                            <View style={styles.tournamentCardLeft}>
                              <Text style={styles.tournamentCardName} numberOfLines={1}>{tournament.name}</Text>
                              <View style={styles.tournamentCardMeta}>
                                {tournament.venue?.name && (
                                  <View style={styles.tournamentCardVenue}>
                                    <MapPin size={10} color={Colors.text.muted} />
                                    <Text style={styles.tournamentCardVenueText} numberOfLines={1}>{tournament.venue.name}</Text>
                                  </View>
                                )}
                                {dateLabel && (
                                  <View style={styles.tournamentCardFee}>
                                    <Calendar size={9} color={Colors.text.muted} />
                                    <Text style={styles.tournamentCardDateText}>{dateLabel}</Text>
                                  </View>
                                )}
                                {tournament.entryFee > 0 && (
                                  <View style={styles.tournamentCardFee}>
                                    <Trophy size={9} color={Colors.primary.orange} />
                                    <Text style={styles.tournamentCardFeeText}>{tournament.entryFee.toLocaleString()} F</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={[styles.tournamentCardBadge, { backgroundColor: statusColor + '15' }]}>
                              <Text style={[styles.tournamentCardBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.tournamentProgress}>
                            <View style={styles.tournamentProgressTrack}>
                              <View style={[styles.tournamentProgressFill, { width: `${Math.min(fillRatio * 100, 100)}%` as any, backgroundColor: statusColor }]} />
                            </View>
                            <View style={styles.tournamentProgressInfo}>
                              <View style={styles.tournamentProgressTeams}>
                                <Users2 size={9} color={Colors.text.muted} />
                                <Text style={styles.tournamentProgressLabel}>
                                  {tournament.registeredTeams.length}/{tournament.maxTeams}
                                </Text>
                              </View>
                              {fillRatio >= 1 && (
                                <Text style={styles.tournamentProgressFull}>Complet</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </PressableCard>
                    );
                  })}
                </>
              )}

              {/* ════ QUICK ACTIONS — 2x2 grid ════ */}
              <SectionHeader title="Actions rapides" accentColor={Colors.status.success} />
              <View style={styles.quickGrid}>
                {([
                  { icon: Plus, label: 'Nouveau terrain', color: Colors.primary.orange, route: '/create-venue' },
                  { icon: Trophy, label: 'Nouveau tournoi', color: Colors.primary.blue, route: '/create-tournament' },
                  { icon: Eye, label: 'Vue publique', color: Colors.status.success, route: '/venues' },
                  { icon: BarChart3, label: 'Statistiques', color: '#a78bfa', route: '/(manager-tabs)/my-venues' },
                ] as const).map((item, i) => (
                  <PressableCard key={i} onPress={() => router.push(item.route as any)} style={styles.quickGridItemWrap}>
                    <View style={[styles.quickGridItem, cardShadow]}>
                      <View style={[styles.quickGridIcon, { backgroundColor: item.color + '15', borderColor: item.color + '25' }]}>
                        <item.icon size={20} color={item.color} />
                      </View>
                      <Text style={styles.quickGridLabel}>{item.label}</Text>
                    </View>
                  </PressableCard>
                ))}
              </View>
            </>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // ════ HEADER ════
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarRingWrap: { borderRadius: 999 },
  avatarRing: {
    borderRadius: 999, padding: 2, borderWidth: 2,
    borderColor: Colors.primary.orange + '40',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { color: Colors.text.primary, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerRole: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  venuesBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary.orange + '14',
    borderWidth: 1, borderColor: Colors.primary.orange + '30',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  venuesBadgeText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '700' },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border.light + '60',
  },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary.orange, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.background.dark,
  },
  notifBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // ════ SCROLL ════
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.text.muted, fontSize: 14 },

  // ════ ALERT BANNER ════
  alertBannerWrap: { marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.status.warning + '25',
    borderRadius: 14,
  },
  alertIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.status.warning + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  alertTextWrap: { flex: 1 },
  alertTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  alertSub: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },

  // ════ METRICS ROW ════
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metricCardWrap: { borderRadius: 14, flex: 1 },
  metricCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background.card,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border.light + '40',
  },
  metricTextCol: { flex: 1, minWidth: 0 },
  metricIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  metricValue: {
    color: Colors.text.primary, fontSize: 18, fontWeight: '800',
    letterSpacing: -0.3,
  },
  metricUnit: { fontSize: 11, fontWeight: '600', color: Colors.text.muted },
  metricLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '500', marginTop: 2 },

  // ════ SCAN CTA ════
  scanCtaWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  scanCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 16,
  },
  scanIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  scanCtaSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },

  // ════ SECTION HEADER ════
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary.orange },
  sectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  sectionCountBadge: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  sectionCountText: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' as any },
  seeAllText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' },

  // ════ TIMELINE ════
  timeline: { gap: 0 },
  timelineItemWrap: { borderRadius: 14 },
  timelineItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background.card,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border.light + '40',
  },
  timelineItemLive: { borderColor: Colors.primary.orange + '40', borderWidth: 1.5 },
  timelineItemPast: { opacity: 0.5 },
  timelineLiveBar: {
    position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
    borderRadius: 2, backgroundColor: Colors.primary.orange,
  },
  timelineTime: { alignItems: 'center', gap: 2, minWidth: 50 },
  timelineTimeText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  timelineTimeSep: { color: Colors.text.muted, fontSize: 10 },
  timelineInfo: { flex: 1, minWidth: 0 },
  timelineVenue: { color: Colors.text.primary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timelineLiveText: { color: Colors.status.success, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  timelinePrice: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700' },
  timelineStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timelineStatusText: { fontSize: 10, fontWeight: '700' },
  timelineConnector: {
    width: 2, height: 12, marginLeft: 24,
    backgroundColor: Colors.border.light + '30',
  },

  // ════ EMPTY CARD ════
  emptyCard: {
    alignItems: 'center', gap: 10, paddingVertical: 32,
    backgroundColor: Colors.background.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border.light + '40',
  },
  emptyCardText: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' },

  // ════ TOURNAMENT CARDS ════
  tournamentCardWrap: { borderRadius: 14, marginBottom: 10 },
  tournamentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border.light + '40',
  },
  tournamentCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tournamentCardLeft: { flex: 1, marginRight: 10 },
  tournamentCardName: { color: Colors.text.primary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tournamentCardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tournamentCardBadgeText: { fontSize: 10, fontWeight: '700' },
  tournamentCardVenue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tournamentCardVenueText: { color: Colors.text.muted, fontSize: 11 },
  tournamentCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tournamentCardFee: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tournamentCardFeeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' },
  tournamentCardDateText: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' },
  tournamentProgress: { marginTop: 8 },
  tournamentProgressTrack: { height: 3, backgroundColor: Colors.border.light + '40', borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  tournamentProgressFill: { height: 3, borderRadius: 2 },
  tournamentProgressInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tournamentProgressTeams: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tournamentProgressLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' },
  tournamentProgressFull: { color: Colors.status.success, fontSize: 9, fontWeight: '700' },

  // ════ QUICK GRID 2x2 ════
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickGridItemWrap: { width: '48%' as any, borderRadius: 14 },
  quickGridItem: {
    backgroundColor: Colors.background.card,
    borderRadius: 14, padding: 16, gap: 10,
    borderWidth: 1, borderColor: Colors.border.light + '40',
  },
  quickGridIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickGridLabel: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },

  // ════ ONBOARDING ════
  onboardingContent: { padding: PAD, paddingBottom: 60, alignItems: 'center' },
  onboardingIcon: { marginTop: 20, marginBottom: 24 },
  onboardingIconBg: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  onboardingTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  onboardingSubtitle: { color: Colors.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 320, marginBottom: 32 },
  onboardingSteps: { width: '100%', gap: 12, marginBottom: 28 },
  onboardingStep: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border.light + '40' },
  stepNum: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary.orange + '20', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: Colors.primary.orange, fontSize: 15, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  stepDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  bigAddButtonWrap: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 28 },
  bigAddGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  bigAddText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  onboardingFeatures: { width: '100%', gap: 12, backgroundColor: Colors.background.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border.light + '40' },
  featuresTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.primary.orange + '15', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
});
