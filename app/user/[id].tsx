import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Calendar, Trophy, Swords, Star, Users, MessageCircle, UserPlus, UserMinus, CheckCircle, Shield, Award, Zap, TrendingUp, ChevronRight, Target, Goal, Handshake, Newspaper, Activity, Megaphone } from 'lucide-react-native';
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
import { useFullscreenImage } from '@/components/FullscreenImageViewer';
import { sportLabels, levelLabels } from '@/mocks/data';
import { postsApi } from '@/lib/api/posts';
import { PostCard } from '@/components/PostCard';

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
  const fullscreen = useFullscreenImage();
  const [isHandlingRequest, setIsHandlingRequest] = useState(false);

  const profileUserId = (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '') || '';
  const isLikelyUsername = !!profileUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileUserId);

  const { data: resolvedUserId } = useQuery({
    queryKey: ['resolveUsername', profileUserId],
    queryFn: async () => {
      if (!isLikelyUsername) return profileUserId;
      const results = await usersApi.search({ query: profileUserId });
      const match = results.find((u) => u.username.toLowerCase() === profileUserId.toLowerCase());
      return match?.id || '';
    },
    enabled: !!profileUserId && isLikelyUsername,
    staleTime: 60_000,
  });

  const effectiveUserId = isLikelyUsername ? (resolvedUserId || '') : profileUserId;

  const { data: userPosts = [] } = useQuery({
    queryKey: ['userPosts', effectiveUserId],
    queryFn: async () => {
      const result = await postsApi.getPostsByUser(effectiveUserId, 1, 10);
      return result.posts;
    },
    enabled: !!effectiveUserId,
    staleTime: 30_000,
  });
  const requestFlowFlag = (typeof fromTeamRequest === 'string' ? fromTeamRequest : Array.isArray(fromTeamRequest) ? fromTeamRequest[0] : '') || '';
  const requestTeamParam = (typeof teamId === 'string' ? teamId : Array.isArray(teamId) ? teamId[0] : '') || '';
  const requestIdParam = (typeof requestId === 'string' ? requestId : Array.isArray(requestId) ? requestId[0] : '') || '';

  const { data: fetchedUser, error: fetchedUserError } = useQuery({
    queryKey: ['profileUser', effectiveUserId],
    queryFn: () => usersApi.getById(effectiveUserId),
    enabled: !!effectiveUserId,
    staleTime: 0,
    retry: false,
  });

  const localUser = users.find((u) => u.id === effectiveUserId);
  const profileUser = (fetchedUser ?? localUser) as User | undefined;
  const isInvisibleProfile = fetchedUserError instanceof Error && fetchedUserError.message === 'Profil indisponible';

  const teamIds = useMemo(() => (profileUser?.teams ?? []).filter(Boolean), [profileUser?.teams]);

  const { data: fetchedTeams = [] } = useQuery({
    queryKey: ['profileTeams', effectiveUserId, teamIds],
    queryFn: async () => {
      if (teamIds.length === 0) return [];
      const results = await Promise.all(teamIds.map(tid => teamsApi.getById(tid).catch(() => null)));
      return results.filter((t): t is Team => t != null);
    },
    enabled: !!effectiveUserId && teamIds.length > 0,
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
        if (r.userId !== effectiveUserId) return false;
        if (requestIdParam) return r.id === requestIdParam;
        return r.status === 'pending' || r.status === 'waiting';
      });
    });
  }, [teams, currentUser, effectiveUserId, requestIdParam]);

  const isOwnProfile = currentUser?.id === effectiveUserId;
  const following = currentUser ? isFollowing(currentUser.id, effectiveUserId) : false;
  const userTeamsFromContext = getUserTeams(effectiveUserId);
  const requestTeam = contextRequestTeam ?? fetchedRequestTeam ?? fallbackRequestTeam;
  const canCaptainHandleRequest = !!currentUser && !!requestTeam && requestTeam.captainId === currentUser.id;
  const joinRequest = canCaptainHandleRequest && requestTeam
    ? requestTeam.joinRequests.find((r) => {
        if (r.userId !== effectiveUserId) return false;
        if (!requestIdParam) return r.status === 'pending' || r.status === 'waiting';
        return r.id === requestIdParam;
      })
    : undefined;
  const canHandleThisRequest = !!joinRequest && (joinRequest.status === 'pending' || joinRequest.status === 'waiting');

  console.log('[UserProfile] DEBUG BOUTON CAPITAINE:', {
    profileUserId,
    effectiveUserId,
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
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} pointerEvents="none" />
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
      r.participants.includes(effectiveUserId)
    );
    
    if (existingDirectRoom) {
      // Navigate directly to existing chat
      router.push(`/chat/${existingDirectRoom.id}`);
      return;
    }
    
    // Check if there's a pending request
    const sentRequests = getSentChatRequests();
    const pendingRequest = sentRequests.find(r => r.recipientId === effectiveUserId);
    
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
              await createChatRequest({ recipientId: effectiveUserId });
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

  const winRate = profileUser.stats.matchesPlayed > 0
    ? Math.round((profileUser.stats.wins / profileUser.stats.matchesPlayed) * 100)
    : 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0a0e1a']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Floating back */}
          <View style={styles.floatingBackRow}>
            <TouchableOpacity style={styles.floatingBackBtn} onPress={() => safeBack(router, '/(tabs)/(home)')} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ════ Hero section ════ */}
            <View style={styles.heroSection}>
              {/* Banner */}
              <View style={styles.bannerContainer}>
                {profileUser.bannerImage ? (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => fullscreen.open(profileUser.bannerImage!)}>
                    <Image source={{ uri: profileUser.bannerImage }} style={styles.bannerImage} contentFit="cover" transition={200} />
                  </TouchableOpacity>
                ) : (
                  <LinearGradient
                    colors={['#1a2a4f', '#0f1f3f', '#0a1530']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerImage}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'transparent', 'rgba(10,14,26,0.8)']}
                  style={styles.bannerGradient}
                />
              </View>

              {/* Avatar + identity */}
              <View style={styles.identitySection}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => profileUser.avatar && fullscreen.open(profileUser.avatar)}>
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
                </TouchableOpacity>

                <View style={styles.identityInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayName}>{profileUser.fullName}</Text>
                    {profileUser.isPremium && (
                      <View style={styles.premiumBadge}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.premiumText}>Premium</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.username}>@{profileUser.username}</Text>
                  {profileUser.city && (
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={Colors.text.muted} />
                      <Text style={styles.locationText}>{profileUser.city}{profileUser.country ? `, ${profileUser.country}` : ''}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Bio */}
              {profileUser.bio && (
                <Text style={styles.bio}>{profileUser.bio}</Text>
              )}

              {/* Team tags */}
              {displayTeams.length > 0 && (
                <View style={styles.teamTagsRow}>
                  <Shield size={13} color={Colors.primary.orange} />
                  <Text style={styles.teamTagsText} numberOfLines={2}>
                    {displayTeams.length === 1
                      ? displayTeams[0].name
                      : `${displayTeams[0].name} ${t('userProfile.and')} ${displayTeams.length - 1} ${displayTeams.length > 2 ? t('userProfile.otherPlural') : t('userProfile.otherSingle')}`}
                  </Text>
                </View>
              )}

              {/* Quick stats pills */}
              <View style={styles.statsPillsRow}>
                <View style={styles.statPill}>
                  <Activity size={13} color={Colors.primary.blue} />
                  <Text style={styles.statPillValue}>{profileUser.stats.matchesPlayed}</Text>
                  <Text style={styles.statPillLabel}>Matchs</Text>
                </View>
                <View style={styles.statPill}>
                  <TrendingUp size={13} color={Colors.status.success} />
                  <Text style={styles.statPillValue}>{winRate}%</Text>
                  <Text style={styles.statPillLabel}>Win rate</Text>
                </View>
                <View style={styles.statPill}>
                  <Award size={13} color="#F59E0B" />
                  <Text style={styles.statPillValue}>{profileUser.stats.mvpAwards}</Text>
                  <Text style={styles.statPillLabel}>MVP</Text>
                </View>
                <View style={styles.statPill}>
                  <Star size={13} color="#F59E0B" />
                  <Text style={styles.statPillValue}>{profileUser.stats.fairPlayScore.toFixed(1)}</Text>
                  <Text style={styles.statPillLabel}>Fair-play</Text>
                </View>
              </View>

              {/* Social counters */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialItem} onPress={() => router.push(`/followers?userId=${effectiveUserId}`)} activeOpacity={0.6}>
                  <Text style={styles.socialValue}>{profileUser.followers}</Text>
                  <Text style={styles.socialLabel}>{t('userProfile.followers')}</Text>
                </TouchableOpacity>
                <View style={styles.socialDivider} />
                <TouchableOpacity style={styles.socialItem} onPress={() => router.push(`/following?userId=${effectiveUserId}`)} activeOpacity={0.6}>
                  <Text style={styles.socialValue}>{profileUser.following}</Text>
                  <Text style={styles.socialLabel}>{t('userProfile.following')}</Text>
                </TouchableOpacity>
                <View style={styles.socialDivider} />
                <TouchableOpacity style={styles.socialItem} onPress={() => router.push(`/my-teams?userId=${effectiveUserId}`)} activeOpacity={0.6}>
                  <Text style={styles.socialValue}>{displayTeams.length}</Text>
                  <Text style={styles.socialLabel}>{t('userProfile.teams', { count: displayTeams.length })}</Text>
                </TouchableOpacity>
              </View>

              {/* Action buttons */}
              {!isOwnProfile && (
                <View style={styles.actionsRow}>
                  <Button
                    title={following ? t('userProfile.unfollow') : t('userProfile.follow')}
                    onPress={handleFollow}
                    variant={following ? 'secondary' : 'primary'}
                    size="medium"
                    icon={following ? <UserMinus size={18} color={Colors.text.primary} /> : <UserPlus size={18} color="#FFF" />}
                    style={styles.followBtn}
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

            {/* ════ Sports ════ */}
            {profileUser.sports.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('userProfile.sportsPlayed')}</Text>
                <View style={styles.sportsGrid}>
                  {profileUser.sports.map((sport, i) => (
                    <View key={i} style={styles.sportCard}>
                      <Text style={styles.sportEmoji}>
                        {sport.sport === 'football' ? '⚽' : sport.sport === 'basketball' ? '🏀' : sport.sport === 'volleyball' ? '🏐' : sport.sport === 'tennis' ? '🎾' : '🏃'}
                      </Text>
                      <Text style={styles.sportName}>{sportLabels[sport.sport]}</Text>
                      <Text style={styles.sportLevel}>{levelLabels[sport.level]}</Text>
                      {sport.position ? <Text style={styles.sportPosition}>{sport.position}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ════ Detailed stats ════ */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('userProfile.stats')}</Text>

              {/* Win/Loss/Draw bar */}
              {(() => {
                const total = profileUser.stats.wins + profileUser.stats.losses + profileUser.stats.draws;
                if (total === 0) return null;
                const winPct = Math.round((profileUser.stats.wins / total) * 100);
                const drawPct = Math.round((profileUser.stats.draws / total) * 100);
                const lossPct = Math.max(0, 100 - winPct - drawPct);
                return (
                  <View style={styles.wldContainer}>
                    <View style={styles.wldBar}>
                      <View style={[styles.wldSegWin, { flex: winPct }]} />
                      <View style={[styles.wldSegDraw, { flex: drawPct }]} />
                      <View style={[styles.wldSegLoss, { flex: lossPct }]} />
                    </View>
                    <View style={styles.wldLegend}>
                      <View style={styles.wldLegendItem}>
                        <View style={[styles.wldDot, { backgroundColor: Colors.status.success }]} />
                        <Text style={styles.wldLegendText}>{profileUser.stats.wins} V ({winPct}%)</Text>
                      </View>
                      <View style={styles.wldLegendItem}>
                        <View style={[styles.wldDot, { backgroundColor: Colors.text.muted }]} />
                        <Text style={styles.wldLegendText}>{profileUser.stats.draws} N ({drawPct}%)</Text>
                      </View>
                      <View style={styles.wldLegendItem}>
                        <View style={[styles.wldDot, { backgroundColor: Colors.status.error }]} />
                        <Text style={styles.wldLegendText}>{profileUser.stats.losses} D ({lossPct}%)</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Swords size={18} color={Colors.primary.blue} />
                  <Text style={styles.statTileValue}>{profileUser.stats.matchesPlayed}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.matches')}</Text>
                </View>
                <View style={styles.statTile}>
                  <Trophy size={18} color={Colors.status.success} />
                  <Text style={styles.statTileValue}>{profileUser.stats.wins}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.wins')}</Text>
                </View>
                <View style={styles.statTile}>
                  <Award size={18} color={Colors.primary.orange} />
                  <Text style={styles.statTileValue}>{profileUser.stats.mvpAwards}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.mvp')}</Text>
                </View>
                <View style={styles.statTile}>
                  <Zap size={18} color={Colors.primary.orange} />
                  <Text style={styles.statTileValue}>{profileUser.stats.goalsScored}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.goals')}</Text>
                </View>
                <View style={styles.statTile}>
                  <Users size={18} color={Colors.primary.blue} />
                  <Text style={styles.statTileValue}>{profileUser.stats.assists}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.assists')}</Text>
                </View>
                <View style={styles.statTile}>
                  <Star size={18} color={Colors.status.success} />
                  <Text style={styles.statTileValue}>{profileUser.stats.fairPlayScore.toFixed(1)}</Text>
                  <Text style={styles.statTileLabel}>{t('userProfile.fairPlay')}</Text>
                </View>
              </View>
            </View>

            {/* ════ Teams ════ */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('userProfile.teams', { count: displayTeams.length })}</Text>
                {displayTeams.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{displayTeams.length}</Text>
                  </View>
                )}
              </View>
              {displayTeams.length > 0 ? (
                <View style={styles.teamsList}>
                  {displayTeams.map((team) => (
                    <TouchableOpacity key={team.id} style={styles.teamRow} onPress={() => router.push(`/team/${team.id}`)} activeOpacity={0.7}>
                      <Avatar uri={team.logo} name={team.name} size="medium" />
                      <View style={styles.teamInfo}>
                        <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                        <Text style={styles.teamMeta}>{sportLabels[team.sport]} · {team.format}</Text>
                        <View style={styles.teamLocationRow}>
                          <MapPin size={11} color={Colors.text.muted} />
                          <Text style={styles.teamLocationText}>{team.city}</Text>
                        </View>
                      </View>
                      {team.captainId === effectiveUserId && (
                        <View style={styles.captainChip}>
                          <Shield size={12} color={Colors.primary.orange} />
                          <Text style={styles.captainChipText}>{t('userProfile.captain')}</Text>
                        </View>
                      )}
                      {team.members.find(m => m.userId === effectiveUserId)?.role === 'cm' && (
                        <View style={styles.cmChip}>
                          <Megaphone size={12} color={Colors.primary.blue} />
                          <Text style={styles.cmChipText}>Community Manager</Text>
                        </View>
                      )}
                      {team.members.find(m => m.userId === effectiveUserId)?.role === 'co-captain' && (
                        <View style={styles.coCaptainChip}>
                          <Shield size={12} color={Colors.status.success} />
                          <Text style={styles.coCaptainChipText}>Co-capitaine</Text>
                        </View>
                      )}
                      <ChevronRight size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyTeams}>
                  <Shield size={28} color={Colors.text.muted} strokeWidth={1.5} />
                  <Text style={styles.emptyTeamsText}>{t('userProfile.noTeams')}</Text>
                </View>
              )}
            </View>

            {/* ════ Posts ════ */}
            {userPosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Newspaper size={18} color={Colors.primary.orange} />
                  <Text style={styles.sectionTitle}>Publications</Text>
                </View>
                {userPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={() => {}}
                    onComment={() => {}}
                    currentUserId={currentUser?.id}
                  />
                ))}
              </View>
            )}

            {/* ════ Member since ════ */}
            <View style={styles.memberSinceRow}>
              <Calendar size={14} color={Colors.text.muted} />
              <Text style={styles.memberSinceText}>{t('userProfile.memberSince', { date: formatDate(profileUser.createdAt) })}</Text>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
        {fullscreen.viewer}
      </View>
    </>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Floating back
  floatingBackRow: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  floatingBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ════ Hero ════
  heroSection: { marginBottom: 8 },
  bannerContainer: { position: 'relative', height: 180 },
  bannerImage: { width: '100%', height: 180 },
  bannerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  identitySection: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: -40 },
  avatarRing: { position: 'relative', padding: 3, borderRadius: 60, backgroundColor: Colors.background.dark, borderWidth: 3, borderColor: Colors.primary.blue },
  avatarInner: { borderRadius: 56, overflow: 'hidden' },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.background.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.status.success },

  identityInfo: { flex: 1, marginLeft: 16, marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  premiumText: { color: '#F59E0B', fontSize: 10, fontWeight: '600' },
  username: { color: Colors.text.muted, fontSize: 14, marginTop: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { color: Colors.text.muted, fontSize: 13 },

  bio: { color: Colors.text.secondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginTop: 14 },

  teamTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginTop: 10 },
  teamTagsText: { color: Colors.primary.orange, fontSize: 13, fontWeight: '500', flexShrink: 1 },

  // Stats pills
  statsPillsRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 8 },
  statPill: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.background.card, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border.light },
  statPillValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
  statPillLabel: { color: Colors.text.muted, fontSize: 10, fontWeight: '500' },

  // Social counters
  socialRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 14 },
  socialItem: { alignItems: 'center', paddingHorizontal: 16 },
  socialValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  socialLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  socialDivider: { width: 1, height: 28, backgroundColor: Colors.border.light },

  // Actions
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 18 },
  followBtn: { flex: 1 },
  messageBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  joinRequestActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 16 },
  joinRequestBtn: { flex: 1 },

  // ════ Sections ════
  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary.blue, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Sports
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: { alignItems: 'center', backgroundColor: Colors.background.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border.light, minWidth: 100 },
  sportEmoji: { fontSize: 28, marginBottom: 6 },
  sportName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  sportLevel: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  sportPosition: { color: Colors.primary.blue, fontSize: 11, marginTop: 2 },

  // W/L/D bar
  wldContainer: { marginBottom: 16 },
  wldBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: Colors.background.card },
  wldSegWin: { backgroundColor: Colors.status.success },
  wldSegDraw: { backgroundColor: Colors.text.muted },
  wldSegLoss: { backgroundColor: Colors.status.error },
  wldLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  wldLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wldDot: { width: 8, height: 8, borderRadius: 4 },
  wldLegendText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: { width: (SCREEN_WIDTH - 40 - 20) / 3, alignItems: 'center', backgroundColor: Colors.background.card, borderRadius: 14, paddingVertical: 16, gap: 6, borderWidth: 1, borderColor: Colors.border.light },
  statTileValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' },
  statTileLabel: { color: Colors.text.muted, fontSize: 11 },

  // Teams
  teamsList: { gap: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border.light },
  teamInfo: { flex: 1 },
  teamName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  teamMeta: { color: Colors.text.secondary, fontSize: 12, marginTop: 2 },
  teamLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  teamLocationText: { color: Colors.text.muted, fontSize: 11 },
  captainChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,0,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  captainChipText: { color: Colors.primary.orange, fontSize: 11, fontWeight: '500' },
  cmChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary.blue + '18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cmChipText: { color: Colors.primary.blue, fontSize: 11, fontWeight: '600' },
  coCaptainChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.status.success + '18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  coCaptainChipText: { color: Colors.status.success, fontSize: 11, fontWeight: '500' },
  emptyTeams: { alignItems: 'center', gap: 10, backgroundColor: Colors.background.card, borderRadius: 14, paddingVertical: 28, borderWidth: 1, borderColor: Colors.border.light },
  emptyTeamsText: { color: Colors.text.muted, fontSize: 14 },

  // Member since
  memberSinceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
  memberSinceText: { color: Colors.text.muted, fontSize: 13 },

  bottomSpacer: { height: 40 },

  // Error
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: Colors.text.primary, fontSize: 16 },
  errorLink: { color: Colors.primary.blue, fontSize: 14 },
});
