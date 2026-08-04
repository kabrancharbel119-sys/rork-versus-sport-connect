import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated, Pressable, Modal, TextInput, Alert, Dimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MessageCircle, Trash2, MoreHorizontal, Trophy, Swords, Users, MapPin, Share2, Bookmark, Flag, X, Sparkles } from 'lucide-react-native';
import { Colors, OUTER_PAD } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/Avatar';
import { useFullscreenImage } from '@/components/FullscreenImageViewer';
import { useRouter } from 'expo-router';
import type { Post, PostComment } from '@/types';
import { postsApi } from '@/lib/api/posts';
import { sportLabels } from '@/mocks/data';

interface LikerInfo {
  id: string;
  username: string;
  fullName: string;
  avatar?: string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string, hasLiked: boolean) => void;
  onComment: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onShare?: (post: Post) => void;
  currentUserId?: string;
}

const REPORT_REASONS = [
  'Spam ou contenu trompeur',
  'Harcèlement ou incitation à la haine',
  'Contenu inapproprié',
  'Fausses informations',
  'Autre',
];

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

const AUTO_POST_ICONS: Record<string, React.ReactNode> = {
  match_created: <Swords size={14} color={Colors.primary.orange} />,
  match_won: <Trophy size={14} color="#FFD700" />,
  tournament_won: <Trophy size={14} color="#FFD700" />,
  team_joined: <Users size={14} color={Colors.primary.blue} />,
  team_created: <Users size={14} color={Colors.primary.blue} />,
  venue_created: <MapPin size={14} color={Colors.status.success} />,
  tournament_created: <Trophy size={14} color={Colors.primary.orange} />,
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const POST_TYPE_BADGES: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  match_created: { label: 'Match', color: Colors.primary.orange, icon: Swords },
  match_won: { label: 'Victoire', color: '#FFD700', icon: Trophy },
  tournament_won: { label: 'Champion', color: '#FFD700', icon: Trophy },
  team_joined: { label: 'Nouvelle recrue', color: Colors.primary.blue, icon: Users },
  team_created: { label: 'Nouvelle équipe', color: Colors.primary.blue, icon: Users },
  venue_created: { label: 'Nouveau lieu', color: Colors.status.success, icon: MapPin },
  tournament_created: { label: 'Tournoi', color: Colors.primary.orange, icon: Trophy },
};

