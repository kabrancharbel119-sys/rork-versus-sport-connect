import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, ChevronRight, AlertCircle, CreditCard, RefreshCcw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice } from '@/types';

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

const contextLabels: Record<string, string> = {
  booking: 'Réservation de terrain',
  tournament_registration: 'Inscription tournoi',
  venue_advance: 'Avance terrain',
  logistics_advance: 'Avance logistique',
  organizer_release: 'Versement organisateur',
};

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ManagerInvoicesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ['userInvoices', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return invoicesApi.getUserInvoices(user.id);
    },
    enabled: !!user?.id,
    retry: 1,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['userInvoices', user?.id] });
    setRefreshing(false);
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const statusColor = statusColors[item.status] ?? Colors.text.muted;
    const isBeneficiary = item.beneficiaryId === user?.id;
    return (
      <TouchableOpacity activeOpacity={0.8} style={styles.card} onPress={() => router.push(`/invoice/${item.id}` as any)}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <FileText size={20} color={Colors.primary.orange} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
            <Text style={styles.documentType}>{documentLabels[item.documentType] ?? item.documentType}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabels[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <CreditCard size={14} color={Colors.text.secondary} />
            <Text style={styles.rowText}>
              {isBeneficiary ? 'Encaissé' : 'Payé'} : {formatAmount(item.amount, item.currency)}
            </Text>
          </View>
          <View style={styles.row}>
            <RefreshCcw size={14} color={Colors.text.secondary} />
            <Text style={styles.rowText}>{formatDate(item.issuedAt)}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.contextText}>{contextLabels[item.contextType] ?? item.contextType}</Text>
          <ChevronRight size={16} color={Colors.text.muted} />
        </View>
      </TouchableOpacity>
    );
  };

  const invoices = invoicesQuery.data || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Factures</Text>
        <Text style={styles.subtitle}>Historique de vos factures, reçus et avoirs</Text>
      </View>

      {invoicesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary.orange} />
          <Text style={styles.loadingText}>Chargement des factures...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <FileText size={40} color={Colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Aucune facture</Text>
          <Text style={styles.emptyText}>
            Les factures apparaîtront ici une fois les paiements traités.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />
          }
        />
      )}

      {invoicesQuery.isError && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={Colors.status.error} />
          <Text style={styles.errorText}>Impossible de charger les factures.</Text>
          <TouchableOpacity onPress={() => invoicesQuery.refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
    paddingTop: 12,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: Colors.text.secondary,
    marginTop: 12,
    fontSize: 14,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  invoiceNumber: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  documentType: {
    color: Colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    color: Colors.text.primary,
    fontSize: 14,
  },
  description: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: 12,
  },
  contextText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background.cardLight,
    padding: 14,
    margin: 16,
    borderRadius: 12,
  },
  errorText: {
    color: Colors.text.secondary,
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600',
  },
});
