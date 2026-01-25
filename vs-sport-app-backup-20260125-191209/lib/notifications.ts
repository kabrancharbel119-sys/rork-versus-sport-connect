import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'vs_push_token';
const NOTIFICATIONS_ENABLED_KEY = 'vs_notifications_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform, skipping push registration');
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
      console.log('[Notifications] Permission not granted');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('[Notifications] Push token:', token);
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#FF6B35' });
    }
    return token;
  } catch (e) { console.log('[Notifications] Error registering:', e); return null; }
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, any>, trigger?: Notifications.NotificationTriggerInput) {
  try {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (enabled === 'false') return null;
    const id = await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: true }, trigger: trigger || null });
    console.log('[Notifications] Scheduled:', id);
    return id;
  } catch (e) { console.log('[Notifications] Error scheduling:', e); return null; }
}

export async function cancelNotification(id: string) { await Notifications.cancelScheduledNotificationAsync(id); }
export async function cancelAllNotifications() { await Notifications.cancelAllScheduledNotificationsAsync(); }
export async function getBadgeCount(): Promise<number> { return Platform.OS !== 'web' ? await Notifications.getBadgeCountAsync() : 0; }
export async function setBadgeCount(count: number) { if (Platform.OS !== 'web') await Notifications.setBadgeCountAsync(count); }
export async function setNotificationsEnabled(enabled: boolean) { await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString()); }
export async function getNotificationsEnabled(): Promise<boolean> { const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY); return enabled !== 'false'; }

export function addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
