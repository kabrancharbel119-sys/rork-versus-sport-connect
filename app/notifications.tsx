import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Users, Trophy, Swords, MessageCircle, CheckCheck, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import type { Notification } from '@/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount, refetchNotifications } = useNotifications();
  const { teams, getPendingRequests } = useTeams();
  const { getUserById } = useUsers();
  const [refreshing, setRefreshing] = React.useState(false);

  const notificationsWithTeamRequests = useMemo(() => {
    const list: (Notification & { _synthetic?: boolean })[] = [...notifications];
    if (!user) return list;
    const teamRoutesWithRealNotif = new Set<string>();
    for (const n of notifications) {
      if (n.type === 'team' && n.data?.route?.startsWith('/team/')) teamRoutesWithRealNotif.add(n.data.route);
    }
    for (const team of teams) {
      const isCaptainOrCo = team.captainId === user.id || (team.coCaptainIds ?? []).includes(user.id);
      if (!isCaptainOrCo) continue;
      const route = `/team/${team.id}`;
      if (teamRoutesWithRealNotif.has(route)) continue;
      const pending = getPendingRequests(team.id);
      for (const req of pending) {
        const requesterName = getUserById(req.userId)?.fullName || getUserById(req.userId)?.username || 'Un joueur';
        list.push({
          id: `team-req-${team.id}-${req.id}`,
          userId: user.id,
          type: 'team',
          title: 'Nouvelle demande',
          message: `${requesterName} souhaite rejoindre ${team.name}`,
          data: { route },
          isRead: false,
          createdAt: req.createdAt instanceof Date ? req.createdAt : new Date(req.createdAt),
          _synthetic: true,
        });
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user, teams, getPendingRequests, getUserById]);

  const unreadCount = getUnreadCount() + notificationsWithTeamRequests.filter((n) => n._synthetic).length;

  useFocusEffect(
    useCallback(() => {
      refetchNotifications();
    }, [refetchNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'team': return <Users size={20} color={Colors.primary.blue} />;
      case 'match': return <Swords size={20} color={Colors.primary.orange} />;
      case 'tournament': return <Trophy size={20} color={Colors.status.success} />;
      case 'chat': return <MessageCircle size={20} color="#8B5CF6" />;
      default: return <Bell size={20} color={Colors.text.secondary} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'team': return 'rgba(21,101,192,0.1)';
      case 'match': return 'rgba(255,107,0,0.1)';
      case 'tournament': return 'rgba(16,185,129,0.1)';
      case 'chat': return 'rgba(139,92,246,0.1)';
      default: return Colors.background.cardLight;
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handleNotificationPress = async (notification: (typeof notificationsWithTeamRequests)[0]) => {
    if (!('_synthetic' in notification) || !notification._synthetic) {
      if (!notification.isRead) await markAsRead(notification.id);
    }
    if (notification.data?.route) {
      router.push(notification.data.route as any);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Toutes vos alertes (équipes, matchs, annonces)</Text>
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllAsRead()}>
                <CheckCheck size={20} color={Colors.primary.blue} />
              </TouchableOpacity>
            )}
            {unreadCount === 0 && <View style={styles.placeholder} />}
          </View>

          {unreadCount > 0 && (
            <View style={styles.unreadBanner}>
              <Text style={styles.unreadText}>{unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={() => markAllAsRead()}>
                <Text style={styles.markAllText}>Tout marquer comme lu</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {notificationsWithTeamRequests.length > 0 ? (
              notificationsWithTeamRequests.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.notificationItem, !notification.isRead && styles.notificationUnread]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: getIconBg(notification.type) }]}>
                    {getIcon(notification.type)}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
                    <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
                  </View>
                  {!('_synthetic' in notification && notification._synthetic) && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotification(notification.id)}>
                      <Trash2 size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Bell size={48} color={Colors.text.muted} />
                </View>
                <Text style={styles.emptyTitle}>Aucune notification</Text>
                <Text style={styles.emptyText}>Toutes vos alertes (demandes d’équipe, matchs, annonces) s’affichent ici.</Text>
              </View>
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  headerSubtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  markAllBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 40 },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(21,101,192,0.1)', marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginBottom: 16 },
  unreadText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const },
  markAllText: { color: Colors.primary.blue, fontSize: 13 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  notificationItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.background.card, padding: 16, borderRadius: 12, marginBottom: 12, gap: 12 },
  notificationUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary.blue },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  notificationTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.blue },
  notificationMessage: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  notificationTime: { color: Colors.text.muted, fontSize: 12 },
  deleteBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '600' as const, marginBottom: 8 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  bottomSpacer: { height: 20 },
});