export function PostCard({ post, onLike, onComment, onDelete, onShare, currentUserId }: PostCardProps) {
  const router = useRouter();
  const fullscreen = useFullscreenImage();
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likers, setLikers] = useState<LikerInfo[]>([]);
  const [showLikers, setShowLikers] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportCustom, setReportCustom] = useState('');
  const [reporting, setReporting] = useState(false);
  const [previewComments, setPreviewComments] = useState<PostComment[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const isOwnPost = currentUserId === post.authorId;
  const likeScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0.5)).current;
  const lastTap = useRef(0);

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
      if (!post.hasLiked) {
        handleLike();
      }
      triggerBurst();
    }
    lastTap.current = now;
  }, [post.hasLiked, handleLike, triggerBurst]);

  const handleAvatarPress = useCallback(() => {
    router.push(`/user/${post.authorId}` as any);
  }, [router, post.authorId]);

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare(post);
    }
  }, [onShare, post]);

  const toggleSave = useCallback(() => {
    setIsSaved((prev) => !prev);
  }, []);

  const handleReport = useCallback(async () => {
    if (!currentUserId) return;
    const reason = reportReason === 'Autre' ? reportCustom.trim() : reportReason;
    if (!reason) return;
    setReporting(true);
    try {
      await postsApi.reportPost(post.id, currentUserId, reason);
      setShowReportModal(false);
      setShowMenu(false);
      setReportReason('');
      setReportCustom('');
      Alert.alert('Signalement envoyé', 'Merci, nous avons bien reçu votre signalement et allons l\'examiner.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le signalement. Réessayez plus tard.');
    } finally {
      setReporting(false);
    }
  }, [currentUserId, post.id, reportReason, reportCustom]);

  const fetchLikers = useCallback(async () => {
    if (post.likesCount === 0) return;
    try {
      const data = await postsApi.getLikers(post.id, 3);
      setLikers(data);
    } catch {
      // ignore
    }
  }, [post.id, post.likesCount]);

  useEffect(() => {
    if (post.likesCount > 0 && likers.length === 0) {
      fetchLikers();
    }
  }, [post.likesCount, likers.length, fetchLikers]);

  // Inline comments preview (top 2)
  useEffect(() => {
    let cancelled = false;
    if (post.commentsCount > 0) {
      postsApi.getComments(post.id)
        .then((comments) => {
          if (!cancelled) setPreviewComments(comments.filter(c => !c.parentCommentId).slice(-2));
        })
        .catch(() => {});
    } else {
      setPreviewComments([]);
    }
    return () => { cancelled = true; };
  }, [post.id, post.commentsCount]);

  const handleCarouselScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== carouselIndex && index >= 0 && index < (post.images?.length ?? 0)) {
      setCarouselIndex(index);
    }
  }, [carouselIndex, post.images]);

  const renderImages = () => {
    if (!post.images || post.images.length === 0) return null;
    const count = post.images.length;

    if (count === 1) {
      return (
        <Pressable onPress={() => fullscreen.open(post.images[0])} onLongPress={handleDoubleTap} delayLongPress={250}>
          <Image
            source={{ uri: post.images[0] }}
            style={styles.singleImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.heartBurst, { opacity: burstOpacity, transform: [{ scale: burstScale }] }]}
          >
            <Heart size={80} color="#FFF" fill="#EF4444" strokeWidth={0} />
          </Animated.View>
        </Pressable>
      );
    }

    // Carousel for multiple images
    return (
      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleCarouselScroll}
          scrollEventThrottle={16}
        >
          {post.images.map((uri, i) => (
            <Pressable
              key={i}
              onPress={() => fullscreen.open(post.images, i)}
              onLongPress={handleDoubleTap}
              delayLongPress={250}
            >
              <Image
                source={{ uri }}
                style={styles.carouselImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* Counter badge */}
        <View style={styles.carouselCounter}>
          <Text style={styles.carouselCounterText}>{carouselIndex + 1}/{count}</Text>
        </View>

        {/* Dots */}
        <View style={styles.carouselDots}>
          {post.images.map((_, i) => (
            <View
              key={i}
              style={[styles.carouselDot, i === carouselIndex ? styles.carouselDotActive : styles.carouselDotInactive]}
            />
          ))}
        </View>
      </View>
    );
  };

  const handleMentionPress = useCallback((username: string) => {
    router.push(`/user/${username}` as any);
  }, [router]);

  const renderContentWithMentions = useCallback((content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@') && part.length > 1) {
        const username = part.slice(1);
        return (
          <Text key={i} style={styles.mention} onPress={() => handleMentionPress(username)}>
            {part}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });
  }, [handleMentionPress]);

  return (
    <View style={styles.post}>
      {/* Header: avatar + name + time + menu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
          <Avatar uri={post.authorAvatar} name={post.authorFullName} size="medium" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={handleAvatarPress} activeOpacity={0.7}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{post.authorFullName || 'Utilisateur'}</Text>
            {post.authorIsVerified && <Text style={styles.verifiedBadge}>✓</Text>}
            {post.isAutoGenerated && AUTO_POST_ICONS[post.autoType || '']}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            @{post.authorUsername} · {formatTimeAgo(post.createdAt)}
          </Text>
        </TouchableOpacity>
        {!isOwnPost && (
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {showMenu && isOwnPost && (
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              onDelete?.(post.id);
            }}
          >
            <Trash2 size={16} color={Colors.status.error} />
            <Text style={styles.menuItemText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}

      {showMenu && !isOwnPost && (
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              setShowReportModal(true);
            }}
          >
            <Flag size={16} color={Colors.status.warning} />
            <Text style={styles.menuItemTextWarn}>Signaler le post</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Post type badge */}
      {post.isAutoGenerated && post.autoType && POST_TYPE_BADGES[post.autoType] && (() => {
        const badge = POST_TYPE_BADGES[post.autoType];
        const BadgeIcon = badge.icon;
        return (
          <View style={styles.typeBadgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: badge.color + '18', borderColor: badge.color + '40' }]}>
              <BadgeIcon size={12} color={badge.color} />
              <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>
        );
      })()}

      {/* Content text */}
      {post.content ? (
        <Text style={styles.content} numberOfLines={post.images && post.images.length > 0 ? 4 : 0}>
          {renderContentWithMentions(post.content)}
        </Text>
      ) : null}

      {/* Full-width images */}
      {renderImages()}

      {/* Gradient overlay at bottom of images for auto-generated posts */}
      {post.isAutoGenerated && post.images && post.images.length > 0 && (
        <LinearGradient
          colors={['transparent', 'rgba(13,17,29,0.6)']}
          style={styles.imageGradient}
          pointerEvents="none"
        />
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

      {/* Actions bar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.6}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Heart
              size={24}
              color={post.hasLiked ? '#EF4444' : Colors.text.muted}
              fill={post.hasLiked ? '#EF4444' : 'none'}
              strokeWidth={post.hasLiked ? 2.5 : 2}
            />
          </Animated.View>
          <Text style={[styles.actionText, post.hasLiked && styles.actionTextLiked]}>
            {post.likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)} activeOpacity={0.6}>
          <MessageCircle size={24} color={Colors.text.muted} strokeWidth={2} />
          <Text style={styles.actionText}>
            {post.commentsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.6}>
          <Share2 size={22} color={Colors.text.muted} strokeWidth={2} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.actionBtn} onPress={toggleSave} activeOpacity={0.6}>
          <Bookmark
            size={22}
            color={isSaved ? Colors.primary.orange : Colors.text.muted}
            fill={isSaved ? Colors.primary.orange : 'none'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>

      {/* Inline comments preview */}
      {previewComments.length > 0 && (
        <TouchableOpacity style={styles.inlineComments} onPress={() => onComment(post.id)} activeOpacity={0.7}>
          {previewComments.map((c) => (
            <View key={c.id} style={styles.inlineCommentRow}>
              <Avatar uri={c.avatar} name={c.fullName || c.username} size="small" />
              <View style={styles.inlineCommentBubble}>
                <Text style={styles.inlineCommentText} numberOfLines={2}>
                  <Text style={styles.inlineCommentName}>{c.fullName || c.username || 'Utilisateur'}  </Text>
                  {c.content}
                </Text>
              </View>
            </View>
          ))}
          {post.commentsCount > previewComments.length && (
            <Text style={styles.inlineCommentsMore}>
              Voir les {post.commentsCount} commentaires
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Comment count label (when no preview yet) */}
      {post.commentsCount > 0 && previewComments.length === 0 && (
        <TouchableOpacity style={styles.commentLabel} onPress={() => onComment(post.id)} activeOpacity={0.6}>
          <Text style={styles.commentLabelText}>
            {post.commentsCount === 1 ? '1 commentaire' : `${post.commentsCount} commentaires`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Likers indicator */}
      {post.likesCount > 0 && (
        <TouchableOpacity
          style={styles.likersRow}
          onPress={() => setShowLikers(!showLikers)}
          activeOpacity={0.6}
        >
          {likers.length > 0 && (
            <View style={styles.likersAvatars}>
              {likers.slice(0, 3).map((l, i) => (
                <View key={l.id} style={[styles.likerAvatarWrap, { zIndex: 3 - i, marginLeft: i === 0 ? 0 : -8 }]}>
                  <Avatar uri={l.avatar} name={l.fullName} size="small" />
                </View>
              ))}
            </View>
          )}
          <Text style={styles.likersText}>
            {likers.length > 0
              ? `Aimé par ${likers[0].fullName}${post.likesCount > 1 ? ` et ${post.likesCount - 1} autre${post.likesCount > 2 ? 's' : ''}` : ''}`
              : `${post.likesCount} like${post.likesCount > 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      )}
      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={styles.reportOverlay} onPress={() => setShowReportModal(false)}>
          <Pressable style={styles.reportSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Signaler ce post</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <X size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportSubtitle}>Pourquoi signalez-vous ce post ?</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reportOption, reportReason === reason && styles.reportOptionSelected]}
                onPress={() => setReportReason(reason)}
                activeOpacity={0.7}
              >
                <Text style={[styles.reportOptionText, reportReason === reason && styles.reportOptionTextSelected]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            {reportReason === 'Autre' && (
              <TextInput
                style={styles.reportInput}
                placeholder="Expliquez..."
                placeholderTextColor={Colors.text.muted}
                value={reportCustom}
                onChangeText={setReportCustom}
                multiline
                maxLength={300}
              />
            )}
            <TouchableOpacity
              style={[styles.reportSubmit, (!reportReason || (reportReason === 'Autre' && !reportCustom.trim()) || reporting) && styles.reportSubmitDisabled]}
              onPress={handleReport}
              disabled={!reportReason || (reportReason === 'Autre' && !reportCustom.trim()) || reporting}
              activeOpacity={0.7}
            >
              <Text style={styles.reportSubmitText}>{reporting ? 'Envoi...' : 'Envoyer le signalement'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      {fullscreen.viewer}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: OUTER_PAD,
    marginBottom: 14,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedBadge: {
    color: Colors.status.success,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: OUTER_PAD,
    backgroundColor: Colors.background.elevated,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    color: Colors.status.error,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: OUTER_PAD,
    marginBottom: 14,
  },
  mention: {
    color: Colors.primary.orange,
    fontWeight: '600',
  },
  singleImage: {
    width: '100%',
    height: 360,
  },
  // Carousel
  carouselContainer: {
    position: 'relative',
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: 320,
  },
  carouselCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  carouselCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  carouselDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  carouselDot: {
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    width: 16,
    backgroundColor: '#FFF',
  },
  carouselDotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  // Type badge
  typeBadgeRow: {
    flexDirection: 'row',
    paddingHorizontal: OUTER_PAD,
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Inline comments
  inlineComments: {
    paddingHorizontal: OUTER_PAD,
    marginTop: 10,
    gap: 8,
  },
  inlineCommentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  inlineCommentBubble: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineCommentText: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  inlineCommentName: {
    color: Colors.text.primary,
    fontWeight: '700',
  },
  inlineCommentsMore: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlayText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: OUTER_PAD,
    paddingTop: 12,
  },
  tag: {
    backgroundColor: Colors.primary.orange + '15',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: OUTER_PAD,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextLiked: {
    color: '#EF4444',
  },
  commentLabel: {
    paddingHorizontal: OUTER_PAD,
    paddingTop: 6,
  },
  commentLabelText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  likersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: OUTER_PAD,
    paddingTop: 10,
  },
  likersAvatars: {
    flexDirection: 'row',
  },
  likerAvatarWrap: {
    borderWidth: 2,
    borderColor: Colors.background.dark,
    borderRadius: 12,
  },
  likersText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  heartBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  menuItemTextWarn: {
    color: Colors.status.warning || '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reportSheet: {
    width: '100%',
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  reportSubtitle: {
    color: Colors.text.muted,
    fontSize: 14,
    marginBottom: 12,
  },
  reportOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 8,
  },
  reportOptionSelected: {
    borderColor: Colors.primary.orange,
    backgroundColor: Colors.primary.orange + '15',
  },
  reportOptionText: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  reportOptionTextSelected: {
    color: Colors.primary.orange,
    fontWeight: '700',
  },
  reportInput: {
    color: Colors.text.primary,
    fontSize: 14,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    maxHeight: 80,
  },
  reportSubmit: {
    backgroundColor: Colors.primary.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  reportSubmitDisabled: {
    opacity: 0.4,
  },
  reportSubmitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
