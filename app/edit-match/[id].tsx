import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Swords, MapPin, Calendar, Clock } from 'lucide-react-native';
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

export default function EditMatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getMatchById, updateMatch, isUpdating, venues } = useMatches();

  const match = getMatchById(id || '');
  const scrollViewRef = useRef<ScrollView>(null);

  const [formData, setFormData] = useState({
    sport: 'football' as Sport,
    format: '5v5',
    type: 'friendly' as 'friendly' | 'ranked',
    level: 'intermediate' as SkillLevel,
    ambiance: 'mixed' as PlayStyle,
    venueId: '',
    date: '',
    time: '15:00',
    duration: '90',
    maxPlayers: '10',
    entryFee: '',
    prize: '',
  });

  useEffect(() => {
    if (match) {
      const dateTime = new Date(match.dateTime);
      setFormData({
        sport: match.sport,
        format: match.format,
        type: match.type === 'tournament' ? 'friendly' : match.type,
        level: match.level,
        ambiance: match.ambiance,
        venueId: match.venue.id,
        date: dateTime.toISOString().split('T')[0],
        time: dateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        duration: match.duration.toString(),
        maxPlayers: match.maxPlayers.toString(),
        entryFee: match.entryFee?.toString() || '',
        prize: match.prize?.toString() || '',
      });
    }
  }, [match]);

  if (!match) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Match non trouvé</Text>
            <Button title="Retour" onPress={() => safeBack(router, '/(tabs)/matches')} variant="outline" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (match.createdBy !== user?.id) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Vous n'êtes pas autorisé à modifier ce match</Text>
            <Button title="Retour" onPress={() => safeBack(router, '/(tabs)/matches')} variant="outline" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const selectedVenue = venues.find(v => v.id === formData.venueId) || match.venue;

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      await updateMatch({
        matchId: match.id,
        updates: {
          sport: formData.sport,
          format: formData.format,
          type: formData.type,
          venue: selectedVenue,
          dateTime,
          duration: parseInt(formData.duration, 10),
          level: formData.level,
          ambiance: formData.ambiance,
          maxPlayers: parseInt(formData.maxPlayers, 10),
          entryFee: formData.entryFee ? parseInt(formData.entryFee, 10) : undefined,
          prize: formData.prize ? parseInt(formData.prize, 10) : undefined,
        },
      });
      Alert.alert('Succès', 'Match mis à jour !', [{ text: 'OK', onPress: () => safeBack(router, '/(tabs)/matches') }]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de modifier le match');
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
            <Text style={styles.headerTitle}>Modifier le match</Text>
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
                <View style={styles.optionRow}>
                  {matchTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        formData.type === type && (type === 'ranked' ? styles.rankedChipActive : styles.friendlyChipActive),
                      ]}
                      onPress={() => updateField('type', type)}
                    >
                      <Text style={[styles.optionText, formData.type === type && styles.optionTextActive]}>
                        {type === 'friendly' ? '⚽ Amical' : '🏆 Classé'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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
                    scrollViewRef={scrollViewRef}
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
                    scrollViewRef={scrollViewRef}
                    label="Max joueurs"
                    placeholder="10"
                    value={formData.maxPlayers}
                    onChangeText={(v) => updateField('maxPlayers', v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {formData.type === 'ranked' && (
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Input
                      label="Mise (FCFA)"
                      placeholder="5000"
                      value={formData.entryFee}
                      onChangeText={(v) => updateField('entryFee', v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Input
                      scrollViewRef={scrollViewRef}
                      label="Prize (FCFA)"
                      placeholder="50000"
                      value={formData.prize}
                      onChangeText={(v) => updateField('prize', v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              <Button
                title="Enregistrer les modifications"
                onPress={handleSave}
                loading={isUpdating}
                variant="primary"
                size="large"
                style={styles.saveButton}
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: Colors.text.primary,
    fontSize: 18,
    textAlign: 'center',
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
  typeChip: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: 'center',
  },
  friendlyChipActive: {
    backgroundColor: Colors.primary.blue,
    borderColor: Colors.primary.blue,
  },
  rankedChipActive: {
    backgroundColor: Colors.primary.orange,
    borderColor: Colors.primary.orange,
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
  saveButton: {
    marginTop: 16,
  },
});
