import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, X, Trash2, Camera, Edit3 } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { teamsApi } from '@/lib/api/teams';
import { uploadTeamPhoto } from '@/lib/uploadImage';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import type { TeamPhoto } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 6;
const PHOTO_SIZE = (SCREEN_WIDTH - 40 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const pickImageFromLibrary = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
};

export default function TeamGalleryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { users } = useUsers();

  const [photos, setPhotos] = useState<TeamPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [teamLogo, setTeamLogo] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<TeamPhoto | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      teamsApi.getById(id).then(team => {
        setTeamName(team.name);
        setTeamLogo(team.logo || '');
        const member = team.members.some(m => m.userId === user?.id);
        setIsMember(member);
        setIsCaptain(team.captainId === user?.id);
      }).catch(() => {});
      teamsApi.getTeamPhotos(id).then(p => setPhotos(p)).catch(() => {}).finally(() => setLoading(false));
    }, [id, user?.id])
  );

  const resolveUser = (userId: string) => users.find(u => u.id === userId);

  const handleOpenAdd = async () => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setPendingUri(uri);
    setCaption('');
    setShowAddModal(true);
  };

  const handleConfirmAdd = async () => {
    if (!id || !user || !pendingUri) return;
    try {
      setUploading(true);
      const imageUrl = await uploadTeamPhoto(pendingUri, id, user.id);
      await teamsApi.addTeamPhoto(id, user.id, imageUrl, caption.trim() || undefined);
      const fresh = await teamsApi.getTeamPhotos(id);
      setPhotos(fresh);
      setShowAddModal(false);
      setPendingUri(null);
      setCaption('');
    } catch {
      Alert.alert('Erreur', "Impossible d'ajouter la photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (photo: TeamPhoto) => {
    Alert.alert('Supprimer la photo', 'Supprimer cette photo de la galerie ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await teamsApi.deleteTeamPhoto(photo.id);
          setPhotos(prev => prev.filter(p => p.id !== photo.id));
          setViewerPhoto(null);
        } catch {
          Alert.alert('Erreur', 'Impossible de supprimer la photo');
        }
      }},
    ]);
  };

  const renderPhoto = ({ item: photo }: { item: TeamPhoto }) => {
    const uploader = resolveUser(photo.userId);
    const canDelete = photo.userId === user?.id || isCaptain;
    return (
      <TouchableOpacity
        style={styles.photoItem}
        onPress={() => setViewerPhoto(photo)}
        activeOpacity={0.9}
      >
        <ExpoImage
          source={{ uri: photo.imageUrl }}
          style={styles.photoImage}
          contentFit="cover"
          transition={150}
        />
        {canDelete && (
          <View style={styles.deleteBadge}>
            <Trash2 size={12} color="#FFFFFF" />
          </View>
        )}
        {photo.caption && (
          <View style={styles.captionOverlay}>
            <Text style={styles.captionText} numberOfLines={1}>{photo.caption}</Text>
          </View>
        )}
        <View style={styles.uploaderOverlay}>
          <Text style={styles.uploaderText} numberOfLines={1}>
            {uploader?.fullName || uploader?.username || 'Membre'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {teamLogo ? <Avatar uri={teamLogo} name={teamName} size="small" /> : null}
            <Text style={styles.headerTitle} numberOfLines={1}>Galerie — {teamName}</Text>
          </View>
          {isMember && (
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} disabled={uploading}>
              {uploading ? <ActivityIndicator size={18} color="#FFFFFF" /> : <Plus size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={Colors.primary.orange} />
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Camera size={48} color={Colors.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune photo</Text>
            <Text style={styles.emptyText}>
              {isMember
                ? 'Ajoutez des photos des activités de l\'équipe !'
                : 'Cette équipe n\'a pas encore partagé de photos.'}
            </Text>
            {isMember && (
              <Button
                title="Ajouter une photo"
                onPress={handleOpenAdd}
                variant="primary"
                icon={<Plus size={18} color="#FFFFFF" />}
                style={styles.emptyBtn}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={item => item.id}
            renderItem={renderPhoto}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            columnWrapperStyle={{ gap: GAP }}
          />
        )}

        {/* Add photo modal */}
        <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => !uploading && setShowAddModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter une photo</Text>
                <TouchableOpacity onPress={() => !uploading && setShowAddModal(false)} disabled={uploading}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                {pendingUri && (
                  <View style={styles.previewContainer}>
                    <ExpoImage
                      source={{ uri: pendingUri }}
                      style={styles.previewImage}
                      contentFit="cover"
                      transition={100}
                    />
                    <TouchableOpacity
                      style={styles.changeBtn}
                      onPress={async () => {
                        const uri = await pickImageFromLibrary();
                        if (uri) setPendingUri(uri);
                      }}
                      disabled={uploading}
                    >
                      <Edit3 size={14} color="#FFFFFF" />
                      <Text style={styles.changeBtnText}>Changer</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.modalLabel}>Légende (optionnel)</Text>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Décrivez cette photo..."
                  placeholderTextColor={Colors.text.muted}
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={200}
                  multiline
                  numberOfLines={2}
                  editable={!uploading}
                />
                <Button
                  title="Publier la photo"
                  onPress={handleConfirmAdd}
                  variant="primary"
                  loading={uploading}
                  disabled={!pendingUri || uploading}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Photo viewer */}
        <Modal visible={!!viewerPhoto} animationType="fade" transparent onRequestClose={() => setViewerPhoto(null)}>
          <View style={styles.viewerOverlay}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerPhoto(null)}>
              <X size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {viewerPhoto && (
              <>
                <ExpoImage
                  source={{ uri: viewerPhoto.imageUrl }}
                  style={styles.viewerImage}
                  contentFit="contain"
                />
                {viewerPhoto.caption && (
                  <Text style={styles.viewerCaption}>{viewerPhoto.caption}</Text>
                )}
                <Text style={styles.viewerUploader}>
                  {resolveUser(viewerPhoto.userId)?.fullName || resolveUser(viewerPhoto.userId)?.username || 'Membre'}
                </Text>
                {(viewerPhoto.userId === user?.id || isCaptain) && (
                  <TouchableOpacity style={styles.viewerDelete} onPress={() => handleDelete(viewerPhoto)}>
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.viewerDeleteText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '700' as const,
    flex: 1,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: { paddingHorizontal: 24 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  deleteBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 6, width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  captionOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
  },
  captionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' as const },
  uploaderOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
  },
  uploaderText: { color: '#FFFFFF', fontSize: 9 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.background.dark,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 16,
  },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginBottom: 8, marginTop: 16 },
  captionInput: {
    backgroundColor: Colors.background.card, borderRadius: 12, padding: 16,
    color: Colors.text.primary, fontSize: 16, marginBottom: 16, minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  previewContainer: { position: 'relative', marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  previewImage: { width: '100%', height: 280, borderRadius: 16 },
  changeBtn: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  changeBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' as const },
  // Viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '90%', height: '65%', borderRadius: 12 },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  viewerDelete: {
    position: 'absolute', bottom: 50,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  viewerDeleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
  viewerCaption: { color: '#FFFFFF', fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  viewerUploader: { color: Colors.text.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
