import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trophy, DollarSign, Share2, Edit2, Trash2, Play, Radio, Square, Circle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels, ambianceLabels } from '@/mocks/data';
import { liveScoringApi } from '@/lib/api/live-scoring';
import { rankingApi } from '@/lib/api/ranking';

export default function MatchDetailScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user } = useAuth();
  const { getMatchById, joinMatch, leaveMatch, updateMatch, deleteMatch, isUpdating, refetchMatches } = useMatches();
  const { notifyMatchUpdate } = useNotifications();
  const { users } = useUsers();
  const [isJoining, setIsJoining] = useState(false);
  const [isLiveScoring, setIsLiveScoring] = useState(false);
  const [isStartingLive, setIsStartingLive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetchMatches();
    }, [refetchMatches])
  );

  const match = getMatchById(id || '');

  if (!match) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('matchDetail.notFound')}</Text>
            <Button title={t('common.back')} onPress={() => safeBack(router, '/(tabs)/matches')} variant="outline" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isRegistered = (match.registeredPlayers ?? []).includes(user?.id || '');
  const isCreator = match.createdBy === user?.id;
  const isFull = (match.registeredPlayers ?? []).length >= match.maxPlayers;

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleJoin = async () => {
    if (!user) return;
    setIsJoining(true);
    try {
      await joinMatch({ matchId: match.id, userId: user.id });
      await notifyMatchUpdate(match.id, 'joined', match.venue?.name, user.id);
      Alert.alert(t('common.success'), t('matchDetail.joinSuccess'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
    setIsJoining(false);
  };

  const handleLeave = () => {
    Alert.alert(
      t('matchDetail.leaveTitle'),
      t('matchDetail.leaveMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('matchDetail.leaveAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveMatch({ matchId: match.id, userId: user!.id });
              await notifyMatchUpdate(match.id, 'left', match.venue?.name, user!.id);
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push(`/edit-match/${match.id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      t('matchDetail.deleteTitle'),
      t('matchDetail.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const registeredIds = [...(match.registeredPlayers ?? [])];
              await deleteMatch({ matchId: match.id, userId: user!.id });
              await notifyMatchUpdate(match.id, 'cancelled', match.venue?.name, registeredIds.filter((id) => id !== user!.id));
              Alert.alert(t('common.success'), t('matchDetail.deleteSuccess'));
              safeBack(router, '/(tabs)/matches');
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return Colors.status.success;
      case 'confirmed': return Colors.primary.blue;
      case 'in_progress': return Colors.primary.orange;
      default: return Colors.text.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return t('matchDetail.statusOpen');
      case 'confirmed': return t('matchDetail.statusConfirmed');
      case 'in_progress': return t('matchDetail.statusInProgress');
      case 'completed': return t('matchDetail.statusCompleted');
      default: return status;
    }
  };

  const handleStartLiveScoring = async () => {
    if (!user || !isCreator) return;
    
    setIsStartingLive(true);
    try {
      // Simuler des équipes (à adapter selon votre logique)
      const homeTeamId = 'home-team-id'; // À adapter
      const awayTeamId = 'away-team-id'; // À adapter
      
      await liveScoringApi.startLiveMatch(match.id, homeTeamId, awayTeamId);
      setIsLiveScoring(true);
      Alert.alert(t('matchDetail.liveStartTitle'), t('matchDetail.liveStartMessage'));
      
      // Mettre à jour le statut du match
      await updateMatch({ matchId: match.id, updates: { status: 'in_progress' } as any });
    } catch (error: any) {
      Alert.alert(t('common.error'), t('matchDetail.liveStartError'));
    }
    setIsStartingLive(false);
  };

  const handleEndLiveScoring = async () => {
    if (!user || !isCreator) return;
    
    Alert.alert(
      t('matchDetail.endMatchTitle'),
      t('matchDetail.endMatchMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('matchDetail.endMatchAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              await liveScoringApi.endLiveMatch(match.id);
              setIsLiveScoring(false);
              Alert.alert(t('matchDetail.endMatchDoneTitle'), t('matchDetail.endMatchDoneMessage'));
              
              // Mettre à jour le statut du match
              await updateMatch({ matchId: match.id, updates: { status: 'completed' } as any });
              
              // Mettre à jour les classements (à implémenter)
              // await updatePlayerRankings();
            } catch (error: any) {
              Alert.alert(t('common.error'), t('matchDetail.endMatchError'));
            }
          },
        },
      ]
    );
  };

  const handleOpenLiveScoring = () => {
    router.push(`/live-match/${match.id}`);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/matches')}>
                <ArrowLeft size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <View style={styles.headerActions}>
                {isCreator && (
                  <>
                    <TouchableOpacity style={styles.headerButton} onPress={handleEdit}>
                      <Edit2 size={20} color={Colors.primary.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
                      <Trash2 size={20} color={Colors.status.error} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={styles.headerButton}>
                  <Share2 size={20} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.matchHeader}>
              <View style={[styles.typeBadge, { backgroundColor: match.type === 'ranked' ? Colors.primary.orange : Colors.primary.blue }]}>
                <Text style={styles.typeText}>
                  {match.type === 'friendly' ? t('matchDetail.friendlyType') : t('matchDetail.rankedType')}
                </Text>
              </View>
              {match.type === 'ranked' && (
                <Text style={styles.rankedImportance}>{t('matchDetail.rankedImportance')}</Text>
              )}

              <Text style={styles.matchTitle}>
                {sportLabels[match.sport]} • {match.format}
              </Text>

              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(match.status)}20` }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(match.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(match.status) }]}>
                  {getStatusLabel(match.status)}
                </Text>
              </View>
            </View>

            <Card style={styles.infoCard} variant="gradient">
              <View style={styles.infoRow}>
                <Calendar size={20} color={Colors.primary.blue} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('matchDetail.date')}</Text>
                  <Text style={styles.infoValue}>{formatDate(match.dateTime)}</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Clock size={20} color={Colors.primary.blue} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('matchDetail.time')}</Text>
                  <Text style={styles.infoValue}>{formatTime(match.dateTime)} • {match.duration} min</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              {match.venue && (
                <View style={styles.infoRow}>
                  <MapPin size={20} color={Colors.primary.blue} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('matchDetail.venue')}</Text>
                    <Text style={styles.infoValue}>{match.venue.name}</Text>
                    {match.venue.address && <Text style={styles.infoSubValue}>{match.venue.address}</Text>}
                  </View>
                </View>
              )}
            </Card>

            <View style={styles.tagsRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{levelLabels[match.level]}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{ambianceLabels[match.ambiance]}</Text>
              </View>
            </View>

            {match.type === 'ranked' && (
              <Card style={styles.rankedStakesCard}>
                <View style={styles.rankedStakesHeader}>
                  <Trophy size={20} color={Colors.primary.orange} />
                  <Text style={styles.rankedStakesTitle}>{t('matchDetail.rankedWhyTitle')}</Text>
                </View>
                <Text style={styles.rankedStakesDesc}>
                  {t('matchDetail.rankedWhyDesc')}
                </Text>
                <View style={styles.rankedBullets}>
                  <Text style={styles.rankedBullet}>{t('matchDetail.rankedPoint1')}</Text>
                  <Text style={styles.rankedBullet}>{t('matchDetail.rankedPoint2')}</Text>
                  <Text style={styles.rankedBullet}>{t('matchDetail.rankedPoint3')}</Text>
                </View>
              </Card>
            )}

            {match.type !== 'ranked' && (match.entryFee || match.prize) && (
              <Card style={styles.prizeCard}>
                <View style={styles.prizeRow}>
                  {match.entryFee && (
                    <View style={styles.prizeItem}>
                      <DollarSign size={20} color={Colors.text.muted} />
                      <View>
                        <Text style={styles.prizeLabel}>{t('matchDetail.stake')}</Text>
                        <Text style={styles.prizeValue}>{match.entryFee.toLocaleString()} FCFA</Text>
                      </View>
                    </View>
                  )}
                  {match.prize && (
                    <View style={styles.prizeItem}>
                      <Trophy size={20} color={Colors.primary.orange} />
                      <View>
                        <Text style={styles.prizeLabel}>{t('matchDetail.prize')}</Text>
                        <Text style={[styles.prizeValue, styles.prizeHighlight]}>{match.prize.toLocaleString()} FCFA</Text>
                      </View>
                    </View>
                  )}
                </View>
              </Card>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={20} color={Colors.text.primary} />
                <Text style={styles.sectionTitle}>
                  {t('matchDetail.registeredPlayers', { count: (match.registeredPlayers ?? []).length, max: match.maxPlayers })}
                </Text>
              </View>

              <View style={styles.playersProgress}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${((match.registeredPlayers ?? []).length / match.maxPlayers) * 100}%` }
                  ]} 
                />
              </View>

              <View style={styles.playersList}>
                {(match.registeredPlayers ?? []).map((playerId) => {
                  const player = users.find((u) => u.id === playerId);
                  return (
                    <View key={playerId} style={styles.playerItem}>
                      <Avatar uri={playerId === user?.id ? user?.avatar : player?.avatar} name={playerId === user?.id ? user?.fullName : player?.fullName || player?.username} size="small" />
                      <Text style={styles.playerName}>
                        {playerId === user?.id ? t('matchDetail.you') : player?.fullName || player?.username || t('matchDetail.player')}
                      </Text>
                      {playerId === match.createdBy && (
                        <View style={styles.organizerBadge}>
                          <Text style={styles.organizerText}>{t('matchDetail.organizer')}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {[...Array(Math.max(0, match.maxPlayers - (match.registeredPlayers ?? []).length))].map((_, index) => (
                  <View key={`empty-${index}`} style={styles.playerItem}>
                    <View style={styles.emptyAvatar} />
                    <Text style={styles.emptyPlayerName}>{t('matchDetail.availableSlot')}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              {isRegistered ? (
                <>
                  <View style={styles.registeredBanner}>
                    <Text style={styles.registeredText}>{t('matchDetail.registeredBanner')}</Text>
                  </View>
                  
                  {/* Boutons Live Scoring pour le créateur */}
                  {isCreator && (
                    <View style={styles.liveScoringActions}>
                      {!isLiveScoring && match.status === 'confirmed' && (
                        <Button
                          title={t('matchDetail.startLive')}
                          onPress={handleStartLiveScoring}
                          loading={isStartingLive}
                          variant="orange"
                          style={styles.liveScoringButton}
                        />
                      )}
                      
                      {isLiveScoring && (
                        <>
                          <TouchableOpacity 
                            style={styles.liveScoringBanner}
                            onPress={handleOpenLiveScoring}
                          >
                            <Radio size={20} color={Colors.primary.orange} />
                            <Text style={styles.liveScoringBannerText}>{t('matchDetail.liveFollowCreator')}</Text>
                          </TouchableOpacity>
                          
                          <Button
                            title={t('matchDetail.endLive')}
                            onPress={handleEndLiveScoring}
                            variant="secondary"
                            style={styles.liveScoringButton}
                          />
                        </>
                      )}
                    </View>
                  )}
                  
                  {/* Bouton pour voir le live scoring pour les participants */}
                  {!isCreator && isLiveScoring && (
                    <TouchableOpacity 
                      style={styles.liveScoringBanner}
                      onPress={handleOpenLiveScoring}
                    >
                      <Radio size={20} color={Colors.primary.orange} />
                      <Text style={styles.liveScoringBannerText}>{t('matchDetail.liveFollowParticipant')}</Text>
                    </TouchableOpacity>
                  )}
                  
                  {!isCreator && (
                    <Button
                      title={t('matchDetail.leaveAction')}
                      onPress={handleLeave}
                      variant="outline"
                      style={styles.actionButton}
                    />
                  )}
                </>
              ) : isFull ? (
                <Button
                  title={t('matchDetail.full')}
                  onPress={() => {}}
                  variant="secondary"
                  disabled
                  style={styles.actionButton}
                />
              ) : match.status === 'venue_pending' ? (
                <View style={styles.venuePendingBlock}>
                  <Clock size={18} color={Colors.status.warning} />
                  <Text style={styles.venuePendingBlockText}>En attente de confirmation du gestionnaire du terrain. L'inscription sera ouverte une fois le créneau approuvé.</Text>
                </View>
              ) : match.status === 'open' ? (
                <Button
                  title={match.type === 'ranked' ? t('matchDetail.joinRanked') : match.entryFee ? t('matchDetail.joinFee', { fee: match.entryFee.toLocaleString() }) : t('matchDetail.join')}
                  onPress={handleJoin}
                  loading={isJoining}
                  variant="orange"
                  size="large"
                  style={styles.actionButton}
                />
              ) : (
                <Button
                  title={t('matchDetail.registrationClosed')}
                  onPress={() => {}}
                  variant="secondary"
                  disabled
                  style={styles.actionButton}
                />
              )}
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: Colors.text.primary,
    fontSize: 18,
  },
  matchHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  typeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  matchTitle: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 4,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  infoSubValue: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: Colors.background.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  tagText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  rankedImportance: {
    color: Colors.primary.orange,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: -8,
    marginBottom: 12,
    textAlign: 'center',
  },
  rankedStakesCard: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
  },
  rankedStakesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rankedStakesTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rankedStakesDesc: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  rankedBullets: {
    gap: 4,
  },
  rankedBullet: {
    color: Colors.primary.orange,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  prizeCard: {
    marginBottom: 24,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  prizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prizeLabel: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  prizeValue: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  prizeHighlight: {
    color: Colors.primary.orange,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  playersProgress: {
    height: 6,
    backgroundColor: Colors.background.cardLight,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary.blue,
    borderRadius: 3,
  },
  playersList: {
    gap: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.card,
    padding: 12,
    borderRadius: 12,
  },
  playerName: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  organizerBadge: {
    backgroundColor: Colors.primary.blue,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  organizerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  emptyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.cardLight,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  emptyPlayerName: {
    color: Colors.text.muted,
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  registeredBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  registeredText: {
    color: Colors.status.success,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  actionButton: {
    width: '100%',
  },
  liveScoringActions: {
    gap: 12,
    marginBottom: 12,
  },
  liveScoringButton: {
    width: '100%',
  },
  liveScoringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary.orange + '20',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary.orange + '40',
  },
  liveScoringBannerText: {
    color: Colors.primary.orange,
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  venuePendingBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.status.warning}18`,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${Colors.status.warning}40`,
  },
  venuePendingBlockText: {
    color: Colors.status.warning,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});