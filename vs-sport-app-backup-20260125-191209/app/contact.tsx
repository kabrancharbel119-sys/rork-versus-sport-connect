import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Bug, CreditCard, Users, Swords, HelpCircle, MessageCircle, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user } = useAuth();
  const { createTicket, getUserTickets, isCreatingTicket } = useSupport();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const myTickets = user ? getUserTickets(user.id) : [];

  const handleSubmit = async () => {
    if (!user || !category || !subject.trim() || !description.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    try {
      await createTicket({ userId: user.id, userName: user.fullName, userEmail: user.email, category, subject: subject.trim(), description: description.trim() });
      Alert.alert('Succès', 'Votre ticket a été créé. Notre équipe vous répondra bientôt.');
      setCategory(null);
      setSubject('');
      setDescription('');
      setView('list');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
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
      case 'open': return 'Ouvert';
      case 'in_progress': return 'En cours';
      case 'resolved': return 'Résolu';
      default: return 'Fermé';
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const renderTicketList = () => (
    <>
      <View style={styles.tabRow}>
        <Text style={styles.sectionTitle}>Mes tickets ({myTickets.length})</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setView('new')}><Text style={styles.newBtnText}>+ Nouveau</Text></TouchableOpacity>
      </View>
      {myTickets.length > 0 ? (
        myTickets.map((ticket: SupportTicket) => (
          <Card key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <View style={styles.ticketCategory}>{CATEGORIES.find(c => c.key === ticket.category)?.icon}</View>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                <Text style={styles.ticketMeta}>{formatDate(ticket.createdAt)} • {ticket.responses.length} réponse(s)</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(ticket.status)}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>{getStatusLabel(ticket.status)}</Text>
              </View>
            </View>
            <Text style={styles.ticketPreview} numberOfLines={2}>{ticket.description}</Text>
          </Card>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>Aucun ticket</Text>
          <Text style={styles.emptyText}>Vous n{"'"}avez pas encore créé de ticket support</Text>
          <Button title="Créer un ticket" onPress={() => setView('new')} variant="primary" style={styles.emptyButton} />
        </View>
      )}
    </>
  );

  const renderNewTicket = () => (
    <>
      <TouchableOpacity style={styles.backLink} onPress={() => setView('list')}>
        <ArrowLeft size={18} color={Colors.primary.blue} /><Text style={styles.backLinkText}>Retour aux tickets</Text>
      </TouchableOpacity>
      <Text style={styles.formTitle}>Nouveau ticket</Text>
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat.key} style={[styles.categoryItem, category === cat.key && styles.categoryActive]} onPress={() => setCategory(cat.key)}>
            {cat.icon}<Text style={[styles.categoryText, category === cat.key && styles.categoryTextActive]}>{cat.label}</Text>
            {category === cat.key && <View style={styles.checkmark} />}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Sujet</Text>
      <TextInput style={styles.input} placeholder="Décrivez brièvement votre problème" placeholderTextColor={Colors.text.muted} value={subject} onChangeText={setSubject} maxLength={100} />
      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Donnez-nous plus de détails pour que nous puissions vous aider..." placeholderTextColor={Colors.text.muted} value={description} onChangeText={setDescription} multiline numberOfLines={6} textAlignVertical="top" maxLength={1000} />
      <Text style={styles.charCount}>{description.length}/1000</Text>
      <Button title="Envoyer le ticket" onPress={handleSubmit} loading={isCreatingTicket} variant="primary" icon={<Send size={18} color="#FFFFFF" />} disabled={!category || !subject.trim() || !description.trim()} style={styles.submitBtn} />
      <View style={styles.infoBox}>
        <Clock size={16} color={Colors.text.muted} />
        <Text style={styles.infoText}>Notre équipe répond généralement sous 24-48h</Text>
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
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Nous contacter</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {view === 'list' ? renderTicketList() : renderNewTicket()}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>
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
});
