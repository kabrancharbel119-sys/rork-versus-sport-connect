import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
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
  const { chatRooms, createRoom, createTeamChats, isCreatingRoom, createChatRequest, getPendingChatRequests, getSentChatRequests, respondToChatRequest, isCreatingRequest } = useChat();
  const { getUserTeams } = useTeams();
  const { users, getUserById } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'general' | 'match' | 'strategy'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');

  const myTeams = user ? getUserTeams(user.id) : [];

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      (u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [users, searchQuery]);

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
    if (senderId === user?.id) return 'Vous : ';
    if (senderId === 'system') return '';
    const sender = getUserById(senderId);
    return sender?.username ? `${sender.username} : ` : '';
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

  const startDirectChat = async (targetUserId: string) => {
    const targetUser = getUserById(targetUserId);
    if (!targetUser || !user) return;
    if (targetUserId === user.id) {
      setShowNewChatModal(false);
      setSearchQuery('');
      Alert.alert('Recherche', 'Vous ne pouvez pas vous envoyer un message à vous-même.');
      return;
    }
    
    // Check if there's already a direct chat room
    const existingDirectRoom = chatRooms.find(r => 
      r.type === 'direct' && 
      r.participants.includes(user.id) && 
      r.participants.includes(targetUserId)
    );
    
    if (existingDirectRoom) {
      setShowNewChatModal(false);
      setSearchQuery('');
      router.push(`/chat/${existingDirectRoom.id}`);
      return;
    }
    
    // Check if there's a pending request
    const sentRequests = getSentChatRequests();
    const pendingRequest = sentRequests.find(r => r.recipientId === targetUserId);
    
    if (pendingRequest) {
      Alert.alert('Demande en attente', 'Vous avez déjà envoyé une demande de conversation à cet utilisateur. En attente de réponse.');
      setShowNewChatModal(false);
      setSearchQuery('');
      return;
    }
    
    setSelectedUserForRequest(targetUserId);
    setRequestMessage('');
    setShowNewChatModal(false);
    setShowRequestModal(true);
  };

  const userRooms = useMemo(() => {
    return [...chatRooms]
      .filter(r => r.participants.includes(user?.id || ''))
      .sort((a, b) => {
        const aT = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
        const bT = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
        return bT - aT;
      });
  }, [chatRooms, user?.id]);

  const filteredConversations = useMemo(() => {
    if (!conversationSearch.trim()) return userRooms;
    const q = conversationSearch.toLowerCase().trim();
    return userRooms.filter(r => r.name.toLowerCase().includes(q));
  }, [userRooms, conversationSearch]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity testID="btn-new-direct-message" style={styles.headerBtn} onPress={() => setShowNewChatModal(true)}>
              <UserPlus size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            {myTeams.length > 0 && (
              <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCreateModal(true)}>
                <Plus size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {userRooms.length > 0 && (
          <View style={styles.searchBarWrap}>
            <View style={styles.searchIcon}>
              <Search size={20} color={Colors.text.muted} />
            </View>
            <TextInput
              style={styles.conversationSearchInput}
              placeholder="Rechercher une conversation..."
              placeholderTextColor={Colors.text.muted}
              value={conversationSearch}
              onChangeText={setConversationSearch}
            />
            {conversationSearch.length > 0 && (
              <TouchableOpacity hitSlop={8} onPress={() => setConversationSearch('')} style={styles.searchClear}>
                <X size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView testID="chat-scroll" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(() => {
            const pendingRequests = getPendingChatRequests();
            const sentRequests = getSentChatRequests();
            
            return (
              <>
                {pendingRequests.length > 0 && (
                  <View style={styles.requestsSection}>
                    <Text style={styles.sectionTitle}>Demandes reçues ({pendingRequests.length})</Text>
                    {pendingRequests.map((request) => {
                      const requester = getUserById(request.requesterId);
                      return (
                        <Card key={request.id} style={styles.requestCard}>
                          <View style={styles.requestHeader}>
                            <Avatar uri={requester?.avatar} name={requester?.fullName || requester?.username || ''} size="small" />
                            <View style={styles.requestInfo}>
                              <Text style={styles.requestName}>{requester?.fullName || requester?.username || 'Utilisateur'}</Text>
                              {request.message && <Text style={styles.requestMessage}>{request.message}</Text>}
                            </View>
                          </View>
                          <View style={styles.requestActions}>
                            <TouchableOpacity 
                              style={[styles.requestBtn, styles.requestBtnAccept]} 
                              onPress={async () => {
                                try {
                                  await respondToChatRequest({ requestId: request.id, action: 'accept' });
                                  Alert.alert('Succès', 'Demande acceptée ! La conversation est maintenant disponible.');
                                } catch (error: any) {
                                  Alert.alert('Erreur', error.message || 'Impossible d\'accepter la demande');
                                }
                              }}
                            >
                              <Text style={styles.requestBtnText}>Accepter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.requestBtn, styles.requestBtnReject]} 
                              onPress={async () => {
                                try {
                                  await respondToChatRequest({ requestId: request.id, action: 'reject' });
                                  Alert.alert('Succès', 'Demande refusée');
                                } catch (error: any) {
                                  Alert.alert('Erreur', error.message || 'Impossible de refuser la demande');
                                }
                              }}
                            >
                              <Text style={styles.requestBtnText}>Refuser</Text>
                            </TouchableOpacity>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
                
                {sentRequests.length > 0 && (
                  <View style={styles.requestsSection}>
                    <Text style={styles.sectionTitle}>Demandes envoyées ({sentRequests.length})</Text>
                    {sentRequests.map((request) => {
                      const recipient = getUserById(request.recipientId);
                      return (
                        <Card key={request.id} style={styles.requestCard}>
                          <View style={styles.requestHeader}>
                            <Avatar uri={recipient?.avatar} name={recipient?.fullName || recipient?.username || ''} size="small" />
                            <View style={styles.requestInfo}>
                              <Text style={styles.requestName}>{recipient?.fullName || recipient?.username || 'Utilisateur'}</Text>
                              <Text style={styles.requestStatus}>En attente de réponse...</Text>
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
                
                {filteredConversations.length > 0 && (
                  <View style={styles.conversationsSection}>
                    <Text style={styles.sectionTitle}>
                      {conversationSearch.trim() ? `Résultats (${filteredConversations.length})` : 'Conversations récentes'}
                    </Text>
                    {filteredConversations.map((room) => {
                      const RoomIcon = getRoomIcon(room.type);
                      const team = myTeams.find(t => t.id === room.teamId);
                      const isDirectChat = room.type === 'direct';
                      const otherParticipantId = isDirectChat && room.participants.find(id => id !== user?.id);
                      const otherUser = otherParticipantId ? getUserById(otherParticipantId) : null;
                      
                      return (
                        <TouchableOpacity
                          key={room.id}
                          style={styles.chatItem}
                          onPress={() => router.push(`/chat/${room.id}`)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.chatIconContainer}>
                            {isDirectChat && otherUser ? (
                              <Avatar uri={otherUser.avatar} name={otherUser.fullName || otherUser.username || ''} size="medium" />
                            ) : team?.logo ? (
                              <Avatar uri={team.logo} name={team.name} size="medium" />
                            ) : (
                              <View style={styles.iconWrapper}>
                                <RoomIcon size={22} color={Colors.primary.blue} />
                              </View>
                            )}
                          </View>
                          <View style={styles.chatContent}>
                            <View style={styles.chatTop}>
                              <Text style={styles.chatName} numberOfLines={1}>
                                {isDirectChat && otherUser ? (otherUser.fullName || otherUser.username || 'Utilisateur') : room.name}
                              </Text>
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
                )}
                
                {filteredConversations.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 && userRooms.length > 0 && conversationSearch.trim() && (
            <View style={styles.emptySearch}>
              <Search size={40} color={Colors.text.muted} />
              <Text style={styles.emptySearchText}>Aucune conversation ne correspond à « {conversationSearch} »</Text>
            </View>
                )}
                
                {filteredConversations.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 && myTeams.length > 0 && !conversationSearch.trim() && (
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
                )}
                
                {filteredConversations.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 && myTeams.length === 0 && !conversationSearch.trim() && (
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
              </>
            )})()}
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

        <Modal visible={showNewChatModal} animationType="slide" transparent statusBarTranslucent>
          <View style={styles.modalSearchOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSearchWrapper}>
              <SafeAreaView style={styles.modalSearchSafe} edges={['top']}>
                <View style={styles.modalSearchHeader}>
                  <Text style={styles.modalTitle}>Nouvelle conversation</Text>
                  <TouchableOpacity style={styles.modalClose} onPress={() => { setShowNewChatModal(false); setSearchQuery(''); }}>
                    <X size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalSearchBarContainer}>
                  <Search size={22} color={Colors.text.muted} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Rechercher un joueur (nom ou pseudo)..."
                    placeholderTextColor={Colors.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity hitSlop={8} onPress={() => setSearchQuery('')}>
                      <X size={20} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </SafeAreaView>
              <View style={styles.modalUserListContainer}>
                {filteredUsers.length > 0 ? (
                  <FlatList
                    data={filteredUsers}
                    keyExtractor={(u) => u.id}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.userListContent}
                    renderItem={({ item: u }) => (
                      <TouchableOpacity style={styles.userItem} onPress={() => startDirectChat(u.id)}>
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
                    )}
                  />
                ) : searchQuery.trim() ? (
                  <View style={styles.searchEmptyState}>
                    <Search size={48} color={Colors.text.muted} />
                    <Text style={styles.noResults}>Aucun joueur trouvé pour « {searchQuery} »</Text>
                  </View>
                ) : (
                  <View style={styles.searchEmptyState}>
                    <Search size={48} color={Colors.text.muted} />
                    <Text style={styles.searchHint}>La barre de recherche est en haut.{'\n'}Tapez un nom ou un pseudo pour trouver un joueur.</Text>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal visible={showRequestModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Envoyer une demande</Text>
                <TouchableOpacity onPress={() => { setShowRequestModal(false); setSelectedUserForRequest(null); setRequestMessage(''); }}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              {selectedUserForRequest && (
                <>
                  <Text style={styles.modalLabel}>
                    Envoyer une demande de conversation à {getUserById(selectedUserForRequest)?.fullName || getUserById(selectedUserForRequest)?.username || 'cet utilisateur'} ?
                  </Text>
                  <Text style={styles.modalLabel}>Message (optionnel)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={requestMessage}
                    onChangeText={setRequestMessage}
                    placeholder="Ajouter un message optionnel..."
                    placeholderTextColor={Colors.text.muted}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.modalActions}>
                    <Button title="Annuler" onPress={() => { setShowRequestModal(false); setSelectedUserForRequest(null); setRequestMessage(''); }} variant="outline" style={styles.modalButton} />
                    <Button 
                      title="Envoyer" 
                      onPress={async () => {
                        try {
                          await createChatRequest({ recipientId: selectedUserForRequest, message: requestMessage.trim() || undefined });
                          setShowRequestModal(false);
                          setSelectedUserForRequest(null);
                          setRequestMessage('');
                          Alert.alert('Succès', 'Demande de conversation envoyée !');
                        } catch (error: any) {
                          Alert.alert('Erreur', error.message || 'Impossible d\'envoyer la demande');
                        }
                      }} 
                      variant="primary" 
                      style={styles.modalButton}
                      loading={isCreatingRequest}
                    />
                  </View>
                </>
              )}
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
  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border.light },
  searchIcon: { marginRight: 10 },
  conversationSearchInput: { flex: 1, color: Colors.text.primary, fontSize: 16, paddingVertical: 12 },
  searchClear: { padding: 4 },
  emptySearch: { alignItems: 'center', paddingVertical: 48 },
  emptySearchText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 12, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSearchOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalSearchWrapper: { flex: 1, backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalSearchSafe: { backgroundColor: Colors.background.dark, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalSearchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalSearchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border.light, gap: 10 },
  modalSearchInput: { flex: 1, color: Colors.text.primary, fontSize: 16, paddingVertical: 2 },
  modalUserListContainer: { flex: 1, minHeight: 200 },
  userListContent: { paddingHorizontal: 16, paddingBottom: 24 },
  searchEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
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
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 12 },
  userInfo: { flex: 1 },
  userName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  userHandle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  noResults: { color: Colors.text.muted, fontSize: 15, textAlign: 'center' as const, marginTop: 16 },
  searchHint: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 12, lineHeight: 20 },
  requestsSection: { marginBottom: 24 },
  requestCard: { marginBottom: 12 },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  requestInfo: { flex: 1 },
  requestName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  requestMessage: { color: Colors.text.secondary, fontSize: 13, marginTop: 4 },
  requestStatus: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8 },
  requestBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' as const },
  requestBtnAccept: { backgroundColor: Colors.status.success },
  requestBtnReject: { backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  requestBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  modalTextInput: { backgroundColor: Colors.background.cardLight, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 14, minHeight: 100, textAlignVertical: 'top' as const, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  modalButton: { flex: 1 },
});
