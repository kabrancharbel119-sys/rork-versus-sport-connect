import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { tournamentsApi } from '@/lib/api/tournaments';
import type { Tournament } from '@/types';

export default function EditTournamentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { getTournamentById, updateTournament, refetchTournaments } = useTournaments();
  const fromContext = getTournamentById(id || '');
  const [fetched, setFetched] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(!!id && !fromContext);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [status, setStatus] = useState<Tournament['status']>('registration');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const tournament = fromContext ?? fetched;

  useEffect(() => {
    if (id && !fromContext) {
      setLoading(true);
      tournamentsApi
        .getById(id)
        .then((t) => {
          setFetched(t);
          setName(t.name);
          setDescription(t.description || '');
          setEntryFee(String(t.entryFee ?? 0));
          setPrizePool(String(t.prizePool ?? 0));
          setStatus(t.status);
          setStartDateStr(t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '');
          setEndDateStr(t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : '');
        })
        .catch(() => setFetched(null))
        .finally(() => setLoading(false));
    } else if (fromContext) {
      setName(fromContext.name);
      setDescription(fromContext.description || '');
      setEntryFee(String(fromContext.entryFee ?? 0));
      setPrizePool(String(fromContext.prizePool ?? 0));
      setStatus(fromContext.status);
      setStartDateStr(fromContext.startDate ? new Date(fromContext.startDate).toISOString().split('T')[0] : '');
      setEndDateStr(fromContext.endDate ? new Date(fromContext.endDate).toISOString().split('T')[0] : '');
    }
  }, [id, fromContext]);

  const canEdit = user && tournament && (tournament.createdBy === user.id || isAdmin);

  const handleSave = async () => {
    if (!tournament || !canEdit) return;
    const nameTrim = name.trim();
    if (nameTrim.length < 3) {
      Alert.alert('Erreur', 'Le nom doit faire au moins 3 caractères.');
      return;
    }
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;
    if (startDate && isNaN(startDate.getTime())) {
      Alert.alert('Erreur', 'Date de début invalide. Format : AAAA-MM-JJ');
      return;
    }
    if (endDate && isNaN(endDate.getTime())) {
      Alert.alert('Erreur', 'Date de fin invalide. Format : AAAA-MM-JJ');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      return;
    }
    setSaving(true);
    try {
      await updateTournament({
        tournamentId: tournament.id,
        updates: {
          name: nameTrim,
          description: description.trim(),
          entryFee: parseInt(entryFee, 10) || 0,
          prizePool: parseInt(prizePool, 10) || 0,
          status,
          ...(startDate && !isNaN(startDate.getTime()) && { startDate }),
          ...(endDate && !isNaN(endDate.getTime()) && { endDate }),
        },
      });
      await refetchTournaments();
      Alert.alert('Succès', 'Tournoi mis à jour.', [{ text: 'OK', onPress: () => safeBack(router, '/tournaments') }]);
    } catch (e: unknown) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !tournament) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/tournaments')}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifier le tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  if (!tournament || !canEdit) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/tournaments')}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Modifier le tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>Tournoi introuvable ou accès refusé.</Text>
              <Button title="Retour" onPress={() => safeBack(router, '/tournaments')} variant="primary" />
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
            <TouchableOpacity style={styles.closeButton} onPress={() => safeBack(router, '/tournaments')}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Modifier le tournoi</Text>
            <View style={styles.placeholder} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 320 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Input label="Nom du tournoi" value={name} onChangeText={setName} placeholder="Nom" maxLength={50} />
              <Input
                scrollViewRef={scrollViewRef}
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date de début (AAAA-MM-JJ)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={startDateStr}
                  onChangeText={setStartDateStr}
                  placeholder="2026-02-15"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date de fin (AAAA-MM-JJ)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={endDateStr}
                  onChangeText={setEndDateStr}
                  placeholder="2026-02-22"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <Input
                label="Frais d'inscription (FCFA)"
                value={entryFee}
                onChangeText={(v) => setEntryFee(v.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
              />
              <Input
                scrollViewRef={scrollViewRef}
                label="Cagnotte (FCFA)"
                value={prizePool}
                onChangeText={(v) => setPrizePool(v.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
              />
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Statut</Text>
                <View style={styles.statusRow}>
                  {(['registration', 'in_progress', 'completed'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusChip, status === s && styles.statusChipActive]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>
                        {s === 'registration' ? 'Inscriptions' : s === 'in_progress' ? 'En cours' : 'Terminé'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Button title="Enregistrer" onPress={handleSave} loading={saving} variant="orange" size="large" style={styles.saveBtn} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  loadingText: { color: Colors.text.secondary, fontSize: 15 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, alignItems: 'center' },
  statusChipActive: { backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange },
  statusChipText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  statusChipTextActive: { color: '#FFFFFF' },
  dateInput: { backgroundColor: Colors.background.card, borderRadius: 10, padding: 14, color: Colors.text.primary, fontSize: 15, borderWidth: 1, borderColor: Colors.border.light },
  saveBtn: { marginTop: 24 },
});
