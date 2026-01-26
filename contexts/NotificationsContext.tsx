import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Notification } from '@/types';
import { sendLocalNotification, addNotificationReceivedListener, addNotificationResponseReceivedListener, setBadgeCount } from '@/lib/push-notifications';
import { emitRealtimeEvent, useRealtime } from '@/lib/realtime';
import { notificationsApi } from '@/lib/api/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const NOTIFICATIONS_STORAGE_KEY_PREFIX = 'vs_notifications';
const getNotificationsStorageKey = (userId: string | null) =>
  userId ? `${NOTIFICATIONS_STORAGE_KEY_PREFIX}_${userId}` : NOTIFICATIONS_STORAGE_KEY_PREFIX;

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const notificationListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);

  const currentUserId = supabaseUserId || authUser?.id || null;

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      setIsPollingActive(state === 'active');
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    notificationListenerRef.current = addNotificationReceivedListener((notification) => {
      if (__DEV__) console.log('[Notifications] Received push notification:', notification.request.content.title);
      const newNotif: Notification = {
        id: `notif-push-${Date.now()}`,
        userId: 'all',
        type: 'system',
        title: notification.request.content.title || 'Notification',
        message: notification.request.content.body || '',
        isRead: false,
        createdAt: new Date(),
        data: notification.request.content.data as Record<string, string> | undefined,
      };
      queryClient.setQueryData<Notification[]>(['notifications', currentUserId], (old) => {
        const list = old ?? [];
        if (list.some((n) => n.id === newNotif.id)) return list;
        return [newNotif, ...list];
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', currentUserId] });
    });

    responseListenerRef.current = addNotificationResponseReceivedListener((response) => {
      if (__DEV__) console.log('[Notifications] User tapped notification:', response.notification.request.content.title);
      const data = response.notification.request.content.data;
      if (data?.route) {
        if (__DEV__) console.log('[Notifications] Navigate to:', data.route);
      }
    });

    return () => {
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [queryClient]);

  useRealtime('notification', (event) => {
    if (event.action === 'create') {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  useEffect(() => {
    if (!currentUserId) return;
    const channel = notificationsApi.subscribeToNotifications(currentUserId, (notification) => {
      queryClient.setQueryData<Notification[]>(['notifications', currentUserId], (old) => {
        const list = old ?? [];
        if (list.some((n) => n.id === notification.id)) return list;
        return [notification, ...list];
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', currentUserId] });
    });
    return () => {
      channel.unsubscribe?.();
    };
  }, [currentUserId, queryClient]);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', currentUserId],
    queryFn: async () => {
      if (__DEV__) console.log('[Notifications] Loading notifications...');
      
      if (currentUserId) {
        try {
          const serverNotifications = await notificationsApi.getAll(currentUserId);
          const key = getNotificationsStorageKey(currentUserId);
          await AsyncStorage.setItem(key, JSON.stringify(serverNotifications));
          return serverNotifications;
        } catch (e) {
          if (__DEV__) console.warn('[Notifications] Server fetch failed, using local storage:', (e as Error)?.message ?? e);
        }
      }

      const key = getNotificationsStorageKey(currentUserId);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[];
        const withDates = parsed.map(n => ({ ...n, createdAt: new Date(n.createdAt) }));
        if (currentUserId) {
          return withDates.filter(n => n.userId === currentUserId || n.userId === 'all');
        }
        return withDates;
      }
      return [];
    },
    staleTime: 0,
    refetchInterval: isPollingActive ? 3000 : false,
  });

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(notificationsQuery.data);
      const unreadCount = notificationsQuery.data.filter(n => !n.isRead).length;
      setBadgeCount(unreadCount).catch(() => {});
    }
  }, [notificationsQuery.data]);

  const saveNotifications = useCallback(async (updated: Notification[]) => {
    const key = getNotificationsStorageKey(currentUserId);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    setNotifications(updated);
    const unreadCount = updated.filter(n => !n.isRead).length;
    setBadgeCount(unreadCount).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient, currentUserId]);

  const addNotificationMutation = useMutation({
    mutationFn: async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'> & { sendPush?: boolean }) => {
      if (__DEV__) console.log('[Notifications] Adding notification:', notification.title);
      const userId = notification.userId;
      if (userId && userId !== 'all') {
        try {
          await notificationsApi.send(userId, {
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
          });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        } catch (e) {
          if (__DEV__) console.warn('[Notifications] API send failed for user', userId, e);
        }
        return { id: `sent-${Date.now()}`, ...notification, isRead: false, createdAt: new Date() } as Notification;
      }
      const newNotif: Notification = {
        ...notification,
        id: `notif-${Date.now()}`,
        isRead: false,
        createdAt: new Date(),
      };
      await saveNotifications([newNotif, ...notifications]);
      if (notification.sendPush !== false) {
        await sendLocalNotification(notification.title, notification.message, notification.data);
      }
      emitRealtimeEvent('notification', 'create', { notification: newNotif });
      return newNotif;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (__DEV__) console.log('[Notifications] Marking as read:', notificationId);
      
      if (currentUserId) {
        try {
          await notificationsApi.markAsRead(notificationId, currentUserId);
        } catch (e) {
          if (__DEV__) console.log('[Notifications] Supabase markAsRead failed');
        }
      }
      
      await saveNotifications(notifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (__DEV__) console.log('[Notifications] Marking all as read');
      
      if (currentUserId) {
        try {
          await notificationsApi.markAllAsRead(currentUserId);
        } catch (e) {
          if (__DEV__) console.log('[Notifications] Supabase markAllAsRead failed');
        }
      }
      
      await saveNotifications(notifications.map(n => ({ ...n, isRead: true })));
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (__DEV__) console.log('[Notifications] Deleting notification:', notificationId);
      
      if (currentUserId) {
        try {
          await notificationsApi.delete(notificationId, currentUserId);
        } catch (e) {
          if (__DEV__) console.log('[Notifications] Supabase delete failed');
        }
      }
      
      await saveNotifications(notifications.filter(n => n.id !== notificationId));
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (__DEV__) console.log('[Notifications] Clearing all notifications');
      
      if (currentUserId) {
        try {
          await notificationsApi.deleteAll(currentUserId);
        } catch (e) {
          if (__DEV__) console.log('[Notifications] Supabase deleteAll failed');
        }
      }
      
      await saveNotifications([]);
    },
  });

  const { mutateAsync: addNotificationAsync } = addNotificationMutation;

  const notifyTeamRequest = useCallback(async (teamName: string, action: 'sent' | 'accepted' | 'rejected', teamId?: string, targetUserId?: string) => {
    const messages = {
      sent: { title: '📤 Demande envoyée', message: `Votre demande pour rejoindre ${teamName} a été envoyée.` },
      accepted: { title: '✅ Demande acceptée', message: `Félicitations ! Vous avez rejoint ${teamName}.` },
      rejected: { title: '❌ Demande refusée', message: `Le capitaine de l'équipe ${teamName} a refusé la demande.` },
    };
    const userId = targetUserId ?? 'all';
    await addNotificationAsync({ userId, type: 'team', ...messages[action], data: teamId ? { route: `/team/${teamId}` } : undefined });
  }, [addNotificationAsync]);

  const notifyMatchUpdate = useCallback(async (matchId: string, action: 'joined' | 'left' | 'reminder' | 'cancelled', matchName?: string, targetUserId?: string | string[]) => {
    const messages = {
      joined: { title: '✅ Inscription confirmée', message: `Vous êtes inscrit au match${matchName ? ` ${matchName}` : ''}.` },
      left: { title: '👋 Désinscription', message: `Vous vous êtes désinscrit du match${matchName ? ` ${matchName}` : ''}.` },
      reminder: { title: '⏰ Rappel match', message: `Votre match${matchName ? ` ${matchName}` : ''} commence bientôt !` },
      cancelled: { title: '🚫 Match annulé', message: `Le match${matchName ? ` ${matchName}` : ''} a été annulé.` },
    };
    const payload = { type: 'match' as const, ...messages[action], data: { route: `/match/${matchId}` } };
    if (targetUserId === undefined || targetUserId === null) {
      await addNotificationAsync({ userId: 'all', ...payload });
    } else if (Array.isArray(targetUserId)) {
      for (const uid of targetUserId) {
        if (uid) await addNotificationAsync({ userId: uid, ...payload });
      }
    } else {
      await addNotificationAsync({ userId: targetUserId, ...payload });
    }
  }, [addNotificationAsync]);

  const notifyTrophyUnlocked = useCallback(async (trophyName: string, xpReward: number) => {
    await addNotificationAsync({
      userId: 'all',
      type: 'system',
      title: '🏆 Trophée débloqué !',
      message: `Vous avez débloqué "${trophyName}" et gagné ${xpReward} XP !`,
      data: { route: '/trophies' },
    });
  }, [addNotificationAsync]);

  const notifyNewMessage = useCallback(async (senderName: string, roomName: string) => {
    await addNotificationAsync({
      userId: 'all',
      type: 'chat',
      title: '💬 Nouveau message',
      message: `${senderName} a envoyé un message dans ${roomName}`,
      data: { route: '/(tabs)/(chat)' },
    });
  }, [addNotificationAsync]);

  const getUnreadCount = useCallback(() => notifications.filter(n => !n.isRead).length, [notifications]);
  const getUserNotifications = useCallback((userId: string) => notifications.filter(n => n.userId === userId || n.userId === 'all'), [notifications]);
  const refetchNotifications = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  return {
    notifications,
    isLoading: notificationsQuery.isLoading,
    refetchNotifications,
    isPollingActive,
    addNotification: addNotificationMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    deleteNotification: deleteNotificationMutation.mutateAsync,
    clearAll: clearAllMutation.mutateAsync,
    notifyTeamRequest,
    notifyMatchUpdate,
    notifyTrophyUnlocked,
    notifyNewMessage,
    getUnreadCount,
    getUserNotifications,
  };
});
