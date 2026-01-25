import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Users, Hash, Zap, Plus, X, Search, UserPlus, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { chatRooms, createRoom, createTeamChats, isCreatingRoom } = useChat();
  const { getUserTeams } = useTeams();
  const { users, getUserById } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'general' | 'match' | 'strategy'>('general');
  const [searchQuery, setSearchQuery] = useState('');

  const myTeams = user ? getUserTeams(user.id) : [];

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return users.filter(u => 
      u.id !== user?.id && 
      (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 10);
  }, [users, searchQuery, user?.id]);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'general': return Hash;
      case 'match': return Zap;
      case 'strategy': return Users;
      default: return MessageCircle;
    }
  };

  const getLastMessageSender = (senderId: string) => {
    if (senderId === user?.id) return 'Vous';
    if (senderId === 'system') return '';
    const sender = getUserById(senderId);
    return sender?.username ? `${sender.username}: ` : '';
  };

  const handleCreateTeamChats = async (teamId: string, teamName: string, members: string[]) => {
    try {
      await createTeamChats({ teamId, teamName, members });
      Alert.alert('Succès', 'Discussions d\'équipe créées !');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedTeam || !newRoomName.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    const team = myTeams.find(t => t.id === selectedTeam);
    if (!team) return;
    try {
      await createRoom({
        teamId: selectedTeam,
        name: newRoomName.trim(),
        type: newRoomType,
        participants: team.members.map(m => m.userId),
      });
      setShowCreateModal(false);
      setNewRoomName('');
      setSelectedTeam(null);
      Alert.alert('Succès', 'Discussion créée !');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const startDirectChat = (targetUserId: string) => {
    const targetUser = getUserById(targetUserId);
    if (!targetUser || !user) return;
    
    Alert.alert(
      'Nouvelle conversation',
      `Voulez-vous démarrer une conversation avec ${targetUser.fullName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Démarrer', 
          onPress: () => {
            setShowNewChatModal(false);
            setSearchQuery('');
            Alert.alert('Info', 'Les messages directs seront disponibles prochainement. Pour l\'instant, rejoignez une équipe pour discuter.');
          }
        }
      ]
    );
  };

  const allRooms = chatRooms.sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  const userRooms = allRooms.filter(r => r.participants.includes(user?.id || ''));

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowNewChatModal(true)}>
              <UserPlus size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            {myTeams.length > 0 && (
              <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCreateModal(true)}>
                <Plus size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {userRooms.length > 0 ? (
            <View style={styles.conversationsSection}>
              <Text style={styles.sectionTitle}>Conversations récentes</Text>
              {userRooms.map((room) => {
                const RoomIcon = getRoomIcon(room.type);
                const team = myTeams.find(t => t.id === room.teamId);
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.chatItem}
                    onPress={() => router.push(`/chat/${room.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.chatIconContainer}>
                      {team?.logo ? (
                        <Avatar uri={team.logo} name={team.name} size="medium" />
                      ) : (
                        <View style={styles.iconWrapper}>
                          <RoomIcon size={22} color={Colors.primary.blue} />
                        </View>
                      )}
                    </View>
                    <View style={styles.chatContent}>
                      <View style={styles.chatTop}>
                        <Text style={styles.chatName} numberOfLines={1}>{room.name}</Text>
                        {room.lastMessage && (
                          <Text style={styles.chatTime}>{formatTime(room.lastMessage.createdAt)}</Text>
                        )}
                      </View>
                      {room.lastMessage ? (
                        <Text style={styles.chatPreview} numberOfLines={1}>
                          {getLastMessageSender(room.lastMessage.senderId)}{room.lastMessage.content}
                        </Text>
                      ) : (
                        <Text style={styles.chatPreviewEmpty}>Aucun message</Text>
                      )}
                    </View>
                    {room.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{room.unreadCount > 99 ? '99+' : room.unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : myTeams.length > 0 ? (
            <View style={styles.noChatsSection}>
              <Card style={styles.noChatsCard}>
                <MessageCircle size={48} color={Colors.text.muted} />
                <Text style={styles.noChatsTitle}>Pas de discussions</Text>
                <Text style={styles.noChatsText}>Créez des discussions pour vos équipes</Text>
                {myTeams.slice(0, 3).map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={styles.teamQuickStart}
                    onPress={() => handleCreateTeamChats(team.id, team.name, team.members.map(m => m.userId))}
                  >
                    <Avatar uri={team.logo} name={team.name} size="small" />
                    <Text style={styles.teamQuickStartText}>{team.name}</Text>
                    <ChevronRight size={18} color={Colors.primary.blue} />
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <MessageCircle size={64} color={Colors.text.muted} />
              </View>
              <Text style={styles.emptyTitle}>Pas de messages</Text>
              <Text style={styles.emptyText}>Rejoignez une équipe pour accéder aux discussions de groupe</Text>
              <Button
                title="Trouver une équipe"
                onPress={() => router.push('/(tabs)/teams')}
                variant="primary"
                size="medium"
                style={styles.findTeamBtn}
              />
              <TouchableOpacity style={styles.searchUsersBtn} onPress={() => setShowNewChatModal(true)}>
                <UserPlus size={18} color={Colors.primary.blue} />
                <Text style={styles.searchUsersBtnText}>Rechercher des joueurs</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <Modal visible={showCreateModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle discussion</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreateModal(false)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>Équipe</Text>
                {myTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamOption, selectedTeam === team.id && styles.teamOptionActive]}
                    onPress={() => setSelectedTeam(team.id)}
                  >
                    <Avatar uri={team.logo} name={team.name} size="small" />
                    <Text style={styles.teamOptionName}>{team.name}</Text>
                    {selectedTeam === team.id && <View style={styles.checkMark} />}
                  </TouchableOpacity>
                ))}
                <Input
                  label="Nom de la discussion"
                  placeholder="Ex: Préparation match"
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                />
                <Text style={styles.modalLabel}>Type</Text>
                <View style={styles.typeOptions}>
                  {([['general', 'Général', Hash], ['strategy', 'Stratégie', Users], ['match', 'Match', Zap]] as const).map(([type, label, Icon]) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeOption, newRoomType === type && styles.typeOptionActive]}
                      onPress={() => setNewRoomType(type)}
                    >
                      <Icon size={18} color={newRoomType === type ? '#FFF' : Colors.text.secondary} />
                      <Text style={[styles.typeOptionText, newRoomType === type && styles.typeOptionTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Button
                  title="Créer la discussion"
                  onPress={handleCreateRoom}
                  loading={isCreatingRoom}
                  variant="primary"
                  size="large"
                  style={styles.createBtn}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showNewChatModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle conversation</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => { setShowNewChatModal(false); setSearchQuery(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <Search size={20} color={Colors.text.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un joueur..."
                  placeholderTextColor={Colors.text.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
              <ScrollView style={styles.usersList}>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <TouchableOpacity key={u.id} style={styles.userItem} onPress={() => startDirectChat(u.id)}>
                      <Avatar uri={u.avatar} name={u.fullName} size="medium" />
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{u.fullName}</Text>
                        <Text style={styles.userHandle}>@{u.username}</Text>
                      </View>
                      {u.isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                ) : searchQuery.trim() ? (
                  <Text style={styles.noResults}>Aucun joueur trouvé</Text>
                ) : (
                  <Text style={styles.searchHint}>Tapez un nom ou pseudo pour rechercher</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  conversationsSection: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 12 },
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.light },
  chatIconContainer: { marginRight: 12 },
  iconWrapper: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(21, 101, 192, 0.1)', alignItems: 'center', justifyContent: 'center' },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const, marginRight: 8 },
  chatTime: { color: Colors.text.muted, fontSize: 12 },
  chatPreview: { color: Colors.text.secondary, fontSize: 13 },
  chatPreviewEmpty: { color: Colors.text.muted, fontSize: 13, fontStyle: 'italic' as const },
  unreadBadge: { backgroundColor: Colors.primary.orange, borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
  unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' as const },
  noChatsSection: { paddingTop: 40 },
  noChatsCard: { alignItems: 'center', paddingVertical: 32 },
  noChatsTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginTop: 16 },
  noChatsText: { color: Colors.text.muted, fontSize: 14, marginTop: 4, marginBottom: 20 },
  teamQuickStart: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.background.cardLight, marginBottom: 8, gap: 12 },
  teamQuickStartText: { flex: 1, color: Colors.text.primary, fontSize: 14, fontWeight: '500' as const },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '600' as const },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 8, paddingHorizontal: 40 },
  findTeamBtn: { marginTop: 24 },
  searchUsersBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 12, paddingHorizontal: 20 },
  searchUsersBtnText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20 },
  modalLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 12, textTransform: 'uppercase' as const },
  teamOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: Colors.background.card, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  teamOptionActive: { borderColor: Colors.primary.blue },
  teamOptionName: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  checkMark: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue },
  typeOptions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background.card },
  typeOptionActive: { backgroundColor: Colors.primary.blue },
  typeOptionText: { color: Colors.text.secondary, fontSize: 13 },
  typeOptionTextActive: { color: '#FFFFFF' },
  createBtn: { marginTop: 12, marginBottom: 40 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, margin: 20, marginTop: 0, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15, paddingVertical: 14 },
  usersList: { paddingHorizontal: 20, maxHeight: 400 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 12 },
  userInfo: { flex: 1 },
  userName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  userHandle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  noResults: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, paddingVertical: 40 },
  searchHint: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, paddingVertical: 40 },
});
