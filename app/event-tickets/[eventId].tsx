import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ticket as TicketIcon, Minus, Plus, Clock, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { ticketsApi } from '@/lib/api/tickets';
import { paymentProvider, isInAppPaymentAvailable } from '@/lib/payments/payment-provider';
import { supabase } from '@/lib/supabase';
import { getApiBaseUrl } from '@/lib/api-base-url';
import type { TicketType, TicketEventType } from '@/types';

export default function EventTicketsScreen() {
  const { eventId, type, eventName } = useLocalSearchParams<{ eventId: string; type: string; eventName?: string }>();
  const eventType = (type === 'tournament' ? 'tournament' : 'match') as TicketEventType;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [pendingPaymentRef, setPendingPaymentRef] = useState<string | null>(null);
  const [pendingProviderRef, setPendingProviderRef] = useState<string | null>(null);

  const ticketTypesQuery = useQuery({
    queryKey: ['ticketTypes', eventType, eventId],
    queryFn: () => ticketsApi.getTicketTypesForEvent(eventType, eventId!),
    enabled: !!eventId,
  });

  const ticketTypes = useMemo(
    () => (ticketTypesQuery.data ?? []).filter(tt => tt.isActive),
    [ticketTypesQuery.data]
  );

  const totalAmount = useMemo(() => {
    return ticketTypes.reduce((sum, tt) => sum + (quantities[tt.id] || 0) * tt.price, 0);
  }, [ticketTypes, quantities]);

  const totalQuantity = useMemo(() => {
    return Object.values(quantities).reduce((sum, q) => sum + q, 0);
  }, [quantities]);

  // Polling: attendre la confirmation du paiement (webhook GeniusPay)
  useEffect(() => {
    if (!paymentPending || !pendingPaymentRef) return;
    const providerRef = pendingProviderRef || pendingPaymentRef;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          // 1. Ask backend to check GeniusPay status and confirm tickets if paid
          const apiBase = getApiBaseUrl();
          if (apiBase) {
            const res = await fetch(`${apiBase}/api/payments/geniuspay/confirm/${encodeURIComponent(providerRef)}?internal_ref=${encodeURIComponent(pendingPaymentRef)}`, {
              method: 'POST',
            });
            const body = await res.json().catch(() => null);
            if (body?.confirmed) {
              setPaymentPending(false);
              setPendingPaymentRef(null);
              setPendingProviderRef(null);
              queryClient.invalidateQueries({ queryKey: ['myTickets'] });
              queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
              Alert.alert('Paiement confirmé ✅', 'Vos billets sont disponibles dans "Mes billets".', [
                { text: 'Voir mes billets', onPress: () => router.push('/my-tickets' as any) },
                { text: 'OK' },
              ]);
              return;
            }
            if (body?.status === 'failed' || body?.status === 'cancelled' || body?.status === 'expired') {
              setPaymentPending(false);
              setPendingPaymentRef(null);
              setPendingProviderRef(null);
              Alert.alert('Paiement échoué', 'Le paiement n\'a pas abouti. Vous pouvez réessayer.');
              return;
            }
          }

          // 2. Fallback: check tickets table directly (in case webhook already confirmed)
          const { data } = await (supabase
            .from('tickets')
            .select('status')
            .eq('payment_transaction_id', pendingPaymentRef)
            .limit(1) as any);
          const status = (data as { status: string }[] | null)?.[0]?.status;
          if (status === 'valid') {
            setPaymentPending(false);
            setPendingPaymentRef(null);
            setPendingProviderRef(null);
            queryClient.invalidateQueries({ queryKey: ['myTickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
            Alert.alert('Paiement confirmé ✅', 'Vos billets sont disponibles dans "Mes billets".', [
              { text: 'Voir mes billets', onPress: () => router.push('/my-tickets' as any) },
              { text: 'OK' },
            ]);
            return;
          }
          if (status === 'cancelled') {
            setPaymentPending(false);
            setPendingPaymentRef(null);
            setPendingProviderRef(null);
            Alert.alert('Paiement échoué', 'Le paiement n\'a pas abouti. Vous pouvez réessayer.');
            return;
          }
        } catch (e) {
          console.warn('[EventTickets] Poll error:', e);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
      if (!cancelled) {
        setPaymentPending(false);
        setPendingPaymentRef(null);
        setPendingProviderRef(null);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [paymentPending, pendingPaymentRef, pendingProviderRef, eventType, eventId, queryClient, router]);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Vous devez être connecté pour acheter des billets.');
      const selections = ticketTypes.filter(tt => (quantities[tt.id] || 0) > 0);
      if (selections.length === 0) throw new Error('Sélectionnez au moins un billet.');

      if (totalAmount === 0) {
        // Billets gratuits: validation immédiate
        const freeReference = `FREE-${eventId}-${user.id.slice(0, 8)}-${Date.now()}`;
        for (const tt of selections) {
          await ticketsApi.purchaseTickets({
            ticketTypeId: tt.id,
            buyerId: user.id,
            quantity: quantities[tt.id],
            initialStatus: 'valid',
            paymentTransactionId: freeReference,
          });
        }
        // Génère un reçu (facture à 0 FCFA) visible côté acheteur et organisateur
        await ticketsApi.createInvoiceForPurchase(freeReference);
        await ticketsApi.notifyPurchase(user.id, (eventName as string) || 'l\'événement', totalQuantity);
        return { paid: false };
      }

      // Billets payants: flux GeniusPay
      if (!isInAppPaymentAvailable()) {
        throw new Error('Le paiement in-app n\'est pas disponible pour le moment. Réessayez plus tard.');
      }

      const reference = `TICKET-${eventId}-${user.id.slice(0, 8)}-${Date.now()}`;

      // 1. Créer les billets en attente de paiement
      for (const tt of selections) {
        await ticketsApi.purchaseTickets({
          ticketTypeId: tt.id,
          buyerId: user.id,
          quantity: quantities[tt.id],
          initialStatus: 'pending_payment',
          paymentTransactionId: reference,
        });
      }

      // 2. Initier le paiement
      const paymentResult = await paymentProvider.initiatePayment({
        reference,
        amount: totalAmount,
        currency: 'XOF',
        contextType: 'ticket_purchase',
        contextId: reference,
        payerId: user.id,
        successUrl: `https://versus-sport-connect.vercel.app/payment/success?ticket_ref=${reference}`,
        errorUrl: `https://versus-sport-connect.vercel.app/payment/error?ticket_ref=${reference}`,
      });

      if (!paymentResult.success) {
        // Annuler les billets en attente et restituer le stock
        await ticketsApi.cancelPendingTickets(reference).catch(() => {});
        throw new Error(paymentResult.error || 'Le paiement n\'a pas pu être initié.');
      }

      return { paid: true, reference, checkoutUrl: paymentResult.checkoutUrl, providerRef: paymentResult.providerTransactionId };
    },
    onSuccess: async (result) => {
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['ticketTypes', eventType, eventId] });
      queryClient.invalidateQueries({ queryKey: ['myTickets'] });

      if (!result.paid) {
        Alert.alert('Billets confirmés 🎟️', 'Vos billets gratuits sont disponibles dans "Mes billets".', [
          { text: 'Voir mes billets', onPress: () => router.push('/my-tickets' as any) },
          { text: 'OK' },
        ]);
        return;
      }

      setPaymentPending(true);
      setPendingPaymentRef(result.reference!);
      setPendingProviderRef(result.providerRef || null);

      if (result.checkoutUrl) {
        Alert.alert(
          'Paiement en attente',
          'Vous allez être redirigé vers la page de paiement.\nVos billets seront confirmés automatiquement après le paiement.'
        );
        const supported = await Linking.canOpenURL(result.checkoutUrl);
        if (supported) await Linking.openURL(result.checkoutUrl);
      }
    },
    onError: (error: Error) => {
      Alert.alert('Erreur', error.message || 'Impossible d\'acheter les billets.');
    },
  });

  const adjustQuantity = (tt: TicketType, delta: number) => {
    setQuantities(prev => {
      const current = prev[tt.id] || 0;
      const remaining = tt.quantityTotal - tt.quantitySold;
      const next = Math.max(0, Math.min(current + delta, Math.min(remaining, tt.maxPerUser)));
      return { ...prev, [tt.id]: next };
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await ticketTypesQuery.refetch();
    setRefreshing(false);
  };

  const isSalesOpen = (tt: TicketType) => {
    const now = new Date();
    if (tt.salesStart && now < tt.salesStart) return false;
    if (tt.salesEnd && now > tt.salesEnd) return false;
    return true;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/(home)' as any); }}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Billets</Text>
              {!!eventName && <Text style={styles.headerSubtitle} numberOfLines={1}>{eventName}</Text>}
            </View>
            <View style={styles.placeholder} />
          </View>

          {paymentPending && (
            <View style={styles.pendingBanner}>
              <ActivityIndicator size="small" color={Colors.primary.orange} />
              <Text style={styles.pendingText}>Paiement en cours de confirmation...</Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {ticketTypesQuery.isLoading ? (
              <ActivityIndicator size="large" color={Colors.primary.blue} style={{ marginTop: 40 }} />
            ) : ticketTypes.length === 0 ? (
              <View style={styles.emptyState}>
                <TicketIcon size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun billet en vente</Text>
                <Text style={styles.emptyText}>L'organisateur n'a pas encore mis de billets en vente pour cet événement.</Text>
              </View>
            ) : (
              ticketTypes.map(tt => {
                const remaining = tt.quantityTotal - tt.quantitySold;
                const soldOut = remaining <= 0;
                const salesOpen = isSalesOpen(tt);
                const qty = quantities[tt.id] || 0;
                return (
                  <View key={tt.id} style={[styles.ticketCard, (soldOut || !salesOpen) && styles.ticketCardDisabled]}>
                    <View style={styles.ticketInfo}>
                      <Text style={styles.ticketName}>{tt.name}</Text>
                      {!!tt.description && <Text style={styles.ticketDescription}>{tt.description}</Text>}
                      <Text style={styles.ticketPrice}>
                        {tt.price === 0 ? 'Gratuit' : `${tt.price.toLocaleString()} FCFA`}
                      </Text>
                      <Text style={[styles.ticketRemaining, remaining <= 10 && { color: Colors.status.warning }]}>
                        {soldOut ? 'Épuisé' : `${remaining} restant${remaining > 1 ? 's' : ''}`}
                      </Text>
                      {tt.validDays && tt.validDays.length > 0 && (
                        <View style={styles.validDaysRow}>
                          <Calendar size={12} color={Colors.primary.blue} />
                          <Text style={styles.validDaysText}>
                            Valide: {tt.validDays.map(d => {
                              const date = new Date(d + 'T00:00:00');
                              return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                            }).join(', ')}
                          </Text>
                        </View>
                      )}
                      {tt.validDays === null && (
                        <Text style={styles.allDaysText}>Valide tous les jours</Text>
                      )}
                      {!salesOpen && (
                        <View style={styles.salesClosedRow}>
                          <Clock size={12} color={Colors.text.muted} />
                          <Text style={styles.salesClosedText}>
                            {tt.salesStart && new Date() < tt.salesStart
                              ? `Vente à partir du ${tt.salesStart.toLocaleDateString('fr-FR')}`
                              : 'Vente terminée'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!soldOut && salesOpen && (
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={[styles.qtyBtn, qty === 0 && styles.qtyBtnDisabled]}
                          onPress={() => adjustQuantity(tt, -1)}
                          disabled={qty === 0}
                        >
                          <Minus size={18} color={qty === 0 ? Colors.text.muted : Colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => adjustQuantity(tt, 1)}
                        >
                          <Plus size={18} color={Colors.text.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: 120 }} />
          </ScrollView>

          {totalQuantity > 0 && (
            <View style={styles.footer}>
              <View style={styles.footerInfo}>
                <Text style={styles.footerQty}>{totalQuantity} billet{totalQuantity > 1 ? 's' : ''}</Text>
                <Text style={styles.footerTotal}>
                  {totalAmount === 0 ? 'Gratuit' : `${totalAmount.toLocaleString()} FCFA`}
                </Text>
              </View>
              <Button
                title={totalAmount === 0 ? 'Obtenir les billets' : 'Payer maintenant'}
                onPress={() => purchaseMutation.mutate()}
                variant="orange"
                disabled={purchaseMutation.isPending || paymentPending}
                style={styles.buyButton}
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, marginLeft: 12 },
  headerTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  headerSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  placeholder: { width: 40 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  pendingText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginTop: 16 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ticketCardDisabled: { opacity: 0.5 },
  ticketInfo: { flex: 1 },
  ticketName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  ticketDescription: { color: Colors.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  ticketPrice: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' as const, marginTop: 8 },
  ticketRemaining: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  salesClosedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  salesClosedText: { color: Colors.text.muted, fontSize: 12 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 12 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyText: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const, minWidth: 24, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 28,
    backgroundColor: Colors.background.dark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerInfo: { flex: 1 },
  footerQty: { color: Colors.text.muted, fontSize: 13 },
  footerTotal: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' as const, marginTop: 2 },
  buyButton: { minWidth: 170 },
  validDaysRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
  },
  validDaysText: {
    color: Colors.primary.blue,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  allDaysText: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
});
