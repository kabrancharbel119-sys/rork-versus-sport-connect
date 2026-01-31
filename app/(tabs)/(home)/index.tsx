import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Bell,
  Search,
  Trophy,
  Users,
  Swords,
  TrendingUp,
  MapPin,
  Calendar,
  ChevronRight,
  Sparkles,
  Zap,
  Target,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { sportLabels, levelLabels } from '@/mocks/data';

const { width } = Dimensions.get('window');
const PAD = 20;
const GAP = 14;
const RADIUS = 20;
const CARD_R = 18;

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (date: Date) =>
  new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
};

const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  android: { elevation: 6 },
}) as ViewStyle;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUnreadCount, refetchNotifications } = useNotifications();
  const { getRecruitingTeams, getUserTeams, getAllTeams, teams, getPendingRequests, refetchTeams } = useTeams();
  const { getUpcomingMatches, matches } = useMatches();
  const { getUserTournaments, getActiveTournaments } = useTournaments();

  const [refreshing, setRefreshing] = React.useState(false);
  const pendingTeamRequestsCount = user
    ? teams.filter((t) => t.captainId === user.id || (t.coCaptainIds ?? []).includes(user.id)).reduce((sum, t) => sum + getPendingRequests(t.id).length, 0)
    : 0;
  const unreadNotifs = getUnreadCount() + pendingTeamRequestsCount;

  const userTeams = user ? getUserTeams(user.id) : [];
  const myTeam = userTeams[0] ?? null;
  const allTeams = getAllTeams();
  const city = user?.city?.trim()?.toLowerCase();
  const otherTeamsInCity = allTeams
    .filter((t) => {
      if (myTeam && t.id === myTeam.id) return false;
      if (city && t.city?.toLowerCase() !== city) return false;
      return true;
    })
    .slice(0, 5);

  const upcomingMatches = getUpcomingMatches().slice(0, 3);
  const userCreatedMatches = user
    ? matches.filter((m) => m.createdBy === user.id && m.status !== 'completed').slice(0, 3)
    : [];
  const displayMatches = upcomingMatches.length > 0 ? upcomingMatches : userCreatedMatches;
  const recruitingTeams = getRecruitingTeams()
    .filter((t) => !userTeams.some((ut) => ut.id === t.id))
    .slice(0, 3);
  const activeTournaments = getActiveTournaments().filter((t) => t.status === 'registration').slice(0, 5);
  const userTournaments = user ? getUserTournaments(user.id).slice(0, 5) : [];

  useEffect(() => {
    if (__DEV__) {
      console.log('[Home] allTeams:', allTeams?.length ?? 0);
      console.log('[Home] otherTeamsInCity:', otherTeamsInCity?.length ?? 0);
      console.log('[Home] matches:', matches?.length ?? 0);
      console.log('[Home] upcomingMatches:', upcomingMatches?.length ?? 0);
      console.log('[Home] displayMatches (à afficher):', displayMatches?.length ?? 0, displayMatches);
    }
  }, [allTeams, otherTeamsInCity, matches, upcomingMatches, displayMatches]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchNotifications(), refetchTeams()]);
    } finally {
      setRefreshing(false);
    }
  };

  const TournamentCard = ({ tournament, colors }: { tournament: any; colors: [string, string] }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/tournament/${tournament.id}`)}
      style={[styles.tournamentCardWrap, cardShadow]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tournamentCard}
      >
        <View style={styles.tournamentTop}>
          <View style={styles.tournamentBadge}>
            <Trophy size={13} color="#FFF" />
            <Text style={styles.tournamentBadgeText}>{tournament.prizePool.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.tournamentTeams}>
            <Text style={styles.tournamentTeamsText}>
              {tournament.registeredTeams.length}/{tournament.maxTeams}
            </Text>
            <Text style={styles.tournamentTeamsLabel}>équipes</Text>
          </View>
        </View>
        <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>
        <Text style={styles.tournamentInfo}>{sportLabels[tournament.sport]} • {tournament.format}</Text>
        <View style={styles.tournamentDateRow}>
          <Calendar size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.tournamentDate}>{formatDate(tournament.startDate)}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const TeamCard = ({ team }: { team: any }) => (
    <Card
      style={[styles.teamCard, cardShadow]}
      onPress={() => router.push(`/team/${team.id}`)}
      variant="gradient"
    >
      <View style={styles.teamRow}>
        <View style={styles.teamAvatarWrap}>
          <Avatar uri={team.logo} name={team.name} size="large" />
        </View>
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.teamMeta}>{sportLabels[team.sport]} • {team.format}</Text>
          <View style={styles.teamLocation}>
            <MapPin size={12} color={Colors.text.muted} />
            <Text style={styles.teamLocationText} numberOfLines={1}>{team.city}</Text>
          </View>
        </View>
        <View style={styles.teamStats}>
          <Text style={styles.teamMembersNum}>{team.members.length}/{team.maxMembers}</Text>
          <Text style={styles.teamMembersLabel}>membres</Text>
        </View>
        <ChevronRight size={18} color={Colors.text.muted} />
      </View>
    </Card>
  );

  const Section = ({
    title,
    subtitle,
    onSeeAll,
    icon: Icon,
    children,
  }: {
    title: string;
    subtitle?: string;
    onSeeAll?: () => void;
    icon?: typeof Trophy;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {Icon && (
            <View style={styles.sectionIconWrap}>
              <Icon size={16} color={Colors.primary.orange} />
            </View>
          )}
          <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {onSeeAll && (
          <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll} hitSlop={12}>
            <Text style={styles.seeAllText}>Voir tout</Text>
            <ChevronRight size={18} color={Colors.primary.orange} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );

  const quickItems = [
    { icon: Swords, color: Colors.primary.orange, label: 'Match', route: '/create-match', desc: 'Créer' },
    { icon: Users, color: Colors.primary.blue, label: 'Équipe', route: '/create-team', desc: 'Rejoindre' },
    { icon: Trophy, color: Colors.status.success, label: 'Tournoi', route: '/tournaments', desc: 'Découvrir' },
    { icon: TrendingUp, color: '#8B5CF6', label: 'Stats', route: '/(tabs)/profile', desc: 'Profil' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#060A10', Colors.background.dark, '#0B1018', '#0D1420']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />
          }
        >
          <View style={[styles.header, Platform.OS === 'ios' && styles.headerBlur]}>
            {Platform.OS === 'ios' && <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />}
            <View style={styles.headerInner}>
              <TouchableOpacity
                style={styles.headerLeft}
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.75}
              >
                <View style={styles.avatarRing}>
                  <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.greeting}>{getGreeting()}</Text>
                  <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Joueur'}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/search')} accessibilityLabel="Recherche" accessibilityRole="button">
                  <Search size={21} color={Colors.text.primary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" accessibilityRole="button">
                  <Bell size={21} color={Colors.text.primary} strokeWidth={2} />
                  {unreadNotifs > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeNum}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.97}
            onPress={() => router.push('/(tabs)/matches')}
            style={[styles.bannerWrap, cardShadow]}
          >
            <LinearGradient
              colors={['#1a5490', Colors.primary.blue, '#0D47A1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.25)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bannerContent}>
                <View style={styles.bannerLeft}>
                  <View style={styles.bannerPill}>
                    <Zap size={12} color="rgba(255,255,255,0.95)" />
                    <Text style={styles.bannerPillText}>Prêt à jouer</Text>
                  </View>
                  <Text style={styles.bannerTitle}>Trouve un match</Text>
                  <Text style={styles.bannerSub}>Ou crée le tien en un clic</Text>
                  <View style={styles.bannerCta}>
                    <Text style={styles.bannerCtaText}>Voir les matchs</Text>
                    <ChevronRight size={20} color={Colors.primary.blue} strokeWidth={2.5} />
                  </View>
                </View>
                <View style={styles.bannerImgWrap}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400' }}
                    style={styles.bannerImg}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)']}
                    style={styles.bannerImgOverlay}
                  />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={[styles.quickWrap, cardShadow]}>
            <View style={styles.quickGrid}>
              {quickItems.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickItem}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickIconBg, { backgroundColor: `${item.color}22` }]}>
                    <item.icon size={24} color={item.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                  <Text style={styles.quickDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {userTournaments.length > 0 && (
            <Section
              title="Mes tournois"
              subtitle="Inscriptions en cours"
              icon={Trophy}
              onSeeAll={() => router.push('/tournaments')}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {userTournaments.map((t) => (
                  <TournamentCard key={t.id} tournament={t} colors={[Colors.primary.blue, Colors.primary.blueDark]} />
                ))}
              </ScrollView>
            </Section>
          )}

          <Section
            title="Mon équipe"
            subtitle={myTeam ? undefined : 'Rejoins ou crée une équipe'}
            icon={Target}
            onSeeAll={() => router.push('/(tabs)/teams')}
          >
            {userTeams.length > 0 ? (
              userTeams.slice(0, 3).map((team) => <TeamCard key={team.id} team={team} />)
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/create-team')}
                style={[styles.emptyCard, cardShadow]}
              >
                <LinearGradient
                  colors={[Colors.background.card, Colors.background.cardLight]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.emptyIconWrap}>
                  <Users size={36} color={Colors.primary.blue} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>Aucune équipe</Text>
                <Text style={styles.emptyText}>Crée la tienne ou rejoins une équipe près de toi</Text>
                <View style={styles.emptyCta}>
                  <Sparkles size={16} color={Colors.primary.orange} />
                  <Text style={styles.emptyCtaText}>Créer une équipe</Text>
                </View>
              </TouchableOpacity>
            )}
          </Section>

          <Section
            title={city ? `Équipes à ${user?.city ?? ''}` : 'Autres équipes'}
            subtitle="À découvrir"
            icon={Users}
            onSeeAll={() => router.push('/(tabs)/teams')}
          >
            {otherTeamsInCity.length > 0 ? (
              otherTeamsInCity.map((team) => <TeamCard key={team.id} team={team} />)
            ) : (
              <View style={styles.emptyCardSmall}>
                <Text style={styles.emptyTextSmall}>
                  {city ? `Aucune autre équipe à ${user?.city ?? ''}` : 'Aucune autre équipe'}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/teams')}>
                  <Text style={styles.emptyLink}>Voir les équipes</Text>
                </TouchableOpacity>
              </View>
            )}
          </Section>

          <Section title="Tournois ouverts" icon={Trophy} onSeeAll={() => router.push('/tournaments')}>
            {activeTournaments.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {activeTournaments.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    colors={[Colors.gradient.orangeStart, Colors.gradient.orangeEnd]}
                  />
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/tournaments')}
                style={styles.emptyCardSmall}
              >
                <View style={{ marginBottom: 8 }}>
                  <Trophy size={32} color={Colors.text.muted} />
                </View>
                <Text style={styles.emptyTextSmall}>Aucun tournoi en inscription pour le moment</Text>
                <Text style={styles.emptyLink}>Voir les tournois</Text>
              </TouchableOpacity>
            )}
          </Section>

          <Section
            title="Matchs à venir"
            subtitle="Prochains rendez-vous"
            icon={Swords}
            onSeeAll={() => router.push('/(tabs)/matches')}
          >
            {displayMatches.length > 0 ? (
              displayMatches.map((match) => {
                const isRanked = match.type === 'ranked';
                return (
                  <Card
                    key={match.id}
                    style={[styles.matchCard, isRanked && styles.matchCardRanked, cardShadow]}
                    onPress={() => router.push(`/match/${match.id}`)}
                    variant="gradient"
                  >
                    <View style={styles.matchTop}>
                      <View style={[styles.matchBadge, isRanked && styles.matchBadgeRanked]}>
                        <Text style={styles.matchBadgeText}>
                          {match.type === 'friendly' ? 'Amical' : isRanked ? 'Classé' : 'Tournoi'}
                        </Text>
                      </View>
                      <Text style={styles.matchLevel}>{levelLabels[match.level]}</Text>
                    </View>
                    {isRanked && <Text style={styles.rankedTagline}>Compte pour le classement</Text>}
                    <Text style={styles.matchSport}>{sportLabels[match.sport]} • {match.format}</Text>
                    <View style={styles.matchMeta}>
                      <View style={styles.matchMetaRow}>
                        <Calendar size={14} color={Colors.text.muted} />
                        <Text style={styles.matchMetaText}>
                          {formatDate(match.dateTime)} à {formatTime(match.dateTime)}
                        </Text>
                      </View>
                      <View style={styles.matchMetaRow}>
                        <MapPin size={14} color={Colors.text.muted} />
                        <Text style={styles.matchMetaText} numberOfLines={1}>{match.venue.name}</Text>
                      </View>
                    </View>
                    <View style={styles.matchFooter}>
                      <Text style={styles.matchPlayers}>
                        {match.registeredPlayers.length}/{match.maxPlayers} joueurs
                      </Text>
                      {isRanked ? (
                        <Text style={styles.rankedLabel}>Compte pour le rang</Text>
                      ) : match.prize ? (
                        <Text style={styles.matchPrize}>💰 {match.prize.toLocaleString()} FCFA</Text>
                      ) : null}
                    </View>
                  </Card>
                );
              })
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/create-match')}
                style={styles.emptyCardSmall}
              >
                <Text style={styles.emptyTextSmall}>Aucun match prévu</Text>
                <Text style={styles.emptyLink}>Créer un match</Text>
              </TouchableOpacity>
            )}
          </Section>

          <Section title="Équipes qui recrutent" icon={Users} onSeeAll={() => router.push('/(tabs)/teams')}>
            {recruitingTeams.length > 0 ? (
              recruitingTeams.map((team) => <TeamCard key={team.id} team={team} />)
            ) : (
              <View style={styles.emptyCardSmall}>
                <Text style={styles.emptyTextSmall}>Aucune équipe en recrutement</Text>
              </View>
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
  header: {
    paddingHorizontal: PAD,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 16,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBlur: { overflow: 'hidden' },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 2,
  },
  headerText: { gap: 0 },
  greeting: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  userName: { color: Colors.text.primary, fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.2 },
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeNum: { color: '#FFF', fontSize: 11, fontWeight: '800' as const },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 28 },
  bannerWrap: {
    borderRadius: RADIUS,
    marginBottom: 22,
    overflow: 'hidden',
  },
  banner: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    minHeight: 140,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 22,
    minHeight: 140,
  },
  bannerLeft: { flex: 1, justifyContent: 'center', paddingRight: 12 },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  bannerPillText: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '700' as const },
  bannerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 14, lineHeight: 20 },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 }, android: {} }),
  },
  bannerCtaText: { color: Colors.primary.blue, fontWeight: '700' as const, fontSize: 14 },
  bannerImgWrap: { width: 110, height: 110, borderRadius: 16, overflow: 'hidden', alignSelf: 'center' },
  bannerImg: { width: '100%', height: '100%', borderRadius: 16 },
  bannerImgOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  quickWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS,
    marginBottom: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  quickItem: { flex: 1, alignItems: 'center', gap: 8 },
  quickIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' as const },
  quickDesc: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.2 },
  sectionSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  hScroll: { gap: GAP, paddingRight: PAD },
  tournamentCardWrap: { borderRadius: CARD_R, overflow: 'hidden', width: width * 0.72 },
  tournamentCard: { padding: 18, borderRadius: CARD_R, minHeight: 140 },
  tournamentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tournamentBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' as const },
  tournamentTeams: { alignItems: 'flex-end' },
  tournamentTeamsText: { color: '#FFF', fontSize: 16, fontWeight: '800' as const },
  tournamentTeamsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  tournamentName: { color: '#FFF', fontSize: 17, fontWeight: '700' as const, marginBottom: 4 },
  tournamentInfo: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginBottom: 8 },
  tournamentDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tournamentDate: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  teamCard: { marginBottom: GAP, borderRadius: CARD_R, overflow: 'hidden' },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 2,
  },
  teamAvatarWrap: {},
  teamInfo: { flex: 1, minWidth: 0, gap: 4 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13 },
  teamLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamLocationText: { color: Colors.text.muted, fontSize: 12, flex: 1 },
  teamStats: { alignItems: 'center' },
  teamMembersNum: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' as const },
  teamMembersLabel: { color: Colors.text.muted, fontSize: 11 },
  matchCard: { marginBottom: GAP, borderRadius: CARD_R, overflow: 'hidden' },
  matchCardRanked: { borderLeftWidth: 4, borderLeftColor: Colors.primary.orange },
  matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  matchBadge: { backgroundColor: Colors.primary.blue, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  matchBadgeRanked: { backgroundColor: Colors.primary.orange },
  matchBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  matchLevel: { color: Colors.text.muted, fontSize: 12 },
  rankedTagline: { color: Colors.primary.orange, fontSize: 11, fontWeight: '600' as const, marginBottom: 4 },
  matchSport: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginBottom: 10 },
  matchMeta: { gap: 6, marginBottom: 10 },
  matchMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchMetaText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  matchPlayers: { color: Colors.text.muted, fontSize: 13 },
  matchPrize: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },
  rankedLabel: { color: Colors.primary.orange, fontSize: 12, fontWeight: '700' as const },
  emptyCard: {
    borderRadius: CARD_R,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    position: 'relative',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.blue + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, marginBottom: 6 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange + '20',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  emptyCtaText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '700' as const },
  emptyCardSmall: {
    backgroundColor: Colors.background.card,
    borderRadius: CARD_R,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  emptyTextSmall: { color: Colors.text.muted, fontSize: 14, marginBottom: 10 },
  emptyLink: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const },
  spacer: { height: 40 },
});
