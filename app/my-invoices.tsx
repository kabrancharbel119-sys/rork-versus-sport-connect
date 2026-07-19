import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Receipt as ReceiptIcon, DollarSign, FileText, X, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/Card';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice } from '@/types';

const APP_NAME = 'Versus Sport Connect';
const APP_EMAIL = 'support@versus-sport-connect.com';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' a ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatAmount(amount: number, currency: string): string {
  return amount.toLocaleString('fr-FR') + ' ' + (currency === 'XOF' ? 'FCFA' : currency);
}

function getPaymentMethodLabel(method?: string): string {
  if (!method) return 'Paiement dans l\'application';
  const m = method.toLowerCase();
  if (m === 'in_app' || m === 'in-app') return 'Paiement dans l\'application';
  if (m === 'stripe') return 'Carte de credit (In-App)';
  if (m === 'wave') return 'Wave';
  if (m === 'orange') return 'Orange Money';
  if (m === 'geniuspay') return 'GeniusPay';
  return method;
}

function getStatusLabel(status: string): string {
  if (status === 'paid') return 'PAYE';
  if (status === 'issued') return 'EMISE';
  if (status === 'refunded') return 'REMBOURSEE';
  return status.toUpperCase();
}

function getStatusColor(status: string): string {
  if (status === 'paid') return Colors.status.success;
  if (status === 'issued') return Colors.status.warning;
  if (status === 'refunded') return Colors.status.error;
  return Colors.text.muted;
}

function getTypeLabel(contextType: string): string {
  if (contextType === 'booking') return 'Reservation de terrain';
  if (contextType === 'tournament_registration') return 'Inscription tournoi';
  return 'Paiement';
}

function getDocTitle(docType: string, status: string): string {
  if (status === 'paid') return 'Recu de paiement';
  if (docType === 'credit_note') return 'Avoir';
  return 'Facture';
}

