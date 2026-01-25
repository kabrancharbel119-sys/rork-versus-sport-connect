import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Search, Trophy, Users, Swords, TrendingUp, MapPin, Calendar, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { mockTournaments, sportLabels, levelLabels } from '@/mocks/data';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getRecruitingTeams } = useTeams();
  const { getUpcomingMatches } = useMatches();

  const upcomingMatches = getUpcomingMatches().slice(0, 3);
  const recruitingTeams = getRecruitingTeams().slice(0, 3);
  const activeTournaments = mockTournaments.filter(t => t.status === 'registration');

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.dark, '#0D1420']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>👋 Salut,</Text>
              <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Joueur'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/matches')}>
              <Search size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')}>
              <Bell size={22} color={Colors.text.primary} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.primary.blue, Colors.primary.blueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerCard}
            >
              <View style={styles.bannerContent}>
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>Prêt à jouer ?</Text>
                  <Text style={styles.bannerSubtitle}>
                    Trouvez un match ou créez le vôtre maintenant
                  </Text>
                  <TouchableOpacity 
                    style={styles.bannerButton}
                    onPress={() => router.push('/(tabs)/matches')}
                  >
                    <Text style={styles.bannerButtonText}>Trouver un match</Text>
                    <ChevronRight size={16} color={Colors.primary.blue} />
                  </TouchableOpacity>
                </View>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=300' }}
                  style={styles.bannerImage}
                  contentFit="cover"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/create-match')}
            >
              <LinearGradient
                colors={['rgba(255, 107, 0, 0.2)', 'rgba(255, 107, 0, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Swords size={24} color={Colors.primary.orange} />
              </LinearGradient>
              <Text style={styles.quickActionText}>Créer match</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/create-team')}
            >
              <LinearGradient
                colors={['rgba(21, 101, 192, 0.2)', 'rgba(21, 101, 192, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Users size={24} color={Colors.primary.blue} />
              </LinearGradient>
              <Text style={styles.quickActionText}>Créer équipe</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/matches')}
            >
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Trophy size={24} color={Colors.status.success} />
              </LinearGradient>
              <Text style={styles.quickActionText}>Tournois</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)']}
                style={styles.quickActionGradient}
              >
                <TrendingUp size={24} color="#8B5CF6" />
              </LinearGradient>
              <Text style={styles.quickActionText}>Stats</Text>
            </TouchableOpacity>
          </View>

          {activeTournaments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏆 Tournois en cours</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {activeTournaments.map((tournament) => (
                  <TouchableOpacity key={tournament.id} activeOpacity={0.8}>
                    <LinearGradient
                      colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tournamentCard}
                    >
                      <View style={styles.tournamentBadge}>
                        <Trophy size={14} color="#FFFFFF" />
                        <Text style={styles.tournamentBadgeText}>
                          {tournament.prizePool.toLocaleString()} FCFA
                        </Text>
                      </View>
                      <Text style={styles.tournamentName}>{tournament.name}</Text>
                      <Text style={styles.tournamentInfo}>
                        {sportLabels[tournament.sport]} • {tournament.format}
                      </Text>
                      <View style={styles.tournamentMeta}>
                        <Calendar size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.tournamentDate}>
                          {formatDate(tournament.startDate)}
                        </Text>
                      </View>
                      <View style={styles.tournamentTeams}>
                        <Text style={styles.tournamentTeamsText}>
                          {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚽ Matchs à venir</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            
            {upcomingMatches.length > 0 ? (
              upcomingMatches.map((match) => (
                <Card 
                  key={match.id} 
                  style={styles.matchCard}
                  onPress={() => router.push(`/match/${match.id}`)}
                  variant="gradient"
                >
                  <View style={styles.matchHeader}>
                    <View style={styles.matchTypeBadge}>
                      <Text style={styles.matchTypeText}>
                        {match.type === 'friendly' ? 'Amical' : match.type === 'ranked' ? 'Classé' : 'Tournoi'}
                      </Text>
                    </View>
                    <Text style={styles.matchLevel}>{levelLabels[match.level]}</Text>
                  </View>
                  <Text style={styles.matchSport}>
                    {sportLabels[match.sport]} • {match.format}
                  </Text>
                  <View style={styles.matchDetails}>
                    <View style={styles.matchDetail}>
                      <Calendar size={14} color={Colors.text.muted} />
                      <Text style={styles.matchDetailText}>
                        {formatDate(match.dateTime)} à {formatTime(match.dateTime)}
                      </Text>
                    </View>
                    <View style={styles.matchDetail}>
                      <MapPin size={14} color={Colors.text.muted} />
                      <Text style={styles.matchDetailText}>{match.venue.name}</Text>
                    </View>
                  </View>
                  <View style={styles.matchFooter}>
                    <Text style={styles.matchPlayers}>
                      {match.registeredPlayers.length}/{match.maxPlayers} joueurs
                    </Text>
                    {match.prize && (
                      <Text style={styles.matchPrize}>
                        💰 {match.prize.toLocaleString()} FCFA
                      </Text>
                    )}
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucun match prévu</Text>
                <TouchableOpacity onPress={() => router.push('/create-match')}>
                  <Text style={styles.emptyLink}>Créer un match</Text>
                </TouchableOpacity>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>👥 Équipes qui recrutent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/teams')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            
            {recruitingTeams.length > 0 ? (
              recruitingTeams.map((team) => (
                <Card 
                  key={team.id} 
                  style={styles.teamCard}
                  onPress={() => router.push(`/team/${team.id}`)}
                >
                  <View style={styles.teamRow}>
                    <Avatar uri={team.logo} name={team.name} size="large" />
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamMeta}>
                        {sportLabels[team.sport]} • {team.format} • {levelLabels[team.level]}
                      </Text>
                      <View style={styles.teamLocation}>
                        <MapPin size={12} color={Colors.text.muted} />
                        <Text style={styles.teamLocationText}>{team.city}</Text>
                      </View>
                    </View>
                    <View style={styles.teamStats}>
                      <Text style={styles.teamMemberCount}>
                        {team.members.length}/{team.maxMembers}
                      </Text>
                      <Text style={styles.teamMemberLabel}>membres</Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucune équipe disponible</Text>
              </Card>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    color: Colors.text.muted,
    fontSize: 14,
  },
  userName: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary.orange,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  bannerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 4,
  },
  bannerButtonText: {
    color: Colors.primary.blue,
    fontWeight: '600' as const,
    fontSize: 14,
  },
  bannerImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  quickAction: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  quickActionText: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  seeAll: {
    color: Colors.primary.orange,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  horizontalScroll: {
    gap: 12,
  },
  tournamentCard: {
    width: width * 0.7,
    padding: 16,
    borderRadius: 16,
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tournamentBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  tournamentName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  tournamentInfo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 12,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tournamentDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  tournamentTeams: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tournamentTeamsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  matchCard: {
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchTypeBadge: {
    backgroundColor: Colors.primary.blue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchTypeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  matchLevel: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  matchSport: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  matchDetails: {
    gap: 6,
    marginBottom: 12,
  },
  matchDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchDetailText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  matchPlayers: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  matchPrize: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  teamCard: {
    marginBottom: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  teamInfo: {
    flex: 1,
    gap: 4,
  },
  teamName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  teamMeta: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  teamLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLocationText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  teamStats: {
    alignItems: 'center',
  },
  teamMemberCount: {
    color: Colors.primary.orange,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  teamMemberLabel: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
  },
  emptyLink: {
    color: Colors.primary.blue,
    fontSize: 14,
    fontWeight: '500' as const,
    marginTop: 8,
  },
  bottomSpacer: {
    height: 20,
  },
});