import React, { useState, useMemo, Component, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Star, Search, DollarSign, Navigation } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors, SPACING, CARD_RADIUS, CARD_INNER_PAD, OUTER_PAD, CARD_GAP, cardGlow } from '@/constants/colors';
import { venuesApi } from '@/lib/api/venues';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { useLocation } from '@/contexts/LocationContext';
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
    console.error('[VenuesTabScreen] RENDER ERROR:', error?.message, error?.stack);
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

function VenuesTabContent() {
  const router = useRouter();
  const { location, requestPermission, updateLocation, isUpdating } = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);

  const venuesQuery = useQuery({
    queryKey: ['venues', location?.latitude, location?.longitude, radiusKm],
    queryFn: async () => {
      try {
        const allVenues = await venuesApi.getAll();
        if (location && location.latitude && location.longitude) {
          const result = await venuesApi.getNearby(location.latitude, location.longitude, radiusKm);
          return (result && result.length > 0) ? result : allVenues;
        }
        return allVenues || [];
      } catch (error: any) {
        console.error('[VenuesTabScreen] API Error:', error?.message || error);
        return [];
      }
    },
    retry: 1,
  });

  useEffect(() => {
    const channel = supabase
      .channel('venues-tab-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, () => {
        queryClient.invalidateQueries({ queryKey: ['venues'] });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [queryClient]);

  const venues: Venue[] = venuesQuery.data || [];

  const filteredVenues = useMemo(() => {
    try {
      let list = venues.filter(v => v && v.isActive !== false);
      if (!search.trim() && sportFilter === 'all') return list;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(v => {
          const name = v.name || '';
          const city = v.city || '';
          const address = v.address || '';
          return name.toLowerCase().includes(q) || city.toLowerCase().includes(q) || address.toLowerCase().includes(q);
        });
      }
      if (sportFilter !== 'all') {
        list = list.filter(v => Array.isArray(v.sport) && (v.sport as string[]).includes(sportFilter));
      }
      return list;
    } catch (e) {
      console.error('[VenuesTabScreen] Filter error:', e);
      return [];
    }
  }, [venues, search, sportFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['venues'] });
    } catch (e) {
      console.error('[VenuesTabScreen] Refresh error:', e);
    }
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Terrains</Text>
            <Text style={styles.headerSubtitle}>{filteredVenues.length} terrain{filteredVenues.length > 1 ? 's' : ''} disponible{filteredVenues.length > 1 ? 's' : ''}</Text>
          </View>
          {location ? (
            <View style={styles.locationPill}>
              <Navigation size={13} color={Colors.primary.orange} strokeWidth={2} />
              <Text style={styles.locationPillText}>{radiusKm} km</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.text.muted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un terrain, une ville..."
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={12}>
              <Text style={styles.clearBtn}>Effacer</Text>
            </TouchableOpacity>
          )}
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

        {!location && (
          <View style={styles.locationPrompt}>
            <View style={styles.locationPromptIcon}>
              <Navigation size={14} color={Colors.primary.orange} strokeWidth={2} />
            </View>
            <Text style={styles.locationPromptText}>
              Active la localisation pour voir les terrains près de toi
            </Text>
            <TouchableOpacity
              style={styles.locationPromptBtn}
              onPress={async () => {
                const hasPermission = await requestPermission();
                if (hasPermission) {
                  await updateLocation();
                } else {
                  Alert.alert('Permission requise', 'Activez la localisation pour voir les terrains à proximité.');
                }
              }}
              disabled={isUpdating}
            >
              <Text style={styles.locationPromptBtnText}>{isUpdating ? '...' : 'Activer'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {location && (
          <View style={styles.radiusRow}>
            <Text style={styles.radiusLabel}>Rayon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusContent}>
              {[5, 10, 20, 50].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]}
                  onPress={() => setRadiusKm(r)}
                >
                  <Text style={[styles.radiusText, radiusKm === r && styles.radiusTextActive]}>{r} km</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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
              <Text style={styles.emptyText}>Impossible de charger les terrains. Tirez pour réessayer.</Text>
            </View>
          ) : filteredVenues.length === 0 ? (
            <View style={styles.centered}>
              <MapPin size={48} color={Colors.text.muted} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Aucun terrain trouvé</Text>
              <Text style={styles.emptyText}>
                {search.trim() || sportFilter !== 'all'
                  ? 'Modifiez vos filtres pour voir plus de résultats.'
                  : 'Aucun terrain disponible pour le moment.'}
              </Text>
            </View>
          ) : (
            filteredVenues.map(venue => {
              if (!venue || !venue.id) return null;
              const rating = Number(venue.rating) || 0;
              const price = Number(venue.pricePerHour) || 0;
              const sports = Array.isArray(venue.sport) ? (venue.sport as string[]) : [];
              const amenities = Array.isArray(venue.amenities) ? venue.amenities : [];
              const distance = (venue as any).distance !== undefined ? (venue as any).distance : null;

              return (
                <TouchableOpacity
                  key={venue.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/venue/${venue.id}` as any)}
                >
                  <View style={styles.venueCard}>
                    <View style={styles.venueHeader}>
                      <View style={styles.venueInfo}>
                        <Text style={styles.venueName}>{venue.name || 'Sans nom'}</Text>
                        <View style={styles.locationRow}>
                          <MapPin size={13} color={Colors.text.muted} strokeWidth={2} />
                          <Text style={styles.venueCity}>{venue.city || 'Ville inconnue'}</Text>
                        </View>
                      </View>
                      <View style={styles.ratingBadge}>
                        <Star size={13} color={Colors.primary.orange} strokeWidth={2} />
                        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                      </View>
                    </View>

                    <View style={styles.venueMeta}>
                      <View style={styles.priceBadge}>
                        <DollarSign size={13} color={Colors.primary.orange} strokeWidth={2} />
                        <Text style={styles.priceText}>{price.toLocaleString()} FCFA/h</Text>
                      </View>
                      {distance !== null && (
                        <View style={styles.distanceBadge}>
                          <Navigation size={13} color={Colors.primary.blue} strokeWidth={2} />
                          <Text style={styles.distanceText}>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</Text>
                        </View>
                      )}
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
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function VenuesTabScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/(home)' as any);
  };

  return (
    <VenuesErrorBoundary onBack={handleBack}>
      <VenuesTabContent />
    </VenuesErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: OUTER_PAD,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xs,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  locationPillText: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '700' as const,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 16,
    marginHorizontal: OUTER_PAD,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  clearBtn: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  filterScroller: { maxHeight: 44, marginBottom: SPACING.sm },
  filterContent: { paddingHorizontal: OUTER_PAD, gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange,
  },
  filterText: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' as const },
  filterTextActive: { color: Colors.primary.orange },

  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: OUTER_PAD,
    backgroundColor: Colors.primary.orange + '0A',
    borderRadius: 16,
    padding: 14,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '12',
  },
  locationPromptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPromptText: { flex: 1, color: Colors.text.secondary, fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
  locationPromptBtn: {
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  locationPromptBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },

  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: OUTER_PAD,
    marginBottom: SPACING.sm,
  },
  radiusLabel: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  radiusContent: { gap: 8 },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  radiusChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange,
  },
  radiusText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  radiusTextActive: { color: Colors.primary.orange },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingBottom: 100 },

  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const },
  emptyText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' as const, maxWidth: 280 },

  venueCard: {
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    padding: CARD_INNER_PAD - 4,
    marginBottom: CARD_GAP,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...cardGlow,
  },
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  venueInfo: { flex: 1 },
  venueName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  venueCity: { color: Colors.text.muted, fontSize: 13 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },
  venueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  priceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' as const },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  distanceText: { color: Colors.primary.blue, fontSize: 13, fontWeight: '600' as const },
  sportsList: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  sportTag: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sportTagText: { color: Colors.text.secondary, fontSize: 11, fontWeight: '600' as const },
  moreText: { color: Colors.text.muted, fontSize: 11 },
  amenitiesPreview: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
});
