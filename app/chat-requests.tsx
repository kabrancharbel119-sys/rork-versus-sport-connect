import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserPlus, UserCheck, UserX, MessageCircle, Clock, CheckCircle, XCircle, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

export default function ChatRequestsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const { users, getUserById } = useUsers();
  const { getPendingChatRequests, getSentChatRequests, respondToChatRequest, chatRequests } = useChat();
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadedUsers, setLoadedUsers] = useState<Map<string, any>>(new Map());

  const pendingRequests = getPendingChatRequests();
  const sentRequests = getSentChatRequests();

  // Load missing users when requests change
  React.useEffect(() => {
    const loadMissingUsers = async () => {
      const allRequests = [...pendingRequests, ...sentRequests];
      const userIds = new Set<string>();
      
      allRequests.forEach(req => {
        userIds.add(req.requesterId);
        userIds.add(req.recipientId);
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
            console.log('[ChatRequests] Failed to load user:', userId);
          }
        }
      }

      if (hasNewUsers) {
        setLoadedUsers(newLoadedUsers);
      }
    };

    loadMissingUsers();
  }, [pendingRequests, sentRequests, getUserById]);

  const usersById = React.useMemo(() => {
    const map = new Map();
    (users ?? []).forEach((u) => map.set(u.id, u));
    // Merge with loaded users
    loadedUsers.forEach((u, id) => {
      if (!map.has(id)) {
        map.set(id, u);
      }
    });
    return map;
  }, [users, loadedUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh via context
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleAccept = async (requestId: string, requesterId: string) => {
    setProcessingId(requestId);
    try {
      const result = await respondToChatRequest({ requestId, action: 'accept' }) as any;
      const roomId = result?.roomId;
      
      Alert.alert(
        t('chatRequests.requestAccepted'),
        t('chatRequests.conversationStarted'),
        [
          {
            text: t('chatRequests.openChat'),
            onPress: () => {
              if (roomId) {
                router.push(`/chat/${roomId}`);
              }
            }
          },
          { text: t('common.ok'), style: 'cancel' }
        ]
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('chatRequests.acceptError'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await respondToChatRequest({ requestId, action: 'reject' });
      Alert.alert(t('common.success'), t('chatRequests.requestRejected'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('chatRequests.rejectError'));
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('chatRequests.justNow');
    if (minutes < 60) return t('chatRequests.minutesAgo', { count: minutes });
    if (hours < 24) return t('chatRequests.hoursAgo', { count: hours });
    if (days < 7) return t('chatRequests.daysAgo', { count: days });
    return new Date(date).toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('chatRequests.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary.orange}
            />
          }
        >
          {/* Received Requests Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserPlus size={20} color={Colors.primary.blue} />
              <Text style={styles.sectionTitle}>
                {t('chatRequests.receivedRequests')} ({pendingRequests.length})
              </Text>
            </View>

            {pendingRequests.length === 0 ? (
              <Card style={styles.emptyCard}>
                <MessageCircle size={48} color={Colors.text.muted} />
                <Text style={styles.emptyText}>{t('chatRequests.noReceivedRequests')}</Text>
                <Text style={styles.emptySubtext}>{t('chatRequests.noReceivedRequestsHint')}</Text>
              </Card>
            ) : (
              pendingRequests.map((request) => {
                const requester = usersById.get(request.requesterId);
                const isProcessing = processingId === request.id;

                return (
                  <Card key={request.id} style={styles.requestCard}>
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.05)', 'transparent']}
                      style={styles.requestGradient}
                    />
                    
                    <View style={styles.requestHeader}>
                      <Avatar
                        uri={requester?.avatar}
                        name={requester?.fullName || requester?.username || '?'}
                        size="medium"
                      />
                      <View style={styles.requestInfo}>
                        <Text style={styles.requesterName}>
                          {requester?.fullName || requester?.username || t('chatRequests.unknownUser')}
                        </Text>
                        <Text style={styles.requestSubtitle}>
                          {t('chatRequests.wantsToChat', { user: requester?.fullName || requester?.username || t('chatRequests.unknownUser') })}
                        </Text>
                        <View style={styles.requestMeta}>
                          <Clock size={12} color={Colors.text.muted} />
                          <Text style={styles.requestTime}>{formatDate(request.createdAt)}</Text>
                        </View>
                      </View>
                    </View>

                    {request.message && (
                      <View style={styles.messageContainer}>
                        <Text style={styles.messageLabel}>{t('chatRequests.messageLabel')}:</Text>
                        <Text style={styles.messageText}>{request.message}</Text>
                      </View>
                    )}

                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleReject(request.id)}
                        disabled={isProcessing}
                      >
                        <XCircle size={18} color={Colors.status.error} />
                        <Text style={styles.rejectText}>{t('chatRequests.reject')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleAccept(request.id, request.requesterId)}
                        disabled={isProcessing}
                      >
                        <LinearGradient
                          colors={[Colors.primary.blue, '#2563EB']}
                          style={styles.acceptGradient}
                        >
                          <CheckCircle size={18} color="#FFFFFF" />
                          <Text style={styles.acceptText}>
                            {isProcessing ? t('chatRequests.accepting') : t('chatRequests.accept')}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
            )}
          </View>

          {/* Sent Requests Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Send size={20} color={Colors.primary.orange} />
              <Text style={styles.sectionTitle}>
                {t('chatRequests.sentRequests')} ({sentRequests.length})
              </Text>
            </View>

            {sentRequests.length === 0 ? (
              <Card style={styles.emptyCard}>
                <UserCheck size={48} color={Colors.text.muted} />
                <Text style={styles.emptyText}>{t('chatRequests.noSentRequests')}</Text>
                <Text style={styles.emptySubtext}>{t('chatRequests.noSentRequestsHint')}</Text>
              </Card>
            ) : (
              sentRequests.map((request) => {
                const recipient = usersById.get(request.recipientId);

                return (
                  <Card key={request.id} style={styles.sentCard}>
                    <View style={styles.sentHeader}>
                      <Avatar
                        uri={recipient?.avatar}
                        name={recipient?.fullName || recipient?.username || '?'}
                        size="small"
                      />
                      <View style={styles.sentInfo}>
                        <Text style={styles.recipientName}>
                          {recipient?.fullName || recipient?.username || t('chatRequests.unknownUser')}
                        </Text>
                        <View style={styles.sentMeta}>
                          <View style={styles.pendingBadge}>
                            <Clock size={10} color={Colors.primary.orange} />
                            <Text style={styles.pendingText}>{t('chatRequests.pending')}</Text>
                          </View>
                          <Text style={styles.sentTime}>{formatDate(request.createdAt)}</Text>
                        </View>
                      </View>
                    </View>

                    {request.message && (
                      <Text style={styles.sentMessage} numberOfLines={2}>
                        {request.message}
                      </Text>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  requestCard: {
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  requestGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
  },
  requesterName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  requestSubtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginBottom: 6,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestTime: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  messageContainer: {
    backgroundColor: Colors.background.cardLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  messageLabel: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: Colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  rejectText: {
    color: Colors.status.error,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sentCard: {
    padding: 12,
    marginBottom: 8,
  },
  sentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recipientName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  sentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    borderRadius: 8,
  },
  pendingText: {
    color: Colors.primary.orange,
    fontSize: 10,
    fontWeight: '600',
  },
  sentTime: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  sentMessage: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.text.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
