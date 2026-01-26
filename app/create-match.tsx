import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Swords, MapPin, Calendar, Clock, Trophy } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sport, SkillLevel, PlayStyle } from '@/types';
import { sportLabels, levelLabels, ambianceLabels } from '@/mocks/data';

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
  const { user } = useAuth();
  const { createMatch, venues, isCreating } = useMatches();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);

  const [formData, setFormData] = useState({
    sport: 'football' as Sport,
    format: '5v5',
    type: 'friendly' as 'friendly' | 'ranked',
    level: 'intermediate' as SkillLevel,
    ambiance: 'mixed' as PlayStyle,
    venueId: '',
    date: tomorrow.toISOString().split('T')[0],
    time: '15:00',
    duration: '90',
    maxPlayers: '10',
  });

  const selectedVenue = venues.find(v => v.id === formData.venueId);

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!validate()) return;
    const effectiveType = formData.type === 'ranked' ? 'friendly' : formData.type;
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
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
      router.back();
    } catch (error: any) {
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
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Créer un match</Text>
            <View style={styles.placeholder} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
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
                      {type === 'ranked' && (
                        <Text style={[styles.typeChipSub, formData.type === type && styles.typeChipSubActive]}>
                          Bientôt
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {formData.type === 'ranked' && (
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
                {venues.map((venue) => (
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

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Input
                    label="Date"
                    placeholder="2026-01-25"
                    value={formData.date}
                    onChangeText={(v) => updateField('date', v)}
                    icon={<Calendar size={20} color={Colors.text.muted} />}
                  />
                </View>
                <View style={styles.halfField}>
                  <Input
                    label="Heure"
                    placeholder="15:00"
                    value={formData.time}
                    onChangeText={(v) => updateField('time', v)}
                    icon={<Clock size={20} color={Colors.text.muted} />}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Input
                    label="Durée (min)"
                    placeholder="90"
                    value={formData.duration}
                    onChangeText={(v) => updateField('duration', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <Input
                    label="Max joueurs"
                    placeholder="10"
                    value={formData.maxPlayers}
                    onChangeText={(v) => updateField('maxPlayers', v)}
                    keyboardType="numeric"
                  />
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
});