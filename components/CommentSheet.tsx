import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { X, Send, MessageCircle, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, OUTER_PAD } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/contexts/PostsContext';
import { postsApi } from '@/lib/api/posts';
import type { PostComment } from '@/types';

interface CommentSheetProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onCommentAdded?: (postId: string) => void;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function CommentSheet({ visible, postId, onClose, onCommentAdded }: CommentSheetProps) {
  const { user } = useAuth();
  const { addComment } = usePosts();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const data = await postsApi.getComments(postId);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible && postId) {
      loadComments();
      Animated.timing(slideAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, postId, loadComments, slideAnim]);

  const toggleCommentLike = useCallback((commentId: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !postId || !user?.id) return;
    setSending(true);
    try {
      const comment = await addComment(postId, input.trim());
      setComments((prev) => [...prev, comment]);
      setInput('');
      onCommentAdded?.(postId);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [input, postId, user?.id, onCommentAdded, addComment]);

  const renderComment = useCallback(({ item }: { item: PostComment }) => {
    const isLiked = likedComments.has(item.id);
    return (
      <View style={styles.commentItem}>
        <Avatar uri={item.avatar} name={item.fullName} size="small" />
        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <Text style={styles.commentName} numberOfLines={1}>{item.fullName || 'Utilisateur'}</Text>
            <Text style={styles.commentText}>{item.content}</Text>
          </View>
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
            <TouchableOpacity onPress={() => toggleCommentLike(item.id)} activeOpacity={0.6}>
              <Text style={[styles.commentAction, isLiked && styles.commentActionLiked]}>
                J'aime
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => toggleCommentLike(item.id)} activeOpacity={0.6} style={styles.likeIconBtn}>
          <Heart
            size={16}
            color={isLiked ? '#EF4444' : Colors.text.muted}
            fill={isLiked ? '#EF4444' : 'none'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
    );
  }, [likedComments, toggleCommentLike]);

  const handleSendAndScroll = useCallback(async () => {
    await handleSend();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [handleSend]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={[Colors.background.dark, Colors.background.card]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Commentaires</Text>
              {comments.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{comments.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <ActivityIndicator size="small" color={Colors.primary.orange} />
                </View>
                <Text style={styles.emptyText}>Chargement...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MessageCircle size={28} color={Colors.text.muted} strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyTitle}>Aucun commentaire</Text>
                <Text style={styles.emptySubtext}>Soyez le premier à réagir !</Text>
              </View>
            )
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <Avatar uri={user?.avatar} name={user?.fullName} size="small" />
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Écrivez un commentaire..."
              placeholderTextColor={Colors.text.muted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={300}
            />
            {input.trim().length > 0 && (
              <Text style={styles.charHint}>{input.length}/300</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSendAndScroll}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Send size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: OUTER_PAD,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  listContent: {
    padding: OUTER_PAD,
    paddingBottom: 20,
  },
  // Comment item
  commentItem: {
    flexDirection: 'row',
    gap: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  commentText: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
    marginLeft: 4,
  },
  commentTime: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  commentAction: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  commentActionLiked: {
    color: '#EF4444',
  },
  likeIconBtn: {
    paddingTop: 4,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
  },
  emptySubtext: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: OUTER_PAD,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.light,
    backgroundColor: Colors.background.card,
  },
  inputWrap: {
    flex: 1,
    position: 'relative',
  },
  input: {
    color: Colors.text.primary,
    fontSize: 15,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 50,
    maxHeight: 80,
  },
  charHint: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
});
