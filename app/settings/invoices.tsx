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
import { FileText, ChevronLeft, AlertCircle, CreditCard, RefreshCcw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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

export default function UserInvoicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ['payerInvoices', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return invoicesApi.getPayerInvoices(user.id);
    },
    enabled: !!user?.id,
    retry: 1,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['payerInvoices', user?.id] });
    setRefreshing(false);
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const statusColor = statusColors[item.status] ?? Colors.text.muted;
    return (
      <TouchableOpacity activeOpacity={0.8} style={styles.card} onPress={() => router.push(`/invoice/${item.id}` as any)}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <FileText size={20} color={Colors.primary.blue} />
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
            <Text style={styles.rowText}>Payé : {formatAmount(item.amount, item.currency)}</Text>
          </View>
          <View style={styles.row}>
            <RefreshCcw size={14} color={Colors.text.secondary} />
            <Text style={styles.rowText}>{formatDate(item.issuedAt)}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const invoices = invoicesQuery.data || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Mes factures</Text>
          <Text style={styles.subtitle}>Uniquement les factures de vos réservations</Text>
        </View>
      </View>

      {invoicesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary.blue} />
          <Text style={styles.loadingText}>Chargement des factures...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <FileText size={40} color={Colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>Aucune facture</Text>
          <Text style={styles.emptyText}>
            Les factures de vos réservations apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
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
    color: Colors.primary.blue,
    fontSize: 13,
    fontWeight: '600',
  },
});
