import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Hash, Users, Zap, MessageCircle, ChevronRight, Plus, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/Avatar';

const ROOM_TYPE_META: Record<string, { label: string; Icon: typeof Hash; color: string }> = {
  general:  { label: 'Général',   Icon: Hash,           color: Colors.primary.blue },
  strategy: { label: 'Stratégie', Icon: Users,          color: '#8B5CF6' },
  match:    { label: 'Match',     Icon: Zap,            color: Colors.primary.orange },
};

export default function TeamChatHubScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { user } = useAuth();
  const { getTeamById } = useTeams();
  const { getTeamRooms, createTeamChats, createRoom, isCreatingRoom } = useChat();

  const team = getTeamById(teamId || '');
  const rooms = getTeamRooms(teamId || '');

  const isCaptain = team?.captainId === user?.id;
  const isCoCaptain = team?.coCaptainIds.includes(user?.id || '') ?? false;
  const canManage = isCaptain || isCoCaptain;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'general' | 'match' | 'strategy'>('general');

  const handleOpenRoom = (roomId: string) => {
    router.push(`/chat/${roomId}`);
  };

  const handleCreateRoom = async () => {
    if (!team || !newRoomName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de salon.');
      return;
    }
    try {
      await createRoom({
        teamId: team.id,
        name: newRoomName.trim(),
        type: newRoomType,
        participants: team.members.map(m => m.userId),
      });
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomType('general');
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

  const handleEnsureRooms = async () => {
    if (!team || !user) return;
    try {
      await createTeamChats({
        teamId: team.id,
        teamName: team.name,
        members: team.members.map(m => m.userId),
      });
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

  React.useEffect(() => {
    if (team && rooms.length === 0) {
      handleEnsureRooms();
    }
  }, [team?.id]);

  if (!team) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorText}>Équipe introuvable.</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router, `/(tabs)/chat`)}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Avatar uri={team.logo} name={team.name} size="small" />
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>{team.name}</Text>
                <Text style={styles.headerSub}>{rooms.length} salon{rooms.length > 1 ? 's' : ''}</Text>
              </View>
            </View>
            {canManage ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
                <Plus size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Salons section */}
            <Text style={styles.sectionLabel}>SALONS</Text>

            {rooms.length === 0 ? (
              <View style={styles.emptyBox}>
                <MessageCircle size={40} color={Colors.text.muted} />
                <Text style={styles.emptyText}>Création des salons...</Text>
              </View>
            ) : (
              rooms.map(room => {
                const meta = ROOM_TYPE_META[room.type] ?? { label: room.name, Icon: Hash, color: Colors.primary.blue };
                const { Icon } = meta;
                const totalUnread = room.unreadCount ?? 0;

                return (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.roomItem}
                    onPress={() => handleOpenRoom(room.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.roomIcon, { backgroundColor: `${meta.color}22` }]}>
                      <Icon size={22} color={meta.color} />
                    </View>
                    <View style={styles.roomInfo}>
                      <Text style={styles.roomName}># {room.name}</Text>
                      {room.lastMessage ? (
                        <Text style={styles.roomPreview} numberOfLines={1}>
                          {room.lastMessage.content}
                        </Text>
                      ) : (
                        <Text style={styles.roomPreviewEmpty}>Aucun message</Text>
                      )}
                    </View>
                    {totalUnread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                      </View>
                    )}
                    <ChevronRight size={18} color={Colors.text.muted} style={styles.chevron} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Create room modal — captain/co-captain only */}
          <Modal visible={showCreateModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nouveau salon</Text>
                  <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreateModal(false)}>
                    <X size={22} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>NOM DU SALON</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="ex: Tactique, Blessés..."
                  placeholderTextColor={Colors.text.muted}
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                  autoFocus
                  returnKeyType="done"
                />

                <Text style={styles.modalLabel}>TYPE</Text>
                <View style={styles.typeRow}>
                  {([['general', 'Général', Hash], ['strategy', 'Stratégie', Users], ['match', 'Match', Zap]] as const).map(([type, label, Icon]) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeOption, newRoomType === type && styles.typeOptionActive]}
                      onPress={() => setNewRoomType(type)}
                    >
                      <Icon size={16} color={newRoomType === type ? '#FFF' : Colors.text.secondary} />
                      <Text style={[styles.typeOptionText, newRoomType === type && styles.typeOptionTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.createBtn, (!newRoomName.trim() || isCreatingRoom) && styles.createBtnDisabled]}
                  onPress={handleCreateRoom}
                  disabled={!newRoomName.trim() || isCreatingRoom}
                >
                  <Text style={styles.createBtnText}>{isCreatingRoom ? 'Création...' : 'Créer le salon'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerTextWrap: {},
  headerTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  headerSub: { color: Colors.text.muted, fontSize: 12, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  roomItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.light },
  roomIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roomInfo: { flex: 1 },
  roomName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  roomPreview: { color: Colors.text.secondary, fontSize: 13, marginTop: 3 },
  roomPreviewEmpty: { color: Colors.text.muted, fontSize: 13, marginTop: 3, fontStyle: 'italic' },
  unreadBadge: { backgroundColor: Colors.primary.orange, borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 6 },
  unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  chevron: { opacity: 0.5 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  errorText: { color: Colors.text.muted, fontSize: 16, textAlign: 'center', marginTop: 40 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border.light },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  modalLabel: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1, textTransform: 'uppercase' as const, marginBottom: 10 },
  modalInput: { backgroundColor: Colors.background.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text.primary, fontSize: 15, borderWidth: 1, borderColor: Colors.border.light, marginBottom: 20 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background.card },
  typeOptionActive: { backgroundColor: Colors.primary.blue },
  typeOptionText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  typeOptionTextActive: { color: '#FFFFFF' },
  createBtn: { backgroundColor: Colors.primary.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
});
