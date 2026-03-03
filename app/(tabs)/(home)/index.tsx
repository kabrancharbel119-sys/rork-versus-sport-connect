import React, { useEffect, useState } from 'react';
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
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { SafeAreaView } from 'react-native-safe-area-context';

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
  CheckCircle,
  Flame,
  Star,
  Award,
  Clock,
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
  const { tournaments, getUserTournaments, getActiveTournaments } = useTournaments();

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
  const allTournaments = [...getActiveTournaments(), ...tournaments.filter(t => t.status === 'completed')]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .sort((a, b) => {
      const order: Record<string, number> = { in_progress: 0, registration: 1, completed: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 8);
  const userTournaments = user ? getUserTournaments(user.id).slice(0, 5) : [];

  // User stats
  const userStats = {
    matchesPlayed: user?.stats?.matchesPlayed ?? 0,
    wins: user?.stats?.wins ?? 0,
    streak: 3, // Demo: consecutive days active
    rank: user?.isPremium ? 'Premium' : 'Standard',
    level: Math.floor((user?.stats?.matchesPlayed ?? 0) / 5) + 1,
  };

  // Recent notifications (last 3)
  const recentNotifications = [
    { id: '1', title: 'Match confirmé', desc: 'Football 5v5 demain à 18h', time: '2h', icon: 'check' },
    { id: '2', title: 'Nouvelle demande', desc: 'Les Lions veulent te recruter', time: '5h', icon: 'users' },
    { id: '3', title: 'Tournoi bientôt', desc: 'Coupe de Basketball dans 2j', time: '1j', icon: 'trophy' },
  ].slice(0, unreadNotifs > 0 ? 3 : 0);

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

  const statusColors: Record<string, [string, string]> = {
    registration: [Colors.gradient.orangeStart, Colors.gradient.orangeEnd],
    in_progress: ['#1E6B3A', '#0F4A26'],
    completed: [Colors.background.card, Colors.background.cardLight],
  };
  const statusLabels: Record<string, string> = {
    registration: 'Inscriptions',
    in_progress: 'En cours',
    completed: 'Terminé',
  };
  const statusDotColors: Record<string, string> = {
    registration: Colors.status.success,
    in_progress: '#4ADE80',
    completed: Colors.text.muted,
  };

  const getCountdownLabel = (startDate: string | Date | null | undefined) => {
    if (!startDate) return null;
    const now = new Date();
    const start = new Date(startDate);
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays <= 7) return `Dans ${diffDays}j`;
    if (diffDays <= 30) return `Dans ${Math.ceil(diffDays / 7)} sem.`;
    return null;
  };

  const TournamentCard = ({ tournament, index }: { tournament: any; index?: number }) => {
    const gradientColors = statusColors[tournament.status] ?? statusColors.registration;
    const regPct = tournament.maxTeams > 0
      ? (tournament.registeredTeams.length / tournament.maxTeams)
      : 0;
    const countdown = tournament.status === 'registration' ? getCountdownLabel(tournament.startDate) : null;
    const isCompleted = tournament.status === 'completed';
    const isLive = tournament.status === 'in_progress';
    const levelText = levelLabels?.[tournament.level] ?? '';

    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push(`/tournament/${tournament.id}`)}
          style={[styles.tournamentCardWrap, cardShadow]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.tournamentCard, isCompleted && styles.tournamentCardCompleted]}
          >
          <View style={styles.tournamentTop}>
            <View style={styles.tournamentStatusBadge}>
              <View style={[styles.tournamentStatusDot, { backgroundColor: statusDotColors[tournament.status] ?? Colors.text.muted }]} />
              <Text style={styles.tournamentStatusText}>{statusLabels[tournament.status] ?? tournament.status}</Text>
            </View>
            {countdown && (
              <View style={styles.tournamentCountdownBadge}>
                <Text style={styles.tournamentCountdownText}>{countdown}</Text>
              </View>
            )}
            {isLive && (
              <View style={styles.tournamentLiveBadge}>
                <View style={styles.tournamentLiveDot} />
                <Text style={styles.tournamentLiveText}>LIVE</Text>
              </View>
            )}
          </View>

          <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>

          <View style={styles.tournamentInfoRow}>
            <Text style={styles.tournamentInfoChip}>{sportLabels[tournament.sport]}</Text>
            <Text style={styles.tournamentInfoChip}>{tournament.format}</Text>
            {levelText ? <Text style={styles.tournamentInfoChip}>{levelText}</Text> : null}
          </View>

          {tournament.status === 'registration' && (
            <View style={styles.tournamentProgressWrap}>
              <View style={styles.tournamentProgressBg}>
                <View style={[styles.tournamentProgressFill, { width: `${Math.min(regPct * 100, 100)}%` }]} />
              </View>
              <Text style={styles.tournamentProgressLabel}>
                {tournament.registeredTeams.length}/{tournament.maxTeams} équipes
              </Text>
            </View>
          )}

          <View style={styles.tournamentBottom}>
            <View style={styles.tournamentDateRow}>
              <Calendar size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.tournamentDate}>{formatDate(tournament.startDate)}</Text>
            </View>
            {tournament.venue?.city && (
              <View style={styles.tournamentVenueRow}>
                <MapPin size={10} color="rgba(255,255,255,0.7)" />
                <Text style={styles.tournamentVenueText} numberOfLines={1}>{tournament.venue.city}</Text>
              </View>
            )}
            {tournament.status !== 'registration' && (
              <View style={styles.tournamentTeams}>
                <Users size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.tournamentTeamsText}>
                  {tournament.registeredTeams.length}
                </Text>
              </View>
            )}
            {isCompleted && (
              <View style={styles.tournamentCompletedBadge}>
                <CheckCircle size={12} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>

          {tournament.prizePool > 0 && (
            <View style={styles.tournamentPrizeBadge}>
              <Trophy size={11} color="#FFD700" />
              <Text style={styles.tournamentPrizeText}>{tournament.prizePool.toLocaleString()} FCFA</Text>
            </View>
          )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const TeamCard = ({ team, index }: { team: any; index?: number }) => {
    return (
      <View>
        <TouchableOpacity
          style={[styles.teamCard, cardShadow]}
          onPress={() => router.push(`/team/${team.id}`)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary.blue + '08', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.teamCardGradient}
          />
          <View style={styles.teamCardAccent} />
      <View style={styles.teamRow}>
        <Avatar uri={team.logo} name={team.name} size="large" />
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
          <View style={styles.teamMetaRow}>
            <View style={styles.teamMetaChip}><Text style={styles.teamMetaChipText}>{sportLabels[team.sport]}</Text></View>
            <View style={styles.teamMetaChip}><Text style={styles.teamMetaChipText}>{team.format}</Text></View>
          </View>
          {team.city && (
            <View style={styles.teamLocation}>
              <MapPin size={11} color={Colors.text.muted} />
              <Text style={styles.teamLocationText} numberOfLines={1}>{team.city}</Text>
            </View>
          )}
        </View>
        <View style={styles.teamStats}>
          <Text style={styles.teamMembersNum}>{team.members.length}</Text>
          <Text style={styles.teamMembersLabel}>/{team.maxMembers}</Text>
        </View>
        <ChevronRight size={16} color={Colors.text.muted} />
        </View>
      </TouchableOpacity>
      </View>
    );
  };

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
    { icon: Trophy, color: '#FFD700', label: 'Classements', route: '/rankings', desc: 'Global' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#060A10', '#0A0E16', Colors.background.dark, '#0B1018', '#0D1420']}
        locations={[0, 0.2, 0.5, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.backgroundPattern}>
        <View style={[styles.patternCircle, { top: -100, right: -50 }]} />
        <View style={[styles.patternCircle, { bottom: 100, left: -80 }]} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />
          }
        >
          <View style={styles.header}>
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
                  <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                  <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Joueur'}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/search')} accessibilityLabel="Recherche" accessibilityRole="button">
                  <Search size={20} color={Colors.text.primary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" accessibilityRole="button">
                  <Bell size={20} color={Colors.text.primary} strokeWidth={2} />
                  {unreadNotifs > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeNum}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View>
            <TouchableOpacity
              activeOpacity={0.93}
              onPress={() => router.push('/(tabs)/matches')}
              style={[styles.bannerWrap, cardShadow]}
            >
              <LinearGradient
                colors={['#0E4DA4', '#1565C0', '#0D47A1', '#0A3D8F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.banner}
              >
                <View style={styles.bannerGlow} />
                <View style={styles.bannerContent}>
                  <View style={styles.bannerLeft}>
                    <View style={styles.bannerPill}>
                      <Zap size={11} color="#FFD700" />
                      <Text style={styles.bannerPillText}>Prêt à jouer</Text>
                    </View>
                    <Text style={styles.bannerTitle}>Trouve un{'\n'}match</Text>
                    <Text style={styles.bannerSub}>Ou crée le tien en un clic</Text>
                    <View style={styles.bannerCta}>
                      <Text style={styles.bannerCtaText}>Voir les matchs</Text>
                      <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
                    </View>
                  </View>
                  <View style={styles.bannerRight}>
                    <View style={styles.bannerCircle}>
                      <Swords size={36} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.quickWrap}>
            <View style={styles.quickGrid}>
              {quickItems.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickItem}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={[`${item.color}18`, `${item.color}08`]} style={styles.quickIconBg}>
                    <item.icon size={22} color={item.color} strokeWidth={2} />
                  </LinearGradient>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                  <Text style={styles.quickDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* User Stats Widget */}
          <View style={styles.statsWidget}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIconBg, { backgroundColor: Colors.primary.blue + '15' }]}>
                  <Swords size={18} color={Colors.primary.blue} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>{userStats.matchesPlayed}</Text>
                <Text style={styles.statLabel}>Matchs</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIconBg, { backgroundColor: Colors.status.success + '15' }]}>
                  <Trophy size={18} color={Colors.status.success} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>{userStats.wins}</Text>
                <Text style={styles.statLabel}>Victoires</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIconBg, { backgroundColor: Colors.primary.orange + '15' }]}>
                  <Flame size={18} color={Colors.primary.orange} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>{userStats.streak}</Text>
                <Text style={styles.statLabel}>Jours</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIconBg, { backgroundColor: '#8B5CF6' + '15' }]}>
                  <Award size={18} color="#8B5CF6" strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>Niv. {userStats.level}</Text>
                <Text style={styles.statLabel}>Niveau</Text>
              </View>
            </View>
          </View>

          {/* Recent Notifications Preview */}
          {recentNotifications.length > 0 && (
            <TouchableOpacity
              style={[styles.notifPreview, cardShadow]}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.9}
            >
              <View style={styles.notifHeader}>
                <View style={styles.notifTitleRow}>
                  <Bell size={16} color={Colors.primary.orange} strokeWidth={2} />
                  <Text style={styles.notifTitle}>Notifications récentes</Text>
                </View>
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifs}</Text>
                </View>
              </View>
              {recentNotifications.map((notif, idx) => (
                <View key={notif.id} style={[styles.notifItem, idx < recentNotifications.length - 1 && styles.notifItemBorder]}>
                  <View style={styles.notifIconWrap}>
                    {notif.icon === 'check' && <CheckCircle size={14} color={Colors.status.success} />}
                    {notif.icon === 'users' && <Users size={14} color={Colors.primary.blue} />}
                    {notif.icon === 'trophy' && <Trophy size={14} color={Colors.primary.orange} />}
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifItemTitle}>{notif.title}</Text>
                    <Text style={styles.notifItemDesc}>{notif.desc}</Text>
                  </View>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
              ))}
            </TouchableOpacity>
          )}

          {userTournaments.length > 0 && (
            <Section
              title="Mes tournois"
              subtitle={`${userTournaments.filter(t => t.status === 'in_progress').length > 0 ? userTournaments.filter(t => t.status === 'in_progress').length + ' en cours' : userTournaments.length + ' tournoi' + (userTournaments.length > 1 ? 's' : '')}`}
              icon={Trophy}
              onSeeAll={() => router.push('/tournaments')}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {userTournaments
                  .sort((a, b) => {
                    const o: Record<string, number> = { in_progress: 0, registration: 1, completed: 2 };
                    return (o[a.status] ?? 3) - (o[b.status] ?? 3);
                  })
                  .map((t, idx) => (
                    <TournamentCard key={t.id} tournament={t} index={idx} />
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
              userTeams.slice(0, 3).map((team, idx) => <TeamCard key={team.id} team={team} index={idx} />)
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
              otherTeamsInCity.map((team, idx) => <TeamCard key={team.id} team={team} index={idx} />)
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

          <Section title="Tournois" subtitle="Découvrir et participer" icon={Trophy} onSeeAll={() => router.push('/tournaments')}>
            {allTournaments.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {allTournaments.map((t, idx) => (
                  <TournamentCard key={t.id} tournament={t} index={idx} />
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
                <Text style={styles.emptyTextSmall}>Aucun tournoi pour le moment</Text>
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
              recruitingTeams.map((team, idx) => <TeamCard key={team.id} team={team} index={idx} />)
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
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primary.orange + '08',
    opacity: 0.3,
  },
  header: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 20,
    marginBottom: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: {
    borderWidth: 3,
    borderColor: Colors.primary.orange + '70',
    borderRadius: 999,
    padding: 3,
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: { gap: 1 },
  greeting: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' as const },
  userName: { color: Colors.text.primary, fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.background.card + 'EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border.light + '80',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.background.dark,
  },
  badgeNum: { color: '#FFF', fontSize: 10, fontWeight: '600' as const },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 28 },
  bannerWrap: {
    borderRadius: RADIUS + 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  banner: {
    borderRadius: RADIUS + 2,
    overflow: 'hidden',
    minHeight: 170,
    position: 'relative',
  },
  bannerGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.5,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    minHeight: 170,
  },
  bannerLeft: { flex: 1, justifyContent: 'center', paddingRight: 16 },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bannerPillText: { color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '500' as const },
  bannerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600' as const,
    marginBottom: 8,
    letterSpacing: -0.7,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 18, fontWeight: '500' as const },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bannerCtaText: { color: '#FFF', fontWeight: '500' as const, fontSize: 13 },
  bannerRight: { alignItems: 'center', justifyContent: 'center' },
  bannerCircle: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  quickWrap: {
    marginBottom: 32,
  },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  quickItem: { flex: 1, alignItems: 'center', gap: 9, backgroundColor: Colors.background.card + 'DD', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 6, borderWidth: 1.5, borderColor: Colors.border.light + '70', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  quickIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  quickLabel: { color: Colors.text.primary, fontSize: 12, fontWeight: '600' as const, letterSpacing: -0.2 },
  quickDesc: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },
  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary.orange + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary.orange + '40',
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.3 },
  sectionSubtitle: { color: Colors.text.muted, fontSize: 12, marginTop: 3, fontWeight: '500' as const },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.orange + '15', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary.orange + '25' },
  seeAllText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '600' as const },
  hScroll: { gap: GAP, paddingRight: PAD },
  tournamentCardWrap: { borderRadius: CARD_R, overflow: 'hidden', width: width * 0.72 },
  tournamentCard: { padding: 20, borderRadius: CARD_R, minHeight: 170, justifyContent: 'space-between' },
  tournamentCardCompleted: { opacity: 0.8 },
  tournamentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tournamentStatusDot: { width: 7, height: 7, borderRadius: 4 },
  tournamentStatusText: { color: '#FFF', fontSize: 10, fontWeight: '500' as const },
  tournamentCountdownBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tournamentCountdownText: { color: '#FFF', fontSize: 10, fontWeight: '500' as const },
  tournamentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  tournamentProgressWrap: { marginTop: 8, marginBottom: 2 },
  tournamentProgressBg: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  tournamentProgressFill: { height: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  tournamentProgressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, fontWeight: '500' as const },
  tournamentPrizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  tournamentPrizeText: { color: '#FFD700', fontSize: 11, fontWeight: '600' as const },
  tournamentCompletedBadge: { marginLeft: 4 },
  tournamentLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,59,48,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tournamentLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  tournamentLiveText: { color: '#FFF', fontSize: 9, fontWeight: '600' as const, letterSpacing: 0.8 },
  tournamentVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 100 },
  tournamentVenueText: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  tournamentTeams: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tournamentTeamsText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' as const },
  tournamentName: { color: '#FFF', fontSize: 18, fontWeight: '600' as const, marginBottom: 7, letterSpacing: -0.4, lineHeight: 23, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tournamentInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' },
  tournamentInfoChip: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' as const, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  tournamentDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tournamentDate: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  teamCard: { marginBottom: 12, borderRadius: 18, overflow: 'hidden', backgroundColor: Colors.background.card, flexDirection: 'row', borderWidth: 1.5, borderColor: Colors.border.light + '90', position: 'relative' },
  teamCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  teamCardAccent: { width: 5, backgroundColor: Colors.primary.blue, zIndex: 1, shadowColor: Colors.primary.blue, shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    flex: 1,
  },
  teamInfo: { flex: 1, minWidth: 0, gap: 4 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  teamMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teamMetaChip: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  teamMetaChipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  teamLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamLocationText: { color: Colors.text.muted, fontSize: 11, flex: 1 },
  teamStats: { alignItems: 'center', flexDirection: 'row' },
  teamMembersNum: { color: Colors.primary.orange, fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.5 },
  teamMembersLabel: { color: Colors.text.muted, fontSize: 12 },
  matchCard: { marginBottom: 12, borderRadius: 18, overflow: 'hidden' },
  matchCardRanked: { borderLeftWidth: 5, borderLeftColor: Colors.primary.orange, shadowColor: Colors.primary.orange, shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 6 },
  matchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  matchBadge: { backgroundColor: Colors.primary.blue + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  matchBadgeRanked: { backgroundColor: Colors.primary.orange + '20' },
  matchBadgeText: { color: Colors.primary.blue, fontSize: 10, fontWeight: '500' as const },
  matchLevel: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  rankedTagline: { color: Colors.primary.orange, fontSize: 10, fontWeight: '600' as const, marginBottom: 4 },
  matchSport: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 10, letterSpacing: -0.2 },
  matchMeta: { gap: 6, marginBottom: 12 },
  matchMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchMetaText: { color: Colors.text.secondary, fontSize: 13, flex: 1 },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  matchPlayers: { color: Colors.text.muted, fontSize: 12 },
  matchPrize: { color: Colors.primary.orange, fontSize: 12, fontWeight: '500' as const },
  rankedLabel: { color: Colors.primary.orange, fontSize: 11, fontWeight: '500' as const },
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 28,
    position: 'relative',
  },
  emptyIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: Colors.primary.blue + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: Colors.primary.blue + '30',
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 8, letterSpacing: -0.3 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20, fontWeight: '500' as const },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary.orange + '18',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary.orange + '30',
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyCtaText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' as const, letterSpacing: -0.2 },
  emptyCardSmall: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  emptyTextSmall: { color: Colors.text.muted, fontSize: 13, marginBottom: 10 },
  emptyLink: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
  spacer: { height: 40 },
  statsWidget: {
    backgroundColor: Colors.background.card + 'DD',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: Colors.border.light + '70',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statItem: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBg: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.5 },
  statLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const },
  notifPreview: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: Colors.border.light + '80',
  },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.2 },
  notifBadge: {
    backgroundColor: Colors.primary.orange,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notifBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  notifItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  notifIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: { flex: 1, gap: 2 },
  notifItemTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '500' as const },
  notifItemDesc: { color: Colors.text.muted, fontSize: 11 },
  notifTime: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },
});
