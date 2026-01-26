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
import { useTournaments } from '@/contexts/TournamentsContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { sportLabels, levelLabels } from '@/mocks/data';

const { width } = Dimensions.get('window');

const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (date: Date) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getRecruitingTeams, getUserTeams } = useTeams();
  const { getUpcomingMatches, matches } = useMatches();
  const { getUserTournaments, getActiveTournaments } = useTournaments();

  const userTeams = user ? getUserTeams(user.id) : [];
  const upcomingMatches = getUpcomingMatches().slice(0, 3);
  const userCreatedMatches = user ? matches.filter(m => m.createdBy === user.id && m.status !== 'completed').slice(0, 3) : [];
  const displayMatches = upcomingMatches.length > 0 ? upcomingMatches : userCreatedMatches;
  const recruitingTeams = getRecruitingTeams().filter(t => !userTeams.some(ut => ut.id === t.id)).slice(0, 3);
  const activeTournaments = getActiveTournaments().filter(t => t.status === 'registration').slice(0, 5);
  const userTournaments = user ? getUserTournaments(user.id).slice(0, 5) : [];

  const TournamentCard = ({ tournament, colors }: { tournament: any; colors: [string, string] }) => (
    <TouchableOpacity key={tournament.id} activeOpacity={0.8} onPress={() => router.push(`/tournament/${tournament.id}`)}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tournamentCard}>
        <View style={styles.tournamentBadge}>
          <Trophy size={14} color="#FFF" />
          <Text style={styles.badgeText}>{tournament.prizePool.toLocaleString()} FCFA</Text>
        </View>
        <Text style={styles.tournamentName}>{tournament.name}</Text>
        <Text style={styles.tournamentInfo}>{sportLabels[tournament.sport]} • {tournament.format}</Text>
        <View style={styles.row}>
          <Calendar size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.tournamentDate}>{formatDate(tournament.startDate)}</Text>
        </View>
        <View style={styles.teamsCount}>
          <Text style={styles.teamsCountText}>{tournament.registeredTeams.length}/{tournament.maxTeams} équipes</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const TeamCard = ({ team }: { team: any }) => (
    <Card key={team.id} style={styles.teamCard} onPress={() => router.push(`/team/${team.id}`)}>
      <View style={styles.teamRow}>
        <Avatar uri={team.logo} name={team.name} size="large" />
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamMeta}>{sportLabels[team.sport]} • {team.format} • {levelLabels[team.level]}</Text>
          <View style={styles.row}>
            <MapPin size={12} color={Colors.text.muted} />
            <Text style={styles.locationText}>{team.city}</Text>
          </View>
        </View>
        <View style={styles.teamStats}>
          <Text style={styles.memberCount}>{team.members.length}/{team.maxMembers}</Text>
          <Text style={styles.memberLabel}>membres</Text>
        </View>
      </View>
    </Card>
  );

  const Section = ({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: React.ReactNode }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>Voir tout</Text></TouchableOpacity>}
      </View>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>👋 Salut,</Text>
              <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Joueur'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/matches')}>
              <Search size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
              <Bell size={22} color={Colors.text.primary} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient colors={[Colors.primary.blue, Colors.primary.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <View style={styles.bannerContent}>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerTitle}>Prêt à jouer ?</Text>
                  <Text style={styles.bannerSub}>Trouvez un match ou créez le vôtre maintenant</Text>
                  <TouchableOpacity style={styles.bannerBtn} onPress={() => router.push('/(tabs)/matches')}>
                    <Text style={styles.bannerBtnText}>Trouver un match</Text>
                    <ChevronRight size={16} color={Colors.primary.blue} />
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=300' }} style={styles.bannerImg} contentFit="cover" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.quickActions}>
            {[
              { icon: Swords, color: Colors.primary.orange, bg: 'rgba(255, 107, 0, 0.2)', label: 'Créer match', route: '/create-match' },
              { icon: Users, color: Colors.primary.blue, bg: 'rgba(21, 101, 192, 0.2)', label: 'Créer équipe', route: '/create-team' },
              { icon: Trophy, color: Colors.status.success, bg: 'rgba(16, 185, 129, 0.2)', label: 'Tournoi', route: '/create-tournament' },
              { icon: TrendingUp, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.2)', label: 'Stats', route: '/(tabs)/profile' },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.quickAction} onPress={() => router.push(item.route as any)}>
                <LinearGradient colors={[item.bg, item.bg.replace('0.2', '0.05')]} style={styles.quickActionIcon}>
                  <item.icon size={24} color={item.color} />
                </LinearGradient>
                <Text style={styles.quickActionText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {userTournaments.length > 0 && (
            <Section title="🏆 Mes tournois" onSeeAll={() => router.push('/tournaments')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {userTournaments.map(t => <TournamentCard key={t.id} tournament={t} colors={[Colors.primary.blue, Colors.primary.blueDark]} />)}
              </ScrollView>
            </Section>
          )}

          {userTeams.length > 0 && (
            <Section title="🏅 Mes équipes" onSeeAll={() => router.push('/(tabs)/teams')}>
              {userTeams.slice(0, 3).map(team => <TeamCard key={team.id} team={team} />)}
            </Section>
          )}

          {activeTournaments.length > 0 && (
            <Section title="🔥 Tournois ouverts" onSeeAll={() => router.push('/tournaments')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {activeTournaments.map(t => <TournamentCard key={t.id} tournament={t} colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]} />)}
              </ScrollView>
            </Section>
          )}

          <Section title="⚽ Matchs à venir" onSeeAll={() => router.push('/(tabs)/matches')}>
            {displayMatches.length > 0 ? displayMatches.map(match => (
              <Card key={match.id} style={styles.matchCard} onPress={() => router.push(`/match/${match.id}`)} variant="gradient">
                <View style={styles.matchHeader}>
                  <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>{match.type === 'friendly' ? 'Amical' : match.type === 'ranked' ? 'Classé' : 'Tournoi'}</Text></View>
                  <Text style={styles.matchLevel}>{levelLabels[match.level]}</Text>
                </View>
                <Text style={styles.matchSport}>{sportLabels[match.sport]} • {match.format}</Text>
                <View style={styles.matchDetails}>
                  <View style={styles.row}><Calendar size={14} color={Colors.text.muted} /><Text style={styles.detailText}>{formatDate(match.dateTime)} à {formatTime(match.dateTime)}</Text></View>
                  <View style={styles.row}><MapPin size={14} color={Colors.text.muted} /><Text style={styles.detailText}>{match.venue.name}</Text></View>
                </View>
                <View style={styles.matchFooter}>
                  <Text style={styles.matchPlayers}>{match.registeredPlayers.length}/{match.maxPlayers} joueurs</Text>
                  {match.prize && <Text style={styles.matchPrize}>💰 {match.prize.toLocaleString()} FCFA</Text>}
                </View>
              </Card>
            )) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucun match prévu</Text>
                <TouchableOpacity onPress={() => router.push('/create-match')}><Text style={styles.emptyLink}>Créer un match</Text></TouchableOpacity>
              </Card>
            )}
          </Section>

          <Section title="👥 Équipes qui recrutent" onSeeAll={() => router.push('/(tabs)/teams')}>
            {recruitingTeams.length > 0 ? recruitingTeams.map(team => <TeamCard key={team.id} team={team} />) : (
              <Card style={styles.emptyCard}><Text style={styles.emptyText}>Aucune équipe disponible</Text></Card>
            )}
          </Section>

          <View style={styles.spacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { color: Colors.text.muted, fontSize: 14 },
  userName: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  banner: { borderRadius: 20, padding: 20, marginBottom: 24, overflow: 'hidden' },
  bannerContent: { flexDirection: 'row', alignItems: 'center' },
  bannerText: { flex: 1, paddingRight: 12 },
  bannerTitle: { color: '#FFF', fontSize: 22, fontWeight: '700' as const, marginBottom: 8 },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignSelf: 'flex-start', gap: 4 },
  bannerBtnText: { color: Colors.primary.blue, fontWeight: '600' as const, fontSize: 14 },
  bannerImg: { width: 100, height: 100, borderRadius: 16 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  quickAction: { alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border.light },
  quickActionText: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' as const },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  seeAll: { color: Colors.primary.orange, fontSize: 14, fontWeight: '500' as const },
  hScroll: { gap: 12 },
  tournamentCard: { width: width * 0.7, padding: 16, borderRadius: 16 },
  tournamentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
  tournamentName: { color: '#FFF', fontSize: 18, fontWeight: '700' as const, marginBottom: 4 },
  tournamentInfo: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 12 },
  tournamentDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginLeft: 6 },
  teamsCount: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
  teamsCountText: { color: '#FFF', fontSize: 12, fontWeight: '500' as const },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamCard: { marginBottom: 12 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  teamInfo: { flex: 1, gap: 4 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13 },
  locationText: { color: Colors.text.muted, fontSize: 12 },
  teamStats: { alignItems: 'center' },
  memberCount: { color: Colors.primary.orange, fontSize: 18, fontWeight: '700' as const },
  memberLabel: { color: Colors.text.muted, fontSize: 11 },
  matchCard: { marginBottom: 12 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  matchBadge: { backgroundColor: Colors.primary.blue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  matchBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  matchLevel: { color: Colors.text.muted, fontSize: 12 },
  matchSport: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  matchDetails: { gap: 6, marginBottom: 12 },
  detailText: { color: Colors.text.secondary, fontSize: 13, marginLeft: 4 },
  matchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.light },
  matchPlayers: { color: Colors.text.muted, fontSize: 13 },
  matchPrize: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  emptyLink: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const, marginTop: 8 },
  spacer: { height: 20 },
});
