import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar, Check, X, Clock,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Card } from '@/components/Card';
import type { Venue, Booking, BookingStatus } from '@/types';

const REFETCH_INTERVAL = 30_000;

function parseHour(val: string): number {
  if (!val) return 0;
  if (val.includes('T')) return parseInt(val.split('T')[1].split(':')[0], 10) || 0;
  return parseInt(val.split(':')[0], 10) || 0;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.status.warning },
  confirmed: { label: 'Confirmée', color: Colors.status.success },
  cancelled: { label: 'Annulée', color: Colors.text.muted },
  rejected: { label: 'Refusée', color: Colors.status.error },
  completed: { label: 'Terminée', color: Colors.primary.blue },
};

export default function ManagerBookingsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'past'>('all');

  console.log('[ManagerBookings] User ID:', user?.id, 'Enabled:', !!user?.id);

  const venuesQuery = useQuery({
    queryKey: ['myVenues', user?.id],
    queryFn: () => {
      console.log('[ManagerBookings] Fetching venues for owner:', user!.id);
      return venuesApi.getByOwner(user!.id);
    },
    enabled: !!user?.id,
    refetchInterval: REFETCH_INTERVAL,
  });

  const bookingsQuery = useQuery({
    queryKey: ['ownerBookings', user?.id],
    queryFn: () => {
      console.log('[ManagerBookings] Fetching bookings for owner:', user!.id);
      return venuesApi.getOwnerBookings(user!.id);
    },
    enabled: !!user?.id,
    refetchInterval: REFETCH_INTERVAL,
  });

  console.log('[ManagerBookings] Venues query status:', venuesQuery.status, 'data:', venuesQuery.data?.length);
  console.log('[ManagerBookings] Bookings query status:', bookingsQuery.status, 'data:', bookingsQuery.data?.length);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['ownerBookings'] });
    setRefreshing(false);
  }, [queryClient]);

  const venues: Venue[] = venuesQuery.data || [];
  const bookings: Booking[] = bookingsQuery.data || [];
  const todayStr = toLocalDateStr(new Date());

  const pendingBookings = useMemo(() => 
    bookings
      .filter(b => b.status === 'pending')
      .sort((a, b) => {
        // Sort by date ascending (earliest first), then by start time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      }), 
    [bookings]
  );

  const confirmedBookings = useMemo(() => 
    bookings
      .filter(b => b.status === 'confirmed' && b.date >= todayStr)
      .sort((a, b) => {
        // Sort by date ascending (earliest first), then by start time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      }), 
    [bookings, todayStr]
  );

  const pastBookings = useMemo(() => 
    bookings
      .filter(b => b.date < todayStr || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected')
      .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
      .slice(0, 30), 
    [bookings, todayStr]
  );

  const filteredBookings = useMemo(() => {
    let list: Booking[] = [];
    switch (bookingFilter) {
      case 'pending': 
        list = pendingBookings;
        break;
      case 'confirmed': 
        list = confirmedBookings;
        break;
      case 'past': 
        list = pastBookings;
        break;
      default: 
        // "Toutes" : pending first, then confirmed, then recent past
        list = [
          ...pendingBookings,
          ...confirmedBookings,
          ...pastBookings.slice(0, 10),
        ];
    }
    return list;
  }, [bookingFilter, pendingBookings, confirmedBookings, pastBookings]);

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

  const isLoading = bookingsQuery.isLoading;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Réservations</Text>
          {pendingBookings.length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingBookings.length} en attente</Text>
            </View>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>
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
          ) : filteredBookings.length === 0 ? (
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
                      <Text style={styles.bookingDate}>{booking.date} • {parseHour(booking.startTime)}h - {parseHour(booking.endTime)}h</Text>
                    </View>
                    <View style={[styles.bookingStatusBadge, { backgroundColor: sc.color + '20' }]}>
                      <Text style={[styles.bookingStatusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  <View style={styles.bookingBottom}>
                    <Text style={styles.bookingPrice}>{(Number(booking.totalPrice) || 0).toLocaleString()} FCFA</Text>
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
  pendingBadge: {
    backgroundColor: Colors.status.warning + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  pendingBadgeText: { color: Colors.status.warning, fontSize: 12, fontWeight: '700' },
  filterScroller: { maxHeight: 44, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light,
  },
  filterPillActive: { backgroundColor: Colors.primary.orange + '20', borderColor: Colors.primary.orange },
  filterPillText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  filterPillTextActive: { color: Colors.primary.orange },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.text.muted, fontSize: 14 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 },
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
});
