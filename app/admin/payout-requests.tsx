import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Clock3, FileText, Shield, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useUsers } from '@/contexts/UsersContext';
import { tournamentPayoutRequestsApi } from '@/lib/api/tournament-payments';
import type { TournamentPayoutRequest } from '@/types';

const purposeLabels: Record<TournamentPayoutRequest['purposeCategory'], string> = {
  venue: 'Terrain',
  referees: 'Arbitres',
  logistics: 'Logistique',
  communication: 'Communication',
  prize: 'Cagnotte',
  other: 'Autre',
};

export default function AdminPayoutRequestsScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/admin' as any);
  };
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { getTournamentById } = useTournaments();
  const { getUserById } = useUsers();
  const [refreshing, setRefreshing] = useState(false);
  const [noteByRequestId, setNoteByRequestId] = useState<Record<string, string>>({});

  const requestsQuery = useQuery({
    queryKey: ['pending-payout-requests'],
    queryFn: () => tournamentPayoutRequestsApi.getPendingRequests(),
    refetchInterval: 30000,
    enabled: !!isAdmin,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestsQuery.refetch();
    setRefreshing(false);
  }, [requestsQuery]);

  const approveMutation = useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note?: string }) =>
      tournamentPayoutRequestsApi.approveRequest(requestId, user!.id, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-payout-requests'] });
      Alert.alert('Succès', 'Demande approuvée.');
    },
    onError: (e) => Alert.alert('Erreur', (e as Error).message || 'Impossible d’approuver la demande.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note?: string }) =>
      tournamentPayoutRequestsApi.rejectRequest(requestId, user!.id, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-payout-requests'] });
      Alert.alert('Succès', 'Demande rejetée.');
    },
    onError: (e) => Alert.alert('Erreur', (e as Error).message || 'Impossible de rejeter la demande.'),
  });

  const requests = requestsQuery.data || [];
  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const handleApprove = (request: TournamentPayoutRequest) => {
    Alert.alert('Approuver la demande', 'Confirmer l’approbation de cette demande d’avance ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver',
        onPress: () => approveMutation.mutate({ requestId: request.id, note: noteByRequestId[request.id]?.trim() || undefined }),
      },
    ]);
  };

  const handleReject = (request: TournamentPayoutRequest) => {
    Alert.alert('Rejeter la demande', 'Confirmer le rejet de cette demande ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Rejeter',
        style: 'destructive',
        onPress: () => rejectMutation.mutate({ requestId: request.id, note: noteByRequestId[request.id]?.trim() || undefined }),
      },
    ]);
  };

  if (!isAdmin) {
    router.replace('/' as any);
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <ArrowLeft size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demandes d’avance</Text>
          <View style={styles.headerBtn} />
        </View>

        <Card style={styles.statsCard}>
          <View style={styles.rowCenter}>
            <Clock3 size={18} color={Colors.primary.orange} />
            <Text style={styles.statsTitle}>En attente de validation</Text>
          </View>
          <Text style={styles.statsValue}>{pendingCount}</Text>
        </Card>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle size={46} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Aucune demande en attente</Text>
              <Text style={styles.emptyText}>Les nouvelles demandes des organisateurs apparaîtront ici.</Text>
            </View>
          ) : (
            requests.map((request) => {
              const tournament = getTournamentById(request.tournamentId);
              const organizer = getUserById(request.organizerId);
              const isBusy = approveMutation.isPending || rejectMutation.isPending;

              return (
                <Card key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tournamentName}>{tournament?.name || 'Tournoi inconnu'}</Text>
                      <Text style={styles.organizerText}>Organisateur: {organizer?.fullName || request.organizerId}</Text>
                    </View>
                    <View style={styles.amountBadge}>
                      <Text style={styles.amountText}>{request.requestedAmount.toLocaleString()} FCFA</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Shield size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>Urgence: {request.urgency === 'high' ? 'Élevée' : request.urgency === 'medium' ? 'Moyenne' : 'Faible'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <FileText size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>Catégorie: {purposeLabels[request.purposeCategory] ?? 'Autre'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <FileText size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>Téléphone de versement: {request.payoutPhone}</Text>
                  </View>
                  {request.fallbackContact ? (
                    <View style={styles.metaRow}>
                      <FileText size={13} color={Colors.text.muted} />
                      <Text style={styles.metaText}>Contact alternatif: {request.fallbackContact}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaRow}>
                    <FileText size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>Montant déjà engagé: {request.amountAlreadySpent.toLocaleString()} FCFA</Text>
                  </View>
                  {request.neededBy ? (
                    <View style={styles.metaRow}>
                      <FileText size={13} color={Colors.text.muted} />
                      <Text style={styles.metaText}>Besoin des fonds avant le: {new Date(request.neededBy).toLocaleDateString('fr-FR')}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.sectionLabel}>Motif</Text>
                  <Text style={styles.paragraph}>{request.reason}</Text>

                  <Text style={styles.sectionLabel}>Utilisation des fonds</Text>
                  <Text style={styles.paragraph}>{request.useOfFunds}</Text>

                  <Text style={styles.sectionLabel}>Détail du budget</Text>
                  <Text style={styles.paragraph}>{request.budgetBreakdown}</Text>

                  {request.supportingEvidence ? (
                    <>
                      <Text style={styles.sectionLabel}>Pièce / lien de justification</Text>
                      <Text style={styles.paragraph}>{request.supportingEvidence}</Text>
                    </>
                  ) : null}

                  <TextInput
                    style={styles.noteInput}
                    placeholder="Note admin (optionnel)"
                    placeholderTextColor={Colors.text.muted}
                    value={noteByRequestId[request.id] || ''}
                    onChangeText={(v) => setNoteByRequestId((prev) => ({ ...prev, [request.id]: v }))}
                    multiline
                  />

                  <View style={styles.actionsRow}>
                    <Button
                      title="Rejeter"
                      variant="outline"
                      style={styles.rejectBtn}
                      onPress={() => handleReject(request)}
                      disabled={isBusy}
                      icon={<XCircle size={16} color={Colors.status.error} />}
                    />
                    <Button
                      title="Approuver"
                      variant="orange"
                      style={styles.approveBtn}
                      onPress={() => handleApprove(request)}
                      disabled={isBusy}
                      loading={isBusy}
                      icon={<CheckCircle size={16} color="#fff" />}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const },
  statsCard: { marginHorizontal: 16, marginBottom: 12, borderColor: Colors.primary.orange + '35', backgroundColor: Colors.primary.orange + '10' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  statsValue: { color: Colors.primary.orange, fontSize: 28, fontWeight: '800' as const, marginTop: 4 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  emptyTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const, marginTop: 12 },
  emptyText: { color: Colors.text.muted, fontSize: 13, marginTop: 6, textAlign: 'center' as const },
  requestCard: { marginBottom: 12 },
  requestHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tournamentName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const },
  organizerText: { color: Colors.text.muted, fontSize: 12, marginTop: 3 },
  amountBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary.orange + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  amountText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700' as const },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText: { color: Colors.text.secondary, fontSize: 12 },
  sectionLabel: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
  paragraph: { color: Colors.text.secondary, fontSize: 13, lineHeight: 19 },
  noteInput: {
    minHeight: 72,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.card,
    color: Colors.text.primary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  rejectBtn: { flex: 1, borderColor: Colors.status.error },
  approveBtn: { flex: 1.5 },
});
