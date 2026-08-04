import React, { useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Animated, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Newspaper, Users, Megaphone, Flame, Clock, TrendingUp, Sparkles } from 'lucide-react-native';
import { Colors, OUTER_PAD, CARD_GAP, CARD_RADIUS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/contexts/PostsContext';
import { PostCard } from '@/components/PostCard';
import { CreatePostModal } from '@/components/CreatePostModal';
import { CommentSheet } from '@/components/CommentSheet';
import type { Post } from '@/types';

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    feed,
    isLoading,
    isFetching,
    refetchFeed,
    loadMore,
    hasMore,
    createPost,
    isCreatingPost,
    deletePost,
    toggleLike,
  } = usePosts();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'foryou' | 'recent' | 'popular'>('foryou');
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 120],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  useFocusEffect(
    useCallback(() => {
      refetchFeed();
    }, [refetchFeed])
  );

  const handleRefresh = useCallback(async () => {
    await refetchFeed();
  }, [refetchFeed]);

  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

  const handleLike = useCallback((postId: string, hasLiked: boolean) => {
    toggleLike(postId, hasLiked);
  }, [toggleLike]);

  const handleComment = useCallback((postId: string) => {
    setCommentPostId(postId);
  }, []);

  const handleDelete = useCallback(async (postId: string) => {
    try {
      await deletePost(postId);
    } catch {
      // ignore
    }
  }, [deletePost]);

  const handleCreatePost = useCallback(async (params: {
    content: string;
    images?: string[];
    sportTag?: string;
  }) => {
    await createPost(params);
  }, [createPost]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: post.content
          ? `${post.authorFullName || 'Utilisateur'}: ${post.content}`
          : `${post.authorFullName || 'Utilisateur'} a publié une photo`,
      });
    } catch {
      // ignore
    }
  }, []);

  // Client-side filtering / sorting
  const filteredFeed = useMemo(() => {
    const posts = [...feed];
    if (activeFilter === 'recent') {
      posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (activeFilter === 'popular') {
      posts.sort((a, b) => (b.likesCount + b.commentsCount * 2) - (a.likesCount + a.commentsCount * 2));
    }
    // 'foryou' = default order from API (already curated)
    return posts;
  }, [feed, activeFilter]);

  const renderPost = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onDelete={handleDelete}
      onShare={handleShare}
      currentUserId={user?.id}
    />
  ), [handleLike, handleComment, handleDelete, handleShare, user?.id]);

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const itemSeparator = useCallback(() => <View style={{ height: 4 }} />, []);

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonAvatar} />
            <View style={{ gap: 6, flex: 1 }}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          </View>
          <View style={{ paddingHorizontal: OUTER_PAD, gap: 8, marginBottom: 12 }}>
            <View style={[styles.skeletonLine, { width: '95%' }]} />
            <View style={[styles.skeletonLine, { width: '70%' }]} />
          </View>
          <View style={styles.skeletonImage} />
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return renderSkeleton();
    }

    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[Colors.primary.orange + '20', 'transparent']}
          style={styles.emptyGlow}
        />
        <View style={styles.emptyIconWrap}>
          <Newspaper size={36} color={Colors.primary.orange} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Aucune publication</Text>
        <Text style={styles.emptySubtitle}>
          Suivez des joueurs pour voir leurs publications ici, ou créez votre premier post !
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/search')}
          activeOpacity={0.8}
        >
          <Users size={18} color="#FFF" />
          <Text style={styles.emptyBtnText}>Découvrir des joueurs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.emptyBtn, styles.emptyBtnSecondary]}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Plus size={18} color={Colors.primary.orange} />
          <Text style={styles.emptyBtnSecondaryText}>Créer un post</Text>
        </TouchableOpacity>
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { backgroundColor: `rgba(13,17,29,${headerOpacity})` }]}>
          <Text style={styles.headerTitle}>Feed</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.teamFeedBtn}
              onPress={() => router.push('/team-feeds' as any)}
              activeOpacity={0.7}
            >
              <Megaphone size={20} color={Colors.primary.orange} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.7}
            >
              <Plus size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Filter tabs */}
        <View style={styles.filterTabs}>
          {([
            { key: 'foryou', label: 'Pour toi', icon: Sparkles },
            { key: 'recent', label: 'Récent', icon: Clock },
            { key: 'popular', label: 'Populaire', icon: Flame },
          ] as const).map(({ key, label, icon: Icon }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterTab, activeFilter === key && styles.filterTabActive]}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.7}
            >
              <Icon size={14} color={activeFilter === key ? Colors.primary.orange : Colors.text.muted} />
              <Text style={[styles.filterTabText, activeFilter === key && styles.filterTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredFeed}
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
              refreshing={isFetching && !isLoading}
              onRefresh={handleRefresh}
              tintColor={Colors.primary.orange}
              colors={[Colors.primary.orange]}
              progressBackgroundColor={Colors.background.card}
              title="Actualisation..."
              titleColor={Colors.text.muted}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={Colors.primary.orange} />
                <Text style={styles.footerText}>Chargement...</Text>
              </View>
            ) : filteredFeed.length > 0 ? (
              <View style={styles.endContainer}>
                <View style={styles.endLine} />
                <Text style={styles.endText}>Vous êtes à jour</Text>
                <View style={styles.endLine} />
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPost={handleCreatePost}
      />

      <CommentSheet
        visible={!!commentPostId}
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
      />
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
    paddingHorizontal: OUTER_PAD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamFeedBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: OUTER_PAD,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
  },
  filterTabActive: {
    backgroundColor: Colors.primary.orange + '18',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
  },
  filterTabText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: Colors.primary.orange,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderRadius: 100,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary.orange + '15',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
  },
  emptyBtnSecondaryText: {
    color: Colors.primary.orange,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    marginTop: 12,
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  endContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  endLine: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border.medium,
  },
  endText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  // Skeleton
  skeletonCard: {
    paddingVertical: 20,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: OUTER_PAD,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.elevated,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: Colors.background.elevated,
    borderRadius: 6,
  },
  skeletonImage: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.background.elevated,
    marginTop: 4,
  },
});
