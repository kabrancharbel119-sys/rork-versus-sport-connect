import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  RefreshControl,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell, Search, Trophy, Users, Swords, MapPin,
  ChevronRight, CheckCircle, Flame, ArrowRight, Plus,
  Clock, UserPlus, Zap, Crown, Medal,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Avatar } from '@/components/Avatar';
import { sportLabels } from '@/mocks/data';

const { width } = Dimensions.get('window');
const PAD = 20;

const cardShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
}) as ViewStyle;

/* Animated pulsing dot for live indicators */
const PulseDot = ({ color = '#FF3B30', size = 6 }: { color?: string; size?: number }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }} />
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUnreadCount, refetchNotifications } = useNotifications();
  const { getRecruitingTeams, getUserTeams, teams, getPendingRequests, refetchTeams } = useTeams();
  const { getUpcomingMatches } = useMatches();
  const { tournaments, getActiveTournaments } = useTournaments();

  const [refreshing, setRefreshing] = React.useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const pendingTeamRequestsCount = user
    ? teams.filter((t) => t.captainId === user.id || (t.coCaptainIds ?? []).includes(user.id)).reduce((sum, t) => sum + getPendingRequests(t.id).length, 0)
    : 0;
  const unreadNotifs = getUnreadCount() + pendingTeamRequestsCount;

  const userTeams = user ? getUserTeams(user.id) : [];
  const city = user?.city?.trim() || '';
  const cityLower = city.toLowerCase();
  const hasLocation = !!city;

  const recruitingTeams = getRecruitingTeams()
    .filter((t) => !userTeams.some((ut) => ut.id === t.id))
    .filter((t) => !hasLocation || !t.city || t.city.toLowerCase() === cityLower)
    .slice(0, 5);

  const allTournaments = [...getActiveTournaments(), ...tournaments.filter(t => t.status === 'completed')]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .filter((t) => !hasLocation || !t.venue?.city || t.venue.city.toLowerCase() === cityLower)
    .sort((a, b) => {
      const order: Record<string, number> = { in_progress: 0, registration: 1, completed: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const liveTournaments = allTournaments.filter(t => t.status === 'in_progress');
  const upcomingTournaments = allTournaments.filter(t => t.status === 'registration');
  const completedTournaments = allTournaments.filter(t => t.status === 'completed');

  const upcomingMatches = getUpcomingMatches()
    .filter((m) => !hasLocation || !m.venue?.city || m.venue.city.toLowerCase() === cityLower)
    .slice(0, 3);

  /* ════ FEED CONSTRUCTION ════ */
  type NowItem =
    | { kind: 'live'; data: any }
    | { kind: 'match'; data: any };

  const nowItems: NowItem[] = [
    ...liveTournaments.map(t => ({ kind: 'live' as const, data: t })),
    ...upcomingMatches.map(m => ({ kind: 'match' as const, data: m })),
  ].slice(0, 3);

  type FeedItem =
    | { kind: 'tournament'; data: any }
    | { kind: 'team'; data: any }
    | { kind: 'completed'; data: any };

  const feedItems: FeedItem[] = [
    ...upcomingTournaments.map(t => ({ kind: 'tournament' as const, data: t })),
    ...recruitingTeams.map(t => ({ kind: 'team' as const, data: t })),
    ...completedTournaments.slice(0, 2).map(t => ({ kind: 'completed' as const, data: t })),
  ].slice(0, 6);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchNotifications(), refetchTeams()]);
    } finally {
      setRefreshing(false);
    }
  };

  const isVenueManager = user?.role === 'venue_manager';

  const quickActions = [
    { icon: Swords, color: '#FF6B35', label: 'Match', route: '/(tabs)/matches' },
    { icon: Users, color: '#3B82F6', label: 'Équipe', route: '/(tabs)/teams' },
    { icon: Trophy, color: '#10B981', label: 'Tournoi', route: '/tournaments' },
    ...(isVenueManager ? [] : [{ icon: MapPin, color: '#8B5CF6', label: 'Terrains', route: '/venues?nearby=true' }]),
  ];

  const statusGradients: Record<string, [string, string]> = {
    registration: ['#F97316', '#C2410C'],
    in_progress: ['#10B981', '#065F46'],
    completed: ['#374151', '#1F2937'],
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

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  /* ════ NOW CARD — live tournament or upcoming match ════ */
  const NowCard = ({ item }: { item: NowItem }) => {
    if (item.kind === 'live') {
      const t = item.data;
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/tournament/${t.id}`)}
          style={styles.nowCard}
        >
          <LinearGradient
            colors={statusGradients.in_progress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.6 }}
            style={styles.nowCardGrad}
          >
            <View style={styles.nowCardDecor} />
            <View style={styles.nowCardTop}>
              <View style={styles.livePill}>
                <PulseDot color="#FF3B30" size={6} />
                <Text style={styles.livePillText}>EN DIRECT</Text>
              </View>
              <Flame size={14} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.nowCardTitle} numberOfLines={1}>{t.name}</Text>
            <View style={styles.nowCardMeta}>
              <View style={styles.nowChip}><Text style={styles.nowChipText}>{sportLabels[t.sport]}</Text></View>
              <View style={styles.nowChip}><Text style={styles.nowChipText}>{t.registeredTeams.length} équipes</Text></View>
            </View>
            {t.venue?.city && (
              <View style={styles.nowCardLocation}>
                <MapPin size={10} color="rgba(255,255,255,0.6)" />
                <Text style={styles.nowCardLocationText} numberOfLines={1}>{t.venue.city}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    const m = item.data;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/match/${m.id}`)}
        style={styles.nowCard}
      >
        <View style={styles.nowCardPlain}>
          <View style={styles.nowCardTop}>
            <View style={styles.matchPill}>
              <Swords size={10} color={Colors.primary.orange} />
              <Text style={styles.matchPillText}>MATCH</Text>
            </View>
            {m.scheduledAt && (
              <View style={styles.nowCardTime}>
                <Clock size={11} color={Colors.text.muted} />
                <Text style={styles.nowCardTimeText}>{formatDate(m.scheduledAt)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.nowCardTitleDark} numberOfLines={1}>
            {m.title || `${sportLabels[m.sport] || 'Match'}`}
          </Text>
          {m.venue?.name && (
            <View style={styles.nowCardVenue}>
              <MapPin size={10} color={Colors.text.muted} />
              <Text style={styles.nowCardVenueText} numberOfLines={1}>{m.venue.name}</Text>
            </View>
          )}
          <View style={styles.nowCardMatchBottom}>
            <View style={styles.nowCardSportBadge}>
              <Text style={styles.nowCardSportBadgeText}>{sportLabels[m.sport] || 'Sport'}</Text>
            </View>
            {m.maxPlayers && (
              <View style={styles.nowCardPlayers}>
                <Users size={10} color={Colors.text.muted} />
                <Text style={styles.nowCardPlayersText}>{m.maxPlayers} joueurs</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /* ════ FEED CARD — social post style for tournaments/teams ════ */
  const FeedCard = ({ item, index }: { item: FeedItem; index: number }) => {
    if (item.kind === 'tournament') {
      const t = item.data;
      const countdown = getCountdownLabel(t.startDate);
      const regPct = t.maxTeams > 0 ? t.registeredTeams.length / t.maxTeams : 0;
      return (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push(`/tournament/${t.id}`)}
          style={[styles.feedCard, index > 0 && { marginTop: 12 }]}
        >
          <View style={styles.feedCardHeader}>
            <View style={[styles.feedIconWrap, { backgroundColor: '#F97316' + '20' }]}>
              <Trophy size={16} color="#F97316" strokeWidth={2.2} />
            </View>
            <View style={styles.feedHeaderText}>
              <Text style={styles.feedAction}>Nouveau tournoi</Text>
              <Text style={styles.feedTime}>{countdown ?? formatDate(t.startDate)}</Text>
            </View>
            <View style={styles.feedStatusDot} />
          </View>
          <Text style={styles.feedTitle} numberOfLines={2}>{t.name}</Text>
          <View style={styles.feedChips}>
            <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[t.sport]}</Text></View>
            <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.format}</Text></View>
            {t.venue?.city && <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.venue.city}</Text></View>}
          </View>
          <View style={styles.feedProgress}>
            <View style={styles.feedProgressBg}>
              <View style={[styles.feedProgressFill, { width: `${Math.min(regPct * 100, 100)}%` }]} />
            </View>
            <View style={styles.feedProgressRow}>
              <Text style={styles.feedProgressLabel}>{t.registeredTeams.length}/{t.maxTeams} équipes</Text>
              {t.prize && (
                <View style={styles.feedPrize}>
                  <Medal size={11} color="#FFD700" />
                  <Text style={styles.feedPrizeText}>{t.prize}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item.kind === 'team') {
      const t = item.data;
      const spotsLeft = t.maxMembers - t.members.length;
      return (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push(`/team/${t.id}`)}
          style={[styles.feedCard, index > 0 && { marginTop: 12 }]}
        >
          <View style={styles.feedCardHeader}>
            <View style={[styles.feedIconWrap, { backgroundColor: '#3B82F6' + '20' }]}>
              <UserPlus size={16} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <View style={styles.feedHeaderText}>
              <Text style={styles.feedAction}>Équipe recrute</Text>
              <Text style={styles.feedTime}>{spotsLeft} place{spotsLeft > 1 ? 's' : ''} disponible{spotsLeft > 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.feedTeamRow}>
            <Avatar uri={t.logo} name={t.name} size="small" />
            <View style={styles.feedTeamInfo}>
              <Text style={styles.feedTitle} numberOfLines={1}>{t.name}</Text>
              <View style={styles.feedChips}>
                <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[t.sport]}</Text></View>
                {t.city && <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.city}</Text></View>}
              </View>
            </View>
            <View style={styles.feedTeamJoinBtn}>
              <Text style={styles.feedTeamJoinText}>Rejoindre</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const t = item.data;
    const winner = t.winner || t.registeredTeams?.[0];
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/tournament/${t.id}`)}
        style={[styles.feedCard, index > 0 && { marginTop: 12 }]}
      >
        <View style={styles.feedCardHeader}>
          <View style={[styles.feedIconWrap, { backgroundColor: Colors.text.muted + '20' }]}>
            <CheckCircle size={16} color={Colors.text.muted} strokeWidth={2.2} />
          </View>
          <View style={styles.feedHeaderText}>
            <Text style={styles.feedAction}>Tournoi terminé</Text>
            <Text style={styles.feedTime}>{formatDate(t.startDate)}</Text>
          </View>
        </View>
        <Text style={styles.feedTitle} numberOfLines={2}>{t.name}</Text>
        <View style={styles.feedChips}>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[t.sport]}</Text></View>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.format}</Text></View>
        </View>
        {winner && (
          <View style={styles.feedWinnerRow}>
            <Crown size={14} color="#FFD700" />
            <Text style={styles.feedWinnerText} numberOfLines={1}>Vainqueur : {winner.name || winner}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ════ SECTION HEADER ════ */
  const SectionHeader = ({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) => (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity style={styles.seeAllLink} onPress={onSeeAll} hitSlop={12}>
          <Text style={styles.seeAllText}>Tout voir</Text>
          <ArrowRight size={14} color={Colors.primary.orange} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#070B12', '#0A0E16', Colors.background.dark, '#0B1018']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bgDecor}>
        <View style={[styles.bgOrb, { top: -60, right: -80 }]} />
        <View style={[styles.bgOrb2, { top: 300, left: -120 }]} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
        >
          {/* ════ PREMIUM HEADER ════ */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.8}
              >
                <View style={styles.avatarRing}>
                  <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
                </View>
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.headerGreeting}>{getGreeting()}</Text>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerName}>{user?.fullName?.split(' ')[0] || 'Joueur'}</Text>
                  {hasLocation ? (
                    <View style={styles.headerCityDot} />
                  ) : null}
                </View>
                {hasLocation ? (
                  <View style={styles.headerCityRow}>
                    <MapPin size={9} color={Colors.text.muted} strokeWidth={2.5} />
                    <Text style={styles.headerCity}>{city}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => router.push('/search')}
                activeOpacity={0.7}
              >
                <Search size={17} color={Colors.text.secondary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => router.push('/notifications')}
                activeOpacity={0.7}
              >
                <Bell size={17} color={Colors.text.secondary} strokeWidth={2} />
                {unreadNotifs > 0 && (
                  <View style={styles.headerBadgeCount}>
                    <Text style={styles.headerBadgeCountText}>
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ════ QUICK PILLS — horizontal action bar ════ */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsContent}
          >
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.pill}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.pillIcon, { backgroundColor: action.color + '20' }]}>
                  <action.icon size={16} color={action.color} strokeWidth={2.2} />
                </View>
                <Text style={styles.pillLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ════ LOCATION PROMPT ════ */}
          {!hasLocation && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/edit-profile')}
              style={styles.locationPrompt}
            >
              <View style={styles.locationPromptIcon}>
                <MapPin size={14} color={Colors.primary.orange} />
              </View>
              <Text style={styles.locationPromptText}>
                Définis ta ville pour découvrir ce qu&apos;il y a près de toi
              </Text>
              <ArrowRight size={14} color={Colors.primary.orange} strokeWidth={2.5} />
            </TouchableOpacity>
          )}

          {/* ════ EN CE MOMENT — live + upcoming ════ */}
          {nowItems.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="En ce moment" subtitle="Tournois en direct et matchs à venir" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nowScroll}
                decelerationRate="fast"
              >
                {nowItems.map((item, i) => (
                  <NowCard key={i} item={item} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ════ FIL D'ACTUALITÉ ════ */}
          <View style={styles.section}>
            <SectionHeader
              title={hasLocation ? `Fil — ${city}` : 'Fil sportif'}
              subtitle="Tournois, équipes et activités"
              onSeeAll={() => router.push('/tournaments')}
            />
            {feedItems.length > 0 ? (
              <View>
                {feedItems.map((item, i) => (
                  <FeedCard key={i} item={item} index={i} />
                ))}
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/tournaments')}
                style={styles.emptyInline}
              >
                <Zap size={28} color={Colors.text.muted} strokeWidth={1.5} />
                <Text style={styles.emptyInlineText}>Rien à afficher pour le moment</Text>
                <Text style={styles.emptyInlineLink}>Explorer</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ════ À REJOINDRE — horizontal team discovery ════ */}
          {recruitingTeams.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="À rejoindre"
                subtitle="Équipes en recrutement"
                onSeeAll={() => router.push('/(tabs)/teams')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.discoverScroll}
                decelerationRate="fast"
              >
                {recruitingTeams.map((team) => (
                  <Pressable
                    key={team.id}
                    style={({ pressed }) => [styles.discoverCard, { opacity: pressed ? 0.88 : 1 }]}
                    onPress={() => router.push(`/team/${team.id}`)}
                  >
                    <View style={styles.discoverAvatarWrap}>
                      <Avatar uri={team.logo} name={team.name} size="small" />
                    </View>
                    <Text style={styles.discoverName} numberOfLines={1}>{team.name}</Text>
                    <View style={styles.discoverChips}>
                      <View style={styles.discoverChip}>
                        <Text style={styles.discoverChipText}>{sportLabels[team.sport]}</Text>
                      </View>
                    </View>
                    <View style={styles.discoverBottom}>
                      <View style={styles.discoverMembers}>
                        <Users size={10} color={Colors.primary.orange} />
                        <Text style={styles.discoverMembersText}>{team.members.length}/{team.maxMembers}</Text>
                      </View>
                      {team.city && (
                        <View style={styles.discoverCity}>
                          <MapPin size={9} color={Colors.text.muted} />
                          <Text style={styles.discoverCityText} numberOfLines={1}>{team.city}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ════ MES ÉQUIPES — compact list ════ */}
          <View style={styles.section}>
            <SectionHeader
              title="Mes équipes"
              subtitle={`${userTeams.length} équipe(s)`}
              onSeeAll={() => router.push('/(tabs)/teams')}
            />
            {userTeams.length > 0 ? (
              <View style={styles.teamList}>
                {userTeams.slice(0, 3).map((team) => (
                  <Pressable
                    key={team.id}
                    style={({ pressed }) => [styles.teamRowCard, { opacity: pressed ? 0.88 : 1 }]}
                    onPress={() => router.push(`/team/${team.id}`)}
                  >
                    <Avatar uri={team.logo} name={team.name} size="small" />
                    <View style={styles.teamRowInfo}>
                      <Text style={styles.teamRowName} numberOfLines={1}>{team.name}</Text>
                      <View style={styles.teamRowChipRow}>
                        <View style={styles.teamRowChip}><Text style={styles.teamRowChipText}>{sportLabels[team.sport]}</Text></View>
                        {team.city ? (
                          <View style={styles.teamRowChip}><Text style={styles.teamRowChipText}>{team.city}</Text></View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.teamRowStats}>
                      <Text style={styles.teamRowMembersNum}>{team.members.length}</Text>
                      <Text style={styles.teamRowMembersLabel}>/{team.maxMembers}</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.text.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/create-team')}
                style={styles.emptyTeamCard}
              >
                <LinearGradient
                  colors={[Colors.background.card, Colors.background.cardLight]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.emptyTeamIconWrap}>
                  <Plus size={28} color={Colors.primary.orange} strokeWidth={2.2} />
                </View>
                <Text style={styles.emptyTeamTitle}>Crée ta première équipe</Text>
                <Text style={styles.emptyTeamText}>Recrute des joueurs et lance-toi</Text>
                <View style={styles.emptyTeamCta}>
                  <Text style={styles.emptyTeamCtaText}>Créer une équipe</Text>
                  <ArrowRight size={14} color={Colors.primary.orange} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 50 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  bgDecor: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primary.orange + '08',
  },
  bgOrb2: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.primary.blue + '06',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 6, paddingBottom: 20 },

  /* ════ PREMIUM HEADER ════ */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: { gap: 1, flexShrink: 1 },
  headerGreeting: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  headerCityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary.orange,
  },
  headerCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  headerCity: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
  },
  avatarRing: {
    borderRadius: 999,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.primary.orange + '40',
  },
  headerBadgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.background.dark,
  },
  headerBadgeCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800' as const,
  },

  /* ════ QUICK PILLS ════ */
  pillsScroll: { marginBottom: 20, marginHorizontal: -PAD },
  pillsContent: { paddingHorizontal: PAD, gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
  },
  pillIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },

  /* ════ LOCATION PROMPT ════ */
  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary.orange + '0D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '15',
  },
  locationPromptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPromptText: { flex: 1, color: Colors.text.secondary, fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },

  /* ════ SECTIONS ════ */
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.4 },
  sectionSubtitle: { color: Colors.text.muted, fontSize: 12, marginTop: 2, fontWeight: '500' as const },
  seeAllLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  /* ════ NOW CARDS (horizontal scroll) ════ */
  nowScroll: { gap: 12, paddingRight: PAD },
  nowCard: {
    width: width * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nowCardGrad: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    gap: 8,
    position: 'relative',
  },
  nowCardDecor: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nowCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  livePillText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  nowCardTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  nowCardMeta: { flexDirection: 'row', gap: 6 },
  nowChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nowChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '600' as const },

  nowCardPlain: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
    ...cardShadow,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchPillText: { color: Colors.primary.orange, fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  nowCardTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nowCardTimeText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  nowCardTitleDark: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  nowCardVenue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nowCardVenueText: { color: Colors.text.muted, fontSize: 11, flex: 1 },
  nowCardLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nowCardLocationText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' as const },
  nowCardMatchBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  nowCardSportBadge: {
    backgroundColor: Colors.primary.orange + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nowCardSportBadgeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' as const },
  nowCardPlayers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nowCardPlayersText: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },

  /* ════ FEED CARDS ════ */
  feedCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
    ...cardShadow,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  feedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedHeaderText: { flex: 1, gap: 1 },
  feedAction: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  feedTime: { color: Colors.text.muted, fontSize: 11, fontWeight: '400' as const },
  feedStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  feedTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2, marginBottom: 8 },
  feedChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  feedChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  feedChipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  feedProgress: { marginTop: 10, gap: 5 },
  feedProgressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.light + '60',
    overflow: 'hidden',
  },
  feedProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.primary.orange,
  },
  feedProgressLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  feedProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedPrize: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  feedPrizeText: { color: '#FFD700', fontSize: 11, fontWeight: '700' as const },
  feedTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedTeamInfo: { flex: 1, minWidth: 0, gap: 4 },
  feedTeamJoinBtn: {
    backgroundColor: '#3B82F6' + '15',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6' + '30',
  },
  feedTeamJoinText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' as const },
  feedWinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#FFD700' + '0D',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedWinnerText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const, flex: 1 },

  /* ════ TEAM ROW CARDS ════ */
  teamList: { gap: 10 },
  teamRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
    ...cardShadow,
  },
  teamRowInfo: { flex: 1, minWidth: 0, gap: 5 },
  teamRowName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  teamRowChipRow: { flexDirection: 'row', gap: 5 },
  teamRowChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  teamRowChipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  teamRowStats: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  teamRowMembersNum: { color: Colors.primary.orange, fontSize: 18, fontWeight: '800' as const },
  teamRowMembersLabel: { color: Colors.text.muted, fontSize: 11 },

  /* ════ DISCOVER CARDS (horizontal, 'À rejoindre') ════ */
  discoverScroll: { gap: 12, paddingRight: PAD },
  discoverCard: {
    width: 140,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
    gap: 8,
    ...cardShadow,
  },
  discoverAvatarWrap: { alignItems: 'center' },
  discoverName: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' as const, textAlign: 'center' },
  discoverChips: { flexDirection: 'row', justifyContent: 'center' },
  discoverChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  discoverChipText: { color: Colors.text.secondary, fontSize: 9, fontWeight: '600' as const },
  discoverBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discoverMembers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  discoverMembersText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' as const },
  discoverCity: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: 60 },
  discoverCityText: { color: Colors.text.muted, fontSize: 9 },

  /* ════ EMPTY STATES ════ */
  emptyInline: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
  },
  emptyInlineText: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' as const },
  emptyInlineLink: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },

  emptyTeamCard: {
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border.light + '40',
  },
  emptyTeamIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary.orange + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary.orange + '20',
  },
  emptyTeamTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const, marginBottom: 6, letterSpacing: -0.3 },
  emptyTeamText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 18, fontWeight: '400' as const },
  emptyTeamCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange + '12',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary.orange + '20',
  },
  emptyTeamCtaText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },
});
