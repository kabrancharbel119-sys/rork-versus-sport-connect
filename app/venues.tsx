import React, { useState, useMemo, Component, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Star, Search, DollarSign } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { venuesApi } from '@/lib/api/venues';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import type { Venue } from '@/types';

const sportLabels: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball',
  tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton',
  tabletennis: 'Tennis de table', padel: 'Padel', squash: 'Squash',
  futsal: 'Futsal', beachvolleyball: 'Beach-volley',
};

const SPORT_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'football', label: 'Football' },
  { key: 'basketball', label: 'Basketball' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'padel', label: 'Padel' },
  { key: 'handball', label: 'Handball' },
  { key: 'futsal', label: 'Futsal' },
];

// Local error boundary to catch any render error inside this screen
class VenuesErrorBoundary extends Component<
  { children: React.ReactNode; onBack: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }
  componentDidCatch(error: Error) {
    console.error('[VenuesScreen] RENDER ERROR:', error?.message, error?.stack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Colors.background.dark, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: Colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Erreur de chargement</Text>
          <Text style={{ color: Colors.text.muted, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{this.state.errorMsg}</Text>
          <TouchableOpacity
            style={{ backgroundColor: Colors.primary.orange, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 16 }}
            onPress={this.props.onBack}
          >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function VenuesContent() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/(home)' as any);
  };
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const venuesQuery = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      try {
        const result = await venuesApi.getAll();
        return result || [];
      } catch (error: any) {
        console.error('[VenuesScreen] API Error:', error?.message || error);
        return [];
      }
    },
    retry: 1,
  });

  // Realtime subscription for venues list updates
  useEffect(() => {
    const channel = supabase
      .channel('venues-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, () => {
        console.log('[VenuesList] Realtime update received, refreshing venues');
        queryClient.invalidateQueries({ queryKey: ['venues'] });
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const venues: Venue[] = venuesQuery.data || [];

  const filteredVenues = useMemo(() => {
    try {
      let list = venues.filter(v => v && v.isActive !== false);

      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(v =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.address || '').toLowerCase().includes(q)
        );
      }

      if (sportFilter !== 'all') {
        list = list.filter(v => Array.isArray(v.sport) && (v.sport as string[]).includes(sportFilter));
      }

      return list;
    } catch (e) {
      console.error('[VenuesScreen] Filter error:', e);
      return [];
    }
  }, [venues, search, sportFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['venues'] });
    } catch (e) {
      console.error('[VenuesScreen] Refresh error:', e);
    }
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terrains</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un terrain, une ville..."
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>
          {SPORT_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, sportFilter === f.key && styles.filterChipActive]}
              onPress={() => setSportFilter(f.key)}
            >
              <Text style={[styles.filterText, sportFilter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {venuesQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
            </View>
          ) : venuesQuery.error ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Erreur de chargement</Text>
              <Text style={styles.emptyText}>Impossible de charger les terrains. Tirez vers le bas pour réessayer.</Text>
            </View>
          ) : filteredVenues.length === 0 ? (
            <View style={styles.centered}>
              <MapPin size={48} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Aucun terrain trouvé</Text>
              <Text style={styles.emptyText}>
                {search.trim() || sportFilter !== 'all'
                  ? 'Modifiez vos filtres pour voir plus de résultats.'
                  : 'Aucun terrain disponible pour le moment.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>{filteredVenues.length} terrain{filteredVenues.length > 1 ? 's' : ''}</Text>
              {filteredVenues.map(venue => {
                if (!venue || !venue.id) return null;
                const rating = Number(venue.rating) || 0;
                const price = Number(venue.pricePerHour) || 0;
                const sports = Array.isArray(venue.sport) ? (venue.sport as string[]) : [];
                const amenities = Array.isArray(venue.amenities) ? venue.amenities : [];

                return (
                  <TouchableOpacity
                    key={venue.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/venue/${venue.id}` as any)}
                  >
                    <Card style={styles.venueCard}>
                      <View style={styles.venueHeader}>
                        <View style={styles.venueInfo}>
                          <Text style={styles.venueName}>{venue.name || 'Sans nom'}</Text>
                          <View style={styles.locationRow}>
                            <MapPin size={13} color={Colors.text.muted} />
                            <Text style={styles.venueCity}>{venue.city || 'Ville inconnue'}</Text>
                          </View>
                        </View>
                        <View style={styles.ratingBadge}>
                          <Star size={13} color={Colors.primary.orange} />
                          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                        </View>
                      </View>

                      <View style={styles.venueMeta}>
                        <View style={styles.priceBadge}>
                          <DollarSign size={13} color={Colors.primary.orange} />
                          <Text style={styles.priceText}>{price.toLocaleString()} FCFA/h</Text>
                        </View>
                        <View style={styles.sportsList}>
                          {sports.slice(0, 3).map(s => (
                            <View key={s} style={styles.sportTag}>
                              <Text style={styles.sportTagText}>{sportLabels[s] || s}</Text>
                            </View>
                          ))}
                          {sports.length > 3 && (
                            <Text style={styles.moreText}>+{sports.length - 3}</Text>
                          )}
                        </View>
                      </View>

                      {amenities.length > 0 && (
                        <Text style={styles.amenitiesPreview}>
                          {amenities.slice(0, 4).join(' \u2022 ')}
                          {amenities.length > 4 ? ` +${amenities.length - 4}` : ''}
                        </Text>
                      )}
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function VenuesScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/(home)' as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <VenuesErrorBoundary onBack={handleBack}>
        <VenuesContent />
      </VenuesErrorBoundary>
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
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.light, borderRadius: 10,
    marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  filterScroller: { maxHeight: 44, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
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
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  resultCount: { color: Colors.text.muted, fontSize: 13, marginBottom: 12 },
  venueCard: { marginBottom: 12, padding: 14 },
  venueHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  venueInfo: { flex: 1 },
  venueName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  venueCity: { color: Colors.text.muted, fontSize: 13 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  ratingText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' },
  venueMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10,
  },
  priceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' },
  sportsList: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sportTag: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
  },
  sportTagText: { color: Colors.text.secondary, fontSize: 11 },
  moreText: { color: Colors.text.muted, fontSize: 11 },
  amenitiesPreview: {
    color: Colors.text.muted, fontSize: 12, marginTop: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
});
