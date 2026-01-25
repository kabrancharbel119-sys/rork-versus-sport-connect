import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, Calendar, MapPin, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/Card';
import { mockTournaments, sportLabels, levelLabels } from '@/mocks/data';

export default function TournamentsScreen() {
  const router = useRouter();

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
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
            <Text style={styles.headerTitle}>Tournois</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {mockTournaments.length > 0 ? (
              mockTournaments.map((tournament) => (
                <TouchableOpacity 
                  key={tournament.id} 
                  activeOpacity={0.8}
                  onPress={() => router.push(`/tournament/${tournament.id}`)}
                >
                  <Card style={styles.tournamentCard}>
                    <LinearGradient
                      colors={tournament.status === 'registration' 
                        ? [Colors.gradient.orangeStart, Colors.gradient.orangeEnd]
                        : [Colors.background.card, Colors.background.cardLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tournamentGradient}
                    >
                      <View style={styles.tournamentHeader}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tournament.status) + '30' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(tournament.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(tournament.status) }]}>
                            {getStatusLabel(tournament.status)}
                          </Text>
                        </View>
                        <View style={styles.prizeBadge}>
                          <Trophy size={14} color="#FFD700" />
                          <Text style={styles.prizeText}>{tournament.prizePool.toLocaleString()} FCFA</Text>
                        </View>
                      </View>

                      <Text style={styles.tournamentName}>{tournament.name}</Text>
                      <Text style={styles.tournamentSport}>
                        {sportLabels[tournament.sport]} • {tournament.format} • {levelLabels[tournament.level]}
                      </Text>

                      {tournament.description && (
                        <Text style={styles.tournamentDescription} numberOfLines={2}>
                          {tournament.description}
                        </Text>
                      )}

                      <View style={styles.tournamentDetails}>
                        <View style={styles.detailItem}>
                          <Calendar size={14} color={tournament.status === 'registration' ? 'rgba(255,255,255,0.7)' : Colors.text.muted} />
                          <Text style={[styles.detailText, tournament.status === 'registration' && styles.detailTextLight]}>
                            {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <MapPin size={14} color={tournament.status === 'registration' ? 'rgba(255,255,255,0.7)' : Colors.text.muted} />
                          <Text style={[styles.detailText, tournament.status === 'registration' && styles.detailTextLight]}>
                            {tournament.venue.name}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Users size={14} color={tournament.status === 'registration' ? 'rgba(255,255,255,0.7)' : Colors.text.muted} />
                          <Text style={[styles.detailText, tournament.status === 'registration' && styles.detailTextLight]}>
                            {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
                          </Text>
                        </View>
                      </View>

                      {tournament.sponsorName && (
                        <View style={styles.sponsorBadge}>
                          <Text style={styles.sponsorLabel}>Sponsorisé par</Text>
                          <Text style={styles.sponsorName}>{tournament.sponsorName}</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </Card>
                </TouchableOpacity>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Trophy size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun tournoi disponible</Text>
                <Text style={styles.emptyText}>Les tournois à venir apparaîtront ici</Text>
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
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
    paddingVertical: 16 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: Colors.background.card, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerTitle: { 
    color: Colors.text.primary, 
    fontSize: 20, 
    fontWeight: '700' as const 
  },
  placeholder: { width: 44 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  tournamentCard: { 
    marginBottom: 16, 
    padding: 0, 
    overflow: 'hidden' 
  },
  tournamentGradient: { 
    padding: 20, 
    borderRadius: 16 
  },
  tournamentHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 12 
  },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3 
  },
  statusText: { 
    fontSize: 11, 
    fontWeight: '600' as const 
  },
  prizeBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  prizeText: { 
    color: '#FFD700', 
    fontSize: 12, 
    fontWeight: '600' as const 
  },
  tournamentName: { 
    color: '#FFFFFF', 
    fontSize: 20, 
    fontWeight: '700' as const, 
    marginBottom: 4 
  },
  tournamentSport: { 
    color: 'rgba(255,255,255,0.8)', 
    fontSize: 14, 
    marginBottom: 8 
  },
  tournamentDescription: { 
    color: 'rgba(255,255,255,0.7)', 
    fontSize: 13, 
    lineHeight: 18, 
    marginBottom: 12 
  },
  tournamentDetails: { 
    gap: 8 
  },
  detailItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  detailText: { 
    color: Colors.text.muted, 
    fontSize: 13 
  },
  detailTextLight: { 
    color: 'rgba(255,255,255,0.8)' 
  },
  sponsorBadge: { 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.2)', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  sponsorLabel: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 11 
  },
  sponsorName: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    fontWeight: '600' as const 
  },
  emptyCard: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    gap: 12 
  },
  emptyTitle: { 
    color: Colors.text.primary, 
    fontSize: 18, 
    fontWeight: '600' as const 
  },
  emptyText: { 
    color: Colors.text.muted, 
    fontSize: 14 
  },
});
