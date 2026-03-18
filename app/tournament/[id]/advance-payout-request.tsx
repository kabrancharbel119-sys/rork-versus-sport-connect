import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Clock, DollarSign, FileText, ShieldAlert } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { tournamentPayoutRequestsApi } from '@/lib/api/tournament-payments';

export default function AdvancePayoutRequestScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/tournament/${id}` as any);
  };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getTournamentById } = useTournaments();

  const tournament = getTournamentById(id || '');

  const [requestedAmount, setRequestedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [useOfFunds, setUseOfFunds] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');

  const requestsQuery = useQuery({
    queryKey: ['organizer-payout-requests', user?.id],
    queryFn: () => tournamentPayoutRequestsApi.getOrganizerRequests(user!.id),
    enabled: !!user?.id,
  });

  const requestForThisTournament = useMemo(
    () => (requestsQuery.data || []).find((req) => req.tournamentId === id),
    [requestsQuery.data, id]
  );

  const createMutation = useMutation({
    mutationFn: () => tournamentPayoutRequestsApi.createRequest({
      tournamentId: id!,
      organizerId: user!.id,
      requestedAmount: parseInt(requestedAmount, 10),
      purposeCategory: 'other',
      reason: reason.trim(),
      useOfFunds: useOfFunds.trim(),
      budgetBreakdown: useOfFunds.trim(),
      amountAlreadySpent: 0,
      urgency,
      payoutPhone: payoutPhone.trim(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizer-payout-requests', user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['pending-payout-requests'] });
      Alert.alert('Demande envoyée', 'Votre demande d’avance a été envoyée à l’administration.');
      handleBack();
    },
    onError: (error) => {
      Alert.alert('Erreur', (error as Error).message || 'Impossible d’envoyer la demande.');
    },
  });

  const canSubmit = useMemo(() => {
    const amount = parseInt(requestedAmount, 10);
    return !!(
      user
      && id
      && tournament
      && tournament.entryFee > 0
      && tournament.createdBy === user.id
      && amount > 0
      && reason.trim().length >= 20
      && useOfFunds.trim().length >= 20
      && payoutPhone.trim().length >= 8
      && !requestForThisTournament
    );
  }, [
    user,
    id,
    tournament,
    requestedAmount,
    reason,
    useOfFunds,
    payoutPhone,
    requestForThisTournament,
  ]);

  if (!user || !id || !tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Tournoi introuvable.</Text>
      </View>
    );
  }

  if (tournament.createdBy !== user.id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Seul l’organisateur du tournoi peut faire cette demande.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demande d’avance</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Card style={styles.infoCard}>
              <View style={styles.titleRow}>
                <ShieldAlert size={18} color={Colors.primary.orange} />
                <Text style={styles.cardTitle}>Rappel sécurité</Text>
              </View>
              <Text style={styles.infoText}>
                Les frais d’inscription ne sont pas reversés automatiquement à l’organisateur.
                Une avance peut être accordée uniquement après validation administrative.
              </Text>
            </Card>

            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Tournoi</Text>
              <Text style={styles.summaryValue}>{tournament.name}</Text>
              <Text style={styles.summarySub}>Entrée: {tournament.entryFee.toLocaleString()} FCFA / équipe</Text>
            </Card>

            {requestForThisTournament && (
              <Card style={styles.statusCard}>
                <View style={styles.titleRow}>
                  {requestForThisTournament.status === 'pending' ? (
                    <Clock size={16} color={Colors.status.warning} />
                  ) : requestForThisTournament.status === 'approved' ? (
                    <CheckCircle size={16} color={Colors.status.success} />
                  ) : (
                    <FileText size={16} color={Colors.status.error} />
                  )}
                  <Text style={styles.cardTitle}>Demande existante</Text>
                </View>
                <Text style={styles.infoText}>
                  Statut: {requestForThisTournament.status === 'pending' ? 'En attente' : requestForThisTournament.status === 'approved' ? 'Approuvée' : 'Refusée'}
                </Text>
                {requestForThisTournament.adminNote && (
                  <Text style={styles.adminNote}>Note admin: {requestForThisTournament.adminNote}</Text>
                )}
              </Card>
            )}

            {!requestForThisTournament && (
              <>
                <Text style={styles.label}>Montant demandé (FCFA)</Text>
                <View style={styles.inputWrap}>
                  <DollarSign size={16} color={Colors.text.muted} />
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Ex: 150000"
                    placeholderTextColor={Colors.text.muted}
                    value={requestedAmount}
                    onChangeText={(v) => setRequestedAmount(v.replace(/[^0-9]/g, ''))}
                  />
                </View>

                <Text style={styles.label}>Numéro de réception des fonds</Text>
                <TextInput
                  style={styles.inputSolo}
                  placeholder="Ex: +225 07XXXXXXXX"
                  placeholderTextColor={Colors.text.muted}
                  value={payoutPhone}
                  onChangeText={setPayoutPhone}
                />

                <Text style={styles.label}>Niveau d’urgence</Text>
                <View style={styles.chipsRow}>
                  {[
                    { key: 'low' as const, label: 'Faible' },
                    { key: 'medium' as const, label: 'Moyenne' },
                    { key: 'high' as const, label: 'Élevée' },
                  ].map((chip) => (
                    <TouchableOpacity
                      key={chip.key}
                      style={[styles.chip, urgency === chip.key && styles.chipActive]}
                      onPress={() => setUrgency(chip.key)}
                    >
                      <Text style={[styles.chipText, urgency === chip.key && styles.chipTextActive]}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Pourquoi souhaitez-vous recevoir les fonds en avance ?</Text>
                <TextInput
                  style={styles.textarea}
                  multiline
                  placeholder="Décrivez le contexte, les contraintes, et les raisons de la demande..."
                  placeholderTextColor={Colors.text.muted}
                  value={reason}
                  onChangeText={setReason}
                />

                <Text style={styles.label}>À quoi serviront précisément les fonds ?</Text>
                <TextInput
                  style={styles.textarea}
                  multiline
                  placeholder="Ex: terrain, arbitrage, communication, logistique..."
                  placeholderTextColor={Colors.text.muted}
                  value={useOfFunds}
                  onChangeText={setUseOfFunds}
                />

                <Button
                  title="Envoyer la demande"
                  onPress={() => createMutation.mutate()}
                  disabled={!canSubmit || createMutation.isPending}
                  loading={createMutation.isPending}
                  variant="orange"
                  size="large"
                  style={styles.submitBtn}
                />
                <Text style={styles.helperText}>Votre demande sera examinée par un administrateur avant toute décision.</Text>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.dark },
  mutedText: { color: Colors.text.muted, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  infoCard: { marginBottom: 12, borderColor: Colors.primary.orange + '35', backgroundColor: Colors.primary.orange + '10' },
  statusCard: { marginBottom: 12 },
  summaryCard: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const },
  infoText: { color: Colors.text.secondary, fontSize: 13, lineHeight: 19 },
  adminNote: { color: Colors.text.primary, fontSize: 12, marginTop: 8 },
  summaryLabel: { color: Colors.text.muted, fontSize: 12 },
  summaryValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, marginTop: 2 },
  summarySub: { color: Colors.primary.orange, fontSize: 12, marginTop: 4 },
  label: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, marginBottom: 8, marginTop: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, color: Colors.text.primary, fontSize: 14, paddingVertical: 12 },
  inputSolo: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, borderRadius: 12, color: Colors.text.primary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
  textarea: { minHeight: 110, textAlignVertical: 'top', backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, borderRadius: 12, color: Colors.text.primary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  chipActive: { borderColor: Colors.primary.orange, backgroundColor: Colors.primary.orange + '22' },
  chipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  chipTextActive: { color: Colors.primary.orange },
  submitBtn: { marginTop: 16 },
  helperText: { color: Colors.text.muted, fontSize: 12, marginTop: 10, textAlign: 'center' as const },
});
