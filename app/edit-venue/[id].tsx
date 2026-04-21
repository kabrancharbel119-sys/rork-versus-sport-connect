import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Plus, X } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api/venues';
import { Button } from '@/components/Button';
import { uploadVenueImage } from '@/lib/uploadImage';
import type { Sport } from '@/types';

const ALL_SPORTS: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby', 'badminton', 'tabletennis', 'padel', 'squash', 'futsal', 'beachvolleyball'];

const sportLabels: Record<string, string> = {
  football: 'Football', basketball: 'Basketball', volleyball: 'Volleyball',
  tennis: 'Tennis', handball: 'Handball', rugby: 'Rugby', badminton: 'Badminton',
  tabletennis: 'Tennis de table', padel: 'Padel', squash: 'Squash',
  futsal: 'Futsal', beachvolleyball: 'Beach-volley',
};

const AMENITIES = [
  'Vestiaires', 'Douches', 'Parking', 'Éclairage', 'Tribunes',
  'Wi-Fi', 'Cafétéria', 'Location équipement', 'Arbitre disponible',
];

const SURFACE_TYPES = [
  'Gazon naturel', 'Gazon synthétique', 'Terre battue', 'Béton',
  'Parquet', 'Sable', 'Tartan', 'Résine',
];

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const DEFAULT_HOURS = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i + 1 === 7 ? 0 : i + 1,
  openTime: '08:00',
  closeTime: '22:00',
  isClosed: false,
}));

