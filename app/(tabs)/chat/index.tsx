import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Users, Hash, Zap, Plus, X, Search, UserPlus, ChevronRight, Inbox } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function ChatScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { chatRooms, createRoom, createTeamChats, isCreatingRoom, createChatRequest, getPendingChatRequests, getSentChatRequests, respondToChatRequest, isCreatingRequest, getTeamRooms } = useChat();
  const { getUserTeams } = useTeams();
  const { users, getUserById } = useUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'general' | 'match' | 'strategy'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [loadedUsers, setLoadedUsers] = useState<Map<string, any>>(new Map());

  const myTeams = user ? getUserTeams(user.id) : [];

  // Load missing users for chat requests
  React.useEffect(() => {
    const loadMissingUsers = async () => {
      const pendingRequests = getPendingChatRequests() ?? [];
      const sentRequests = getSentChatRequests() ?? [];
      const allRequests = [...pendingRequests, ...sentRequests];
      const userIds = new Set<string>();
      
      allRequests.forEach(req => {
        userIds.add(req.requesterId);
        userIds.add(req.recipientId);
      });

      (chatRooms ?? []).forEach((room) => {
        if (room.type !== 'direct') return;
        if (!user?.id || !room.participants.includes(user.id)) return;
        const otherParticipantId = room.participants.find((id) => id !== user.id);
        if (otherParticipantId) {
          userIds.add(otherParticipantId);
        }
      });

      const newLoadedUsers = new Map(loadedUsers);
      let hasNewUsers = false;

      for (const userId of userIds) {
        if (!newLoadedUsers.has(userId)) {
          try {
            const userData = await getUserById(userId);
            if (userData) {
              newLoadedUsers.set(userId, userData);
              hasNewUsers = true;
            }
          } catch (e) {
            console.log('[ChatList] Failed to load user:', userId);
          }
        }
      }

      if (hasNewUsers) {
        setLoadedUsers(newLoadedUsers);
      }
    };

    loadMissingUsers();
  }, [chatRooms, user?.id, getPendingChatRequests, getSentChatRequests, getUserById]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show verified users when no search query
      return (users ?? [])
        .filter(u => u.isProfileVisible !== false && u.isVerified)
        .slice(0, 8);
    }
    const q = searchQuery.toLowerCase();
    return (users ?? [])
      .filter(u =>
        u.isProfileVisible !== false &&
        (u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        // Verified users first
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        return 0;
      })
      .slice(0, 15);
  }, [users, searchQuery]);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const localeCode = locale === 'en' ? 'en-US' : 'fr-FR';
    if (diffDays === 0) return d.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t('chatList.yesterday');
    if (diffDays < 7) return d.toLocaleDateString(localeCode, { weekday: 'short' });
    return d.toLocaleDateString(localeCode, { day: 'numeric', month: 'short' });
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'general': return Hash;
      case 'match': return Zap;
      case 'strategy': return Users;
      default: return MessageCircle;
    }
  };

  const usersById = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    (users ?? []).forEach((u) => map.set(u.id, u));
    // Merge with loaded users
    loadedUsers.forEach((u, id) => {
      if (!map.has(id)) {
        map.set(id, u);
      }
    });
    return map;
  }, [users, loadedUsers]);

  const getLastMessageSender = (senderId: string) => {
    if (senderId === user?.id) return t('chatList.youPrefix');
    if (senderId === 'system') return '';
    const sender = usersById.get(senderId);
    return sender?.username ? `${sender.username} : ` : '';
  };

  const getConversationTitle = (room: (typeof chatRooms)[number], otherUser?: (typeof users)[number], otherParticipantId?: string) => {
    if (room.type === 'direct') {
      if (otherUser) {
        return otherUser.fullName || otherUser.username || t('chatList.userFallback');
      }
      if (otherParticipantId) {
        return 'Discussion privée';
      }
    }
    return room.name;
  };

  const handleCreateTeamChats = async (teamId: string, teamName: string, members: string[]) => {
    try {
      await createTeamChats({ teamId, teamName, members });
      Alert.alert(t('common.success'), t('chatList.teamDiscussionsCreated'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedTeam || !newRoomName.trim()) {
      Alert.alert(t('common.error'), t('chatList.fillAllFields'));
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
      Alert.alert(t('common.success'), t('chatList.discussionCreated'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    const targetUser = usersById.get(targetUserId);
    if (!targetUser || !user) return;
    if (targetUserId === user.id) {
      setShowNewChatModal(false);
      setSearchQuery('');
      Alert.alert(t('common.error'), t('chatList.cannotMessageSelf'));
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
    
    // Navigate to user profile to preview before sending request
    setShowNewChatModal(false);
    setSearchQuery('');
    router.push(`/user/${targetUserId}` as any);
  };

  const userRooms = useMemo(() => {
    return [...(chatRooms ?? [])]
      .filter(r => (r.participants ?? []).includes(user?.id || ''))
      .sort((a, b) => {
        const aT = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
        const bT = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
        return bT - aT;
      });
  }, [chatRooms, user?.id]);

  // Direct chats only (non-team)
  const directRooms = useMemo(() => userRooms.filter(r => r.type === 'direct'), [userRooms]);

  // One entry per team that has rooms
  const teamEntries = useMemo(() => {
    return myTeams
      .map(team => {
        const rooms = getTeamRooms(team.id);
        if (rooms.length === 0) return null;
        const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
        const lastActivity = rooms.reduce((latest, r) => {
          const t = r.lastMessage ? new Date(r.lastMessage.createdAt).getTime() : new Date(r.createdAt).getTime();
          return t > latest ? t : latest;
        }, 0);
        const lastRoom = rooms.find(r => r.lastMessage) ?? rooms[0];
        return { team, rooms, totalUnread, lastActivity, lastRoom };
      })
      .filter(Boolean)
      .sort((a, b) => b!.lastActivity - a!.lastActivity) as { team: (typeof myTeams)[number]; rooms: typeof userRooms; totalUnread: number; lastActivity: number; lastRoom: (typeof userRooms)[number] }[];
  }, [myTeams, getTeamRooms]);

  const filteredConversations = useMemo(() => {
    if (!conversationSearch.trim()) return directRooms;
    const q = conversationSearch.toLowerCase().trim();
    return directRooms.filter(r => {
      const otherPId = r.participants.find(id => id !== user?.id);
      const otherU = otherPId ? usersById.get(otherPId) : undefined;
      return r.name.toLowerCase().includes(q) || otherU?.fullName?.toLowerCase().includes(q) || otherU?.username?.toLowerCase().includes(q);
    });
  }, [directRooms, conversationSearch, usersById, user?.id]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('chatList.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {(teamEntries.length + directRooms.length) > 0
                ? `${teamEntries.length + directRooms.length} conversation${(teamEntries.length + directRooms.length) > 1 ? 's' : ''}`
                : 'Vos conversations privées et d\'équipe'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerBtn} 
              onPress={() => router.push('/chat-requests' as any)}
            >
              <Inbox size={20} color={Colors.text.primary} />
              {getPendingChatRequests().length > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>
                    {getPendingChatRequests().length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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

        {(directRooms.length > 0 || teamEntries.length > 0) && (
          <View style={styles.searchBarWrap}>
            <View style={styles.searchIcon}>
              <Search size={20} color={Colors.text.muted} />
            </View>
            <TextInput
              style={styles.conversationSearchInput}
              placeholder={t('chatList.searchConversationPlaceholder')}
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
            const pendingRequests = getPendingChatRequests() ?? [];
            
            return (
              <>
                {pendingRequests.length > 0 && (
                  <View style={styles.requestsSection}>
                    <Text style={styles.sectionTitle}>{pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} reçue{pendingRequests.length > 1 ? 's' : ''}</Text>
                    {pendingRequests.map((request) => {
                      const requester = usersById.get(request.requesterId);
                      return (
                        <Card key={request.id} style={styles.requestCard}>
                          <View style={styles.requestHeader}>
                            <Avatar uri={requester?.avatar} name={requester?.fullName || requester?.username || ''} size="small" />
                            <View style={styles.requestInfo}>
                              <Text style={styles.requestName}>{requester?.fullName || requester?.username || t('chatList.userFallback')}</Text>
                              {request.message && <Text style={styles.requestMessage}>{request.message}</Text>}
                            </View>
                          </View>
                          <View style={styles.requestActions}>
                            <TouchableOpacity 
                              style={[styles.requestBtn, styles.requestBtnAccept]} 
                              onPress={async () => {
                                try {
                                  const result = await respondToChatRequest({ requestId: request.id, action: 'accept' }) as any;
                                  const roomId = result?.roomId as string | undefined;
                                  if (roomId) {
                                    router.push(`/chat/${roomId}`);
                                  } else {
                                    Alert.alert(t('common.success'), t('chatList.requestAccepted'));
                                  }
                                } catch (error: any) {
                                  Alert.alert(t('common.error'), error.message || t('chatList.cannotAcceptRequest'));
                                }
                              }}
                            >
                              <Text style={styles.requestBtnText}>{t('chatList.accept')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.requestBtn, styles.requestBtnReject]} 
                              onPress={async () => {
                                try {
                                  await respondToChatRequest({ requestId: request.id, action: 'reject' });
                                  Alert.alert(t('common.success'), t('chatList.requestRejected'));
                                } catch (error: any) {
                                  Alert.alert(t('common.error'), error.message || t('chatList.cannotRejectRequest'));
                                }
                              }}
                            >
                              <Text style={styles.requestBtnText}>{t('chatList.reject')}</Text>
                            </TouchableOpacity>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
                
                {/* Team entries (Discord-style) */}
                {teamEntries.length > 0 && (
                  <View style={styles.conversationsSection}>
                    <Text style={styles.sectionTitle}>Équipes</Text>
                    {teamEntries.map(({ team, totalUnread, lastRoom }) => (
                      <TouchableOpacity
                        key={team.id}
                        style={styles.chatItem}
                        onPress={() => router.push(`/team-chat/${team.id}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.chatIconContainer}>
                          <Avatar uri={team.logo} name={team.name} size="medium" />
                        </View>
                        <View style={styles.chatContent}>
                          <View style={styles.chatTop}>
                            <Text style={styles.chatName} numberOfLines={1}>{team.name}</Text>
                            {lastRoom?.lastMessage && (
                              <Text style={styles.chatTime}>{formatTime(lastRoom.lastMessage.createdAt)}</Text>
                            )}
                          </View>
                          {lastRoom?.lastMessage ? (
                            <Text style={styles.chatPreview} numberOfLines={1}>
                              {getLastMessageSender(lastRoom.lastMessage.senderId)}{lastRoom.lastMessage.content}
                            </Text>
                          ) : (
                            <Text style={styles.chatPreviewEmpty}>{t('chatList.noMessage')}</Text>
                          )}
                        </View>
                        {totalUnread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Direct conversations */}
                {filteredConversations.length > 0 && (
                  <View style={styles.conversationsSection}>
                    <Text style={styles.sectionTitle}>
                      {conversationSearch.trim() ? `${filteredConversations.length} résultat(s)` : 'Messages privés'}
                    </Text>
                    {filteredConversations.map((room) => {
                      const otherParticipantId = room.participants.find(id => id !== user?.id);
                      const otherUser = otherParticipantId ? usersById.get(otherParticipantId) : undefined;
                      return (
                        <TouchableOpacity
                          key={room.id}
                          style={styles.chatItem}
                          onPress={() => router.push(`/chat/${room.id}`)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.chatIconContainer}>
                            <Avatar uri={otherUser?.avatar} name={otherUser?.fullName || otherUser?.username || ''} size="medium" />
                          </View>
                          <View style={styles.chatContent}>
                            <View style={styles.chatTop}>
                              <Text style={styles.chatName} numberOfLines={1}>
                                {getConversationTitle(room, otherUser, otherParticipantId || undefined)}
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
                              <Text style={styles.chatPreviewEmpty}>{t('chatList.noMessage')}</Text>
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
                
                {filteredConversations.length === 0 && teamEntries.length === 0 && pendingRequests.length === 0 && (directRooms.length > 0 || userRooms.length > 0) && conversationSearch.trim() && (
            <View style={styles.emptySearch}>
              <Search size={40} color={Colors.text.muted} />
              <Text style={styles.emptySearchText}>{t('chatList.noConversationMatch', { query: conversationSearch })}</Text>
            </View>
                )}
                
                {filteredConversations.length === 0 && teamEntries.length === 0 && pendingRequests.length === 0 && myTeams.length > 0 && !conversationSearch.trim() && (
            <View style={styles.noChatsSection}>
              <Card style={styles.noChatsCard}>
                <MessageCircle size={48} color={Colors.text.muted} />
                <Text style={styles.noChatsTitle}>{t('chatList.noDiscussions')}</Text>
                <Text style={styles.noChatsText}>{t('chatList.noDiscussionsText')}</Text>
                {(myTeams ?? []).slice(0, 3).map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={styles.teamQuickStart}
                    onPress={() => handleCreateTeamChats(team.id, team.name, (team.members ?? []).map(m => m.userId))}
                  >
                    <Avatar uri={team.logo} name={team.name} size="small" />
                    <Text style={styles.teamQuickStartText}>{team.name}</Text>
                    <ChevronRight size={18} color={Colors.primary.blue} />
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
                )}
                
                {filteredConversations.length === 0 && teamEntries.length === 0 && pendingRequests.length === 0 && myTeams.length === 0 && !conversationSearch.trim() && (
                  <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <MessageCircle size={64} color={Colors.text.muted} />
              </View>
              <Text style={styles.emptyTitle}>{t('chatList.noMessages')}</Text>
              <Text style={styles.emptyText}>{t('chatList.noMessagesText')}</Text>
              <Button
                title={t('chatList.findTeam')}
                onPress={() => router.push('/(tabs)/teams')}
                variant="primary"
                size="medium"
                style={styles.findTeamBtn}
              />
              <TouchableOpacity style={styles.searchUsersBtn} onPress={() => setShowNewChatModal(true)}>
                <UserPlus size={18} color={Colors.primary.blue} />
                <Text style={styles.searchUsersBtnText}>{t('chatList.searchPlayers')}</Text>
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
                <Text style={styles.modalTitle}>{t('chatList.newDiscussion')}</Text>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreateModal(false)}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>{t('chatList.team')}</Text>
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
                  label={t('chatList.roomName')}
                  placeholder={t('chatList.roomNamePlaceholder')}
                  value={newRoomName}
                  onChangeText={setNewRoomName}
                />
                <Text style={styles.modalLabel}>{t('chatList.type')}</Text>
                <View style={styles.typeOptions}>
                  {([['general', t('chatList.roomTypeGeneral'), Hash], ['strategy', t('chatList.roomTypeStrategy'), Users], ['match', t('chatList.roomTypeMatch'), Zap]] as const).map(([type, label, Icon]) => (
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
                  title={t('chatList.createDiscussion')}
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
                  <View>
                    <Text style={styles.modalTitle}>{t('chatList.newConversation')}</Text>
                    <Text style={styles.modalSubtitle}>{t('chatList.searchOrSelect')}</Text>
                  </View>
                  <TouchableOpacity style={styles.modalClose} onPress={() => { setShowNewChatModal(false); setSearchQuery(''); }}>
                    <X size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalSearchBarContainer}>
                  <Search size={20} color={Colors.primary.blue} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder={t('chatList.searchPlayerPlaceholder')}
                    placeholderTextColor={Colors.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity hitSlop={8} onPress={() => setSearchQuery('')}>
                      <X size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </SafeAreaView>
              <View style={styles.modalUserListContainer}>
                {filteredUsers.length > 0 ? (
                  <>
                    {!searchQuery.trim() && (
                      <View style={styles.sectionHeaderContainer}>
                        <Text style={styles.sectionHeaderText}>{t('chatList.verifiedUsers')}</Text>
                      </View>
                    )}
                    <FlatList
                      data={filteredUsers}
                      keyExtractor={(u) => u.id}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.userListContent}
                      renderItem={({ item: u }) => (
                        <TouchableOpacity style={styles.userItem} onPress={() => startDirectChat(u.id)}>
                          <Avatar uri={u.avatar} name={u.fullName} size="medium" />
                          <View style={styles.userInfo}>
                            <View style={styles.userNameRow}>
                              <Text style={styles.userName}>{u.fullName}</Text>
                              {u.isVerified && (
                                <View style={styles.verifiedBadgeInline}>
                                  <Text style={styles.verifiedText}>✓</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.userHandle}>@{u.username}</Text>
                          </View>
                          <ChevronRight size={20} color={Colors.text.muted} />
                        </TouchableOpacity>
                      )}
                    />
                  </>
                ) : searchQuery.trim() ? (
                  <View style={styles.searchEmptyState}>
                    <View style={styles.emptyIconCircle}>
                      <Search size={32} color={Colors.text.muted} />
                    </View>
                    <Text style={styles.emptyTitle}>{t('chatList.noPlayerFound', { query: searchQuery })}</Text>
                    <Text style={styles.emptyHint}>{t('chatList.tryDifferentSearch')}</Text>
                  </View>
                ) : (
                  <View style={styles.searchEmptyState}>
                    <View style={styles.emptyIconCircle}>
                      <UserPlus size={32} color={Colors.primary.blue} />
                    </View>
                    <Text style={styles.emptyTitle}>{t('chatList.startNewChat')}</Text>
                    <Text style={styles.emptyHint}>{t('chatList.searchHint')}</Text>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  headerInfo: { flex: 1, paddingRight: 12 },
  headerTitle: { color: Colors.text.primary, fontSize: 32, fontWeight: '800' as const, letterSpacing: 0.2 },
  headerSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', position: 'relative' as const, borderWidth: 1, borderColor: Colors.border.light, marginTop: 4 },
  requestBadge: { position: 'absolute' as const, top: -2, right: -2, backgroundColor: Colors.primary.orange, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.background.dark },
  requestBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  conversationsSection: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.secondary, fontSize: 13, fontWeight: '700' as const, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, padding: 15, borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.light },
  chatIconContainer: { marginRight: 12 },
  iconWrapper: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(21, 101, 192, 0.14)', alignItems: 'center', justifyContent: 'center' },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { flex: 1, color: Colors.text.primary, fontSize: 16, fontWeight: '700' as const, marginRight: 8 },
  chatTime: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  chatPreview: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20 },
  chatPreviewEmpty: { color: Colors.text.muted, fontSize: 13, fontStyle: 'italic' as const },
  unreadBadge: { backgroundColor: Colors.primary.orange, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
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
  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.cardLight, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border.light },
  searchIcon: { marginRight: 10, opacity: 0.85 },
  conversationSearchInput: { flex: 1, color: Colors.text.primary, fontSize: 16, paddingVertical: 12 },
  searchClear: { padding: 4 },
  emptySearch: { alignItems: 'center', paddingVertical: 48 },
  emptySearchText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 12, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalKeyboardContainer: { width: '100%' },
  modalSearchOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', paddingTop: 60 },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalSearchWrapper: { flex: 1, backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalSearchSafe: { backgroundColor: Colors.background.dark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  modalSearchHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalSearchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background.card, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border.light, gap: 12 },
  modalSearchInput: { flex: 1, color: Colors.text.primary, fontSize: 16, paddingVertical: 2 },
  modalUserListContainer: { flex: 1, minHeight: 200 },
  userListContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
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
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 14 },
  userInfo: { flex: 1 },
  userName: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  userHandle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
  noResults: { color: Colors.text.muted, fontSize: 15, textAlign: 'center' as const, marginTop: 16 },
  searchHint: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 12, lineHeight: 20 },
  requestsSection: { marginBottom: 24 },
  requestCard: { marginBottom: 12, borderWidth: 1, borderColor: Colors.border.light, backgroundColor: Colors.background.cardLight },
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
  modalSubtitle: { color: Colors.text.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  sectionHeaderContainer: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.background.cardLight, marginBottom: 4 },
  sectionHeaderText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedBadgeInline: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary.blue, alignItems: 'center', justifyContent: 'center' },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyHint: { color: Colors.text.muted, fontSize: 14, textAlign: 'center' as const, marginTop: 8, lineHeight: 20 },
});
