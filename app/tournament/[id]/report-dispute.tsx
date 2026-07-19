import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useTeams } from '@/contexts/TeamsContext';
import { tournamentDisputesApi } from '@/lib/api/tournament-funds';

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  investigating: 'En cours d\'examen',
  resolved: 'Résolu',
};

export default function ReportDisputeScreen() {
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
  const { getUserTeams } = useTeams();

  const tournament = getTournamentById(id || '');

  const [severity, setSeverity] = useState<'minor' | 'major'>('minor');
  const [reason, setReason] = useState('');

  const isCaptainOfRegisteredTeam = useMemo(() => {
    if (!user || !tournament) return false;
    const myTeams = getUserTeams(user.id).filter((t) => t.captainId === user.id);
    return myTeams.some((t) => (tournament.registeredTeams || []).includes(t.id));
  }, [user, tournament, getUserTeams]);

  const disputesQuery = useQuery({
    queryKey: ['tournament-disputes', id],
    queryFn: () => tournamentDisputesApi.getTournamentDisputes(id!),
    enabled: !!id,
  });

  const myDisputes = useMemo(
    () => (disputesQuery.data || []).filter((d) => d.reportedBy === user?.id),
    [disputesQuery.data, user?.id]
  );

  const createMutation = useMutation({
    mutationFn: () => tournamentDisputesApi.createDispute({
      tournamentId: id!,
      reportedBy: user!.id,
      severity,
      reason: reason.trim(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tournament-disputes', id] });
      Alert.alert('Litige signalé', 'Votre signalement a été transmis à l\'administration.');
      setReason('');
    },
    onError: (error) => {
      Alert.alert('Erreur', (error as Error).message || 'Impossible d\'envoyer le signalement.');
    },
  });

  const canSubmit = !!(user && id && tournament && isCaptainOfRegisteredTeam && reason.trim().length >= 20);

  if (!user || !id || !tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Tournoi introuvable.</Text>
      </View>
    );
  }

  if (!isCaptainOfRegisteredTeam) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Seul le capitaine d'une équipe inscrite à ce tournoi peut signaler un litige.</Text>
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
          <Text style={styles.headerTitle}>Signaler un litige</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Card style={styles.infoCard}>
              <View style={styles.titleRow}>
                <ShieldAlert size={18} color={Colors.primary.orange} />
                <Text style={styles.cardTitle}>Avant de signaler</Text>
              </View>
              <Text style={styles.infoText}>
                Un litige majeur bloque la libération des fonds de l'organisateur jusqu'à sa résolution par un administrateur.
                Utilisez cette option uniquement en cas de problème réel (fraude, non-respect des règles, absence de terrain, etc.).
              </Text>
            </Card>

            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Tournoi</Text>
              <Text style={styles.summaryValue}>{tournament.name}</Text>
            </Card>

            {myDisputes.length > 0 && (
              <>
                <Text style={styles.label}>Vos signalements précédents</Text>
                {myDisputes.map((d) => (
                  <Card key={d.id} style={styles.statusCard}>
                    <View style={styles.titleRow}>
                      {d.status === 'open' ? (
                        <Clock size={16} color={Colors.status.warning} />
                      ) : d.status === 'resolved' ? (
                        <CheckCircle size={16} color={Colors.status.success} />
                      ) : (
                        <AlertTriangle size={16} color={Colors.status.error} />
                      )}
                      <Text style={styles.cardTitle}>Statut: {statusLabels[d.status]}</Text>
                    </View>
                    <Text style={styles.infoText}>{d.reason}</Text>
                    {d.resolutionNote && (
                      <Text style={styles.adminNote}>Résolution: {d.resolutionNote}</Text>
                    )}
                  </Card>
                ))}
              </>
            )}

            <Text style={styles.label}>Niveau de gravité</Text>
            <View style={styles.chipsRow}>
              {[
                { key: 'minor' as const, label: 'Mineur' },
                { key: 'major' as const, label: 'Majeur' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, severity === chip.key && styles.chipActive]}
                  onPress={() => setSeverity(chip.key)}
                >
                  <Text style={[styles.chipText, severity === chip.key && styles.chipTextActive]}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {severity === 'major' && (
              <Card style={[styles.infoCard, { borderColor: Colors.status.error + '35', backgroundColor: Colors.status.error + '10' }]}>
                <Text style={[styles.infoText, { color: Colors.status.error }]}>
                  Un litige majeur bloquera la libération des fonds pour ce tournoi jusqu'à résolution par un administrateur.
                </Text>
              </Card>
            )}

            <Text style={styles.label}>Décrivez le problème (minimum 20 caractères)</Text>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Décrivez précisément le problème rencontré..."
              placeholderTextColor={Colors.text.muted}
              value={reason}
              onChangeText={setReason}
            />

            <Button
              title="Envoyer le signalement"
              onPress={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              loading={createMutation.isPending}
              variant="orange"
              size="large"
              style={styles.submitBtn}
            />
            <Text style={styles.helperText}>Votre signalement sera examiné par un administrateur.</Text>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background.dark, padding: 24 },
  mutedText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  infoCard: { marginBottom: 12, borderColor: Colors.primary.orange + '35', backgroundColor: Colors.primary.orange + '10' },
  statusCard: { marginBottom: 10 },
  summaryCard: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const },
  infoText: { color: Colors.text.secondary, fontSize: 13, lineHeight: 19 },
  adminNote: { color: Colors.text.primary, fontSize: 12, marginTop: 8 },
  summaryLabel: { color: Colors.text.muted, fontSize: 12 },
  summaryValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, marginTop: 2 },
  label: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, marginBottom: 8, marginTop: 8 },
  textarea: { minHeight: 130, textAlignVertical: 'top', backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light, borderRadius: 12, color: Colors.text.primary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  chipActive: { borderColor: Colors.status.error, backgroundColor: Colors.status.error + '22' },
  chipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  chipTextActive: { color: Colors.status.error },
  submitBtn: { marginTop: 16 },
  helperText: { color: Colors.text.muted, fontSize: 12, marginTop: 10, textAlign: 'center' as const },
});
