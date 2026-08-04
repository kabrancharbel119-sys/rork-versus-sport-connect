import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Animated, TextInput, KeyboardAvoidingView, Platform, Modal, ScrollView, Alert, LayoutAnimation, Platform as RNPlatform, UIManager } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Heart, MessageCircle, Trash2, Send, X, ImagePlus, Camera, Shield, Megaphone, Users, MapPin, Bell, BellOff, Share2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Share as RNShare } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, OUTER_PAD, CARD_RADIUS, CARD_INNER_PAD } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useFullscreenImage } from '@/components/FullscreenImageViewer';
import { teamsApi } from '@/lib/api/teams';
import { uploadTeamPostImage } from '@/lib/uploadImage';
import { Avatar } from '@/components/Avatar';
import type { TeamPost, TeamPostComment, Team, CMPermissions } from '@/types';
import { sportLabels } from '@/mocks/data';

if (RNPlatform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const MAX_IMAGES = 4;
const MAX_CONTENT_LENGTH = 500;

export default function TeamFeedScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getTeamById } = useTeams();
  const { addNotification } = useNotifications();

  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<TeamPostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [cmPermissions, setCmPermissions] = useState<CMPermissions | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const fullscreen = useFullscreenImage();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 120],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const loadTeam = useCallback(() => {
    if (!id) return;
    teamsApi.getById(id)
      .then(t => { setTeam(t); setIsFollowing(user ? (t.fans ?? []).includes(user.id) : false); })
      .catch(() => {})
      .finally(() => setLoadingTeam(false));
  }, [id, user]);

  const loadPosts = useCallback(() => {
    if (!id) return;
    teamsApi.getTeamPosts(id, 30, 0, user?.id)
      .then(p => {
        const teamMembers = team?.members ?? [];
        const enriched = p.map(post => {
          const member = teamMembers.find(m => m.userId === post.authorId);
          return { ...post, authorRole: member?.role };
        });
        setPosts(enriched);
      })
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [id, team]);

  useEffect(() => {
    loadTeam();
    loadPosts();
    if (id) {
      AsyncStorage.setItem(`feed_last_visit_${id}`, new Date().toISOString());
    }
  }, [loadTeam, loadPosts, id]);

  const isMember = team?.members.some(m => m.userId === user?.id) ?? false;
  const isCaptain = team?.captainId === user?.id;
  const isCoCaptain = team?.coCaptainIds.includes(user?.id || '') ?? false;
  const isCM = team?.members.find(m => m.userId === user?.id)?.role === 'cm';
  const canPost = isCaptain || isCoCaptain || (isCM && cmPermissions?.can_post !== false);
  const canDeletePosts = isCaptain || (isCM && cmPermissions?.can_delete_posts === true);
  const canManagePhotos = isCaptain || (isCM && cmPermissions?.can_manage_photos === true);
  const canPinPosts = isCaptain || (isCM && cmPermissions?.can_pin_posts === true);
  const userRoleLabel = isCaptain ? 'Capitaine' : isCoCaptain ? 'Co-capitaine' : isCM ? 'Community Manager' : null;

  useEffect(() => {
    if (id && user && isCM) {
      teamsApi.getMyCMPermissions(id, user.id)
        .then(perms => setCmPermissions(perms))
        .catch(() => setCmPermissions(null));
    } else {
      setCmPermissions(null);
    }
  }, [id, user, isCM]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTeam(), loadPosts()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTeam, loadPosts]);

  const handleCreatePost = useCallback(async (content: string, images: string[]) => {
    if (!id || !user) return;
    await teamsApi.createTeamPost(id, user.id, content, images);
    loadPosts();
    if (team) {
      const fans = (team.fans ?? []).filter(fanId => fanId !== user.id);
      if (fans.length > 0) {
        const authorName = team.members.find(m => m.userId === user.id);
        const roleLabel = authorName?.role === 'cm' ? 'le Community Manager' : authorName?.role === 'captain' ? 'le capitaine' : 'un membre';
        const preview = content.trim().slice(0, 60) + (content.length > 60 ? '...' : '');
        for (const fanId of fans) {
          try {
            await addNotification({
              userId: fanId,
              type: 'team',
              title: `📢 ${team.name} a publié`,
              message: `${roleLabel} a publié : "${preview}"`,
              data: { route: `/team-feed/${team.id}` },
            });
          } catch {}
        }
      }
    }
  }, [id, user, loadPosts, team, addNotification]);

  const handleDeletePost = useCallback(async (postId: string) => {
    Alert.alert('Supprimer le post', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          await teamsApi.deleteTeamPost(postId);
          setPosts(prev => prev.filter(p => p.id !== postId));
        }
      }
    ]);
  }, []);

  const handleFollowToggle = useCallback(async () => {
    if (!user || !team) return;
    try {
      if (isFollowing) {
        await teamsApi.unfollowTeam(team.id, user.id);
        setIsFollowing(false);
        setTeam(prev => prev ? { ...prev, fans: (prev.fans ?? []).filter(f => f !== user.id) } : prev);
      } else {
        await teamsApi.followTeam(team.id, user.id);
        setIsFollowing(true);
        setTeam(prev => prev ? { ...prev, fans: [...(prev.fans ?? []), user.id] } : prev);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de modifier l\'abonnement');
    }
  }, [user, team, isFollowing]);

  const handleLike = useCallback(async (postId: string, hasLiked: boolean) => {
    if (!user) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, hasLiked: !hasLiked, likesCount: p.likesCount + (hasLiked ? -1 : 1) }
        : p
    ));
    try {
      await teamsApi.toggleTeamPostLike(postId, user.id, hasLiked);
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, hasLiked: hasLiked, likesCount: p.likesCount + (hasLiked ? 1 : -1) }
          : p
      ));
    }
  }, [user]);

  const openComments = useCallback(async (postId: string) => {
    setCommentPostId(postId);
    setLoadingComments(true);
    try {
      const cmts = await teamsApi.getTeamPostComments(postId);
      setComments(cmts);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentPostId(null);
    setComments([]);
    setCommentText('');
  }, []);

  const handleSendComment = useCallback(async () => {
    if (!commentPostId || !commentText.trim() || !user) return;
    setPostingComment(true);
    const text = commentText.trim();
    setCommentText('');
    try {
      await teamsApi.addTeamPostComment(commentPostId, user.id, text);
      const cmts = await teamsApi.getTeamPostComments(commentPostId);
      setComments(cmts);
      setPosts(prev => prev.map(p =>
        p.id === commentPostId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      ));
    } catch {
      setCommentText(text);
    } finally {
      setPostingComment(false);
    }
  }, [commentPostId, commentText, user]);

  const renderPost = useCallback(({ item }: { item: TeamPost }) => (
    <TeamPostCard
      post={item}
      onLike={handleLike}
      onComment={openComments}
      onDelete={handleDeletePost}
      canDelete={item.authorId === user?.id || canDeletePosts}
      currentUserId={user?.id}
      onImagePress={(uri) => fullscreen.open(uri)}
      captainId={team?.captainId}
    />
  ), [handleLike, openComments, handleDeletePost, user?.id, canDeletePosts]);

  const keyExtractor = useCallback((item: TeamPost) => item.id, []);

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.skeletonAvatar} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          </View>
          <View style={[styles.skeletonLine, { marginHorizontal: CARD_INNER_PAD, width: '90%' }]} />
          <View style={[styles.skeletonLine, { marginHorizontal: CARD_INNER_PAD, width: '70%', marginBottom: 12 }]} />
          <View style={styles.skeletonImage} />
          <View style={[styles.postActions, { gap: 24 }]}>
            <View style={styles.skeletonAction} />
            <View style={styles.skeletonAction} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (loadingPosts) {
      return renderSkeleton();
    }
    const isFan = !isMember && isFollowing;
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[canPost ? Colors.primary.blue + '20' : Colors.primary.orange + '20', 'transparent']}
          style={styles.emptyGlow}
        />
        <View style={[styles.emptyIconWrap, canPost && { borderColor: Colors.primary.blue + '40' }]}>
          <Megaphone size={36} color={canPost ? Colors.primary.blue : Colors.primary.orange} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Aucune publication</Text>
        <Text style={styles.emptySubtitle}>
          {canPost
            ? isCM
              ? 'En tant que Community Manager, publiez au nom de l\'équipe pour tenir les abonnés informés !'
              : 'Publiez au nom de l\'équipe pour tenir vos abonnés informés !'
            : isFan
            ? 'Cette équipe n\'a pas encore publié de contenu. Revenez bientôt pour suivre ses actualités !'
            : isMember
            ? 'Aucun contenu publié pour le moment. Les capitaines et CM peuvent publier ici.'
            : 'Cette équipe n\'a pas encore publié de contenu.'}
        </Text>
        {canPost && (
          <TouchableOpacity
            style={[styles.emptyBtn, isCM && { backgroundColor: Colors.primary.blue }]}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Créer un post</Text>
          </TouchableOpacity>
        )}
        {!isMember && !isFollowing && (
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: Colors.primary.orange + '15', borderWidth: 1, borderColor: Colors.primary.orange + '40' }]}
            onPress={handleFollowToggle}
            activeOpacity={0.8}
          >
            <Bell size={18} color={Colors.primary.orange} />
            <Text style={[styles.emptyBtnText, { color: Colors.primary.orange }]}>S'abonner à cette équipe</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0d111d', '#0b0f1a', Colors.background.dark, '#0d111d']}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { backgroundColor: `rgba(13,17,29,${headerOpacity})` }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {team && (
              <>
                <Avatar uri={team.logo} name={team.name} size="small" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{team.name}</Text>
                  <Text style={styles.headerSubtitle}>Feed d'équipe</Text>
                </View>
              </>
            )}
          </View>
          {canPost && (
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.7}>
              <Plus size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </Animated.View>

        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          initialNumToRender={3}
          windowSize={7}
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
          ListHeaderComponent={
            team && !loadingTeam ? (
              <View style={styles.teamBanner}>
                <LinearGradient
                  colors={[Colors.primary.orange + '15', 'transparent']}
                  style={styles.teamBannerGradient}
                />
                {team.logo ? (
                  <ExpoImage source={{ uri: team.logo }} style={styles.teamBannerLogo} contentFit="cover" transition={150} />
                ) : (
                  <View style={styles.teamBannerLogoPlaceholder}>
                    <Text style={styles.teamBannerLogoText}>{team.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.teamBannerName}>{team.name}</Text>
                <View style={styles.teamBannerMeta}>
                  <View style={styles.teamBannerMetaItem}>
                    <MapPin size={12} color={Colors.text.muted} />
                    <Text style={styles.teamBannerMetaText}>{team.city}</Text>
                  </View>
                  <View style={styles.teamBannerMetaDot} />
                  <Text style={styles.teamBannerMetaText}>{sportLabels[team.sport] || team.sport}</Text>
                  <View style={styles.teamBannerMetaDot} />
                  <View style={styles.teamBannerMetaItem}>
                    <Users size={12} color={Colors.text.muted} />
                    <Text style={styles.teamBannerMetaText}>{team.members.length} membres</Text>
                  </View>
                  <View style={styles.teamBannerMetaDot} />
                  <View style={styles.teamBannerMetaItem}>
                    <Bell size={12} color={Colors.text.muted} />
                    <Text style={styles.teamBannerMetaText}>{(team.fans ?? []).length} abonnés</Text>
                  </View>
                </View>

                {/* Role badge with permissions */}
                {canPost && userRoleLabel && (
                  <View style={styles.cmBadgeRow}>
                    <View style={[styles.cmBadge, isCM ? styles.cmBadgeCM : styles.cmBadgeCaptain]}>
                      <Megaphone size={12} color={isCM ? Colors.primary.blue : Colors.primary.orange} />
                      <Text style={[styles.cmBadgeText, isCM ? styles.cmBadgeTextCM : styles.cmBadgeTextCaptain]}>{userRoleLabel}</Text>
                    </View>
                    <Text style={styles.cmBadgeHint}>Vous pouvez publier au nom de l'équipe</Text>
                  </View>
                )}

                {/* CM permissions chips */}
                {isCM && cmPermissions && (
                  <View style={styles.cmPermChipsRow}>
                    {cmPermissions.can_post && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Posts</Text></View>}
                    {cmPermissions.can_delete_posts && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Suppr.</Text></View>}
                    {cmPermissions.can_manage_photos && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Photos</Text></View>}
                    {cmPermissions.can_pin_posts && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Épingler</Text></View>}
                  </View>
                )}

                {/* Follow/Unfollow button for non-members */}
                {!isMember && user && (
                  <TouchableOpacity
                    style={[styles.bannerFollowBtn, isFollowing ? styles.bannerFollowingBtn : styles.bannerNotFollowingBtn]}
                    onPress={handleFollowToggle}
                    activeOpacity={0.7}
                  >
                    {isFollowing ? <BellOff size={14} color={Colors.text.muted} /> : <Bell size={14} color={Colors.primary.orange} />}
                    <Text style={[styles.bannerFollowBtnText, isFollowing ? styles.bannerFollowingBtnText : styles.bannerNotFollowingBtnText]}>
                      {isFollowing ? 'Abonné' : 'S\'abonner'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            posts.length > 0 ? (
              <View style={styles.endContainer}>
                <View style={styles.endLine} />
                <Text style={styles.endText}>Vous êtes à jour</Text>
                <View style={styles.endLine} />
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      <CreateTeamPostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPost={handleCreatePost}
        teamId={id || ''}
        teamName={team?.name || ''}
        teamLogo={team?.logo}
        userRole={userRoleLabel}
        isCM={!!isCM}
        cmPermissions={cmPermissions}
      />

      <CommentSheet
        visible={!!commentPostId}
        comments={comments}
        loading={loadingComments}
        commentText={commentText}
        onCommentTextChange={setCommentText}
        onSend={handleSendComment}
        onClose={handleCloseComments}
        posting={postingComment}
        currentUserId={user?.id}
      />

      {fullscreen.viewer}
    </View>
  );
}

// ════ TeamPostCard ════
interface TeamPostCardProps {
  post: TeamPost;
  onLike: (postId: string, hasLiked: boolean) => void;
  onComment: (postId: string) => void;
  onDelete: (postId: string) => void;
  canDelete: boolean;
  currentUserId?: string;
  onImagePress: (uri: string) => void;
  captainId?: string;
}

function TeamPostCard({ post, onLike, onComment, onDelete, canDelete, onImagePress, captainId }: TeamPostCardProps) {
  const likeScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0.5)).current;
  const lastTap = useRef(0);

  const handleShare = useCallback(async () => {
    const teamName = post.teamName || 'Notre équipe';
    const content = post.content || '';
    const message = `${teamName} sur Versus Sport\n\n${content}${content.length > 200 ? '...' : ''}\n\n— via Versus Sport App`;
    try {
      await RNShare.share({ message, title: `${teamName} - Feed d'équipe` });
    } catch {}
  }, [post.teamName, post.content]);

  const triggerBurst = useCallback(() => {
    burstOpacity.setValue(1);
    burstScale.setValue(0.5);
    Animated.parallel([
      Animated.timing(burstOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(burstScale, { toValue: 1.2, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [burstOpacity, burstScale]);

  const handleLike = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLike(post.id, !!post.hasLiked);
  }, [post.id, post.hasLiked, onLike, likeScale]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!post.hasLiked) handleLike();
      triggerBurst();
    }
    lastTap.current = now;
  }, [post.hasLiked, handleLike, triggerBurst]);

  const authorName = post.authorFullName || post.authorUsername || 'Membre';
  const authorInitial = authorName.charAt(0).toUpperCase();
  const isCMPost = post.authorRole === 'cm';
  const isCaptainPost = post.authorId === captainId;
  const isCoCaptainPost = post.authorRole === 'co-captain';
  const roleColor = isCMPost ? Colors.primary.blue : isCaptainPost ? Colors.primary.orange : Colors.text.muted;
  const roleLabel = isCMPost ? 'CM' : isCaptainPost ? 'Cap.' : isCoCaptainPost ? 'Co-cap.' : '';

  return (
    <PressableCard onPress={handleDoubleTap} style={styles.postCard}>
      {/* Header — Team as author with author avatar */}
      <View style={styles.postHeader}>
        <View style={styles.postHeaderAvatarWrap}>
          <Avatar uri={post.teamLogo} name={post.teamName} size="medium" showBadge badgeColor={Colors.primary.orange} />
          <View style={[styles.postHeaderAuthorAvatar, { borderColor: roleColor + '60' }]}>
            <Text style={[styles.postHeaderAuthorInitial, { color: roleColor }]}>{authorInitial}</Text>
          </View>
        </View>
        <View style={styles.postHeaderInfo}>
          <View style={styles.postAuthorRow}>
            <Text style={styles.postAuthorName} numberOfLines={1}>{post.teamName || 'Équipe'}</Text>
            <View style={[styles.teamBadge, { backgroundColor: Colors.primary.orange + '20' }]}>
              <Shield size={10} color={Colors.primary.orange} />
              <Text style={styles.teamBadgeText}>Officiel</Text>
            </View>
          </View>
          <View style={styles.postMetaRow}>
            <Text style={styles.postMetaAuthor} numberOfLines={1}>
              par <Text style={[styles.postMetaAuthorName, { color: roleColor }]}>{authorName}</Text>
            </Text>
            {roleLabel ? (
              <View style={[styles.postRoleChip, { backgroundColor: roleColor + '20' }]}>
                <Text style={[styles.postRoleChipText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.postMetaTime}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(post.id)} activeOpacity={0.6}>
            <Trash2 size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.content ? (
        <Text style={styles.postContent}>{post.content}</Text>
      ) : null}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <View style={styles.postImagesContainer}>
          {post.images.length === 1 ? (
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(post.images[0])}>
              <ExpoImage
                source={{ uri: post.images[0] }}
                style={styles.postImageSingle}
                contentFit="cover"
                transition={150}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.postImagesGrid}>
              {post.images.slice(0, 4).map((img, i) => (
                <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onImagePress(img)}>
                  <ExpoImage
                    source={{ uri: img }}
                    style={styles.postImageGrid}
                    contentFit="cover"
                    transition={150}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Heart
              size={20}
              color={post.hasLiked ? Colors.status.error : Colors.text.muted}
              fill={post.hasLiked ? Colors.status.error : 'none'}
            />
          </Animated.View>
          <Text style={[styles.actionText, post.hasLiked && styles.actionTextLiked]}>
            {post.likesCount > 0 ? post.likesCount.toString() : 'J\'aime'}
          </Text>
          <Animated.View
            pointerEvents="none"
            style={[styles.burstHeart, { opacity: burstOpacity, transform: [{ scale: burstScale }] }]}
          >
            <Heart size={40} color={Colors.status.error} fill={Colors.status.error} />
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)} activeOpacity={0.7}>
          <MessageCircle size={20} color={Colors.text.muted} />
          <Text style={styles.actionText}>
            {post.commentsCount > 0 ? post.commentsCount.toString() : 'Commenter'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <Share2 size={20} color={Colors.text.muted} />
          <Text style={styles.actionText}>Partager</Text>
        </TouchableOpacity>
      </View>
    </PressableCard>
  );
}

function PressableCard({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={1} style={style}>
      {children}
    </TouchableOpacity>
  );
}

// ════ CreateTeamPostModal ════
interface CreateTeamPostModalProps {
  visible: boolean;
  onClose: () => void;
  onPost: (content: string, images: string[]) => Promise<void>;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  userRole?: string | null;
  isCM?: boolean;
  cmPermissions?: CMPermissions | null;
}

function CreateTeamPostModal({ visible, onClose, onPost, teamId, teamName, teamLogo, userRole, isCM, cmPermissions }: CreateTeamPostModalProps) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resetState = useCallback(() => {
    setContent('');
    setImages([]);
    setIsPosting(false);
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isPosting || isUploading) return;
    resetState();
    onClose();
  }, [isPosting, isUploading, resetState, onClose]);

  const pickImage = useCallback(async () => {
    if (images.length >= MAX_IMAGES) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsUploading(true);
      try {
        const url = await uploadTeamPostImage(uri, teamId, images.length);
        setImages(prev => [...prev, url]);
      } catch (e) {
        Alert.alert('Erreur', 'Impossible d\'uploader l\'image.');
      } finally {
        setIsUploading(false);
      }
    }
  }, [images.length, teamId]);

  const takePhoto = useCallback(async () => {
    if (images.length >= MAX_IMAGES) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'L\'accès à la caméra est requis.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsUploading(true);
      try {
        const url = await uploadTeamPostImage(uri, teamId, images.length);
        setImages(prev => [...prev, url]);
      } catch {
        Alert.alert('Erreur', 'Impossible d\'uploader l\'image.');
      } finally {
        setIsUploading(false);
      }
    }
  }, [images.length, teamId]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handlePost = useCallback(async () => {
    if (!content.trim() && images.length === 0) return;
    setIsPosting(true);
    try {
      await onPost(content.trim(), images);
      resetState();
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible de publier le post.');
    } finally {
      setIsPosting(false);
    }
  }, [content, images, onPost, resetState, onClose]);

  const canSubmit = (content.trim().length > 0 || images.length > 0) && !isPosting && !isUploading;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} disabled={isPosting}>
              <X size={24} color={Colors.text.muted} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Post d'équipe</Text>
            <TouchableOpacity onPress={handlePost} disabled={!canSubmit}>
              {isPosting ? (
                <ActivityIndicator size="small" color={Colors.primary.orange} />
              ) : (
                <Send size={22} color={canSubmit ? Colors.primary.orange : Colors.text.muted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Team identity */}
          <View style={styles.modalTeamRow}>
            <Avatar uri={teamLogo} name={teamName} size="medium" showBadge badgeColor={isCM ? Colors.primary.blue : Colors.primary.orange} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.modalTeamName}>{teamName}</Text>
              <View style={styles.modalTeamHintRow}>
                <Megaphone size={11} color={isCM ? Colors.primary.blue : Colors.primary.orange} />
                <Text style={[styles.modalTeamHint, isCM && { color: Colors.primary.blue }]}>
                  {isCM ? `Publié en tant que CM` : userRole ? `Publié en tant que ${userRole}` : 'Publié au nom de l\'équipe'}
                </Text>
              </View>
              {isCM && cmPermissions && (
                <View style={styles.modalCMPerms}>
                  {cmPermissions.can_post && <View style={styles.modalCMPermChip}><Text style={styles.modalCMPermChipText}>Posts</Text></View>}
                  {cmPermissions.can_delete_posts && <View style={styles.modalCMPermChip}><Text style={styles.modalCMPermChipText}>Suppr.</Text></View>}
                  {cmPermissions.can_manage_photos && <View style={styles.modalCMPermChip}><Text style={styles.modalCMPermChipText}>Photos</Text></View>}
                </View>
              )}
            </View>
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="Partagez une actualité de l'équipe..."
            placeholderTextColor={Colors.text.muted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={MAX_CONTENT_LENGTH}
            textAlignVertical="top"
          />

          {content.length > 0 && (
            <View style={styles.charCountRow}>
              <View style={styles.charCountBar}>
                <View style={[styles.charCountFill, { width: `${Math.min((content.length / MAX_CONTENT_LENGTH) * 100, 100)}%` }]} />
              </View>
              <Text style={[styles.charCount, content.length > MAX_CONTENT_LENGTH * 0.9 && { color: Colors.status.error }]}>
                {content.length}/{MAX_CONTENT_LENGTH}
              </Text>
            </View>
          )}

          {/* Images preview */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalImagesRow}>
              {images.map((img, i) => (
                <View key={i} style={styles.modalImageWrap}>
                  <ExpoImage source={{ uri: img }} style={styles.modalImage} contentFit="cover" />
                  <TouchableOpacity style={styles.modalImageRemove} onPress={() => removeImage(i)}>
                    <X size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Image actions */}
          <View style={styles.modalImageActions}>
            <TouchableOpacity style={styles.modalImageBtn} onPress={pickImage} disabled={isUploading || images.length >= MAX_IMAGES}>
              {isUploading ? <ActivityIndicator size={18} color={Colors.primary.orange} /> : <ImagePlus size={20} color={Colors.primary.orange} />}
              <Text style={styles.modalImageBtnText}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalImageBtn} onPress={takePhoto} disabled={isUploading || images.length >= MAX_IMAGES}>
              <Camera size={20} color={Colors.primary.orange} />
              <Text style={styles.modalImageBtnText}>Photo</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <Text style={styles.imageCount}>{images.length}/{MAX_IMAGES}</Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ════ CommentSheet ════
interface CommentSheetProps {
  visible: boolean;
  comments: TeamPostComment[];
  loading: boolean;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
  posting: boolean;
  currentUserId?: string;
}

function CommentSheet({ visible, comments, loading, commentText, onCommentTextChange, onSend, onClose, posting }: CommentSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.commentOverlay}>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>Commentaires</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.commentLoading}>
              <ActivityIndicator size="large" color={Colors.primary.orange} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.commentEmpty}>
              <MessageCircle size={32} color={Colors.text.muted} />
              <Text style={styles.commentEmptyText}>Aucun commentaire pour le moment</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <Avatar uri={item.avatar} name={item.fullName || item.username || ''} size="small" />
                  <View style={styles.commentBody}>
                    <Text style={styles.commentAuthor}>{item.fullName || item.username || 'Utilisateur'}</Text>
                    <Text style={styles.commentText}>{item.content}</Text>
                    <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={styles.commentList}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={Colors.text.muted}
              value={commentText}
              onChangeText={onCommentTextChange}
              multiline
              maxLength={500}
            />
            <TouchableOpacity onPress={onSend} disabled={!commentText.trim() || posting} style={styles.commentSendBtn}>
              {posting ? (
                <ActivityIndicator size={18} color="#FFF" />
              ) : (
                <Send size={18} color={commentText.trim() ? '#FFF' : Colors.text.muted} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ════ Styles ════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: OUTER_PAD,
    paddingVertical: 10, gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: Colors.text.muted, fontSize: 12, marginTop: 1 },
  createBtn: { padding: 6, backgroundColor: Colors.primary.orange, borderRadius: 20 },
  listContent: { paddingHorizontal: OUTER_PAD, paddingTop: 8, paddingBottom: 40 },

  // Post card
  postCard: {
    backgroundColor: Colors.background.card,
    borderRadius: CARD_RADIUS,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: CARD_INNER_PAD, gap: 10 },
  postHeaderAvatarWrap: { position: 'relative' },
  postHeaderAuthorAvatar: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.background.dark,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  postHeaderAuthorInitial: { fontSize: 9, fontWeight: '700' },
  postHeaderInfo: { flex: 1 },
  postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAuthorName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  teamBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  teamBadgeText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '600' },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  postMetaAuthor: { color: Colors.text.muted, fontSize: 12, flexShrink: 1 },
  postMetaAuthorName: { fontSize: 12, fontWeight: '600' },
  postRoleChip: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  postRoleChipText: { fontSize: 10, fontWeight: '600' },
  postMetaTime: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },
  postContent: { color: Colors.text.primary, fontSize: 15, lineHeight: 22, paddingHorizontal: CARD_INNER_PAD, paddingBottom: 12 },
  postImagesContainer: { marginBottom: 0 },
  postImageSingle: { width: '100%', height: 300 },
  postImagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  postImageGrid: { width: '49.5%', height: 180 },
  postActions: { flexDirection: 'row', alignItems: 'center', padding: CARD_INNER_PAD, gap: 24, borderTopWidth: 1, borderTopColor: Colors.border.light },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: Colors.text.muted, fontSize: 14, fontWeight: '500' },
  actionTextLiked: { color: Colors.status.error },
  burstHeart: { position: 'absolute', top: -10, left: -10, pointerEvents: 'none' },

  // Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, borderRadius: 100 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary.orange, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // End
  endContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 12 },
  endLine: { flex: 1, height: 1, backgroundColor: Colors.border.light },
  endText: { color: Colors.text.muted, fontSize: 13 },

  // Create modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: Colors.background.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  modalTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  modalTeamRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  modalTeamName: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
  modalTeamHint: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  modalInput: {
    color: Colors.text.primary, fontSize: 16, lineHeight: 24,
    paddingHorizontal: 20, paddingTop: 16, minHeight: 100, maxHeight: 200,
  },
  charCount: { color: Colors.text.muted, fontSize: 12, textAlign: 'right', paddingHorizontal: 20, paddingBottom: 8 },
  modalImagesRow: { paddingHorizontal: 20, paddingBottom: 12 },
  modalImageWrap: { position: 'relative', marginRight: 8 },
  modalImage: { width: 80, height: 80, borderRadius: 12 },
  modalImageRemove: {
    position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  modalImageActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border.light },
  modalImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalImageBtnText: { color: Colors.text.secondary, fontSize: 14 },
  imageCount: { color: Colors.text.muted, fontSize: 12, marginLeft: 'auto' },

  // Team banner
  teamBanner: { alignItems: 'center', paddingVertical: 20, marginBottom: 8, position: 'relative' },
  teamBannerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 },
  teamBannerLogo: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  teamBannerLogoPlaceholder: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 12,
    backgroundColor: Colors.primary.orange + '30', alignItems: 'center', justifyContent: 'center',
  },
  teamBannerLogoText: { color: Colors.primary.orange, fontSize: 30, fontWeight: '800' },
  teamBannerName: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' },
  teamBannerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  teamBannerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamBannerMetaText: { color: Colors.text.muted, fontSize: 13 },
  teamBannerMetaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.text.muted },
  cmBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cmBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  cmBadgeCM: { backgroundColor: Colors.primary.blue + '20' },
  cmBadgeCaptain: { backgroundColor: Colors.primary.orange + '20' },
  cmBadgeText: { fontSize: 12, fontWeight: '600' },
  cmBadgeTextCM: { color: Colors.primary.blue },
  cmBadgeTextCaptain: { color: Colors.primary.orange },
  cmBadgeHint: { color: Colors.text.muted, fontSize: 12 },

  // CM permission chips
  cmPermChipsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' as const },
  cmPermChip: { backgroundColor: Colors.primary.blue + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cmPermChipText: { color: Colors.primary.blue, fontSize: 11, fontWeight: '500' },

  // Banner follow button
  bannerFollowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginTop: 12,
  },
  bannerFollowingBtn: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  bannerNotFollowingBtn: { backgroundColor: Colors.primary.orange + '15', borderWidth: 1, borderColor: Colors.primary.orange + '40' },
  bannerFollowBtnText: { fontSize: 13, fontWeight: '600' },
  bannerFollowingBtnText: { color: Colors.text.muted },
  bannerNotFollowingBtnText: { color: Colors.primary.orange },

  // Skeletons
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.elevated },
  skeletonLine: { height: 12, backgroundColor: Colors.background.elevated, borderRadius: 6 },
  skeletonImage: { height: 160, backgroundColor: Colors.background.elevated, borderRadius: 12, marginHorizontal: CARD_INNER_PAD, marginBottom: 12 },
  skeletonAction: { width: 60, height: 20, backgroundColor: Colors.background.elevated, borderRadius: 6 },

  // Modal improvements
  modalTeamHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  modalCMPerms: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' as const },
  modalCMPermChip: { backgroundColor: Colors.primary.blue + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalCMPermChipText: { color: Colors.primary.blue, fontSize: 10, fontWeight: '500' },
  charCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  charCountBar: { flex: 1, height: 4, backgroundColor: Colors.background.elevated, borderRadius: 2, overflow: 'hidden' },
  charCountFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 2 },

  // Comment sheet
  commentOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentContent: {
    backgroundColor: Colors.background.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  commentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  commentTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  commentLoading: { paddingVertical: 40, alignItems: 'center' },
  commentEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  commentEmptyText: { color: Colors.text.muted, fontSize: 14 },
  commentList: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  commentItem: { flexDirection: 'row', gap: 10 },
  commentBody: { flex: 1 },
  commentAuthor: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  commentText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
  commentTime: { color: Colors.text.muted, fontSize: 11, marginTop: 4 },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
  commentInput: {
    flex: 1, color: Colors.text.primary, fontSize: 15,
    backgroundColor: Colors.background.cardLight, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 80,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary.orange,
    alignItems: 'center', justifyContent: 'center',
  },
});
