import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, Trophy, MapPin, Star, Settings, ArrowLeft, ChevronRight, ChevronDown, Crown, Shield, UserPlus, MessageCircle, Info, Trash2, Camera, X, Check, Edit3, Image as ImageIcon, Lock, Unlock, AlertTriangle, Heart, Megaphone, Pause, Play, ShieldCheck } from 'lucide-react-native';
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
import { uploadTeamImage, uploadTeamPhoto } from '@/lib/uploadImage';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels, ambianceLabels, TEAM_ROLES, DEFAULT_POSITIONS } from '@/mocks/data';
import { SkillLevel, PlayStyle } from '@/types';
import type { Team, User, TeamPhoto, CMAssignment, CMPermissions } from '@/types';
import { DEFAULT_CM_PERMISSIONS } from '@/types';
import { suggestionsApi, type PlayerSuggestion } from '@/lib/api/suggestions';
import { notificationsApi } from '@/lib/api/notifications';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { getTeamById, sendJoinRequest, leaveTeam, handleRequest, updateMemberRole, addCustomRole, promoteMember, removeMember, getPendingRequests, updateTeam, deleteTeam, transferCaptaincy, followTeam, unfollowTeam, isUpdating, refetchTeams, getUserTeams, assignCM, removeCM, updateCMPermissions, suspendCM, reactivateCM } = useTeams();
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
  const [showSuggestedRecruits, setShowSuggestedRecruits] = useState(false);
  const [memberUsers, setMemberUsers] = useState<Record<string, User>>({});
  const hydratedTeamMembersRef = useRef<Record<string, boolean>>({});
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [showDissolveModal, setShowDissolveModal] = useState(false);
  const [dissolveReason, setDissolveReason] = useState('');
  const [dissolving, setDissolving] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<TeamPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [viewerPhoto, setViewerPhoto] = useState<TeamPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'gallery'>('members');
  const [newFeedCount, setNewFeedCount] = useState(0);
  const [cmAssignments, setCMAssignments] = useState<CMAssignment[]>([]);
  const [showCMModal, setShowCMModal] = useState(false);
  const [cmTargetUserId, setCmTargetUserId] = useState<string | null>(null);
  const [cmPermissions, setCmPermissions] = useState<CMPermissions>(DEFAULT_CM_PERMISSIONS);
  const [cmLoading, setCmLoading] = useState(false);

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

  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const refetchTeamsRef = useRef(refetchTeams);
  refetchTeamsRef.current = refetchTeams;

  useFocusEffect(
    useCallback(() => {
      // Always load fresh from DB on focus — bypasses stale cache
      if (id) {
        setLoadingTeam(true);
        teamsApi.getById(id)
          .then(t => setFetchedTeam(t))
          .catch(() => {})
          .finally(() => setLoadingTeam(false));
        // Load gallery photos
        setLoadingPhotos(true);
        teamsApi.getTeamPhotos(id)
          .then(photos => setGalleryPhotos(photos))
          .catch(() => {})
          .finally(() => setLoadingPhotos(false));
        // Load CM assignments
        teamsApi.getCMs(id)
          .then(cms => setCMAssignments(cms))
          .catch(() => {});
      }
      // Refresh user so user.teams is up-to-date (updated when captain accepts)
      refreshUserRef.current();
      refetchTeamsRef.current();
    }, [id])
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

  // Count new feed posts since last visit
  useEffect(() => {
    if (!id) return;
    const checkNewPosts = async () => {
      try {
        const lastVisitKey = `feed_last_visit_${id}`;
        const lastVisit = await AsyncStorage.getItem(lastVisitKey);
        const posts = await teamsApi.getTeamPosts(id, 30, 0);
        if (lastVisit) {
          const lastDate = new Date(lastVisit);
          const newCount = posts.filter(p => p.createdAt > lastDate).length;
          setNewFeedCount(newCount);
        } else if (posts.length > 0) {
          setNewFeedCount(posts.length);
        }
      } catch {}
    };
    checkNewPosts();
  }, [id]);

  const memberRole = team?.members.find(m => m.userId === user?.id)?.role;
  const pendingRequests = team ? getPendingRequests(team.id) : [];
  const allRoles = team ? [...TEAM_ROLES, ...team.customRoles.map(r => r.name)] : [...TEAM_ROLES];
  const positions = team ? (DEFAULT_POSITIONS[team.sport] || DEFAULT_POSITIONS.default) : DEFAULT_POSITIONS.default;
  const resolveMemberUser = (memberUserId: string) => memberUsers[memberUserId] || users.find((u) => u.id === memberUserId);

  const excludeIds = team ? [
    ...team.members.map(m => m.userId),
    ...team.joinRequests.filter(r => r.status === 'pending').map(r => r.userId),
    ...(user?.id ? [user.id] : []),
  ] : [];

  const recruitSuggestions = useQuery<PlayerSuggestion[]>({
    queryKey: ['recruitSuggestions', team?.id],
    queryFn: () => suggestionsApi.suggestPlayersForTeam(team!.id, {
      sport: team!.sport,
      level: team!.level,
      city: team!.city,
      excludeUserIds: excludeIds,
      limit: 5,
    }),
    enabled: !!team && isCaptain && team.isRecruiting && team.members.length < team.maxMembers,
    staleTime: 60_000,
  });

  const handleInvitePlayer = async (playerId: string, playerName: string) => {
    if (!team || !user) return;
    Alert.alert(
      'Inviter à rejoindre',
      `Envoyer une invitation à ${playerName} pour rejoindre ${team.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Inviter', onPress: async () => {
          try {
            await notificationsApi.send(playerId, {
              type: 'team',
              title: 'Invitation à rejoindre une équipe',
              message: `${user.fullName || user.username} vous invite à rejoindre l'équipe "${team.name}".`,
              data: { route: `/team/${team.id}` },
            });
            Alert.alert('Invitation envoyée', `${playerName} a été notifié.`);
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible d\'envoyer l\'invitation.');
          }
        }},
      ]
    );
  };

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

  // Initialize edit fields only when the settings modal opens,
  // not on every team change (which would overwrite user input)
  useEffect(() => {
    if (team && showSettingsModal) {
      setEditName(team.name);
      setEditDescription(team.description || '');
      setEditLogo(team.logo || '');
      setEditIsRecruiting(team.isRecruiting);
      setEditMaxMembers(team.maxMembers);
      setEditLevel(team.level);
      setEditAmbiance(team.ambiance);
    }
  }, [showSettingsModal]);

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
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
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
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
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

  const handleOpenAddPhoto = async () => {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    setPendingPhotoUri(uri);
    setPhotoCaption('');
    setShowAddPhotoModal(true);
  };

  const handleConfirmAddPhoto = async () => {
    if (!team || !user || !pendingPhotoUri) return;
    try {
      setUploadingPhoto(true);
      const imageUrl = await uploadTeamPhoto(pendingPhotoUri, team.id, user.id);
      await teamsApi.addTeamPhoto(team.id, user.id, imageUrl, photoCaption.trim() || undefined);
      const photos = await teamsApi.getTeamPhotos(team.id);
      setGalleryPhotos(photos);
      setShowAddPhotoModal(false);
      setPendingPhotoUri(null);
      setPhotoCaption('');
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photo: TeamPhoto) => {
    const isOwner = photo.userId === user?.id;
    Alert.alert('Supprimer la photo', isOwner ? 'Supprimer cette photo de la galerie ?' : 'Supprimer cette photo de la galerie en tant que capitaine ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await teamsApi.deleteTeamPhoto(photo.id);
          setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id));
          setViewerPhoto(null);
        } catch (e: any) {
          Alert.alert('Erreur', 'Impossible de supprimer la photo');
        }
      } },
    ]);
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

  const handlePromote = (userId: string, role: 'co-captain' | 'member' | 'cm') => {
    const labels: Record<string, string> = { 'co-captain': 'co-capitaine', 'cm': 'Community Manager', 'member': 'membre' };
    Alert.alert(t('teamDetail.confirmTitle'), `Promouvoir en tant que ${labels[role]} ?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await promoteMember({ teamId: team.id, userId, role, promoterId: user!.id });
            const msg = role === 'co-captain'
              ? { title: '⭐ Promotion', message: `Vous avez été promu co-capitaine de ${team.name}.` }
              : role === 'cm'
              ? { title: '📱 Promotion CM', message: `Vous êtes maintenant Community Manager de ${team.name}. Vous pouvez publier au nom de l'équipe. Rendez-vous sur le feed d'équipe pour commencer.` }
              : { title: 'Rôle mis à jour', message: `Votre rôle dans ${team.name} a été mis à jour.` };
            await addNotification({ userId, type: 'team', ...msg, data: { route: role === 'cm' ? `/team-feed/${team.id}` : `/team/${team.id}` } });
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

  // ════ CM System Handlers ════

  const MAX_CMS = 3;

  const activeCMs = cmAssignments.filter(cm => cm.status === 'active');
  const getCMAssignment = (userId: string) => cmAssignments.find(cm => cm.userId === userId);

  const handleAssignCM = useCallback((userId: string) => {
    if (!team || !user) return;
    if (activeCMs.length >= MAX_CMS && !getCMAssignment(userId)) {
      Alert.alert('Limite atteinte', `Vous avez déjà ${MAX_CMS} Community Managers actifs. Suspendez ou retirez-en un d'abord.`);
      return;
    }
    const member = team.members.find(m => m.userId === userId);
    if (!member) {
      Alert.alert('Erreur', 'Ce membre n\'a pas été trouvé.');
      return;
    }
    setCmTargetUserId(userId);
    const existing = getCMAssignment(userId);
    setCmPermissions(existing?.permissions || DEFAULT_CM_PERMISSIONS);
    setShowCMModal(true);
  }, [team, user, activeCMs.length, cmAssignments]);

  const handleSaveCM = useCallback(async () => {
    if (!team || !user || !cmTargetUserId) return;
    setCmLoading(true);
    try {
      const existing = getCMAssignment(cmTargetUserId);
      if (existing) {
        await updateCMPermissions({ teamId: team.id, userId: cmTargetUserId, permissions: cmPermissions });
        const permList: string[] = [];
        if (cmPermissions.can_post) permList.push('publier des posts');
        if (cmPermissions.can_delete_posts) permList.push('supprimer des posts');
        if (cmPermissions.can_manage_photos) permList.push('gérer les photos');
        if (cmPermissions.can_pin_posts) permList.push('épingler des posts');
        await addNotification({
          userId: cmTargetUserId,
          type: 'team',
          title: '📱 Permissions CM mises à jour',
          message: `Vos permissions ont été modifiées sur ${team.name}. Vous pouvez maintenant : ${permList.length > 0 ? permList.join(', ') : 'aucune permission active'}.`,
          data: { route: `/team-feed/${team.id}` },
        });
      } else {
        await assignCM({ teamId: team.id, userId: cmTargetUserId, captainId: user.id, permissions: cmPermissions });
        const permList: string[] = [];
        if (cmPermissions.can_post) permList.push('publier des posts');
        if (cmPermissions.can_delete_posts) permList.push('supprimer des posts');
        if (cmPermissions.can_manage_photos) permList.push('gérer les photos');
        if (cmPermissions.can_pin_posts) permList.push('épingler des posts');
        await addNotification({
          userId: cmTargetUserId,
          type: 'team',
          title: '📱 Promotion Community Manager',
          message: `Vous êtes maintenant Community Manager de ${team.name}. Vous pouvez : ${permList.join(', ')}.`,
          data: { route: `/team-feed/${team.id}` },
        });
      }
      const cms = await teamsApi.getCMs(team.id);
      setCMAssignments(cms);
      setShowCMModal(false);
      setCmTargetUserId(null);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setCmLoading(false);
    }
  }, [team, user, cmTargetUserId, cmPermissions, cmAssignments]);

  const handleRemoveCM = useCallback((userId: string) => {
    if (!team) return;
    const cmUser = resolveMemberUser(userId);
    Alert.alert(
      'Retirer le CM',
      `Retirer ${cmUser?.fullName || cmUser?.username || 'ce membre'} du rôle de Community Manager ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCM({ teamId: team.id, userId });
              const cms = await teamsApi.getCMs(team.id);
              setCMAssignments(cms);
              await addNotification({
                userId,
                type: 'team',
                title: 'Rôle CM retiré',
                message: `Vous n'êtes plus Community Manager de ${team.name}.`,
                data: { route: `/team/${team.id}` },
              });
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          },
        },
      ]
    );
  }, [team]);

  const handleSuspendCM = useCallback((userId: string) => {
    if (!team) return;
    Alert.alert(
      'Suspendre le CM',
      'Suspendre temporairement ce Community Manager ? Il perdra ses permissions mais restera membre.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Suspendre',
          onPress: async () => {
            try {
              await suspendCM({ teamId: team.id, userId });
              const cms = await teamsApi.getCMs(team.id);
              setCMAssignments(cms);
              await addNotification({
                userId,
                type: 'team',
                title: '⏸️ CM Suspendu',
                message: `Vos permissions de Community Manager ont été suspendues sur ${team.name}. Vous restez membre de l'équipe.`,
                data: { route: `/team/${team.id}` },
              });
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          },
        },
      ]
    );
  }, [team]);

  const handleReactivateCM = useCallback((userId: string) => {
    if (!team) return;
    Alert.alert(
      'Réactiver le CM',
      'Réactiver ce Community Manager ? Il retrouvera ses permissions.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réactiver',
          onPress: async () => {
            try {
              await reactivateCM({ teamId: team.id, userId });
              const cms = await teamsApi.getCMs(team.id);
              setCMAssignments(cms);
              await addNotification({
                userId,
                type: 'team',
                title: '✅ CM Réactivé',
                message: `Vos permissions de Community Manager ont été réactivées sur ${team.name}. Vous pouvez à nouveau publier au nom de l'équipe.`,
                data: { route: `/team-feed/${team.id}` },
              });
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          },
        },
      ]
    );
  }, [team]);

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
    // Close settings modal first — Alert.alert inside a Modal can fail on Android
    setShowSettingsModal(false);

    const isCreator = team.creatorId === user?.id;
    const isAdminUser = user?.role === 'admin';

    // Creator or admin can dissolve directly
    if (isCreator || isAdminUser) {
      setTimeout(() => {
        Alert.alert(
          isCreator ? 'Dissoudre l\'équipe' : 'Supprimer l\'équipe (Admin)',
          isCreator
            ? `Êtes-vous sûr de vouloir dissoudre "${team.name}" ? Cette action est irréversible.`
            : `Êtes-vous sûr de vouloir supprimer l'équipe "${team.name}" en tant qu'administrateur ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Dissoudre',
              style: 'destructive',
              onPress: async () => {
                try {
                  setDissolving(true);
                  const memberIds = team.members.map((m) => m.userId).filter((id) => id !== user!.id);
                  await deleteTeam({ teamId: team.id, userId: user!.id, asAdmin: isAdminUser });
                  for (const uid of memberIds) {
                    await addNotification({
                      userId: uid,
                      type: 'team',
                      title: 'Équipe dissoute',
                      message: `L'équipe ${team.name} a été dissoute.`,
                      data: { route: '/(tabs)/teams' },
                    });
                  }
                  safeBack(router, '/(tabs)/teams');
                  Alert.alert('Succès', 'L\'équipe a été dissoute avec succès.');
                } catch (e: any) {
                  Alert.alert('Erreur', e.message);
                } finally {
                  setDissolving(false);
                }
              },
            },
          ]
        );
      }, 100);
      return;
    }

    // Non-creator captain must submit a dissolution request
    if (team.captainId === user?.id) {
      setTimeout(() => {
        Alert.alert(
          'Approbation administrateur requise',
          `En tant que capitaine non-créateur de "${team.name}", vous ne pouvez pas dissoudre l'équipe directement.\n\nSouhaitez-vous soumettre une demande de dissolution qui sera examinée par un administrateur ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Soumettre une demande',
              onPress: () => {
                setDissolveReason('');
                setShowDissolveModal(true);
              },
            },
          ]
        );
      }, 100);
      return;
    }

    // Not captain or creator
    setTimeout(() => {
      Alert.alert(
        'Action non autorisée',
        'Seul le créateur de l\'équipe ou un administrateur peut dissoudre l\'équipe.',
        [{ text: 'OK' }]
      );
    }, 100);
  };

  const handleSubmitDissolutionRequest = async () => {
    if (!dissolveReason.trim()) {
      Alert.alert('Raison requise', 'Veuillez expliquer pourquoi vous souhaitez dissoudre cette équipe.');
      return;
    }
    try {
      setDissolving(true);
      await teamsApi.createDissolutionRequest(team.id, user!.id, dissolveReason.trim());
      setShowDissolveModal(false);
      setDissolveReason('');
      Alert.alert(
        'Demande envoyée',
        'Votre demande de dissolution a été envoyée aux administrateurs. Vous serez notifié de la décision.'
      );
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setDissolving(false);
    }
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
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
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
                {(team.fans ?? []).length > 0 && (
                  <>
                    <View style={styles.metaDot} />
                    <View style={styles.metaItem}><Heart size={13} color={Colors.status.error} /><Text style={styles.metaText}>{(team.fans ?? []).length} abonnés</Text></View>
                  </>
                )}
              </View>
              <View style={styles.badges}>
                <View style={styles.badge}><Text style={styles.badgeText}>{levelLabels[team.level]}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{ambianceLabels[team.ambiance]}</Text></View>
                {team.isRecruiting && <View style={[styles.badge, styles.recruitingBadge]}><Text style={[styles.badgeText, styles.recruitingText]}>{t('teamDetail.recruit')}</Text></View>}
              </View>
              {isMember && memberRole && (
                <View style={styles.memberBadge}><Shield size={14} color={Colors.primary.orange} /><Text style={styles.memberBadgeText}>{memberRole === 'captain' ? t('teamDetail.captain') : memberRole === 'co-captain' ? t('teamDetail.coCaptain') : memberRole === 'cm' ? 'Community Manager' : t('teamDetail.member')}</Text></View>
              )}

              {/* ════ Follow / Unfollow button — prominent, right under team header ════ */}
              {!isMember && !isFan && (
                <TouchableOpacity
                  style={styles.followBtn}
                  onPress={async () => {
                    if (!user || !team) return;
                    try {
                      await followTeam({ teamId: team.id, userId: user.id });
                      loadFreshTeam();
                    } catch (error: any) {
                      Alert.alert(t('common.error'), error.message || t('teamDetail.followError'));
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Star size={18} color="#FFFFFF" />
                  <Text style={styles.followBtnText}>{t('teamDetail.followTeam')}</Text>
                </TouchableOpacity>
              )}
              {!isMember && isFan && (
                <TouchableOpacity
                  style={styles.followingBtn}
                  onPress={async () => {
                    if (!user || !team) return;
                    try {
                      await unfollowTeam({ teamId: team.id, userId: user.id });
                      loadFreshTeam();
                    } catch (error: any) {
                      Alert.alert(t('common.error'), error.message || t('teamDetail.unfollowError'));
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Check size={18} color={Colors.status.success} />
                  <Text style={styles.followingBtnText}>{t('teamDetail.unfollowTeam')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {previewForNonMember ? (
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

            {/* ════ TABS: Members / Gallery ════ */}
            <View style={styles.tabContainer}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'members' && styles.tabItemActive]}
                  onPress={() => setActiveTab('members')}
                >
                  <Users size={16} color={activeTab === 'members' ? '#FFFFFF' : Colors.text.muted} />
                  <Text style={[styles.tabItemText, activeTab === 'members' && styles.tabItemTextActive]}>
                    {t('teamDetail.members', { count: team.members.length, max: team.maxMembers })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'gallery' && styles.tabItemActive]}
                  onPress={() => setActiveTab('gallery')}
                >
                  <Camera size={16} color={activeTab === 'gallery' ? '#FFFFFF' : Colors.text.muted} />
                  <Text style={[styles.tabItemText, activeTab === 'gallery' && styles.tabItemTextActive]}>
                    Galerie {galleryPhotos.length > 0 ? `(${galleryPhotos.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'members' && (
                <View style={styles.membersGrid}>
                  {team.members.map((member, i) => {
                    const memberUser = member.userId === user?.id ? user : resolveMemberUser(member.userId);
                    const isCap = member.userId === team.captainId;
                    const isCo = member.role === 'co-captain';
                    const isCM = member.role === 'cm';
                    return (
                      <View key={i} style={styles.memberGridCard}>
                        <Avatar
                          uri={memberUser?.avatar}
                          name={memberUser?.fullName || memberUser?.username}
                          size="large"
                        />
                        {isCap && (
                          <View style={styles.memberGridCrown}>
                            <Crown size={12} color="#FFF" />
                          </View>
                        )}
                        <Text style={styles.memberGridName} numberOfLines={1}>
                          {memberUser?.fullName || memberUser?.username || t('teamDetail.member')}
                        </Text>
                        <View style={[styles.memberGridRoleBadge,
                          isCap ? styles.memberGridRoleCaptain :
                          isCo ? styles.memberGridRoleCoCaptain :
                          isCM ? styles.memberGridRoleCM : styles.memberGridRoleMember
                        ]}>
                          <Text style={styles.memberGridRoleText}>
                            {isCap ? t('teamDetail.captain') : isCo ? t('teamDetail.coCaptain') : isCM ? 'CM' : t('teamDetail.member')}
                          </Text>
                        </View>
                        {memberUser && (
                          <View style={styles.memberGridStats}>
                            <View style={styles.memberGridStat}>
                              <Text style={styles.memberGridStatValue}>{memberUser.stats?.matchesPlayed ?? 0}</Text>
                              <Text style={styles.memberGridStatLabel}>Matchs</Text>
                            </View>
                            <View style={styles.memberGridStatDivider} />
                            <View style={styles.memberGridStat}>
                              <Text style={styles.memberGridStatValue}>{memberUser.stats?.wins ?? 0}</Text>
                              <Text style={styles.memberGridStatLabel}>Victoires</Text>
                            </View>
                            <View style={styles.memberGridStatDivider} />
                            <View style={styles.memberGridStat}>
                              <Text style={[styles.memberGridStatValue, { color: '#F59E0B' }]}>{memberUser.reputation?.toFixed(1) ?? '0.0'}</Text>
                              <Text style={styles.memberGridStatLabel}>Rep</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {activeTab === 'gallery' && (
                <View style={styles.tabContent}>
                  {loadingPhotos ? (
                    <View style={styles.galleryEmptyState}>
                      <ActivityIndicator size="large" color={Colors.primary.orange} />
                      <Text style={styles.galleryEmptyStateText}>Chargement de la galerie...</Text>
                    </View>
                  ) : galleryPhotos.length === 0 ? (
                    <View style={styles.galleryEmptyState}>
                      <View style={styles.galleryEmptyIconWrap}>
                        <Camera size={40} color={Colors.primary.blue} />
                      </View>
                      <Text style={styles.galleryEmptyStateTitle}>Aucune photo</Text>
                      <Text style={styles.galleryEmptyStateDesc}>Les moments de l'équipe apparaîtront ici</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.galleryMosaic}>
                        <View style={styles.galleryMosaicCol}>
                          {galleryPhotos.filter((_, i) => i % 2 === 0).slice(0, 6).map((photo, idx) => {
                            const realIdx = galleryPhotos.indexOf(photo);
                            const isLarge = realIdx === 0;
                            return (
                              <TouchableOpacity
                                key={photo.id}
                                style={[styles.galleryMosaicItem, isLarge && styles.galleryMosaicItemLarge]}
                                onPress={() => setViewerPhoto(photo)}
                                activeOpacity={0.9}
                              >
                                <ExpoImage
                                  source={{ uri: photo.imageUrl }}
                                  style={styles.galleryMosaicImg}
                                  contentFit="cover"
                                  transition={150}
                                />
                                {photo.caption ? (
                                  <View style={styles.galleryMosaicCaption}>
                                    <Text style={styles.galleryMosaicCaptionText} numberOfLines={1}>{photo.caption}</Text>
                                  </View>
                                ) : null}
                                {isLarge && (
                                  <View style={styles.galleryMosaicBadge}>
                                    <Camera size={10} color="#FFFFFF" />
                                    <Text style={styles.galleryMosaicBadgeText}>{galleryPhotos.length}</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={styles.galleryMosaicCol}>
                          {galleryPhotos.filter((_, i) => i % 2 === 1).slice(0, 6).map((photo) => (
                            <TouchableOpacity
                              key={photo.id}
                              style={styles.galleryMosaicItem}
                              onPress={() => setViewerPhoto(photo)}
                              activeOpacity={0.9}
                            >
                              <ExpoImage
                                source={{ uri: photo.imageUrl }}
                                style={styles.galleryMosaicImg}
                                contentFit="cover"
                                transition={150}
                              />
                              {photo.caption ? (
                                <View style={styles.galleryMosaicCaption}>
                                  <Text style={styles.galleryMosaicCaptionText} numberOfLines={1}>{photo.caption}</Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                          {galleryPhotos.length > 12 && (
                            <TouchableOpacity
                              style={styles.galleryMosaicMore}
                              onPress={() => router.push(`/team-gallery/${team.id}` as any)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.galleryMosaicMoreText}>+{galleryPhotos.length - 12}</Text>
                              <Text style={styles.galleryMosaicMoreSub}>Voir tout</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={styles.gallerySeeAllBtn} onPress={() => router.push(`/team-gallery/${team.id}` as any)}>
                        <Text style={styles.gallerySeeAllText}>Voir toute la galerie</Text>
                        <ChevronRight size={16} color={Colors.primary.blue} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

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
              <Button title="Feed d'équipe" onPress={() => router.push(`/team-feed/${team.id}` as any)} variant="outline" icon={<Megaphone size={18} color={Colors.primary.orange} />} style={styles.actionButton} />
              {newFeedCount > 0 && (
                <View style={styles.feedBadge}>
                  <Text style={styles.feedBadgeText}>{newFeedCount > 9 ? '9+' : newFeedCount}</Text>
                </View>
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

            {/* ════ TABS: Members / Gallery ════ */}
            <View style={styles.tabContainer}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'members' && styles.tabItemActive]}
                  onPress={() => setActiveTab('members')}
                >
                  <Users size={16} color={activeTab === 'members' ? '#FFFFFF' : Colors.text.muted} />
                  <Text style={[styles.tabItemText, activeTab === 'members' && styles.tabItemTextActive]}>
                    {t('teamDetail.members', { count: team.members.length, max: team.maxMembers })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'gallery' && styles.tabItemActive]}
                  onPress={() => setActiveTab('gallery')}
                >
                  <Camera size={16} color={activeTab === 'gallery' ? '#FFFFFF' : Colors.text.muted} />
                  <Text style={[styles.tabItemText, activeTab === 'gallery' && styles.tabItemTextActive]}>
                    Galerie {galleryPhotos.length > 0 ? `(${galleryPhotos.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'members' && (
                <View style={styles.tabContent}>
                  {/* ════ CM Section ════ */}
                  <View style={styles.cmSection}>
                    <View style={styles.cmSectionHeader}>
                      <View style={styles.cmSectionTitleRow}>
                        <Megaphone size={18} color={Colors.primary.blue} />
                        <Text style={styles.cmSectionTitle}>Community Managers</Text>
                      </View>
                      <View style={styles.cmCountBadge}>
                        <Text style={styles.cmCountText}>{activeCMs.length}/{MAX_CMS}</Text>
                      </View>
                    </View>
                    <Text style={styles.cmSectionDesc}>
                      Les CM gèrent le contenu de l'équipe (posts, photos) au nom du capitaine.
                    </Text>

                    {cmAssignments.length === 0 ? (
                      <View style={styles.cmEmpty}>
                        <Megaphone size={28} color={Colors.text.muted} strokeWidth={1.5} />
                        <Text style={styles.cmEmptyText}>Aucun Community Manager</Text>
                        {isCaptain && (
                          <Text style={styles.cmEmptyHint}>
                            Choisissez « Gérer CM » sur un membre ci-dessous pour le promouvoir
                          </Text>
                        )}
                      </View>
                    ) : (
                      cmAssignments.map((cm) => {
                        const cmUser = resolveMemberUser(cm.userId);
                        const isActive = cm.status === 'active';
                        return (
                          <Card key={cm.id} style={[styles.cmMemberCard, !isActive && styles.cmMemberCardSuspended]}>
                            <View style={styles.memberRow}>
                              <Avatar
                                uri={cm.userId === user?.id ? user?.avatar : cmUser?.avatar}
                                name={cm.userId === user?.id ? user?.fullName : cmUser?.fullName || cmUser?.username}
                                size="medium"
                              />
                              <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>
                                  {cm.userId === user?.id ? user?.fullName : cmUser?.fullName || cmUser?.username || 'Membre'}
                                </Text>
                                <View style={styles.cmPermChips}>
                                  {cm.permissions.can_post && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Posts</Text></View>}
                                  {cm.permissions.can_manage_photos && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Photos</Text></View>}
                                  {cm.permissions.can_delete_posts && <View style={styles.cmPermChip}><Text style={styles.cmPermChipText}>Suppr.</Text></View>}
                                </View>
                              </View>
                              {isActive ? (
                                <View style={styles.cmBadgeLarge}>
                                  <Megaphone size={12} color="#FFF" />
                                  <Text style={styles.cmBadgeLargeText}>CM</Text>
                                </View>
                              ) : (
                                <View style={styles.cmSuspendedBadge}>
                                  <Pause size={12} color={Colors.status.error} />
                                  <Text style={styles.cmSuspendedText}>Suspendu</Text>
                                </View>
                              )}
                            </View>
                            {isCaptain && (
                              <View style={styles.cmActionsRow}>
                                <TouchableOpacity
                                  style={styles.cmActionBtn}
                                  onPress={() => handleAssignCM(cm.userId)}
                                >
                                  <ShieldCheck size={14} color={Colors.primary.blue} />
                                  <Text style={styles.cmActionBtnTextBlue}>Permissions</Text>
                                </TouchableOpacity>
                                {isActive ? (
                                  <TouchableOpacity
                                    style={styles.cmActionBtn}
                                    onPress={() => handleSuspendCM(cm.userId)}
                                  >
                                    <Pause size={14} color={Colors.status.warning || '#F59E0B'} />
                                    <Text style={styles.cmActionBtnTextWarn}>Suspendre</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.cmActionBtn}
                                    onPress={() => handleReactivateCM(cm.userId)}
                                  >
                                    <Play size={14} color={Colors.status.success} />
                                    <Text style={styles.cmActionBtnTextSuccess}>Réactiver</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  style={styles.cmActionBtn}
                                  onPress={() => handleRemoveCM(cm.userId)}
                                >
                                  <Trash2 size={14} color={Colors.status.error} />
                                  <Text style={styles.cmActionBtnTextError}>Retirer</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </View>

                  {/* ════ All Members ════ */}
                  {isCaptain && team.isRecruiting && team.members.length < team.maxMembers && (
                    <TouchableOpacity style={styles.addRoleBtn} onPress={() => setShowAddRoleModal(true)}>
                      <Plus size={16} color="#FFFFFF" />
                      <Text style={styles.addRoleBtnText}>{t('teamDetail.customRole')}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.membersListLabel}>Tous les membres</Text>
                  <View style={styles.membersGrid}>
                  {team.members.map((member, i) => {
                    const cmAssignment = getCMAssignment(member.userId);
                    const memberUser = member.userId === user?.id ? user : resolveMemberUser(member.userId);
                    const isCap = member.userId === team.captainId;
                    const isCo = member.role === 'co-captain';
                    const isCM = member.role === 'cm';
                    return (
                      <View key={i} style={styles.memberGridCard}>
                        <TouchableOpacity
                          onPress={() => canManage && member.userId !== team.captainId && (setSelectedMember(member.userId), setShowRoleModal(true))}
                          disabled={!canManage || member.userId === team.captainId}
                          style={styles.memberGridTop}
                        >
                          <Avatar
                            uri={memberUser?.avatar}
                            name={memberUser?.fullName || memberUser?.username}
                            size="large"
                          />
                          {isCap && (
                            <View style={styles.memberGridCrown}>
                              <Crown size={12} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                        <Text style={styles.memberGridName} numberOfLines={1}>
                          {memberUser?.fullName || memberUser?.username || t('teamDetail.member')}
                        </Text>
                        <View style={[styles.memberGridRoleBadge,
                          isCap ? styles.memberGridRoleCaptain :
                          isCo ? styles.memberGridRoleCoCaptain :
                          isCM ? styles.memberGridRoleCM : styles.memberGridRoleMember
                        ]}>
                          <Text style={[styles.memberGridRoleText,
                            isCap ? { color: Colors.primary.orange } :
                            isCM ? { color: Colors.primary.blue } : {}
                          ]}>
                            {isCap ? t('teamDetail.captain') : isCo ? t('teamDetail.coCaptain') : isCM ? 'CM' : member.customRole || member.position || t('teamDetail.member')}
                          </Text>
                        </View>
                        {memberUser && (
                          <View style={styles.memberGridStats}>
                            <View style={styles.memberGridStat}>
                              <Text style={styles.memberGridStatValue}>{memberUser.stats?.matchesPlayed ?? 0}</Text>
                              <Text style={styles.memberGridStatLabel}>Matchs</Text>
                            </View>
                            <View style={styles.memberGridStatDivider} />
                            <View style={styles.memberGridStat}>
                              <Text style={styles.memberGridStatValue}>{memberUser.stats?.wins ?? 0}</Text>
                              <Text style={styles.memberGridStatLabel}>Victoires</Text>
                            </View>
                            <View style={styles.memberGridStatDivider} />
                            <View style={styles.memberGridStat}>
                              <Text style={[styles.memberGridStatValue, { color: '#F59E0B' }]}>{memberUser.reputation?.toFixed(1) ?? '0.0'}</Text>
                              <Text style={styles.memberGridStatLabel}>Rep</Text>
                            </View>
                          </View>
                        )}
                        {canManage && member.userId !== team.captainId && (
                          <TouchableOpacity
                            style={styles.memberGridManageBtn}
                            onPress={() => (setSelectedMember(member.userId), setShowRoleModal(true))}
                          >
                            <Settings size={12} color={Colors.text.muted} />
                            <Text style={styles.memberGridManageBtnText}>Gérer</Text>
                          </TouchableOpacity>
                        )}
                        {isCaptain && member.userId !== team.captainId && member.role !== 'cm' && !cmAssignment && (
                          <TouchableOpacity
                            style={styles.quickCMBtn}
                            onPress={() => handleAssignCM(member.userId)}
                          >
                            <Megaphone size={12} color={Colors.primary.blue} />
                            <Text style={styles.quickCMBtnText}>CM</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                  </View>
                </View>
              )}

              {activeTab === 'gallery' && (
                <View style={styles.tabContent}>
                  {isMember && (
                    <TouchableOpacity style={styles.galleryAddBtnLarge} onPress={handleOpenAddPhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
                      {uploadingPhoto ? (
                        <ActivityIndicator size={20} color="#FFFFFF" />
                      ) : (
                        <Plus size={20} color="#FFFFFF" />
                      )}
                      <Text style={styles.galleryAddBtnLargeText}>{uploadingPhoto ? 'Upload en cours...' : 'Ajouter une photo'}</Text>
                    </TouchableOpacity>
                  )}

                  {loadingPhotos ? (
                    <View style={styles.galleryEmptyState}>
                      <ActivityIndicator size="large" color={Colors.primary.orange} />
                      <Text style={styles.galleryEmptyStateText}>Chargement de la galerie...</Text>
                    </View>
                  ) : galleryPhotos.length === 0 ? (
                    <View style={styles.galleryEmptyState}>
                      <View style={styles.galleryEmptyIconWrap}>
                        <Camera size={40} color={Colors.primary.blue} />
                      </View>
                      <Text style={styles.galleryEmptyStateTitle}>Aucune photo</Text>
                      <Text style={styles.galleryEmptyStateDesc}>Les moments de l'équipe apparaîtront ici</Text>
                      {isMember && (
                        <Text style={styles.galleryEmptyStateHint}>Ajoutez des photos des activités de l'équipe !</Text>
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={styles.galleryMosaic}>
                        <View style={styles.galleryMosaicCol}>
                          {galleryPhotos.filter((_, i) => i % 2 === 0).slice(0, 6).map((photo) => {
                            const realIdx = galleryPhotos.indexOf(photo);
                            const isLarge = realIdx === 0;
                            const canDelete = photo.userId === user?.id || isCaptain;
                            return (
                              <TouchableOpacity
                                key={photo.id}
                                style={[styles.galleryMosaicItem, isLarge && styles.galleryMosaicItemLarge]}
                                onPress={() => setViewerPhoto(photo)}
                                activeOpacity={0.9}
                              >
                                <ExpoImage
                                  source={{ uri: photo.imageUrl }}
                                  style={styles.galleryMosaicImg}
                                  contentFit="cover"
                                  transition={150}
                                />
                                {photo.caption ? (
                                  <View style={styles.galleryMosaicCaption}>
                                    <Text style={styles.galleryMosaicCaptionText} numberOfLines={1}>{photo.caption}</Text>
                                  </View>
                                ) : null}
                                {isLarge && (
                                  <View style={styles.galleryMosaicBadge}>
                                    <Camera size={10} color="#FFFFFF" />
                                    <Text style={styles.galleryMosaicBadgeText}>{galleryPhotos.length}</Text>
                                  </View>
                                )}
                                {canDelete && (
                                  <View style={styles.galleryDeleteBadge}>
                                    <Trash2 size={12} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={styles.galleryMosaicCol}>
                          {galleryPhotos.filter((_, i) => i % 2 === 1).slice(0, 6).map((photo) => {
                            const canDelete = photo.userId === user?.id || isCaptain;
                            return (
                              <TouchableOpacity
                                key={photo.id}
                                style={styles.galleryMosaicItem}
                                onPress={() => setViewerPhoto(photo)}
                                activeOpacity={0.9}
                              >
                                <ExpoImage
                                  source={{ uri: photo.imageUrl }}
                                  style={styles.galleryMosaicImg}
                                  contentFit="cover"
                                  transition={150}
                                />
                                {photo.caption ? (
                                  <View style={styles.galleryMosaicCaption}>
                                    <Text style={styles.galleryMosaicCaptionText} numberOfLines={1}>{photo.caption}</Text>
                                  </View>
                                ) : null}
                                {canDelete && (
                                  <View style={styles.galleryDeleteBadge}>
                                    <Trash2 size={12} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          {galleryPhotos.length > 12 && (
                            <TouchableOpacity
                              style={styles.galleryMosaicMore}
                              onPress={() => router.push(`/team-gallery/${team.id}` as any)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.galleryMosaicMoreText}>+{galleryPhotos.length - 12}</Text>
                              <Text style={styles.galleryMosaicMoreSub}>Voir tout</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={styles.gallerySeeAllBtn} onPress={() => router.push(`/team-gallery/${team.id}` as any)}>
                        <Text style={styles.gallerySeeAllText}>Voir toute la galerie</Text>
                        <ChevronRight size={16} color={Colors.primary.blue} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* ════ SUGGESTED RECRUITS — for captains ════ */}
            {isCaptain && team.isRecruiting && team.members.length < team.maxMembers && (recruitSuggestions.data ?? []).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Joueurs suggérés</Text>
                  <TouchableOpacity onPress={() => setShowSuggestedRecruits(!showSuggestedRecruits)}>
                    <Text style={styles.toggleText}>{showSuggestedRecruits ? 'Masquer' : 'Voir'}</Text>
                  </TouchableOpacity>
                </View>
                {showSuggestedRecruits && (
                  <View>
                    {(recruitSuggestions.data ?? []).map((p) => (
                      <Card key={p.id} style={styles.memberCard}>
                        <View style={styles.memberRow}>
                          <Avatar uri={p.avatar} name={p.fullName} size="medium" />
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{p.fullName}</Text>
                            <Text style={styles.memberPosition}>{p.matchReasons.join(' • ')}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.inviteBtn}
                            onPress={() => handleInvitePlayer(p.id, p.fullName)}
                          >
                            <UserPlus size={16} color="#FFFFFF" />
                            <Text style={styles.inviteBtnText}>Inviter</Text>
                          </TouchableOpacity>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.actions}>
              {isMember && (
                <Button title={t('teamDetail.teamChat')} onPress={() => router.push(`/team-chat/${team.id}` as any)} variant="primary" icon={<MessageCircle size={18} color="#FFFFFF" />} style={styles.actionButton} />
              )}
              {!isMember && !hasRequested && myJoinRequest?.status !== 'waiting' && (
                <Button title={myJoinRequest?.status === 'rejected' ? t('teamDetail.requestJoinAgain') : t('teamDetail.requestJoin')} onPress={handleJoinRequest} loading={isRequesting} variant="orange" icon={<UserPlus size={18} color="#FFFFFF" />} style={styles.actionButton} />
              )}
              {!isCaptain && isMember && <Button title={t('teamDetail.leaveTeamButton')} onPress={handleLeave} variant="outline" style={styles.actionButton} />}
              <Button title="Feed d'équipe" onPress={() => router.push(`/team-feed/${team.id}` as any)} variant="outline" icon={<Megaphone size={18} color={Colors.primary.orange} />} style={styles.actionButton} />
              {newFeedCount > 0 && (
                <View style={styles.feedBadge}>
                  <Text style={styles.feedBadgeText}>{newFeedCount > 9 ? '9+' : newFeedCount}</Text>
                </View>
              )}
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

        {/* ════ CM Management Modal ════ */}
        <Modal visible={showCMModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Gérer le Community Manager</Text>
                <TouchableOpacity onPress={() => !cmLoading && (setShowCMModal(false), setCmTargetUserId(null))} disabled={cmLoading}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {cmTargetUserId && team && (
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Avatar
                      uri={cmTargetUserId === user?.id ? user?.avatar : resolveMemberUser(cmTargetUserId)?.avatar}
                      name={cmTargetUserId === user?.id ? user?.fullName : resolveMemberUser(cmTargetUserId)?.fullName || resolveMemberUser(cmTargetUserId)?.username}
                      size="large"
                    />
                    <Text style={{ color: Colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
                      {cmTargetUserId === user?.id ? user?.fullName : resolveMemberUser(cmTargetUserId)?.fullName || resolveMemberUser(cmTargetUserId)?.username || 'Membre'}
                    </Text>
                    <View style={styles.cmBadgeLarge}>
                      <Megaphone size={14} color="#FFF" />
                      <Text style={styles.cmBadgeLargeText}>Community Manager</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.modalLabel}>Permissions</Text>
                <View style={styles.cmModalPermRow}>
                  <View style={styles.cmModalPermInfo}>
                    <Text style={styles.cmModalPermTitle}>Publier des posts</Text>
                    <Text style={styles.cmModalPermDesc}>Créer du contenu au nom de l'équipe</Text>
                  </View>
                  <Switch
                    value={cmPermissions.can_post}
                    onValueChange={(v) => setCmPermissions(prev => ({ ...prev, can_post: v }))}
                    trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }}
                    thumbColor="#FFF"
                  />
                </View>
                <View style={styles.cmModalPermRow}>
                  <View style={styles.cmModalPermInfo}>
                    <Text style={styles.cmModalPermTitle}>Gérer les photos</Text>
                    <Text style={styles.cmModalPermDesc}>Ajouter/supprimer des photos de galerie</Text>
                  </View>
                  <Switch
                    value={cmPermissions.can_manage_photos}
                    onValueChange={(v) => setCmPermissions(prev => ({ ...prev, can_manage_photos: v }))}
                    trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }}
                    thumbColor="#FFF"
                  />
                </View>
                <View style={styles.cmModalPermRow}>
                  <View style={styles.cmModalPermInfo}>
                    <Text style={styles.cmModalPermTitle}>Supprimer des posts</Text>
                    <Text style={styles.cmModalPermDesc}>Supprimer les posts de l'équipe</Text>
                  </View>
                  <Switch
                    value={cmPermissions.can_delete_posts}
                    onValueChange={(v) => setCmPermissions(prev => ({ ...prev, can_delete_posts: v }))}
                    trackColor={{ false: Colors.background.cardLight, true: Colors.status.error }}
                    thumbColor="#FFF"
                  />
                </View>
                <View style={styles.cmModalPermRow}>
                  <View style={styles.cmModalPermInfo}>
                    <Text style={styles.cmModalPermTitle}>Épingler des posts</Text>
                    <Text style={styles.cmModalPermDesc}>Mettre en avant des publications</Text>
                  </View>
                  <Switch
                    value={cmPermissions.can_pin_posts}
                    onValueChange={(v) => setCmPermissions(prev => ({ ...prev, can_pin_posts: v }))}
                    trackColor={{ false: Colors.background.cardLight, true: Colors.primary.blue }}
                    thumbColor="#FFF"
                  />
                </View>

                <Button
                  title="Enregistrer"
                  onPress={handleSaveCM}
                  variant="primary"
                  loading={cmLoading}
                  style={{ marginTop: 16 }}
                />
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
                    <Button
                      title={getCMAssignment(selectedMember) ? '📱 Gérer les permissions CM' : '📱 Promouvoir Community Manager'}
                      onPress={() => { setShowRoleModal(false); handleAssignCM(selectedMember); }}
                      variant="primary"
                      icon={<Megaphone size={16} color="#FFFFFF" />}
                      style={styles.modalBtn}
                    />
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
                      <ImageIcon size={24} color={Colors.primary.blue} />
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
                      <Text style={styles.advancedRowDesc}>
                        {team.creatorId === user?.id || user?.role === 'admin'
                          ? 'Cette action est irréversible'
                          : 'Demande à approuver par un administrateur'}
                      </Text>
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

        {/* Dissolution request modal */}
        <Modal visible={showDissolveModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Demande de dissolution</Text>
                <TouchableOpacity onPress={() => setShowDissolveModal(false)} disabled={dissolving}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={{ color: Colors.text.secondary, fontSize: 14, marginBottom: 12 }}>
                  Vous n'êtes pas le créateur de cette équipe. Votre demande sera examinée par un administrateur.
                </Text>
                <Text style={{ color: Colors.text.primary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  Raison de la dissolution
                </Text>
                <TextInput
                  style={[styles.roleInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Expliquez pourquoi vous souhaitez dissoudre cette équipe..."
                  placeholderTextColor={Colors.text.muted}
                  value={dissolveReason}
                  onChangeText={setDissolveReason}
                  multiline
                  numberOfLines={4}
                  editable={!dissolving}
                />
                <Button
                  title="Soumettre la demande"
                  onPress={handleSubmitDissolutionRequest}
                  variant="primary"
                  loading={dissolving}
                  disabled={!dissolveReason.trim()}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Add photo modal */}
        <Modal visible={showAddPhotoModal} animationType="slide" transparent onRequestClose={() => !uploadingPhoto && setShowAddPhotoModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter une photo</Text>
                <TouchableOpacity onPress={() => !uploadingPhoto && setShowAddPhotoModal(false)} disabled={uploadingPhoto}>
                  <X size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                {pendingPhotoUri && (
                  <View style={styles.addPhotoPreviewContainer}>
                    <ExpoImage
                      source={{ uri: pendingPhotoUri }}
                      style={styles.addPhotoPreview}
                      contentFit="cover"
                      transition={100}
                    />
                    <TouchableOpacity
                      style={styles.addPhotoChangeBtn}
                      onPress={async () => {
                        const uri = await pickImageFromLibrary();
                        if (uri) setPendingPhotoUri(uri);
                      }}
                      disabled={uploadingPhoto}
                    >
                      <Edit3 size={14} color="#FFFFFF" />
                      <Text style={styles.addPhotoChangeBtnText}>Changer</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.modalLabel}>Légende (optionnel)</Text>
                <TextInput
                  style={styles.roleInput}
                  placeholder="Décrivez cette photo..."
                  placeholderTextColor={Colors.text.muted}
                  value={photoCaption}
                  onChangeText={setPhotoCaption}
                  maxLength={200}
                  multiline
                  numberOfLines={2}
                  editable={!uploadingPhoto}
                />
                <Button
                  title="Publier la photo"
                  onPress={handleConfirmAddPhoto}
                  variant="primary"
                  loading={uploadingPhoto}
                  disabled={!pendingPhotoUri || uploadingPhoto}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Photo viewer modal */}
        <Modal visible={!!viewerPhoto} animationType="fade" transparent onRequestClose={() => setViewerPhoto(null)}>
          <View style={styles.photoViewerOverlay}>
            <TouchableOpacity style={styles.photoViewerClose} onPress={() => setViewerPhoto(null)}>
              <X size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {viewerPhoto && (
              <>
                <ExpoImage
                  source={{ uri: viewerPhoto.imageUrl }}
                  style={styles.photoViewerImage}
                  contentFit="contain"
                />
                {viewerPhoto.caption && (
                  <Text style={styles.photoViewerCaption}>{viewerPhoto.caption}</Text>
                )}
                <Text style={styles.photoViewerUploader}>
                  {resolveMemberUser(viewerPhoto.userId)?.fullName || resolveMemberUser(viewerPhoto.userId)?.username || 'Membre'}
                </Text>
                {(viewerPhoto.userId === user?.id || isCaptain) && (
                  <TouchableOpacity
                    style={styles.photoViewerDelete}
                    onPress={() => handleDeletePhoto(viewerPhoto)}
                  >
                    <Trash2 size={18} color="#FFFFFF" />
                    <Text style={styles.photoViewerDeleteText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
  toggleText: { color: Colors.primary.blue, fontSize: 13, fontWeight: '500' as const },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.orange, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  inviteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' as const },
  memberCard: { marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberInfo: { flex: 1 },
  memberName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  memberPosition: { color: Colors.text.muted, fontSize: 13 },
  membersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memberGridCard: { width: '48%', backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, position: 'relative' },
  memberGridCrown: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center' },
  memberGridTop: { alignItems: 'center', position: 'relative' },
  memberGridName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const, marginTop: 4 },
  memberGridRoleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  memberGridRoleCaptain: { backgroundColor: Colors.primary.orange + '25' },
  memberGridRoleCoCaptain: { backgroundColor: Colors.background.cardLight },
  memberGridRoleCM: { backgroundColor: Colors.primary.blue + '25' },
  memberGridRoleMember: { backgroundColor: Colors.background.cardLight },
  memberGridRoleText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.secondary },
  memberGridStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 6, width: '100%' },
  memberGridStat: { flex: 1, alignItems: 'center' },
  memberGridStatValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' as const },
  memberGridStatLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 1 },
  memberGridStatDivider: { width: 1, height: 20, backgroundColor: Colors.border.light },
  memberGridManageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.background.cardLight, marginTop: 4 },
  memberGridManageBtnText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  captainRole: { backgroundColor: Colors.primary.orange },
  coCaptainRole: { backgroundColor: Colors.background.cardLight },
  cmRole: { backgroundColor: Colors.primary.blue },
  roleText: { color: Colors.text.primary, fontSize: 11, fontWeight: '600' as const },
  roleTextWhite: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  cmBadgePreview: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary.blue + '25', alignItems: 'center', justifyContent: 'center' },
  membersListLabel: { color: Colors.text.muted, fontSize: 13, fontWeight: '600' as const, marginTop: 16, marginBottom: 8 },

  // CM Section
  cmSection: { marginBottom: 16, backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.primary.blue + '30' },
  cmSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cmSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmSectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' as const },
  cmSectionDesc: { color: Colors.text.muted, fontSize: 12, marginBottom: 12, lineHeight: 16 },
  cmCountBadge: { backgroundColor: Colors.primary.blue + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  cmCountText: { color: Colors.primary.blue, fontSize: 12, fontWeight: '700' as const },
  cmEmpty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  cmEmptyText: { color: Colors.text.muted, fontSize: 14 },
  cmEmptyHint: { color: Colors.text.muted, fontSize: 12, fontStyle: 'italic' as const, textAlign: 'center' as const, lineHeight: 16 },
  cmMemberCard: { marginBottom: 8, borderColor: Colors.primary.blue + '20' },
  cmMemberCardSuspended: { borderColor: Colors.status.error + '30', opacity: 0.7 },
  cmBadgeLarge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.blue, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  cmBadgeLargeText: { color: '#FFF', fontSize: 12, fontWeight: '700' as const },
  cmSuspendedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.error + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  cmSuspendedText: { color: Colors.status.error, fontSize: 12, fontWeight: '600' as const },
  cmPermChips: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' as const },
  cmPermChip: { backgroundColor: Colors.primary.blue + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cmPermChipText: { color: Colors.primary.blue, fontSize: 10, fontWeight: '500' as const },
  cmActionsRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border.light },
  cmActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background.cardLight },
  cmActionBtnTextBlue: { color: Colors.primary.blue, fontSize: 11, fontWeight: '600' as const },
  cmActionBtnTextWarn: { color: '#F59E0B', fontSize: 11, fontWeight: '600' as const },
  cmActionBtnTextSuccess: { color: Colors.status.success, fontSize: 11, fontWeight: '600' as const },
  cmActionBtnTextError: { color: Colors.status.error, fontSize: 11, fontWeight: '600' as const },
  quickCMBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.primary.blue + '10' },
  quickCMBtnText: { color: Colors.primary.blue, fontSize: 11, fontWeight: '600' as const },

  // CM Modal
  cmModalPermRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.background.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  cmModalPermInfo: { flex: 1 },
  cmModalPermTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '500' as const },
  cmModalPermDesc: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  actionButton: { width: '100%' },
  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.blue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginTop: 16, minWidth: 200 },
  followBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
  followingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.card, borderWidth: 1.5, borderColor: Colors.status.success, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginTop: 16, minWidth: 200 },
  followingBtnText: { color: Colors.status.success, fontSize: 15, fontWeight: '600' as const },
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  } as any,
  feedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 10,
  },
  feedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
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
  galleryAddBtnLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.orange, paddingVertical: 14, borderRadius: 14, marginBottom: 12 },
  galleryAddBtnLargeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
  tabContainer: { marginBottom: 24 },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: Colors.background.card, borderRadius: 12, padding: 4 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabItemActive: { backgroundColor: Colors.primary.orange },
  tabItemText: { color: Colors.text.muted, fontSize: 14, fontWeight: '600' as const },
  tabItemTextActive: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  tabContent: { gap: 12 },
  galleryMosaic: { flexDirection: 'row', gap: 6 },
  galleryMosaicCol: { flex: 1, gap: 6 },
  galleryMosaicItem: { borderRadius: 14, overflow: 'hidden', position: 'relative', aspectRatio: 1 },
  galleryMosaicItemLarge: { aspectRatio: 0.75 },
  galleryMosaicImg: { width: '100%', height: '100%' },
  galleryMosaicCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  galleryMosaicCaptionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' as const },
  galleryMosaicBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  galleryMosaicBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' as const },
  galleryMosaicMore: { borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', aspectRatio: 1, gap: 2 },
  galleryMosaicMoreText: { color: Colors.primary.blue, fontSize: 22, fontWeight: '700' as const },
  galleryMosaicMoreSub: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' as const },
  gallerySeeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, marginTop: 4 },
  gallerySeeAllText: { color: Colors.primary.blue, fontSize: 14, fontWeight: '600' as const },
  galleryEmptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12, backgroundColor: Colors.background.cardLight, borderRadius: 16, borderWidth: 1, borderColor: Colors.border.light, borderStyle: 'dashed' as const },
  galleryEmptyStateText: { color: Colors.text.muted, fontSize: 14 },
  galleryEmptyStateTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' as const },
  galleryEmptyStateDesc: { color: Colors.text.muted, fontSize: 14 },
  galleryEmptyStateHint: { color: Colors.primary.blue, fontSize: 13, fontWeight: '500' as const, marginTop: 4 },
  galleryEmptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary.blue + '15', alignItems: 'center', justifyContent: 'center' },
  galleryDeleteBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 6, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  galleryCaptionOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  galleryCaptionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' as const },
  galleryUploader: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  galleryUploaderText: { color: '#FFFFFF', fontSize: 9 },
  addPhotoPreviewContainer: { position: 'relative', marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  addPhotoPreview: { width: '100%', height: 280, borderRadius: 16 },
  addPhotoChangeBtn: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addPhotoChangeBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' as const },
  photoViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  photoViewerImage: { width: '90%', height: '70%', borderRadius: 12 },
  photoViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  photoViewerDelete: { position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  photoViewerDeleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
  photoViewerCaption: { color: '#FFFFFF', fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  photoViewerUploader: { color: Colors.text.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
