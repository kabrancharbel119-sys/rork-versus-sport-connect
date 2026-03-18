import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions, TextInput, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Phone, Mail, Star, DollarSign, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { venueReviewsApi } from '@/lib/api/venue-reviews';
import { tournamentsApi } from '@/lib/api/tournaments';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import type { VenueReview } from '@/types';

const sportLabels: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball',
  tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton',
  tabletennis: 'Tennis de table', padel: 'Padel', squash: 'Squash',
  futsal: 'Futsal', beachvolleyball: 'Beach-volley',
};

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateFR(dateStr: string): string {
  const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const GALLERY_IMAGE_WIDTH = Dimensions.get('window').width - 32;
const BOOKING_WINDOW_DAYS = 7;

export default function VenueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(true);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(true);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const venueQuery = useQuery({
    queryKey: ['venue', id],
    queryFn: async () => {
      try {
        return await venuesApi.getById(id!);
      } catch (e: any) {
        console.error('[VenueDetail] Error loading venue:', e?.message);
        throw e;
      }
    },
    enabled: !!id,
    retry: 1,
  });

  const availabilityQuery = useQuery({
    queryKey: ['availability', id, selectedDate],
    queryFn: async () => {
      try {
        return await venuesApi.getAvailability(id!, selectedDate);
      } catch (e: any) {
        console.error('[VenueDetail] Error loading availability:', e?.message);
        return [];
      }
    },
    enabled: !!id && !!selectedDate,
    retry: 1,
  });

  const reviewsQuery = useQuery({
    queryKey: ['venueReviews', id],
    queryFn: () => venueReviewsApi.getByVenue(id!),
    enabled: !!id,
    retry: 1,
  });

  const myReviewQuery = useQuery({
    queryKey: ['venueReviewMine', id, user?.id],
    queryFn: () => venueReviewsApi.getByVenueAndUser(id!, user!.id),
    enabled: !!id && !!user?.id,
    retry: 1,
  });

  const canReviewQuery = useQuery({
    queryKey: ['canReviewVenue', id, user?.id],
    queryFn: () => venueReviewsApi.canUserReview(id!, user!.id),
    enabled: !!id && !!user?.id,
    retry: 1,
  });

  const tournamentsQuery = useQuery({
    queryKey: ['venueTournaments', id],
    queryFn: () => tournamentsApi.getByVenue(id!),
    enabled: !!id,
    retry: 1,
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Vous devez être connecté pour laisser un avis.');
      if (reviewRating < 1 || reviewRating > 5) throw new Error('Choisissez une note entre 1 et 5.');
      return venueReviewsApi.upsert(user.id, {
        venueId: id!,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueReviews', id] });
      queryClient.invalidateQueries({ queryKey: ['venueReviewMine', id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['venue', id] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      Alert.alert('Merci !', 'Votre avis a été enregistré.');
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message || 'Impossible d’enregistrer votre avis.');
    },
  });

  const bookMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Vous devez être connecté pour réserver.');
      if (selectedSlots.length === 0) throw new Error('Sélectionnez au moins un créneau horaire.');
      const sorted = [...selectedSlots].sort((a, b) => a - b);
      const startTime = `${sorted[0]}:00`;
      const endTime = `${sorted[sorted.length - 1] + 1}:00`;
      return venuesApi.book(user.id, {
        venueId: id!,
        date: selectedDate,
        startTime,
        endTime,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', id] });
      queryClient.invalidateQueries({ queryKey: ['ownerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      setSelectedSlots([]);
      Alert.alert(
        'Réservation confirmée !',
        'Votre créneau a été réservé avec succès. Vous pouvez retrouver vos réservations dans votre profil.'
      );
    },
    onError: (error: Error) => {
      Alert.alert(
        'Impossible de réserver',
        error.message || 'Une erreur est survenue lors de la réservation. Veuillez réessayer.'
      );
    },
  });

  const venue = venueQuery.data;
  const slots = availabilityQuery.data || [];
  const currentHour = new Date().getHours();
  const isToday = selectedDate === toLocalDateString(new Date());

  const dates = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      result.push({
        dateStr: toLocalDateString(d),
        dayName: DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        monthShort: ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'][d.getMonth()],
        isToday: i === 0,
      });
    }
    return result;
  }, []);

  const toggleSlot = (hour: number) => {
    setSelectedSlots(prev => {
      if (prev.includes(hour)) {
        return prev.filter(h => h !== hour);
      }
      const next = [...prev, hour].sort((a, b) => a - b);
      return next;
    });
  };

  const pricePerHour = Number(venue?.pricePerHour) || 0;

  const totalPrice = useMemo(() => {
    return selectedSlots.length * pricePerHour;
  }, [selectedSlots, pricePerHour]);

  // Check if selected slots are consecutive
  const slotsAreConsecutive = useMemo(() => {
    if (selectedSlots.length <= 1) return true;
    const sorted = [...selectedSlots].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  }, [selectedSlots]);

  const bookingSummary = useMemo(() => {
    if (selectedSlots.length === 0) return null;
    const sorted = [...selectedSlots].sort((a, b) => a - b);
    const start = sorted[0];
    const end = sorted[sorted.length - 1] + 1;
    return {
      start,
      end,
      duration: selectedSlots.length,
      timeStr: `${start}h - ${end}h`,
      dateStr: formatDateFR(selectedDate),
    };
  }, [selectedSlots, selectedDate]);

  const reviews = reviewsQuery.data || [];
  const averageReviewRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum: number, r: VenueReview) => sum + (Number(r.rating) || 0), 0) / reviews.length;
  }, [reviews]);

  useEffect(() => {
    if (myReviewQuery.data) {
      setReviewRating(Number(myReviewQuery.data.rating) || 0);
      setReviewComment(myReviewQuery.data.comment || '');
    }
  }, [myReviewQuery.data]);

  const handleBook = () => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Vous devez être connecté pour effectuer une réservation.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    if (selectedSlots.length === 0) {
      Alert.alert('Aucun créneau', 'Appuyez sur les heures disponibles (en vert) pour les sélectionner.');
      return;
    }
    if (!slotsAreConsecutive) {
      Alert.alert(
        'Créneaux non consécutifs',
        'Les heures sélectionnées ne sont pas consécutives. La réservation couvrira toute la plage de ' +
        `${bookingSummary?.start}h à ${bookingSummary?.end}h (${bookingSummary?.end! - bookingSummary?.start!}h).\n\n` +
        'Voulez-vous continuer ?',
        [
          { text: 'Modifier', style: 'cancel' },
          { text: 'Continuer', onPress: () => confirmBook() },
        ]
      );
      return;
    }
    confirmBook();
  };

  const confirmBook = () => {
    if (!bookingSummary || !venue) return;
    Alert.alert(
      'Confirmer la réservation',
      `${venue.name}\n` +
      `${bookingSummary.dateStr}\n` +
      `${bookingSummary.timeStr} (${bookingSummary.duration}h)\n\n` +
      `Total : ${totalPrice.toLocaleString()} FCFA`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => bookMutation.mutate() },
      ]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/venues' as any);
  };

  if (venueQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color={Colors.primary.orange} />
            <Text style={{ color: Colors.text.muted, marginTop: 12, fontSize: 14 }}>Chargement du terrain...</Text>
          </SafeAreaView>
        </View>
      </>
    );
  }

  if (venueQuery.error || !venue) {
    const errMsg = (venueQuery.error as any)?.message || '';
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
            <AlertCircle size={48} color={Colors.status.error} />
            <Text style={[styles.errorText, { marginTop: 12 }]}>
              {errMsg.includes('not found') || errMsg.includes('non trouvé')
                ? 'Ce terrain n\'existe pas ou a été supprimé.'
                : errMsg.includes('network') || errMsg.includes('fetch')
                  ? 'Problème de connexion. Vérifiez votre Internet.'
                  : 'Impossible de charger ce terrain.'}
            </Text>
            {errMsg ? (
              <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                Détail : {errMsg}
              </Text>
            ) : null}
            <Button title="Retour" onPress={handleBack} variant="outline" style={{ marginTop: 20 }} />
          </SafeAreaView>
        </View>
      </>
    );
  }

  const rating = Number(venue.rating) || 0;
  const sports = Array.isArray(venue.sport) ? (venue.sport as string[]) : [];
  const amenities = Array.isArray(venue.amenities) ? venue.amenities : [];
  const venueImages = Array.isArray(venue.images) ? venue.images.filter(Boolean) : [];
  const heroImageUri = venueImages[0] ?? null;
  const selectedDayOfWeek = new Date(`${selectedDate}T00:00:00`).getDay();
  const openingHours = Array.isArray(venue.openingHours) ? venue.openingHours : [];
  const selectedDayHours = openingHours.find((d: any) => Number(d?.dayOfWeek) === selectedDayOfWeek);
  const isSelectedDayClosed = !!selectedDayHours?.isClosed;
  const selectedHoursLabel = selectedSlots.length > 0
    ? `${selectedSlots.length}h sélectionnée${selectedSlots.length > 1 ? 's' : ''}`
    : 'Aucun créneau';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#060A10', '#0A0E16', Colors.background.dark, '#0B1018', '#0D1420']}
          locations={[0, 0.2, 0.5, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.backgroundPattern}>
          <View style={[styles.patternCircle, { top: -90, right: -60 }]} />
          <View style={[styles.patternCircle, { bottom: 140, left: -90 }]} />
        </View>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              {heroImageUri ? (
                <Image source={{ uri: heroImageUri }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroFallbackBackground} />
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.72)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <TouchableOpacity style={styles.heroBackButton} onPress={handleBack}>
                <ArrowLeft size={22} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.heroContent}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroRatingBadge}>
                    <Star size={13} color={Colors.primary.orange} fill={Colors.primary.orange} />
                    <Text style={styles.heroRatingText}>{rating.toFixed(1)}</Text>
                  </View>
                  <View style={styles.heroPriceBadge}>
                    <DollarSign size={12} color="#FFF" />
                    <Text style={styles.heroPriceText}>{pricePerHour.toLocaleString()} FCFA/h</Text>
                  </View>
                </View>

                <Text style={styles.heroName} numberOfLines={2}>{venue.name || 'Terrain'}</Text>

                <View style={styles.heroMetaRow}>
                  <MapPin size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroMetaText} numberOfLines={2}>
                    {venue.address || ''}{venue.address && venue.city ? ', ' : ''}{venue.city || ''}
                  </Text>
                </View>

                {sports.length > 0 ? (
                  <View style={styles.heroSportRow}>
                    {sports.slice(0, 3).map((sport) => (
                      <View key={sport} style={styles.heroSportChip}>
                        <Text style={styles.heroSportText}>{sportLabels[sport] || sport}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.keyInfoGrid}>
              <View style={styles.keyInfoCard}>
                <View style={[styles.keyInfoIconWrap, { backgroundColor: Colors.primary.orange + '24' }]}>
                  <DollarSign size={14} color={Colors.primary.orange} />
                </View>
                <Text style={styles.keyInfoLabel}>Tarif</Text>
                <Text style={styles.keyInfoValue}>{pricePerHour.toLocaleString()} FCFA/h</Text>
              </View>
              <View style={styles.keyInfoCard}>
                <View style={[styles.keyInfoIconWrap, { backgroundColor: Colors.status.success + '24' }]}>
                  <Star size={14} color={Colors.status.success} fill={Colors.status.success} />
                </View>
                <Text style={styles.keyInfoLabel}>Note</Text>
                <Text style={styles.keyInfoValue}>{rating.toFixed(1)} / 5</Text>
              </View>
              <View style={styles.keyInfoCard}>
                <View style={[styles.keyInfoIconWrap, { backgroundColor: Colors.primary.blue + '24' }]}>
                  <Check size={14} color={Colors.primary.blue} />
                </View>
                <Text style={styles.keyInfoLabel}>Sports</Text>
                <Text style={styles.keyInfoValue}>{sports.length || 1} dispo</Text>
              </View>
            </View>

            {/* Venue Info Card */}
            <Card style={styles.infoCard}>
              <Text style={styles.infoSectionLabel}>À propos du terrain</Text>

              {venue.phone ? (
                <View style={styles.infoRow}>
                  <Phone size={16} color={Colors.text.muted} />
                  <Text style={styles.infoText}>{venue.phone}</Text>
                </View>
              ) : null}

              {venue.email ? (
                <View style={styles.infoRow}>
                  <Mail size={16} color={Colors.text.muted} />
                  <Text style={styles.infoText}>{venue.email}</Text>
                </View>
              ) : null}

              {venue.description ? (
                <Text style={styles.description}>{venue.description}</Text>
              ) : null}

              {sports.length > 0 ? (
                <View style={styles.sportTags}>
                  {sports.map(s => (
                    <View key={s} style={styles.sportTag}>
                      <Text style={styles.sportTagText}>{sportLabels[s] || s}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {amenities.length > 0 ? (
                <View style={styles.amenitiesSection}>
                  <Text style={styles.amenitiesTitle}>Équipements</Text>
                  <View style={styles.amenitiesList}>
                    {amenities.map((a, i) => (
                      <View key={`${a}-${i}`} style={styles.amenityTag}>
                        <Check size={12} color={Colors.status.success} />
                        <Text style={styles.amenityText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>

            <TouchableOpacity
              style={styles.galleryHeader}
              activeOpacity={0.82}
              onPress={() => setIsGalleryExpanded(prev => !prev)}
            >
              <View style={styles.galleryHeaderLeft}>
                <Text style={styles.galleryTitle}>Photos du lieu</Text>
                <Text style={styles.galleryHint}>
                  {venueImages.length > 0
                    ? `${venueImages.length} photo${venueImages.length > 1 ? 's' : ''}`
                    : 'Aucune photo'}
                </Text>
              </View>
              <View style={styles.galleryToggleRight}>
                <Text style={styles.galleryToggleText}>{isGalleryExpanded ? 'Réduire' : 'Afficher'}</Text>
                {isGalleryExpanded ? (
                  <ChevronUp size={18} color={Colors.text.secondary} />
                ) : (
                  <ChevronDown size={18} color={Colors.text.secondary} />
                )}
              </View>
            </TouchableOpacity>

            {isGalleryExpanded && (
              venueImages.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.galleryScroller}
                >
                  {venueImages.map((uri, idx) => (
                    <TouchableOpacity key={`${uri}-${idx}`} activeOpacity={0.9} onPress={() => setSelectedImageUri(uri)}>
                      <Image
                        source={{ uri }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.galleryFallback}>
                  <Text style={styles.galleryFallbackText}>Aucune photo disponible pour ce terrain.</Text>
                </View>
              )
            )}

            {/* Tournaments Section */}
            {tournamentsQuery.data && tournamentsQuery.data.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionTitleNoMargin}>Tournois organisés ici</Text>
                  <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountText}>{tournamentsQuery.data.length}</Text>
                  </View>
                </View>
                {tournamentsQuery.data.map((tournament) => (
                  <TouchableOpacity
                    key={tournament.id}
                    style={styles.tournamentCard}
                    onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tournamentHeader}>
                      <Text style={styles.tournamentName}>{tournament.name}</Text>
                      <View style={[styles.tournamentStatusBadge, 
                        tournament.status === 'registration' && styles.tournamentStatusRegistration,
                        tournament.status === 'in_progress' && styles.tournamentStatusInProgress,
                        tournament.status === 'completed' && styles.tournamentStatusCompleted
                      ]}>
                        <Text style={styles.tournamentStatusText}>
                          {tournament.status === 'registration' ? 'Inscriptions' : 
                           tournament.status === 'in_progress' ? 'En cours' : 'Terminé'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.tournamentInfo} numberOfLines={2}>
                      {tournament.description}
                    </Text>
                    <View style={styles.tournamentFooter}>
                      <Text style={styles.tournamentDetail}>
                        {sportLabels[tournament.sport] || tournament.sport} • {tournament.format}
                      </Text>
                      <Text style={styles.tournamentDetail}>
                        {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <TouchableOpacity
              style={styles.reviewAccordionHeader}
              activeOpacity={0.8}
              onPress={() => setIsReviewsExpanded(prev => !prev)}
            >
              <View style={styles.reviewAccordionHeaderLeft}>
                <Text style={styles.sectionTitleNoMargin}>Avis des utilisateurs</Text>
                <Text style={styles.reviewCountText}>{reviews.length} avis</Text>
              </View>
              {isReviewsExpanded ? (
                <ChevronUp size={18} color={Colors.text.secondary} />
              ) : (
                <ChevronDown size={18} color={Colors.text.secondary} />
              )}
            </TouchableOpacity>

            {isReviewsExpanded && (
              <>
                <Card style={styles.reviewSummaryCard}>
                  <View style={styles.reviewSummaryRow}>
                    <View style={styles.ratingBadge}>
                      <Star size={14} color={Colors.primary.orange} />
                      <Text style={styles.ratingText}>{averageReviewRating.toFixed(1)}</Text>
                    </View>
                    <Text style={styles.reviewCountText}>
                      {reviews.length} avis
                    </Text>
                  </View>
                </Card>

                {user ? (
                  canReviewQuery.data ? (
                    <Card style={styles.reviewFormCard}>
                      <Text style={styles.reviewFormTitle}>
                        {myReviewQuery.data ? 'Modifier votre avis' : 'Laisser un avis'}
                      </Text>
                      <View style={styles.starPickerRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={styles.starButton}>
                            <Star
                              size={24}
                              color={star <= reviewRating ? Colors.primary.orange : Colors.text.muted}
                              fill={star <= reviewRating ? Colors.primary.orange : 'transparent'}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={styles.reviewInput}
                        placeholder="Décrivez votre expérience (optionnel)"
                        placeholderTextColor={Colors.text.muted}
                        value={reviewComment}
                        onChangeText={setReviewComment}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        maxLength={500}
                      />
                      <Button
                        title={submitReviewMutation.isPending ? 'Enregistrement...' : 'Publier mon avis'}
                        onPress={() => submitReviewMutation.mutate()}
                        disabled={submitReviewMutation.isPending}
                        variant="orange"
                      />
                    </Card>
                  ) : (
                    <Text style={styles.reviewRestrictionText}>
                      Vous pourrez noter ce terrain après avoir effectué une réservation confirmée.
                    </Text>
                  )
                ) : (
                  <Text style={styles.reviewRestrictionText}>
                    Connectez-vous pour laisser un avis.
                  </Text>
                )}

                {reviews.length > 0 && (
                  <View style={styles.reviewsList}>
                    {reviews.map((review: VenueReview) => (
                      <Card key={review.id} style={styles.reviewItemCard}>
                        <View style={styles.reviewItemHeader}>
                          <View>
                            <Text style={styles.reviewAuthorText}>{review.authorName || 'Utilisateur'}</Text>
                            <View style={styles.reviewItemStars}>
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={`${review.id}-${star}`}
                                  size={14}
                                  color={star <= review.rating ? Colors.primary.orange : Colors.text.muted}
                                  fill={star <= review.rating ? Colors.primary.orange : 'transparent'}
                                />
                              ))}
                            </View>
                          </View>
                          <Text style={styles.reviewDateText}>
                            {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                        {review.comment ? (
                          <Text style={styles.reviewCommentText}>{review.comment}</Text>
                        ) : (
                          <Text style={styles.reviewNoCommentText}>Aucun commentaire ajouté.</Text>
                        )}
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}

            <Card style={styles.bookingFlowCard}>
              <View style={styles.bookingFlowHeader}>
                <Text style={styles.bookingFlowTitle}>Réserver ce terrain</Text>
                <View style={styles.bookingFlowHeaderRight}>
                  <Text style={styles.bookingFlowSubtitle}>{formatDateFR(selectedDate)}</Text>
                  <View style={[styles.bookingHeaderBadge, selectedSlots.length > 0 && styles.bookingHeaderBadgeActive]}>
                    <Text style={styles.bookingHeaderBadgeText}>{selectedHoursLabel}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.bookingFlowHint}>
                {selectedSlots.length > 0
                  ? 'Vérifiez vos heures puis confirmez en bas de l’écran.'
                  : 'Sélectionnez votre date et vos créneaux pour voir le total.'}
              </Text>

              {/* Date Selector */}
              <Text style={styles.bookingStepTitle}>1. Choisir une date</Text>
              <View style={styles.bookingWindowBadge}>
                <Text style={styles.bookingWindowBadgeText}>Réservations ouvertes sur 7 jours</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroller}>
                {dates.map(d => (
                  <TouchableOpacity
                    key={d.dateStr}
                    style={[styles.dateChip, selectedDate === d.dateStr && styles.dateChipActive]}
                    onPress={() => { setSelectedDate(d.dateStr); setSelectedSlots([]); }}
                  >
                    <Text style={[styles.dateDayName, selectedDate === d.dateStr && styles.dateTextActive]}>
                      {d.isToday ? 'Auj.' : d.dayName}
                    </Text>
                    <Text style={[styles.dateDayNum, selectedDate === d.dateStr && styles.dateTextActive]}>
                      {d.dayNum}
                    </Text>
                    <Text style={[styles.dateMonth, selectedDate === d.dateStr && styles.dateTextActive]}>
                      {d.monthShort}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time Slots */}
              <Text style={styles.bookingStepTitle}>2. Choisir vos heures</Text>
              <Text style={styles.slotHint}>
                Sélectionnez un ou plusieurs créneaux verts pour construire votre réservation.
              </Text>

              <View style={styles.slotLegendRow}>
                <View style={styles.slotLegendItem}>
                  <View style={[styles.slotLegendDot, { backgroundColor: Colors.status.success }]} />
                  <Text style={styles.slotLegendText}>Disponible</Text>
                </View>
                <View style={styles.slotLegendItem}>
                  <View style={[styles.slotLegendDot, { backgroundColor: Colors.primary.orange }]} />
                  <Text style={styles.slotLegendText}>Sélectionné</Text>
                </View>
                <View style={styles.slotLegendItem}>
                  <View style={[styles.slotLegendDot, { backgroundColor: Colors.text.muted }]} />
                  <Text style={styles.slotLegendText}>Indispo</Text>
                </View>
              </View>

              {availabilityQuery.isLoading ? (
                <ActivityIndicator size="small" color={Colors.primary.orange} style={{ marginVertical: 20 }} />
              ) : availabilityQuery.error ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={20} color={Colors.status.error} />
                  <Text style={styles.errorBoxText}>
                    Impossible de charger les créneaux. Vérifiez votre connexion et réessayez.
                  </Text>
                </View>
              ) : slots.length === 0 ? (
                <Text style={styles.noSlots}>
                  {isSelectedDayClosed
                    ? 'Terrain fermé ce jour.'
                    : 'Aucun créneau disponible pour cette date.'}
                </Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {slots.map(slot => {
                    const isSelected = selectedSlots.includes(slot.hour);
                    const isBooked = !slot.available;
                    const isPast = isToday && slot.hour <= currentHour;
                    const isDisabled = isBooked || isPast;
                    return (
                      <TouchableOpacity
                        key={slot.hour}
                        style={[
                          styles.slot,
                          isDisabled && styles.slotBooked,
                          isSelected && !isDisabled && styles.slotSelected,
                        ]}
                        onPress={() => !isDisabled && toggleSlot(slot.hour)}
                        disabled={isDisabled}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.slotTime,
                          isDisabled && styles.slotTimeBooked,
                          isSelected && !isDisabled && styles.slotTimeSelected,
                        ]}>
                          {slot.hour}h - {slot.hour + 1}h
                        </Text>
                        <Text style={[
                          styles.slotStatus,
                          isDisabled && styles.slotStatusBooked,
                          isSelected && !isDisabled && styles.slotStatusSelected,
                        ]}>
                          {isPast ? 'Passé' : isBooked ? 'Réservé' : isSelected ? 'Sélectionné' : 'Disponible'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {bookingSummary && (
                <View style={styles.bookingSelectionCard}>
                  <Text style={styles.bookingSelectionTitle}>Sélection actuelle</Text>
                  <Text style={styles.bookingSelectionValue}>{bookingSummary.timeStr} ({bookingSummary.duration}h)</Text>
                  <Text style={styles.bookingSelectionPrice}>{totalPrice.toLocaleString()} FCFA</Text>
                </View>
              )}

              {/* Selection warning */}
              {selectedSlots.length > 0 && !slotsAreConsecutive && (
                <View style={styles.warningBox}>
                  <AlertCircle size={16} color="#F59E0B" />
                  <Text style={styles.warningText}>
                    Attention : vos heures ne sont pas consécutives. La réservation couvrira toute la plage de {bookingSummary?.start}h à {bookingSummary?.end}h.
                  </Text>
                </View>
              )}
            </Card>

            <View style={{ height: 140 }} />
          </ScrollView>

          {/* Booking Footer */}
          {selectedSlots.length > 0 && bookingSummary && (
            <View style={styles.bookingFooter}>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingSlots}>
                  {bookingSummary.timeStr} ({bookingSummary.duration}h)
                </Text>
                <Text style={styles.bookingTotal}>
                  {totalPrice.toLocaleString()} FCFA
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.bookBtn, bookMutation.isPending && { opacity: 0.6 }]}
                onPress={handleBook}
                disabled={bookMutation.isPending}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.primary.orange, Colors.primary.orangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bookBtnGradient}
                >
                  {bookMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.bookBtnText}>Réserver</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <Modal
            visible={!!selectedImageUri}
            animationType="fade"
            transparent
            onRequestClose={() => setSelectedImageUri(null)}
          >
            <View style={styles.fullscreenBackdrop}>
              <TouchableOpacity style={styles.fullscreenCloseZone} activeOpacity={1} onPress={() => setSelectedImageUri(null)} />
              {selectedImageUri ? (
                <Image source={{ uri: selectedImageUri }} style={styles.fullscreenImage} resizeMode="contain" />
              ) : null}
              <TouchableOpacity style={styles.fullscreenCloseButton} onPress={() => setSelectedImageUri(null)}>
                <Text style={styles.fullscreenCloseText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primary.orange + '0D',
    opacity: 0.35,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  errorText: { color: Colors.text.primary, fontSize: 16, textAlign: 'center', fontWeight: '600' },
  heroCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.card,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallbackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.cardLight,
  },
  heroBackButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroRatingText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  heroPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.primary.orange + 'D9',
  },
  heroPriceText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  heroName: {
    color: '#FFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  heroMetaText: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  heroSportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  heroSportChip: {
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroSportText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  keyInfoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -2,
  },
  keyInfoCard: {
    flex: 1,
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  keyInfoIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyInfoLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  keyInfoValue: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  infoSectionLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: Colors.background.card + 'F2',
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    marginTop: 8,
  },
  galleryHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  galleryTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '800' },
  galleryHint: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  galleryToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  galleryToggleText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  galleryScroller: { marginBottom: 18, marginTop: 10 },
  galleryImage: {
    width: GALLERY_IMAGE_WIDTH,
    height: 244,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  galleryFallback: {
    height: 130,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  galleryFallbackText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  ratingText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  infoText: { color: Colors.text.secondary, fontSize: 14, flex: 1 },
  description: {
    color: Colors.text.secondary, fontSize: 14, lineHeight: 20,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
  sportTags: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12,
  },
  sportTag: {
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  sportTagText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' },
  amenitiesSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  amenitiesTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  amenitiesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  amenityText: { color: Colors.text.secondary, fontSize: 12 },
  reviewAccordionHeader: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary.orange + '14',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewAccordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleNoMargin: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  reviewSummaryCard: {
    padding: 14,
    marginTop: 2,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 14,
  },
  reviewSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewCountText: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' },
  reviewFormCard: {
    padding: 14,
    marginTop: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 14,
  },
  reviewFormTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  starPickerRow: { flexDirection: 'row', gap: 10 },
  starButton: { paddingVertical: 2 },
  reviewInput: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.dark,
    color: Colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  reviewRestrictionText: { color: Colors.text.muted, fontSize: 13, marginTop: 10, marginBottom: 4 },
  reviewsList: { gap: 10, marginTop: 10 },
  reviewItemCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 12,
  },
  sectionHeaderRow: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderAccent: {
    width: 4,
    height: 18,
    borderRadius: 99,
    backgroundColor: Colors.primary.orange,
  },
  sectionCountBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  reviewAuthorText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  reviewItemStars: { flexDirection: 'row', gap: 2 },
  reviewDateText: { color: Colors.text.muted, fontSize: 12 },
  reviewCommentText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20 },
  reviewNoCommentText: { color: Colors.text.muted, fontSize: 13, fontStyle: 'italic' },
  sectionTitle: {
    color: Colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8,
  },
  bookingFlowCard: {
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  bookingFlowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  bookingFlowTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  bookingFlowHeaderRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  bookingFlowSubtitle: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  bookingHeaderBadge: {
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bookingHeaderBadgeActive: {
    backgroundColor: Colors.primary.orange + '18',
    borderColor: Colors.primary.orange + '40',
  },
  bookingHeaderBadgeText: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  bookingFlowHint: {
    color: Colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  bookingStepTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  bookingWindowBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.primary.blue + '1A',
    borderWidth: 1,
    borderColor: Colors.primary.blue + '42',
  },
  bookingWindowBadgeText: {
    color: Colors.primary.blue,
    fontSize: 11,
    fontWeight: '700',
  },
  tournamentCard: {
    backgroundColor: Colors.background.card + 'F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light + '90',
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  tournamentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tournamentStatusRegistration: {
    backgroundColor: Colors.status.success + '20',
  },
  tournamentStatusInProgress: {
    backgroundColor: Colors.primary.orange + '20',
  },
  tournamentStatusCompleted: {
    backgroundColor: Colors.text.muted + '20',
  },
  tournamentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tournamentInfo: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  tournamentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tournamentDetail: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  slotHint: {
    color: Colors.text.muted, fontSize: 13, marginBottom: 10, lineHeight: 18,
  },
  slotLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  slotLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  slotLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  slotLegendText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  dateScroller: { marginBottom: 8 },
  dateChip: {
    alignItems: 'center', justifyContent: 'center',
    width: 62, height: 74, borderRadius: 14, marginRight: 8,
    backgroundColor: Colors.background.card + 'F5',
    borderWidth: 1, borderColor: Colors.border.light + '95',
  },
  dateChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange,
    shadowColor: Colors.primary.orange,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dateDayName: { color: Colors.text.muted, fontSize: 11, fontWeight: '600' },
  dateDayNum: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  dateMonth: { color: Colors.text.muted, fontSize: 10 },
  dateTextActive: { color: Colors.primary.orange },
  noSlots: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginVertical: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.status.error + '15',
    borderWidth: 1, borderColor: Colors.status.error + '30',
    borderRadius: 10, padding: 12, marginVertical: 12,
  },
  errorBoxText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F59E0B15',
    borderWidth: 1, borderColor: '#F59E0B30',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  warningText: { color: Colors.text.secondary, fontSize: 12, flex: 1, lineHeight: 17 },
  slotsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  slot: {
    width: '31%' as any, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 12,
    backgroundColor: Colors.background.card + 'F5',
    borderWidth: 1.5, borderColor: Colors.border.light + '95',
  },
  slotBooked: {
    backgroundColor: Colors.background.cardLight,
    borderColor: 'transparent', opacity: 0.4,
  },
  slotSelected: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange,
  },
  slotTime: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  slotTimeBooked: { color: Colors.text.muted },
  slotTimeSelected: { color: Colors.primary.orange },
  slotStatus: { color: Colors.status.success, fontSize: 10, marginTop: 2, fontWeight: '600' },
  slotStatusBooked: { color: Colors.text.muted },
  slotStatusSelected: { color: Colors.primary.orange },
  bookingSelectionCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary.orange + '10',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '35',
    gap: 2,
  },
  bookingSelectionTitle: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bookingSelectionValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  bookingSelectionPrice: {
    color: Colors.primary.orange,
    fontSize: 16,
    fontWeight: '800',
  },
  bookingFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background.card,
    borderTopWidth: 1, borderTopColor: Colors.border.light,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 34,
  },
  bookingInfo: { flex: 1, gap: 2 },
  bookingSlots: { color: Colors.text.secondary, fontSize: 13 },
  bookingTotal: { color: Colors.primary.orange, fontSize: 20, fontWeight: '800' },
  bookBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 4,
  },
  bookBtnGradient: {
    width: '100%',
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullscreenImage: {
    width: '100%',
    height: '78%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    bottom: 48,
    backgroundColor: Colors.background.card,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fullscreenCloseText: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
});
