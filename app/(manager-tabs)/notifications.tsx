import React, { useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Users, Trophy, Swords, MessageCircle, CheckCheck, Trash2, Calendar, X, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useNotifications } from '@/contexts/NotificationsContext';

export default function ManagerNotificationsScreen() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, refetchNotifications } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedNotification, setSelectedNotification] = React.useState<(typeof notifications)[0] | null>(null);

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
      case 'booking': return <Calendar size={20} color={Colors.primary.orange} />;
      case 'system': return <Bell size={20} color={Colors.text.secondary} />;
      default: return <Bell size={20} color={Colors.text.secondary} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'team': return 'rgba(21,101,192,0.1)';
      case 'match': return 'rgba(255,107,0,0.1)';
      case 'tournament': return 'rgba(16,185,129,0.1)';
      case 'chat': return 'rgba(139,92,246,0.1)';
      case 'booking': return 'rgba(255,107,0,0.1)';
      default: return Colors.background.cardLight;
    }
  };

  const formatTime = (date: Date | string) => {
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

  const handleNotificationPress = async (notification: (typeof notifications)[0]) => {
    if (!notification.isRead) await markAsRead(notification.id);
    setSelectedNotification(notification);
  };

  const handleNotificationNavigate = (notification: (typeof notifications)[0]) => {
    setSelectedNotification(null);
    if (notification.data?.route) {
      router.push(notification.data.route as any);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Toutes vos alertes gestionnaire</Text>
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllAsRead()}>
                <CheckCheck size={20} color={Colors.primary.orange} />
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {notifications.length > 0 ? (
              notifications.map((notification) => (
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
                    <Text style={styles.notificationMessage} numberOfLines={3}>{notification.message}</Text>
                    <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotification(notification.id)}>
                    <Trash2 size={16} color={Colors.text.muted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Bell size={48} color={Colors.text.muted} />
                </View>
                <Text style={styles.emptyTitle}>Aucune notification</Text>
                <Text style={styles.emptyText}>Vos alertes (réservations, tournois, annonces) s&apos;afficheront ici.</Text>
              </View>
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Modal détail notification */}
      <Modal
        visible={selectedNotification !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedNotification(null)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setSelectedNotification(null)}>
          <Pressable style={{ backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={(e) => e.stopPropagation()}>
            {selectedNotification && (() => {
              const n = selectedNotification;
              const hasRoute = !!n.data?.route;
              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.iconContainer, { backgroundColor: getIconBg(n.type) }]}>
                        {getIcon(n.type)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text.primary, fontSize: 16, fontWeight: '700' }}>{n.title}</Text>
                        <Text style={{ color: Colors.text.muted, fontSize: 12, marginTop: 2 }}>{formatTime(n.createdAt)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedNotification(null)} style={{ padding: 4 }}>
                      <X size={20} color={Colors.text.muted} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300, marginBottom: 16 }}>
                    <Text style={{ color: Colors.text.secondary, fontSize: 15, lineHeight: 22 }}>
                      {n.message}
                    </Text>
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}
                      onPress={() => setSelectedNotification(null)}
                    >
                      <Text style={{ color: Colors.text.secondary, fontSize: 14, fontWeight: '600' }}>Fermer</Text>
                    </TouchableOpacity>
                    {hasRoute && (
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onPress={() => handleNotificationNavigate(n)}
                      >
                        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Voir</Text>
                        <ChevronRight size={16} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.dark },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  markAllBtn: { padding: 8 },
  placeholder: { width: 36 },
  unreadBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,107,0,0.08)',
  },
  unreadText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' },
  markAllText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  notificationUnread: {
    borderColor: Colors.primary.orange + '40',
    backgroundColor: Colors.background.cardLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: { flex: 1 },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.orange, marginLeft: 8 },
  notificationMessage: { color: Colors.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  notificationTime: { color: Colors.text.muted, fontSize: 12 },
  deleteBtn: { padding: 8, marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  bottomSpacer: { height: 40 },
});
