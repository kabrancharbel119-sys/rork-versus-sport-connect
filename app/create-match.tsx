import React, { useState, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Swords, MapPin, Trophy } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sport, SkillLevel, PlayStyle } from '@/types';
import { sportLabels, levelLabels, ambianceLabels, mockVenues } from '@/mocks/data';
import { venuesApi } from '@/lib/api/venues';

const sports: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby'];
const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const ambiances: PlayStyle[] = ['competitive', 'casual', 'mixed'];
const matchTypes = ['friendly', 'ranked'] as const;
const formats: Record<Sport, string[]> = {
  football: ['5v5', '7v7', '11v11'],
  basketball: ['3v3', '5v5'],
  volleyball: ['4v4', '6v6'],
  tennis: ['1v1', '2v2'],
  handball: ['7v7'],
  rugby: ['7v7', '15v15'],
  badminton: ['1v1', '2v2'],
  tabletennis: ['1v1', '2v2'],
  cricket: ['11v11'],
  baseball: ['9v9'],
  hockey: ['6v6', '11v11'],
  golf: ['1v1', '2v2', '4v4'],
  swimming: ['1v1', '4v4'],
  athletics: ['1v1', '4v4'],
  boxing: ['1v1'],
  mma: ['1v1'],
  wrestling: ['1v1'],
  judo: ['1v1'],
  karate: ['1v1'],
  taekwondo: ['1v1'],
  cycling: ['1v1', '4v4'],
  skateboarding: ['1v1'],
  surfing: ['1v1'],
  climbing: ['1v1', '2v2'],
  gymnastics: ['1v1'],
  esports: ['1v1', '2v2', '5v5'],
  futsal: ['5v5'],
  beachvolleyball: ['2v2', '4v4'],
  padel: ['2v2'],
  squash: ['1v1', '2v2'],
};

