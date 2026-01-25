import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export const registerForPushNotifications = async (): Promise<string | null> => {
  console.log('[Push] Registering for push notifications...');
  
  if (Platform.OS === 'web') {
    console.log('[Push] Web platform - skipping native registration');
    return null;
  }

  

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.log('[Push] No project ID found - using local notifications only');
      return 'local-only';
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Push] Token obtained:', token.data.substring(0, 20) + '...');
    return token.data;
  } catch (error) {
    console.error('[Push] Registration error:', error);
    return null;
  }
};

export const sendLocalNotification = async (title: string, body: string, data?: Record<string, unknown>): Promise<string> => {
  console.log('[Push] Sending local notification:', title);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default' },
    trigger: null,
  });
  return id;
};

export const sendPushNotification = async (payload: PushNotificationPayload): Promise<boolean> => {
  console.log('[Push] Sending push notification to:', payload.to.substring(0, 20) + '...');
  
  if (payload.to === 'local-only' || !payload.to.startsWith('ExponentPushToken')) {
    await sendLocalNotification(payload.title, payload.body, payload.data as Record<string, unknown>);
    return true;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: payload.to,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: payload.sound ?? 'default',
        badge: payload.badge,
        channelId: payload.channelId ?? 'default',
      }),
    });

    const result = await response.json();
    console.log('[Push] Send result:', result);
    return result.data?.status === 'ok' || !result.errors;
  } catch (error) {
    console.error('[Push] Send error:', error);
    return false;
  }
};

export const sendBatchPushNotifications = async (payloads: PushNotificationPayload[]): Promise<boolean[]> => {
  console.log('[Push] Sending batch notifications:', payloads.length);
  
  const validPayloads = payloads.filter(p => p.to && p.to.startsWith('ExponentPushToken'));
  const localPayloads = payloads.filter(p => !p.to || !p.to.startsWith('ExponentPushToken'));

  const localResults = await Promise.all(
    localPayloads.map(p => sendLocalNotification(p.title, p.body, p.data as Record<string, unknown>).then(() => true).catch(() => false))
  );

  if (validPayloads.length === 0) return localResults;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayloads.map(p => ({
        to: p.to,
        title: p.title,
        body: p.body,
        data: p.data,
        sound: p.sound ?? 'default',
        channelId: p.channelId ?? 'default',
      }))),
    });

    const result = await response.json();
    const remoteResults = (result.data || []).map((r: { status: string }) => r.status === 'ok');
    return [...localResults, ...remoteResults];
  } catch (error) {
    console.error('[Push] Batch send error:', error);
    return [...localResults, ...validPayloads.map(() => false)];
  }
};

export const addNotificationReceivedListener = (callback: (notification: Notifications.Notification) => void) => {
  return Notifications.addNotificationReceivedListener(callback);
};

export const addNotificationResponseReceivedListener = (callback: (response: Notifications.NotificationResponse) => void) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

export const setBadgeCount = async (count: number): Promise<void> => {
  if (Platform.OS !== 'web') {
    await Notifications.setBadgeCountAsync(count);
  }
};

export const getBadgeCount = async (): Promise<number> => {
  if (Platform.OS === 'web') return 0;
  return await Notifications.getBadgeCountAsync();
};
