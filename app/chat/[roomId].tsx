import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, TouchableOpacity, 
  TextInput, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';

export default function ChatRoomScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const { chatRooms, getRoomMessages, sendMessage, markAsRead, isSending } = useChat();
  const { getUserById } = useUsers();
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return 'Vous';
    if (senderId === 'system') return 'Système';
    const sender = getUserById(senderId);
    return sender?.username || sender?.fullName || 'Utilisateur';
  };

  const room = chatRooms.find(r => r.id === roomId);
  const messages = getRoomMessages(roomId || '');

  useEffect(() => {
    if (room && user) {
      markAsRead({ roomId: room.id, userId: user.id });
    }
  }, [room, user]);

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

  if (!room) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Discussion non trouvée</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.errorLink}>Retour</Text>
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
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>{room.name}</Text>
              <Text style={styles.headerSubtitle}>
                {room.participants.length} membres
              </Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <MoreVertical size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message, index) => {
                const isOwnMessage = message.senderId === user?.id;
                const dateLabel = formatDate(message.createdAt);
                const showDateLabel = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;

                return (
                  <View key={message.id}>
                    {showDateLabel && (
                      <View style={styles.dateLabel}>
                        <Text style={styles.dateLabelText}>{dateLabel}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.messageWrapper,
                      isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper
                    ]}>
                      {!isOwnMessage && (
                        <Avatar uri={getUserById(message.senderId)?.avatar} name={getSenderName(message.senderId)} size="small" />
                      )}
                      <View style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.ownMessage : styles.otherMessage
                      ]}>
                        {!isOwnMessage && (
                          <Text style={styles.senderName}>{getSenderName(message.senderId)}</Text>
                        )}
                        <Text style={[
                          styles.messageText,
                          isOwnMessage && styles.ownMessageText
                        ]}>
                          {message.content}
                        </Text>
                        <Text style={[
                          styles.messageTime,
                          isOwnMessage && styles.ownMessageTime
                        ]}>
                          {formatTime(message.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.attachButton}>
                <ImageIcon size={22} color={Colors.text.muted} />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Écrire un message..."
                placeholderTextColor={Colors.text.muted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!messageText.trim() || isSending}
              >
                <Send size={20} color={messageText.trim() ? '#FFFFFF' : Colors.text.muted} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  headerSubtitle: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    color: Colors.text.primary,
    fontSize: 16,
  },
  errorLink: {
    color: Colors.primary.blue,
    fontSize: 14,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateLabel: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLabelText: {
    color: Colors.text.muted,
    fontSize: 12,
    backgroundColor: Colors.background.card,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  ownMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: Colors.primary.blue,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: Colors.background.card,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  messageText: {
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    color: Colors.text.muted,
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 24,
    backgroundColor: Colors.background.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.background.cardLight,
  },
});