export default function CreateMatchScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { createMatch, venues, isCreating } = useMatches();

  // Utiliser les terrains de l'API ou les données mockées en fallback
  const availableVenues = venues.length > 0 ? venues : mockVenues;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);

  function toLocalDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const dates = useMemo(() => {
    const result = [];
    const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      result.push({
        dateStr: toLocalDateStr(d),
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
        monthShort: months[d.getMonth()],
      });
    }
    return result;
  }, []);

  const [selectedDate, setSelectedDate] = useState(dates[0].dateStr);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);

  const [formData, setFormData] = useState({
    sport: 'football' as Sport,
    format: '5v5',
    type: 'friendly' as 'friendly' | 'ranked',
    level: 'intermediate' as SkillLevel,
    ambiance: 'mixed' as PlayStyle,
    venueId: '',
    date: dates[0].dateStr,
    time: '15:00',
    duration: '90',
    maxPlayers: '10',
  });

  const selectedVenue = availableVenues.find(v => v.id === formData.venueId);

  const availabilityQuery = useQuery({
    queryKey: ['availability', formData.venueId, selectedDate],
    queryFn: () => venuesApi.getAvailability(formData.venueId, selectedDate),
    enabled: !!formData.venueId && !!selectedDate,
  });

  const slots = availabilityQuery.data || [];

  const toggleSlot = (hour: number) => {
    setSelectedSlots(prev => {
      const next = prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour].sort((a,b) => a-b);
      if (next.length > 0) {
        const sorted = [...next].sort((a,b) => a-b);
        const durationHours = sorted[sorted.length-1] - sorted[0] + 1;
        setFormData(f => ({
          ...f,
          date: selectedDate,
          time: `${String(sorted[0]).padStart(2,'0')}:00`,
          duration: String(durationHours * 60),
        }));
      }
      return next;
    });
  };

  const slotsAreConsecutive = useMemo(() => {
    if (selectedSlots.length <= 1) return true;
    const s = [...selectedSlots].sort((a,b) => a-b);
    for (let i = 1; i < s.length; i++) if (s[i] !== s[i-1]+1) return false;
    return true;
  }, [selectedSlots]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!selectedVenue) {
      Alert.alert('Lieu requis', 'Veuillez sélectionner un terrain.');
      return;
    }
    if (selectedSlots.length === 0) {
      Alert.alert('Créneau requis', 'Veuillez sélectionner au moins un créneau horaire.');
      return;
    }
    if (!slotsAreConsecutive) {
      Alert.alert('Créneaux non consécutifs', 'Veuillez sélectionner des heures consécutives.');
      return;
    }
    if (!validate()) return;
    const effectiveType = (isAdmin && formData.type === 'ranked') ? 'ranked' : (formData.type === 'ranked' ? 'friendly' : formData.type);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      console.log('[CreateMatch] calling createMatch...');
      await createMatch({
        sport: formData.sport,
        format: formData.format,
        type: effectiveType,
        venue: selectedVenue,
        dateTime,
        duration: parseInt(formData.duration, 10),
        level: formData.level,
        ambiance: formData.ambiance,
        maxPlayers: parseInt(formData.maxPlayers, 10),
        createdBy: user.id,
        entryFee: undefined,
        prize: undefined,
      });
      console.log('[CreateMatch] createMatch SUCCESS');
      safeBack(router, '/(tabs)/matches');
    } catch (error: any) {
      console.error('[CreateMatch] ERROR:', error?.message, error);
      Alert.alert('Erreur', error?.message ?? 'Impossible de créer le match');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.background.dark, '#0D1420']}
          style={StyleSheet.absoluteFill}
        />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/(tabs)/matches')}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Créer un match</Text>
            <View style={styles.placeholder} />
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
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[Colors.primary.blue, Colors.primary.blueDark]}
                  style={styles.iconGradient}
                >
                  <Swords size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Type de match</Text>
                <View style={styles.typeRow}>
                  {matchTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        formData.type === type && (type === 'ranked' ? styles.rankedChipActive : styles.friendlyChipActive),
                      ]}
                      onPress={() => updateField('type', type)}
                    >
                      <Text style={[styles.typeChipText, formData.type === type && styles.typeChipTextActive]}>
                        {type === 'friendly' ? '⚽ Amical' : '🏆 Classé'}
                      </Text>
                      {type === 'ranked' && !isAdmin && (
                        <Text style={[styles.typeChipSub, formData.type === type && styles.typeChipSubActive]}>
                          Bientôt
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {formData.type === 'ranked' && !isAdmin && (
                <Card style={styles.rankedSoonCard}>
                  <View style={styles.rankedSoonHeader}>
                    <View style={styles.rankedSoonIcon}>
                      <Trophy size={24} color={Colors.primary.orange} />
                    </View>
                    <Text style={styles.rankedSoonTitle}>Bientôt disponible</Text>
                  </View>
                  <Text style={styles.rankedSoonText}>
                    Les matchs classés sont en préparation. En attendant, créez un match amical pour jouer avec la communauté.
                  </Text>
                  <TouchableOpacity style={styles.rankedSoonBtn} onPress={() => updateField('type', 'friendly')}>
                    <Text style={styles.rankedSoonBtnText}>Créer un match amical</Text>
                  </TouchableOpacity>
                </Card>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Sport</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionRow}>
                    {sports.map((sport) => (
                      <TouchableOpacity
                        key={sport}
                        style={[styles.optionChip, formData.sport === sport && styles.optionChipActive]}
                        onPress={() => {
                          updateField('sport', sport);
                          updateField('format', formats[sport][0]);
                        }}
                      >
                        <Text style={[styles.optionText, formData.sport === sport && styles.optionTextActive]}>
                          {sportLabels[sport]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Format</Text>
                <View style={styles.optionRow}>
                  {formats[formData.sport].map((format) => (
                    <TouchableOpacity
                      key={format}
                      style={[styles.optionChip, formData.format === format && styles.optionChipActive]}
                      onPress={() => updateField('format', format)}
                    >
                      <Text style={[styles.optionText, formData.format === format && styles.optionTextActive]}>
                        {format}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Niveau</Text>
                <View style={styles.optionRow}>
                  {levels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.optionChip, formData.level === level && styles.optionChipActive]}
                      onPress={() => updateField('level', level)}
                    >
                      <Text style={[styles.optionText, formData.level === level && styles.optionTextActive]}>
                        {levelLabels[level]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Terrain</Text>
                {availableVenues.map((venue) => (
                  <TouchableOpacity
                    key={venue.id}
                    onPress={() => updateField('venueId', venue.id)}
                  >
                    <Card style={[styles.venueCard, formData.venueId === venue.id && styles.venueCardActive]}>
                      <View style={styles.venueRow}>
                        <MapPin size={20} color={formData.venueId === venue.id ? Colors.primary.blue : Colors.text.muted} />
                        <View style={styles.venueInfo}>
                          <Text style={styles.venueName}>{venue.name}</Text>
                          <Text style={styles.venueAddress}>{venue.address}</Text>
                        </View>
                        <Text style={styles.venuePrice}>
                          {venue.pricePerHour.toLocaleString()} FCFA/h
                        </Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {dates.map(d => (
                      <TouchableOpacity
                        key={d.dateStr}
                        style={[styles.dateChip, selectedDate === d.dateStr && styles.dateChipActive]}
                        onPress={() => {
                          setSelectedDate(d.dateStr);
                          setSelectedSlots([]);
                          setFormData(f => ({ ...f, date: d.dateStr, time: '15:00' }));
                        }}
                      >
                        <Text style={[styles.dateDayName, selectedDate === d.dateStr && styles.dateTextActive]}>{d.dayName}</Text>
                        <Text style={[styles.dateDayNum, selectedDate === d.dateStr && styles.dateTextActive]}>{d.dayNum}</Text>
                        <Text style={[styles.dateMonth, selectedDate === d.dateStr && styles.dateTextActive]}>{d.monthShort}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Slot grid */}
              {formData.venueId ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Créneau horaire</Text>
                  {availabilityQuery.isLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary.blue} style={{ marginVertical: 12 }} />
                  ) : slots.length === 0 ? (
                    <Text style={styles.noSlotsText}>Terrain fermé ou aucun créneau disponible ce jour.</Text>
                  ) : (
                    <>
                      <View style={styles.slotLegendRow}>
                        <View style={styles.slotLegendItem}><View style={[styles.slotDot, { backgroundColor: Colors.status.success }]} /><Text style={styles.slotLegendText}>Disponible</Text></View>
                        <View style={styles.slotLegendItem}><View style={[styles.slotDot, { backgroundColor: Colors.primary.blue }]} /><Text style={styles.slotLegendText}>Sélectionné</Text></View>
                        <View style={styles.slotLegendItem}><View style={[styles.slotDot, { backgroundColor: Colors.text.muted }]} /><Text style={styles.slotLegendText}>Indispo</Text></View>
                      </View>
                      <View style={styles.slotsGrid}>
                        {slots.map(slot => {
                          const isSelected = selectedSlots.includes(slot.hour);
                          const isDisabled = !slot.available;
                          return (
                            <TouchableOpacity
                              key={slot.hour}
                              style={[
                                styles.slot,
                                isDisabled && styles.slotDisabled,
                                isSelected && !isDisabled && styles.slotSelected,
                              ]}
                              onPress={() => !isDisabled && toggleSlot(slot.hour)}
                              disabled={isDisabled}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.slotTime, isDisabled && styles.slotTimeDisabled, isSelected && !isDisabled && styles.slotTimeSelected]}>
                                {slot.hour}h
                              </Text>
                              <Text style={[styles.slotStatus, isDisabled && styles.slotStatusDisabled, isSelected && !isDisabled && styles.slotStatusSelected]}>
                                {isDisabled ? 'Réservé' : isSelected ? '✓' : 'Libre'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {selectedSlots.length > 0 && (
                        <View style={styles.slotSummary}>
                          <Text style={styles.slotSummaryText}>
                            {selectedDate} • {formData.time} – {String(selectedSlots[selectedSlots.length-1]+1).padStart(2,'0')}h00 • {formData.duration} min
                          </Text>
                          {!slotsAreConsecutive && (
                            <Text style={styles.slotWarning}>⚠ Sélectionnez des créneaux consécutifs</Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Créneau horaire</Text>
                  <Text style={styles.noSlotsText}>Sélectionnez d'abord un terrain pour voir les disponibilités.</Text>
                </View>
              )}

              {/* Max players */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nombre max de joueurs</Text>
                <View style={styles.optionRow}>
                  {['4','6','8','10','12','14','16','22'].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.optionChip, formData.maxPlayers === n && styles.optionChipActive]}
                      onPress={() => updateField('maxPlayers', n)}
                    >
                      <Text style={[styles.optionText, formData.maxPlayers === n && styles.optionTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Button
                title="Créer le match"
                onPress={handleCreate}
                loading={isCreating}
                variant="primary"
                size="large"
                style={styles.createButton}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  optionChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeChip: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipText: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  typeChipSub: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  typeChipSubActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  friendlyChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  rankedChipActive: {
    backgroundColor: Colors.primary.orange,
    borderColor: Colors.primary.orange,
  },
  rankedSoonCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
    backgroundColor: Colors.primary.orange + '08',
  },
  rankedSoonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rankedSoonIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primary.orange + '25', alignItems: 'center', justifyContent: 'center' },
  rankedSoonTitle: { color: Colors.primary.orange, fontSize: 18, fontWeight: '700' as const },
  rankedSoonText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  rankedSoonBtn: { backgroundColor: Colors.primary.orange, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignSelf: 'flex-start' },
  rankedSoonBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
  rankedCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '50',
    overflow: 'hidden',
  },
  rankedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rankedBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary.orange + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankedCardTitleWrap: {
    flex: 1,
  },
  rankedCardTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rankedCardSubtitle: {
    color: Colors.primary.orange,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600' as const,
  },
  rankedDescription: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  rankedBenefits: {
    gap: 6,
  },
  rankedBenefit: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  optionText: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  venueCard: {
    marginBottom: 10,
  },
  venueCardActive: {
    borderColor: Colors.primary.blue,
    borderWidth: 2,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  venueAddress: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  venuePrice: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  createButton: {
    marginTop: 16,
  },
  // Date picker
  dateChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    minWidth: 52,
  },
  dateChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  dateDayName: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
  },
  dateDayNum: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    marginVertical: 2,
  },
  dateMonth: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  dateTextActive: {
    color: '#FFFFFF',
  },
  // Slot grid
  noSlotsText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontStyle: 'italic' as const,
    paddingVertical: 8,
  },
  slotLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  slotLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  slotLegendText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.status.success + '22',
    borderWidth: 1,
    borderColor: Colors.status.success,
    alignItems: 'center',
  },
  slotDisabled: {
    backgroundColor: Colors.background.card,
    borderColor: Colors.border.light,
  },
  slotSelected: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  slotTime: {
    color: Colors.status.success,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  slotTimeDisabled: {
    color: Colors.text.muted,
  },
  slotTimeSelected: {
    color: '#FFFFFF',
  },
  slotStatus: {
    color: Colors.status.success,
    fontSize: 10,
    marginTop: 2,
  },
  slotStatusDisabled: {
    color: Colors.text.muted,
  },
  slotStatusSelected: {
    color: '#FFFFFF',
  },
  slotSummary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary.blue + '22',
    borderWidth: 1,
    borderColor: Colors.primary.blue + '66',
  },
  slotSummaryText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  slotWarning: {
    color: Colors.status.warning ?? Colors.primary.orange,
    fontSize: 12,
    marginTop: 4,
  },
});