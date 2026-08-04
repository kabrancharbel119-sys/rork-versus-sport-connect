import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, TextInput, Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { X, Trophy, MapPin, Check, ChevronDown, Search, Calendar, Users, DollarSign, Wallet, Ticket as TicketIcon, Info, Sparkles, ClipboardList, Plus, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { venuesApi } from '@/lib/api/venues';
import { ticketsApi } from '@/lib/api/tickets';
import { uploadTournamentImage } from '@/lib/uploadImage';
import { createAutoPost, autoPostMessages } from '@/lib/autoPosts';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { Sport, SkillLevel, Venue, VenuePaymentMode } from '@/types';
import { ALL_SPORTS, sportLabels, levelLabels } from '@/mocks/data';

const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const ENTRY_PAYMENT_MODES: { value: VenuePaymentMode; label: string; description: string }[] = [
  {
    value: 'in_app_immediate',
    label: 'Paiement en ligne à l\'inscription',
    description: 'Les équipes paient les frais d\'inscription via l\'app pour confirmer leur participation.',
  },
  {
    value: 'cash_off_app',
    label: 'Paiement cash / hors app',
    description: 'Les équipes paient en espèces directement à l\'organisateur.',
  },
];
const tournamentTypes = [
  { id: 'knockout', label: 'Élimination directe', icon: '🏆' },
  { id: 'league', label: 'Championnat', icon: '📊' },
  { id: 'group_knockout', label: 'Poules + Élimination', icon: '⚡' },
] as const;

const formats: Record<Sport, string[]> = {
  football: ['5v5', '7v7', '11v11'], basketball: ['3v3', '5v5'], volleyball: ['4v4', '6v6'],
  tennis: ['1v1', '2v2'], handball: ['7v7'], rugby: ['7v7', '15v15'], badminton: ['1v1', '2v2'],
  tabletennis: ['1v1', '2v2'], cricket: ['11v11'], baseball: ['9v9'], hockey: ['6v6', '11v11'],
  golf: ['1v1', '2v2', '4v4'], swimming: ['1v1', '4v4'], athletics: ['1v1', '4v4'], boxing: ['1v1'],
  mma: ['1v1'], wrestling: ['1v1'], judo: ['1v1'], karate: ['1v1'], taekwondo: ['1v1'],
  cycling: ['1v1', '4v4'], skateboarding: ['1v1'], surfing: ['1v1'], climbing: ['1v1', '2v2'],
  gymnastics: ['1v1'], esports: ['1v1', '2v2', '5v5'], futsal: ['5v5'], beachvolleyball: ['2v2', '4v4'],
  padel: ['2v2'], squash: ['1v1', '2v2'],
};

const sportIcons: Record<string, string> = {
  football: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', handball: '🤾', rugby: '🏉',
  badminton: '🏸', tabletennis: '🏓', cricket: '🏏', baseball: '⚾', hockey: '🏒', golf: '⛳',
  swimming: '🏊', athletics: '🏃', boxing: '🥊', mma: '🥋', wrestling: '🤼', judo: '🥋',
  karate: '🥋', taekwondo: '🥋', cycling: '🚴', skateboarding: '🛹', surfing: '🏄', climbing: '🧗',
  gymnastics: '🤸', esports: '🎮', futsal: '⚽', beachvolleyball: '🏐', padel: '🎾', squash: '🎾',
};

const MIN_MEMBERS_TO_CREATE_TOURNAMENT = 5;

const pickTournamentLogo = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

const pickTournamentBanner = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

/** Formate une date en AAAA-MM-JJ en heure locale (évite le décalage UTC) */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse AAAA-MM-JJ en Date à minuit en heure locale (évite le décalage UTC) */
function parseLocalDateString(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Parse AAAA-MM-JJ en Date à midi UTC pour l’API (toISOString() garde le bon jour) */
function localDateStringToDateForAPI(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

const emptyVenue: Venue = {
  id: '',
  name: 'Choisir un lieu',
  address: '',
  city: '',
  sport: [],
  pricePerHour: 0,
  rating: 0,
  amenities: [],
};


export default function CreateTournamentScreen() {
  const router = useRouter();
  const { user, isAdmin, isVenueManager } = useAuth();
  const { createTournament, isCreating, refetchTournaments } = useTournaments();
  const { venues: allVenues } = useMatches();
  const { getUserTeams } = useTeams();

  // Charger les terrains du gestionnaire si c'est un gestionnaire de terrain
  const myVenuesQuery = useQuery({
    queryKey: ['myVenues', user?.id],
    queryFn: () => venuesApi.getByOwner(user!.id),
    enabled: !!user?.id && isVenueManager,
  });

  // Les tournois doivent se tenir sur un terrain inscrit. Un gestionnaire de terrain ne peut choisir que ses propres terrains.
  const venues = isVenueManager ? (myVenuesQuery.data || []) : allVenues;

  const canCreateTournament = (() => {
    if (!user) return false;
    if (isAdmin) return true;
    if (isVenueManager) return true;
    const myTeams = getUserTeams(user.id);
    return myTeams.some((t) => t.captainId === user.id && (t.members?.length ?? 0) >= MIN_MEMBERS_TO_CREATE_TOURNAMENT);
  })();

  const [step, setStep] = useState(1);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [sportSearch, setSportSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, number[]>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: '', message: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [ticketTypes, setTicketTypes] = useState<{ name: string; description: string; price: string; quantity: string; validDays: string[] | null }[]>([{ name: 'Standard', description: '', price: '1000', quantity: '50', validDays: null }]);
  const scrollViewRef = useRef<ScrollView>(null);

  const defaultStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: 'football' as Sport,
    format: '11v11',
    type: 'knockout' as 'knockout' | 'league' | 'group_knockout',
    level: 'intermediate' as SkillLevel,
    maxTeams: '8',
    entryFee: '25000',
    prizePool: '200000',
    venue: emptyVenue,
    startDateStr: toLocalDateString(defaultStart),
    endDateStr: toLocalDateString(defaultEnd),
    sponsorName: '',
    logoUrl: '',
    bannerUrl: '',
    entryPaymentMode: 'in_app_immediate' as VenuePaymentMode,
    hasTickets: false as boolean,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isPaidTournament = (parseInt(formData.entryFee || '0', 10) || 0) > 0;

  const eventDays = useMemo(() => {
    if (!formData.startDateStr || !formData.endDateStr) return [];
    const start = parseLocalDateString(formData.startDateStr);
    const end = parseLocalDateString(formData.endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days: { date: string; label: string }[] = [];
    const cur = new Date(start);
    let dayNum = 1;
    while (cur <= end) {
      const dateStr = toLocalDateString(cur);
      const label = `Jour ${dayNum} - ${cur.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`;
      days.push({ date: dateStr, label });
      cur.setDate(cur.getDate() + 1);
      dayNum++;
    }
    return days;
  }, [formData.startDateStr, formData.endDateStr]);

  // Synchroniser le lieu par défaut quand les lieux sont chargés
  useEffect(() => {
    if (venues.length === 0) return;
    setFormData(prev => {
      if (prev.venue?.id && prev.venue.id !== '') return prev;
      return { ...prev, venue: venues[0] };
    });
  }, [venues]);

  const filteredSports = useMemo(() => {
    if (!sportSearch.trim()) return ALL_SPORTS;
    return ALL_SPORTS.filter(s => 
      sportLabels[s].toLowerCase().includes(sportSearch.toLowerCase())
    );
  }, [sportSearch]);

  // Load existing bookings for the selected venue to show availability
  const venueAvailabilityQuery = useQuery({
    queryKey: ['venueBookingsForTournament', formData.venue?.id, formData.startDateStr, formData.endDateStr],
    queryFn: async () => {
      if (!formData.venue?.id || formData.venue.id === '') return [];
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await (supabase
        .from('bookings')
        .select('date, start_time, end_time, status')
        .eq('venue_id', formData.venue.id)
        .gte('date', formData.startDateStr)
        .lte('date', formData.endDateStr)
        .neq('status', 'cancelled') as any);
      if (error) return [];
      return (data || []) as { date: string; start_time: string; end_time: string; status: string }[];
    },
    enabled: !!formData.venue?.id && formData.venue.id !== '' && !!formData.startDateStr && !!formData.endDateStr,
  });

  // Compute day-by-day status for the selected period
  const venueDayStatuses = useMemo(() => {
    if (!formData.venue?.id || formData.venue.id === '' || !formData.startDateStr || !formData.endDateStr) return [];
    const start = parseLocalDateString(formData.startDateStr);
    const end = parseLocalDateString(formData.endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

    const openingHours: any[] = Array.isArray((formData.venue as any).openingHours) ? (formData.venue as any).openingHours : [];
    const bookedDates = new Set<string>((venueAvailabilityQuery.data || []).map((b: any) => b.date));

    const days: { dateStr: string; label: string; status: 'available' | 'busy' | 'closed' }[] = [];
    const cur = new Date(start);
    const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    while (cur <= end) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const dow = cur.getDay();
      const dh = openingHours.find((d: any) => Number(d?.dayOfWeek) === dow);
      const isClosed = dh?.isClosed === true;
      const isBusy = bookedDates.has(dateStr);
      days.push({
        dateStr,
        label: `${DAY_NAMES[dow]} ${cur.getDate()}/${cur.getMonth() + 1}`,
        status: isClosed ? 'closed' : isBusy ? 'busy' : 'available',
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [formData.venue, formData.startDateStr, formData.endDateStr, venueAvailabilityQuery.data]);

  const filteredVenues = useMemo(() => {
    if (!venueSearch.trim()) return venues;
    return venues.filter(v =>
      v.name.toLowerCase().includes(venueSearch.toLowerCase()) ||
      v.city.toLowerCase().includes(venueSearch.toLowerCase())
    );
  }, [venueSearch, venues]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): { valid: boolean; firstError?: string } => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom du tournoi est obligatoire.';
    } else if (formData.name.trim().length < 5) {
      newErrors.name = 'Le nom du tournoi doit contenir au moins 5 caractères (vous en avez ' + formData.name.trim().length + ').';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'La description du tournoi est obligatoire.';
    }
    const maxTeams = parseInt(formData.maxTeams, 10);
    if (isNaN(maxTeams) || maxTeams < 4) {
      newErrors.maxTeams = 'Le nombre d\'équipes doit être au minimum 4.';
    } else if (maxTeams > 64) {
      newErrors.maxTeams = 'Le nombre d\'équipes ne peut pas dépasser 64.';
    }
    const entryFee = parseInt(formData.entryFee, 10);
    if (isNaN(entryFee) || entryFee < 0) {
      newErrors.entryFee = 'Les frais d\'inscription doivent être un nombre positif ou zéro (en FCFA).';
    } else if (entryFee > 0 && entryFee < 500) {
      newErrors.entryFee = 'Les frais d\'inscription minimum sont de 500 FCFA (ou équivalent dans la monnaie du pays).';
    }
    const prizePool = parseInt(formData.prizePool, 10);
    if (isNaN(prizePool) || prizePool < 0) {
      newErrors.prizePool = 'La cagnotte doit être un nombre positif ou zéro (en FCFA).';
    }
    const startDate = formData.startDateStr ? parseLocalDateString(formData.startDateStr) : null;
    const endDate = formData.endDateStr ? parseLocalDateString(formData.endDateStr) : null;
    if (!formData.startDateStr.trim()) {
      newErrors.startDate = 'La date de début est obligatoire (format AAAA-MM-JJ).';
    } else if (!startDate || isNaN(startDate.getTime())) {
      newErrors.startDate = 'Date de début invalide. Format : AAAA-MM-JJ (ex. 2026-02-15).';
    } else {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (startDate <= now) {
        newErrors.startDate = 'La date de début du tournoi doit être à partir de demain.';
      }
    }
    if (!formData.endDateStr.trim()) {
      newErrors.endDate = 'La date de fin est obligatoire (format AAAA-MM-JJ).';
    } else if (!endDate || isNaN(endDate.getTime())) {
      newErrors.endDate = 'Date de fin invalide. Format : AAAA-MM-JJ (ex. 2026-02-22).';
    } else if (startDate && !isNaN(startDate.getTime()) && endDate <= startDate) {
      newErrors.endDate = 'La date de fin doit être après la date de début.';
    }
    setErrors(newErrors);
    const firstError = Object.values(newErrors)[0];
    return firstError ? { valid: false, firstError } : { valid: true };
  };

  const handleCreate = async () => {
    setCreateError(null);
    console.log('[CreateTournament] handleCreate called', { hasUser: !!user, step, name: formData.name, venueId: formData.venue?.id });
    if (!user) {
      setCreateError('Vous devez être connecté pour créer un tournoi.');
      return;
    }
    const validation = validate();
    console.log('[CreateTournament] validation:', validation);
    if (!validation.valid) {
      setCreateError(validation.firstError ?? 'Vérifiez les champs marqués puis réessayez.');
      return;
    }
    const hasVenue = formData.venue?.id && formData.venue.id !== '' && !formData.venue.id.startsWith('manual-');
    if (!hasVenue) {
      setCreateError('Lieu manquant. Choisissez un terrain inscrit dans l’application (étape 2). Les tournois doivent se tenir sur un terrain enregistré.');
      return;
    }
    const prizePool = parseInt(formData.prizePool, 10);
    const prizes = [
      { position: 1, amount: Math.floor(prizePool * 0.6), label: '1er' },
      { position: 2, amount: Math.floor(prizePool * 0.3), label: '2ème' },
      { position: 3, amount: Math.floor(prizePool * 0.1), label: '3ème' },
    ];
    const startDate = localDateStringToDateForAPI(formData.startDateStr);
    const endDate = localDateStringToDateForAPI(formData.endDateStr);
    let logoUrl = formData.logoUrl;
    const shouldUploadLogo = !!logoUrl && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://');
    if (shouldUploadLogo) {
      try {
        const tempTournamentId = `temp-${Date.now()}`;
        logoUrl = await uploadTournamentImage(logoUrl, tempTournamentId);
      } catch (uploadError) {
        console.error('[CreateTournament] Failed to upload logo:', uploadError);
        setCreateError('Impossible d\'uploader le logo. Vérifiez votre connexion.');
        return;
      }
    }
    let bannerUrl = formData.bannerUrl;
    const shouldUploadBanner = !!bannerUrl && !bannerUrl.startsWith('http://') && !bannerUrl.startsWith('https://');
    if (shouldUploadBanner) {
      try {
        const tempTournamentId = `temp-banner-${Date.now()}`;
        bannerUrl = await uploadTournamentImage(bannerUrl, tempTournamentId);
      } catch (uploadError) {
        console.error('[CreateTournament] Failed to upload banner:', uploadError);
        setCreateError('Impossible d\'uploader la bannière. Vérifiez votre connexion.');
        return;
      }
    }
    try {
      const result = await createTournament({
        name: formData.name,
        description: formData.description,
        sport: formData.sport,
        format: formData.format,
        type: formData.type,
        level: formData.level,
        maxTeams: parseInt(formData.maxTeams, 10),
        entryFee: parseInt(formData.entryFee, 10),
        prizePool,
        prizes,
        venue: formData.venue,
        startDate,
        endDate,
        createdBy: user.id,
        sponsorName: formData.sponsorName || undefined,
        sponsorLogo: logoUrl || undefined,
        bannerImage: bannerUrl || undefined,
        selectedSlots,
        entryPaymentMode: formData.entryPaymentMode,
        hasTickets: formData.hasTickets,
      });
      const tournamentId = (result as any)?.id;
      if (formData.hasTickets && tournamentId && ticketTypes.length > 0) {
        for (const tt of ticketTypes) {
          if (!tt.name.trim()) continue;
          await ticketsApi.createTicketType({
            eventType: 'tournament',
            eventId: tournamentId,
            name: tt.name.trim(),
            description: tt.description.trim() || undefined,
            price: parseInt(tt.price, 10) || 0,
            quantityTotal: parseInt(tt.quantity, 10) || 50,
            validDays: tt.validDays,
            createdBy: user.id,
          });
        }
      }
      const isVenuePending = (result as any)?.status === 'venue_pending';
      const isOwnVenue = isVenueManager && myVenuesQuery.data?.some(v => v.id === formData.venue?.id);
      let title = '🏆 Tournoi créé !';
      let message = `Votre tournoi "${formData.name}" a été créé avec succès. Les inscriptions sont maintenant ouvertes.`;
      if (isVenuePending) {
        title = '⏳ Tournoi en attente';
        message = `Votre tournoi "${formData.name}" a été créé mais les inscriptions s'ouvriront seulement après validation du terrain par le gestionnaire.`;
      } else if (isOwnVenue) {
        title = '🏆 Tournoi créé avec succès !';
        message = `Votre tournoi "${formData.name}" a été créé avec succès sur votre terrain "${formData.venue?.name}". La réservation est automatiquement confirmée. Les inscriptions sont maintenant ouvertes.`;
      }
      setSuccessInfo({ title, message });
      setShowSuccessModal(true);
      if (user?.id) {
        createAutoPost(user.id, 'tournament_created', autoPostMessages.tournamentCreated(formData.name, formData.sport), { sportTag: formData.sport, tournamentTag: tournamentId });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Impossible de créer le tournoi';
      setCreateError(message);
    }
  };

  const selectSport = (sport: Sport) => {
    updateField('sport', sport);
    updateField('format', formats[sport][0]);
    setShowSportModal(false);
    setSportSearch('');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrap}>
          <LinearGradient
            colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
            style={styles.stepIconGradient}
          >
            <Trophy size={28} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>Informations générales</Text>
          <Text style={styles.stepSubtitle}>Nommez votre tournoi et choisissez le sport</Text>
        </View>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Logo du tournoi (optionnel)</Text>
        <TouchableOpacity
          style={styles.logoSelector}
          onPress={async () => {
            Keyboard.dismiss();
            const uri = await pickTournamentLogo();
            if (uri) updateField('logoUrl', uri);
          }}
          activeOpacity={0.8}
        >
          {formData.logoUrl ? (
            <Avatar uri={formData.logoUrl} name={formData.name || 'Tournoi'} size="large" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <ImageIcon size={28} color={Colors.text.muted} />
              <Text style={styles.logoPlaceholderText}>Ajouter</Text>
            </View>
          )}
          <View style={styles.logoEditBadge}>
            <Plus size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Bannière du tournoi (optionnel)</Text>
        <TouchableOpacity
          style={styles.bannerSelector}
          onPress={async () => {
            Keyboard.dismiss();
            const uri = await pickTournamentBanner();
            if (uri) updateField('bannerUrl', uri);
          }}
          activeOpacity={0.8}
        >
          {formData.bannerUrl ? (
            <Image
              source={{ uri: formData.bannerUrl }}
              style={styles.bannerPreview}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <ImageIcon size={28} color={Colors.text.muted} />
              <Text style={styles.bannerPlaceholderText}>Ajouter une bannière</Text>
            </View>
          )}
          <View style={styles.bannerEditBadge}>
            <Plus size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>

      <Input
        scrollViewRef={scrollViewRef}
        label="Nom du tournoi *"
        placeholder="Ex: Coupe de Cocody 2026"
        value={formData.name}
        onChangeText={(v) => updateField('name', v)}
        error={errors.name}
        maxLength={50}
      />

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Description *</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Décrivez votre tournoi, les règles, les prix..."
          placeholderTextColor={Colors.text.muted}
          value={formData.description}
          onChangeText={(v) => updateField('description', v)}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />
        <View style={styles.charCounterRow}>
          <Text style={styles.charCounter}>{formData.description.length}/500</Text>
          {errors.description ? <Text style={styles.descError}>{errors.description}</Text> : null}
        </View>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Sport *</Text>
        <TouchableOpacity
          style={styles.sportSelectorCard}
          onPress={() => { Keyboard.dismiss(); setShowSportModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.sportIconCircle}>
            <Text style={styles.sportIconLarge}>{sportIcons[formData.sport]}</Text>
          </View>
          <View style={styles.sportSelectorInfo}>
            <Text style={styles.sportSelectorName}>{sportLabels[formData.sport]}</Text>
            <Text style={styles.sportSelectorFormats}>{formats[formData.sport].length} formats disponibles</Text>
          </View>
          <View style={styles.sportSelectorArrow}>
            <ChevronDown size={20} color={Colors.text.muted} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Format</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatScrollContent}>
          {formats[formData.sport].map((format) => {
            const isActive = formData.format === format;
            return (
              <TouchableOpacity
                key={format}
                style={[styles.formatChip, isActive && styles.formatChipActive]}
                onPress={() => updateField('format', format)}
                activeOpacity={0.7}
              >
                <Text style={[styles.formatChipText, isActive && styles.formatChipTextActive]}>
                  {format}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Niveau de jeu</Text>
        <View style={styles.levelGrid}>
          {levels.map((level, idx) => {
            const isActive = formData.level === level;
            const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336'];
            const dotColor = colors[idx] || Colors.text.muted;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.levelCard, isActive && styles.levelCardActive]}
                onPress={() => updateField('level', level)}
                activeOpacity={0.7}
              >
                <View style={[styles.levelDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.levelCardText, isActive && styles.levelCardTextActive]}>
                  {levelLabels[level]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrap}>
          <LinearGradient
            colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
            style={styles.stepIconGradient}
          >
            <ClipboardList size={28} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>Détails & Logistique</Text>
          <Text style={styles.stepSubtitle}>Tarifs, lieu, dates et créneaux</Text>
        </View>
      </View>

      <View style={styles.rowInputs}>
        <View style={styles.halfInput}>
          <Input
            scrollViewRef={scrollViewRef}
            label="Équipes max *"
            placeholder="8"
            value={formData.maxTeams}
            onChangeText={(v) => updateField('maxTeams', v.replace(/[^0-9]/g, ''))}
            error={errors.maxTeams}
            keyboardType="numeric"
            icon={<Users size={18} color={Colors.text.muted} />}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.fieldLabel}>Frais d'inscription</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !isPaidTournament && styles.toggleBtnActive]}
              onPress={() => updateField('entryFee', '0')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleBtnText, !isPaidTournament && styles.toggleBtnTextActive]}>Gratuit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isPaidTournament && styles.toggleBtnActive]}
              onPress={() => { if (!isPaidTournament) updateField('entryFee', '500'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleBtnText, isPaidTournament && styles.toggleBtnTextActive]}>Payant</Text>
            </TouchableOpacity>
          </View>
          {isPaidTournament && (
            <>
            <Input
              scrollViewRef={scrollViewRef}
              label="Montant (FCFA)"
              placeholder="500"
              value={formData.entryFee}
              onChangeText={(v) => updateField('entryFee', v.replace(/[^0-9]/g, ''))}
              error={errors.entryFee}
              keyboardType="numeric"
              icon={<DollarSign size={18} color={Colors.text.muted} />}
            />
            <Text style={{ color: Colors.text.muted, fontSize: 11, marginTop: 4, marginBottom: 8 }}>Minimum recommandé: 600 FCFA</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.fieldSpacing}>
        <Input
          scrollViewRef={scrollViewRef}
          label="Cagnotte totale (FCFA) *"
          placeholder="200000"
          value={formData.prizePool}
          onChangeText={(v) => updateField('prizePool', v.replace(/[^0-9]/g, ''))}
          error={errors.prizePool}
          keyboardType="numeric"
          icon={<Trophy size={18} color={Colors.primary.orange} />}
        />
        {formData.prizePool && parseInt(formData.prizePool) > 0 && (
          <View style={styles.prizesPreview}>
            <Text style={styles.prizesTitle}>Répartition des prix</Text>
            <View style={styles.prizeRow}>
              <Text style={styles.prizePosition}>🥇 1er</Text>
              <Text style={styles.prizeAmount}>{Math.floor(parseInt(formData.prizePool) * 0.6).toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.prizeRow}>
              <Text style={styles.prizePosition}>🥈 2ème</Text>
              <Text style={styles.prizeAmount}>{Math.floor(parseInt(formData.prizePool) * 0.3).toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.prizeRow}>
              <Text style={styles.prizePosition}>🥉 3ème</Text>
              <Text style={styles.prizeAmount}>{Math.floor(parseInt(formData.prizePool) * 0.1).toLocaleString()} FCFA</Text>
            </View>
          </View>
        )}
      </View>

      {isPaidTournament && (
        <View style={styles.fieldSpacing}>
          <Text style={styles.fieldLabel}>Mode de paiement des inscriptions *</Text>
          {ENTRY_PAYMENT_MODES.map((mode) => {
            const selected = formData.entryPaymentMode === mode.value;
            return (
              <TouchableOpacity
                key={mode.value}
                style={[styles.paymentModeCard, selected && styles.paymentModeCardSelected]}
                onPress={() => updateField('entryPaymentMode', mode.value)}
                activeOpacity={0.7}
              >
                <View style={styles.paymentModeHeader}>
                  <Wallet size={18} color={selected ? Colors.primary.orange : Colors.text.muted} />
                  <Text style={[styles.paymentModeTitle, selected && styles.paymentModeTitleSelected]}>
                    {mode.label}
                  </Text>
                  {selected && <Check size={16} color={Colors.primary.orange} />}
                </View>
                <Text style={styles.paymentModeDescription}>{mode.description}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.paymentDisclaimerBox}>
            <Text style={styles.paymentDisclaimerTitle}>⚠️ Informations importantes sur les paiements</Text>
            <Text style={styles.paymentDisclaimerText}>
              Pour des raisons de sécurité, les frais d'inscription ne sont pas reversés automatiquement et directement aux organisateurs.
              Un reversement anticipé peut être accordé sous certaines conditions, uniquement après une demande et une validation administrateur.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Billetterie</Text>
        <TouchableOpacity
          style={[styles.paymentModeCard, formData.hasTickets && styles.paymentModeCardSelected]}
          onPress={() => updateField('hasTickets', !formData.hasTickets)}
          activeOpacity={0.7}
        >
          <View style={styles.paymentModeHeader}>
            <TicketIcon size={18} color={formData.hasTickets ? Colors.primary.orange : Colors.text.muted} />
            <Text style={[styles.paymentModeTitle, formData.hasTickets && styles.paymentModeTitleSelected]}>
              Vendre des billets d'entrée
            </Text>
            {formData.hasTickets && <Check size={16} color={Colors.primary.orange} />}
          </View>
          <Text style={styles.paymentModeDescription}>
            Activez la billetterie pour permettre aux spectateurs d'acheter des billets (standard, VIP…). Vous pourrez créer les types de billets et scanner les QR codes le jour J.
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Lieu *</Text>
        <TouchableOpacity
          style={styles.sportSelectorCard}
          onPress={() => { Keyboard.dismiss(); setShowVenueModal(true); }}
          activeOpacity={0.7}
        >
          <View style={styles.sportIconCircle}>
            <MapPin size={22} color={Colors.primary.blue} />
          </View>
          <View style={styles.sportSelectorInfo}>
            <Text style={styles.sportSelectorName}>{formData.venue?.name || 'Choisir un lieu'}</Text>
            <Text style={styles.sportSelectorFormats}>{(formData.venue?.city || '').trim() || 'Ville'}</Text>
          </View>
          <View style={styles.sportSelectorArrow}>
            <ChevronDown size={20} color={Colors.text.muted} />
          </View>
        </TouchableOpacity>
        <Text style={styles.venueHint}>
          {isVenueManager
            ? 'Un tournoi doit être organisé sur un terrain que vous gérez.'
            : 'Le tournoi doit se tenir sur un terrain inscrit dans l\'application.'}
        </Text>
      </View>

      <View style={styles.fieldSpacing}>
        <Text style={styles.fieldLabel}>Dates du tournoi *</Text>
        <Text style={styles.dateHint}>
          {(Platform.OS === 'ios' || Platform.OS === 'android') ? 'Appuyez pour choisir la date' : 'Format : AAAA-MM-JJ'}
        </Text>
        <View style={styles.dateCard}>
          {(Platform.OS === 'ios' || Platform.OS === 'android') ? (
            <>
              <TouchableOpacity
                style={styles.dateRowTouchable}
                onPress={() => { Keyboard.dismiss(); setShowStartDatePicker(true); }}
                activeOpacity={0.7}
              >
                <Calendar size={20} color={Colors.primary.blue} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date de début</Text>
                  <Text style={[styles.dateDisplay, errors.startDate && styles.dateInputError]}>
                    {formData.startDateStr || 'Choisir la date'}
                  </Text>
                  {errors.startDate ? <Text style={styles.dateError}>{errors.startDate}</Text> : null}
                </View>
                <ChevronDown size={20} color={Colors.text.muted} />
              </TouchableOpacity>
              {showStartDatePicker && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={formData.startDateStr ? parseLocalDateString(formData.startDateStr) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    mode="date"
                    minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="dark"
                    {...(Platform.OS === 'ios' && { textColor: Colors.text.primary })}
                    onChange={(event: { type: string }, date?: Date) => {
                      if (event.type === 'dismissed') {
                        setShowStartDatePicker(false);
                        return;
                      }
                      if (date) {
                        setFormData((prev) => ({ ...prev, startDateStr: toLocalDateString(date) }));
                        if (errors.startDate) setErrors((e) => ({ ...e, startDate: '' }));
                        if (Platform.OS === 'android') setShowStartDatePicker(false);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.datePickerConfirmBtn} onPress={() => setShowStartDatePicker(false)}>
                      <Text style={styles.datePickerConfirmText}>Valider</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.dateDivider} />
              <TouchableOpacity
                style={styles.dateRowTouchable}
                onPress={() => { Keyboard.dismiss(); setShowEndDatePicker(true); }}
                activeOpacity={0.7}
              >
                <Calendar size={20} color={Colors.primary.orange} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date de fin</Text>
                  <Text style={[styles.dateDisplay, errors.endDate && styles.dateInputError]}>
                    {formData.endDateStr || 'Choisir la date'}
                  </Text>
                  {errors.endDate ? <Text style={styles.dateError}>{errors.endDate}</Text> : null}
                </View>
                <ChevronDown size={20} color={Colors.text.muted} />
              </TouchableOpacity>
              {showEndDatePicker && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={formData.endDateStr ? parseLocalDateString(formData.endDateStr) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
                    mode="date"
                    minimumDate={formData.startDateStr ? parseLocalDateString(formData.startDateStr) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="dark"
                    {...(Platform.OS === 'ios' && { textColor: Colors.text.primary })}
                    onChange={(event: { type: string }, date?: Date) => {
                      if (event.type === 'dismissed') {
                        setShowEndDatePicker(false);
                        return;
                      }
                      if (date) {
                        setFormData((prev) => ({ ...prev, endDateStr: toLocalDateString(date) }));
                        if (errors.endDate) setErrors((e) => ({ ...e, endDate: '' }));
                        if (Platform.OS === 'android') setShowEndDatePicker(false);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.datePickerConfirmBtn} onPress={() => setShowEndDatePicker(false)}>
                      <Text style={styles.datePickerConfirmText}>Valider</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.dateRow}>
                <Calendar size={20} color={Colors.primary.blue} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date de début</Text>
                  <TextInput
                    style={[styles.dateInput, errors.startDate && styles.dateInputError]}
                    value={formData.startDateStr}
                    onChangeText={(t) => { setFormData((prev) => ({ ...prev, startDateStr: t })); if (errors.startDate) setErrors((e) => ({ ...e, startDate: '' })); }}
                    placeholder="2026-02-15"
                    placeholderTextColor={Colors.text.muted}
                  />
                  {errors.startDate ? <Text style={styles.dateError}>{errors.startDate}</Text> : null}
                </View>
              </View>
              <View style={styles.dateDivider} />
              <View style={styles.dateRow}>
                <Calendar size={20} color={Colors.primary.orange} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date de fin</Text>
                  <TextInput
                    style={[styles.dateInput, errors.endDate && styles.dateInputError]}
                    value={formData.endDateStr}
                    onChangeText={(t) => { setFormData((prev) => ({ ...prev, endDateStr: t })); if (errors.endDate) setErrors((e) => ({ ...e, endDate: '' })); }}
                    placeholder="2026-02-22"
                    placeholderTextColor={Colors.text.muted}
                  />
                  {errors.endDate ? <Text style={styles.dateError}>{errors.endDate}</Text> : null}
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {formData.venue?.id && formData.venue.id !== '' && venueDayStatuses.length > 0 && (
        <View style={styles.fieldSpacing}>
          <Text style={styles.fieldLabel}>Planning du tournoi</Text>
          <Text style={styles.dateHint}>Appuyez sur un jour pour sélectionner les créneaux horaires souhaités.</Text>
          <View style={styles.availabilityLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.status.success }]} /><Text style={styles.legendText}>Libre</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.status.warning }]} /><Text style={styles.legendText}>Occupé</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.text.muted }]} /><Text style={styles.legendText}>Fermé</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary.blue }]} /><Text style={styles.legendText}>Sélectionné</Text></View>
          </View>
          {venueDayStatuses.map((day) => {
            const isExpanded = expandedDay === day.dateStr;
            const daySlots = selectedSlots[day.dateStr] ?? [];
            const openHour = (() => {
              const oh: any[] = Array.isArray((formData.venue as any).openingHours) ? (formData.venue as any).openingHours : [];
              const dow = new Date(day.dateStr + 'T00:00:00').getDay();
              const dh = oh.find((d: any) => Number(d?.dayOfWeek) === dow);
              if (dh?.isClosed) return null;
              const o = dh ? parseInt(String(dh.openTime || '9').split(':')[0], 10) : 9;
              const c = dh ? parseInt(String(dh.closeTime || '22').split(':')[0], 10) : 22;
              return { open: isNaN(o) ? 9 : o, close: isNaN(c) ? 22 : c };
            })();
            const bookedHoursForDay = new Set<number>();
            (venueAvailabilityQuery.data ?? [])
              .filter((b: any) => b.date === day.dateStr)
              .forEach((b: any) => {
                const sh = parseInt((b.start_time || '').split('T')[1]?.split(':')[0] ?? '0', 10);
                const eh = parseInt((b.end_time || '').split('T')[1]?.split(':')[0] ?? '0', 10);
                for (let h = sh; h < eh; h++) bookedHoursForDay.add(h);
              });
            const hours = openHour
              ? Array.from({ length: openHour.close - openHour.open }, (_, i) => openHour.open + i)
              : [];
            return (
              <View key={day.dateStr} style={styles.scheduleDayContainer}>
                <TouchableOpacity
                  style={[
                    styles.scheduleDayHeader,
                    day.status === 'closed' && { opacity: 0.5 },
                    daySlots.length > 0 && { borderColor: Colors.primary.blue + '80' },
                  ]}
                  onPress={() => {
                    if (day.status === 'closed') return;
                    setExpandedDay(isExpanded ? null : day.dateStr);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.scheduleDayDot, {
                    backgroundColor: daySlots.length > 0 ? Colors.primary.blue : day.status === 'available' ? Colors.status.success : day.status === 'busy' ? Colors.status.warning : Colors.text.muted,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scheduleDayLabel}>{day.label}</Text>
                    {daySlots.length > 0 && (
                      <Text style={styles.scheduleDaySelected}>{daySlots.sort((a,b)=>a-b).map(h=>`${h}h-${h+1}h`).join(', ')}</Text>
                    )}
                  </View>
                  <Text style={styles.scheduleDayStatus}>
                    {day.status === 'closed' ? 'Fermé' : daySlots.length > 0 ? `${daySlots.length} créneau${daySlots.length > 1 ? 'x' : ''}` : 'Non planifié'}
                  </Text>
                  {day.status !== 'closed' && (
                    <Text style={{ color: Colors.text.muted, fontSize: 16, marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</Text>
                  )}
                </TouchableOpacity>
                {isExpanded && hours.length > 0 && (
                  <View style={styles.scheduleSlotGrid}>
                    {hours.map((h) => {
                      const isBooked = bookedHoursForDay.has(h);
                      const isSelected = daySlots.includes(h);
                      return (
                        <TouchableOpacity
                          key={h}
                          style={[
                            styles.scheduleSlot,
                            isBooked && styles.scheduleSlotBooked,
                            isSelected && styles.scheduleSlotSelected,
                          ]}
                          onPress={() => {
                            if (isBooked) return;
                            setSelectedSlots(prev => {
                              const cur = prev[day.dateStr] ?? [];
                              const next = cur.includes(h) ? cur.filter(x => x !== h) : [...cur, h];
                              return { ...prev, [day.dateStr]: next };
                            });
                          }}
                          disabled={isBooked}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.scheduleSlotText,
                            isBooked && { color: Colors.text.muted },
                            isSelected && { color: '#fff', fontWeight: '700' },
                          ]}>{h}h</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          {venueDayStatuses.some(d => d.status === 'busy') && (
            <Text style={styles.availabilityWarning}>⚠️ Certains créneaux sont déjà réservés — ils apparaissent grisés.</Text>
          )}
        </View>
      )}

      <View style={styles.fieldSpacing}>
        <Input
          label="Sponsor (optionnel)"
          placeholder="Nom du sponsor"
          value={formData.sponsorName}
          onChangeText={(v) => updateField('sponsorName', v)}
          maxLength={30}
        />
      </View>
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrap}>
          <LinearGradient
            colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
            style={styles.stepIconGradient}
          >
            <Check size={28} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>Validation & Description</Text>
          <Text style={styles.stepSubtitle}>Vérifiez et finalisez votre tournoi</Text>
        </View>
      </View>

      <View style={styles.dateSection}>
        <Text style={styles.fieldLabel}>Récapitulatif des dates</Text>
        <View style={styles.dateCard}>
          <View style={styles.dateRow}>
            <Calendar size={20} color={Colors.primary.blue} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Début</Text>
              <Text style={styles.dateValue}>{formData.startDateStr || '—'}</Text>
            </View>
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateRow}>
            <Calendar size={20} color={Colors.primary.orange} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Fin</Text>
              <Text style={styles.dateValue}>{formData.endDateStr || '—'}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.dateHint}>Modifiez les dates à l'étape 2 si besoin.</Text>
      </View>

      {/* Récapitulatif redesigné */}
      <View style={styles.summaryCardNew}>
        <LinearGradient
          colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryHeader}
        >
          <Trophy size={20} color="#FFF" />
          <Text style={styles.summaryHeaderText}>Récapitulatif du tournoi</Text>
        </LinearGradient>

        <View style={styles.summaryBody}>
          <View style={styles.summaryHighlightRow}>
            <Text style={styles.summaryHighlightName}>{formData.name || 'Sans nom'}</Text>
            <Text style={styles.summaryHighlightSport}>{sportIcons[formData.sport]} {sportLabels[formData.sport]} · {formData.format}</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridCell}>
              <Text style={styles.summaryGridLabel}>Type</Text>
              <Text style={styles.summaryGridValue}>{tournamentTypes.find(t => t.id === formData.type)?.label}</Text>
            </View>
            <View style={styles.summaryGridCell}>
              <Text style={styles.summaryGridLabel}>Niveau</Text>
              <Text style={styles.summaryGridValue}>{levelLabels[formData.level]}</Text>
            </View>
            <View style={styles.summaryGridCell}>
              <Text style={styles.summaryGridLabel}>Équipes</Text>
              <Text style={styles.summaryGridValue}>{formData.maxTeams} max</Text>
            </View>
            <View style={styles.summaryGridCell}>
              <Text style={styles.summaryGridLabel}>Inscription</Text>
              <Text style={styles.summaryGridValue}>{parseInt(formData.entryFee || '0').toLocaleString()} F</Text>
            </View>
          </View>

          <View style={styles.summaryBigRow}>
            <View style={styles.summaryBigItem}>
              <Trophy size={16} color={Colors.primary.orange} />
              <Text style={styles.summaryBigLabel}>Cagnotte</Text>
              <Text style={styles.summaryBigValue}>{parseInt(formData.prizePool || '0').toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.summaryBigItem}>
              <MapPin size={16} color={Colors.primary.blue} />
              <Text style={styles.summaryBigLabel}>Lieu</Text>
              <Text style={styles.summaryBigValue} numberOfLines={2}>{formData.venue.name}</Text>
            </View>
          </View>

          {isPaidTournament && (
            <View style={styles.summaryPaymentRow}>
              <Wallet size={14} color={Colors.primary.orange} />
              <Text style={styles.summaryPaymentLabel}>Paiement:</Text>
              <Text style={styles.summaryPaymentValue}>{ENTRY_PAYMENT_MODES.find(m => m.value === formData.entryPaymentMode)?.label ?? formData.entryPaymentMode}</Text>
            </View>
          )}

          <View style={styles.summaryTagsRow}>
            <View style={[styles.summaryTag, formData.hasTickets ? styles.summaryTagActive : styles.summaryTagInactive]}>
              <TicketIcon size={12} color={formData.hasTickets ? Colors.primary.orange : Colors.text.muted} />
              <Text style={[styles.summaryTagText, formData.hasTickets ? styles.summaryTagTextActive : styles.summaryTagTextInactive]}>
                {formData.hasTickets ? 'Billetterie activée' : 'Pas de billetterie'}
              </Text>
            </View>
          </View>

          {formData.hasTickets && (
            <View style={styles.ticketTypesSection}>
              <Text style={styles.fieldLabel}>Types de billets</Text>
              <Text style={styles.ticketTypesHint}>Définissez les billets vendus pour ce tournoi. Vous pourrez en ajouter d'autres plus tard.</Text>
              {ticketTypes.map((tt, idx) => (
                <View key={idx} style={styles.ticketTypeCard}>
                  <View style={styles.ticketTypeHeader}>
                    <Text style={styles.ticketTypeIndex}>Billet #{idx + 1}</Text>
                    {ticketTypes.length > 1 && (
                      <TouchableOpacity onPress={() => setTicketTypes(prev => prev.filter((_, i) => i !== idx))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color={Colors.status.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={styles.ticketInput}
                    placeholder="Nom (ex: Standard, VIP...)"
                    placeholderTextColor={Colors.text.muted}
                    value={tt.name}
                    onChangeText={(v) => setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, name: v } : t))}
                  />
                  <TextInput
                    style={styles.ticketInput}
                    placeholder="Description (optionnel)"
                    placeholderTextColor={Colors.text.muted}
                    value={tt.description}
                    onChangeText={(v) => setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, description: v } : t))}
                  />
                  <View style={styles.ticketTypeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketTypeLabel}>Prix (FCFA)</Text>
                      <TextInput
                        style={styles.ticketInputSmall}
                        placeholder="1000"
                        placeholderTextColor={Colors.text.muted}
                        keyboardType="numeric"
                        value={tt.price}
                        onChangeText={(v) => setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, price: v } : t))}
                      />
                      <Text style={{ color: Colors.text.muted, fontSize: 10, marginTop: 2 }}>Minimum recommandé: 600 FCFA</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketTypeLabel}>Quantité</Text>
                      <TextInput
                        style={styles.ticketInputSmall}
                        placeholder="50"
                        placeholderTextColor={Colors.text.muted}
                        keyboardType="numeric"
                        value={tt.quantity}
                        onChangeText={(v) => setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, quantity: v } : t))}
                      />
                    </View>
                  </View>

                  {eventDays.length > 1 && (
                    <View style={styles.ticketDaysSection}>
                      <Text style={styles.ticketDaysLabel}>Jours de validité</Text>
                      <View style={styles.ticketDaysRow}>
                        <TouchableOpacity
                          style={[styles.ticketDayChip, tt.validDays === null && styles.ticketDayChipActive]}
                          onPress={() => setTicketTypes(prev => prev.map((t, i) => i === idx ? { ...t, validDays: null } : t))}
                        >
                          <Text style={[styles.ticketDayChipText, tt.validDays === null && styles.ticketDayChipTextActive]}>Tous les jours</Text>
                        </TouchableOpacity>
                        {eventDays.map((d) => {
                          const isSelected = tt.validDays !== null && tt.validDays.includes(d.date);
                          return (
                            <TouchableOpacity
                              key={d.date}
                              style={[styles.ticketDayChip, isSelected && styles.ticketDayChipActive]}
                              onPress={() => setTicketTypes(prev => prev.map((t, i) => {
                                if (i !== idx) return t;
                                if (t.validDays === null) return { ...t, validDays: [d.date] };
                                if (isSelected) {
                                  const filtered = t.validDays.filter(dd => dd !== d.date);
                                  return { ...t, validDays: filtered.length === 0 ? null : filtered };
                                }
                                return { ...t, validDays: [...t.validDays, d.date] };
                              }))}
                            >
                              <Text style={[styles.ticketDayChipText, isSelected && styles.ticketDayChipTextActive]}>{d.label.split(' - ')[0]}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {tt.validDays !== null && tt.validDays.length > 0 && (
                        <Text style={styles.ticketDaysSelected}>
                          Valide: {tt.validDays.map(d => eventDays.find(ed => ed.date === d)?.label ?? d).join(', ')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addTicketTypeBtn}
                onPress={() => setTicketTypes(prev => [...prev, { name: '', description: '', price: '1000', quantity: '50', validDays: null }])}
                activeOpacity={0.7}
              >
                <Plus size={18} color={Colors.primary.orange} />
                <Text style={styles.addTicketTypeText}>Ajouter un type de billet</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPaidTournament && (
            <View style={styles.summaryDisclaimerNew}>
              <Info size={14} color={Colors.text.muted} />
              <Text style={styles.summaryDisclaimerNewText}>
                Reversement organisateur: non automatique. Avances sur approbation admin uniquement.
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  if (!canCreateTournament) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/tournaments')}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Créer un tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center', paddingVertical: 40 }]}>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Trophy size={56} color={Colors.text.muted} />
              </View>
              <Text style={[styles.fieldLabel, { textAlign: 'center', marginBottom: 12 }]}>
                Réservé aux capitaines d&apos;équipe
              </Text>
              <Text style={[styles.fieldLabel, { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 }]}>
                Vous devez être capitaine d&apos;une équipe d&apos;au moins {MIN_MEMBERS_TO_CREATE_TOURNAMENT} membres pour créer un tournoi. Créez ou rejoignez une équipe, devenez capitaine, puis revenez ici.
              </Text>
              <Button title="Retour" onPress={() => safeBack(router, '/tournaments')} variant="primary" size="large" style={{ marginTop: 28 }} />
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/tournaments')} activeOpacity={0.7}>
              <X size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Créer un tournoi</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Stepper */}
          <View style={styles.stepperContainer}>
            {[
              { num: 1, icon: Info, label: 'Informations' },
              { num: 2, icon: ClipboardList, label: 'Détails' },
              { num: 3, icon: Check, label: 'Validation' },
            ].map((s, idx) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              const Icon = s.icon;
              return (
                <React.Fragment key={s.num}>
                  <View style={styles.stepperItem}>
                    <View style={[
                      styles.stepperCircle,
                      isActive && styles.stepperCircleActive,
                      isDone && styles.stepperCircleDone,
                    ]}>
                      {isDone ? (
                        <Check size={16} color="#FFF" />
                      ) : (
                        <Icon size={16} color={isActive ? '#FFF' : Colors.text.muted} />
                      )}
                    </View>
                    <Text style={[
                      styles.stepperLabel,
                      (isActive || isDone) && styles.stepperLabelActive,
                    ]}>{s.label}</Text>
                  </View>
                  {idx < 2 && (
                    <View style={[
                      styles.stepperLine,
                      step > s.num && styles.stepperLineDone,
                    ]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 320 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </ScrollView>

            {createError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{createError}</Text>
                <TouchableOpacity onPress={() => setCreateError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.errorBannerClose}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.footer}>
              {step > 1 && (
                <Button title="Retour" onPress={() => setStep(step - 1)} variant="secondary" size="large" style={styles.backBtn} />
              )}
              {step < 3 ? (
                <Button
                  title="Suivant"
                  onPress={() => {
                    if (step === 1) {
                      const stepErrors: Record<string, string> = {};
                      if (!formData.name.trim()) {
                        stepErrors.name = 'Le nom du tournoi est obligatoire.';
                      } else if (formData.name.trim().length < 5) {
                        stepErrors.name = 'Le nom du tournoi doit contenir au moins 5 caractères (vous en avez ' + formData.name.trim().length + ').';
                      }
                      if (!formData.description.trim()) {
                        stepErrors.description = 'La description du tournoi est obligatoire.';
                      }
                      if (Object.keys(stepErrors).length > 0) {
                        setErrors(stepErrors);
                        return;
                      }
                    }
                    setErrors({});
                    setStep(step + 1);
                  }}
                  variant="primary"
                  size="large"
                  style={styles.nextBtn}
                />
              ) : (
                <Button
                  title="Créer le tournoi"
                  onPress={handleCreate}
                  loading={isCreating}
                  variant="orange"
                  size="large"
                  style={styles.nextBtn}
                />
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={showSportModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir un sport</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { Keyboard.dismiss(); setShowSportModal(false); setSportSearch(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <Search size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher..."
                  placeholderTextColor={Colors.text.muted}
                  value={sportSearch}
                  onChangeText={setSportSearch}
                />
              </View>
              <ScrollView style={styles.sportsList}>
                {filteredSports.map((sport) => (
                  <TouchableOpacity
                    key={sport}
                    style={[styles.sportItem, formData.sport === sport && styles.sportItemActive]}
                    onPress={() => selectSport(sport)}
                  >
                    <Text style={styles.sportItemIcon}>{sportIcons[sport]}</Text>
                    <Text style={[styles.sportItemText, formData.sport === sport && styles.sportItemTextActive]}>
                      {sportLabels[sport]}
                    </Text>
                    {formData.sport === sport && <Check size={20} color={Colors.primary.blue} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showVenueModal} animationType="slide" transparent statusBarTranslucent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir un lieu</Text>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => { Keyboard.dismiss(); setShowVenueModal(false); setVenueSearch(''); }}
                >
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <Search size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un lieu..."
                  placeholderTextColor={Colors.text.muted}
                  value={venueSearch}
                  onChangeText={setVenueSearch}
                />
              </View>
              <ScrollView
                style={styles.venuesList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingBottom: 320 }}
              >
                {filteredVenues.length > 0 && (
                  <Text style={styles.venueSectionLabel}>Terrains disponibles</Text>
                )}
                {filteredVenues.length === 0 ? (
                  <View style={styles.emptyVenueState}>
                    <MapPin size={40} color={Colors.text.muted} />
                    <Text style={styles.emptyVenueTitle}>
                      {isVenueManager ? 'Aucun terrain enregistré' : 'Aucun terrain trouvé'}
                    </Text>
                    <Text style={styles.emptyVenueText}>
                      {isVenueManager
                        ? 'Un tournoi doit être organisé sur un terrain que vous gérez. Créez d\'abord votre terrain dans l\'app.'
                        : 'Aucun terrain inscrit ne correspond à votre recherche. Les tournois doivent se tenir sur un terrain inscrit dans l\'application.'}
                    </Text>
                  </View>
                ) : (
                  filteredVenues.map((venue) => (
                    <TouchableOpacity
                      key={venue.id}
                      style={[styles.venueItem, formData.venue?.id === venue.id && styles.venueItemActive]}
                      onPress={() => { updateField('venue', venue); setShowVenueModal(false); setVenueSearch(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.venueItemInfo}>
                        <Text style={[styles.venueItemName, formData.venue?.id === venue.id && styles.venueItemNameActive]}>
                          {venue.name}
                        </Text>
                        <Text style={styles.venueItemCity}>{venue.city}{venue.pricePerHour > 0 ? ` • ${venue.pricePerHour.toLocaleString()} FCFA/h` : ''}</Text>
                      </View>
                      {formData.venue?.id === venue.id && <Check size={20} color={Colors.primary.blue} />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={showSuccessModal} animationType="fade" transparent>
          <View style={styles.successOverlay}>
            <View style={styles.successCardNew}>
              <LinearGradient
                colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.successGradientHeader}
              >
                <View style={styles.successIconCircle}>
                  <Trophy size={36} color="#FFF" />
                </View>
              </LinearGradient>
              <View style={styles.successBody}>
                <Text style={styles.successTitleNew}>{successInfo.title}</Text>
                <Text style={styles.successMessageNew}>{successInfo.message}</Text>
                <TouchableOpacity
                  style={styles.successButtonNew}
                  onPress={() => {
                    setShowSuccessModal(false);
                    refetchTournaments();
                    safeBack(router, '/tournaments');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.successButtonTextNew}>Voir mes tournois</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const },
  placeholder: { width: 40 },

  // Stepper
  stepperContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 0,
  },
  stepperItem: { alignItems: 'center' as const, gap: 4 },
  stepperCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 2, borderColor: Colors.border.medium,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  stepperCircleActive: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange,
  },
  stepperCircleDone: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange,
  },
  stepperLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const },
  stepperLabelActive: { color: Colors.primary.orange },
  stepperLine: {
    flex: 1, height: 2, backgroundColor: Colors.border.medium,
    marginHorizontal: 8, marginBottom: 16,
  },
  stepperLineDone: { backgroundColor: Colors.primary.orange },

  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },

  // Step header
  stepHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 24,
  },
  stepIconWrap: {},
  stepIconGradient: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  stepHeaderText: { flex: 1 },
  stepTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  stepSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },
  fieldSpacing: { marginBottom: 24 },

  // Toggle buttons (Gratuit/Payant)
  toggleRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.background.cardLight,
  },
  toggleBtnActive: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '15',
  },
  toggleBtnText: {
    textAlign: 'center' as const,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text.muted,
  },
  toggleBtnTextActive: {
    color: Colors.primary.orange,
  },

  // Sport selector card
  sportSelectorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border.medium,
    gap: 14,
  },
  sportIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary.orange + '20',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  sportIconLarge: { fontSize: 26 },
  sportSelectorInfo: { flex: 1 },
  sportSelectorName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  sportSelectorFormats: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  sportSelectorArrow: { padding: 4 },

  // Format chips
  formatScrollContent: { gap: 8, paddingRight: 20 },
  formatChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1, borderColor: Colors.border.medium,
  },
  formatChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  formatChipText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' as const },
  formatChipTextActive: { color: '#FFFFFF' },

  // Type card gradient overlay
  typeCardGradient: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
    opacity: 0.15,
  },

  // Level cards with colored dots
  levelGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  levelCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1, borderColor: Colors.border.medium,
  },
  levelCardActive: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '18',
  },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelCardText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  levelCardTextActive: { color: Colors.primary.orange, fontWeight: '700' as const },

  // Description input
  descriptionInput: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 12,
    padding: 14,
    color: Colors.text.primary,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1, borderColor: Colors.border.medium,
    textAlignVertical: 'top' as const,
  },
  charCounterRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 6 },
  charCounter: { color: Colors.text.muted, fontSize: 11 },
  descError: { color: Colors.status.error, fontSize: 12 },

  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, gap: 12 },
  selectorIcon: { fontSize: 24 },
  selectorText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  venueInfo: { flex: 1 },
  venueCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  venueHint: { color: Colors.text.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' as const },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  optionChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  optionText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const },
  optionTextActive: { color: '#FFFFFF' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  levelChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  levelChipActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  levelText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  levelTextActive: { color: '#FFFFFF' },
  typeGrid: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: Colors.background.cardLight, borderWidth: 2, borderColor: 'transparent', position: 'relative' as const },
  typeCardActive: { borderColor: Colors.primary.orange, backgroundColor: 'rgba(255,107,0,0.1)' },
  typeEmoji: { fontSize: 28, marginBottom: 8 },
  typeLabel: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' as const, textAlign: 'center' as const },
  typeLabelActive: { color: Colors.primary.orange },
  checkBadge: { position: 'absolute' as const, top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  prizesPreview: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border.medium },
  paymentDisclaimerBox: {
    backgroundColor: Colors.primary.orange + '12',
    borderColor: Colors.primary.orange + '30',
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  paymentDisclaimerTitle: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const, marginBottom: 6 },
  paymentDisclaimerText: { color: Colors.text.secondary, fontSize: 12, lineHeight: 18 },
  prizesTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 12 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.medium },
  prizePosition: { color: Colors.text.secondary, fontSize: 14 },
  prizeAmount: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  dateSection: { marginBottom: 20 },
  dateCard: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border.medium },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateRowTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dateDisplay: { color: Colors.text.primary, fontSize: 16, fontWeight: '500' as const, marginTop: 4 },
  datePickerWrapper: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 12, marginTop: 8 },
  datePickerConfirmBtn: { marginTop: 12, paddingVertical: 10, backgroundColor: Colors.primary.orange, borderRadius: 10, alignItems: 'center' as const },
  datePickerConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '600' as const },
  dateDivider: { height: 1, backgroundColor: Colors.border.medium, marginVertical: 12 },
  dateInfo: { flex: 1 },
  dateLabel: { color: Colors.text.muted, fontSize: 12 },
  dateValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const, marginTop: 2 },
  dateInput: { backgroundColor: Colors.background.dark, borderRadius: 10, padding: 12, color: Colors.text.primary, fontSize: 15, marginTop: 6, borderWidth: 1, borderColor: Colors.border.light },
  dateInputError: { borderColor: Colors.status.error },
  dateError: { color: Colors.status.error, fontSize: 12, marginTop: 4 },
  dateHint: { color: Colors.text.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' as const },

  // Redesigned summary card
  summaryCardNew: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 18,
    overflow: 'hidden' as const,
    borderWidth: 1, borderColor: Colors.border.medium,
    marginTop: 8,
  },
  summaryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  summaryHeaderText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  summaryBody: { padding: 18 },
  summaryHighlightRow: { marginBottom: 16 },
  summaryHighlightName: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' as const, lineHeight: 26 },
  summaryHighlightSport: { color: Colors.text.muted, fontSize: 13, marginTop: 4 },
  summaryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 16,
  },
  summaryGridCell: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
  },
  summaryGridLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const, marginBottom: 4 },
  summaryGridValue: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  summaryBigRow: { flexDirection: 'row' as const, gap: 10, marginBottom: 16 },
  summaryBigItem: { flex: 1, gap: 4 },
  summaryBigLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  summaryBigValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const },
  summaryPaymentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 12,
  },
  summaryPaymentLabel: { color: Colors.text.muted, fontSize: 13 },
  summaryPaymentValue: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  summaryTagsRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 12 },
  summaryTag: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  summaryTagActive: { backgroundColor: Colors.primary.orange + '20' },
  summaryTagInactive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  summaryTagText: { fontSize: 11, fontWeight: '600' as const },
  summaryTagTextActive: { color: Colors.primary.orange },
  summaryTagTextInactive: { color: Colors.text.muted },
  summaryDisclaimerNew: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
  },
  summaryDisclaimerNewText: { color: Colors.text.muted, fontSize: 11, flex: 1, lineHeight: 16 },

  // Old summary styles (kept for reference, unused)
  summaryCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border.light },
  summaryTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  summaryDisclaimerWrap: { backgroundColor: Colors.primary.orange + '12', borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },
  summaryDisclaimerText: { color: Colors.text.secondary, fontSize: 12, lineHeight: 17 },
  summaryLabel: { color: Colors.text.muted, fontSize: 14 },
  summaryValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  prizeValue: { color: Colors.primary.orange },

  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border.medium },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.medium },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15, paddingVertical: 12 },
  sportsList: { paddingHorizontal: 20, paddingBottom: 40 },
  sportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.medium, gap: 14 },
  sportItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  sportItemIcon: { fontSize: 24, width: 36, textAlign: 'center' as const },
  sportItemText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  sportItemTextActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  venuesList: { paddingHorizontal: 20, paddingBottom: 40 },
  venueSectionLabel: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const, marginBottom: 8 },
  venueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.medium },
  venueItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  venueItemInfo: { flex: 1 },
  venueItemName: { color: Colors.text.primary, fontSize: 15 },
  venueItemNameActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  venueItemCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  emptyVenueState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyVenueTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginTop: 12 },
  emptyVenueText: { color: Colors.text.muted, fontSize: 14, marginTop: 8, textAlign: 'center' as const },
  availabilitySection: { marginTop: 20, marginBottom: 4 },
  availabilitySectionTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const, marginBottom: 4 },
  availabilityHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  availabilityLegend: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, marginBottom: 14 },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.text.muted, fontSize: 11 },
  availabilityWarning: { color: Colors.status.warning, fontSize: 12, marginTop: 10, lineHeight: 17 },
  scheduleDayContainer: { marginBottom: 8, borderRadius: 14, overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.border.medium },
  scheduleDayHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 14, backgroundColor: Colors.background.cardLight },
  scheduleDayDot: { width: 10, height: 10, borderRadius: 5 },
  scheduleDayLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  scheduleDaySelected: { color: Colors.primary.blue, fontSize: 11, marginTop: 2 },
  scheduleDayStatus: { color: Colors.text.muted, fontSize: 12 },
  scheduleSlotGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, padding: 12, backgroundColor: Colors.background.dark },
  scheduleSlot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.background.elevated },
  scheduleSlotBooked: { backgroundColor: Colors.background.card, borderColor: Colors.text.muted + '30', opacity: 0.5 },
  scheduleSlotSelected: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  scheduleSlotText: { color: Colors.text.primary, fontSize: 13, fontWeight: '500' as const },

  // Success modal
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  successCardNew: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 22,
    width: '100%', maxWidth: 360,
    overflow: 'hidden' as const,
  },
  successGradientHeader: {
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  successIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  successBody: { padding: 24, alignItems: 'center' as const },
  successTitleNew: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' as const, textAlign: 'center' as const, marginBottom: 10 },
  successMessageNew: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginBottom: 24, lineHeight: 20 },
  successButtonNew: {
    backgroundColor: Colors.primary.orange,
    paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 14,
  },
  successButtonTextNew: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },

  // Old success styles (unused)
  successCard: { backgroundColor: Colors.background.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center' },
  successTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, textAlign: 'center' as const, marginBottom: 12 },
  successMessage: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginBottom: 24, lineHeight: 20 },
  successButton: { backgroundColor: Colors.primary.blue, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  successButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' as const },

  paymentModeSection: { marginBottom: 16 },
  paymentModeCard: {
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1, borderColor: Colors.border.medium,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  paymentModeCardSelected: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '15',
  },
  paymentModeHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  paymentModeTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  paymentModeTitleSelected: { color: Colors.primary.orange },
  paymentModeDescription: { color: Colors.text.muted, fontSize: 12, marginTop: 6 },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.status.error,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  errorBannerClose: {
    color: Colors.status.error,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  ticketTypesSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  ticketTypesHint: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  ticketTypeCard: {
    backgroundColor: Colors.background.dark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 12,
    marginBottom: 10,
  },
  ticketTypeHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  ticketTypeIndex: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  ticketInput: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontSize: 14,
    marginBottom: 8,
  },
  ticketTypeRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  ticketTypeLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  ticketInputSmall: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text.primary,
    fontSize: 14,
  },
  addTicketTypeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primary.orange,
    borderStyle: 'dashed' as const,
    borderRadius: 10,
    marginTop: 4,
  },
  addTicketTypeText: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  ticketDaysSection: {
    marginTop: 10,
  },
  ticketDaysLabel: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  ticketDaysRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  ticketDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.background.card,
  },
  ticketDayChipActive: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '20',
  },
  ticketDayChipText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  ticketDayChipTextActive: {
    color: Colors.primary.orange,
  },
  ticketDaysSelected: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  logoSelector: {
    alignSelf: 'flex-start',
    position: 'relative',
    marginTop: 8,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1,
    borderColor: Colors.border.light + '60',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoPlaceholderText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.dark,
  },
  bannerSelector: {
    position: 'relative',
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerPreview: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderStyle: 'dashed' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bannerPlaceholderText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  bannerEditBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.dark,
  },
});