export default function MyInvoicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ['my-invoices', user?.id],
    queryFn: () => invoicesApi.getUserInvoices(user!.id),
    enabled: !!user,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await invoicesQuery.refetch();
    setRefreshing(false);
  }, [invoicesQuery]);

  const filteredInvoices = useMemo(() => {
    const list = invoicesQuery.data || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      getTypeLabel(inv.contextType).toLowerCase().includes(q)
    );
  }, [invoicesQuery.data, search]);

  const totalPaid = useMemo(() => {
    return (invoicesQuery.data || []).filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  }, [invoicesQuery.data]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes Factures</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <ReceiptIcon size={20} color={Colors.primary.orange} />
                  <Text style={styles.summaryValue}>{invoicesQuery.data?.length ?? 0}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.summaryItem}>
                  <DollarSign size={20} color={Colors.status.success} />
                  <Text style={styles.summaryValue}>{totalPaid.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.summaryLabel}>FCFA payes</Text>
                </View>
              </View>
            </Card>

            <View style={styles.searchRow}>
              <Search size={16} color={Colors.text.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher une facture..."
                placeholderTextColor={Colors.text.muted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {invoicesQuery.isLoading && <Text style={styles.loadingText}>Chargement...</Text>}
            {invoicesQuery.error && <Text style={styles.errorText}>Erreur: {(invoicesQuery.error as Error).message}</Text>}

            {filteredInvoices.map((inv) => {
              const statusColor = getStatusColor(inv.status);
              const statusLabel = getStatusLabel(inv.status);
              const typeLabel = getTypeLabel(inv.contextType);

              return (
                <TouchableOpacity key={inv.id} onPress={() => setSelectedInvoice(inv)} activeOpacity={0.7}>
                  <Card style={styles.invoiceCard}>
                    <View style={styles.invoiceHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invoiceNumber}>{inv.invoiceNumber}</Text>
                        <Text style={styles.invoiceReason}>{typeLabel}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.invoiceFooter}>
                      <Text style={styles.dateText}>{inv.paidAt ? formatDate(inv.paidAt) : formatDate(inv.issuedAt)}</Text>
                      <Text style={styles.amountText}>{formatAmount(inv.amount, inv.currency)}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}

            {filteredInvoices.length === 0 && !invoicesQuery.isLoading && (
              <Card style={styles.emptyCard}>
                <FileText size={48} color={Colors.text.muted} />
                <Text style={styles.emptyText}>Aucune facture trouvee.</Text>
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* ====== MODAL DETAIL FACTURE ====== */}
      <Modal
        visible={selectedInvoice !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={styles.modalSafeArea}>
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedInvoice(null)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Detail</Text>
                <View style={styles.placeholder} />
              </View>

              {selectedInvoice && (() => {
                const inv = selectedInvoice;
                const docTitle = getDocTitle(inv.documentType, inv.status);
                const statusColor = getStatusColor(inv.status);
                const statusLabel = getStatusLabel(inv.status);
                const payerName = inv.payerName || 'Utilisateur';
                const teamName = inv.metadata?.team_name || null;
                const payeeName = inv.payeeName || 'Organisateur';
                const eventName = inv.eventName || inv.metadata?.venue_name || null;
                const serviceDesc = inv.contextType === 'booking'
                  ? 'Reservation de terrain' + (eventName ? ' - ' + eventName : '')
                  : inv.contextType === 'tournament_registration'
                  ? 'Inscription au tournoi' + (eventName ? ' - ' + eventName : '')
                  : inv.description;
                const paymentMethod = getPaymentMethodLabel(inv.paymentMethod);

                return (
                  <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    {/* En-tete */}
                    <View style={styles.docHeader}>
                      <Text style={styles.docTitle}>{docTitle}</Text>
                      <Text style={styles.docNumber}>N deg {inv.invoiceNumber}</Text>
                      <View style={[styles.docStatusBadge, { backgroundColor: statusColor + '20' }]}>
                        {inv.status === 'paid' && <CheckCircle size={14} color={statusColor} />}
                        <Text style={[styles.docStatusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                    </View>

                    {/* Plateforme */}
                    <Card style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Emis par</Text>
                      <Text style={styles.orgName}>{APP_NAME}</Text>
                      <Text style={styles.orgInfo}>{APP_EMAIL}</Text>
                    </Card>

                    {/* Parties */}
                    <View style={styles.partiesRow}>
                      <Card style={styles.partyCard}>
                        <Text style={styles.sectionTitle}>Facture a</Text>
                        <Text style={styles.partyName}>{payerName}</Text>
                        {teamName && <Text style={styles.partySub}>Equipe: {teamName}</Text>}
                      </Card>
                      <Card style={styles.partyCard}>
                        <Text style={styles.sectionTitle}>Fournisseur</Text>
                        <Text style={styles.partyName}>{payeeName}</Text>
                        {eventName && <Text style={styles.partySub} numberOfLines={1}>{eventName}</Text>}
                      </Card>
                    </View>

                    {/* Details du service */}
                    <Card style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Details du service</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Description</Text>
                        <Text style={styles.detailVal}>{serviceDesc}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Date d'emission</Text>
                        <Text style={styles.detailVal}>{formatDate(inv.issuedAt)}</Text>
                      </View>
                      {inv.paidAt && (
                        <>
                          <View style={styles.divider} />
                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Date de paiement</Text>
                            <Text style={styles.detailVal}>{formatDateTime(inv.paidAt)}</Text>
                          </View>
                        </>
                      )}
                      <View style={styles.divider} />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Methode de paiement</Text>
                        <Text style={styles.detailVal}>{paymentMethod}</Text>
                      </View>
                    </Card>

                    {/* Bloc financier */}
                    <Card style={styles.financialCard}>
                      <View style={styles.finRow}>
                        <Text style={styles.finLabel}>Sous-total</Text>
                        <Text style={styles.finValue}>{formatAmount(inv.amount, inv.currency)}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.finRow}>
                        <Text style={styles.finLabel}>Frais de service</Text>
                        <Text style={styles.finValue}>{formatAmount(0, inv.currency)}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.finRow}>
                        <Text style={styles.finLabel}>Taxes (TPS/TVQ)</Text>
                        <Text style={styles.finValue}>Non applicables</Text>
                      </View>
                      <View style={styles.totalDivider} />
                      <View style={styles.finRow}>
                        <Text style={styles.totalLabel}>{inv.status === 'paid' ? 'Total paye' : 'Total a payer'}</Text>
                        <Text style={styles.totalValue}>{formatAmount(inv.amount, inv.currency)}</Text>
                      </View>
                    </Card>

                    {/* Pied de page */}
                    <Text style={styles.footerText}>
                      Ce document est genere automatiquement par {APP_NAME}.{`\n`}
                      Pour toute question, contactez-nous au {APP_EMAIL}.
                    </Text>
                  </ScrollView>
                );
              })()}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 12 },
  summaryCard: { padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 24 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' },
  summaryLabel: { color: Colors.text.muted, fontSize: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 14 },
  loadingText: { color: Colors.text.muted, textAlign: 'center', padding: 20 },
  errorText: { color: Colors.status.error, textAlign: 'center', padding: 20 },
  invoiceCard: { padding: 16, gap: 10 },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNumber: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  invoiceReason: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  invoiceFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: Colors.text.muted, fontSize: 11 },
  amountText: { color: Colors.status.success, fontSize: 16, fontWeight: '700', marginLeft: 'auto' },
  emptyCard: { padding: 40, alignItems: 'center', gap: 12 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { flex: 1, backgroundColor: Colors.background.dark, marginTop: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  closeButton: { padding: 8 },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // Document header
  docHeader: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  docTitle: { color: Colors.text.primary, fontSize: 24, fontWeight: '800' },
  docNumber: { color: Colors.text.muted, fontSize: 14, fontWeight: '500' },
  docStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  docStatusText: { fontSize: 13, fontWeight: '700' },

  // Sections
  sectionCard: { padding: 16, gap: 4 },
  sectionTitle: { color: Colors.text.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  orgName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  orgInfo: { color: Colors.text.secondary, fontSize: 13 },

  // Parties
  partiesRow: { flexDirection: 'row', gap: 10 },
  partyCard: { flex: 1, padding: 14, gap: 4 },
  partyName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  partySub: { color: Colors.text.muted, fontSize: 12 },

  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  detailKey: { color: Colors.text.muted, fontSize: 13, flexShrink: 0 },
  detailVal: { color: Colors.text.primary, fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border.light, marginVertical: 8 },

  // Financial block
  financialCard: { padding: 16, gap: 0 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { color: Colors.text.muted, fontSize: 14 },
  finValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '500' },
  totalDivider: { height: 2, backgroundColor: Colors.primary.orange, marginVertical: 10 },
  totalLabel: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  totalValue: { color: Colors.status.success, fontSize: 20, fontWeight: '800' },

  // Footer
  footerText: { color: Colors.text.muted, fontSize: 11, textAlign: 'center', lineHeight: 16, paddingTop: 8 },
});
