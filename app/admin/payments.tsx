import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle, Clock, Eye, ExternalLink, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentPaymentsApi } from '@/lib/api/tournament-payments';
import { useTeams } from '@/contexts/TeamsContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import type { TournamentPayment } from '@/types';

export default function AdminPaymentsScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/admin' as any);
  };
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { getTeamById } = useTeams();
  const { getTournamentById } = useTournaments();
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rediriger si pas admin
  if (!isAdmin) {
    router.replace('/');
    return null;
  }

  const paymentsQuery = useQuery({
    queryKey: ['pendingPayments'],
    queryFn: () => tournamentPaymentsApi.getPendingPayments(),
    refetchInterval: 30000, // Rafraîchir toutes les 30s
  });

  const approveMutation = useMutation({
    mutationFn: (paymentId: string) => tournamentPaymentsApi.approvePayment(paymentId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      Alert.alert('Succès', 'Paiement approuvé avec succès');
    },
    onError: (error) => {
      Alert.alert('Erreur', (error as Error).message || 'Impossible d\'approuver le paiement');
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      tournamentPaymentsApi.rejectPayment(paymentId, user!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      Alert.alert('Succès', 'Paiement rejeté');
    },
    onError: (error) => {
      Alert.alert('Erreur', (error as Error).message || 'Impossible de rejeter le paiement');
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await paymentsQuery.refetch();
    setRefreshing(false);
  }, [paymentsQuery]);

  const handleApprove = (payment: TournamentPayment) => {
    Alert.alert(
      'Approuver le paiement',
      `Confirmer l'approbation du paiement de ${payment.amount.toLocaleString()} FCFA ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          style: 'default',
          onPress: () => {
            setProcessingId(payment.id);
            approveMutation.mutate(payment.id);
          },
        },
      ]
    );
  };

  const handleReject = (payment: TournamentPayment) => {
    Alert.alert(
      'Rejeter le paiement',
      'Voulez-vous rejeter ce paiement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: () => {
            setProcessingId(payment.id);
            rejectMutation.mutate({ paymentId: payment.id });
          },
        },
      ]
    );
  };

  const openImage = (url: string) => {
    Linking.openURL(url);
  };

  const payments = paymentsQuery.data || [];
  const isLoading = paymentsQuery.isLoading;

  const getTimeRemaining = (deadline?: Date) => {
    if (!deadline) return null;
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return 'Expiré';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m restantes`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Validation des paiements</Text>
          <View style={styles.backButton} />
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{payments.length}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </Card>
        </View>

        {/* Liste des paiements */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <CheckCircle size={48} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Aucun paiement en attente</Text>
              <Text style={styles.emptyText}>Tous les paiements ont été traités</Text>
            </View>
          ) : (
            payments.map((payment) => {
              const team = getTeamById(payment.teamId);
              const tournament = getTournamentById(payment.tournamentId);
              const timeRemaining = getTimeRemaining(payment.paymentDeadline);
              const isExpired = timeRemaining === 'Expiré';
              const isProcessing = processingId === payment.id;

              return (
                <Card key={payment.id} style={styles.paymentCard}>
                  {/* En-tête */}
                  <View style={styles.paymentHeader}>
                    <View style={styles.paymentHeaderLeft}>
                      <Text style={styles.teamName}>{team?.name || 'Équipe inconnue'}</Text>
                      <Text style={styles.tournamentName}>{tournament?.name || 'Tournoi inconnu'}</Text>
                    </View>
                    <View style={styles.amountContainer}>
                      <Text style={styles.amount}>{payment.amount.toLocaleString()}</Text>
                      <Text style={styles.currency}>FCFA</Text>
                    </View>
                  </View>

                  {/* Méthode et deadline */}
                  <View style={styles.paymentInfo}>
                    <View style={styles.methodBadge}>
                      <Text style={styles.methodText}>
                        {payment.method === 'wave' ? 'WAVE' : 'ORANGE MONEY'}
                      </Text>
                    </View>
                    {timeRemaining && (
                      <View style={[styles.deadlineBadge, isExpired && styles.deadlineExpired]}>
                        <Clock size={12} color={isExpired ? Colors.status.error : Colors.status.warning} />
                        <Text style={[styles.deadlineText, isExpired && styles.deadlineExpiredText]}>
                          {timeRemaining}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Informations */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Expéditeur :</Text>
                      <Text style={styles.detailValue}>{payment.expectedSenderName}</Text>
                    </View>
                    {payment.transactionRef && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Référence :</Text>
                        <Text style={styles.detailValue}>{payment.transactionRef}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Soumis le :</Text>
                      <Text style={styles.detailValue}>
                        {new Date(payment.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Screenshot */}
                  {payment.screenshotUrl && (
                    <TouchableOpacity
                      style={styles.screenshotContainer}
                      onPress={() => openImage(payment.screenshotUrl!)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: payment.screenshotUrl }} style={styles.screenshot} />
                      <View style={styles.screenshotOverlay}>
                        <Eye size={20} color={Colors.text.primary} />
                        <Text style={styles.screenshotText}>Voir en grand</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Actions */}
                  <View style={styles.actionsContainer}>
                    <Button
                      title="Rejeter"
                      onPress={() => handleReject(payment)}
                      variant="outline"
                      disabled={isProcessing}
                      style={styles.rejectButton}
                      icon={<XCircle size={18} color={Colors.status.error} />}
                    />
                    <Button
                      title="Approuver"
                      onPress={() => handleApprove(payment)}
                      disabled={isProcessing}
                      loading={isProcessing}
                      style={styles.approveButton}
                      icon={<CheckCircle size={18} color={Colors.text.primary} />}
                    />
                  </View>

                  {isExpired && (
                    <View style={styles.warningBox}>
                      <AlertCircle size={14} color={Colors.status.error} />
                      <Text style={styles.warningText}>Deadline dépassée - À traiter rapidement</Text>
                    </View>
                  )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { width: 40 },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.primary.orange + '15',
    borderColor: Colors.primary.orange + '30',
  },
  statValue: {
    color: Colors.primary.orange,
    fontSize: 32,
    fontWeight: '800',
  },
  statLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 0 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: Colors.text.muted,
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    marginTop: 8,
  },
  paymentCard: {
    padding: 16,
    marginBottom: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paymentHeaderLeft: { flex: 1 },
  teamName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tournamentName: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    color: Colors.primary.orange,
    fontSize: 20,
    fontWeight: '800',
  },
  currency: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  methodBadge: {
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodText: {
    color: Colors.primary.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.status.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deadlineExpired: {
    backgroundColor: Colors.status.error + '20',
  },
  deadlineText: {
    color: Colors.status.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  deadlineExpiredText: {
    color: Colors.status.error,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
    width: 100,
  },
  detailValue: {
    color: Colors.text.primary,
    fontSize: 13,
    flex: 1,
  },
  screenshotContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  screenshot: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  screenshotOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  screenshotText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderColor: Colors.status.error,
  },
  approveButton: {
    flex: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.status.error + '15',
    borderWidth: 1,
    borderColor: Colors.status.error + '30',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  warningText: {
    color: Colors.status.error,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
