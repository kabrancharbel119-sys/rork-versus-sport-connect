import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Share } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Trophy, Swords, Users, MapPin } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { Colors, OUTER_PAD } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/contexts/PostsContext';
import { postsApi } from '@/lib/api/posts';
import { Avatar } from '@/components/Avatar';
import { CommentSheet } from '@/components/CommentSheet';
import { useFullscreenImage } from '@/components/FullscreenImageViewer';
import { sportLabels } from '@/mocks/data';
import type { Post } from '@/types';

const AUTO_POST_ICONS: Record<string, React.ReactNode> = {
  match_created: <Swords size={14} color={Colors.primary.orange} />,
  match_won: <Trophy size={14} color="#FFD700" />,
  tournament_won: <Trophy size={14} color="#FFD700" />,
  team_joined: <Users size={14} color={Colors.primary.blue} />,
  team_created: <Users size={14} color={Colors.primary.blue} />,
  venue_created: <MapPin size={14} color={Colors.status.success} />,
  tournament_created: <Trophy size={14} color={Colors.primary.orange} />,
};

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

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toggleLike, addComment } = usePosts();
  const fullscreen = useFullscreenImage();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      const data = await postsApi.getPostById(id, user?.id);
      setPost(data);
    } catch (e) {
      console.error('[PostDetail] Failed to fetch post:', e);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPost();
    setRefreshing(false);
  };

  const handleAvatarPress = useCallback(() => {
    if (post) router.push(`/user/${post.authorId}` as any);
  }, [router, post]);

  const handleLike = useCallback(() => {
    if (!post) return;
    setPost((prev) => prev ? {
      ...prev,
      hasLiked: !prev.hasLiked,
      likesCount: prev.hasLiked ? prev.likesCount - 1 : prev.likesCount + 1,
    } : prev);
    toggleLike(post.id, !!post.hasLiked);
  }, [post, toggleLike]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    try {
      await Share.share({
        message: post.content
          ? `${post.authorFullName || 'Utilisateur'}: ${post.content}`
          : `${post.authorFullName || 'Utilisateur'} a publié une photo`,
      });
    } catch {}
  }, [post]);

  const handleMentionPress = useCallback((username: string) => {
    router.push(`/user/${username}` as any);
  }, [router]);

  const renderContentWithMentions = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@') && part.length > 1) {
        const username = part.slice(1);
        return (
          <Text
            key={i}
            style={styles.mention}
            onPress={() => handleMentionPress(username)}
          >
            {part}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
          <ActivityIndicator size="large" color={Colors.primary.orange} />
        </View>
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
          <Text style={styles.errorText}>Post introuvable</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {/* Author header */}
            <View style={styles.authorRow}>
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
                <Avatar uri={post.authorAvatar} name={post.authorFullName} size="medium" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.authorInfo} onPress={handleAvatarPress} activeOpacity={0.7}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{post.authorFullName || 'Utilisateur'}</Text>
                  {post.authorIsVerified && <Text style={styles.verifiedBadge}>✓</Text>}
                  {post.isAutoGenerated && AUTO_POST_ICONS[post.autoType || '']}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  @{post.authorUsername} · {formatTimeAgo(post.createdAt)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            {post.content ? (
              <Text style={styles.content}>
                {renderContentWithMentions(post.content)}
              </Text>
            ) : null}

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <View style={styles.imagesContainer}>
                {post.images.map((uri, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => fullscreen.open(post.images, i)}>
                    <ExpoImage
                      source={{ uri }}
                      style={styles.image}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Tags */}
            {(post.sportTag || post.teamTag || post.matchTag || post.tournamentTag) && (
              <View style={styles.tagsRow}>
                {post.sportTag && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{sportLabels[post.sportTag as keyof typeof sportLabels] || post.sportTag}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {post.likesCount} like{post.likesCount > 1 ? 's' : ''}
              </Text>
              <Text style={styles.statText}>
                {post.commentsCount} commentaire{post.commentsCount > 1 ? 's' : ''}
              </Text>
            </View>

            {/* Actions bar */}
            <View style={styles.actionsBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.6}>
                <Heart
                  size={26}
                  color={post.hasLiked ? '#EF4444' : Colors.text.muted}
                  fill={post.hasLiked ? '#EF4444' : 'none'}
                  strokeWidth={post.hasLiked ? 2.5 : 2}
                />
                <Text style={[styles.actionText, post.hasLiked && styles.actionTextLiked]}>J'aime</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)} activeOpacity={0.6}>
                <MessageCircle size={26} color={Colors.text.muted} strokeWidth={2} />
                <Text style={styles.actionText}>Commenter</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.6}>
                <Share2 size={24} color={Colors.text.muted} strokeWidth={2} />
                <Text style={styles.actionText}>Partager</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity style={styles.actionBtn} onPress={() => setIsSaved(!isSaved)} activeOpacity={0.6}>
                <Bookmark
                  size={24}
                  color={isSaved ? Colors.primary.orange : Colors.text.muted}
                  fill={isSaved ? Colors.primary.orange : 'none'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>

      <CommentSheet
        visible={showComments}
        postId={post.id}
        onClose={() => setShowComments(false)}
        onCommentAdded={() => {
          setPost((prev) => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev);
          fetchPost();
        }}
      />
      {fullscreen.viewer}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingBottom: 40 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 8 },
  authorInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  verifiedBadge: { color: Colors.primary.blue, fontSize: 14, fontWeight: '700' },
  meta: { color: Colors.text.muted, fontSize: 13 },
  content: { color: Colors.text.primary, fontSize: 16, lineHeight: 24, marginBottom: 16 },
  mention: { color: Colors.primary.orange, fontWeight: '600' },
  imagesContainer: { gap: 8, marginBottom: 16 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,107,0,0.12)' },
  tagText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.light, marginBottom: 12 },
  statText: { color: Colors.text.muted, fontSize: 14 },
  actionsBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: Colors.text.muted, fontSize: 14, fontWeight: '500' },
  actionTextLiked: { color: '#EF4444' },
  errorText: { color: Colors.text.primary, fontSize: 18, fontWeight: '600', marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background.card },
  backBtnText: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
});
