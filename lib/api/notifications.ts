import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';

export interface NotificationRow {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, string> | null;
  is_read: boolean;
  created_at: string;
}

export const mapNotificationRowToNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id || '',
  type: row.type as Notification['type'],
  title: row.title,
  message: row.message,
  data: (row.data as Record<string, string>) ?? undefined,
  isRead: row.is_read ?? false,
  createdAt: new Date(row.created_at),
});

const sendExpoPushNotification = async (token: string, title: string, body: string, data?: Record<string, string>) => {
  if (!token || !token.startsWith('ExponentPushToken')) {
    console.log('[Push] Invalid token, skipping');
    return false;
  }
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', channelId: 'default' }),
    });
    const result = await response.json();
    return result.data?.status === 'ok';
  } catch (e) {
    console.error('[Push] Send error:', e);
    return false;
  }
};

export const notificationsApi = {
  async getAll(userId: string) {
    console.log('[NotificationsAPI] Getting all notifications for:', userId);
    const { data, error } = await (supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    return ((data || []) as NotificationRow[]).map(row => mapNotificationRowToNotification(row));
  },

  async getUnread(userId: string) {
    console.log('[NotificationsAPI] Getting unread notifications for:', userId);
    const { data, error } = await (supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    return ((data || []) as NotificationRow[]).map(row => mapNotificationRowToNotification(row));
  },

  async getUnreadCount(userId: string) {
    console.log('[NotificationsAPI] Getting unread count for:', userId);
    const { count, error } = await (supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false) as any);
    
    if (error) throw error;
    return count || 0;
  },

  async markAsRead(notificationId: string, userId: string) {
    console.log('[NotificationsAPI] Marking as read:', notificationId);
    const { error } = await ((supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId));
    
    if (error) throw error;
    return { success: true };
  },

  async markAllAsRead(userId: string) {
    console.log('[NotificationsAPI] Marking all as read for:', userId);
    const { error } = await ((supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('user_id', userId));
    
    if (error) throw error;
    return { success: true };
  },

  async delete(notificationId: string, userId: string) {
    console.log('[NotificationsAPI] Deleting notification:', notificationId);
    const { error } = await (supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId) as any);
    
    if (error) throw error;
    return { success: true };
  },

  async deleteAll(userId: string) {
    console.log('[NotificationsAPI] Deleting all notifications for:', userId);
    const { error } = await (supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId) as any);
    
    if (error) throw error;
    return { success: true };
  },

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    console.log('[NotificationsAPI] Registering push token for:', userId);
    
    const { data: existing } = await (supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .single() as any);

    if (existing) {
      await ((supabase.from('push_tokens') as any)
        .update({ token, platform })
        .eq('id', existing.id));
    } else {
      await (supabase
        .from('push_tokens')
        .insert({ user_id: userId, token, platform } as any) as any);
    }

    return { success: true };
  },

  async send(targetUserId: string, notification: {
    type: 'match' | 'team' | 'tournament' | 'chat' | 'system';
    title: string;
    message: string;
    data?: Record<string, string>;
  }) {
    console.log('[NotificationsAPI] Sending notification to:', targetUserId);
    
    const { data, error } = await (supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data ?? null,
      } as any)
      .select()
      .single() as any);
    
    if (error) throw error;

    const { data: pushToken } = await (supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUserId)
      .single() as any);

    if (pushToken?.token) {
      await sendExpoPushNotification(pushToken.token, notification.title, notification.message, notification.data);
    }

    return mapNotificationRowToNotification(data as NotificationRow);
  },

  async sendToMany(userIds: string[], notification: {
    type: 'match' | 'team' | 'tournament' | 'chat' | 'system';
    title: string;
    message: string;
    data?: Record<string, string>;
  }) {
    console.log('[NotificationsAPI] Sending notification to', userIds.length, 'users');
    
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ?? null,
    }));

    const { error } = await (supabase.from('notifications').insert(notifications as any) as any);
    if (error) throw error;

    const { data: pushTokens } = await (supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds) as any);

    for (const tokenRecord of (pushTokens || []) as { token: string }[]) {
      if (tokenRecord.token) {
        await sendExpoPushNotification(tokenRecord.token, notification.title, notification.message, notification.data);
      }
    }

    return { sent: userIds.length };
  },

  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    console.log('[NotificationsAPI] Subscribing to notifications for:', userId);
    
    return supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        callback(mapNotificationRowToNotification(payload.new as NotificationRow));
      })
      .subscribe();
  },
};
