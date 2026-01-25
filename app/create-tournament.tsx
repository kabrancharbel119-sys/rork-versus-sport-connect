import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Trophy, MapPin, Check, ChevronDown, Search, Calendar, Users, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Sport, SkillLevel, Venue } from '@/types';
import { ALL_SPORTS, sportLabels, levelLabels, mockVenues } from '@/mocks/data';

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

export default function CreateTournamentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createTournament, isCreating } = useTournaments();
  const { venues } = useMatches();

  const [step, setStep] = useState(1);
  const [showSportModal, setShowSportModal] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [sportSearch, setSportSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');

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
    venue: venues[0] || mockVenues[0],
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    sponsorName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredSports = useMemo(() => {
    if (!sportSearch.trim()) return ALL_SPORTS;
    return ALL_SPORTS.filter(s => 
      sportLabels[s].toLowerCase().includes(sportSearch.toLowerCase())
    );
  }, [sportSearch]);

  const filteredVenues = useMemo(() => {
    const allVenues = venues.length > 0 ? venues : mockVenues;
    if (!venueSearch.trim()) return allVenues;
    return allVenues.filter(v => 
      v.name.toLowerCase().includes(venueSearch.toLowerCase()) ||
      v.city.toLowerCase().includes(venueSearch.toLowerCase())
    );
  }, [venueSearch, venues]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Nom requis';
    else if (formData.name.length < 5) newErrors.name = 'Minimum 5 caractères';
    if (!formData.description.trim()) newErrors.description = 'Description requise';
    
    const maxTeams = parseInt(formData.maxTeams, 10);
    if (isNaN(maxTeams) || maxTeams < 4) newErrors.maxTeams = 'Minimum 4 équipes';
    if (maxTeams > 64) newErrors.maxTeams = 'Maximum 64 équipes';
    
    const entryFee = parseInt(formData.entryFee, 10);
    if (isNaN(entryFee) || entryFee < 0) newErrors.entryFee = 'Montant invalide';
    
    const prizePool = parseInt(formData.prizePool, 10);
    if (isNaN(prizePool) || prizePool < 0) newErrors.prizePool = 'Montant invalide';
    
    if (formData.startDate <= new Date()) newErrors.startDate = 'Date de début invalide';
    if (formData.endDate <= formData.startDate) newErrors.endDate = 'Date de fin invalide';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !user) return;
    
    const prizePool = parseInt(formData.prizePool, 10);
    const prizes = [
      { position: 1, amount: Math.floor(prizePool * 0.6), label: '1er' },
      { position: 2, amount: Math.floor(prizePool * 0.3), label: '2ème' },
      { position: 3, amount: Math.floor(prizePool * 0.1), label: '3ème' },
    ];
    
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
        startDate: formData.startDate,
        endDate: formData.endDate,
        createdBy: user.id,
        sponsorName: formData.sponsorName || undefined,
      });
      Alert.alert('Succès', 'Tournoi créé avec succès !', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de créer le tournoi');
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
        label="Nom du tournoi *"
        placeholder="Ex: Coupe de Cocody 2026"
        value={formData.name}
        onChangeText={(v) => updateField('name', v)}
        error={errors.name}
        maxLength={50}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Sport *</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowSportModal(true)}>
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

      <Input
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
        <TouchableOpacity style={styles.selector} onPress={() => setShowVenueModal(true)}>
          <MapPin size={20} color={Colors.primary.blue} />
          <View style={styles.venueInfo}>
            <Text style={styles.selectorText}>{formData.venue.name}</Text>
            <Text style={styles.venueCity}>{formData.venue.city}</Text>
          </View>
          <ChevronDown size={20} color={Colors.text.muted} />
        </TouchableOpacity>
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
        <Text style={styles.fieldLabel}>Dates du tournoi</Text>
        
        <View style={styles.dateCard}>
          <View style={styles.dateRow}>
            <Calendar size={20} color={Colors.primary.blue} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Début</Text>
              <Text style={styles.dateValue}>{formatDate(formData.startDate)}</Text>
            </View>
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateRow}>
            <Calendar size={20} color={Colors.primary.orange} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Fin</Text>
              <Text style={styles.dateValue}>{formatDate(formData.endDate)}</Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.dateHint}>Les dates peuvent être modifiées après la création</Text>
      </View>

      <Input
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

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowSportModal(false); setSportSearch(''); }}>
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

        <Modal visible={showVenueModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir un lieu</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowVenueModal(false); setVenueSearch(''); }}>
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
              <ScrollView style={styles.venuesList}>
                {filteredVenues.map((venue) => (
                  <TouchableOpacity
                    key={venue.id}
                    style={[styles.venueItem, formData.venue.id === venue.id && styles.venueItemActive]}
                    onPress={() => { updateField('venue', venue); setShowVenueModal(false); setVenueSearch(''); }}
                  >
                    <View style={styles.venueItemInfo}>
                      <Text style={[styles.venueItemName, formData.venue.id === venue.id && styles.venueItemNameActive]}>
                        {venue.name}
                      </Text>
                      <Text style={styles.venueItemCity}>{venue.city} • {venue.pricePerHour.toLocaleString()} FCFA/h</Text>
                    </View>
                    {formData.venue.id === venue.id && <Check size={20} color={Colors.primary.blue} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
  prizesTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 12 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  prizePosition: { color: Colors.text.secondary, fontSize: 14 },
  prizeAmount: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  dateSection: { marginBottom: 20 },
  dateCard: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border.light },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateDivider: { height: 1, backgroundColor: Colors.border.light, marginVertical: 12 },
  dateInfo: { flex: 1 },
  dateLabel: { color: Colors.text.muted, fontSize: 12 },
  dateValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const, marginTop: 2 },
  dateHint: { color: Colors.text.muted, fontSize: 12, marginTop: 8, fontStyle: 'italic' as const },
  summaryCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border.light },
  summaryTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
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
  venueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  venueItemActive: { backgroundColor: 'rgba(21,101,192,0.05)' },
  venueItemInfo: { flex: 1 },
  venueItemName: { color: Colors.text.primary, fontSize: 15 },
  venueItemNameActive: { color: Colors.primary.blue, fontWeight: '500' as const },
  venueItemCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
});
