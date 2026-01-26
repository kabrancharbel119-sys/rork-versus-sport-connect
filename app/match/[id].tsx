import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trophy, DollarSign, Share2, Edit2, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useUsers } from '@/contexts/UsersContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { sportLabels, levelLabels, ambianceLabels } from '@/mocks/data';

export default function MatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getMatchById, joinMatch, leaveMatch, updateMatch, deleteMatch, isUpdating, refetchMatches } = useMatches();
  const { notifyMatchUpdate } = useNotifications();
  const { getUserById } = useUsers();
  const [isJoining, setIsJoining] = useState(false);

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
            <Text style={styles.errorText}>Match non trouvé</Text>
            <Button title="Retour" onPress={() => router.back()} variant="outline" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isRegistered = match.registeredPlayers.includes(user?.id || '');
  const isCreator = match.createdBy === user?.id;
  const isFull = match.registeredPlayers.length >= match.maxPlayers;

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleJoin = async () => {
    if (!user) return;
    setIsJoining(true);
    try {
      await joinMatch({ matchId: match.id, userId: user.id });
      await notifyMatchUpdate(match.id, 'joined', match.venue?.name, user.id);
      Alert.alert('Succès', 'Vous êtes inscrit !');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
    setIsJoining(false);
  };

  const handleLeave = () => {
    Alert.alert(
      'Se désinscrire',
      'Êtes-vous sûr de vouloir vous désinscrire de ce match ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se désinscrire',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveMatch({ matchId: match.id, userId: user!.id });
              await notifyMatchUpdate(match.id, 'left', match.venue?.name, user!.id);
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
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
      'Supprimer le match',
      'Êtes-vous sûr de vouloir supprimer ce match ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const registeredIds = [...match.registeredPlayers];
              await deleteMatch({ matchId: match.id, userId: user!.id });
              await notifyMatchUpdate(match.id, 'cancelled', match.venue?.name, registeredIds.filter((id) => id !== user!.id));
              Alert.alert('Succès', 'Match supprimé');
              router.back();
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
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
      case 'open': return 'Ouvert aux inscriptions';
      case 'confirmed': return 'Confirmé';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminé';
      default: return status;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.matchHeader}>
              <View style={[styles.typeBadge, { backgroundColor: match.type === 'ranked' ? Colors.primary.orange : Colors.primary.blue }]}>
                <Text style={styles.typeText}>
                  {match.type === 'friendly' ? '⚽ Amical' : '🏆 Match classé'}
                </Text>
              </View>
              {match.type === 'ranked' && (
                <Text style={styles.rankedImportance}>Compte pour le classement et la réputation</Text>
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
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{formatDate(match.dateTime)}</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Clock size={20} color={Colors.primary.blue} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Heure</Text>
                  <Text style={styles.infoValue}>{formatTime(match.dateTime)} • {match.duration} min</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <MapPin size={20} color={Colors.primary.blue} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Lieu</Text>
                  <Text style={styles.infoValue}>{match.venue.name}</Text>
                  <Text style={styles.infoSubValue}>{match.venue.address}</Text>
                </View>
              </View>
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
                  <Text style={styles.rankedStakesTitle}>À quoi sert ce match ?</Text>
                </View>
                <Text style={styles.rankedStakesDesc}>
                  Aucun argent en jeu. Ce match compte pour ton classement et ta réputation. Victoire ou défaite seront enregistrées dans tes statistiques officielles.
                </Text>
                <View style={styles.rankedBullets}>
                  <Text style={styles.rankedBullet}>• Impact sur ton rang</Text>
                  <Text style={styles.rankedBullet}>• Réputation mise à jour</Text>
                  <Text style={styles.rankedBullet}>• Stats V / D enregistrées</Text>
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
                        <Text style={styles.prizeLabel}>Mise</Text>
                        <Text style={styles.prizeValue}>{match.entryFee.toLocaleString()} FCFA</Text>
                      </View>
                    </View>
                  )}
                  {match.prize && (
                    <View style={styles.prizeItem}>
                      <Trophy size={20} color={Colors.primary.orange} />
                      <View>
                        <Text style={styles.prizeLabel}>Récompense</Text>
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
                  Joueurs inscrits ({match.registeredPlayers.length}/{match.maxPlayers})
                </Text>
              </View>

              <View style={styles.playersProgress}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${(match.registeredPlayers.length / match.maxPlayers) * 100}%` }
                  ]} 
                />
              </View>

              <View style={styles.playersList}>
                {match.registeredPlayers.map((playerId) => {
                  const player = getUserById(playerId);
                  return (
                    <View key={playerId} style={styles.playerItem}>
                      <Avatar uri={playerId === user?.id ? user?.avatar : player?.avatar} name={playerId === user?.id ? user?.fullName : player?.fullName || player?.username} size="small" />
                      <Text style={styles.playerName}>
                        {playerId === user?.id ? 'Vous' : player?.fullName || player?.username || 'Joueur'}
                      </Text>
                      {playerId === match.createdBy && (
                        <View style={styles.organizerBadge}>
                          <Text style={styles.organizerText}>Organisateur</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {[...Array(Math.max(0, match.maxPlayers - match.registeredPlayers.length))].map((_, index) => (
                  <View key={`empty-${index}`} style={styles.playerItem}>
                    <View style={styles.emptyAvatar} />
                    <Text style={styles.emptyPlayerName}>Place disponible</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              {isRegistered ? (
                <>
                  <View style={styles.registeredBanner}>
                    <Text style={styles.registeredText}>✓ Vous êtes inscrit</Text>
                  </View>
                  {!isCreator && (
                    <Button
                      title="Se désinscrire"
                      onPress={handleLeave}
                      variant="outline"
                      style={styles.actionButton}
                    />
                  )}
                </>
              ) : isFull ? (
                <Button
                  title="Match complet"
                  onPress={() => {}}
                  variant="secondary"
                  disabled
                  style={styles.actionButton}
                />
              ) : match.status === 'open' ? (
                <Button
                  title={match.type === 'ranked' ? "S'inscrire (compte pour ton rang)" : match.entryFee ? `S'inscrire (${match.entryFee.toLocaleString()} FCFA)` : "S'inscrire"}
                  onPress={handleJoin}
                  loading={isJoining}
                  variant="orange"
                  size="large"
                  style={styles.actionButton}
                />
              ) : (
                <Button
                  title="Inscriptions fermées"
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
  bottomSpacer: {
    height: 40,
  },
});