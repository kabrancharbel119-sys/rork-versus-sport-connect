import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { X, ImagePlus, Send, Trash2, Camera, BarChart3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, CARD_RADIUS, CARD_INNER_PAD, OUTER_PAD } from '@/constants/colors';
import { uploadPostImage } from '@/lib/uploadImage';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/Avatar';
import { sportLabels } from '@/mocks/data';
import { postsApi } from '@/lib/api/posts';
import type { Sport } from '@/types';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPost: (params: {
    content: string;
    images?: string[];
    sportTag?: string;
  }) => Promise<void>;
}

const MAX_IMAGES = 4;
const MAX_CONTENT_LENGTH = 500;

const SPORT_OPTIONS: Sport[] = ['football', 'basketball', 'volleyball', 'tennis', 'handball', 'rugby'];

export function CreatePostModal({ visible, onClose, onPost }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);
  const [isPosting, setIsPosting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; fullName: string; avatar?: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent('');
      setImages([]);
      setSelectedSport(undefined);
      setUploadProgress(0);
      setMentionQuery('');
      setMentionResults([]);
      setShowMentions(false);
    }
  }, [visible]);

  const handleContentChange = useCallback((text: string) => {
    setContent(text.slice(0, MAX_CONTENT_LENGTH));

    const cursorPos = text.length;
    const lastAt = text.lastIndexOf('@', cursorPos);
    if (lastAt !== -1) {
      const afterAt = text.slice(lastAt + 1);
      if (afterAt.length >= 0 && !afterAt.includes(' ') && afterAt.length <= 20) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        if (afterAt.length >= 1) {
          postsApi.searchUsersByUsername(afterAt).then(setMentionResults).catch(() => setMentionResults([]));
        } else {
          setMentionResults([]);
        }
        return;
      }
    }
    setShowMentions(false);
  }, []);

  const handleSelectMention = useCallback((username: string) => {
    setContent((prev) => {
      const lastAt = prev.lastIndexOf('@');
      if (lastAt !== -1) {
        return prev.slice(0, lastAt + 1) + username + ' ';
      }
      return prev;
    });
    setShowMentions(false);
    setMentionResults([]);
    setMentionQuery('');
  }, []);

  const handlePickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum', `Vous ne pouvez ajouter que ${MAX_IMAGES} photos par post.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const newUris = result.assets.map((a) => a.uri);
    setImages((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
  }, [images.length]);

  const handleTakePhoto = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Maximum', `Vous ne pouvez ajouter que ${MAX_IMAGES} photos par post.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Autorisez l\'accès à la caméra pour prendre des photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
  }, [images.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePost = useCallback(async () => {
    if (!content.trim() && images.length === 0) {
      Alert.alert('Post vide', 'Ajoutez du texte ou une photo.');
      return;
    }

    setIsPosting(true);
    try {
      let uploadedImageUrls: string[] = [];
      if (images.length > 0 && user?.id) {
        setIsUploading(true);
        uploadedImageUrls = await Promise.all(
          images.map((uri, index) => {
            setUploadProgress(((index + 1) / images.length) * 100);
            return uploadPostImage(uri, user.id, index);
          })
        );
        setIsUploading(false);
        setUploadProgress(0);
      }

      await onPost({
        content: content.trim(),
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        sportTag: selectedSport,
      });

      setContent('');
      setImages([]);
      setSelectedSport(undefined);
      setUploadProgress(0);
      onClose();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de publier le post. Réessayez.');
    } finally {
      setIsPosting(false);
      setIsUploading(false);
    }
  }, [content, images, selectedSport, user?.id, onPost, onClose]);

  const canPost = (content.trim().length > 0 || images.length > 0) && !isPosting;
  const remaining = MAX_CONTENT_LENGTH - content.length;

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
            <Text style={styles.headerTitle}>Nouveau post</Text>
            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!canPost}
              activeOpacity={0.7}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Send size={15} color="#FFF" />
                  <Text style={styles.postBtnText}>Publier</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* User row */}
          <View style={styles.userRow}>
            <Avatar uri={user?.avatar} name={user?.fullName} size="medium" />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.fullName}</Text>
              <Text style={styles.userSubtitle}>@{user?.username}</Text>
            </View>
            {selectedSport && (
              <View style={styles.selectedSportBadge}>
                <Text style={styles.selectedSportText}>{sportLabels[selectedSport as Sport] || selectedSport}</Text>
              </View>
            )}
          </View>

          {/* Text input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Partagez votre actualité sportive..."
              placeholderTextColor={Colors.text.muted}
              value={content}
              onChangeText={handleContentChange}
              multiline
              autoFocus
              maxLength={MAX_CONTENT_LENGTH}
            />
            <Text style={[styles.charCount, remaining < 50 && styles.charCountWarn, remaining < 20 && styles.charCountDanger]}>
              {remaining < 50 ? `${remaining} caractères restants` : `${content.length}/${MAX_CONTENT_LENGTH}`}
            </Text>
          </View>

          {/* Mention suggestions */}
          {showMentions && (
            <View style={styles.mentionDropdown}>
              {mentionResults.length > 0 ? (
                mentionResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.mentionItem}
                    onPress={() => handleSelectMention(u.username)}
                    activeOpacity={0.7}
                  >
                    <Avatar uri={u.avatar} name={u.fullName} size="small" />
                    <View>
                      <Text style={styles.mentionName}>{u.fullName}</Text>
                      <Text style={styles.mentionUsername}>@{u.username}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : mentionQuery.length > 0 ? (
                <Text style={styles.mentionEmpty}>Aucun utilisateur trouvé</Text>
              ) : (
                <Text style={styles.mentionHint}>Tapez un nom d'utilisateur...</Text>
              )}
            </View>
          )}

          {/* Image previews */}
          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <ExpoImage source={{ uri }} style={styles.imagePreview} contentFit="cover" transition={150} />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => handleRemoveImage(index)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color="#FFF" />
                    </TouchableOpacity>
                    {images.length > 1 && (
                      <View style={styles.imageIndexBadge}>
                        <Text style={styles.imageIndexText}>{index + 1}</Text>
                      </View>
                    )}
                  </View>
                ))}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity style={styles.addMoreImage} onPress={handlePickImages} activeOpacity={0.7}>
                    <ImagePlus size={24} color={Colors.text.muted} />
                    <Text style={styles.addMoreText}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Sport selection */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={16} color={Colors.text.secondary} />
              <Text style={styles.sectionLabel}>Catégorie sportive</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportScroll}>
              <TouchableOpacity
                style={[styles.sportChip, !selectedSport && styles.sportChipActive]}
                onPress={() => setSelectedSport(undefined)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sportChipText, !selectedSport && styles.sportChipTextActive]}>Aucun</Text>
              </TouchableOpacity>
              {SPORT_OPTIONS.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportChip, selectedSport === sport && styles.sportChipActive]}
                  onPress={() => setSelectedSport(sport)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sportChipText, selectedSport === sport && styles.sportChipTextActive]}>
                    {sportLabels[sport]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Media actions */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ImagePlus size={16} color={Colors.text.secondary} />
              <Text style={styles.sectionLabel}>Médias</Text>
              {images.length > 0 && (
                <Text style={styles.mediaCounter}>{images.length}/{MAX_IMAGES}</Text>
              )}
            </View>
            <View style={styles.mediaActions}>
              <TouchableOpacity style={styles.mediaBtn} onPress={handlePickImages} disabled={images.length >= MAX_IMAGES} activeOpacity={0.7}>
                <View style={styles.mediaIconWrap}>
                  <ImagePlus size={22} color={Colors.primary.orange} />
                </View>
                <Text style={styles.mediaBtnText}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={handleTakePhoto} disabled={images.length >= MAX_IMAGES} activeOpacity={0.7}>
                <View style={styles.mediaIconWrap}>
                  <Camera size={22} color={Colors.primary.blue} />
                </View>
                <Text style={styles.mediaBtnText}>Caméra</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Upload progress bar */}
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadBarWrap}>
              <View style={styles.uploadBarTrack}>
                <Animated.View style={[styles.uploadBarFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.uploadingText}>Upload {Math.round(uploadProgress)}%</Text>
            </View>
          </View>
        )}
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
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: Colors.primary.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  postBtnDisabled: {
    opacity: 0.3,
  },
  postBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: OUTER_PAD,
    paddingBottom: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  userName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  userSubtitle: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  selectedSportBadge: {
    backgroundColor: Colors.primary.orange + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  selectedSportText: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrap: {
    marginBottom: 16,
  },
  textInput: {
    color: Colors.text.primary,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  charCountWarn: {
    color: Colors.status.warning || '#F59E0B',
    fontWeight: '600',
  },
  charCountDanger: {
    color: Colors.status.error,
    fontWeight: '700',
  },
  imagePreviewContainer: {
    marginBottom: 16,
  },
  imagePreviewScroll: {
    flexDirection: 'row',
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  imagePreview: {
    width: 110,
    height: 110,
    borderRadius: 14,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageIndexBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageIndexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addMoreImage: {
    width: 110,
    height: 110,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addMoreText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  mediaCounter: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  sportScroll: {
    flexDirection: 'row',
  },
  sportChip: {
    backgroundColor: Colors.background.cardLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  sportChipActive: {
    backgroundColor: Colors.primary.orange + '20',
    borderColor: Colors.primary.orange + '60',
  },
  sportChipText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sportChipTextActive: {
    color: Colors.primary.orange,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background.cardLight,
  },
  mediaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBtnText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 17, 29, 0.95)',
    paddingVertical: 20,
    paddingHorizontal: OUTER_PAD,
    alignItems: 'center',
  },
  uploadBarWrap: {
    width: '100%',
    gap: 8,
  },
  uploadBarTrack: {
    height: 4,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  uploadBarFill: {
    height: '100%',
    backgroundColor: Colors.primary.orange,
    borderRadius: 2,
  },
  uploadingText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  mentionDropdown: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 12,
    maxHeight: 200,
    overflow: 'hidden',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  mentionName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  mentionUsername: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  mentionEmpty: {
    color: Colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  mentionHint: {
    color: Colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
});
