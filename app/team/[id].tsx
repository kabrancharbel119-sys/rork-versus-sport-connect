import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, MapPin, Settings, UserPlus, MessageCircle, Shield, Plus, Check, X, ChevronDown, Edit3, Image, Crown, Trash2, Lock, Unlock, AlertTriangle, ChevronRight, Info } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useUsers } from '@/contexts/UsersContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { teamsApi } from '@/lib/api/teams';
import { supabase } from '@/lib/supabase';
import { safeBack } from '@/lib/navigation';
import { usersApi } from '@/lib/api/users';
import { uploadTeamImage } from '@/lib/uploadImage';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels, ambianceLabels, TEAM_ROLES, DEFAULT_POSITIONS } from '@/mocks/data';
import { SkillLevel, PlayStyle } from '@/types';
import type { Team, User } from '@/types';

const pickImageFromLibrary = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

const takePhoto = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour prendre une photo.');
    return null;
  }
  
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

export default function TeamDetailScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const { getTeamById, sendJoinRequest, leaveTeam, handleRequest, updateMemberRole, addCustomRole, promoteMember, removeMember, getPendingRequests, updateTeam, deleteTeam, transferCaptaincy, followTeam, unfollowTeam, isUpdating, refetchTeams, getUserTeams } = useTeams();
  const { users, addUser } = useUsers();
  const { addNotification, notifyTeamRequest } = useNotifications();
  const fromContext = getTeamById(id || '');
  const [fetchedTeam, setFetchedTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [memberUsers, setMemberUsers] = useState<Record<string, User>>({});
  const hydratedTeamMembersRef = useRef<Record<string, boolean>>({});
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [showPendingAlert, setShowPendingAlert] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editIsRecruiting, setEditIsRecruiting] = useState(true);
  const [editMaxMembers, setEditMaxMembers] = useState(11);
  const [editLevel, setEditLevel] = useState<SkillLevel>('intermediate');
  const [editAmbiance, setEditAmbiance] = useState<PlayStyle>('mixed');

  const loadFreshTeam = useCallback(() => {
    if (!id) return;
    teamsApi.getById(id)
      .then(t => setFetchedTeam(t))
      .catch(() => {});
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      // Always load fresh from DB on focus — bypasses stale cache
      if (id) {
        setLoadingTeam(true);
        teamsApi.getById(id)
          .then(t => setFetchedTeam(t))
          .catch(() => {})
          .finally(() => setLoadingTeam(false));
      }
      // Refresh user so user.teams is up-to-date (updated when captain accepts)
      refreshUser();
      refetchTeams();
    }, [id, refetchTeams, refreshUser])
  );

  const team = fetchedTeam ?? fromContext;

  // Use fresh DB data as source of truth when available.
  // Fall back to userTeamIds only when no fresh fetch yet (handles join acceptance polling).
  const userTeamIds: string[] = (user as any)?.teams ?? [];
  const memberInTeam = team?.members.some(m => m.userId === user?.id) ?? false;
  const isMember = fetchedTeam
    ? memberInTeam
    : memberInTeam || (!!id && userTeamIds.includes(id));
  const isFan = (team?.fans ?? []).includes(user?.id || '');
  const isCaptain = team?.captainId === user?.id;
  const isCoCaptain = team?.coCaptainIds.includes(user?.id || '') ?? false;
  const canManage = isCaptain || isCoCaptain;
  const canHandleRequests = isCaptain;
  const myJoinRequest = user
    ? [...(team?.joinRequests ?? [])]
        .filter(r => r.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : undefined;
  const hasRequested = myJoinRequest?.status === 'pending' || myJoinRequest?.status === 'waiting';

  // Poll DB every 5s while a request is pending so the screen updates immediately on acceptance
  useEffect(() => {
    if (!hasRequested || isMember) return;
    const interval = setInterval(() => {
      loadFreshTeam();
      refreshUser();
    }, 5000);
    return () => clearInterval(interval);
  }, [hasRequested, isMember, loadFreshTeam, refreshUser]);

  // Realtime subscription: reload team instantly when members column changes (removal/join)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`team-members-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${id}` }, () => {
        loadFreshTeam();
        refreshUser();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadFreshTeam, refreshUser]);

  const memberRole = team?.members.find(m => m.userId === user?.id)?.role;
  const pendingRequests = team ? getPendingRequests(team.id) : [];
  const allRoles = team ? [...TEAM_ROLES, ...team.customRoles.map(r => r.name)] : [...TEAM_ROLES];
  const positions = team ? (DEFAULT_POSITIONS[team.sport] || DEFAULT_POSITIONS.default) : DEFAULT_POSITIONS.default;
  const resolveMemberUser = (memberUserId: string) => memberUsers[memberUserId] || users.find((u) => u.id === memberUserId);

  useEffect(() => {
    if (team) {
      console.log('[Team] Team object loaded:', {
        id: team.id,
        name: team.name,
        logo: team.logo,
        hasLogo: !!team.logo
      });
    }
  }, [team?.id, team?.logo]);

  useEffect(() => {
    const loadMissingUsers = async () => {
      if (!team || !team.members) return;
      if (hydratedTeamMembersRef.current[team.id]) return;
      hydratedTeamMembersRef.current[team.id] = true;

      const cachedUsers = team.members.reduce<Record<string, User>>((acc, member) => {
        const cached = users.find((u) => u.id === member.userId);
        if (cached) acc[member.userId] = cached;
        return acc;
      }, {});
      if (Object.keys(cachedUsers).length > 0) {
        setMemberUsers((prev) => ({ ...prev, ...cachedUsers }));
      }
      
      const missingUserIds = team.members
        .map(m => m.userId)
        .filter(userId => !users.find((u) => u.id === userId) && !memberUsers[userId]);
      
      if (missingUserIds.length === 0) return;
      
      console.log('[Team] Loading', missingUserIds.length, 'missing users');
      
      const loadPromises = missingUserIds.map(async (userId) => {
        try {
          const fetchedUser = await usersApi.getById(userId);
          if (fetchedUser) {
            await addUser(fetchedUser);
            setMemberUsers((prev) => ({ ...prev, [userId]: fetchedUser }));
            return fetchedUser.fullName || fetchedUser.username;
          }
        } catch (e) {
          console.log('[Team] Failed to load user:', userId);
        }
        return null;
      });
      
      const results = await Promise.all(loadPromises);
      const loaded = results.filter(Boolean);
      if (loaded.length > 0) {
        console.log('[Team] Loaded users:', loaded.join(', '));
      }
    };
    
    loadMissingUsers();
  }, [team?.id, users, memberUsers, addUser]);

  useEffect(() => {
    if (team) {
      setEditName(team.name);
      setEditDescription(team.description || '');
      setEditLogo(team.logo || '');
      setEditIsRecruiting(team.isRecruiting);
      setEditMaxMembers(team.maxMembers);
      setEditLevel(team.level);
      setEditAmbiance(team.ambiance);
    }
  }, [team]);

  useEffect(() => {
    if (team && canHandleRequests && pendingRequests.length > 0 && !showPendingAlert) {
      setShowPendingAlert(true);
      Alert.alert(
        t('teamDetail.pendingRequestsTitle'),
        t('teamDetail.pendingRequestsMessage', { count: pendingRequests.length }),
        [{ text: t('teamDetail.view'), onPress: () => setShowRequestsModal(true) }, { text: t('teamDetail.later'), style: 'cancel' }]
      );
    }
  }, [team, canHandleRequests, pendingRequests.length, showPendingAlert]);

  if (loadingTeam && !team) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <ActivityIndicator size="large" color={Colors.primary.orange} />
            <Text style={styles.errorText}>{t('teamDetail.loading')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}><Text style={styles.errorText}>{t('teamDetail.notFound')}</Text><Button title={t('common.back')} onPress={() => safeBack(router, '/(tabs)/teams')} variant="outline" /></View>
        </SafeAreaView>
      </View>
    );
  }

  const handleJoinRequest = async () => {
    if (!user) return;
    if (getUserTeams(user.id).length >= 1) {
      Alert.alert(
        t('teamDetail.oneTeamTitle'),
        t('teamDetail.oneTeamMessage')
      );
      return;
    }
    setIsRequesting(true);
    try {
      await sendJoinRequest({ teamId: team.id, userId: user.id });
      await notifyTeamRequest(team.name, 'sent', team.id, user.id);
      await refetchTeams();
      Alert.alert(
        t('teamDetail.requestSentTitle'),
        t('teamDetail.requestSentMessage')
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message ?? t('teamDetail.requestSendError'));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(t('teamDetail.leaveTeamTitle'), t('teamDetail.leaveTeamQuestion', { team: team.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('teamDetail.leaveTeamTitle'), style: 'destructive', onPress: async () => { try { await leaveTeam({ teamId: team.id, userId: user!.id }); safeBack(router, '/(tabs)/teams'); } catch (e: any) { Alert.alert(t('common.error'), e.message); } } },
    ]);
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await handleRequest({ teamId: team.id, requestId, action, handlerId: user!.id });
      setShowRequestsModal(false);
      await refetchTeams();
      Alert.alert(t('common.success'), action === 'accept' ? t('teamDetail.memberAdded') : t('teamDetail.requestRejected'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleUpdateRole = async (userId: string, customRole: string, position?: string) => {
    try { await updateMemberRole({ teamId: team.id, userId, customRole, position }); setShowRoleModal(false); }
    catch (e: any) { Alert.alert(t('common.error'), e.message); }
  };

  const handleAddCustomRole = async () => {
    if (!newRoleName.trim()) return;
    try { await addCustomRole({ teamId: team.id, roleName: newRoleName.trim(), createdBy: user!.id }); setNewRoleName(''); setShowAddRoleModal(false); Alert.alert(t('common.success'), t('teamDetail.roleAdded')); }
    catch (e: any) { Alert.alert(t('common.error'), e.message); }
  };

  const handlePromote = (userId: string, role: 'co-captain' | 'member') => {
    Alert.alert(t('teamDetail.confirmTitle'), role === 'co-captain' ? t('teamDetail.promoteQuestion') : t('teamDetail.demoteQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await promoteMember({ teamId: team.id, userId, role, promoterId: user!.id });
            const msg = role === 'co-captain'
              ? { title: '⭐ Promotion', message: `Vous avez été promu co-capitaine de ${team.name}.` }
              : { title: 'Rôle mis à jour', message: `Vous n'êtes plus co-capitaine de ${team.name}.` };
            await addNotification({ userId, type: 'team', ...msg, data: { route: `/team/${team.id}` } });
          } catch (e: any) {
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (userId: string) => {
    Alert.alert(t('teamDetail.removeMemberTitle'), t('teamDetail.removeMemberQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('teamDetail.removeMemberTitle'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember({ teamId: team.id, userId });
            await addNotification({
              userId,
              type: 'team',
              title: '👋 Retrait de l\'équipe',
              message: `Vous avez été retiré de l'équipe ${team.name}.`,
              data: { route: '/(tabs)/teams' },
            });
            loadFreshTeam();
          } catch (e: any) {
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);
  };

  const handleSaveSettings = async () => {
    try {
      console.log('[Team] ========== SAVE SETTINGS START ==========');
      console.log('[Team] editLogo value:', editLogo);
      console.log('[Team] editLogo type:', typeof editLogo);
      console.log('[Team] editLogo length:', editLogo?.length);
      
      let logoUrl = editLogo.trim();
      console.log('[Team] logoUrl after trim:', logoUrl);
      const shouldUploadLogo =
        !!logoUrl &&
        !logoUrl.startsWith('http://') &&
        !logoUrl.startsWith('https://');
      console.log('[Team] shouldUploadLogo?', shouldUploadLogo);
      
      if (shouldUploadLogo) {
        console.log('[Team] Uploading local image to Supabase Storage...');
        console.log('[Team] Calling uploadTeamImage with:', logoUrl, team.id);
        try {
          logoUrl = await uploadTeamImage(logoUrl, team.id);
          console.log('[Team] Image uploaded successfully, new URL:', logoUrl);
        } catch (uploadError) {
          console.error('[Team] Failed to upload image:', uploadError);
          Alert.alert(t('common.error'), t('teamDetail.uploadImageError'));
          return;
        }
      } else {
        console.log('[Team] Skipping upload - logoUrl:', logoUrl);
      }
      
      await updateTeam({
        teamId: team.id,
        updates: {
          name: editName.trim() || team.name,
          description: editDescription.trim(),
          logo: logoUrl || undefined,
          isRecruiting: editIsRecruiting,
          maxMembers: editMaxMembers,
          level: editLevel,
          ambiance: editAmbiance,
        },
      });
      setShowSettingsModal(false);
      Alert.alert(t('common.success'), t('teamDetail.teamUpdated'));
    } catch (e: any) {
      console.error('[Team] Erreur sauvegarde:', e);
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      t('teamDetail.dissolveTeamTitle'),
      t('teamDetail.dissolveTeamMessage', { team: team.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('teamDetail.dissolveAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              const memberIds = team.members.map((m) => m.userId).filter((id) => id !== user!.id);
              await deleteTeam({ teamId: team.id, userId: user!.id });
              for (const uid of memberIds) {
                await addNotification({
                  userId: uid,
                  type: 'team',
                  title: 'Équipe dissoute',
                  message: `L'équipe ${team.name} a été dissoute.`,
                  data: { route: '/(tabs)/teams' },
                });
              }
              setShowSettingsModal(false);
              safeBack(router, '/(tabs)/teams');
              Alert.alert(t('common.success'), t('teamDetail.dissolvedSuccess'));
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          },
        },
      ]
    );
  };

  const handleTransferCaptaincy = async (newCaptainId: string) => {
    const newCaptain = resolveMemberUser(newCaptainId);
    Alert.alert(
      t('teamDetail.transferTitle'),
      t('teamDetail.transferMessage', { member: newCaptain?.fullName || t('teamDetail.member') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('teamDetail.transferAction'), onPress: async () => {
          try {
            await transferCaptaincy({ teamId: team.id, newCaptainId, currentCaptainId: user!.id });
            await addNotification({
              userId: newCaptainId,
              type: 'team',
              title: '👑 Nouveau capitaine',
              message: `Vous êtes maintenant le capitaine de l'équipe ${team.name}.`,
              data: { route: `/team/${team.id}` },
            });
            setShowTransferModal(false);
            await refetchTeams();
            Alert.alert(t('common.success'), t('teamDetail.transferSuccess'));
          } catch (e: any) {
            Alert.alert(t('common.error'), e.message);
          }
        }},
      ]
    );
  };

  const otherMembers = team.members.filter(m => m.userId !== team.captainId);

  const previewForNonMember = !isMember;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView testID="team-detail-scroll" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/teams')}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
              <View style={styles.headerActions}>
                {!previewForNonMember && canHandleRequests && pendingRequests.length > 0 && (
                  <TouchableOpacity style={styles.requestsBadge} onPress={() => setShowRequestsModal(true)}>
                    <UserPlus size={18} color="#FFFFFF" /><Text style={styles.requestsCount}>{pendingRequests.length}</Text>
                  </TouchableOpacity>
                )}
                {!previewForNonMember && isCaptain && <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)}><Settings size={22} color={Colors.text.primary} /></TouchableOpacity>}
              </View>
            </View>
            <View style={styles.teamHeader}>
              <Avatar uri={team.logo} name={team.name} size="xlarge" />
              <Text style={styles.teamName}>{team.name}</Text>
              <View style={styles.teamMeta}>
                <View style={styles.metaItem}><MapPin size={14} color={Colors.text.muted} /><Text style={styles.metaText}>{team.city}</Text></View>
                <View style={styles.metaDot} /><Text style={styles.metaText}>{sportLabels[team.sport]}</Text>
                <View style={styles.metaDot} /><Text style={styles.metaText}>{team.format}</Text>
              </View>
              <View style={styles.badges}>
                <View style={styles.badge}><Text style={styles.badgeText}>{levelLabels[team.level]}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{ambianceLabels[team.ambiance]}</Text></View>
                {team.isRecruiting && <View style={[styles.badge, styles.recruitingBadge]}><Text style={[styles.badgeText, styles.recruitingText]}>{t('teamDetail.recruit')}</Text></View>}
              </View>
              {isMember && memberRole && (
                <View style={styles.memberBadge}><Shield size={14} color={Colors.primary.orange} /><Text style={styles.memberBadgeText}>{memberRole === 'captain' ? t('teamDetail.captain') : memberRole === 'co-captain' ? t('teamDetail.coCaptain') : t('teamDetail.member')}</Text></View>
              )}
            </View>

            {previewForNonMember ? (
              <>
                {team.description && <Card style={styles.descriptionCard}><Text style={styles.description} numberOfLines={4}>{team.description}</Text></Card>}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('teamDetail.members', { count: team.members.length, max: team.maxMembers })}</Text>
                  <Text style={styles.previewMembersHint}>{t('teamDetail.accessMembersText')}</Text>
                  {team.members.map((member) => (
                    <Card key={member.userId} style={styles.memberCard}>
                      <View style={styles.memberRow}>
                        <Avatar uri={resolveMemberUser(member.userId)?.avatar} name={resolveMemberUser(member.userId)?.fullName || resolveMemberUser(member.userId)?.username} size="medium" />
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{resolveMemberUser(member.userId)?.fullName || resolveMemberUser(member.userId)?.username || t('teamDetail.member')}</Text>
                          <Text style={styles.memberPosition}>{member.role === 'captain' ? t('teamDetail.captain') : member.role === 'co-captain' ? t('teamDetail.coCaptain') : t('teamDetail.member')}</Text>
                        </View>
                        {member.role === 'captain' && <View style={styles.organizerBadge}><Crown size={14} color={Colors.primary.orange} /></View>}
                      </View>
                    </Card>
                  ))}
                </View>
                <Card style={styles.accessCard} variant="gradient">
                  <Info size={22} color={Colors.primary.blue} />
                  <Text style={styles.accessTitle}>{t('teamDetail.accessMembersTitle')}</Text>
                  <Text style={styles.accessText}>
                    {t('teamDetail.accessMembersText')}
                  </Text>
                </Card>
                <View style={styles.actions}>
                  {myJoinRequest?.status === 'waiting' ? (
                    <Button title={t('teamDetail.waitingList')} onPress={() => {}} variant="secondary" disabled style={styles.actionButton} />
                  ) : myJoinRequest?.status === 'rejected' ? (
                    <Button title={t('teamDetail.requestJoinAgain')} onPress={handleJoinRequest} loading={isRequesting} variant="orange" icon={<UserPlus size={18} color="#FFFFFF" />} style={styles.actionButton} />
                  ) : hasRequested ? (
                    <Button title={t('teamDetail.requestSentCaptain')} onPress={() => {}} variant="secondary" disabled style={styles.actionButton} />
                  ) : team.isRecruiting && team.members.length < team.maxMembers ? (
                    <Button title={t('teamDetail.requestJoin')} onPress={handleJoinRequest} loading={isRequesting} variant="orange" icon={<UserPlus size={18} color="#FFFFFF" />} style={styles.actionButton} />
                  ) : (
                    <Button title={t('teamDetail.recruitmentClosed')} onPress={() => {}} variant="secondary" disabled style={styles.actionButton} />
                  )}
                </View>
                <View style={styles.bottomSpacer} />
              </>
            ) : (
              <>
            {team.description && <Card style={styles.descriptionCard}><Text style={styles.description}>{team.description}</Text></Card>}

            <View style={styles.statsRow}>
              <StatCard label={t('teamDetail.matches')} value={team.stats.matchesPlayed} variant="blue" />
              <StatCard label={t('teamDetail.wins')} value={team.stats.wins} variant="default" />
              <StatCard label={t('teamDetail.trophies')} value={team.stats.tournamentWins} variant="orange" />
            </View>

            <Card style={styles.reputationCard} variant="gradient">
              <View style={styles.reputationRow}>
                <Star size={24} color="#F59E0B" />
                <View style={styles.reputationInfo}><Text style={styles.reputationLabel}>{t('teamDetail.reputation')}</Text><Text style={styles.reputationValue}>{team.reputation.toFixed(1)} / 5.0</Text></View>
                <View style={styles.cashPrize}><Text style={styles.cashPrizeLabel}>Cash prizes</Text><Text style={styles.cashPrizeValue}>{team.stats.totalCashPrize.toLocaleString()} FCFA</Text></View>
              </View>
            </Card>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('teamDetail.members', { count: team.members.length, max: team.maxMembers })}</Text>
                {isCaptain && <TouchableOpacity style={styles.addRoleBtn} onPress={() => setShowAddRoleModal(true)}><Plus size={16} color="#FFFFFF" /><Text style={styles.addRoleBtnText}>{t('teamDetail.customRole')}</Text></TouchableOpacity>}
              </View>
              {team.members.map((member, i) => (
                <Card key={i} style={styles.memberCard}>
                  <TouchableOpacity style={styles.memberRow} onPress={() => canManage && member.userId !== team.captainId && (setSelectedMember(member.userId), setShowRoleModal(true))} disabled={!canManage || member.userId === team.captainId}>
                    <Avatar uri={member.userId === user?.id ? user?.avatar : resolveMemberUser(member.userId)?.avatar} name={member.userId === user?.id ? user?.fullName : resolveMemberUser(member.userId)?.fullName || resolveMemberUser(member.userId)?.username} size="medium" />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.userId === user?.id ? user?.fullName : resolveMemberUser(member.userId)?.fullName || resolveMemberUser(member.userId)?.username || t('teamDetail.member')}</Text>
                      <Text style={styles.memberPosition}>{member.customRole || member.position || t('teamDetail.member')}</Text>
                    </View>
                    {member.role !== 'member' && <View style={[styles.roleBadge, member.role === 'captain' && styles.captainRole]}><Text style={styles.roleText}>{member.role === 'captain' ? 'Cap' : 'Co'}</Text></View>}
                    {canManage && member.userId !== team.captainId && <ChevronDown size={16} color={Colors.text.muted} />}
                  </TouchableOpacity>
                </Card>
              ))}
            </View>

            {(team.fans ?? []).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('teamDetail.community', { count: (team.fans ?? []).length })}</Text>
                </View>
                <Card style={styles.fansCard}>
                  <Text style={styles.fansDescription}>
                    {t('teamDetail.fansFollowTeam', { count: (team.fans ?? []).length })}
                  </Text>
                  <View style={styles.fansList}>
                    {(team.fans ?? []).slice(0, 10).map((fanId) => {
                      const fan = resolveMemberUser(fanId);
                      return (
                        <View key={fanId} style={styles.fanItem}>
                          <Avatar uri={fan?.avatar} name={fan?.fullName || fan?.username || ''} size="small" />
                          <Text style={styles.fanName}>{fan?.fullName || fan?.username || t('teamDetail.fan')}</Text>
                        </View>
                      );
                    })}
                    {(team.fans ?? []).length > 10 && (
                      <Text style={styles.fansMore}>{t('teamDetail.othersCount', { count: (team.fans ?? []).length - 10 })}</Text>
                    )}
                  </View>
                </Card>
              </View>
            )}

            <View style={styles.actions}>
              {isMember && (
                <Button title={t('teamDetail.teamChat')} onPress={() => router.push(`/team-chat/${team.id}` as any)} variant="primary" icon={<MessageCircle size={18} color="#FFFFFF" />} style={styles.actionButton} />
              )}
              {!isMember && !hasRequested && !isFan && myJoinRequest?.status !== 'waiting' && (
                <>
                  <Button title={myJoinRequest?.status === 'rejected' ? t('teamDetail.requestJoinAgain') : t('teamDetail.requestJoin')} onPress={handleJoinRequest} loading={isRequesting} variant="orange" icon={<UserPlus size={18} color="#FFFFFF" />} style={styles.actionButton} />
                  <Button title={t('teamDetail.followTeam')} onPress={async () => {
                    if (!user || !team) return;
                    try {
                      await followTeam({ teamId: team.id, userId: user.id });
                      Alert.alert(t('common.success'), t('teamDetail.followSuccess'));
                    } catch (error: any) {
                      Alert.alert(t('common.error'), error.message || t('teamDetail.followError'));
                    }
                  }} variant="outline" icon={<Star size={18} color={Colors.primary.blue} />} style={styles.actionButton} />
                </>
              )}
              {isFan && !isMember && (
                <Button title={t('teamDetail.unfollowTeam')} onPress={async () => {
                  if (!user || !team) return;
                  try {
                    await unfollowTeam({ teamId: team.id, userId: user.id });
                    Alert.alert(t('common.success'), t('teamDetail.unfollowSuccess'));
                  } catch (error: any) {
                    Alert.alert(t('common.error'), error.message || t('teamDetail.unfollowError'));
                  }
                }} variant="outline" style={styles.actionButton} />
              )}
              {!isCaptain && isMember && <Button title={t('teamDetail.leaveTeamButton')} onPress={handleLeave} variant="outline" style={styles.actionButton} />}
            </View>
            <View style={styles.bottomSpacer} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>

        <Modal visible={showRequestsModal && canHandleRequests} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('teamDetail.requestsModalTitle', { count: pendingRequests.length })}</Text><TouchableOpacity onPress={() => setShowRequestsModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity></View>
              <ScrollView style={styles.modalScroll}>
                {pendingRequests.map(req => (
                  <View key={req.id} style={styles.requestItem}>
                    <View style={styles.requestInfo}><Text style={styles.requestName}>{resolveMemberUser(req.userId)?.fullName || resolveMemberUser(req.userId)?.username || t('teamDetail.player')}</Text><Text style={styles.requestScore}>{t('teamDetail.compatibility', { score: req.compatibilityScore || 75 })}</Text>{req.message && <Text style={styles.requestMessage}>{req.message}</Text>}</View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRequestAction(req.id, 'accept')}><Check size={20} color="#FFFFFF" /></TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRequestAction(req.id, 'reject')}><X size={20} color="#FFFFFF" /></TouchableOpacity>
                    </View>
                  </View>
                ))}
                {pendingRequests.length === 0 && <Text style={styles.emptyText}>{t('teamDetail.noRequests')}</Text>}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showRoleModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('teamDetail.manageMember')}</Text><TouchableOpacity onPress={() => setShowRoleModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity></View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalLabel}>{t('teamDetail.customRole')}</Text>
                <View style={styles.roleOptions}>{allRoles.map(role => (<TouchableOpacity key={role} style={styles.roleOption} onPress={() => { handleUpdateRole(selectedMember!, role); }}><Text style={styles.roleOptionText}>{role}</Text></TouchableOpacity>))}</View>
                <Text style={styles.modalLabel}>{t('teamDetail.position')}</Text>
                <View style={styles.roleOptions}>{positions.map(pos => (<TouchableOpacity key={pos} style={styles.roleOption} onPress={() => { handleUpdateRole(selectedMember!, team.members.find(m => m.userId === selectedMember)?.customRole || '', pos); }}><Text style={styles.roleOptionText}>{pos}</Text></TouchableOpacity>))}</View>
                {isCaptain && selectedMember && (
                  <>
                    <Text style={styles.modalLabel}>{t('teamDetail.actions')}</Text>
                    {!team.coCaptainIds.includes(selectedMember) ? (
                      <Button title={t('teamDetail.promoteCoCaptain')} onPress={() => { handlePromote(selectedMember, 'co-captain'); setShowRoleModal(false); }} variant="primary" style={styles.modalBtn} />
                    ) : (
                      <Button title={t('teamDetail.demoteMember')} onPress={() => { handlePromote(selectedMember, 'member'); setShowRoleModal(false); }} variant="outline" style={styles.modalBtn} />
                    )}
                    <Button title={t('teamDetail.removeFromTeam')} onPress={() => { handleRemoveMember(selectedMember); setShowRoleModal(false); }} variant="outline" style={[styles.modalBtn, { borderColor: Colors.status.error }]} />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showAddRoleModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}><Text style={styles.modalTitle}>{t('teamDetail.newRole')}</Text><TouchableOpacity onPress={() => setShowAddRoleModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity></View>
              <TextInput style={styles.roleInput} placeholder={t('teamDetail.roleNamePlaceholder')} placeholderTextColor={Colors.text.muted} value={newRoleName} onChangeText={setNewRoleName} />
              <Button title={t('teamDetail.create')} onPress={handleAddCustomRole} variant="primary" disabled={!newRoleName.trim()} />
            </View>
          </View>
        </Modal>

        <Modal visible={showSettingsModal} animationType="slide" transparent>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.settingsModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Paramètres</Text>
                <TouchableOpacity onPress={() => setShowSettingsModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
              </View>
              <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.settingSection}>
                  <Text style={styles.settingSectionTitle}>Informations générales</Text>
                  
                  <Text style={styles.settingLabel}>Nom de l&apos;équipe</Text>
                  <View style={styles.settingInputRow}>
                    <Edit3 size={18} color={Colors.text.muted} />
                    <TextInput 
                      style={styles.settingInput} 
                      value={editName} 
                      onChangeText={setEditName} 
                      placeholder="Nom de l'équipe"
                      placeholderTextColor={Colors.text.muted}
                    />
                  </View>

                  <Text style={styles.settingLabel}>Description</Text>
                  <TextInput 
                    style={[styles.settingInput, styles.settingTextArea]} 
                    value={editDescription} 
                    onChangeText={setEditDescription} 
                    placeholder="Décrivez votre équipe..."
                    placeholderTextColor={Colors.text.muted}
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.settingLabel}>Logo de l'équipe</Text>
                  {editLogo && (
                    <View style={{ alignItems: 'center', marginVertical: 12 }}>
                      <Avatar uri={editLogo} name={editName || 'Équipe'} size="large" />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: Colors.background.cardLight, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 }}
                      onPress={async () => {
                        console.log('[Team] Opening image picker...');
                        const uri = await pickImageFromLibrary();
                        console.log('[Team] Image picker result:', uri);
                        if (uri) {
                          console.log('[Team] Photo sélectionnée depuis galerie:', uri);
                          console.log('[Team] Setting editLogo to:', uri);
                          setEditLogo(uri);
                          console.log('[Team] editLogo state updated');
                        } else {
                          console.log('[Team] No image selected');
                        }
                      }}
                    >
                      <Image size={24} color={Colors.primary.blue} />
                      <Text style={{ color: Colors.text.primary, fontSize: 14, fontWeight: '500' }}>Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: Colors.background.cardLight, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 }}
                      onPress={async () => {
                        const uri = await takePhoto();
                        if (uri) {
                          console.log('[Team] Photo prise avec caméra:', uri);
                          setEditLogo(uri);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>📷</Text>
                      <Text style={{ color: Colors.text.primary, fontSize: 14, fontWeight: '500' }}>Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.settingSection}>
                  <Text style={styles.settingSectionTitle}>Recrutement</Text>
                  
                  <View style={styles.settingRow}>
                    <View style={styles.settingRowInfo}>
                      {editIsRecruiting ? <Unlock size={20} color={Colors.status.success} /> : <Lock size={20} color={Colors.text.muted} />}
                      <View style={styles.settingRowText}>
                        <Text style={styles.settingRowTitle}>Recrutement ouvert</Text>
                        <Text style={styles.settingRowDesc}>{editIsRecruiting ? 'Les joueurs peuvent demander à rejoindre' : 'Aucune demande acceptée'}</Text>
                      </View>
                    </View>
                    <Switch 
                      value={editIsRecruiting} 
                      onValueChange={setEditIsRecruiting}
                      trackColor={{ false: Colors.background.cardLight, true: Colors.status.success }}
                      thumbColor="#FFF"
                    />
                  </View>

                  <Text style={styles.settingLabel}>Nombre max de membres</Text>
                  <View style={styles.memberCountRow}>
                    {[5, 7, 11, 15, 20].map(num => (
                      <TouchableOpacity 
                        key={num} 
                        style={[styles.memberCountBtn, editMaxMembers === num && styles.memberCountBtnActive]}
                        onPress={() => setEditMaxMembers(num)}
                      >
                        <Text style={[styles.memberCountText, editMaxMembers === num && styles.memberCountTextActive]}>{num}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingSection}>
                  <Text style={styles.settingSectionTitle}>Niveau et ambiance</Text>
                  
                  <Text style={styles.settingLabel}>Niveau de jeu</Text>
                  <View style={styles.optionsRow}>
                    {(['beginner', 'intermediate', 'advanced', 'expert'] as SkillLevel[]).map(level => (
                      <TouchableOpacity 
                        key={level} 
                        style={[styles.optionBtn, editLevel === level && styles.optionBtnActive]}
                        onPress={() => setEditLevel(level)}
                      >
                        <Text style={[styles.optionText, editLevel === level && styles.optionTextActive]}>{levelLabels[level]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.settingLabel}>Ambiance</Text>
                  <View style={styles.optionsRow}>
                    {(['competitive', 'casual', 'mixed'] as PlayStyle[]).map(ambiance => (
                      <TouchableOpacity 
                        key={ambiance} 
                        style={[styles.optionBtn, editAmbiance === ambiance && styles.optionBtnActive]}
                        onPress={() => setEditAmbiance(ambiance)}
                      >
                        <Text style={[styles.optionText, editAmbiance === ambiance && styles.optionTextActive]}>{ambianceLabels[ambiance]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingSection}>
                  <Text style={styles.settingSectionTitle}>Gestion avancée</Text>
                  
                  <TouchableOpacity style={styles.advancedRow} onPress={() => { setShowSettingsModal(false); setShowTransferModal(true); }}>
                    <Crown size={20} color={Colors.primary.orange} />
                    <View style={styles.advancedRowText}>
                      <Text style={styles.advancedRowTitle}>Transférer le capitanat</Text>
                      <Text style={styles.advancedRowDesc}>Donner le rôle de capitaine à un membre</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.text.muted} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.advancedRow} onPress={() => setShowAddRoleModal(true)}>
                    <Plus size={20} color={Colors.primary.blue} />
                    <View style={styles.advancedRowText}>
                      <Text style={styles.advancedRowTitle}>Créer un rôle personnalisé</Text>
                      <Text style={styles.advancedRowDesc}>Ajouter des rôles spécifiques</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.text.muted} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.settingSection, styles.dangerSection]}>
                  <Text style={[styles.settingSectionTitle, { color: Colors.status.error }]}>Zone de danger</Text>
                  
                  <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteTeam}>
                    <Trash2 size={20} color={Colors.status.error} />
                    <View style={styles.advancedRowText}>
                      <Text style={[styles.advancedRowTitle, { color: Colors.status.error }]}>Dissoudre l&apos;équipe</Text>
                      <Text style={styles.advancedRowDesc}>Cette action est irréversible</Text>
                    </View>
                    <AlertTriangle size={20} color={Colors.status.error} />
                  </TouchableOpacity>
                </View>

                <Button 
                  title="Enregistrer les modifications" 
                  onPress={handleSaveSettings} 
                  variant="primary" 
                  loading={isUpdating}
                  style={styles.saveBtn}
                />
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={showTransferModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transférer le capitanat</Text>
                <TouchableOpacity onPress={() => setShowTransferModal(false)}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.transferWarning}>
                  Sélectionnez le membre qui deviendra le nouveau capitaine. Vous perdrez vos droits de capitaine et deviendrez un membre normal.
                </Text>
                {otherMembers.map(member => {
                  const memberUser = resolveMemberUser(member.userId);
                  return (
                    <TouchableOpacity 
                      key={member.userId} 
                      style={styles.transferMemberRow}
                      onPress={() => handleTransferCaptaincy(member.userId)}
                    >
                      <Avatar uri={memberUser?.avatar} name={memberUser?.fullName} size="medium" />
                      <View style={styles.transferMemberInfo}>
                        <Text style={styles.transferMemberName}>{memberUser?.fullName || 'Membre'}</Text>
                        <Text style={styles.transferMemberRole}>
                          {member.role === 'co-captain' ? 'Co-capitaine' : 'Membre'} • {member.customRole || member.position || '-'}
                        </Text>
                      </View>
                      <Crown size={20} color={Colors.primary.orange} />
                    </TouchableOpacity>
                  );
                })}
                {otherMembers.length === 0 && (
                  <Text style={styles.emptyText}>Aucun autre membre dans l'équipe</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: 10 },
  requestsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 22 },
  requestsCount: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: Colors.text.primary, fontSize: 18 },
  teamHeader: { alignItems: 'center', marginBottom: 24 },
  teamName: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const, marginTop: 16 },
  teamMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.text.secondary, fontSize: 14 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.text.muted },
  badges: { flexDirection: 'row', gap: 8, marginTop: 16 },
  badge: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '500' as const },
  recruitingBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  recruitingText: { color: Colors.status.success },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 107, 0, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 12 },
  memberBadgeText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '600' as const },
  descriptionCard: { marginBottom: 20 },
  description: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
  accessCard: { marginBottom: 24, flexDirection: 'column', alignItems: 'center', padding: 20, gap: 12 },
  accessTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  accessText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' as const },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  reputationCard: { marginBottom: 24 },
  reputationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reputationInfo: { flex: 1 },
  reputationLabel: { color: Colors.text.muted, fontSize: 12 },
  reputationValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  cashPrize: { alignItems: 'flex-end' },
  cashPrizeLabel: { color: Colors.text.muted, fontSize: 12 },
  cashPrizeValue: { color: Colors.primary.orange, fontSize: 16, fontWeight: '700' as const },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  previewMembersHint: { color: Colors.text.muted, fontSize: 12, marginBottom: 12 },
  organizerBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary.orange + '25', alignItems: 'center', justifyContent: 'center' },
  addRoleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addRoleBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' as const },
  memberCard: { marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberInfo: { flex: 1 },
  memberName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  memberPosition: { color: Colors.text.muted, fontSize: 13 },
  roleBadge: { backgroundColor: Colors.background.cardLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  captainRole: { backgroundColor: Colors.primary.orange },
  roleText: { color: Colors.text.primary, fontSize: 11, fontWeight: '600' as const },
  actions: { gap: 12, marginBottom: 20 },
  actionButton: { width: '100%' },
  bottomSpacer: { height: 40 },
  fansCard: { marginBottom: 16 },
  fansDescription: { color: Colors.text.secondary, fontSize: 14, marginBottom: 12 },
  fansList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  fanItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fanName: { color: Colors.text.primary, fontSize: 13 },
  fansMore: { color: Colors.text.muted, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  settingsModalContent: { backgroundColor: Colors.background.dark, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 16 },
  modalTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  modalScroll: { maxHeight: 400 },
  settingsScroll: { paddingHorizontal: 20 },
  modalLabel: { color: Colors.text.secondary, fontSize: 14, fontWeight: '500' as const, marginTop: 16, marginBottom: 8 },
  requestItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  requestInfo: { flex: 1 },
  requestName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  requestScore: { color: Colors.status.success, fontSize: 13, marginTop: 2 },
  requestMessage: { color: Colors.text.muted, fontSize: 13, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.status.success, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.status.error, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.background.card },
  roleOptionText: { color: Colors.text.secondary, fontSize: 13 },
  modalBtn: { marginTop: 12 },
  roleInput: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, color: Colors.text.primary, fontSize: 16, marginBottom: 16 },
  settingSection: { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  settingSectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 16 },
  settingLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const, marginBottom: 8, marginTop: 12 },
  settingInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 12, paddingHorizontal: 16 },
  settingInput: { flex: 1, color: Colors.text.primary, fontSize: 15, paddingVertical: 14 },
  settingTextArea: { backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, minHeight: 100, textAlignVertical: 'top' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background.card, borderRadius: 12, padding: 16 },
  settingRowInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingRowText: { flex: 1 },
  settingRowTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  settingRowDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  memberCountRow: { flexDirection: 'row', gap: 8 },
  memberCountBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.background.card, alignItems: 'center' },
  memberCountBtnActive: { backgroundColor: Colors.primary.blue },
  memberCountText: { color: Colors.text.secondary, fontSize: 15, fontWeight: '600' as const },
  memberCountTextActive: { color: '#FFF' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background.card },
  optionBtnActive: { backgroundColor: Colors.primary.blue },
  optionText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' as const },
  optionTextActive: { color: '#FFF' },
  advancedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 12, padding: 16, marginBottom: 8 },
  advancedRowText: { flex: 1 },
  advancedRowTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  advancedRowDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  dangerSection: { borderBottomWidth: 0, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveBtn: { marginTop: 8 },
  transferWarning: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20, marginBottom: 20, padding: 16, backgroundColor: 'rgba(255,107,0,0.1)', borderRadius: 12 },
  transferMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  transferMemberInfo: { flex: 1 },
  transferMemberName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  transferMemberRole: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
});
