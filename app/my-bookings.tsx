import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Clock, MapPin, DollarSign, XCircle, CheckCircle, AlertCircle, Inbox } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Card } from '@/components/Card';
import type { Booking, BookingStatus } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  confirmed: { label: 'Confirmée', color: Colors.status.success, icon: CheckCircle },
  pending: { label: 'En attente', color: Colors.status.warning, icon: Clock },
  cancelled: { label: 'Annulée', color: Colors.text.muted, icon: XCircle },
  rejected: { label: 'Refusée', color: Colors.status.error, icon: XCircle },
  completed: { label: 'Terminée', color: Colors.primary.blue, icon: CheckCircle },
};

function formatDateFR(dateStr: string): string {
  try {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${days[date.getDay()]} ${d} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    if (!timeStr) return '';
    // Handle TIMESTAMPTZ: '2026-03-16T18:00:00+00:00'
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      const hour = parseInt(timePart.split(':')[0], 10);
      return `${hour}h`;
    }
    // Handle plain time: '18:00:00' or '18:00'
    const hour = parseInt(timeStr.split(':')[0], 10);
    return `${hour}h`;
  } catch {
    return timeStr;
  }
}

function isUpcoming(dateStr: string): boolean {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-').map(Number);
    const bookingDate = new Date(y, m - 1, d);
    return bookingDate >= today;
  } catch {
    return false;
  }
}

export default function MyBookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const bookingsQuery = useQuery({
    queryKey: ['userBookings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const bookings = await venuesApi.getUserBookings(user.id);
        return bookings;
      } catch (e: any) {
        console.error('[MyBookings] Error:', e?.message);
        return [];
      }
    },
    enabled: !!user,
  });

  // Load venue names for display
  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      try {
        return await venuesApi.getAll();
      } catch { return []; }
    },
  });

  const venueMap = React.useMemo(() => {
    const map: Record<string, { name: string; city: string }> = {};
    for (const v of (venuesQuery.data || [])) {
      map[v.id] = { name: v.name, city: v.city };
    }
    return map;
  }, [venuesQuery.data]);

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => {
      if (!user) throw new Error('Non connecté');
      return venuesApi.cancelBooking(bookingId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      Alert.alert('Réservation annulée', 'Votre réservation a bien été annulée.');
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message || 'Impossible d\'annuler la réservation.');
    },
  });

  const handleCancel = (booking: Booking) => {
    const venueName = venueMap[booking.venueId]?.name || 'Terrain';
    Alert.alert(
      'Annuler la réservation ?',
      `${venueName}\n${formatDateFR(booking.date)} • ${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}\n\nCette action est irréversible.`,
      [
        { text: 'Non, garder', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: () => cancelMutation.mutate(booking.id) },
      ]
    );
  };

  const bookings = bookingsQuery.data || [];
  const filteredBookings = React.useMemo(() => {
    let list = [...bookings];
    if (filter === 'upcoming') {
      list = list.filter(b => isUpcoming(b.date) && b.status !== 'cancelled' && b.status !== 'rejected');
    } else if (filter === 'past') {
      list = list.filter(b => !isUpcoming(b.date) || b.status === 'cancelled' || b.status === 'rejected');
    }
    // Sort: upcoming first by date asc, past by date desc
    list.sort((a, b) => {
      if (filter === 'past') return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });
    return list;
  }, [bookings, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['userBookings'] });
    setRefreshing(false);
  };

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'upcoming', label: 'À venir' },
    { key: 'past', label: 'Passées' },
    { key: 'all', label: 'Toutes' },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes réservations</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {bookingsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary.orange} />
                <Text style={styles.loadingText}>Chargement de vos réservations...</Text>
              </View>
            ) : filteredBookings.length === 0 ? (
              <View style={styles.centered}>
                <Inbox size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>
                  {filter === 'upcoming' ? 'Aucune réservation à venir' : filter === 'past' ? 'Aucune réservation passée' : 'Aucune réservation'}
                </Text>
                <Text style={styles.emptyText}>
                  {filter === 'upcoming'
                    ? 'Réservez un terrain pour commencer à jouer !'
                    : 'Vos réservations apparaîtront ici.'}
                </Text>
                {filter === 'upcoming' && (
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => router.push('/venues' as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ctaButtonText}>Voir les terrains</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.resultCount}>
                  {filteredBookings.length} réservation{filteredBookings.length > 1 ? 's' : ''}
                </Text>
                {filteredBookings.map(booking => {
                  const venue = venueMap[booking.venueId];
                  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const upcoming = isUpcoming(booking.date);
                  const canCancel = upcoming && (booking.status === 'confirmed' || booking.status === 'pending');
                  const startH = parseInt((booking.startTime || '0').split(':')[0], 10);
                  const endH = parseInt((booking.endTime || '0').split(':')[0], 10);
                  const duration = endH - startH;

                  return (
                    <Card key={booking.id} style={[styles.bookingCard, !upcoming && booking.status !== 'cancelled' && styles.bookingCardPast]}>
                      {/* Status badge */}
                      <View style={styles.bookingTop}>
                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
                          <StatusIcon size={12} color={statusCfg.color} />
                          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                        </View>
                        <Text style={styles.bookingPrice}>
                          {(Number(booking.totalPrice) || 0).toLocaleString()} FCFA
                        </Text>
                      </View>

                      {/* Venue name */}
                      <Text style={styles.bookingVenue}>{venue?.name || 'Terrain'}</Text>
                      {venue?.city ? (
                        <View style={styles.metaRow}>
                          <MapPin size={13} color={Colors.text.muted} />
                          <Text style={styles.metaText}>{venue.city}</Text>
                        </View>
                      ) : null}

                      {/* Date & time */}
                      <View style={styles.bookingDetails}>
                        <View style={styles.metaRow}>
                          <Calendar size={14} color={Colors.text.muted} />
                          <Text style={styles.metaText}>{formatDateFR(booking.date)}</Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Clock size={14} color={Colors.text.muted} />
                          <Text style={styles.metaText}>
                            {formatTime(booking.startTime)} - {formatTime(booking.endTime)} ({duration}h)
                          </Text>
                        </View>
                      </View>

                      {/* Cancel button */}
                      {canCancel && (
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancel(booking)}
                          activeOpacity={0.7}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle size={14} color={Colors.status.error} />
                          <Text style={styles.cancelBtnText}>
                            {cancelMutation.isPending ? 'Annulation...' : 'Annuler la réservation'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  filterChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange,
  },
  filterText: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: Colors.primary.orange },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12,
  },
  loadingText: { color: Colors.text.muted, fontSize: 14, marginTop: 8 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  ctaButton: {
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8,
  },
  ctaButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  resultCount: { color: Colors.text.muted, fontSize: 13, marginBottom: 12 },
  bookingCard: { padding: 14, marginBottom: 12 },
  bookingCardPast: { opacity: 0.7 },
  bookingTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  bookingPrice: { color: Colors.primary.orange, fontSize: 16, fontWeight: '800' },
  bookingVenue: { color: Colors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bookingDetails: { gap: 4, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: Colors.text.muted, fontSize: 13 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: Colors.status.error + '10',
    borderWidth: 1, borderColor: Colors.status.error + '30',
  },
  cancelBtnText: { color: Colors.status.error, fontSize: 13, fontWeight: '600' },
});
