import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, Calendar, MapPin, Users, Award, Clock, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { mockTournaments, sportLabels, levelLabels } from '@/mocks/data';

export default function TournamentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const tournament = mockTournaments.find(t => t.id === id);

  if (!tournament) {
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
              <Text style={styles.headerTitle}>Tournoi</Text>
              <View style={styles.placeholder} />
            </View>
            <View style={styles.notFoundContainer}>
              <Trophy size={64} color={Colors.text.muted} />
              <Text style={styles.notFoundTitle}>Tournoi introuvable</Text>
              <Button title="Retour" onPress={() => router.back()} variant="primary" />
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'registration': return 'Inscriptions ouvertes';
      case 'ongoing': return 'En cours';
      case 'completed': return 'Terminé';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration': return Colors.status.success;
      case 'ongoing': return Colors.primary.orange;
      case 'completed': return Colors.text.muted;
      default: return Colors.text.muted;
    }
  };

  const handleRegister = () => {
    if (tournament.status !== 'registration') {
      Alert.alert('Inscriptions fermées', 'Les inscriptions pour ce tournoi sont terminées.');
      return;
    }
    Alert.alert(
      'Inscription au tournoi',
      `Voulez-vous inscrire votre équipe au tournoi "${tournament.name}" ?\n\nFrais d'inscription: ${tournament.entryFee.toLocaleString()} FCFA`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => Alert.alert('Succès', 'Votre demande d\'inscription a été envoyée !') }
      ]
    );
  };

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
            <Text style={styles.headerTitle}>Détails du tournoi</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <LinearGradient
              colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(tournament.status) }]} />
                <Text style={styles.statusText}>{getStatusLabel(tournament.status)}</Text>
              </View>
              
              <Text style={styles.tournamentName}>{tournament.name}</Text>
              <Text style={styles.tournamentSport}>
                {sportLabels[tournament.sport]} • {tournament.format} • {levelLabels[tournament.level]}
              </Text>

              <View style={styles.prizeSection}>
                <Trophy size={24} color="#FFD700" />
                <Text style={styles.prizeAmount}>{tournament.prizePool.toLocaleString()} FCFA</Text>
                <Text style={styles.prizeLabel}>à gagner</Text>
              </View>
            </LinearGradient>

            {tournament.description && (
              <Card style={styles.descriptionCard}>
                <Text style={styles.sectionTitle}>À propos</Text>
                <Text style={styles.descriptionText}>{tournament.description}</Text>
              </Card>
            )}

            <Card style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Informations</Text>
              
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Calendar size={18} color={Colors.primary.blue} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Dates</Text>
                  <Text style={styles.infoValue}>{formatDate(tournament.startDate)}</Text>
                  <Text style={styles.infoSubvalue}>au {formatDate(tournament.endDate)}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <MapPin size={18} color={Colors.primary.orange} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Lieu</Text>
                  <Text style={styles.infoValue}>{tournament.venue.name}</Text>
                  <Text style={styles.infoSubvalue}>{tournament.venue.city}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Users size={18} color={Colors.status.success} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Équipes</Text>
                  <Text style={styles.infoValue}>{tournament.registeredTeams.length} / {tournament.maxTeams}</Text>
                  <Text style={styles.infoSubvalue}>{tournament.maxTeams - tournament.registeredTeams.length} places restantes</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <DollarSign size={18} color={Colors.primary.orange} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Frais d'inscription</Text>
                  <Text style={styles.infoValue}>{tournament.entryFee.toLocaleString()} FCFA</Text>
                  <Text style={styles.infoSubvalue}>par équipe</Text>
                </View>
              </View>
            </Card>

            <Card style={styles.prizesCard}>
              <Text style={styles.sectionTitle}>Récompenses</Text>
              
              {tournament.prizes.map((prize, index) => (
                <View key={index} style={styles.prizeRow}>
                  <View style={[styles.positionBadge, index === 0 && styles.firstPlace, index === 1 && styles.secondPlace, index === 2 && styles.thirdPlace]}>
                    <Text style={styles.positionText}>{prize.label}</Text>
                  </View>
                  <View style={styles.prizeInfo}>
                    <Award size={16} color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} />
                    <Text style={styles.prizeRowAmount}>{prize.amount.toLocaleString()} FCFA</Text>
                  </View>
                </View>
              ))}
            </Card>

            {tournament.sponsorName && (
              <Card style={styles.sponsorCard}>
                <Text style={styles.sponsorLabel}>Tournoi sponsorisé par</Text>
                <Text style={styles.sponsorName}>{tournament.sponsorName}</Text>
              </Card>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {tournament.status === 'registration' && (
            <View style={styles.footer}>
              <Button
                title="Inscrire mon équipe"
                onPress={handleRegister}
                variant="orange"
                size="large"
                style={styles.registerButton}
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 44 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  notFoundContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  heroCard: { borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  tournamentName: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' as const, textAlign: 'center' as const, marginBottom: 4 },
  tournamentSport: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' as const, marginBottom: 20 },
  prizeSection: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  prizeAmount: { color: '#FFD700', fontSize: 24, fontWeight: '700' as const },
  prizeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  descriptionCard: { marginBottom: 16 },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  descriptionText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
  infoCard: { marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { color: Colors.text.muted, fontSize: 12, marginBottom: 2 },
  infoValue: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  infoSubvalue: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  infoDivider: { height: 1, backgroundColor: Colors.border.light, marginVertical: 12 },
  prizesCard: { marginBottom: 16 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  positionBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  firstPlace: { backgroundColor: 'rgba(255,215,0,0.2)' },
  secondPlace: { backgroundColor: 'rgba(192,192,192,0.2)' },
  thirdPlace: { backgroundColor: 'rgba(205,127,50,0.2)' },
  positionText: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  prizeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prizeRowAmount: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  sponsorCard: { alignItems: 'center', paddingVertical: 16, marginBottom: 16 },
  sponsorLabel: { color: Colors.text.muted, fontSize: 12, marginBottom: 4 },
  sponsorName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  bottomSpacer: { height: 80 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border.light },
  registerButton: { width: '100%' },
});
