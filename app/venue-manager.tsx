import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform, ViewStyle } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, Plus, MapPin, Calendar, DollarSign, BarChart3, Clock,
  Check, X, Eye, EyeOff, Trash2, Edit3, ChevronRight, TrendingUp,
  Users, AlertCircle, Zap, Home, Settings, Star, Activity,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import type { Venue, Booking, BookingStatus } from '@/types';

type Tab = 'dashboard' | 'venues' | 'bookings' | 'stats';

const REFETCH_INTERVAL = 30_000; // 30s real-time refresh

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const cardShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  android: { elevation: 4 },
}) as ViewStyle;

const sportLabels: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball',
  tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton',
  tabletennis: 'Tennis de table', padel: 'Padel', squash: 'Squash',
  futsal: 'Futsal', beachvolleyball: 'Beach-volley',
};

export default function VenueManagerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isVenueManager } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'past'>('all');

  const venuesQuery = useQuery({
    queryKey: ['myVenues', user?.id],
    queryFn: () => venuesApi.getByOwner(user!.id),
    enabled: !!user?.id && isVenueManager,
    refetchInterval: REFETCH_INTERVAL,
  });

  const bookingsQuery = useQuery({
    queryKey: ['ownerBookings', user?.id],
    queryFn: () => venuesApi.getOwnerBookings(user!.id),
    enabled: !!user?.id && isVenueManager,
    refetchInterval: REFETCH_INTERVAL,
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: BookingStatus }) =>
      venuesApi.updateBookingStatus(bookingId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
    },
    onError: (error: any) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour la réservation.');
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: (venueId: string) => venuesApi.delete(venueId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVenues'] });
      queryClient.invalidateQueries({ queryKey: ['ownerBookings'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['myVenues'] }),
      queryClient.invalidateQueries({ queryKey: ['ownerBookings'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const venues: Venue[] = venuesQuery.data || [];
  const bookings: Booking[] = bookingsQuery.data || [];

  const todayStr = toLocalDateStr(new Date());

  const pendingBookings = useMemo(() => bookings.filter(b => b.status === 'pending'), [bookings]);
  const confirmedBookings = useMemo(() => bookings.filter(b => b.status === 'confirmed'), [bookings]);
  const todayBookings = useMemo(() => bookings.filter(b => b.date === todayStr && (b.status === 'confirmed' || b.status === 'pending')), [bookings, todayStr]);
  const upcomingBookings = useMemo(() => bookings.filter(b => b.date >= todayStr && b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).slice(0, 10), [bookings, todayStr]);
  const pastBookings = useMemo(() => bookings.filter(b => b.date < todayStr || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected').slice(0, 20), [bookings, todayStr]);

  const totalRevenue = useMemo(() => bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').reduce((sum, b) => sum + b.totalPrice, 0), [bookings]);
  const todayRevenue = useMemo(() => todayBookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.totalPrice, 0), [todayBookings]);
  const thisMonthBookings = useMemo(() => {
    const monthStr = todayStr.slice(0, 7); // "YYYY-MM"
    return bookings.filter(b => b.date.startsWith(monthStr) && (b.status === 'confirmed' || b.status === 'completed'));
  }, [bookings, todayStr]);
  const monthRevenue = useMemo(() => thisMonthBookings.reduce((sum, b) => sum + b.totalPrice, 0), [thisMonthBookings]);
  const activeVenues = venues.filter(v => v.isActive !== false).length;

  const getVenueName = (venueId: string) => venues.find(v => v.id === venueId)?.name || 'Terrain';

  const handleApproveBooking = (bookingId: string) => {
    Alert.alert('Confirmer', 'Approuver cette réservation ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Approuver', onPress: () => updateBookingMutation.mutate({ bookingId, status: 'confirmed' }) },
    ]);
  };

  const handleRejectBooking = (bookingId: string) => {
    Alert.alert('Refuser', 'Refuser cette réservation ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => updateBookingMutation.mutate({ bookingId, status: 'rejected' }) },
    ]);
  };

  const handleDeleteVenue = (venueId: string, name: string) => {
    Alert.alert('Supprimer', `Supprimer "${name}" ?\nCette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteVenueMutation.mutate(venueId) },
    ]);
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'En attente', color: Colors.status.warning },
    confirmed: { label: 'Confirmée', color: Colors.status.success },
    cancelled: { label: 'Annulée', color: Colors.text.muted },
    rejected: { label: 'Refusée', color: Colors.status.error },
    completed: { label: 'Terminée', color: Colors.primary.blue },
  };

  // ──────── ACCESS GUARD ────────
  if (!isVenueManager) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
          <MapPin size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>Accès réservé</Text>
          <Text style={styles.emptyText}>Vous devez être gestionnaire de terrain pour accéder à cette page.</Text>
          <Button title="Retour" onPress={() => safeBack(router, '/(tabs)/(home)')} variant="outline" style={{ marginTop: 16 }} />
        </SafeAreaView>
      </View>
    );
  }

  // ──────── ONBOARDING (no venues yet) ────────
  if (!venuesQuery.isLoading && venues.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)/(home)')}>
                <Home size={22} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Mon Espace Terrain</Text>
              <View style={{ width: 40 }} />
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
                  { num: '1', title: 'Créez votre terrain', desc: 'Nom, adresse, sports, prix, équipements...', done: false },
                  { num: '2', title: 'Configurez les réservations', desc: 'Approbation auto ou manuelle, horaires...', done: false },
                  { num: '3', title: 'Recevez des joueurs', desc: 'Votre terrain sera visible par tous les utilisateurs', done: false },
                ].map((step, i) => (
                  <View key={i} style={styles.onboardingStep}>
                    <View style={[styles.stepNum, step.done && styles.stepNumDone]}>
                      {step.done ? <Check size={16} color="#FFF" /> : <Text style={styles.stepNumText}>{step.num}</Text>}
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
      </>
    );
  }

  // ──────── MAIN DASHBOARD ────────

  const filteredBookings = useMemo(() => {
    switch (bookingFilter) {
      case 'pending': return pendingBookings;
      case 'confirmed': return confirmedBookings;
      case 'past': return pastBookings;
      default: return bookings;
    }
  }, [bookingFilter, bookings, pendingBookings, confirmedBookings, pastBookings]);

  const renderDashboard = () => (
    <View>
      {/* Pending alert banner */}
      {pendingBookings.length > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => { setActiveTab('bookings'); setBookingFilter('pending'); }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[Colors.status.warning + '25', Colors.status.warning + '10']} style={styles.alertBannerGradient}>
            <AlertCircle size={20} color={Colors.status.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{pendingBookings.length} réservation{pendingBookings.length > 1 ? 's' : ''} en attente</Text>
              <Text style={styles.alertDesc}>Appuyez pour approuver ou refuser</Text>
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

      {/* Today's schedule */}
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

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Actions rapides</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => router.push('/create-venue' as any)}>
          <LinearGradient colors={[Colors.primary.orange + '15', Colors.primary.orange + '05']} style={styles.quickActionBg}>
            <Plus size={22} color={Colors.primary.orange} />
            <Text style={styles.quickActionText}>Ajouter un terrain</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => { setActiveTab('bookings'); setBookingFilter('pending'); }}>
          <LinearGradient colors={[Colors.status.warning + '15', Colors.status.warning + '05']} style={styles.quickActionBg}>
            <Clock size={22} color={Colors.status.warning} />
            <Text style={styles.quickActionText}>Résa. en attente</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => setActiveTab('stats')}>
          <LinearGradient colors={[Colors.primary.blue + '15', Colors.primary.blue + '05']} style={styles.quickActionBg}>
            <BarChart3 size={22} color={Colors.primary.blue} />
            <Text style={styles.quickActionText}>Statistiques</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, cardShadow]} onPress={() => router.push('/venues' as any)}>
          <LinearGradient colors={[Colors.status.success + '15', Colors.status.success + '05']} style={styles.quickActionBg}>
            <Eye size={22} color={Colors.status.success} />
            <Text style={styles.quickActionText}>Vue publique</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVenuesTab = () => (
    <View>
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create-venue' as any)} activeOpacity={0.8}>
        <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.addButtonGradient}>
          <Plus size={22} color="#FFF" />
          <Text style={styles.addButtonText}>Ajouter un terrain</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.venueCount}>{venues.length} terrain{venues.length > 1 ? 's' : ''} • {activeVenues} actif{activeVenues > 1 ? 's' : ''}</Text>

      {venues.map(venue => {
        const venueBookings = bookings.filter(b => b.venueId === venue.id && b.date >= todayStr && (b.status === 'confirmed' || b.status === 'pending'));
        const venuePending = bookings.filter(b => b.venueId === venue.id && b.status === 'pending').length;
        const venueRevenue = bookings.filter(b => b.venueId === venue.id && (b.status === 'confirmed' || b.status === 'completed')).reduce((s, b) => s + b.totalPrice, 0);
        return (
          <Card key={venue.id} style={[styles.venueCard, cardShadow]}>
            <View style={styles.venueHeader}>
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <View style={styles.venueLocationRow}>
                  <MapPin size={12} color={Colors.text.muted} />
                  <Text style={styles.venueCity}>{venue.city} • {venue.address}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: venue.isActive !== false ? Colors.status.success + '20' : Colors.text.muted + '20' }]}>
                {venue.isActive !== false ? <Eye size={12} color={Colors.status.success} /> : <EyeOff size={12} color={Colors.text.muted} />}
                <Text style={[styles.statusBadgeText, { color: venue.isActive !== false ? Colors.status.success : Colors.text.muted }]}>
                  {venue.isActive !== false ? 'Actif' : 'Inactif'}
                </Text>
              </View>
            </View>

            {/* Venue stats row */}
            <View style={styles.venueStatsRow}>
              <View style={styles.venueStat}>
                <DollarSign size={14} color={Colors.primary.orange} />
                <Text style={styles.venueStatText}>{venue.pricePerHour.toLocaleString()} FCFA/h</Text>
              </View>
              <View style={styles.venueStat}>
                <Calendar size={14} color={Colors.primary.blue} />
                <Text style={styles.venueStatText}>{venueBookings.length} résa.</Text>
              </View>
              {venuePending > 0 && (
                <View style={styles.venueStat}>
                  <Clock size={14} color={Colors.status.warning} />
                  <Text style={[styles.venueStatText, { color: Colors.status.warning }]}>{venuePending} en attente</Text>
                </View>
              )}
              <View style={styles.venueStat}>
                <TrendingUp size={14} color={Colors.status.success} />
                <Text style={styles.venueStatText}>{venueRevenue.toLocaleString()} FCFA</Text>
              </View>
            </View>

            <View style={styles.venueSports}>
              {(venue.sport as string[]).map(s => (
                <View key={s} style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sportLabels[s] || s}</Text>
                </View>
              ))}
              <View style={[styles.sportTag, { backgroundColor: (venue.autoApprove !== false ? Colors.status.success : Colors.status.warning) + '20' }]}>
                <Text style={[styles.sportTagText, { color: venue.autoApprove !== false ? Colors.status.success : Colors.status.warning }]}>
                  {venue.autoApprove !== false ? 'Auto-approbation' : 'Approbation manuelle'}
                </Text>
              </View>
            </View>

            <View style={styles.venueActions}>
              <TouchableOpacity style={styles.venueActionBtn} onPress={() => router.push(`/edit-venue/${venue.id}` as any)}>
                <Edit3 size={15} color={Colors.primary.blue} />
                <Text style={[styles.venueActionText, { color: Colors.primary.blue }]}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.venueActionBtn} onPress={() => router.push(`/venue/${venue.id}` as any)}>
                <Eye size={15} color={Colors.text.secondary} />
                <Text style={styles.venueActionText}>Aperçu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.venueActionBtn} onPress={() => handleDeleteVenue(venue.id, venue.name)}>
                <Trash2 size={15} color={Colors.status.error} />
                <Text style={[styles.venueActionText, { color: Colors.status.error }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}
    </View>
  );

  const renderBookingsTab = () => (
    <View>
      {/* Booking filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller}>
        {([
          { key: 'all' as const, label: `Toutes (${bookings.length})` },
          { key: 'pending' as const, label: `En attente (${pendingBookings.length})` },
          { key: 'confirmed' as const, label: `Confirmées (${confirmedBookings.length})` },
          { key: 'past' as const, label: `Historique (${pastBookings.length})` },
        ]).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, bookingFilter === f.key && styles.filterPillActive]}
            onPress={() => setBookingFilter(f.key)}
          >
            <Text style={[styles.filterPillText, bookingFilter === f.key && styles.filterPillTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredBookings.length === 0 ? (
        <View style={styles.centered}>
          <Calendar size={40} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptyText}>
            {bookingFilter === 'pending' ? 'Aucune réservation en attente.' : 'Les réservations apparaîtront ici.'}
          </Text>
        </View>
      ) : (
        filteredBookings.map(booking => {
          const sc = statusConfig[booking.status] || statusConfig.pending;
          const isPending = booking.status === 'pending';
          return (
            <Card key={booking.id} style={[styles.bookingCard, isPending && styles.bookingCardPending]}>
              <View style={styles.bookingTop}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingVenue}>{getVenueName(booking.venueId)}</Text>
                  <Text style={styles.bookingDate}>{booking.date} • {booking.startTime} - {booking.endTime}</Text>
                </View>
                <View style={[styles.bookingStatusBadge, { backgroundColor: sc.color + '20' }]}>
                  <Text style={[styles.bookingStatusText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>
              <View style={styles.bookingBottom}>
                <Text style={styles.bookingPrice}>{booking.totalPrice.toLocaleString()} FCFA</Text>
                {isPending && (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity style={[styles.bookingBtn, styles.approveBtn]} onPress={() => handleApproveBooking(booking.id)}>
                      <Check size={16} color="#FFF" />
                      <Text style={styles.bookingBtnText}>Approuver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.bookingBtn, styles.rejectBtn, updateBookingMutation.isPending && styles.bookingBtnDisabled]}
                      onPress={() => handleRejectBooking(booking.id)}
                      disabled={updateBookingMutation.isPending}
                    >
                      <X size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          );
        })
      )}
    </View>
  );

  const renderStatsTab = () => (
    <View>
      <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
      <View style={styles.metricsRow}>
        <Card style={[styles.bigStatCard, cardShadow]}>
          <DollarSign size={28} color={Colors.primary.orange} />
          <Text style={styles.bigStatValue}>{totalRevenue.toLocaleString()}</Text>
          <Text style={styles.bigStatLabel}>FCFA total généré</Text>
        </Card>
      </View>

      <View style={styles.metricsRow}>
        <Card style={[styles.metricCard, cardShadow]}>
          <View style={[styles.metricIcon, { backgroundColor: Colors.primary.orange + '20' }]}>
            <MapPin size={18} color={Colors.primary.orange} />
          </View>
          <Text style={styles.metricValue}>{venues.length}</Text>
          <Text style={styles.metricLabel}>Terrains</Text>
        </Card>
        <Card style={[styles.metricCard, cardShadow]}>
          <View style={[styles.metricIcon, { backgroundColor: Colors.primary.blue + '20' }]}>
            <Calendar size={18} color={Colors.primary.blue} />
          </View>
          <Text style={styles.metricValue}>{bookings.length}</Text>
          <Text style={styles.metricLabel}>Réservations totales</Text>
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
            <Activity size={18} color={Colors.status.warning} />
          </View>
          <Text style={styles.metricValue}>{thisMonthBookings.length}</Text>
          <Text style={styles.metricLabel}>Résa. ce mois</Text>
        </Card>
      </View>

      {/* Per venue stats */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Par terrain</Text>
      {venues.map(venue => {
        const vb = bookings.filter(b => b.venueId === venue.id && (b.status === 'confirmed' || b.status === 'completed'));
        const vRevenue = vb.reduce((s, b) => s + b.totalPrice, 0);
        return (
          <Card key={venue.id} style={styles.venueStatCard}>
            <View style={styles.venueStatHeader}>
              <Text style={styles.venueStatName}>{venue.name}</Text>
              <Text style={styles.venueStatRevenue}>{vRevenue.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.venueStatDetails}>
              <Text style={styles.venueStatDetail}>{vb.length} réservations</Text>
              <Text style={styles.venueStatDetail}>{venue.pricePerHour.toLocaleString()} FCFA/h</Text>
              <Text style={[styles.venueStatDetail, { color: venue.isActive !== false ? Colors.status.success : Colors.text.muted }]}>
                {venue.isActive !== false ? 'Actif' : 'Inactif'}
              </Text>
            </View>
          </Card>
        );
      })}

      {/* Recent history */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Historique récent</Text>
      {bookings.slice(0, 10).map(booking => {
        const sc = statusConfig[booking.status] || statusConfig.pending;
        return (
          <Card key={booking.id} style={styles.historyCard}>
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingVenue}>{getVenueName(booking.venueId)}</Text>
              <Text style={styles.bookingDate}>{booking.date} • {booking.startTime} - {booking.endTime}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.historyStatus, { color: sc.color }]}>{sc.label}</Text>
              <Text style={styles.bookingPrice}>{booking.totalPrice.toLocaleString()} FCFA</Text>
            </View>
          </Card>
        );
      })}
    </View>
  );

  const TABS: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: 'dashboard', label: 'Accueil', icon: Home },
    { key: 'venues', label: 'Terrains', icon: MapPin },
    { key: 'bookings', label: 'Résa.', icon: Calendar, badge: pendingBookings.length },
    { key: 'stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)/(home)')}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mon Espace Terrain</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/settings' as any)}>
              <Settings size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <tab.icon size={16} color={activeTab === tab.key ? Colors.primary.orange : Colors.text.muted} />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                {tab.badge && tab.badge > 0 ? (
                  <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {(venuesQuery.isLoading || bookingsQuery.isLoading) ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary.orange} />
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : (
              <>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'venues' && renderVenuesTab()}
                {activeTab === 'bookings' && renderBookingsTab()}
                {activeTab === 'stats' && renderStatsTab()}
              </>
            )}
            <View style={{ height: 30 }} />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 6 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.background.card,
  },
  tabActive: { backgroundColor: Colors.primary.orange + '20', borderWidth: 1, borderColor: Colors.primary.orange },
  tabText: { color: Colors.text.muted, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: Colors.primary.orange },
  tabBadge: {
    backgroundColor: Colors.status.error, borderRadius: 7,
    minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 },
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
  stepNumDone: { backgroundColor: Colors.status.success },
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

  // Alert banner
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

  // Venues tab
  addButton: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  addButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  venueCount: { color: Colors.text.muted, fontSize: 13, marginBottom: 12 },
  venueCard: { marginBottom: 14, padding: 16 },
  venueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  venueInfo: { flex: 1 },
  venueName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  venueLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  venueCity: { color: Colors.text.muted, fontSize: 12, flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  venueStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border.light },
  venueStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueStatText: { color: Colors.text.secondary, fontSize: 12 },
  venueSports: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  sportTag: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sportTagText: { color: Colors.text.secondary, fontSize: 11 },
  venueActions: { flexDirection: 'row', gap: 16, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light, paddingTop: 12 },
  venueActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueActionText: { color: Colors.text.secondary, fontSize: 13 },

  // Bookings tab
  filterScroller: { marginBottom: 14 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, marginRight: 8 },
  filterPillActive: { backgroundColor: Colors.primary.orange + '20', borderColor: Colors.primary.orange },
  filterPillText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  filterPillTextActive: { color: Colors.primary.orange },
  bookingCard: { marginBottom: 10, padding: 14 },
  bookingCardPending: { borderWidth: 1, borderColor: Colors.status.warning + '40' },
  bookingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  bookingInfo: { flex: 1 },
  bookingVenue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  bookingDate: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  bookingStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bookingStatusText: { fontSize: 11, fontWeight: '600' },
  bookingBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingPrice: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' },
  bookingActions: { flexDirection: 'row', gap: 8 },
  bookingBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  bookingBtnDisabled: { opacity: 0.6 },
  bookingBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  approveBtn: { backgroundColor: Colors.status.success },
  rejectBtn: { backgroundColor: Colors.status.error },

  // Stats
  bigStatCard: { flex: 1, padding: 20, alignItems: 'center', gap: 8 },
  bigStatValue: { color: Colors.primary.orange, fontSize: 28, fontWeight: '800' },
  bigStatLabel: { color: Colors.text.muted, fontSize: 13 },
  venueStatCard: { marginBottom: 8, padding: 14 },
  venueStatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  venueStatName: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  venueStatRevenue: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' },
  venueStatDetails: { flexDirection: 'row', gap: 12, marginTop: 6 },
  venueStatDetail: { color: Colors.text.muted, fontSize: 12 },
  historyCard: { marginBottom: 6, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyStatus: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
