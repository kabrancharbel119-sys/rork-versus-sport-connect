import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, FileText, CreditCard, Calendar, DollarSign, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { invoicesApi } from '@/lib/api/invoices';
import { useAuth } from '@/contexts/AuthContext';

const statusLabels: Record<string, string> = {
  issued: 'Émise',
  paid: 'Payée',
  refunded: 'Remboursée',
  cancelled: 'Annulée',
};

const statusColors: Record<string, string> = {
  issued: Colors.text.muted,
  paid: Colors.status.success,
  refunded: '#F59E0B',
  cancelled: '#EF4444',
};

const documentLabels: Record<string, string> = {
  invoice: 'Facture',
  credit_note: 'Avoir',
  payout_receipt: 'Reçu',
};

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(date: Date) {
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({ label, value, icon: Icon, highlight }: { label: string; value: string; icon?: any; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelContainer}>
        {Icon && <Icon size={16} color={Colors.text.secondary} />}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
    </View>
  );
}

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getInvoiceById(id!),
    enabled: !!id,
    retry: 1,
  });

  const invoice = invoiceQuery.data;
  const statusColor = invoice ? statusColors[invoice.status] ?? Colors.text.muted : Colors.text.muted;
  const isPayer = invoice?.payerId === user?.id;
  const isBeneficiary = invoice?.beneficiaryId === user?.id;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Détail de la facture</Text>
        <View style={styles.backButton} />
      </View>

      {invoiceQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary.orange} />
          <Text style={styles.loadingText}>Chargement de la facture...</Text>
        </View>
      ) : invoiceQuery.isError ? (
        <View style={styles.center}>
          <AlertCircle size={40} color={Colors.status.error} />
          <Text style={styles.errorTitle}>Impossible de charger la facture</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => invoiceQuery.refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : !invoice ? (
        <View style={styles.center}>
          <XCircle size={40} color={Colors.text.muted} />
          <Text style={styles.errorTitle}>Facture introuvable</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <FileText size={32} color={Colors.primary.orange} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                <Text style={styles.documentType}>{documentLabels[invoice.documentType] ?? invoice.documentType}</Text>
              </View>
              <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusLabels[invoice.status] ?? invoice.status}
                </Text>
              </View>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Montant</Text>
              <Text style={styles.amountValue}>{formatAmount(invoice.amount, invoice.currency)}</Text>
              {invoice.status === 'paid' && (
                <View style={styles.paidBadge}>
                  <CheckCircle size={14} color={Colors.status.success} />
                  <Text style={styles.paidText}>Réglée</Text>
                </View>
              )}
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <DetailRow label="Type" value={documentLabels[invoice.documentType] ?? invoice.documentType} icon={FileText} />
              <DetailRow label="Contexte" value={`${invoice.contextType} (${invoice.contextId.slice(0, 8)})`} icon={CreditCard} />
              <DetailRow label="Description" value={invoice.description} icon={Calendar} />
              <DetailRow label="Date d'émission" value={formatDate(invoice.issuedAt)} icon={Calendar} />
              {invoice.paidAt && (
                <DetailRow label="Date de paiement" value={formatDateTime(invoice.paidAt)} icon={CheckCircle} />
              )}
              <DetailRow label="Méthode de paiement" value={invoice.paymentMethod?.toUpperCase() ?? 'Non renseignée'} icon={DollarSign} />
              {invoice.paymentTransactionId && (
                <DetailRow label="Transaction" value={invoice.paymentTransactionId} icon={CreditCard} />
              )}
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Parties</Text>
              <DetailRow label="Payeur" value={isPayer ? 'Vous' : invoice.payerId ? `ID ${invoice.payerId.slice(0, 8)}` : 'Non renseigné'} icon={User} />
              <DetailRow label="Bénéficiaire" value={isBeneficiary ? 'Vous' : invoice.beneficiaryId ? `ID ${invoice.beneficiaryId.slice(0, 8)}` : 'Non renseigné'} icon={User} />
            </View>

            {invoice.metadata && Object.keys(invoice.metadata).length > 0 && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Métadonnées</Text>
                {Object.entries(invoice.metadata).map(([key, value]) => (
                  <DetailRow key={key} label={key} value={String(value)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: Colors.text.secondary,
    marginTop: 16,
    fontSize: 14,
  },
  errorTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 10,
  },
  retryText: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  invoiceNumber: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  documentType: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountBox: {
    backgroundColor: Colors.background.cardLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  amountLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    color: Colors.text.primary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.status.success}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paidText: {
    color: Colors.status.success,
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: 16,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  detailLabel: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  detailValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  detailValueHighlight: {
    color: Colors.primary.orange,
    fontWeight: '700',
  },
});
