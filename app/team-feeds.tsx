import React, { useState, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Megaphone, ChevronRight, Shield, Heart, MessageCircle, Clock, TrendingUp, Users, Star, Bell, BellOff } from 'lucide-react-native';
import { Colors, OUTER_PAD, CARD_RADIUS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { teamsApi } from '@/lib/api/teams';
import { Avatar } from '@/components/Avatar';
import { useFullscreenImage } from '@/components/FullscreenImageViewer';
import { sportLabels } from '@/mocks/data';
import type { Team, TeamPost } from '@/types';

type TabKey = 'followed' | 'all' | 'mine';
type SortKey = 'recent' | 'popular';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

interface TeamWithPosts {
  team: Team;
  posts: TeamPost[];
  loading: boolean;
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'followed', label: 'Suivies', icon: <Star size={14} color={Colors.primary.orange} /> },
  { key: 'all', label: 'Toutes', icon: <Users size={14} color={Colors.primary.orange} /> },
  { key: 'mine', label: 'Mes équipes', icon: <Shield size={14} color={Colors.primary.orange} /> },
];

export default function TeamFeedsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { teams, followTeam, unfollowTeam } = useTeams();
  const fullscreen = useFullscreenImage();
  const [refreshing, setRefreshing] = useState(false);
  const [teamsWithPosts, setTeamsWithPosts] = useState<TeamWithPosts[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('followed');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 120],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const followedTeams = useMemo(() => teams.filter(t => user && (t.fans ?? []).includes(user.id)), [teams, user]);
  const myTeams = useMemo(() => teams.filter(t => user && t.members.some(m => m.userId === user.id)), [teams, user]);

  const sourceTeams = activeTab === 'followed' ? followedTeams : activeTab === 'mine' ? myTeams : teams;

  const availableSports = useMemo(() => {
    const sports = new Set(sourceTeams.map(t => t.sport));
    return Array.from(sports);
  }, [sourceTeams]);

  const filteredTeams = useMemo(() => {
    let result = sourceTeams;
    if (sportFilter) {
      result = result.filter(t => t.sport === sportFilter);
    }
    return result;
  }, [sourceTeams, sportFilter]);

  const loadAllPosts = useCallback(async () => {
    if (filteredTeams.length === 0) {
      setTeamsWithPosts([]);
      return;
    }
    setTeamsWithPosts(filteredTeams.map(team => ({ team, posts: [], loading: true })));
    const results = await Promise.all(
      filteredTeams.map(async team => {
        try {
          const rawPosts = await teamsApi.getTeamPosts(team.id, 3);
          const enriched = rawPosts.map(post => {
            const member = team.members.find(m => m.userId === post.authorId);
            return { ...post, authorRole: member?.role };
          });
          return { team, posts: enriched, loading: false };
        } catch {
          return { team, posts: [] as TeamPost[], loading: false };
        }
      })
    );
    // Sort teams based on sortBy
    const sorted = [...results];
    if (sortBy === 'popular') {
      sorted.sort((a, b) => {
        const aScore = a.posts.reduce((s, p) => s + p.likesCount + p.commentsCount * 2, 0);
        const bScore = b.posts.reduce((s, p) => s + p.likesCount + p.commentsCount * 2, 0);
        return bScore - aScore;
      });
    } else {
      sorted.sort((a, b) => {
        const aTime = a.posts[0] ? new Date(a.posts[0].createdAt).getTime() : 0;
        const bTime = b.posts[0] ? new Date(b.posts[0].createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    setTeamsWithPosts(sorted);
  }, [filteredTeams, sortBy]);

  useFocusEffect(
    useCallback(() => {
      loadAllPosts();
    }, [loadAllPosts])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllPosts();
    } finally {
      setRefreshing(false);
    }
  }, [loadAllPosts]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setSportFilter(null);
  }, []);

  const renderTeam = useCallback(({ item }: { item: TeamWithPosts }) => {
    const totalLikes = item.posts.reduce((s, p) => s + p.likesCount, 0);
    const totalComments = item.posts.reduce((s, p) => s + p.commentsCount, 0);
    const isFollowing = user && (item.team.fans ?? []).includes(user.id);
    const isMember = user && item.team.members.some(m => m.userId === user.id);
    const fanCount = (item.team.fans ?? []).length;

    const handleFollowToggle = async () => {
      if (!user) return;
      try {
        if (isFollowing) {
          await unfollowTeam({ teamId: item.team.id, userId: user.id });
        } else {
          await followTeam({ teamId: item.team.id, userId: user.id });
        }
      } catch (e: any) {
        // ignore
      }
    };

    return (
      <View style={styles.teamSection}>
        {/* Team banner card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/team-feed/${item.team.id}` as any)}
        >
          <LinearGradient
            colors={[Colors.background.card, Colors.background.cardLight]}
            style={styles.teamBanner}
          >
            {/* Logo + glow */}
            <View style={styles.teamBannerLeft}>
              <View style={styles.teamLogoWrap}>
                {item.team.logo ? (
                  <ExpoImage source={{ uri: item.team.logo }} style={styles.teamLogo} contentFit="cover" />
                ) : (
                  <View style={styles.teamLogoPlaceholder}>
                    <Text style={styles.teamLogoText}>{item.team.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Info */}
            <View style={styles.teamBannerInfo}>
              <View style={styles.teamNameRow}>
                <Text style={styles.teamName} numberOfLines={1}>{item.team.name}</Text>
                {item.posts.length > 0 && (
                  <View style={styles.liveDot} />
                )}
                {isFollowing && (
                  <View style={styles.followingBadge}>
                    <Bell size={9} color={Colors.primary.orange} />
                    <Text style={styles.followingBadgeText}>Abonné</Text>
                  </View>
                )}
              </View>
              <Text style={styles.teamMeta}>{sportLabels[item.team.sport] || item.team.sport} · {item.team.city}</Text>

              {/* Last activity */}
              {!item.loading && item.posts.length > 0 && (
                <Text style={styles.teamLastActive}>
                  Dernier post {formatTimeAgo(item.posts[0].createdAt)}
                </Text>
              )}

              {/* Stats row */}
              <View style={styles.teamStatsRow}>
                {item.loading ? (
                  <Text style={styles.teamStatLoading}>Chargement...</Text>
                ) : item.posts.length === 0 ? (
                  <Text style={styles.teamStatEmpty}>Aucun post</Text>
                ) : (
                  <>
                    <View style={styles.teamStatItem}>
                      <Megaphone size={12} color={Colors.text.muted} />
                      <Text style={styles.teamStatText}>{item.posts.length} posts</Text>
                    </View>
                    <View style={styles.teamStatItem}>
                      <Heart size={12} color={Colors.text.muted} />
                      <Text style={styles.teamStatText}>{totalLikes}</Text>
                    </View>
                    <View style={styles.teamStatItem}>
                      <Bell size={12} color={Colors.text.muted} />
                      <Text style={styles.teamStatText}>{fanCount} abonnés</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <ChevronRight size={20} color={Colors.text.muted} style={styles.teamBannerChevron} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Follow/Unfollow button for non-members */}
        {!isMember && user && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing ? styles.followingBtn : styles.notFollowingBtn]}
            onPress={handleFollowToggle}
            activeOpacity={0.7}
          >
            {isFollowing ? <BellOff size={14} color={Colors.text.muted} /> : <Bell size={14} color={Colors.primary.orange} />}
            <Text style={[styles.followBtnText, isFollowing ? styles.followingBtnText : styles.notFollowingBtnText]}>
              {isFollowing ? 'Se désabonner' : 'S\'abonner'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Posts preview */}
        {item.loading ? (
          <View style={styles.skeletonRow}>
            {[1, 2].map(i => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonLine} />
                <View style={[styles.skeletonLine, { width: '60%' }]} />
                <View style={styles.skeletonImg} />
              </View>
            ))}
          </View>
        ) : item.posts.length === 0 ? (
          <View style={styles.noPostsRow}>
            <Megaphone size={20} color={Colors.text.muted} strokeWidth={1.5} />
            <Text style={styles.noPostsText}>Aucune publication récente</Text>
          </View>
        ) : (
          <View style={styles.postsPreview}>
            {item.posts.map((post, idx) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postPreviewItem}
                onPress={() => router.push(`/team-feed/${item.team.id}` as any)}
                activeOpacity={0.7}
              >
                {idx > 0 && <View style={styles.postPreviewDivider} />}

                {/* Author + time */}
                <View style={styles.postPreviewTopRow}>
                  <View style={styles.postPreviewAuthorRow}>
                    <View style={[styles.postPreviewAuthorDot, { backgroundColor: post.authorRole === 'cm' ? Colors.primary.blue : post.authorId === item.team.captainId ? Colors.primary.orange : Colors.text.muted + '60' }]} />
                    <Text style={styles.postPreviewAuthorName} numberOfLines={1}>
                      {post.authorFullName || post.authorUsername || 'Membre'}
                    </Text>
                    {post.authorRole === 'cm' && (
                      <View style={styles.postPreviewRoleChip}>
                        <Text style={styles.postPreviewRoleChipText}>CM</Text>
                      </View>
                    )}
                    {post.authorId === item.team.captainId && (
                      <View style={[styles.postPreviewRoleChip, { backgroundColor: Colors.primary.orange + '20' }]}>
                        <Text style={[styles.postPreviewRoleChipText, { color: Colors.primary.orange }]}>Cap.</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.postPreviewTime}>{formatTimeAgo(post.createdAt)}</Text>
                </View>

                {/* Content */}
                {post.content ? (
                  <Text style={styles.postPreviewContent} numberOfLines={3}>{post.content}</Text>
                ) : null}

                {/* Images */}
                {post.images && post.images.length === 1 && (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => fullscreen.open(post.images[0])} style={styles.postPreviewImgLargeWrap}>
                    <ExpoImage
                      source={{ uri: post.images[0] }}
                      style={styles.postPreviewImgLarge}
                      contentFit="cover"
                      transition={150}
                    />
                  </TouchableOpacity>
                )}
                {post.images && post.images.length > 1 && (
                  <View style={styles.postPreviewImages}>
                    {post.images.slice(0, 3).map((img, i) => (
                      <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => fullscreen.open(post.images, i)}>
                        <ExpoImage
                          source={{ uri: img }}
                          style={styles.postPreviewThumb}
                          contentFit="cover"
                          transition={150}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Stats */}
                <View style={styles.postPreviewStats}>
                  <View style={styles.postPreviewStatItem}>
                    <Heart size={12} color={Colors.text.muted} />
                    <Text style={styles.postPreviewStatText}>{post.likesCount}</Text>
                  </View>
                  <View style={styles.postPreviewStatItem}>
                    <MessageCircle size={12} color={Colors.text.muted} />
                    <Text style={styles.postPreviewStatText}>{post.commentsCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push(`/team-feed/${item.team.id}` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>Voir tout le feed</Text>
              <ChevronRight size={14} color={Colors.primary.orange} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [router]);

  const keyExtractor = useCallback((item: TeamWithPosts) => item.team.id, []);

  const renderSkeletonList = () => (
    <View>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.teamSection}>
          <View style={styles.teamBanner}>
            <View style={styles.skeletonLogo} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '50%' }]} />
            </View>
          </View>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '60%' }]} />
              <View style={styles.skeletonImg} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (refreshing || (teamsWithPosts.length > 0 && teamsWithPosts.some(t => t.loading))) {
      return renderSkeletonList();
    }
    const emptyConfig = {
      followed: {
        title: 'Aucune équipe suivie',
        subtitle: 'Suivez des équipes pour voir leurs publications ici. Restez informé des actualités de vos équipes préférées !',
        btn: 'Découvrir des équipes',
      },
      mine: {
        title: 'Vous n\'êtes dans aucune équipe',
        subtitle: 'Rejoignez ou créez une équipe pour publier du contenu et interagir avec votre communauté.',
        btn: 'Voir les équipes',
      },
      all: {
        title: 'Aucune équipe disponible',
        subtitle: 'Les équipes apparaîtront ici une fois créées. Soyez le premier à en créer une !',
        btn: 'Créer une équipe',
      },
    };
    const cfg = emptyConfig[activeTab];
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[Colors.primary.orange + '20', 'transparent']}
          style={styles.emptyGlow}
        />
        <View style={styles.emptyIconWrap}>
          <Megaphone size={36} color={Colors.primary.orange} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>{cfg.title}</Text>
        <Text style={styles.emptySubtitle}>{cfg.subtitle}</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/(tabs)/teams')}
          activeOpacity={0.8}
        >
          <Users size={18} color="#FFF" />
          <Text style={styles.emptyBtnText}>{cfg.btn}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderListHeader = useCallback(() => {
    if (filteredTeams.length === 0) return null;
    return (
      <View style={styles.listHeader}>
        {/* Sport filter chips */}
        {availableSports.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <TouchableOpacity
              style={[styles.chip, !sportFilter && styles.chipActive]}
              onPress={() => setSportFilter(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, !sportFilter && styles.chipTextActive]}>Tous</Text>
            </TouchableOpacity>
            {availableSports.map(sport => (
              <TouchableOpacity
                key={sport}
                style={[styles.chip, sportFilter === sport && styles.chipActive]}
                onPress={() => setSportFilter(sportFilter === sport ? null : sport)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, sportFilter === sport && styles.chipTextActive]}>
                  {sportLabels[sport] || sport}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Sort toggle */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{filteredTeams.length} équipe{filteredTeams.length > 1 ? 's' : ''}</Text>
          <View style={styles.sortToggle}>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
              onPress={() => setSortBy('recent')}
              activeOpacity={0.7}
            >
              <Clock size={13} color={sortBy === 'recent' ? '#FFF' : Colors.text.muted} />
              <Text style={[styles.sortBtnText, sortBy === 'recent' && styles.sortBtnTextActive]}>Récent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortBtn, sortBy === 'popular' && styles.sortBtnActive]}
              onPress={() => setSortBy('popular')}
              activeOpacity={0.7}
            >
              <TrendingUp size={13} color={sortBy === 'popular' ? '#FFF' : Colors.text.muted} />
              <Text style={[styles.sortBtnText, sortBy === 'popular' && styles.sortBtnTextActive]}>Populaire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [filteredTeams.length, availableSports, sportFilter, sortBy]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0d111d', '#0b0f1a', Colors.background.dark, '#0d111d']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Animated header */}
        <Animated.View style={[styles.header, { backgroundColor: `rgba(13,17,29,${headerOpacity})` }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Megaphone size={20} color={Colors.primary.orange} />
            <Text style={styles.headerTitle}>Feeds d'équipes</Text>
          </View>
          <View style={styles.backBtn} />
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
            >
              {tab.icon}
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View style={styles.tabUnderline} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={teamsWithPosts}
          keyExtractor={keyExtractor}
          renderItem={renderTeam}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          windowSize={6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary.orange}
              colors={[Colors.primary.orange]}
              progressBackgroundColor={Colors.background.card}
              title="Actualisation..."
              titleColor={Colors.text.muted}
            />
          }
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
        />
      </SafeAreaView>
      {fullscreen.viewer}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: OUTER_PAD, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },

  // Tabs
  tabsContainer: {
    flexDirection: 'row', paddingHorizontal: OUTER_PAD, paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.background.card,
  },
  tabActive: {
    backgroundColor: Colors.primary.orange + '20',
  },
  tabText: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: Colors.primary.orange },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 14, right: 14, height: 2,
    backgroundColor: Colors.primary.orange, borderRadius: 1,
  },

  // List header
  listHeader: { marginBottom: 8 },
  chipsRow: { paddingHorizontal: OUTER_PAD, gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light,
  },
  chipActive: {
    backgroundColor: Colors.primary.orange, borderColor: Colors.primary.orange,
  },
  chipText: { color: Colors.text.muted, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: OUTER_PAD, paddingVertical: 8,
  },
  sortLabel: { color: Colors.text.muted, fontSize: 13 },
  sortToggle: { flexDirection: 'row', backgroundColor: Colors.background.card, borderRadius: 16, padding: 3 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 13,
  },
  sortBtnActive: { backgroundColor: Colors.primary.orange },
  sortBtnText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' },
  sortBtnTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: OUTER_PAD, paddingTop: 8, paddingBottom: 40 },

  // Team section
  teamSection: { marginBottom: 20 },
  teamBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  teamBannerLeft: {},
  teamLogoWrap: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
  },
  teamLogo: { width: 52, height: 52, borderRadius: 26 },
  teamLogoPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary.orange + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  teamLogoText: { color: Colors.primary.orange, fontSize: 22, fontWeight: '800' },
  teamBannerInfo: { flex: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.status.success },
  teamMeta: { color: Colors.text.muted, fontSize: 12, marginTop: 3 },
  teamLastActive: { color: Colors.primary.orange, fontSize: 11, fontWeight: '500', marginTop: 2 },
  teamStatsRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  teamStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamStatText: { color: Colors.text.muted, fontSize: 12 },
  teamStatLoading: { color: Colors.text.muted, fontSize: 12, fontStyle: 'italic' },
  teamStatEmpty: { color: Colors.text.muted, fontSize: 12 },
  teamBannerChevron: { marginRight: 4 },

  // Following badge
  followingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primary.orange + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  followingBadgeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '600' },

  // Follow button
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, marginTop: 8, alignSelf: 'flex-start',
  },
  followingBtn: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  notFollowingBtn: { backgroundColor: Colors.primary.orange + '15', borderWidth: 1, borderColor: Colors.primary.orange + '40' },
  followBtnText: { fontSize: 13, fontWeight: '600' },
  followingBtnText: { color: Colors.text.muted },
  notFollowingBtnText: { color: Colors.primary.orange },

  // Post preview author
  postPreviewBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  postPreviewAuthor: { color: Colors.text.muted, fontSize: 11, flexShrink: 1 },

  // Posts
  noPostsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  noPostsText: { color: Colors.text.muted, fontSize: 13 },
  postsPreview: { marginTop: 8 },
  postPreviewItem: { paddingVertical: 12 },
  postPreviewDivider: { height: 1, backgroundColor: Colors.border.light, marginBottom: 12 },
  postPreviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  postPreviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  postPreviewAuthorDot: { width: 7, height: 7, borderRadius: 4 },
  postPreviewAuthorName: { color: Colors.text.primary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  postPreviewRoleChip: { backgroundColor: Colors.primary.blue + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  postPreviewRoleChipText: { color: Colors.primary.blue, fontSize: 9, fontWeight: '600' },
  postPreviewTime: { color: Colors.text.muted, fontSize: 11 },
  postPreviewContent: { color: Colors.text.muted, fontSize: 14, lineHeight: 20 },
  postPreviewImages: { flexDirection: 'row', gap: 6, marginTop: 8 },
  postPreviewThumb: { width: 80, height: 80, borderRadius: 10 },
  postPreviewImgLargeWrap: { width: '100%', marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  postPreviewImgLarge: { width: '100%', height: 200 },
  postPreviewStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
  postPreviewStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postPreviewStatText: { color: Colors.text.muted, fontSize: 12 },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, marginTop: 2,
  },
  seeAllText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '600' },

  // Skeletons
  skeletonRow: { gap: 10, marginTop: 10 },
  skeletonCard: {
    backgroundColor: Colors.background.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border.light, gap: 8,
  },
  skeletonLine: { height: 12, backgroundColor: Colors.background.elevated, borderRadius: 6 },
  skeletonImg: { height: 80, backgroundColor: Colors.background.elevated, borderRadius: 12, marginTop: 4 },
  skeletonLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.background.elevated },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, borderRadius: 100 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary.orange, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
