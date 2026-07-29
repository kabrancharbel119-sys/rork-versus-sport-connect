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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, Search, Trophy, Users, Swords, MapPin,
  ChevronRight, CheckCircle, Flame, ArrowRight, Plus,
  Clock, UserPlus, Zap, Crown, Medal, MessageCircle,
} from 'lucide-react-native';
import { Colors, SPACING, CARD_RADIUS, CARD_INNER_PAD, OUTER_PAD, SECTION_GAP, CARD_GAP, cardGlow } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useChat } from '@/contexts/ChatContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import Svg, { Polygon } from 'react-native-svg';
import { sportLabels, levelLabels } from '@/mocks/data';
import { suggestionsApi, type PlayerSuggestion } from '@/lib/api/suggestions';
import { useQuery } from '@tanstack/react-query';

const { width } = Dimensions.get('window');
const PAD = OUTER_PAD;

/* ════ Pressable card with scale animation ════ */
const PressableCard = React.memo(function PressableCard({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.98, duration: 250, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

const octagonPoints = (size: number, inset: number) => {
  const c = inset;
  const f = size - inset;
  return `${c},0 ${f},0 ${size},${c} ${size},${f} ${f},${size} ${c},${size} 0,${f} 0,${c}`;
};

const isValidAvatarUri = (uri?: string): boolean => {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

const OctagonAvatar = React.memo(function OctagonAvatar({ uri, name, size = 48, color = Colors.primary.blue }: { uri?: string; name?: string; size?: number; color?: string }) {
  const inset = size * 0.293;
  const pts = octagonPoints(size, inset);
  const validUri = isValidAvatarUri(uri);
  const circleSize = size * 0.78;
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Polygon points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
      {validUri ? (
        <Image
          source={{ uri }}
          style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: Colors.background.card }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' as const, fontSize: size * 0.26 }}>
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
});

/* Animated pulsing dot for live indicators */
const PulseDot = React.memo(function PulseDot({ color = '#FF3B30', size = 6 }: { color?: string; size?: number }) {
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
});

/* ════ Module-level helpers (pure functions, no state) ════ */
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

/* ════ Types for extracted components ════ */
type NowItem =
  | { kind: 'live'; data: any }
  | { kind: 'match'; data: any };

type FeedItem =
  | { kind: 'tournament'; data: any; route: string }
  | { kind: 'team'; data: any; route: string }
  | { kind: 'match'; data: any; route: string }
  | { kind: 'user'; data: any; route: string };

/* ════ SectionHeader — extracted, memoized ════ */
const SectionHeader = React.memo(function SectionHeader({ title, subtitle, onSeeAll, seeAllLabel }: { title: string; subtitle?: string; onSeeAll?: () => void; seeAllLabel?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity style={styles.seeAllLink} onPress={onSeeAll} hitSlop={12}>
          <Text style={styles.seeAllText}>{seeAllLabel ?? 'Tout voir'}</Text>
          <ArrowRight size={14} color={Colors.primary.orange} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ════ NowCard — extracted, memoized ════ */
const NowCard = React.memo(function NowCard({ item, router }: { item: NowItem; router: any }) {
  if (item.kind === 'live') {
    const t = item.data;
    return (
      <PressableCard
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
      </PressableCard>
    );
  }
  const m = item.data;
  return (
    <PressableCard
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
    </PressableCard>
  );
});

/* ════ FeedCard — extracted, memoized ════ */
const FeedCard = React.memo(function FeedCard({ item, router }: { item: FeedItem; router: any }) {
  if (item.kind === 'tournament') {
    const t = item.data;
    const countdown = getCountdownLabel(t.startDate);
    const regPct = t.maxTeams > 0 ? t.registeredTeams.length / t.maxTeams : 0;
    const spotsLeft = t.maxTeams - t.registeredTeams.length;
    const bannerSource = t.bannerImage || t.sponsorLogo || null;
    return (
      <PressableCard
        onPress={() => router.push(item.route as any)}
        style={styles.feedCard}
      >
        {bannerSource && (
          <View style={styles.feedBannerWrap}>
            <Image
              source={{ uri: bannerSource }}
              style={styles.feedBannerImage}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              style={styles.feedBannerOverlay}
            />
            {t.status === 'in_progress' && (
              <View style={styles.feedBannerLive}>
                <Flame size={9} color="#FFF" />
                <Text style={styles.feedLiveText}>LIVE</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.feedCardHeader}>
          {t.sponsorLogo ? (
            <Avatar uri={t.sponsorLogo} name={t.name} size="small" />
          ) : (
            <View style={[styles.feedIconWrap, { backgroundColor: '#FF6B35' + '18' }]}>
              <Trophy size={16} color="#FF6B35" strokeWidth={2} />
            </View>
          )}
          <View style={styles.feedHeaderText}>
            <View style={styles.feedNameRow}>
              <Text style={styles.feedTournamentName} numberOfLines={1}>{t.name}</Text>
              {t.sponsorName && <CheckCircle size={12} color="#10B981" strokeWidth={2} />}
            </View>
            <Text style={styles.feedTime}>{countdown ?? formatDate(t.startDate)}</Text>
          </View>
          {t.status === 'in_progress' ? (
            <View style={styles.feedLiveBadge}>
              <Flame size={9} color="#FFF" />
              <Text style={styles.feedLiveText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.feedStatusDot} />
          )}
        </View>
        <View style={styles.feedChips}>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[t.sport]}</Text></View>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.format}</Text></View>
          {t.venue?.city && <View style={styles.feedChip}><Text style={styles.feedChipText}>{t.venue.city}</Text></View>}
        </View>
        <View style={styles.feedInfoRow}>
          <Clock size={11} color={Colors.text.muted} strokeWidth={2} />
          <Text style={styles.feedInfoText}>{formatDate(t.startDate)}</Text>
          {t.venue?.name && (
            <>
              <View style={styles.feedInfoDot} />
              <MapPin size={11} color={Colors.text.muted} strokeWidth={2} />
              <Text style={styles.feedInfoText} numberOfLines={1}>{t.venue.name}</Text>
            </>
          )}
        </View>
        <View style={styles.feedProgress}>
          <View style={styles.feedProgressBg}>
            <View style={[styles.feedProgressFill, { width: `${Math.min(regPct * 100, 100)}%` }]} />
          </View>
          <View style={styles.feedProgressRow}>
            <Text style={styles.feedProgressLabel}>{t.registeredTeams.length}/{t.maxTeams} équipes · {spotsLeft} places</Text>
            {t.prizePool > 0 && (
              <View style={styles.feedPrize}>
                <Medal size={11} color="#FFD700" strokeWidth={2} />
                <Text style={styles.feedPrizeText}>{t.prizePool.toLocaleString('fr-FR')}</Text>
              </View>
            )}
          </View>
        </View>
        {t.status === 'registration' && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(item.route as any)}
            style={styles.feedParticipateBtn}
          >
            <Text style={styles.feedParticipateText}>Participer</Text>
            <ArrowRight size={14} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </PressableCard>
    );
  }

  if (item.kind === 'team') {
    const t = item.data;
    const spotsLeft = t.maxMembers - t.members.length;
    return (
      <PressableCard
        onPress={() => router.push(item.route as any)}
        style={styles.feedCard}
      >
        <View style={styles.feedCardHeader}>
          <View style={[styles.feedIconWrap, { backgroundColor: '#3B82F6' + '18' }]}>
            <UserPlus size={16} color="#3B82F6" strokeWidth={2} />
          </View>
          <View style={styles.feedHeaderText}>
            <Text style={styles.feedAction}>Équipe recrute</Text>
            <Text style={styles.feedTime}>{spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}</Text>
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
      </PressableCard>
    );
  }

  if (item.kind === 'match') {
    const m = item.data;
    const homeTeam = m.homeTeam?.name ?? 'Équipe 1';
    const awayTeam = m.awayTeam?.name ?? 'Équipe 2';
    return (
      <PressableCard
        onPress={() => router.push(item.route as any)}
        style={styles.feedCard}
      >
        <View style={styles.feedCardHeader}>
          <View style={[styles.feedIconWrap, { backgroundColor: Colors.primary.orange + '18' }]}>
            <Swords size={16} color={Colors.primary.orange} strokeWidth={2} />
          </View>
          <View style={styles.feedHeaderText}>
            <Text style={styles.feedAction}>Match à venir</Text>
            <Text style={styles.feedTime}>{formatDate(m.dateTime)}</Text>
          </View>
        </View>
        <Text style={styles.feedTitle} numberOfLines={2}>{homeTeam} vs {awayTeam}</Text>
        <View style={styles.feedChips}>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[m.sport] || m.sport}</Text></View>
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{m.format}</Text></View>
          {m.venue?.city && <View style={styles.feedChip}><Text style={styles.feedChipText}>{m.venue.city}</Text></View>}
        </View>
        {m.venue?.name && (
          <View style={styles.feedInfoRow}>
            <MapPin size={11} color={Colors.text.muted} strokeWidth={2} />
            <Text style={styles.feedInfoText} numberOfLines={1}>{m.venue.name}</Text>
          </View>
        )}
      </PressableCard>
    );
  }

  if (item.kind === 'user') {
    const u = item.data;
    const mainSport = u.sports?.[0];
    return (
      <PressableCard
        onPress={() => router.push(item.route as any)}
        style={styles.feedCard}
      >
        <View style={styles.feedCardHeader}>
          <Avatar uri={u.avatar} name={u.fullName} size="small" />
          <View style={styles.feedHeaderText}>
            <View style={styles.feedNameRow}>
              <Text style={styles.feedTournamentName} numberOfLines={1}>{u.fullName}</Text>
              {u.isVerified && <CheckCircle size={12} color="#10B981" strokeWidth={2} />}
            </View>
            <Text style={styles.feedTime}>@{u.username}</Text>
          </View>
        </View>
        {u.bio && <Text style={styles.feedTitle} numberOfLines={2}>{u.bio}</Text>}
        <View style={styles.feedChips}>
          {mainSport && <View style={styles.feedChip}><Text style={styles.feedChipText}>{sportLabels[mainSport.sport] || mainSport.sport}</Text></View>}
          {u.city && <View style={styles.feedChip}><Text style={styles.feedChipText}>{u.city}</Text></View>}
          <View style={styles.feedChip}><Text style={styles.feedChipText}>{u.followers} abonnés</Text></View>
        </View>
      </PressableCard>
    );
  }
  return null;
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getUnreadCount, refetchNotifications } = useNotifications();
  const { getTotalUnread: getChatUnread } = useChat();
  const { getRecruitingTeams, getUserTeams, teams, getFollowedTeams, getPendingRequests, refetchTeams } = useTeams();
  const { getUpcomingMatches } = useMatches();
  const { tournaments, getActiveTournaments } = useTournaments();
  const { getFollowing, users: allUsers } = useUsers();

  const [refreshing, setRefreshing] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<string>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const playerSuggestions = useQuery<PlayerSuggestion[]>({
    queryKey: ['playerSuggestions', user?.id],
    queryFn: () => suggestionsApi.suggestPlayersForUser(user!.id, {
      userSports: user?.sports ?? [],
      city: user?.city,
      followingIds: [],
      teamMemberIds: userTeams.flatMap((t) => t.members.map((m) => m.userId)),
      limit: 6,
    }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const pendingTeamRequestsCount = user
    ? teams.filter((t) => t.captainId === user.id || (t.coCaptainIds ?? []).includes(user.id)).reduce((sum, t) => sum + getPendingRequests(t.id).length, 0)
    : 0;
  const unreadNotifs = getUnreadCount() + pendingTeamRequestsCount + getChatUnread();

  const userTeams = user ? getUserTeams(user.id) : [];
  const followedTeams = user ? getFollowedTeams(user.id) : [];
  const followingUsers = user ? getFollowing(user.id) : [];
  const city = user?.city?.trim() || '';
  const cityLower = city.toLowerCase();
  const hasLocation = !!city;

  // Team IDs the user is connected to (member or fan)
  const connectedTeamIds = new Set([
    ...userTeams.map(t => t.id),
    ...followedTeams.map(t => t.id),
  ]);

  // User IDs the user follows + teammates
  const connectedUserIds = new Set([
    ...followingUsers.map(u => u.id),
    ...userTeams.flatMap(t => t.members.map(m => m.userId)).filter(id => id !== user?.id),
  ]);

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

  /* ════ FEED CONSTRUCTION — relevance-based ════ */
  const nowItems: NowItem[] = [
    ...liveTournaments.map(t => ({ kind: 'live' as const, data: t })),
    ...upcomingMatches.map(m => ({ kind: 'match' as const, data: m })),
  ].slice(0, 3);

  // Tournaments related to user's teams (user's teams are registered or user is manager)
  const myTeamTournamentIds = new Set<string>();
  userTeams.forEach(t => {
    tournaments.forEach(tour => {
      if (tour.registeredTeams.includes(t.id) || (tour.managers ?? []).includes(user?.id ?? '')) {
        myTeamTournamentIds.add(tour.id);
      }
    });
  });

  const feedItems: FeedItem[] = [
    // 1. Tournaments user's teams are registered in
    ...tournaments
      .filter(t => myTeamTournamentIds.has(t.id) && t.status !== 'completed')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map(t => ({ kind: 'tournament' as const, data: t, route: `/tournament/${t.id}` })),

    // 2. Tournaments in user's city (registration open)
    ...upcomingTournaments
      .filter(t => !myTeamTournamentIds.has(t.id))
      .slice(0, 3)
      .map(t => ({ kind: 'tournament' as const, data: t, route: `/tournament/${t.id}` })),

    // 3. Matches involving user's teams
    ...getUpcomingMatches()
      .filter(m => userTeams.some(t => t.id === m.homeTeamId || t.id === m.awayTeamId))
      .slice(0, 3)
      .map(m => ({ kind: 'match' as const, data: m, route: `/match/${m.id}` })),

    // 4. Teams followed by user that are recruiting
    ...followedTeams
      .filter(t => t.isRecruiting)
      .slice(0, 2)
      .map(t => ({ kind: 'team' as const, data: t, route: `/team/${t.id}` })),

    // 5. Recent activity from followed users (new team joins, etc.)
    ...followingUsers
      .slice(0, 3)
      .map(u => ({ kind: 'user' as const, data: u, route: `/user/${u.id}` })),
  ].slice(0, 10);

  const filteredFeedItems = activeFilter === 'all'
    ? feedItems
    : activeFilter === 'tournament'
      ? feedItems.filter((i) => i.kind === 'tournament')
      : activeFilter === 'team'
        ? feedItems.filter((i) => i.kind === 'team')
        : activeFilter === 'match'
          ? feedItems.filter((i) => i.kind === 'match')
          : activeFilter === 'user'
            ? feedItems.filter((i) => i.kind === 'user')
            : feedItems;

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
    { icon: Swords, color: '#FF6B35', label: 'Match', route: '/(tabs)/matches', filter: 'match' },
    { icon: Users, color: '#3B82F6', label: 'Équipe', route: '/(tabs)/teams', filter: 'team' },
    { icon: Trophy, color: '#10B981', label: 'Tournoi', route: '/(tabs)/tournaments', filter: 'tournament' },
    ...(isVenueManager ? [] : [{ icon: MapPin, color: '#8B5CF6', label: 'Terrains', route: '/(tabs)/venues', filter: 'venue' }]),
  ];

  /* ════ ACTIVITY TIMELINE — relevance-based, clickable, with dates ════ */
  type ActivityItem = { id: string; icon: React.ReactNode; text: string; sub: string; date: string; color: string; route?: string };
  const activityItems: ActivityItem[] = [];

  // 1. User's team tournaments (all statuses)
  userTeams.forEach(t => {
    tournaments
      .filter(tour => tour.registeredTeams.includes(t.id))
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 2)
      .forEach(tour => {
        const countdown = getCountdownLabel(tour.startDate);
        const dateStr = formatDate(tour.startDate);
        if (tour.status === 'registration' && countdown) {
          activityItems.push({
            id: `myteam-tour-${tour.id}-${t.id}`,
            icon: <Trophy size={14} color="#FF6B00" strokeWidth={2} />,
            text: `${t.name} inscrit à ${tour.name}`,
            sub: `${countdown} · ${tour.registeredTeams.length}/${tour.maxTeams} équipes`,
            date: dateStr,
            color: '#FF6B00',
            route: `/tournament/${tour.id}`,
          });
        } else if (tour.status === 'in_progress') {
          activityItems.push({
            id: `myteam-tour-live-${tour.id}-${t.id}`,
            icon: <Flame size={14} color="#EF4444" strokeWidth={2} />,
            text: `${tour.name} en direct — ${t.name} participe`,
            sub: `${tour.registeredTeams.length}/${tour.maxTeams} équipes`,
            date: dateStr,
            color: '#EF4444',
            route: `/tournament/${tour.id}`,
          });
        } else if (tour.status === 'completed') {
          const winnerName = teams.find(t2 => t2.id === tour.winnerId)?.name ?? 'Champion';
          const isWinner = tour.winnerId === t.id;
          activityItems.push({
            id: `myteam-tour-done-${tour.id}-${t.id}`,
            icon: <Crown size={14} color="#FFD700" strokeWidth={2} />,
            text: `${tour.name} terminé — ${isWinner ? `${t.name} champion !` : `Vainqueur: ${winnerName}`}`,
            sub: `${sportLabels[tour.sport] || tour.sport}`,
            date: dateStr,
            color: '#FFD700',
            route: `/tournament/${tour.id}`,
          });
        }
      });
  });

  // 2. Matches involving user's teams (upcoming + completed)
  getUpcomingMatches()
    .filter(m => userTeams.some(t => t.id === m.homeTeamId || t.id === m.awayTeamId))
    .slice(0, 4)
    .forEach(m => {
      const isMyTeamHome = userTeams.some(t => t.id === m.homeTeamId);
      const myTeamName = isMyTeamHome ? m.homeTeam?.name : m.awayTeam?.name;
      const oppName = isMyTeamHome ? m.awayTeam?.name : m.homeTeam?.name;
      const dateStr = formatDate(m.dateTime);
      if (m.status === 'completed') {
        const myScore = isMyTeamHome ? m.score?.home : m.score?.away;
        const oppScore = isMyTeamHome ? m.score?.away : m.score?.home;
        const won = (myScore ?? 0) > (oppScore ?? 0);
        activityItems.push({
          id: `mymatch-done-${m.id}`,
          icon: <Swords size={14} color={won ? '#10B981' : '#6B7280'} strokeWidth={2} />,
          text: `${myTeamName ?? 'Équipe'} ${myScore}-${oppScore} ${oppName ?? 'Adversaire'}`,
          sub: `${sportLabels[m.sport] || m.sport} · ${won ? 'Victoire' : 'Défaite'}`,
          date: dateStr,
          color: won ? '#10B981' : '#6B7280',
          route: `/match/${m.id}`,
        });
      } else {
        activityItems.push({
          id: `mymatch-${m.id}`,
          icon: <Swords size={14} color={Colors.primary.orange} strokeWidth={2} />,
          text: `${m.homeTeam?.name ?? 'Équipe 1'} vs ${m.awayTeam?.name ?? 'Équipe 2'}`,
          sub: `${sportLabels[m.sport] || m.sport} · ${m.venue?.name ?? ''}`,
          date: dateStr,
          color: Colors.primary.orange,
          route: `/match/${m.id}`,
        });
      }
    });

  // 3. Followed teams that are recruiting
  followedTeams
    .filter(t => t.isRecruiting)
    .slice(0, 3)
    .forEach(t => {
      const spotsLeft = t.maxMembers - t.members.length;
      if (spotsLeft > 0) {
        activityItems.push({
          id: `follow-recruit-${t.id}`,
          icon: <Users size={14} color="#10B981" strokeWidth={2} />,
          text: `${t.name} cherche ${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''}`,
          sub: `${sportLabels[t.sport] || ''} · ${t.members.length}/${t.maxMembers} membres`,
          date: t.city || 'Recrutement',
          color: '#10B981',
          route: `/team/${t.id}`,
        });
      }
    });

  // 4. Followed users — show their teams and recent tournament participation
  followingUsers.slice(0, 5).forEach(u => {
    const userTeam = teams.find(t => t.members.some(m => m.userId === u.id));
    if (userTeam) {
      activityItems.push({
        id: `friend-team-${u.id}`,
        icon: <UserPlus size={14} color="#3B82F6" strokeWidth={2} />,
        text: `${u.fullName} joue dans ${userTeam.name}`,
        sub: `${sportLabels[userTeam.sport] || ''}${userTeam.city ? ` · ${userTeam.city}` : ''}`,
        date: formatDate(new Date(u.createdAt)),
        color: '#3B82F6',
        route: `/user/${u.id}`,
      });
    }
    // Check if followed user's team is in a tournament
    const userTeamTournament = tournaments.find(tour =>
      tour.status === 'registration' &&
      userTeam &&
      tour.registeredTeams.includes(userTeam.id)
    );
    if (userTeamTournament) {
      activityItems.push({
        id: `friend-tour-${u.id}-${userTeamTournament.id}`,
        icon: <Trophy size={14} color="#FF6B00" strokeWidth={2} />,
        text: `${u.fullName} participe à ${userTeamTournament.name}`,
        sub: `${userTeamTournament.registeredTeams.length}/${userTeamTournament.maxTeams} équipes`,
        date: formatDate(userTeamTournament.startDate),
        color: '#FF6B00',
        route: `/tournament/${userTeamTournament.id}`,
      });
    }
  });

  // 5. Live tournaments in user's city
  liveTournaments
    .filter(t => !userTeams.some(ut => t.registeredTeams.includes(ut.id)))
    .slice(0, 2)
    .forEach(t => {
      activityItems.push({
        id: `live-tour-${t.id}`,
        icon: <Flame size={14} color="#EF4444" strokeWidth={2} />,
        text: `${t.name} en direct`,
        sub: `${sportLabels[t.sport] || t.sport} · ${t.registeredTeams.length} équipes`,
        date: formatDate(t.startDate),
        color: '#EF4444',
        route: `/tournament/${t.id}`,
      });
    });

  // 6. Upcoming tournaments in user's city
  upcomingTournaments
    .filter(t => !userTeams.some(ut => t.registeredTeams.includes(ut.id)))
    .slice(0, 2)
    .forEach(t => {
      const countdown = getCountdownLabel(t.startDate);
      activityItems.push({
        id: `upcoming-tour-${t.id}`,
        icon: <Trophy size={14} color="#F97316" strokeWidth={2} />,
        text: `${t.name} ${countdown ? countdown.toLowerCase() : 'bientôt'}`,
        sub: `${t.registeredTeams.length}/${t.maxTeams} équipes · ${(t.entryFee ?? 0).toLocaleString('fr-FR')} FCFA`,
        date: formatDate(t.startDate),
        color: '#F97316',
        route: `/tournament/${t.id}`,
      });
    });

  // Sort by date descending (most recent first)
  activityItems.sort((a, b) => {
    const parseDate = (s: string) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    return parseDate(b.date) - parseDate(a.date);
  });

  const [showAllActivities, setShowAllActivities] = React.useState(false);
  const visibleActivities = showAllActivities ? activityItems : activityItems.slice(0, 5);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#0d111d', '#0b0f1a', Colors.background.dark, '#0d111d']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bgDecor}>
        <View style={[styles.bgOrb, { top: -60, right: -80 }]} />
        <View style={[styles.bgOrb2, { top: 300, left: -120 }]} />
      </View>

      <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 50 : 35) }]}>
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
                onPress={() => router.push('/(tabs)/chat')}
                activeOpacity={0.7}
              >
                <MessageCircle size={17} color={Colors.text.secondary} strokeWidth={2} />
                {getChatUnread() > 0 && (
                  <View style={styles.headerBadgeCount}>
                    <Text style={styles.headerBadgeCountText}>
                      {getChatUnread() > 9 ? '9+' : getChatUnread()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
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

          {/* ════ BANNER — matches today ════ */}
          {upcomingMatches.length > 0 && (
            <View style={styles.banner}>
              <LinearGradient
                colors={['rgba(255,107,0,0.12)', 'rgba(255,107,0,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bannerGrad}
              >
                <View style={styles.bannerIcon}>
                  <Flame size={16} color={Colors.primary.orange} strokeWidth={2} />
                </View>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerCount}>{upcomingMatches.length} match{upcomingMatches.length > 1 ? 's' : ''} aujourd'hui</Text>
                  {hasLocation && <Text style={styles.bannerCity}>à {city}</Text>}
                </View>
              </LinearGradient>
            </View>
          )}

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
                  <NowCard key={i} item={item} router={router} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ════ FIL D'ACTUALITÉ — vertical with filter tabs ════ */}
          <View style={styles.section}>
            <SectionHeader
              title={hasLocation ? `Fil — ${city}` : 'Fil sportif'}
              subtitle="Tournois, équipes et activités"
              onSeeAll={() => router.push('/news')}
            />
            <View style={styles.feedFilterTabs}>
              {[
                { key: 'all', label: 'Tout' },
                { key: 'tournament', label: 'Tournois' },
                { key: 'match', label: 'Matchs' },
                { key: 'team', label: 'Équipes' },
                { key: 'user', label: 'Amis' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.feedFilterTab, activeFilter === tab.key && styles.feedFilterTabActive]}
                  onPress={() => setActiveFilter(tab.key)}
                >
                  <Text style={[styles.feedFilterTabText, activeFilter === tab.key && styles.feedFilterTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {filteredFeedItems.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.feedScroll}
                decelerationRate="fast"
              >
                {filteredFeedItems.map((item, i) => (
                  <FeedCard key={i} item={item} router={router} />
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/news')}
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
                  <PressableCard
                    key={team.id}
                    onPress={() => router.push(`/team/${team.id}`)}
                    style={styles.discoverCard}
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
                  </PressableCard>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ════ MES ÉQUIPES — premium cards with progress ════ */}
          <View style={styles.section}>
            <SectionHeader
              title="Mes équipes"
              subtitle={`${userTeams.length} équipe(s)`}
              onSeeAll={() => router.push('/(tabs)/teams')}
            />
            {userTeams.length > 0 ? (
              <View style={styles.teamList}>
                {userTeams.slice(0, 3).map((team) => {
                  const spotsLeft = team.maxMembers - team.members.length;
                  const isCaptain = team.captainId === user?.id;
                  return (
                    <PressableCard
                      key={team.id}
                      onPress={() => router.push(`/team/${team.id}`)}
                      style={styles.teamRowCard}
                    >
                      <Avatar uri={team.logo} name={team.name} size="medium" />
                      <View style={styles.teamRowInfo}>
                        <View style={styles.teamRowNameRow}>
                          <Text style={styles.teamRowName} numberOfLines={1}>{team.name}</Text>
                          {isCaptain && (
                            <View style={styles.captainBadge}>
                              <Crown size={9} color="#FFD700" strokeWidth={2} />
                              <Text style={styles.captainBadgeText}>Capitaine</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.teamRowChipRow}>
                          <View style={styles.teamRowChip}><Text style={styles.teamRowChipText}>{sportLabels[team.sport]}</Text></View>
                          {team.city ? <View style={styles.teamRowChip}><Text style={styles.teamRowChipText}>{team.city}</Text></View> : null}
                        </View>
                        <View style={styles.teamProgressWrap}>
                          <View style={styles.teamProgressBg}>
                            <View style={[styles.teamProgressFill, { width: `${(team.members.length / team.maxMembers) * 100}%` }]} />
                          </View>
                          <Text style={styles.teamProgressLabel}>
                            {team.members.length}/{team.maxMembers} joueurs
                            {spotsLeft > 0 ? ` · cherche ${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''}` : ''}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color={Colors.text.muted} strokeWidth={2} />
                    </PressableCard>
                  );
                })}
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
                  <Plus size={28} color={Colors.primary.orange} strokeWidth={2} />
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

          {/* ════ À REJOINDRE — horizontal team discovery ════ */}
          {(playerSuggestions.data ?? []).length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title="Communauté"
                subtitle="Des joueurs qui te correspondent"
                onSeeAll={() => router.push('/search?type=users')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.communityScroll}
                decelerationRate="fast"
              >
                {(playerSuggestions.data ?? []).map((p) => {
                  const mainSport = p.sports[0];
                  return (
                    <PressableCard
                      key={p.id}
                      onPress={() => router.push(`/user/${p.id}`)}
                      style={styles.communityCard}
                    >
                      <OctagonAvatar uri={p.avatar} name={p.fullName} size={48} color="#8B5CF6" />
                      <View style={styles.communityInfo}>
                        <Text style={styles.communityReason} numberOfLines={1}>
                          {p.matchReasons[0] ?? 'Profil recommandé'}
                        </Text>
                        <Text style={styles.communityName} numberOfLines={1}>{p.fullName.toUpperCase()}</Text>
                        {mainSport && (
                          <View style={styles.communityBadges}>
                            <View style={styles.communityBadgeSport}>
                              <Text style={styles.communityBadgeSportText}>{sportLabels[mainSport.sport]}</Text>
                            </View>
                            <View style={styles.communityBadgeLevel}>
                              <Text style={styles.communityBadgeLevelText}>{levelLabels[mainSport.level]}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <ChevronRight size={18} color={Colors.text.muted} strokeWidth={2} />
                    </PressableCard>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 50 }} />
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const styles: any = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
  },
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
  scroll: { flex: 1, width: '100%' },
  scrollContent: { paddingTop: SPACING.sm, paddingBottom: 100 },

  /* ════ PREMIUM HEADER ════ */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: SECTION_GAP - SPACING.sm,
    paddingTop: SPACING.xs,
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
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    borderRadius: 999,
    padding: 2,
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
  },
  headerBadgeCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800' as const,
  },

  /* ════ BANNER ════ */
  banner: {
    marginBottom: SECTION_GAP - SPACING.sm,
    borderRadius: CARD_RADIUS - 4,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  bannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: CARD_RADIUS - 4,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary.orange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, gap: 1 },
  bannerCount: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const, letterSpacing: -0.2 },
  bannerCity: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },

  /* ════ QUICK ACTIONS ════ */
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SECTION_GAP - SPACING.sm,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: CARD_RADIUS - 4,
    backgroundColor: Colors.background.card,
  },
  quickBtnActive: {
    backgroundColor: Colors.background.cardLight,
  },
  quickBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnLabel: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
  quickBtnLabelActive: { color: Colors.text.primary },

  /* ════ LOCATION PROMPT ════ */
  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary.orange + '0A',
    borderRadius: CARD_RADIUS - 4,
    padding: 14,
    marginBottom: SECTION_GAP - SPACING.sm,
    marginHorizontal: 16,
  },
  locationPromptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary.orange + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPromptText: { flex: 1, color: Colors.text.secondary, fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },

  /* ════ SECTIONS ════ */
  section: { marginBottom: SECTION_GAP },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.4 },
  sectionSubtitle: { color: Colors.text.secondary, fontSize: 13, marginTop: 2, fontWeight: '500' as const },
  seeAllLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  /* ════ NOW CARDS ════ */
  nowScroll: { gap: CARD_GAP, paddingLeft: 16, paddingRight: 16 },
  nowCard: {
    width: width * 0.75,
    borderRadius: CARD_RADIUS - 4,
    overflow: 'hidden',
  },
  nowCardGrad: {
    borderRadius: CARD_RADIUS - 4,
    overflow: 'hidden',
    padding: CARD_INNER_PAD - 4,
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
    borderRadius: 8,
  },
  livePillText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  nowCardTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  nowCardMeta: { flexDirection: 'row', gap: 6 },
  nowChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nowChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '600' as const },

  nowCardPlain: {
    borderRadius: CARD_RADIUS - 4,
    padding: CARD_INNER_PAD - 4,
    gap: 8,
    backgroundColor: Colors.background.card,
    ...cardGlow,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    borderRadius: 8,
  },
  nowCardSportBadgeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' as const },
  nowCardPlayers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nowCardPlayersText: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },

  /* ════ FEED CARDS ════ */
  feedFilterTabs: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  feedFilterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
  },
  feedFilterTabActive: {
    backgroundColor: Colors.primary.orange,
  },
  feedFilterTabText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  feedFilterTabTextActive: {
    color: '#FFF',
  },
  feedList: { gap: CARD_GAP },
  feedScroll: { gap: CARD_GAP, paddingLeft: 16, paddingRight: 16 },
  feedCard: {
    width: 280,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS,
    padding: CARD_INNER_PAD,
    overflow: 'hidden',
    ...cardGlow,
  },
  feedBannerWrap: {
    height: 120,
    position: 'relative',
    marginHorizontal: -CARD_INNER_PAD,
    marginTop: -CARD_INNER_PAD,
    marginBottom: 10,
  },
  feedBannerImage: {
    width: '100%',
    height: '100%',
  },
  feedBannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  feedBannerLive: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  feedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedHeaderText: { flex: 1, gap: 1 },
  feedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedAction: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  feedTournamentName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2, flexShrink: 1 },
  feedTime: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' as const },
  feedStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
  },
  feedLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feedLiveText: { color: '#FFF', fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.5 },
  feedTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2, marginBottom: 8 },
  feedChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  feedChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feedChipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  feedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  feedInfoText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  feedInfoDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.text.muted, marginHorizontal: 2 },
  feedProgress: { marginTop: 12, gap: 5 },
  feedProgressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.background.cardLight,
    overflow: 'hidden',
  },
  feedProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary.orange,
  },
  feedProgressLabel: { color: Colors.text.secondary, fontSize: 11, fontWeight: '600' as const },
  feedProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedPrize: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  feedPrizeText: { color: '#FFD700', fontSize: 11, fontWeight: '700' as const },
  feedParticipateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary.orange,
  },
  feedParticipateText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  feedTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedTeamInfo: { flex: 1, minWidth: 0, gap: 4 },
  feedTeamJoinBtn: {
    backgroundColor: '#3B82F6' + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  feedTeamJoinText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' as const },

  /* ════ TEAM ROW CARDS ════ */
  teamList: { gap: CARD_GAP, paddingHorizontal: 16 },
  teamRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    padding: CARD_INNER_PAD - 4,
    ...cardGlow,
  },
  teamRowInfo: { flex: 1, minWidth: 0, gap: 5 },
  teamRowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamRowName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  captainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFD700' + '12',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  captainBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '700' as const },
  teamRowChipRow: { flexDirection: 'row', gap: 5 },
  teamRowChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  teamRowChipText: { color: Colors.text.secondary, fontSize: 10, fontWeight: '600' as const },
  teamProgressWrap: { marginTop: 4, gap: 4 },
  teamProgressBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.background.cardLight,
    overflow: 'hidden',
  },
  teamProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary.orange,
  },
  teamProgressLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' as const },

  /* ════ ACTIVITY CARDS ════ */
  activityList: { gap: 8 },
  activityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    overflow: 'hidden',
  },
  activityAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  activityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: { flex: 1, minWidth: 0, gap: 2 },
  activityTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  activityMeta: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityDateText: { color: Colors.text.muted, fontSize: 10, fontWeight: '600' as const },
  seeAllCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
  },
  seeAllCardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  seeAllCardText: { flex: 1, color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },

  /* ════ DISCOVER CARDS ════ */
  discoverScroll: { gap: CARD_GAP, paddingLeft: 16, paddingRight: 16 },
  discoverCard: {
    width: 140,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    padding: 14,
    gap: 8,
    ...cardGlow,
  },
  discoverAvatarWrap: { alignItems: 'center' },
  discoverName: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' as const, textAlign: 'center' },
  discoverChips: { flexDirection: 'row', justifyContent: 'center' },
  discoverChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discoverChipText: { color: Colors.text.secondary, fontSize: 9, fontWeight: '600' as const },
  discoverBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discoverMembers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  discoverMembersText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' as const },
  discoverCity: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: 60 },
  discoverCityText: { color: Colors.text.secondary, fontSize: 9 },

  /* ════ COMMUNITY CARDS ════ */
  communityScroll: { gap: CARD_GAP, paddingLeft: 16, paddingRight: 16 },
  communityCard: {
    width: 270,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    padding: 14,
    ...cardGlow,
  },
  communityInfo: { flex: 1, minWidth: 0, gap: 3 },
  communityReason: { color: '#2DD4BF', fontSize: 11, fontWeight: '600' as const },
  communityName: { color: Colors.text.primary, fontSize: 14, fontWeight: '800' as const, letterSpacing: -0.2 },
  communityBadges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  communityBadgeSport: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  communityBadgeSportText: { color: '#2DD4BF', fontSize: 9, fontWeight: '700' as const },
  communityBadgeLevel: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  communityBadgeLevelText: { color: '#FACC15', fontSize: 9, fontWeight: '700' as const },

  /* ════ EMPTY STATES ════ */
  emptyInline: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS - 4,
    marginHorizontal: 16,
  },
  emptyInlineText: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' as const },
  emptyInlineLink: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },

  emptyTeamCard: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
    position: 'relative',
    marginHorizontal: 16,
  },
  emptyTeamIconWrap: {
    width: 64,
    height: 64,
    borderRadius: CARD_RADIUS - 4,
    backgroundColor: Colors.primary.orange + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTeamTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' as const, marginBottom: 6, letterSpacing: -0.3 },
  emptyTeamText: { color: Colors.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 18, fontWeight: '400' as const },
  emptyTeamCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange + '10',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyTeamCtaText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' as const },
});
