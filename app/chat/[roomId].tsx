import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Pressable, Alert, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, Search, Bell, BellOff, Share2, Users, X, Check, CheckCheck } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { useUsers } from '@/contexts/UsersContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Avatar } from '@/components/Avatar';

export default function ChatRoomScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const { chatRooms, getRoomMessages, sendMessage, markAsRead, removeParticipant, deleteMessage, isSending } = useChat();
  const { users, getUserById } = useUsers();
  const { getTeamById } = useTeams();
  const [messageText, setMessageText] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState<Map<string, any>>(new Map());
  const scrollViewRef = useRef<ScrollView>(null);

  // Build users map with loaded users
  const usersById = useMemo(() => {
    const map = new Map();
    (users ?? []).forEach((u) => map.set(u.id, u));
    loadedUsers.forEach((u, id) => {
      if (!map.has(id)) {
        map.set(id, u);
      }
    });
    return map;
  }, [users, loadedUsers]);

  const room = chatRooms.find(r => r.id === roomId);
  const team = room?.teamId ? getTeamById(room.teamId) : null;
  const isTeamMember = team ? team.members.some(m => m.userId === user?.id) : true;
  const isDirectChat = room?.type === 'direct';
  const canAccessChat = isDirectChat || !team || isTeamMember;
  
  const allMessages = getRoomMessages(roomId || '');

  // Load missing users for messages
  useEffect(() => {
    const loadMissingUsers = async () => {
      const senderIds = new Set<string>();
      allMessages.forEach(msg => senderIds.add(msg.senderId));
      if (room) {
        room.participants.forEach(id => senderIds.add(id));
      }

      const newLoadedUsers = new Map(loadedUsers);
      let hasNewUsers = false;

      for (const senderId of senderIds) {
        if (!usersById.has(senderId) && !newLoadedUsers.has(senderId)) {
          try {
            const userData = await getUserById(senderId);
            if (userData) {
              newLoadedUsers.set(senderId, userData);
              hasNewUsers = true;
            }
          } catch (e) {
            console.log('[ChatRoom] Failed to load user:', senderId);
          }
        }
      }

      if (hasNewUsers) {
        setLoadedUsers(newLoadedUsers);
      }
    };

    loadMissingUsers();
  }, [allMessages, room?.participants, getUserById]);

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return 'Vous';
    if (senderId === 'system') return 'Système';
    const sender = usersById.get(senderId);
    return sender?.fullName || sender?.username || 'Utilisateur';
  };

  const messages = useMemo(() => {
    if (!roomSearchQuery.trim()) return allMessages;
    const q = roomSearchQuery.toLowerCase().trim();
    return allMessages.filter(m => m.type === 'text' && m.content.toLowerCase().includes(q));
  }, [allMessages, roomSearchQuery]);

  useEffect(() => {
    if (room && user) {
      markAsRead({ roomId: room.id, userId: user.id });
    }
  }, [room?.id, user?.id]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || !user || !roomId) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      await sendMessage({ roomId, senderId: user.id, content: text });
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.log('[Chat] Send error:', error);
    }
  };

  const sendImageMessage = async (uri: string) => {
    if (!user || !roomId) return;
    try {
      await sendMessage({ roomId, senderId: user.id, content: uri, type: 'image' });
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.log('[Chat] Send image error:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image.');
    }
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour envoyer une photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await sendImageMessage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour prendre une photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await sendImageMessage(result.assets[0].uri);
    }
  };

  const handleAttach = () => {
    Alert.alert('Envoyer une image', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Photo de la galerie', onPress: pickImageFromLibrary },
      { text: 'Prendre une photo', onPress: takePhoto },
    ]);
  };

  const participantNames = room
    ? room.participants.map((id) => {
        if (id === user?.id) return 'Vous';
        const participant = usersById.get(id);
        return participant?.fullName || participant?.username || id;
      }).join(', ')
    : '';

  const handleSearchPress = () => {
    setShowSearchBar((v) => !v);
    if (showSearchBar) setRoomSearchQuery('');
  };

  const handleNotifications = () => {
    setIsMuted((m) => !m);
    Alert.alert(
      isMuted ? 'Notifications activées' : 'Notifications désactivées',
      isMuted
        ? 'Vous recevrez à nouveau les alertes pour les nouveaux messages de ce groupe.'
        : 'Vous ne serez plus notifié des nouveaux messages de ce groupe. Vous pouvez réactiver à tout moment.',
      [{ text: 'OK' }]
    );
  };

  const handleShare = async () => {
    if (!room) return;
    try {
      await Share.share({
        message: `Rejoins la discussion « ${room.name} » sur VS Sport !`,
        title: `Invitation : ${room.name}`,
      });
    } catch (_) {}
  };

  const handleMore = () => {
    if (!room || !user) return;
    Alert.alert(room.name, undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Infos du groupe',
        onPress: () =>
          Alert.alert(room.name, `Type: ${room.type}\n\nMembres (${room.participants.length}) :\n${participantNames}`, [{ text: 'OK' }]),
      },
      { text: 'Partager l\'invitation', onPress: handleShare },
      {
        text: isMuted ? 'Activer les notifications' : 'Désactiver les notifications',
        onPress: handleNotifications,
      },
      {
        text: 'Quitter la discussion',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Quitter la discussion',
            'Vous ne recevrez plus les messages de ce groupe. Vous pourrez être réinvité par un membre.',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Quitter',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await removeParticipant({ roomId: room.id, userId: user.id });
                  } catch (_) {}
                  safeBack(router, '/(tabs)/chat');
                },
              },
            ]
          ),
      },
    ]);
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const otherParticipant = room?.type === 'direct' ? room.participants.find(id => id !== user?.id) : null;
  const otherUser = otherParticipant ? usersById.get(otherParticipant) : null;

  if (!room) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Discussion non trouvée</Text>
            <TouchableOpacity onPress={() => safeBack(router, '/(tabs)/chat')}>
              <Text style={styles.errorLink}>Retour</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!canAccessChat) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/chat')}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Accès restreint</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.errorContainer}>
            <Users size={64} color={Colors.text.muted} />
            <Text style={styles.errorTitle}>Discussion réservée aux membres</Text>
            <Text style={styles.errorText}>
              Seuls les membres de l'équipe peuvent accéder aux discussions. Les fans peuvent suivre l'équipe mais ne peuvent pas participer aux conversations.
            </Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router, '/(tabs)/chat')}>
              <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  let lastDateLabel = '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* ════ FIXED HEADER ════ */}
          <View style={styles.headerBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/chat')} hitSlop={8}>
              <ArrowLeft size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              {isDirectChat && otherUser ? (
                <View style={styles.headerAvatarRow}>
                  <Avatar uri={otherUser.avatar} name={otherUser.fullName || otherUser.username || ''} size="small" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{otherUser.fullName || otherUser.username || 'Utilisateur'}</Text>
                    <Text style={styles.headerSubtitle}>{room.participants.length} membres</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.headerTitle} numberOfLines={1}>{room.name}</Text>
                  <Text style={styles.headerSubtitle}>{room.participants.length} membres</Text>
                </>
              )}
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.headerIconBtn} onPress={handleSearchPress} hitSlop={6}>
                <Search size={18} color={roomSearchQuery.trim() ? Colors.primary.blue : Colors.text.secondary} />
              </Pressable>
              <Pressable style={styles.headerIconBtn} onPress={handleNotifications} hitSlop={6}>
                {isMuted ? <BellOff size={18} color={Colors.text.muted} /> : <Bell size={18} color={Colors.text.secondary} />}
              </Pressable>
              <Pressable style={styles.headerIconBtn} onPress={handleMore} hitSlop={6}>
                <MoreVertical size={18} color={Colors.text.secondary} />
              </Pressable>
            </View>
          </View>

          {/* Search bar (conditional, below header) */}
          {showSearchBar && (
            <View style={styles.roomSearchBar}>
              <Search size={16} color={Colors.text.muted} />
              <TextInput
                style={styles.roomSearchInput}
                placeholder="Rechercher dans les messages..."
                placeholderTextColor={Colors.text.muted}
                value={roomSearchQuery}
                onChangeText={setRoomSearchQuery}
                autoFocus
              />
              <Pressable onPress={() => { setRoomSearchQuery(''); setShowSearchBar(false); }} hitSlop={8}>
                <X size={16} color={Colors.text.muted} />
              </Pressable>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {roomSearchQuery.trim() && messages.length === 0 ? (
                <View style={styles.searchNoResults}>
                  <Search size={32} color={Colors.text.muted} />
                  <Text style={styles.searchNoResultsText}>Aucun message ne contient « {roomSearchQuery} »</Text>
                </View>
              ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.senderId === user?.id;
                const canDelete = isOwnMessage && message.senderId !== 'system' && user?.id;
                const dateLabel = formatDate(message.createdAt);
                const showDateLabel = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;

                const prevMessage = index > 0 ? messages[index - 1] : null;
                const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
                const isGrouped = prevMessage && prevMessage.senderId === message.senderId &&
                  (new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()) / 60000 < 5;
                const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId ||
                  (new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime()) / 60000 > 5;

                const bubble = (
                  <View style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownMessage : styles.otherMessage,
                    isGrouped && (isOwnMessage ? styles.ownMessageGrouped : styles.otherMessageGrouped),
                    isLastInGroup && (isOwnMessage ? styles.ownMessageLast : styles.otherMessageLast),
                  ]}>
                    {!isOwnMessage && !isGrouped && (
                      <Text style={styles.senderName}>{getSenderName(message.senderId)}</Text>
                    )}
                    {message.type === 'image' && (message.content.startsWith('http') || message.content.startsWith('file') || message.content.startsWith('content')) ? (
                      <Image
                        source={{ uri: message.content }}
                        style={styles.messageImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={[
                        styles.messageText,
                        isOwnMessage && styles.ownMessageText
                      ]}
                        textBreakStrategy="simple"
                        android_hyphenationFrequency="none"
                      >
                        {message.content}
                      </Text>
                    )}
                    {isLastInGroup && (
                      <Text style={[styles.bubbleTime, isOwnMessage && styles.ownBubbleTime]}>
                        {formatTime(message.createdAt)}
                      </Text>
                    )}
                  </View>
                );

                return (
                  <View key={message.id}>
                    {showDateLabel && (
                      <View style={styles.dateLabel}>
                        <Text style={styles.dateLabelText}>{dateLabel}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.messageWrapper,
                      isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
                      isGrouped && styles.groupedMessage,
                    ]}>
                      {!isOwnMessage && (
                        <View style={styles.avatarSlot}>
                          {!isLastInGroup ? null : (
                            <Avatar uri={usersById.get(message.senderId)?.avatar} name={getSenderName(message.senderId)} size="small" />
                          )}
                        </View>
                      )}
                      {canDelete ? (
                        <Pressable
                          onLongPress={() =>
                            Alert.alert('Supprimer ce message ?', undefined, [
                              { text: 'Annuler', style: 'cancel' },
                              {
                                text: 'Supprimer',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await deleteMessage({ messageId: message.id, userId: user!.id });
                                  } catch (e: any) {
                                    Alert.alert('Erreur', e?.message ?? 'Impossible de supprimer le message.');
                                  }
                                },
                              },
                            ])
                          }
                        >
                          {bubble}
                        </Pressable>
                      ) : (
                        bubble
                      )}
                    </View>
                  </View>
                );
              })
              )}
            </ScrollView>

            {/* ════ INPUT BAR ════ */}
            <View style={styles.inputBar}>
              <Pressable style={styles.attachButton} onPress={handleAttach} hitSlop={8}>
                <ImageIcon size={22} color={Colors.text.muted} />
              </Pressable>
              <View style={styles.inputWrap}>
                <TextInput
                  testID="chat-input"
                  style={styles.textInput}
                  placeholder="Écrire un message..."
                  placeholderTextColor={Colors.text.muted}
                  value={messageText}
                  onChangeText={setMessageText}
                  onSubmitEditing={() => messageText.trim() && handleSend()}
                  multiline
                  maxLength={1000}
                  blurOnSubmit={false}
                />
              </View>
              <Pressable
                testID="btn-send-message"
                style={({ pressed }) => [styles.sendButton, !messageText.trim() && styles.sendButtonDisabled, pressed && styles.sendButtonPressed]}
                onPress={handleSend}
                disabled={!messageText.trim() || isSending}
                hitSlop={8}
              >
                <Send size={18} color={messageText.trim() ? '#FFFFFF' : Colors.text.muted} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // ════ HEADER BAR (fixed) ════
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light + '40',
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, marginHorizontal: 8, minWidth: 0 },
  headerAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },

  // ════ SEARCH BAR ════
  roomSearchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginVertical: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.background.card,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border.light + '60',
    gap: 8,
  },
  roomSearchInput: {
    flex: 1, color: Colors.text.primary, fontSize: 14, paddingVertical: 2,
  },

  // ════ MESSAGES ════
  keyboardView: { flex: 1 },
  messagesContainer: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 12 },

  dateLabel: { alignItems: 'center', marginVertical: 12 },
  dateLabelText: {
    color: Colors.text.muted, fontSize: 11, fontWeight: '600',
    backgroundColor: Colors.background.card + '80',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
    overflow: 'hidden',
  },

  messageWrapper: { flexDirection: 'row', marginBottom: 2, gap: 8 },
  groupedMessage: { marginBottom: 1 },
  ownMessageWrapper: { justifyContent: 'flex-end' },
  otherMessageWrapper: { justifyContent: 'flex-start' },

  avatarSlot: { width: 32, height: 32, justifyContent: 'flex-end' },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 18,
  },
  ownMessage: {
    backgroundColor: Colors.primary.blue,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: Colors.background.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border.light + '30',
  },
  ownMessageGrouped: { borderBottomRightRadius: 18 },
  otherMessageGrouped: { borderBottomLeftRadius: 18 },
  ownMessageLast: { borderBottomRightRadius: 4 },
  otherMessageLast: { borderBottomLeftRadius: 4 },

  senderName: {
    color: Colors.primary.orange, fontSize: 11, fontWeight: '700',
    marginBottom: 3,
  },
  messageText: { color: Colors.text.primary, fontSize: 14, lineHeight: 19 },
  ownMessageText: { color: '#FFFFFF' },
  messageImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },

  bubbleTime: {
    color: Colors.text.muted, fontSize: 10,
    marginTop: 4, alignSelf: 'flex-end',
  },
  ownBubbleTime: { color: 'rgba(255,255,255,0.6)' },

  // ════ SEARCH NO RESULTS ════
  searchNoResults: { alignItems: 'center', paddingVertical: 32 },
  searchNoResultsText: {
    color: Colors.text.muted, fontSize: 14,
    marginTop: 12, textAlign: 'center',
  },

  // ════ ERROR / ACCESS ════
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  errorTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 12, textAlign: 'center' },
  errorText: { color: Colors.text.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  errorLink: { color: Colors.primary.blue, fontSize: 14 },
  backBtn: {
    marginTop: 24, backgroundColor: Colors.primary.blue,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  placeholder: { width: 40 },

  // ════ INPUT BAR ════
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 8, paddingBottom: 16,
    backgroundColor: Colors.background.card,
    borderTopWidth: 1, borderTopColor: Colors.border.light + '40',
    gap: 8,
  },
  attachButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center', justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 2,
    minHeight: 38,
    justifyContent: 'center',
  },
  textInput: {
    color: Colors.text.primary, fontSize: 14,
    maxHeight: 100, paddingVertical: 8,
  },
  sendButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: Colors.background.cardLight },
  sendButtonPressed: { opacity: 0.8 },
});