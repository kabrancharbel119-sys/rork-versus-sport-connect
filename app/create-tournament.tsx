import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, TextInput, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Trophy, MapPin, Check, ChevronDown, Search, Calendar, Users, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { venuesApi } from '@/lib/api/venues';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Sport, SkillLevel, Venue } from '@/types';
import { ALL_SPORTS, sportLabels, levelLabels } from '@/mocks/data';

const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
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

/** Propositions de lieux affichées dans le modal (sélection rapide) */
const VENUE_SUGGESTIONS: { name: string; city: string }[] = [
  { name: 'Stade municipal', city: 'Ville' },
  { name: 'Stade Félix Houphouët-Boigny', city: 'Abidjan' },
  { name: 'Stade de Cocody', city: 'Abidjan' },
  { name: 'Palais des sports', city: 'Ville' },
  { name: 'Complexe sportif', city: 'Ville' },
  { name: 'Salle omnisports', city: 'Ville' },
  { name: 'Terrain de quartier', city: 'Ville' },
  { name: 'Gymnase municipal', city: 'Ville' },
  { name: 'Centre sportif', city: 'Ville' },
  { name: 'Stade de Yopougon', city: 'Abidjan' },
  { name: 'Arena', city: 'Ville' },
  { name: 'Stade Robert Champroux', city: 'Abidjan' },
];

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

  // Utiliser les terrains du gestionnaire ou tous les terrains selon le rôle
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
  const [showManualVenue, setShowManualVenue] = useState(false);
  const [sportSearch, setSportSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [manualVenueName, setManualVenueName] = useState('');
  const [manualVenueCity, setManualVenueCity] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isPaidTournament = (parseInt(formData.entryFee || '0', 10) || 0) > 0;

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

  const filteredVenues = useMemo(() => {
    if (!venueSearch.trim()) return venues;
    return venues.filter(v =>
      v.name.toLowerCase().includes(venueSearch.toLowerCase()) ||
      v.city.toLowerCase().includes(venueSearch.toLowerCase())
    );
  }, [venueSearch, venues]);

  const filteredSuggestions = useMemo(() => {
    if (!venueSearch.trim()) return VENUE_SUGGESTIONS;
    const q = venueSearch.toLowerCase();
    return VENUE_SUGGESTIONS.filter(
      s => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  }, [venueSearch]);

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
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour créer un tournoi.');
      return;
    }
    const validation = validate();
    if (!validation.valid) {
      Alert.alert('Corriger le formulaire', validation.firstError ?? 'Vérifiez les champs marqués puis réessayez.');
      return;
    }
    const hasVenue = formData.venue?.name && formData.venue.name !== emptyVenue.name && formData.venue.city;
    if (!hasVenue) {
      Alert.alert('Lieu manquant', 'Choisissez un lieu dans la liste (étape 2) ou utilisez « Saisir un lieu personnalisé » pour indiquer le nom et la ville du terrain.');
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
    try {
      await createTournament({
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
      });
      await refetchTournaments();
      Alert.alert('Succès', 'Tournoi créé avec succès !', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Impossible de créer le tournoi';
      Alert.alert('Erreur', message);
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
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
          style={styles.iconGradient}
        >
          <Trophy size={40} color="#FFFFFF" />
        </LinearGradient>
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

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Sport *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => { Keyboard.dismiss(); setShowSportModal(true); }}>
          <Text style={styles.selectorIcon}>{sportIcons[formData.sport]}</Text>
          <Text style={styles.selectorText}>{sportLabels[formData.sport]}</Text>
          <ChevronDown size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Format</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionRow}>
            {formats[formData.sport].map((format) => (
              <TouchableOpacity
                key={format}
                style={[styles.optionChip, formData.format === format && styles.optionChipActive]}
                onPress={() => updateField('format', format)}
              >
                <Text style={[styles.optionText, formData.format === format && styles.optionTextActive]}>{format}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Type de tournoi</Text>
        <View style={styles.typeGrid}>
          {tournamentTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, formData.type === type.id && styles.typeCardActive]}
              onPress={() => updateField('type', type.id)}
            >
              <Text style={styles.typeEmoji}>{type.icon}</Text>
              <Text style={[styles.typeLabel, formData.type === type.id && styles.typeLabelActive]}>
                {type.label}
              </Text>
              {formData.type === type.id && (
                <View style={styles.checkBadge}><Check size={12} color="#FFF" /></View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Niveau</Text>
        <View style={styles.optionGrid}>
          {levels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.levelChip, formData.level === level && styles.levelChipActive]}
              onPress={() => updateField('level', level)}
            >
              <Text style={[styles.levelText, formData.level === level && styles.levelTextActive]}>
                {levelLabels[level]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
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
          <Input
            scrollViewRef={scrollViewRef}
            label="Frais d'inscription (FCFA)"
            placeholder="25000"
            value={formData.entryFee}
            onChangeText={(v) => updateField('entryFee', v.replace(/[^0-9]/g, ''))}
            error={errors.entryFee}
            keyboardType="numeric"
            icon={<DollarSign size={18} color={Colors.text.muted} />}
          />
        </View>
      </View>

      {isPaidTournament && (
        <View style={styles.paymentDisclaimerBox}>
          <Text style={styles.paymentDisclaimerTitle}>⚠️ Informations importantes sur les paiements</Text>
          <Text style={styles.paymentDisclaimerText}>
            Pour des raisons de sécurité, les frais d’inscription ne sont pas reversés automatiquement et directement aux organisateurs.
            Un reversement anticipé peut être accordé sous certaines conditions, uniquement après une demande et une validation administrateur.
          </Text>
        </View>
      )}

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

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Lieu *</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => { Keyboard.dismiss(); setShowVenueModal(true); setShowManualVenue(false); }}
          activeOpacity={0.7}
        >
          <MapPin size={20} color={Colors.primary.blue} />
          <View style={styles.venueInfo}>
            <Text style={styles.selectorText} numberOfLines={1}>{formData.venue?.name || 'Choisir un lieu'}</Text>
            <Text style={styles.venueCity}>{(formData.venue?.city || '').trim() || 'Ville'}</Text>
          </View>
          <ChevronDown size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateSection}>
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

      <Input
        label="Sponsor (optionnel)"
        placeholder="Nom du sponsor"
        value={formData.sponsorName}
        onChangeText={(v) => updateField('sponsorName', v)}
        maxLength={30}
      />
    </>
  );

  const renderStep3 = () => (
    <>
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
        <Text style={styles.dateHint}>Modifiez les dates à l’étape 2 si besoin.</Text>
      </View>

      <Input
        scrollViewRef={scrollViewRef}
        label="Description *"
        placeholder="Décrivez votre tournoi, les règles, les prix..."
        value={formData.description}
        onChangeText={(v) => updateField('description', v)}
        error={errors.description}
        multiline
        numberOfLines={4}
        maxLength={500}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📋 Récapitulatif</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tournoi:</Text>
          <Text style={styles.summaryValue}>{formData.name || '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sport:</Text>
          <Text style={styles.summaryValue}>{sportLabels[formData.sport]} {formData.format}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type:</Text>
          <Text style={styles.summaryValue}>{tournamentTypes.find(t => t.id === formData.type)?.label}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Équipes:</Text>
          <Text style={styles.summaryValue}>{formData.maxTeams} max</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Inscription:</Text>
          <Text style={styles.summaryValue}>{parseInt(formData.entryFee || '0').toLocaleString()} FCFA</Text>
        </View>
        {isPaidTournament && (
          <View style={styles.summaryDisclaimerWrap}>
            <Text style={styles.summaryDisclaimerText}>
              Reversement organisateur: non automatique. Les avances sont traitées uniquement après approbation admin.
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cagnotte:</Text>
          <Text style={[styles.summaryValue, styles.prizeValue]}>{parseInt(formData.prizePool || '0').toLocaleString()} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Lieu:</Text>
          <Text style={styles.summaryValue}>{formData.venue.name}</Text>
        </View>
      </View>
    </>
  );

  if (!canCreateTournament) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
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
              <Button title="Retour" onPress={() => router.back()} variant="primary" size="large" style={{ marginTop: 28 }} />
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
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Créer un tournoi</Text>
              <Text style={styles.stepIndicator}>Étape {step}/3</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
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

            <View style={styles.footer}>
              {step > 1 && (
                <Button title="Retour" onPress={() => setStep(step - 1)} variant="secondary" size="large" style={styles.backBtn} />
              )}
              {step < 3 ? (
                <Button
                  title="Suivant"
                  onPress={() => {
                    if (step === 1 && !formData.name.trim()) {
                      setErrors({ name: 'Nom requis' });
                      return;
                    }
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
                  onPress={() => { Keyboard.dismiss(); setShowVenueModal(false); setVenueSearch(''); setShowManualVenue(false); }}
                >
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              {!showManualVenue ? (
                <>
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
                    {filteredSuggestions.length > 0 && (
                      <>
                        <Text style={styles.venueSectionLabel}>Propositions</Text>
                        {filteredSuggestions.map((s, index) => {
                          const suggestionId = `suggestion-${s.name}-${s.city}-${index}`;
                          const isSelected = formData.venue?.name === s.name && formData.venue?.city === s.city;
                          return (
                            <TouchableOpacity
                              key={suggestionId}
                              style={[styles.venueItem, isSelected && styles.venueItemActive]}
                              onPress={() => {
                                const manualVenue: Venue = {
                                  id: `suggestion-${index}-${Date.now()}`,
                                  name: s.name,
                                  address: s.city,
                                  city: s.city,
                                  sport: [formData.sport],
                                  pricePerHour: 0,
                                  rating: 0,
                                  amenities: [],
                                };
                                updateField('venue', manualVenue);
                                setShowVenueModal(false);
                                setVenueSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.venueItemInfo}>
                                <Text style={[styles.venueItemName, isSelected && styles.venueItemNameActive]}>
                                  {s.name}
                                </Text>
                                <Text style={styles.venueItemCity}>{s.city}</Text>
                              </View>
                              {isSelected && <Check size={20} color={Colors.primary.blue} />}
                            </TouchableOpacity>
                          );
                        })}
                        {filteredVenues.length > 0 && (
                          <Text style={[styles.venueSectionLabel, { marginTop: 16 }]}>Lieux en base</Text>
                        )}
                      </>
                    )}
                    {filteredVenues.length > 0 && filteredSuggestions.length === 0 && (
                      <Text style={styles.venueSectionLabel}>Lieux en base</Text>
                    )}
                    {filteredVenues.length === 0 && filteredSuggestions.length === 0 ? (
                      <View style={styles.emptyVenueState}>
                        <MapPin size={40} color={Colors.text.muted} />
                        <Text style={styles.emptyVenueTitle}>Aucun résultat</Text>
                        <Text style={styles.emptyVenueText}>
                          Modifiez la recherche, choisissez une proposition ci-dessus ou saisissez un lieu personnalisé.
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
                            <Text style={styles.venueItemCity}>{venue.city} • {venue.pricePerHour.toLocaleString()} FCFA/h</Text>
                          </View>
                          {formData.venue?.id === venue.id && <Check size={20} color={Colors.primary.blue} />}
                        </TouchableOpacity>
                      ))
                    )}
                    <TouchableOpacity
                      style={styles.manualVenueCta}
                      onPress={() => setShowManualVenue(true)}
                    >
                      <Text style={styles.manualVenueCtaText}>+ Saisir un lieu personnalisé</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              ) : (
                <ScrollView
                  style={styles.manualVenueFormScroll}
                  contentContainerStyle={styles.manualVenueForm}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.fieldLabel}>Nom du lieu</Text>
                  <TextInput
                    style={styles.manualInput}
                    placeholder="Ex: Stade de Cocody"
                    placeholderTextColor={Colors.text.muted}
                    value={manualVenueName}
                    onChangeText={setManualVenueName}
                  />
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Ville</Text>
                  <TextInput
                    style={styles.manualInput}
                    placeholder="Ex: Abidjan"
                    placeholderTextColor={Colors.text.muted}
                    value={manualVenueCity}
                    onChangeText={setManualVenueCity}
                  />
                  <View style={[styles.manualVenueActions, { marginBottom: 320 }]}>
                    <TouchableOpacity style={styles.manualVenueBack} onPress={() => setShowManualVenue(false)}>
                      <Text style={styles.manualVenueBackText}>Retour</Text>
                    </TouchableOpacity>
                    <Button
                      title="Valider"
                      onPress={() => {
                        const name = manualVenueName.trim() || 'Lieu personnalisé';
                        const city = manualVenueCity.trim() || 'Non précisé';
                        const manualVenue: Venue = {
                          id: `manual-${Date.now()}`,
                          name,
                          address: city,
                          city,
                          sport: [formData.sport],
                          pricePerHour: 0,
                          rating: 0,
                          amenities: [],
                        };
                        updateField('venue', manualVenue);
                        setShowVenueModal(false);
                        setVenueSearch('');
                        setShowManualVenue(false);
                        setManualVenueName('');
                        setManualVenueCity('');
                      }}
                      variant="orange"
                      size="medium"
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '600' as const },
  stepIndicator: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  placeholder: { width: 40 },
  progressBar: { height: 3, backgroundColor: Colors.background.card, marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 2 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  iconContainer: { alignSelf: 'center', marginBottom: 24 },
  iconGradient: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },
  selector: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, gap: 12 },
  selectorIcon: { fontSize: 24 },
  selectorText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  venueInfo: { flex: 1 },
  venueCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
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
  typeCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: Colors.background.card, borderWidth: 2, borderColor: 'transparent', position: 'relative' as const },
  typeCardActive: { borderColor: Colors.primary.orange, backgroundColor: 'rgba(255,107,0,0.1)' },
  typeEmoji: { fontSize: 28, marginBottom: 8 },
  typeLabel: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' as const, textAlign: 'center' as const },
  typeLabelActive: { color: Colors.primary.orange },
  checkBadge: { position: 'absolute' as const, top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  prizesPreview: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border.light },
  paymentDisclaimerBox: {
    backgroundColor: Colors.primary.orange + '12',
    borderColor: Colors.primary.orange + '30',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  paymentDisclaimerTitle: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const, marginBottom: 6 },
  paymentDisclaimerText: { color: Colors.text.secondary, fontSize: 12, lineHeight: 18 },
  prizesTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 12 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  prizePosition: { color: Colors.text.secondary, fontSize: 14 },
  prizeAmount: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  dateSection: { marginBottom: 20 },
  dateCard: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border.light },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateRowTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dateDisplay: { color: Colors.text.primary, fontSize: 16, fontWeight: '500' as const, marginTop: 4 },
  datePickerWrapper: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 12, marginTop: 8 },
  datePickerConfirmBtn: { marginTop: 12, paddingVertical: 10, backgroundColor: Colors.primary.orange, borderRadius: 10, alignItems: 'center' as const },
  datePickerConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '600' as const },
  dateDivider: { height: 1, backgroundColor: Colors.border.light, marginVertical: 12 },
  dateInfo: { flex: 1 },
  dateLabel: { color: Colors.text.muted, fontSize: 12 },
  dateValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const, marginTop: 2 },
  dateInput: { backgroundColor: Colors.background.dark, borderRadius: 10, padding: 12, color: Colors.text.primary, fontSize: 15, marginTop: 6, borderWidth: 1, borderColor: Colors.border.light },
  dateInputError: { borderColor: Colors.status.error },
  dateError: { color: Colors.status.error, fontSize: 12, marginTop: 4 },
  dateHint: { color: Colors.text.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' as const },
  summaryCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border.light },
  summaryTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  summaryDisclaimerWrap: {
    backgroundColor: Colors.primary.orange + '12',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  summaryDisclaimerText: { color: Colors.text.secondary, fontSize: 12, lineHeight: 17 },
  summaryLabel: { color: Colors.text.muted, fontSize: 14 },
  summaryValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  prizeValue: { color: Colors.primary.orange },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, marginHorizontal: 20, marginVertical: 12, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15, paddingVertical: 12 },
  sportsList: { paddingHorizontal: 20, paddingBottom: 40 },
  sportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 14 },
  sportItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  sportItemIcon: { fontSize: 24, width: 36, textAlign: 'center' as const },
  sportItemText: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  sportItemTextActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  venuesList: { paddingHorizontal: 20, paddingBottom: 40 },
  venueSectionLabel: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const, marginBottom: 8 },
  venueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  venueItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  venueItemInfo: { flex: 1 },
  venueItemName: { color: Colors.text.primary, fontSize: 15 },
  venueItemNameActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  venueItemCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  emptyVenueState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyVenueTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginTop: 12 },
  emptyVenueText: { color: Colors.text.muted, fontSize: 14, marginTop: 8, textAlign: 'center' as const },
  manualVenueCta: { paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: Colors.border.light },
  manualVenueCtaText: { color: Colors.primary.orange, fontSize: 15, fontWeight: '600' as const },
  manualVenueFormScroll: { flexGrow: 1 },
  manualVenueForm: { padding: 20 },
  manualInput: { backgroundColor: Colors.background.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text.primary, fontSize: 15, borderWidth: 1, borderColor: Colors.border.light },
  manualVenueActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  manualVenueBack: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  manualVenueBackText: { color: Colors.text.secondary, fontSize: 15 },
});
