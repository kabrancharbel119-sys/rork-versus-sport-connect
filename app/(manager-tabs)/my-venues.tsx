import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, MapPin, Calendar, DollarSign, Clock,
  Eye, EyeOff, Trash2, Edit3, TrendingUp,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Card } from '@/components/Card';
import type { Venue, Booking } from '@/types';

const REFETCH_INTERVAL = 30_000;

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

export default function ManagerVenuesTab() {
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
  const activeVenues = venues.filter(v => v.isActive !== false).length;

  const handleDeleteVenue = (venueId: string, name: string) => {
    Alert.alert('Supprimer', `Supprimer "${name}" ?\nCette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteVenueMutation.mutate(venueId) },
    ]);
  };

  const isLoading = venuesQuery.isLoading || bookingsQuery.isLoading;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes Terrains</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/create-venue' as any)}>
            <Plus size={20} color="#FFF" />
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
          ) : venues.length === 0 ? (
            <View style={styles.centered}>
              <MapPin size={48} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Aucun terrain</Text>
              <Text style={styles.emptyText}>Créez votre premier terrain pour commencer.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/create-venue' as any)}>
                <LinearGradient colors={[Colors.primary.orange, Colors.primary.orangeDark]} style={styles.emptyCtaGradient}>
                  <Plus size={20} color="#FFF" />
                  <Text style={styles.emptyCtaText}>Créer un terrain</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: Colors.text.muted, fontSize: 14 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  emptyCta: { marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  emptyCtaGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  emptyCtaText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
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
});
