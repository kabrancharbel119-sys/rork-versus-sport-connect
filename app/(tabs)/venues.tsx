import React, { useState, useMemo, useCallback, Component, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MapPin, Star, Search, DollarSign, Navigation, ImageIcon, Heart, ArrowDownUp } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const PRICE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tous prix' },
  { key: 'free', label: 'Gratuit' },
  { key: 'lt25', label: '< 25k' },
  { key: 'lt50', label: '< 50k' },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'rating', label: 'Note' },
  { key: 'distance', label: 'Distance' },
  { key: 'price_asc', label: 'Prix ↑' },
  { key: 'price_desc', label: 'Prix ↓' },
];

const FAV_KEY = 'favorite_venues';

const sportColors: Record<string, string> = {
  football: '#10B981',
  basketball: '#F59E0B',
  tennis: '#42A5F5',
  volleyball: '#EF4444',
  padel: '#A78BFA',
  handball: '#FB923C',
  futsal: '#34D399',
};

const sportBgColors: Record<string, string> = {
  football: '#10B98120',
  basketball: '#F59E0B20',
  tennis: '#42A5F520',
  volleyball: '#EF444420',
  padel: '#A78BFA20',
  handball: '#FB923C20',
  futsal: '#34D39920',
};

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
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then(data => {
      if (data) {
        try {
          setFavorites(new Set(JSON.parse(data)));
        } catch {}
      }
    });
  }, []);

  const toggleFavorite = useCallback((venueId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      AsyncStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

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
      if (showFavOnly) {
        list = list.filter(v => favorites.has(v.id));
      }
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
      if (priceFilter !== 'all') {
        list = list.filter(v => {
          const price = Number(v.pricePerHour) || 0;
          if (priceFilter === 'free') return price === 0;
          if (priceFilter === 'lt25') return price > 0 && price < 25000;
          if (priceFilter === 'lt50') return price > 0 && price < 50000;
          return true;
        });
      }
      const sorted = [...list];
      sorted.sort((a, b) => {
        if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
        if (sortBy === 'price_asc') return (Number(a.pricePerHour) || 0) - (Number(b.pricePerHour) || 0);
        if (sortBy === 'price_desc') return (Number(b.pricePerHour) || 0) - (Number(a.pricePerHour) || 0);
        if (sortBy === 'distance') {
          const da = (a as any).distance ?? Infinity;
          const db = (b as any).distance ?? Infinity;
          return da - db;
        }
        return 0;
      });
      return sorted;
    } catch (e) {
      console.error('[VenuesTabScreen] Filter error:', e);
      return [];
    }
  }, [venues, search, sportFilter, priceFilter, sortBy, showFavOnly, favorites]);

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
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#0d111d', '#0f1626', '#0d111d']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Terrains</Text>
              <Text style={styles.headerSubtitle}>{filteredVenues.length} terrain{filteredVenues.length > 1 ? 's' : ''} disponible{filteredVenues.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerIconBtn, showFavOnly && styles.headerIconBtnActive]}
                onPress={() => setShowFavOnly(v => !v)}
              >
                <Heart size={18} color={showFavOnly ? Colors.primary.orange : Colors.text.muted} fill={showFavOnly ? Colors.primary.orange : 'none'} strokeWidth={2} />
                {favorites.size > 0 && (
                  <View style={styles.favCountBadge}>
                    <Text style={styles.favCountText}>{favorites.size}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconBtn, showSortMenu && styles.headerIconBtnActive]}
                onPress={() => setShowSortMenu(v => !v)}
              >
                <ArrowDownUp size={18} color={showSortMenu ? Colors.primary.blue : Colors.text.muted} strokeWidth={2} />
              </TouchableOpacity>
              {location ? (
                <LinearGradient
                  colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.locationPill}
                >
                  <Navigation size={13} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.locationPillText}>{radiusKm} km</Text>
                </LinearGradient>
              ) : null}
            </View>
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

          {showSortMenu && (
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
                  onPress={() => { setSortBy(opt.key); setShowSortMenu(false); }}
                >
                  <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
            <View style={styles.filterDivider} />
            {PRICE_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, priceFilter === f.key && styles.filterChipActive]}
                onPress={() => setPriceFilter(f.key)}
              >
                <Text style={[styles.filterText, priceFilter === f.key && styles.filterTextActive]}>
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
                  if (hasPermission === 'granted') {
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
              {[5, 10, 20, 50].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]}
                  onPress={() => setRadiusKm(r)}
                >
                  <Text style={[styles.radiusText, radiusKm === r && styles.radiusTextActive]}>{r} km</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
                    {/* ════ Photo preview ════ */}
                    {venue.images && venue.images.length > 0 ? (
                      <View style={styles.venueImageWrap}>
                        <ExpoImage
                          source={{ uri: venue.images[0] }}
                          style={styles.venueImage}
                          contentFit="cover"
                          transition={200}
                        />
                        <View style={styles.venueImageGradient} />
                        <View style={styles.venueImageBadges}>
                          <View style={styles.ratingBadge}>
                            <Star size={13} color={Colors.primary.orange} strokeWidth={2} fill={Colors.primary.orange} />
                            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                          </View>
                          {venue.images.length > 1 && (
                            <View style={styles.photoCountBadge}>
                              <ImageIcon size={11} color="#FFFFFF" />
                              <Text style={styles.photoCountText}>{venue.images.length}</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.favBtn}
                          onPress={() => toggleFavorite(venue.id)}
                          hitSlop={12}
                        >
                          <Heart
                            size={20}
                            color={favorites.has(venue.id) ? Colors.primary.orange : '#FFFFFF'}
                            fill={favorites.has(venue.id) ? Colors.primary.orange : 'none'}
                            strokeWidth={2}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.venueImagePlaceholder}>
                        <MapPin size={28} color={Colors.text.muted} strokeWidth={1.5} />
                        <View style={styles.ratingBadgeAbsolute}>
                          <Star size={13} color={Colors.primary.orange} strokeWidth={2} fill={Colors.primary.orange} />
                          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.favBtn}
                          onPress={() => toggleFavorite(venue.id)}
                          hitSlop={12}
                        >
                          <Heart
                            size={20}
                            color={favorites.has(venue.id) ? Colors.primary.orange : Colors.text.muted}
                            fill={favorites.has(venue.id) ? Colors.primary.orange : 'none'}
                            strokeWidth={2}
                          />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.venueBody}>
                      <View style={styles.venueHeader}>
                        <View style={styles.venueInfo}>
                          <Text style={styles.venueName}>{venue.name || 'Sans nom'}</Text>
                          <View style={styles.locationRow}>
                            <MapPin size={13} color={Colors.text.muted} strokeWidth={2} />
                            <Text style={styles.venueCity}>{venue.city || 'Ville inconnue'}</Text>
                          </View>
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
                            <View key={s} style={[styles.sportTag, { backgroundColor: sportBgColors[s] || Colors.background.cardLight }]}>
                              <Text style={[styles.sportTagText, { color: sportColors[s] || Colors.text.secondary }]}>{sportLabels[s] || s}</Text>
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
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
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
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 35 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    color: '#FFFFFF',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  locationPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  headerIconBtnActive: {
    backgroundColor: Colors.primary.orange + '20',
  },
  favCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  favCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: SPACING.sm,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.background.card,
  },
  sortChipActive: {
    backgroundColor: Colors.primary.blue + '20',
  },
  sortChipText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  sortChipTextActive: {
    color: Colors.primary.blue,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.light,
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  clearBtn: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  filterScroller: { maxHeight: 44, marginBottom: SPACING.sm },
  filterContent: { paddingHorizontal: 16, gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange + '40',
  },
  filterText: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' as const },
  filterTextActive: { color: Colors.primary.orange },

  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: Colors.primary.orange + '0A',
    borderRadius: 16,
    padding: 14,
    marginBottom: SPACING.sm,
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
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: SPACING.sm,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.background.card,
  },
  radiusChipActive: {
    backgroundColor: Colors.primary.orange + '20',
  },
  radiusText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  radiusTextActive: { color: Colors.primary.orange },

  scrollView: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

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
    borderRadius: CARD_RADIUS,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...cardGlow,
  },
  venueImageWrap: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  venueImageBadges: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  venueImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ratingBadgeAbsolute: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,107,0,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  venueBody: {
    padding: CARD_INNER_PAD - 4,
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
    backgroundColor: 'rgba(255,107,0,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' as const },
  venueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' as const },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary.blue + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
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
