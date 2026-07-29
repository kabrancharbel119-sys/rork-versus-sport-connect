import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, Pressable, RefreshControl, ActivityIndicator, Share } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, Ticket as TicketIcon, X, CheckCircle, Clock, XCircle, Calendar, MapPin, Share as ShareIcon, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket, TicketStatus } from '@/types';

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  valid: { label: 'Valide', color: Colors.status.success },
  used: { label: 'Utilisé', color: Colors.text.muted },
  pending_payment: { label: 'En attente de paiement', color: Colors.status.warning },
  cancelled: { label: 'Annulé', color: Colors.status.error },
  refunded: { label: 'Remboursé', color: Colors.status.info },
};

export default function MyTicketsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ['myTickets', user?.id],
    queryFn: () => ticketsApi.getMyTickets(user!.id),
    enabled: !!user?.id,
  });

  const tickets = ticketsQuery.data ?? [];

  const { upcoming, past } = useMemo(() => {
    const up: Ticket[] = [];
    const pa: Ticket[] = [];
    for (const t of tickets) {
      if (t.status === 'valid' || t.status === 'pending_payment') up.push(t);
      else pa.push(t);
    }
    return { upcoming: up, past: pa };
  }, [tickets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await ticketsQuery.refetch();
    setRefreshing(false);
  };

  const renderTicket = (ticket: Ticket) => {
    const config = STATUS_CONFIG[ticket.status];
    const isTappable = ticket.status === 'valid' || ticket.status === 'used';
    const eventInfo = ticket.eventInfo;
    return (
      <TouchableOpacity
        key={ticket.id}
        style={styles.ticketCard}
        onPress={() => isTappable && setSelectedTicket(ticket)}
        activeOpacity={isTappable ? 0.7 : 1}
      >
        <View style={[styles.ticketIconWrap, { backgroundColor: `${config.color}20` }]}>
          <TicketIcon size={22} color={config.color} />
        </View>
        <View style={styles.ticketInfo}>
          {eventInfo?.name && <Text style={styles.ticketEventName} numberOfLines={1}>{eventInfo.name}</Text>}
          <Text style={styles.ticketTypeName}>{ticket.ticketType?.name || 'Billet'}</Text>
          {eventInfo?.date && (
            <View style={styles.ticketDateRow}>
              <Calendar size={11} color={Colors.text.muted} />
              <Text style={styles.ticketDateText}>
                {new Date(eventInfo.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}
          <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        <View style={styles.ticketRight}>
          <Text style={styles.ticketPrice}>
            {ticket.pricePaid === 0 ? 'Gratuit' : `${ticket.pricePaid.toLocaleString()} F`}
          </Text>
          <Text style={styles.ticketDate}>
            {new Date(ticket.purchasedAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </TouchableOpacity>
    );
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
              <Text style={styles.headerTitle}>Mes billets</Text>
              <Text style={styles.headerSubtitle}>Vos billets pour les matchs et tournois</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {ticketsQuery.isLoading ? (
              <ActivityIndicator size="large" color={Colors.primary.blue} style={{ marginTop: 40 }} />
            ) : tickets.length === 0 ? (
              <View style={styles.emptyState}>
                <TicketIcon size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun billet</Text>
                <Text style={styles.emptyText}>Vos billets achetés pour les matchs et tournois s'afficheront ici.</Text>
              </View>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>À venir</Text>
                    {upcoming.map(renderTicket)}
                  </>
                )}
                {past.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Historique</Text>
                    {past.map(renderTicket)}
                  </>
                )}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Modal QR Code — Design billet professionnel */}
      <Modal
        visible={selectedTicket !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTicket(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedTicket(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedTicket && (() => {
              const t = selectedTicket;
              const config = STATUS_CONFIG[t.status];
              const eventInfo = t.eventInfo;
              const eventDate = eventInfo?.date ? new Date(eventInfo.date) : null;

              const handleShare = async () => {
                try {
                  await Share.share({
                    message: `Billet ${t.ticketCode} — ${t.ticketType?.name || ''}\n${eventInfo?.name || 'Événement'}\n${eventDate ? eventDate.toLocaleDateString('fr-FR') : ''}${eventInfo?.location ? ' — ' + eventInfo.location : ''}\nStatut: ${config.label}`,
                  });
                } catch {}
              };

              return (
                <>
                  {/* Header du billet */}
                  <View style={styles.ticketHeader}>
                    <View style={styles.ticketHeaderLeft}>
                      <Text style={styles.ticketHeaderLabel}>BILLET</Text>
                      <Text style={styles.ticketHeaderCode}>{t.ticketCode}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedTicket(null)} style={styles.ticketCloseBtn}>
                      <X size={22} color={Colors.text.muted} />
                    </TouchableOpacity>
                  </View>

                  {/* Section événement */}
                  <View style={styles.ticketEventSection}>
                    <Text style={styles.ticketEventTitle} numberOfLines={2}>
                      {eventInfo?.name || 'Événement'}
                    </Text>
                    <Text style={styles.ticketTypeLabel}>{t.ticketType?.name || 'Billet'}</Text>
                    {!!t.ticketType?.description && (
                      <Text style={styles.ticketTypeDesc}>{t.ticketType.description}</Text>
                    )}
                  </View>

                  {/* Infos date / lieu */}
                  <View style={styles.ticketInfoGrid}>
                    {eventDate && (
                      <View style={styles.ticketInfoCell}>
                        <Calendar size={14} color={Colors.text.muted} />
                        <Text style={styles.ticketInfoLabel}>Date</Text>
                        <Text style={styles.ticketInfoValue}>
                          {eventDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </Text>
                        <Text style={styles.ticketInfoSub}>
                          {eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    {eventInfo?.location && (
                      <View style={styles.ticketInfoCell}>
                        <MapPin size={14} color={Colors.text.muted} />
                        <Text style={styles.ticketInfoLabel}>Lieu</Text>
                        <Text style={styles.ticketInfoValue} numberOfLines={2}>{eventInfo.location}</Text>
                      </View>
                    )}
                    <View style={styles.ticketInfoCell}>
                      <DollarSign size={14} color={Colors.text.muted} />
                      <Text style={styles.ticketInfoLabel}>Prix</Text>
                      <Text style={styles.ticketInfoValue}>
                        {t.pricePaid === 0 ? 'Gratuit' : `${t.pricePaid.toLocaleString()} F`}
                      </Text>
                    </View>
                  </View>

                  {/* Séparation perforée */}
                  <View style={styles.perforation}>
                    {Array.from({ length: 20 }).map((_, i) => (
                      <View key={i} style={styles.perforationDot} />
                    ))}
                  </View>

                  {/* QR Code section */}
                  <View style={styles.qrSection}>
                    <View style={styles.qrContainer}>
                      <QRCode
                        value={t.qrToken}
                        size={180}
                        backgroundColor="#FFFFFF"
                        color="#000000"
                      />
                    </View>
                    <Text style={styles.qrInstructions}>
                      Présentez ce QR code à l'entrée pour validation
                    </Text>
                  </View>

                  {/* Statut */}
                  <View style={[styles.ticketStatusBadge, { backgroundColor: `${config.color}20`, borderColor: `${config.color}40` }]}>
                    {t.status === 'valid' && <CheckCircle size={16} color={config.color} />}
                    {t.status === 'used' && <Clock size={16} color={config.color} />}
                    {(t.status === 'cancelled' || t.status === 'refunded') && <XCircle size={16} color={config.color} />}
                    <Text style={[styles.ticketStatusText, { color: config.color }]}>
                      {t.status === 'valid' && 'Billet valide — prêt à scanner'}
                      {t.status === 'used' && `Utilisé${t.usedAt ? ' le ' + new Date(t.usedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`}
                      {t.status === 'pending_payment' && 'Paiement en attente'}
                      {t.status === 'cancelled' && 'Billet annulé'}
                      {t.status === 'refunded' && 'Billet remboursé'}
                    </Text>
                  </View>

                  {/* Bouton partager */}
                  {t.status === 'valid' && (
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
                      <ShareIcon size={16} color={Colors.primary.orange} />
                      <Text style={styles.shareBtnText}>Partager les détails</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginTop: 16 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ticketIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketInfo: { flex: 1, marginLeft: 12 },
  ticketTypeName: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginTop: 2 },
  ticketEventName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const },
  ticketDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ticketDateText: { color: Colors.text.muted, fontSize: 11 },
  ticketCode: { color: Colors.text.secondary, fontSize: 13, marginTop: 4, fontFamily: 'monospace' as any },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' as const },
  ticketRight: { alignItems: 'flex-end' },
  ticketPrice: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const },
  ticketDate: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },

  // Modal — Ticket design
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  ticketHeaderLeft: { flex: 1 },
  ticketHeaderLabel: {
    color: Colors.primary.orange,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2,
  },
  ticketHeaderCode: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as any,
    marginTop: 2,
  },
  ticketCloseBtn: { padding: 4 },
  ticketEventSection: { width: '100%', alignItems: 'center', marginBottom: 16 },
  ticketEventTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  ticketTypeLabel: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  ticketTypeDesc: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  ticketInfoGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  ticketInfoCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  ticketInfoLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  ticketInfoValue: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  ticketInfoSub: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  perforationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  qrSection: { alignItems: 'center', width: '100%', paddingVertical: 16 },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  qrInstructions: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  ticketStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  ticketStatusText: { fontSize: 13, fontWeight: '600' as const, flex: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.primary.orange}40`,
  },
  shareBtnText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
});
