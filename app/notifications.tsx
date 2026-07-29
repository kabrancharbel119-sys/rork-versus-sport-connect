import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Users, Trophy, Swords, MessageCircle, CheckCheck, Trash2, X, ChevronRight, Flame, Crown, MapPin, Clock, UserPlus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTournaments } from '@/contexts/TournamentsContext';
import { sportLabels } from '@/mocks/data';
import type { Notification } from '@/types';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, refetchNotifications } = useNotifications();
  const { teams, getPendingRequests, handleRequest, refetchTeams, getUserTeams, getFollowedTeams, getRecruitingTeams } = useTeams();
  const { users } = useUsers();
  const { getUpcomingMatches } = useMatches();
  const { tournaments, getActiveTournaments } = useTournaments();
  const { getFollowing } = useUsers();
  const [refreshing, setRefreshing] = React.useState(false);
  const [processingRequestId, setProcessingRequestId] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'alerts' | 'activities'>('all');
  const [selectedNotification, setSelectedNotification] = React.useState<(typeof notificationsWithTeamRequests)[0] | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    (users ?? []).forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const notificationsWithTeamRequests = useMemo(() => {
    type NotifItem = Notification & { _synthetic?: boolean; _teamId?: string; _requestId?: string; _requestUserId?: string; _isActivity?: boolean; _activityColor?: string };
    const list: NotifItem[] = [...notifications];
    if (!user) return list;

    // 1. Team join requests (existing)
    for (const team of teams) {
      const isCaptain = team.captainId === user.id;
      if (!isCaptain) continue;
      const route = `/team/${team.id}`;
      const pending = getPendingRequests(team.id);
      for (const req of pending) {
        const requester = usersById.get(req.userId);
        const requesterName = requester?.fullName || requester?.username || 'Un joueur';
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
          _teamId: team.id,
          _requestId: req.id,
          _requestUserId: req.userId,
        });
      }
    }

    // 2. Activity items — tournaments, matches, followed teams/users
    const userTeams = getUserTeams(user.id);
    const followedTeams = getFollowedTeams(user.id);
    const followingUsers = getFollowing(user.id);
    const allTournaments = [...getActiveTournaments(), ...tournaments];
    const dedupTournaments = allTournaments.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);

    // 2a. User's team tournaments
    userTeams.forEach(t => {
      dedupTournaments
        .filter(tour => tour.registeredTeams.includes(t.id))
        .slice(0, 2)
        .forEach(tour => {
          const dateStr = new Date(tour.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          if (tour.status === 'registration') {
            list.push({
              id: `act-tour-${tour.id}-${t.id}`,
              userId: user.id, type: 'tournament', title: 'Tournoi à venir',
              message: `${t.name} inscrit à ${tour.name} — ${tour.registeredTeams.length}/${tour.maxTeams} équipes`,
              data: { route: `/tournament/${tour.id}` }, isRead: true, createdAt: new Date(tour.startDate),
              _isActivity: true, _activityColor: '#FF6B00',
            });
          } else if (tour.status === 'in_progress') {
            list.push({
              id: `act-tour-live-${tour.id}-${t.id}`,
              userId: user.id, type: 'tournament', title: 'Tournoi en direct',
              message: `${tour.name} — ${t.name} participe`,
              data: { route: `/tournament/${tour.id}` }, isRead: true, createdAt: new Date(tour.startDate),
              _isActivity: true, _activityColor: '#EF4444',
            });
          } else if (tour.status === 'completed') {
            const winnerName = teams.find(t2 => t2.id === tour.winnerId)?.name ?? 'Champion';
            const isWinner = tour.winnerId === t.id;
            list.push({
              id: `act-tour-done-${tour.id}-${t.id}`,
              userId: user.id, type: 'tournament', title: 'Tournoi terminé',
              message: `${tour.name} — ${isWinner ? `${t.name} champion !` : `Vainqueur: ${winnerName}`}`,
              data: { route: `/tournament/${tour.id}` }, isRead: true, createdAt: new Date(tour.startDate),
              _isActivity: true, _activityColor: '#FFD700',
            });
          }
        });
    });

    // 2b. Matches involving user's teams
    getUpcomingMatches()
      .filter(m => userTeams.some(t => t.id === m.homeTeamId || t.id === m.awayTeamId))
      .slice(0, 4)
      .forEach(m => {
        const dateStr = new Date(m.dateTime);
        if (m.status === 'completed') {
          const isMyTeamHome = userTeams.some(t => t.id === m.homeTeamId);
          const myScore = isMyTeamHome ? m.score?.home : m.score?.away;
          const oppScore = isMyTeamHome ? m.score?.away : m.score?.home;
          const won = (myScore ?? 0) > (oppScore ?? 0);
          const myTeamName = isMyTeamHome ? m.homeTeam?.name : m.awayTeam?.name;
          const oppName = isMyTeamHome ? m.awayTeam?.name : m.homeTeam?.name;
          list.push({
            id: `act-match-done-${m.id}`,
            userId: user.id, type: 'match', title: won ? 'Victoire' : 'Défaite',
            message: `${myTeamName ?? 'Équipe'} ${myScore}-${oppScore} ${oppName ?? 'Adversaire'}`,
            data: { route: `/match/${m.id}` }, isRead: true, createdAt: dateStr,
            _isActivity: true, _activityColor: won ? '#10B981' : '#6B7280',
          });
        } else {
          list.push({
            id: `act-match-${m.id}`,
            userId: user.id, type: 'match', title: 'Match à venir',
            message: `${m.homeTeam?.name ?? 'Équipe 1'} vs ${m.awayTeam?.name ?? 'Équipe 2'} — ${sportLabels[m.sport] || m.sport}`,
            data: { route: `/match/${m.id}` }, isRead: true, createdAt: dateStr,
            _isActivity: true, _activityColor: Colors.primary.orange,
          });
        }
      });

    // 2c. Followed teams recruiting
    followedTeams.filter(t => t.isRecruiting).slice(0, 3).forEach(t => {
      const spotsLeft = t.maxMembers - t.members.length;
      if (spotsLeft > 0) {
        list.push({
          id: `act-recruit-${t.id}`,
          userId: user.id, type: 'team', title: 'Recrutement',
          message: `${t.name} cherche ${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''} — ${sportLabels[t.sport] || ''}`,
          data: { route: `/team/${t.id}` }, isRead: true, createdAt: new Date(),
          _isActivity: true, _activityColor: '#10B981',
        });
      }
    });

    // 2d. Followed users activity
    followingUsers.slice(0, 5).forEach(u => {
      const userTeam = teams.find(t => t.members.some(m => m.userId === u.id));
      if (userTeam) {
        list.push({
          id: `act-friend-${u.id}`,
          userId: user.id, type: 'system', title: 'Ami',
          message: `${u.fullName} joue dans ${userTeam.name}`,
          data: { route: `/user/${u.id}` }, isRead: true, createdAt: new Date(u.createdAt),
          _isActivity: true, _activityColor: '#3B82F6',
        });
      }
    });

    // 2e. Live & upcoming tournaments in user's city
    const city = user?.city?.trim()?.toLowerCase() || '';
    dedupTournaments
      .filter(t => t.status === 'in_progress' && !userTeams.some(ut => t.registeredTeams.includes(ut.id)))
      .filter(t => !city || !t.venue?.city || t.venue.city.toLowerCase() === city)
      .slice(0, 2)
      .forEach(t => {
        list.push({
          id: `act-live-${t.id}`,
          userId: user.id, type: 'tournament', title: 'En direct',
          message: `${t.name} — ${sportLabels[t.sport] || t.sport} · ${t.registeredTeams.length} équipes`,
          data: { route: `/tournament/${t.id}` }, isRead: true, createdAt: new Date(t.startDate),
          _isActivity: true, _activityColor: '#EF4444',
        });
      });

    dedupTournaments
      .filter(t => t.status === 'registration' && !userTeams.some(ut => t.registeredTeams.includes(ut.id)))
      .filter(t => !city || !t.venue?.city || t.venue.city.toLowerCase() === city)
      .slice(0, 2)
      .forEach(t => {
        list.push({
          id: `act-upcoming-${t.id}`,
          userId: user.id, type: 'tournament', title: 'Tournoi ouvert',
          message: `${t.name} — ${t.registeredTeams.length}/${t.maxTeams} équipes · ${(t.entryFee ?? 0).toLocaleString('fr-FR')} FCFA`,
          data: { route: `/tournament/${t.id}` }, isRead: true, createdAt: new Date(t.startDate),
          _isActivity: true, _activityColor: '#F97316',
        });
      });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user, teams, getPendingRequests, usersById, getUserTeams, getFollowedTeams, getFollowing, getUpcomingMatches, tournaments, getActiveTournaments]);

  const unreadCount = notificationsWithTeamRequests.filter((n) => !n.isRead).length;

  // Split into alerts (real notifications + team requests) and activities
  const alertItems = notificationsWithTeamRequests.filter(n => !('_isActivity' in n) || !n._isActivity);
  const activityItemsList = notificationsWithTeamRequests.filter(n => '_isActivity' in n && n._isActivity);
  const filteredItems = activeFilter === 'alerts' ? alertItems : activeFilter === 'activities' ? activityItemsList : notificationsWithTeamRequests;

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

  const getActivityIcon = (notification: (typeof notificationsWithTeamRequests)[0]) => {
    const color = notification._activityColor || Colors.primary.blue;
    switch (notification.type) {
      case 'tournament':
        return notification.title === 'En direct' || notification.title === 'Tournoi en direct'
          ? <Flame size={20} color={color} />
          : notification.title === 'Tournoi terminé'
            ? <Crown size={20} color={color} />
            : <Trophy size={20} color={color} />;
      case 'match':
        return <Swords size={20} color={color} />;
      case 'team':
        return notification.title === 'Recrutement'
          ? <Users size={20} color={color} />
          : <UserPlus size={20} color={color} />;
      default:
        return <Bell size={20} color={color} />;
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
    // Activity items navigate directly
    if ('_isActivity' in notification && notification._isActivity) {
      if (notification.data?.route) {
        router.push(notification.data.route as any);
      }
      return;
    }
    if (!('_synthetic' in notification) || !notification._synthetic) {
      if (!notification.isRead) await markAsRead(notification.id);
    }
    if (isActionableJoinRequest(notification) && notification._requestUserId) {
      router.push({
        pathname: '/user/[id]',
        params: {
          id: notification._requestUserId,
          fromTeamRequest: '1',
          teamId: notification._teamId!,
          requestId: notification._requestId!,
        },
      } as any);
      return;
    }
    setSelectedNotification(notification);
  };

  const handleNotificationNavigate = (notification: (typeof notificationsWithTeamRequests)[0]) => {
    setSelectedNotification(null);
    if (
      notification.type === 'team' &&
      notification.title === 'Nouvelle demande'
    ) {
      const teamIdFromData = notification.data?.teamId;
      const requestIdFromData = notification.data?.requestId;
      const requesterIdFromData = notification.data?.requesterId;
      
      let targetUserId: string | undefined;
      let targetTeamId: string | undefined;
      let targetRequestId: string | undefined;

      if (requesterIdFromData) {
        targetUserId = requesterIdFromData;
        targetTeamId = teamIdFromData;
        targetRequestId = requestIdFromData;
      }

      if (typeof notification.data?.route === 'string' && notification.data.route.includes('/user/')) {
        const url = new URL(notification.data.route, 'http://dummy.com');
        const pathParts = url.pathname.split('/');
        targetUserId = pathParts[pathParts.length - 1];
        targetTeamId = url.searchParams.get('teamId') || teamIdFromData;
        targetRequestId = url.searchParams.get('requestId') || requestIdFromData;
      }

      if (!targetUserId || !targetTeamId) {
        const teamIdFromRoute = typeof notification.data?.route === 'string' && notification.data.route.startsWith('/team/')
          ? notification.data.route.replace('/team/', '').split('?')[0].trim()
          : teamIdFromData;
        const team = teams.find((t) => t.id === teamIdFromRoute);
        if (team) {
          const pending = getPendingRequests(team.id);
          const requesterName = notification.message.split(' souhaite rejoindre')[0]?.trim();
          const matched = pending.find((req) => {
            if (requestIdFromData && req.id === requestIdFromData) return true;
            const u = usersById.get(req.userId);
            const fullName = u?.fullName?.trim();
            const username = u?.username?.trim();
            return requesterName && (fullName === requesterName || username === requesterName);
          });
          if (matched) {
            targetUserId = matched.userId;
            targetTeamId = team.id;
            targetRequestId = matched.id;
          }
        }
      }

      if (targetUserId && targetTeamId) {
        router.push({
          pathname: '/user/[id]',
          params: {
            id: targetUserId,
            fromTeamRequest: '1',
            teamId: targetTeamId,
            requestId: targetRequestId || '',
          },
        } as any);
        return;
      }
      return;
    }
    if (notification.data?.route) {
      router.push(notification.data.route as any);
    }
  };

  const isActionableJoinRequest = (notification: (typeof notificationsWithTeamRequests)[0]) => {
    return notification.type === 'team' && !!notification._synthetic && !!notification._teamId && !!notification._requestId;
  };

  const handleJoinRequestAction = async (notification: (typeof notificationsWithTeamRequests)[0], action: 'accept' | 'reject') => {
    if (!user || !notification._teamId || !notification._requestId) return;
    try {
      setProcessingRequestId(notification._requestId);
      await handleRequest({ teamId: notification._teamId, requestId: notification._requestId, action, handlerId: user.id });
      await refetchTeams();
      await refetchNotifications();
    } catch (e: any) {
      const { Alert } = await import('react-native');
      Alert.alert('Erreur', e?.message ?? 'Impossible de traiter cette demande.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/(home)')}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Alertes, matchs, tournois et abonnements</Text>
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

          {/* Filter tabs */}
          <View style={styles.filterTabs}>
            {[
              { key: 'all', label: 'Tout', count: notificationsWithTeamRequests.length },
              { key: 'alerts', label: 'Alertes', count: alertItems.length },
              { key: 'activities', label: 'Activités', count: activityItemsList.length },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.key as 'all' | 'alerts' | 'activities')}
              >
                <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.filterTabBadge, activeFilter === tab.key && styles.filterTabBadgeActive]}>
                    <Text style={styles.filterTabBadgeText}>{tab.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.blue} />}
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((notification) => {
                const isActivity = '_isActivity' in notification && notification._isActivity;
                const activityColor = isActivity ? (notification._activityColor || Colors.primary.blue) : Colors.primary.blue;
                return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.isRead && styles.notificationUnread,
                    isActivity && { borderLeftWidth: 3, borderLeftColor: activityColor },
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: isActivity ? (activityColor + '20') : getIconBg(notification.type) }]}>
                    {isActivity ? getActivityIcon(notification) : getIcon(notification.type)}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
                    <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
                    {isActionableJoinRequest(notification) && (
                      <View style={styles.requestActionsRow}>
                        <TouchableOpacity
                          style={[styles.requestActionBtn, styles.acceptBtn]}
                          disabled={processingRequestId === notification._requestId}
                          onPress={() => handleJoinRequestAction(notification, 'accept')}
                        >
                          <Text style={styles.requestActionText}>Accepter</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.requestActionBtn, styles.rejectBtn]}
                          disabled={processingRequestId === notification._requestId}
                          onPress={() => handleJoinRequestAction(notification, 'reject')}
                        >
                          <Text style={styles.requestActionText}>Refuser</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {isActivity ? (
                    <ChevronRight size={18} color={Colors.text.muted} />
                  ) : !('_synthetic' in notification && notification._synthetic) ? (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotification(notification.id)}>
                      <Trash2 size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                );
              })
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
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  headerSubtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  markAllBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 40 },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(21,101,192,0.1)', marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  unreadText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const },
  markAllText: { color: Colors.primary.blue, fontSize: 13 },
  filterTabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background.card },
  filterTabActive: { backgroundColor: Colors.primary.blue },
  filterTabText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' as const },
  filterTabTextActive: { color: '#FFFFFF' },
  filterTabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  filterTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterTabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },
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
  activityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,0,0.15)' },
  activityBadgeText: { color: Colors.primary.orange, fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  requestActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  requestActionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  requestActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  acceptBtn: { backgroundColor: Colors.status.success },
  rejectBtn: { backgroundColor: Colors.status.error },
  deleteBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '600' as const, marginBottom: 8 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  bottomSpacer: { height: 20 },
});
