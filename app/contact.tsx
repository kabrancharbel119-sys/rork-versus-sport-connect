import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Bug, CreditCard, Users, Swords, HelpCircle, MessageCircle, Clock, X, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSupport, TicketCategory, SupportTicket } from '@/contexts/SupportContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const CATEGORIES: { key: TicketCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'bug', label: 'Bug / Problème technique', icon: <Bug size={20} color={Colors.status.error} /> },
  { key: 'account', label: 'Mon compte', icon: <Users size={20} color={Colors.primary.blue} /> },
  { key: 'payment', label: 'Paiement / Wallet', icon: <CreditCard size={20} color={Colors.status.success} /> },
  { key: 'team', label: 'Équipe', icon: <Users size={20} color={Colors.primary.orange} /> },
  { key: 'match', label: 'Match / Tournoi', icon: <Swords size={20} color="#8B5CF6" /> },
  { key: 'other', label: 'Autre', icon: <HelpCircle size={20} color={Colors.text.muted} /> },
];

export default function ContactScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { createTicket, getUserTickets, isCreatingTicket } = useSupport();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const myTickets = user ? getUserTickets(user.id) : [];

  const handleSubmit = async () => {
    if (!user || !category || !subject.trim() || !description.trim()) {
      Alert.alert(t('common.error'), t('contact.fillAllFields'));
      return;
    }
    try {
      const newTicket = await createTicket({ 
        userId: user.id, 
        category, 
        subject: subject.trim(), 
        description: description.trim() 
      });
      
      // Confirmation explicite
      Alert.alert(
        '✅ Ticket envoyé !',
        `Votre ticket "${newTicket.subject}" a été créé avec succès.\n\nNous vous répondrons dans les plus brefs délais.`,
        [{ 
          text: 'OK', 
          onPress: () => {
            setCategory(null);
            setSubject('');
            setDescription('');
            setView('list');
          }
        }]
      );
    } catch (error: any) {
      console.error('[Contact] Ticket creation error:', error);
      Alert.alert(
        '❌ Erreur',
        error.message || 'Une erreur est survenue lors de la création du ticket. Veuillez réessayer.'
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return Colors.status.success;
      case 'in_progress': return Colors.primary.orange;
      case 'resolved': return Colors.primary.blue;
      default: return Colors.text.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return t('contact.statusOpen');
      case 'in_progress': return t('contact.statusInProgress');
      case 'resolved': return t('contact.statusResolved');
      default: return t('contact.statusClosed');
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });

  const categoryLabel = (key: TicketCategory) => {
    switch (key) {
      case 'bug': return t('contact.bugCategory');
      case 'account': return t('contact.accountCategory');
      case 'payment': return t('contact.paymentCategory');
      case 'team': return t('contact.teamCategory');
      case 'match': return t('contact.matchCategory');
      default: return t('contact.otherCategory');
    }
  };

  const renderTicketList = () => (
    <>
      <View style={styles.tabRow}>
        <Text style={styles.sectionTitle}>{t('contact.myTickets', { count: myTickets.length })}</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setView('new')}><Text style={styles.newBtnText}>{t('contact.newTicketShort')}</Text></TouchableOpacity>
      </View>
      {myTickets.length > 0 ? (
        myTickets.map((ticket: SupportTicket) => (
          <TouchableOpacity key={ticket.id} onPress={() => setSelectedTicket(ticket)}>
            <Card style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={styles.ticketCategory}>{CATEGORIES.find(c => c.key === ticket.category)?.icon}</View>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <Text style={styles.ticketMeta}>{formatDate(ticket.createdAt)} • {t('contact.responsesCount', { count: ticket.responses?.length || 0 })}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(ticket.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>{getStatusLabel(ticket.status)}</Text>
                </View>
              </View>
              <Text style={styles.ticketPreview} numberOfLines={2}>{ticket.description}</Text>
            </Card>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>{t('contact.noTicket')}</Text>
          <Text style={styles.emptyText}>{t('contact.noTicketText')}</Text>
          <Button title={t('contact.createTicket')} onPress={() => setView('new')} variant="primary" style={styles.emptyButton} />
        </View>
      )}
    </>
  );

  const renderNewTicket = () => (
    <>
      <TouchableOpacity style={styles.backLink} onPress={() => setView('list')}>
        <ArrowLeft size={18} color={Colors.primary.blue} /><Text style={styles.backLinkText}>{t('contact.backToTickets')}</Text>
      </TouchableOpacity>
      <Text style={styles.formTitle}>{t('contact.newTicket')}</Text>
      <Text style={styles.label}>{t('contact.category')}</Text>
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat.key} style={[styles.categoryItem, category === cat.key && styles.categoryActive]} onPress={() => setCategory(cat.key)}>
            {cat.icon}<Text style={[styles.categoryText, category === cat.key && styles.categoryTextActive]}>{categoryLabel(cat.key)}</Text>
            {category === cat.key && <View style={styles.checkmark} />}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>{t('contact.subject')}</Text>
      <TextInput style={styles.input} placeholder={t('contact.subjectPlaceholder')} placeholderTextColor={Colors.text.muted} value={subject} onChangeText={setSubject} maxLength={100} />
      <Text style={styles.label}>{t('contact.description')}</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder={t('contact.descriptionPlaceholder')} placeholderTextColor={Colors.text.muted} value={description} onChangeText={setDescription} multiline numberOfLines={6} textAlignVertical="top" maxLength={1000} />
      <Text style={styles.charCount}>{description.length}/1000</Text>
      <Button title={t('contact.sendTicket')} onPress={handleSubmit} loading={isCreatingTicket} variant="primary" icon={<Send size={18} color="#FFFFFF" />} disabled={!category || !subject.trim() || !description.trim()} style={styles.submitBtn} />
      <View style={styles.infoBox}>
        <Clock size={16} color={Colors.text.muted} />
        <Text style={styles.infoText}>{t('contact.supportReplyTime')}</Text>
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/(home)')}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{t('contact.title')}</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {view === 'list' ? renderTicketList() : renderNewTicket()}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Ticket Detail Modal */}
      <Modal visible={selectedTicket !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Mon Ticket</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            {selectedTicket && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Sujet</Text>
                  <Text style={styles.detailValue}>{selectedTicket.subject}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Statut</Text>
                  <View style={[styles.statusBadgeLarge, { backgroundColor: `${getStatusColor(selectedTicket.status)}20` }]}>
                    <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedTicket.status) }]}>
                      {selectedTicket.status === 'open' ? '🔓 Ouvert' : 
                       selectedTicket.status === 'in_progress' ? '🔄 En cours' : 
                       selectedTicket.status === 'resolved' ? '✅ Résolu' : '📁 Fermé'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailValue}>📁 {categoryLabel(selectedTicket.category)}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>📅 {formatDate(selectedTicket.createdAt)}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailDescription}>{selectedTicket.description}</Text>
                </View>
                
                {/* Responses Section */}
                <View style={styles.responsesSection}>
                  <Text style={styles.detailLabel}>
                    <MessageSquare size={14} color={Colors.primary.blue} /> Réponses ({selectedTicket.responses?.length || 0})
                  </Text>
                  {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                    selectedTicket.responses.map((response, index) => (
                      <View key={index} style={[styles.responseItem, response.isAdmin ? styles.responseAdmin : styles.responseUser]}>
                        <View style={styles.responseHeader}>
                          <Text style={styles.responseAuthor}>
                            {response.isAdmin ? '👨‍💼 Admin' : '👤 Vous'}
                          </Text>
                          <Text style={styles.responseDate}>
                            {new Date(response.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { 
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                        <Text style={styles.responseMessage}>{response.message}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noResponseBox}>
                      <Text style={styles.noResponseText}>
                        Aucune réponse pour le moment. Notre équipe vous répondra sous 24-48h.
                      </Text>
                    </View>
                  )}
                </View>
                
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedTicket(null)}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  tabRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  newBtn: { backgroundColor: Colors.primary.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' as const },
  ticketCard: { marginBottom: 12 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  ticketCategory: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  ticketInfo: { flex: 1 },
  ticketSubject: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  ticketMeta: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  ticketPreview: { color: Colors.text.secondary, fontSize: 13, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginTop: 16 },
  emptyText: { color: Colors.text.muted, fontSize: 14, marginTop: 8 },
  emptyButton: { marginTop: 24 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backLinkText: { color: Colors.primary.blue, fontSize: 14 },
  formTitle: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' as const, marginBottom: 24 },
  label: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginBottom: 10 },
  categories: { gap: 8, marginBottom: 20 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  categoryActive: { borderColor: Colors.primary.blue, backgroundColor: `${Colors.primary.blue}10` },
  categoryText: { flex: 1, color: Colors.text.secondary, fontSize: 14 },
  categoryTextActive: { color: Colors.text.primary, fontWeight: '500' as const },
  checkmark: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue },
  input: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 15, marginBottom: 16 },
  textArea: { minHeight: 140 },
  charCount: { color: Colors.text.muted, fontSize: 12, textAlign: 'right', marginTop: -12, marginBottom: 20 },
  submitBtn: { marginBottom: 16 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, padding: 14, borderRadius: 12 },
  infoText: { flex: 1, color: Colors.text.muted, fontSize: 13 },
  bottomSpacer: { height: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  detailSection: { marginBottom: 16 },
  detailLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 6 },
  detailValue: { color: Colors.text.primary, fontSize: 15 },
  detailDescription: { color: Colors.text.primary, fontSize: 14, lineHeight: 20, backgroundColor: Colors.background.card, padding: 12, borderRadius: 8 },
  statusBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  statusTextLarge: { fontSize: 13, fontWeight: '600' as const },
  responsesSection: { marginTop: 8, marginBottom: 16 },
  responseItem: { backgroundColor: Colors.background.card, padding: 12, borderRadius: 8, marginBottom: 8 },
  responseAdmin: { borderLeftWidth: 3, borderLeftColor: Colors.primary.blue },
  responseUser: { borderLeftWidth: 3, borderLeftColor: Colors.status.success },
  responseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  responseAuthor: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  responseDate: { color: Colors.text.muted, fontSize: 11 },
  responseMessage: { color: Colors.text.secondary, fontSize: 14, lineHeight: 18 },
  noResponseBox: { backgroundColor: Colors.background.card, padding: 16, borderRadius: 8, alignItems: 'center' },
  noResponseText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center' },
  closeBtn: { backgroundColor: Colors.primary.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
});
