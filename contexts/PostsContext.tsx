import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { postsApi } from '@/lib/api/posts';
import { useAuth } from '@/contexts/AuthContext';
import type { Post, PostComment, AutoPostType } from '@/types';

const FEED_PAGE_SIZE = 20;

export const [PostsProvider, usePosts] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || '';
  const pageRef = useRef(1);

  const feedQuery = useQuery({
    queryKey: ['posts-feed', userId],
    queryFn: async () => {
      if (!userId) return { posts: [] as Post[], hasMore: false };
      const result = await postsApi.getFeed(userId, 1, FEED_PAGE_SIZE);
      pageRef.current = 1;
      return result;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const loadMore = useCallback(async () => {
    if (!userId || !feedQuery.data?.hasMore) return;
    const nextPage = pageRef.current + 1;
    const result = await postsApi.getFeed(userId, nextPage, FEED_PAGE_SIZE);
    pageRef.current = nextPage;

    queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
      ['posts-feed', userId],
      (prev) => ({
        posts: [...(prev?.posts || []), ...result.posts],
        hasMore: result.hasMore,
      })
    );
  }, [userId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetchFeed = useCallback(async () => {
    await feedQuery.refetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createPostMutation = useMutation({
    mutationFn: (params: {
      content: string;
      images?: string[];
      sportTag?: string;
      teamTag?: string;
      matchTag?: string;
      tournamentTag?: string;
    }) => postsApi.createPost({ authorId: userId, ...params }),
    onSuccess: (newPost) => {
      queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
        ['posts-feed', userId],
        (prev) => ({
          posts: [newPost, ...(prev?.posts || [])],
          hasMore: prev?.hasMore ?? false,
        })
      );
      if (newPost.content && newPost.content.includes('@')) {
        postsApi.sendMentionNotifications(
          newPost.content,
          userId,
          newPost.id,
          newPost.authorFullName || 'Un utilisateur'
        ).catch(() => {});
      }
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => postsApi.deletePost(postId, userId),
    onSuccess: (_data, postId) => {
      queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
        ['posts-feed', userId],
        (prev) => ({
          posts: (prev?.posts || []).filter((p) => p.id !== postId),
          hasMore: prev?.hasMore ?? false,
        })
      );
    },
  });

  const toggleLike = useCallback(async (postId: string, hasLiked: boolean) => {
    queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
      ['posts-feed', userId],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  hasLiked: !hasLiked,
                  likesCount: hasLiked ? p.likesCount - 1 : p.likesCount + 1,
                }
              : p
          ),
        };
      }
    );

    try {
      if (hasLiked) {
        await postsApi.unlikePost(userId, postId);
      } else {
        await postsApi.likePost(userId, postId);
        const post = queryClient.getQueryData<{ posts: Post[]; hasMore: boolean }>(['posts-feed', userId])?.posts.find((p) => p.id === postId);
        if (post && post.authorId !== userId) {
          const { notificationsApi } = await import('@/lib/api/notifications');
          notificationsApi.send(post.authorId, {
            type: 'social',
            title: 'Nouveau like',
            message: `${user?.fullName || "Quelqu'un"} a aimé votre post`,
            data: { postId, type: 'like', route: `/post/${postId}` },
          }).catch(() => {});
        }
      }
    } catch {
      queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
        ['posts-feed', userId],
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    hasLiked,
                    likesCount: hasLiked ? p.likesCount + 1 : p.likesCount - 1,
                  }
                : p
            ),
          };
        }
      );
    }
  }, [userId, queryClient, user]);

  const getComments = useCallback(async (postId: string): Promise<PostComment[]> => {
    return postsApi.getComments(postId);
  }, []);

  const addComment = useCallback(async (postId: string, content: string): Promise<PostComment> => {
    const comment = await postsApi.addComment(postId, userId, content);

    queryClient.setQueryData<{ posts: Post[]; hasMore: boolean }>(
      ['posts-feed', userId],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
          ),
        };
      }
    );

    const post = queryClient.getQueryData<{ posts: Post[]; hasMore: boolean }>(['posts-feed', userId])?.posts.find((p) => p.id === postId);
    if (post && post.authorId !== userId) {
      const { notificationsApi } = await import('@/lib/api/notifications');
      notificationsApi.send(post.authorId, {
        type: 'social',
        title: 'Nouveau commentaire',
        message: `${user?.fullName || "Quelqu'un"} a commenté votre post`,
        data: { postId, type: 'comment', route: `/post/${postId}` },
      }).catch(() => {});
    }

    return comment;
  }, [userId, queryClient, user]);

  const createAutoPost = useCallback(async (params: {
    content: string;
    autoType: AutoPostType;
    sportTag?: string;
    teamTag?: string;
    matchTag?: string;
    tournamentTag?: string;
  }): Promise<void> => {
    await postsApi.createAutoPost({ authorId: userId, ...params });
    queryClient.invalidateQueries({ queryKey: ['posts-feed', userId] });
  }, [userId, queryClient]);

  const getUserPosts = useCallback(async (targetUserId: string): Promise<Post[]> => {
    const result = await postsApi.getPostsByUser(targetUserId);
    return result.posts;
  }, []);

  return {
    feed: feedQuery.data?.posts || [],
    hasMore: feedQuery.data?.hasMore ?? false,
    isLoading: feedQuery.isLoading,
    isFetching: feedQuery.isFetching,
    refetchFeed,
    loadMore,
    createPost: createPostMutation.mutateAsync,
    isCreatingPost: createPostMutation.isPending,
    deletePost: deletePostMutation.mutateAsync,
    toggleLike,
    getComments,
    addComment,
    createAutoPost,
    getUserPosts,
  };
});