export default function EditVenueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, isVenueManager } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const venueQuery = useQuery({
    queryKey: ['venue', id],
    queryFn: () => venuesApi.getById(id!),
    enabled: !!id,
  });

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    description: '',
    phone: '',
    email: '',
    pricePerHour: '',
    sports: [] as string[],
    amenities: [] as string[],
    images: [] as string[],
    autoApprove: true,
    cancellationHours: '24',
    isActive: true,
    capacity: '',
    surfaceType: '',
    rules: '',
    openingHours: DEFAULT_HOURS,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (venueQuery.data) {
      const v = venueQuery.data;
      setFormData({
        name: v.name,
        address: v.address,
        city: v.city,
        description: v.description || '',
        phone: v.phone || '',
        email: v.email || '',
        pricePerHour: v.pricePerHour.toString(),
        sports: (v.sport as string[]) || [],
        amenities: v.amenities || [],
        images: v.images || [],
        autoApprove: v.autoApprove ?? true,
        cancellationHours: (v.cancellationHours ?? 24).toString(),
        isActive: v.isActive ?? true,
        capacity: v.capacity?.toString() || '',
        surfaceType: v.surfaceType || '',
        rules: v.rules || '',
        openingHours: v.openingHours || DEFAULT_HOURS,
      });
    }
  }, [venueQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => venuesApi.update(id!, user!.id, {
      name: formData.name.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      sport: formData.sports,
      pricePerHour: parseInt(formData.pricePerHour) || 0,
      description: formData.description.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      amenities: formData.amenities,
      images: formData.images,
      autoApprove: formData.autoApprove,
      cancellationHours: parseInt(formData.cancellationHours) || 24,
      isActive: formData.isActive,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      surfaceType: formData.surfaceType || undefined,
      rules: formData.rules.trim() || undefined,
      openingHours: formData.openingHours,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVenues'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['venue', id] });
      Alert.alert('Terrain mis à jour !', '', [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message || 'Impossible de modifier le terrain.');
    },
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleSport = (sport: string) => {
    setFormData(prev => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter(s => s !== sport)
        : [...prev.sports, sport],
    }));
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const pickVenuePhoto = async () => {
    console.log('[pickVenuePhoto] START, platform:', Platform.OS);
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[pickVenuePhoto] permission:', JSON.stringify(perm));
      if (perm.status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez l\'accès aux photos dans les réglages (Expo Go → Photos).');
        return;
      }
    }

    console.log('[pickVenuePhoto] launching picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    console.log('[pickVenuePhoto] result canceled:', result.canceled, 'assets:', result.assets?.length);

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const localUri = result.assets[0].uri;
    console.log('[pickVenuePhoto] localUri:', localUri);
    setUploadingPhoto(true);
    try {
      const publicUrl = await uploadVenueImage(localUri, user!.id);
      console.log('[pickVenuePhoto] uploaded:', publicUrl);
      setFormData(prev => ({
        ...prev,
        images: prev.images.includes(publicUrl) ? prev.images : [...prev.images, publicUrl],
      }));
    } catch (err: any) {
      console.error('[pickVenuePhoto] upload error:', err.message);
      Alert.alert('Erreur upload', err.message || 'Impossible de télécharger la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeVenuePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Nom requis';
    if (!formData.address.trim()) e.address = 'Adresse requise';
    if (!formData.city.trim()) e.city = 'Ville requise';
    if (!formData.pricePerHour || parseInt(formData.pricePerHour) <= 0) e.pricePerHour = 'Prix requis';
    if (formData.sports.length === 0) e.sports = 'Sélectionnez au moins un sport';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateMutation.mutate();
  };

  if (!isVenueManager) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorText}>Accès réservé aux gestionnaires.</Text>
          <Button title="Retour" onPress={() => router.back()} variant="outline" />
        </SafeAreaView>
      </View>
    );
  }

  if (venueQuery.isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Modifier le terrain</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.sectionTitle}>Informations générales</Text>

              <Text style={styles.label}>Nom du terrain *</Text>
              <TextInput
                style={[styles.input, errors.name ? styles.inputError : null]}
                placeholderTextColor={Colors.text.muted}
                value={formData.name}
                onChangeText={v => updateField('name', v)}
              />
              {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}

              <Text style={styles.label}>Adresse *</Text>
              <TextInput
                style={[styles.input, errors.address ? styles.inputError : null]}
                placeholderTextColor={Colors.text.muted}
                value={formData.address}
                onChangeText={v => updateField('address', v)}
              />
              {errors.address && <Text style={styles.fieldError}>{errors.address}</Text>}

              <Text style={styles.label}>Ville *</Text>
              <TextInput
                style={[styles.input, errors.city ? styles.inputError : null]}
                placeholderTextColor={Colors.text.muted}
                value={formData.city}
                onChangeText={v => updateField('city', v)}
              />
              {errors.city && <Text style={styles.fieldError}>{errors.city}</Text>}

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholderTextColor={Colors.text.muted}
                value={formData.description}
                onChangeText={v => updateField('description', v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.sectionTitle}>Photos du lieu</Text>
              <TouchableOpacity style={[styles.photoAddButton, uploadingPhoto && { opacity: 0.5 }]} onPress={pickVenuePhoto} disabled={uploadingPhoto}>
                <Plus size={16} color={Colors.text.primary} />
                <Text style={styles.photoAddText}>{uploadingPhoto ? 'Upload en cours...' : 'Ajouter une photo'}</Text>
              </TouchableOpacity>
              {formData.images.length === 0 && (
                <Text style={styles.photoHint}>Ajoutez quelques photos pour mieux présenter votre terrain.</Text>
              )}
              {formData.images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroller}>
                  {formData.images.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={styles.photoCard}>
                      <Image source={uri} style={styles.photoPreview} contentFit="cover" />
                      <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeVenuePhoto(idx)}>
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.sectionTitle}>Contact</Text>

              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={Colors.text.muted}
                value={formData.phone}
                onChangeText={v => updateField('phone', v)}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholderTextColor={Colors.text.muted}
                value={formData.email}
                onChangeText={v => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.sectionTitle}>Tarification</Text>

              <Text style={styles.label}>Prix par heure (FCFA) *</Text>
              <TextInput
                style={[styles.input, errors.pricePerHour ? styles.inputError : null]}
                placeholderTextColor={Colors.text.muted}
                value={formData.pricePerHour}
                onChangeText={v => updateField('pricePerHour', v)}
                keyboardType="numeric"
              />
              {errors.pricePerHour && <Text style={styles.fieldError}>{errors.pricePerHour}</Text>}

              <Text style={styles.sectionTitle}>Sports disponibles *</Text>
              {errors.sports && <Text style={styles.fieldError}>{errors.sports}</Text>}
              <View style={styles.chipGrid}>
                {ALL_SPORTS.map(sport => {
                  const selected = formData.sports.includes(sport);
                  return (
                    <TouchableOpacity
                      key={sport}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleSport(sport)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {sportLabels[sport] || sport}
                      </Text>
                      {selected && <Check size={14} color="#FFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.chipGrid}>
                {AMENITIES.map(amenity => {
                  const selected = formData.amenities.includes(amenity);
                  return (
                    <TouchableOpacity
                      key={amenity}
                      style={[styles.chip, selected && styles.chipSelectedBlue]}
                      onPress={() => toggleAmenity(amenity)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{amenity}</Text>
                      {selected && <Check size={14} color="#FFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Caractéristiques du terrain</Text>

              <Text style={styles.label}>Capacité (nombre de joueurs max)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 22"
                placeholderTextColor={Colors.text.muted}
                value={formData.capacity}
                onChangeText={v => updateField('capacity', v)}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Type de surface</Text>
              <View style={styles.chipGrid}>
                {SURFACE_TYPES.map(surface => {
                  const selected = formData.surfaceType === surface;
                  return (
                    <TouchableOpacity
                      key={surface}
                      style={[styles.chip, selected && styles.chipSelectedGreen]}
                      onPress={() => updateField('surfaceType', selected ? '' : surface)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{surface}</Text>
                      {selected && <Check size={14} color="#FFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Horaires d'ouverture</Text>
              <Text style={styles.hoursHint}>Configurez les horaires pour chaque jour.</Text>
              {formData.openingHours.map((day: any, idx: number) => (
                <View key={idx} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayName, day.isClosed && styles.dayNameClosed]}>{DAY_NAMES[idx]}</Text>
                    <TouchableOpacity
                      style={[styles.dayStatusBtn, day.isClosed && styles.dayStatusBtnClosed]}
                      onPress={() => {
                        const updated = [...formData.openingHours];
                        updated[idx] = { ...updated[idx], isClosed: !updated[idx].isClosed };
                        updateField('openingHours', updated);
                      }}
                    >
                      <Text style={styles.dayStatusBtnText}>{day.isClosed ? 'Ouvrir ce jour' : 'Fermer ce jour'}</Text>
                    </TouchableOpacity>
                  </View>
                  {day.isClosed ? (
                    <Text style={styles.closedLabel}>Fermé</Text>
                  ) : (
                    <View style={styles.hoursInputs}>
                      <TextInput
                        style={styles.hourInput}
                        value={day.openTime}
                        placeholderTextColor={Colors.text.muted}
                        placeholder="08:00"
                        onChangeText={v => {
                          const updated = [...formData.openingHours];
                          updated[idx] = { ...updated[idx], openTime: v };
                          updateField('openingHours', updated);
                        }}
                      />
                      <Text style={styles.hourSep}>-</Text>
                      <TextInput
                        style={styles.hourInput}
                        value={day.closeTime}
                        placeholderTextColor={Colors.text.muted}
                        placeholder="22:00"
                        onChangeText={v => {
                          const updated = [...formData.openingHours];
                          updated[idx] = { ...updated[idx], closeTime: v };
                          updateField('openingHours', updated);
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}

              <Text style={styles.sectionTitle}>Règlement du terrain</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ex: Chaussures à crampons interdites..."
                placeholderTextColor={Colors.text.muted}
                value={formData.rules}
                onChangeText={v => updateField('rules', v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.sectionTitle}>Paramètres</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Approbation automatique</Text>
                  <Text style={styles.switchHint}>
                    Les réservations sont confirmées automatiquement.
                  </Text>
                </View>
                <Switch
                  value={formData.autoApprove}
                  onValueChange={v => updateField('autoApprove', v)}
                  trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Text style={styles.label}>Délai d'annulation (heures avant le créneau)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 24"
                placeholderTextColor={Colors.text.muted}
                value={formData.cancellationHours}
                onChangeText={v => updateField('cancellationHours', v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
              <Text style={styles.switchHint}>Le joueur ne pourra plus annuler après ce délai avant le début du créneau.</Text>

              <View style={[styles.switchRow, { marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Terrain actif</Text>
                  <Text style={styles.switchHint}>
                    Si désactivé, le terrain n'apparaît plus dans les recherches.
                  </Text>
                </View>
                <Switch
                  value={formData.isActive}
                  onValueChange={v => updateField('isActive', v)}
                  trackColor={{ false: Colors.background.cardLight, true: Colors.status.success }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Button
                title="Enregistrer les modifications"
                onPress={handleSave}
                loading={updateMutation.isPending}
                disabled={updateMutation.isPending}
                variant="orange"
                size="large"
                style={{ marginTop: 24 }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    color: Colors.text.primary, fontSize: 18, fontWeight: '700',
    marginTop: 24, marginBottom: 12,
  },
  label: {
    color: Colors.text.secondary, fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.light, borderRadius: 10,
    color: Colors.text.primary, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  inputError: { borderColor: Colors.status.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  fieldError: { color: Colors.status.error, fontSize: 12, marginTop: 4 },
  errorText: { color: Colors.status.error, fontSize: 16, textAlign: 'center', marginBottom: 16 },
  loadingText: { color: Colors.text.muted, fontSize: 16 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.light, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: Colors.primary.orange + '30',
    borderColor: Colors.primary.orange,
  },
  chipSelectedBlue: {
    backgroundColor: Colors.primary.blue + '30',
    borderColor: Colors.primary.blue,
  },
  chipText: { color: Colors.text.muted, fontSize: 13 },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 10, padding: 14, gap: 12,
  },
  switchLabel: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  switchHint: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  chipSelectedGreen: {
    backgroundColor: Colors.status.success + '30',
    borderColor: Colors.status.success,
  },
  hoursHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background.card,
    borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  dayToggle: {
    width: 80, paddingVertical: 6, borderRadius: 6,
    backgroundColor: Colors.status.success + '20', alignItems: 'center',
  },
  dayToggleClosed: { backgroundColor: Colors.text.muted + '20' },
  dayHeader: {
    width: 120,
    gap: 8,
  },
  dayStatusBtn: {
    borderRadius: 6,
    backgroundColor: Colors.status.error + '20',
    borderWidth: 1,
    borderColor: Colors.status.error + '55',
    paddingVertical: 6,
    alignItems: 'center',
  },
  dayStatusBtnClosed: {
    backgroundColor: Colors.status.success + '20',
    borderColor: Colors.status.success + '55',
  },
  dayStatusBtnText: {
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  dayName: { color: Colors.status.success, fontSize: 12, fontWeight: '700' },
  dayNameClosed: { color: Colors.text.muted, textDecorationLine: 'line-through' },
  closedLabel: { color: Colors.text.muted, fontSize: 13, fontStyle: 'italic', flex: 1, textAlign: 'center' },
  hoursInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hourInput: {
    flex: 1, backgroundColor: Colors.background.cardLight,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    color: Colors.text.primary, fontSize: 14, textAlign: 'center',
  },
  hourSep: { color: Colors.text.muted, fontSize: 14 },
  photoAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 10,
    paddingVertical: 12,
  },
  photoAddText: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  photoHint: { color: Colors.text.muted, fontSize: 12, marginTop: 8 },
  photoScroller: { marginTop: 10 },
  photoCard: { marginRight: 10, position: 'relative' },
  photoPreview: {
    width: 110,
    height: 110,
    borderRadius: 10,
    backgroundColor: Colors.background.cardLight,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
