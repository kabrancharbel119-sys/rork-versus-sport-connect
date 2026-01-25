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

const NOTIFICATIONS_STORAGE_KEY = 'vs_notifications';

const generateInitialNotifications = (): Notification[] => {
  const now = Date.now();
  return [
    { id: 'notif-welcome', userId: 'all', type: 'system', title: 'Bienvenue sur VS !', message: 'Découvrez les fonctionnalités de l\'app et rejoignez une équipe pour commencer à jouer.', isRead: false, createdAt: new Date(now - 1000), data: { route: '/(tabs)/(teams)' } },
    { id: 'notif-tournament', userId: 'all', type: 'tournament', title: '🏆 Tournoi ouvert', message: 'La Coupe de Cocody 2026 est ouverte aux inscriptions ! Inscrivez votre équipe maintenant.', isRead: false, createdAt: new Date(now - 3600000), data: { route: '/(tabs)/(matches)' } },
    { id: 'notif-match', userId: 'all', type: 'match', title: '⚽ Match à venir', message: 'Un match Football 5v5 cherche des joueurs près de chez vous. Places limitées !', isRead: false, createdAt: new Date(now - 7200000), data: { route: '/(tabs)/(matches)' } },
    { id: 'notif-team', userId: 'all', type: 'team', title: '👥 Équipe qui recrute', message: 'FC Cocody recherche de nouveaux joueurs. Rejoignez une équipe compétitive !', isRead: true, createdAt: new Date(now - 86400000), data: { route: '/team/team-1' } },
    { id: 'notif-tip', userId: 'all', type: 'system', title: '💡 Conseil', message: 'Complétez votre profil pour améliorer vos chances d\'être accepté dans une équipe.', isRead: true, createdAt: new Date(now - 172800000), data: { route: '/edit-profile' } },
  ];
};

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const notificationListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
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
      console.log('[Notifications] Received push notification:', notification.request.content.title);
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
      setNotifications(prev => [newNotif, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    responseListenerRef.current = addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] User tapped notification:', response.notification.request.content.title);
      const data = response.notification.request.content.data;
      if (data?.route) {
        console.log('[Notifications] Navigate to:', data.route);
      }
    });

    return () => {
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [queryClient]);

  useRealtime('notification', (event) => {
    if (event.action === 'create') {
      console.log('[Notifications] Realtime notification received');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', currentUserId],
    queryFn: async () => {
      console.log('[Notifications] Loading notifications...');
      
      if (currentUserId) {
        try {
          const serverNotifications = await notificationsApi.getAll(currentUserId);
          if (serverNotifications.length > 0) {
            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(serverNotifications));
            return serverNotifications;
          }
        } catch (e) {
          console.log('[Notifications] Server fetch failed, using local storage');
        }
      }

      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[];
        return parsed.map(n => ({ ...n, createdAt: new Date(n.createdAt) }));
      }
      const initial = generateInitialNotifications();
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    },
    refetchInterval: isPollingActive ? 10000 : false,
  });

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(notificationsQuery.data);
      const unreadCount = notificationsQuery.data.filter(n => !n.isRead).length;
      setBadgeCount(unreadCount).catch(() => {});
    }
  }, [notificationsQuery.data]);

  const saveNotifications = useCallback(async (updated: Notification[]) => {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
    const unreadCount = updated.filter(n => !n.isRead).length;
    setBadgeCount(unreadCount).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const addNotificationMutation = useMutation({
    mutationFn: async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'> & { sendPush?: boolean }) => {
      console.log('[Notifications] Adding notification:', notification.title);
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
      console.log('[Notifications] Marking as read:', notificationId);
      
      if (currentUserId) {
        try {
          await notificationsApi.markAsRead(notificationId, currentUserId);
        } catch (e) {
          console.log('[Notifications] Supabase markAsRead failed');
        }
      }
      
      await saveNotifications(notifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      console.log('[Notifications] Marking all as read');
      
      if (currentUserId) {
        try {
          await notificationsApi.markAllAsRead(currentUserId);
        } catch (e) {
          console.log('[Notifications] Supabase markAllAsRead failed');
        }
      }
      
      await saveNotifications(notifications.map(n => ({ ...n, isRead: true })));
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      console.log('[Notifications] Deleting notification:', notificationId);
      
      if (currentUserId) {
        try {
          await notificationsApi.delete(notificationId, currentUserId);
        } catch (e) {
          console.log('[Notifications] Supabase delete failed');
        }
      }
      
      await saveNotifications(notifications.filter(n => n.id !== notificationId));
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      console.log('[Notifications] Clearing all notifications');
      
      if (currentUserId) {
        try {
          await notificationsApi.deleteAll(currentUserId);
        } catch (e) {
          console.log('[Notifications] Supabase deleteAll failed');
        }
      }
      
      await saveNotifications([]);
    },
  });

  const { mutateAsync: addNotificationAsync } = addNotificationMutation;

  const notifyTeamRequest = useCallback(async (teamName: string, action: 'sent' | 'accepted' | 'rejected', teamId?: string) => {
    const messages = {
      sent: { title: '📤 Demande envoyée', message: `Votre demande pour rejoindre ${teamName} a été envoyée.` },
      accepted: { title: '✅ Demande acceptée', message: `Félicitations ! Vous avez rejoint ${teamName}.` },
      rejected: { title: '❌ Demande refusée', message: `Votre demande pour ${teamName} a été refusée.` },
    };
    await addNotificationAsync({ userId: 'all', type: 'team', ...messages[action], data: teamId ? { route: `/team/${teamId}` } : undefined });
  }, [addNotificationAsync]);

  const notifyMatchUpdate = useCallback(async (matchId: string, action: 'joined' | 'left' | 'reminder' | 'cancelled', matchName?: string) => {
    const messages = {
      joined: { title: '✅ Inscription confirmée', message: `Vous êtes inscrit au match${matchName ? ` ${matchName}` : ''}.` },
      left: { title: '👋 Désinscription', message: `Vous vous êtes désinscrit du match${matchName ? ` ${matchName}` : ''}.` },
      reminder: { title: '⏰ Rappel match', message: `Votre match${matchName ? ` ${matchName}` : ''} commence bientôt !` },
      cancelled: { title: '🚫 Match annulé', message: `Le match${matchName ? ` ${matchName}` : ''} a été annulé.` },
    };
    await addNotificationAsync({ userId: 'all', type: 'match', ...messages[action], data: { route: `/match/${matchId}` } });
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

  return {
    notifications,
    isLoading: notificationsQuery.isLoading,
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
