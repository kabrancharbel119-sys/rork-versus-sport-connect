import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Calendar, Trophy, Swords, Star, Users, MessageCircle, UserPlus, UserMinus, CheckCircle, Shield, Award, Zap, TrendingUp, ChevronRight, Target, Goal, Handshake } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Team, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { safeBack } from '@/lib/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useUsers } from '@/contexts/UsersContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useChat } from '@/contexts/ChatContext';
import { usersApi } from '@/lib/api/users';
import { teamsApi } from '@/lib/api/teams';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels } from '@/mocks/data';

export default function UserProfileScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { id, fromTeamRequest, teamId, requestId } = useLocalSearchParams<{
    id: string;
    fromTeamRequest?: string;
    teamId?: string;
    requestId?: string;
  }>();
  const { user: currentUser } = useAuth();
  const { users, isFollowing, follow, unfollow } = useUsers();
  const { teams, getUserTeams, getTeamById, handleRequest, refetchTeams } = useTeams();
  const { chatRooms, createChatRequest, getSentChatRequests } = useChat();
  const [isHandlingRequest, setIsHandlingRequest] = useState(false);

  const profileUserId = (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '') || '';
  const requestFlowFlag = (typeof fromTeamRequest === 'string' ? fromTeamRequest : Array.isArray(fromTeamRequest) ? fromTeamRequest[0] : '') || '';
  const requestTeamParam = (typeof teamId === 'string' ? teamId : Array.isArray(teamId) ? teamId[0] : '') || '';
  const requestIdParam = (typeof requestId === 'string' ? requestId : Array.isArray(requestId) ? requestId[0] : '') || '';

  const { data: fetchedUser, error: fetchedUserError } = useQuery({
    queryKey: ['profileUser', profileUserId],
    queryFn: () => usersApi.getById(profileUserId),
    enabled: !!profileUserId,
    staleTime: 0,
    retry: false,
  });

  const localUser = users.find((u) => u.id === profileUserId);
  const profileUser = (fetchedUser ?? localUser) as User | undefined;
  const isInvisibleProfile = fetchedUserError instanceof Error && fetchedUserError.message === 'Profil indisponible';

  const teamIds = useMemo(() => (profileUser?.teams ?? []).filter(Boolean), [profileUser?.teams]);

  const { data: fetchedTeams = [] } = useQuery({
    queryKey: ['profileTeams', profileUserId, teamIds],
    queryFn: async () => {
      if (teamIds.length === 0) return [];
      const results = await Promise.all(teamIds.map(tid => teamsApi.getById(tid).catch(() => null)));
      return results.filter((t): t is Team => t != null);
    },
    enabled: !!profileUserId && teamIds.length > 0,
    staleTime: 0,
  });

  const requestTeamId = requestTeamParam;
  const contextRequestTeam = requestTeamId ? getTeamById(requestTeamId) : undefined;
  const { data: fetchedRequestTeam } = useQuery({
    queryKey: ['requestFlowTeam', requestTeamId],
    queryFn: () => teamsApi.getById(requestTeamId),
    enabled: requestFlowFlag === '1' && !!requestTeamId && !contextRequestTeam,
    staleTime: 0,
  });

  const fallbackRequestTeam = useMemo(() => {
    if (!currentUser) return undefined;
    return teams.find((t) => {
      if (t.captainId !== currentUser.id) return false;
      return t.joinRequests.some((r) => {
        if (r.userId !== profileUserId) return false;
        if (requestIdParam) return r.id === requestIdParam;
        return r.status === 'pending' || r.status === 'waiting';
      });
    });
  }, [teams, currentUser, profileUserId, requestIdParam]);

  const isOwnProfile = currentUser?.id === profileUserId;
  const following = currentUser ? isFollowing(currentUser.id, profileUserId) : false;
  const userTeamsFromContext = getUserTeams(profileUserId);
  const requestTeam = contextRequestTeam ?? fetchedRequestTeam ?? fallbackRequestTeam;
  const canCaptainHandleRequest = !!currentUser && !!requestTeam && requestTeam.captainId === currentUser.id;
  const joinRequest = canCaptainHandleRequest && requestTeam
    ? requestTeam.joinRequests.find((r) => {
        if (r.userId !== profileUserId) return false;
        if (!requestIdParam) return r.status === 'pending' || r.status === 'waiting';
        return r.id === requestIdParam;
      })
    : undefined;
  const canHandleThisRequest = !!joinRequest && (joinRequest.status === 'pending' || joinRequest.status === 'waiting');

  console.log('[UserProfile] DEBUG BOUTON CAPITAINE:', {
    profileUserId,
    currentUserId: currentUser?.id,
    requestFlowFlag,
    requestTeamParam,
    requestIdParam,
    hasRequestTeam: !!requestTeam,
    requestTeamId: requestTeam?.id,
    isCaptain: requestTeam?.captainId === currentUser?.id,
    canCaptainHandleRequest,
    hasJoinRequest: !!joinRequest,
    joinRequestId: joinRequest?.id,
    joinRequestStatus: joinRequest?.status,
    canHandleThisRequest,
    teamsCount: teams.length,
    fallbackTeamFound: !!fallbackRequestTeam,
  });

  const displayTeams = useMemo(() => {
    const fromApi = fetchedTeams;
    const seen = new Set(fromApi.map(t => t.id));
    const fromContext = userTeamsFromContext.filter(t => !seen.has(t.id));
    return [...fromApi, ...fromContext];
  }, [fetchedTeams, userTeamsFromContext]);

  if (!profileUser) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{isInvisibleProfile ? t('userProfile.invisibleProfile') : t('userProfile.userNotFound')}</Text>
            <TouchableOpacity onPress={() => safeBack(router, '/(tabs)/(home)')}><Text style={styles.errorLink}>{t('common.back')}</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleFollow = async () => {
    if (!currentUser) return;
    try {
      if (following) {
        await unfollow({ followerId: currentUser.id, followingId: id || '' });
      } else {
        await follow({ followerId: currentUser.id, followingId: id || '' });
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;
    
    // Check if there's already a direct chat room
    const existingDirectRoom = chatRooms.find(r => 
      r.type === 'direct' && 
      r.participants.includes(currentUser.id) && 
      r.participants.includes(profileUserId)
    );
    
    if (existingDirectRoom) {
      // Navigate directly to existing chat
      router.push(`/chat/${existingDirectRoom.id}`);
      return;
    }
    
    // Check if there's a pending request
    const sentRequests = getSentChatRequests();
    const pendingRequest = sentRequests.find(r => r.recipientId === profileUserId);
    
    if (pendingRequest) {
      Alert.alert(t('chatList.pendingRequestTitle'), t('chatList.pendingRequestMessage'));
      return;
    }
    
    // Send message request with confirmation
    Alert.alert(
      t('chatList.sendRequest'),
      t('chatList.sendRequestQuestion', { user: profileUser.fullName || profileUser.username }),
      [
        {
          text: t('common.no'),
          style: 'cancel'
        },
        {
          text: t('chatList.sendRequestConfirm'),
          onPress: async () => {
            try {
              await createChatRequest({ recipientId: profileUserId });
              Alert.alert(
                t('chatList.requestSent'),
                t('chatList.requestSentMessage', { user: profileUser.fullName || profileUser.username })
              );
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('chatList.cannotSendRequest'));
            }
          }
        }
      ]
    );
  };

  const handleRequestAction = async (action: 'accept' | 'reject') => {
    if (!currentUser || !requestTeam || !joinRequest) return;
    try {
      setIsHandlingRequest(true);
      await handleRequest({
        teamId: requestTeam.id,
        requestId: joinRequest.id,
        action,
        handlerId: currentUser.id,
      });
      await refetchTeams();
      Alert.alert(t('common.success'), action === 'accept' ? t('userProfile.requestAccepted') : t('userProfile.requestRejected'));
      safeBack(router, '/(tabs)/(home)');
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message ?? t('userProfile.requestProcessFailed'));
    } finally {
      setIsHandlingRequest(false);
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.floatingBackRow}>
            <TouchableOpacity style={styles.floatingBackBtn} onPress={() => safeBack(router, '/(tabs)/(home)')} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.floatingSpacer} />
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.scrollTopSpacer} />

            {/* Hero card with banner */}
            <View style={styles.profileCard}>
              {profileUser.bannerImage ? (
                <>
                  <Image source={{ uri: profileUser.bannerImage }} style={styles.profileCoverBg} contentFit="cover" transition={200} />
                  <View style={styles.profileCoverOverlay} />
                </>
              ) : (
                <LinearGradient colors={['#1E3A8A', '#0F1F3F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCoverBg} />
              )}
              <View style={styles.profileCardBody}>
                <View style={styles.profileTop}>
                  <View style={styles.avatarRing}>
                    <View style={styles.avatarInner}>
                      <Avatar uri={profileUser.avatar} name={profileUser.fullName} size="xlarge" />
                    </View>
                    {profileUser.isVerified && (
                      <View style={styles.verifiedBadge}>
                        <CheckCircle size={16} color={Colors.status.success} />
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.profileNameRow}>
                  <Text style={styles.profileName}>{profileUser.fullName}</Text>
                  {profileUser.isPremium && <Star size={18} color="#F59E0B" />}
                </View>
                <Text style={styles.profileUsername}>@{profileUser.username}</Text>
                {profileUser.city && (
                  <View style={styles.locationRow}>
                    <MapPin size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.locationText}>{profileUser.city}, {profileUser.country}</Text>
                  </View>
                )}

                {displayTeams.length > 0 && (
                  <View style={styles.teamTagRow}>
                    <Shield size={14} color={Colors.primary.orange} />
                    <Text style={styles.teamTagText} numberOfLines={2}>
                      {t('userProfile.playsFor')} {displayTeams.length === 1
                        ? displayTeams[0].name
                        : displayTeams.length === 2
                          ? `${displayTeams[0].name} ${t('userProfile.and')} ${displayTeams[1].name}`
                          : `${displayTeams[0].name} ${t('userProfile.and')} ${displayTeams.length - 1} ${displayTeams.length > 2 ? t('userProfile.otherPlural') : t('userProfile.otherSingle')}`}
                    </Text>
                  </View>
                )}

                {profileUser.bio && <Text style={styles.bio}>{profileUser.bio}</Text>}

                {/* Quick stats */}
                <View style={styles.quickStatsRow}>
                  <View style={styles.quickStatItem}>
                    <View style={styles.quickStatIconBg}>
                      <Zap size={14} color={Colors.primary.orange} />
                    </View>
                    <Text style={styles.quickStatValue}>{profileUser.stats.matchesPlayed}</Text>
                    <Text style={styles.quickStatLabel}>Matchs</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <View style={styles.quickStatIconBg}>
                      <TrendingUp size={14} color={Colors.status.success} />
                    </View>
                    <Text style={styles.quickStatValue}>{profileUser.stats.wins}</Text>
                    <Text style={styles.quickStatLabel}>Victoires</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <View style={styles.quickStatIconBg}>
                      <Award size={14} color="#F59E0B" />
                    </View>
                    <Text style={styles.quickStatValue}>{profileUser.stats.mvpAwards}</Text>
                    <Text style={styles.quickStatLabel}>MVP</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <View style={styles.quickStatIconBg}>
                      <Star size={14} color="#F59E0B" />
                    </View>
                    <Text style={styles.quickStatValue}>{profileUser.stats.fairPlayScore.toFixed(1)}</Text>
                    <Text style={styles.quickStatLabel}>Fair-Play</Text>
                  </View>
                </View>

                {/* Social stats */}
                <View style={styles.profileMeta}>
                  <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push(`/followers?userId=${profileUserId}`)} activeOpacity={0.6}>
                    <Text style={styles.profileMetaValue}>{profileUser.followers}</Text>
                    <Text style={styles.profileMetaLabel}>{t('userProfile.followers')}</Text>
                  </TouchableOpacity>
                  <View style={styles.profileMetaDivider} />
                  <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push(`/following?userId=${profileUserId}`)} activeOpacity={0.6}>
                    <Text style={styles.profileMetaValue}>{profileUser.following}</Text>
                    <Text style={styles.profileMetaLabel}>{t('userProfile.following')}</Text>
                  </TouchableOpacity>
                  <View style={styles.profileMetaDivider} />
                  <TouchableOpacity style={styles.profileMetaItem} onPress={() => router.push(`/my-teams?userId=${profileUserId}`)} activeOpacity={0.6}>
                    <Text style={styles.profileMetaValue}>{displayTeams.length}</Text>
                    <Text style={styles.profileMetaLabel}>{t('userProfile.teams', { count: displayTeams.length })}</Text>
                  </TouchableOpacity>
                </View>

                {!isOwnProfile && (
                  <View style={styles.actionButtons}>
                    <Button
                      title={following ? t('userProfile.unfollow') : t('userProfile.follow')}
                      onPress={handleFollow}
                      variant={following ? 'secondary' : 'primary'}
                      size="medium"
                      icon={following ? <UserMinus size={18} color={Colors.text.primary} /> : <UserPlus size={18} color="#FFF" />}
                      style={styles.actionBtn}
                    />
                    <TouchableOpacity style={styles.messageBtn} onPress={handleMessage} activeOpacity={0.7}>
                      <MessageCircle size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
                {canHandleThisRequest && (
                  <View style={styles.joinRequestActions}>
                    <Button
                      title={t('userProfile.accept')}
                      onPress={() => handleRequestAction('accept')}
                      variant="primary"
                      size="medium"
                      style={styles.joinRequestBtn}
                      loading={isHandlingRequest}
                      disabled={isHandlingRequest}
                    />
                    <Button
                      title={t('userProfile.reject')}
                      onPress={() => handleRequestAction('reject')}
                      variant="secondary"
                      size="medium"
                      style={styles.joinRequestBtn}
                      loading={isHandlingRequest}
                      disabled={isHandlingRequest}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Sports */}
            {profileUser.sports.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('userProfile.sportsPlayed')}</Text>
                  <View style={styles.countBadge}><Text style={styles.countBadgeText}>{profileUser.sports.length}</Text></View>
                </View>
                <View style={styles.sportsBadgesContainer}>
                  {profileUser.sports.map((sport, i) => (
                    <View key={i} style={styles.sportBadge}>
                      <Text style={styles.sportBadgeEmoji}>
                        {sport.sport === 'football' ? '⚽' : sport.sport === 'basketball' ? '🏀' : sport.sport === 'volleyball' ? '🏐' : sport.sport === 'tennis' ? '🎾' : '🏃'}
                      </Text>
                      <View style={styles.sportBadgeInfo}>
                        <Text style={styles.sportBadgeName}>{sportLabels[sport.sport]}</Text>
                        <Text style={styles.sportBadgeMeta}>{levelLabels[sport.level]}{sport.position ? ` • ${sport.position}` : ''}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Stats grid with W/L/D bar */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('userProfile.stats')}</Text>
              <View style={styles.statGrid}>
                <View style={styles.statGridCard}>
                  <Swords size={18} color={Colors.primary.blue} />
                  <Text style={styles.statGridValue}>{profileUser.stats.matchesPlayed}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.matches')}</Text>
                </View>
                <View style={styles.statGridCard}>
                  <Trophy size={18} color={Colors.status.success} />
                  <Text style={styles.statGridValue}>{profileUser.stats.wins}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.wins')}</Text>
                </View>
                <View style={styles.statGridCard}>
                  <Award size={18} color={Colors.primary.orange} />
                  <Text style={styles.statGridValue}>{profileUser.stats.mvpAwards}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.mvp')}</Text>
                </View>
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statGridCard}>
                  <Zap size={18} color={Colors.primary.orange} />
                  <Text style={styles.statGridValue}>{profileUser.stats.goalsScored}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.goals')}</Text>
                </View>
                <View style={styles.statGridCard}>
                  <Users size={18} color={Colors.primary.blue} />
                  <Text style={styles.statGridValue}>{profileUser.stats.assists}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.assists')}</Text>
                </View>
                <View style={styles.statGridCard}>
                  <Star size={18} color={Colors.status.success} />
                  <Text style={styles.statGridValue}>{profileUser.stats.fairPlayScore.toFixed(1)}</Text>
                  <Text style={styles.statGridLabel}>{t('userProfile.fairPlay')}</Text>
                </View>
              </View>

              {/* Win/Loss/Draw bar */}
              {(() => {
                const total = profileUser.stats.wins + profileUser.stats.losses + profileUser.stats.draws;
                if (total === 0) return null;
                const winPct = Math.round((profileUser.stats.wins / total) * 100);
                const drawPct = Math.round((profileUser.stats.draws / total) * 100);
                const lossPct = Math.max(0, 100 - winPct - drawPct);
                return (
                  <View style={styles.wldBarContainer}>
                    <View style={styles.wldBar}>
                      <View style={[styles.wldSegmentWin, { flex: winPct }]} />
                      <View style={[styles.wldSegmentDraw, { flex: drawPct }]} />
                      <View style={[styles.wldSegmentLoss, { flex: lossPct }]} />
                    </View>
                    <View style={styles.wldLegend}>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.status.success }]} /><Text style={styles.wldLegendText}>{profileUser.stats.wins} V ({winPct}%)</Text></View>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.text.muted }]} /><Text style={styles.wldLegendText}>{profileUser.stats.draws} N ({drawPct}%)</Text></View>
                      <View style={styles.wldLegendItem}><View style={[styles.wldDot, { backgroundColor: Colors.status.error }]} /><Text style={styles.wldLegendText}>{profileUser.stats.losses} D ({lossPct}%)</Text></View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Teams */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('userProfile.teams', { count: displayTeams.length })}</Text>
                {displayTeams.length > 0 && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{displayTeams.length}</Text></View>}
              </View>
              {displayTeams.length > 0 ? (
                displayTeams.map((team) => (
                  <TouchableOpacity key={team.id} style={styles.teamCard} onPress={() => router.push(`/team/${team.id}`)} activeOpacity={0.8}>
                    <View style={styles.teamRow}>
                      <Avatar uri={team.logo} name={team.name} size="medium" />
                      <View style={styles.teamInfo}>
                        <Text style={styles.teamName}>{team.name}</Text>
                        <Text style={styles.teamMeta}>{sportLabels[team.sport]} • {team.format}</Text>
                        <View style={styles.teamLocation}>
                          <MapPin size={12} color={Colors.text.muted} />
                          <Text style={styles.teamLocationText}>{team.city}</Text>
                        </View>
                      </View>
                      {team.captainId === id && (
                        <View style={styles.captainBadge}>
                          <Shield size={14} color={Colors.primary.orange} />
                          <Text style={styles.captainText}>{t('userProfile.captain')}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.teamCardEmpty}>
                  <Shield size={24} color={Colors.text.muted} />
                  <Text style={styles.teamEmptyText}>{t('userProfile.noTeams')}</Text>
                </View>
              )}
            </View>

            {/* Member since card */}
            <View style={styles.memberSinceCard}>
              <Calendar size={16} color={Colors.text.muted} />
              <Text style={styles.joinedText}>{t('userProfile.memberSince', { date: formatDate(profileUser.createdAt) })}</Text>
            </View>

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, marginBottom: 8 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 100 },

  // Floating back
  floatingBackRow: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  floatingBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  floatingSpacer: { width: 40 },
  scrollTopSpacer: { height: 8 },

  // Hero card
  profileCard: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', backgroundColor: Colors.background.card },
  profileCoverBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%' },
  profileCoverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  profileCardBody: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 60 },
  profileTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: 12 },
  avatarRing: { position: 'relative', padding: 4, borderRadius: 60, backgroundColor: Colors.background.card, borderWidth: 3, borderColor: Colors.primary.blue },
  avatarInner: { borderRadius: 56, overflow: 'hidden' },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.background.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.status.success },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' as const },
  profileUsername: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  teamTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  teamTagText: { color: Colors.primary.orange, fontSize: 14, fontWeight: '500' as const },
  bio: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 8 },

  // Quick stats
  quickStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, marginTop: 16, marginBottom: 8 },
  quickStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  quickStatIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  quickStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' as const },
  quickStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Social stats
  profileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  profileMetaItem: { alignItems: 'center', paddingHorizontal: 20 },
  profileMetaValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' as const },
  profileMetaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  profileMetaDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Action buttons
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  actionBtn: { minWidth: 140 },
  messageBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  joinRequestActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, width: '100%' },
  joinRequestBtn: { flex: 1 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 0 },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary.blue, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' as const },

  // Sports badges
  sportsBadgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.border.light },
  sportBadgeEmoji: { fontSize: 20 },
  sportBadgeInfo: { gap: 2 },
  sportBadgeName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' as const },
  sportBadgeMeta: { color: Colors.text.muted, fontSize: 12 },

  // Stat grid
  statGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statGridCard: { flex: 1, backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  statGridValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' as const },
  statGridLabel: { color: Colors.text.muted, fontSize: 12 },

  // Teams
  teamCard: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, marginBottom: 12 },
  teamCardEmpty: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  teamEmptyText: { color: Colors.text.muted, fontSize: 14 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  teamInfo: { flex: 1 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  teamLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  teamLocationText: { color: Colors.text.muted, fontSize: 12 },
  captainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  captainText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '500' as const },

  // Member since
  memberSinceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.card, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  joinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  joinedText: { color: Colors.text.muted, fontSize: 13 },

  // Error
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: Colors.text.primary, fontSize: 16 },
  errorLink: { color: Colors.primary.blue, fontSize: 14 },
  bottomSpacer: { height: 40 },

  // W/L/D bar
  wldBarContainer: { marginTop: 16 },
  wldBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: Colors.background.card },
  wldSegmentWin: { backgroundColor: Colors.status.success },
  wldSegmentDraw: { backgroundColor: Colors.text.muted },
  wldSegmentLoss: { backgroundColor: Colors.status.error },
  wldLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 },
  wldLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wldDot: { width: 8, height: 8, borderRadius: 4 },
  wldLegendText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' as const },
});
