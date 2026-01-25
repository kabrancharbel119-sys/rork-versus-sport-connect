import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Calendar, Trophy, Swords, Star, Users, MessageCircle, UserPlus, UserMinus, CheckCircle, Shield, Award } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels } from '@/mocks/data';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { getUserById, isFollowing, follow, unfollow, getFollowers, getFollowing } = useUsers();
  const { getUserTeams } = useTeams();

  const profileUser = getUserById(id || '');
  const isOwnProfile = currentUser?.id === id;
  const following = currentUser ? isFollowing(currentUser.id, id || '') : false;
  const userTeams = getUserTeams(id || '');
  const followers = getFollowers(id || '');
  const followingList = getFollowing(id || '');

  if (!profileUser) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Utilisateur non trouvé</Text>
            <TouchableOpacity onPress={() => router.back()}><Text style={styles.errorLink}>Retour</Text></TouchableOpacity>
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
      Alert.alert('Erreur', error.message);
    }
  };

  const handleMessage = () => {
    Alert.alert('Info', 'Fonctionnalité bientôt disponible');
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
            <Text style={styles.headerTitle}>Profil</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileHeader}>
              <Avatar uri={profileUser.avatar} name={profileUser.fullName} size="xlarge" />
              <View style={styles.nameRow}>
                <Text style={styles.fullName}>{profileUser.fullName}</Text>
                {profileUser.isVerified && <CheckCircle size={20} color={Colors.primary.blue} />}
                {profileUser.isPremium && <Star size={20} color={Colors.primary.orange} />}
              </View>
              <Text style={styles.username}>@{profileUser.username}</Text>
              <View style={styles.locationRow}>
                <MapPin size={14} color={Colors.text.muted} />
                <Text style={styles.locationText}>{profileUser.city}, {profileUser.country}</Text>
              </View>
              {profileUser.bio && <Text style={styles.bio}>{profileUser.bio}</Text>}

              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statItem}>
                  <Text style={styles.statValue}>{profileUser.followers}</Text>
                  <Text style={styles.statLabel}>Abonnés</Text>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <TouchableOpacity style={styles.statItem}>
                  <Text style={styles.statValue}>{profileUser.following}</Text>
                  <Text style={styles.statLabel}>Abonnements</Text>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profileUser.reputation.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Réputation</Text>
                </View>
              </View>

              {!isOwnProfile && (
                <View style={styles.actionButtons}>
                  <Button
                    title={following ? 'Se désabonner' : 'S\'abonner'}
                    onPress={handleFollow}
                    variant={following ? 'secondary' : 'primary'}
                    size="medium"
                    icon={following ? <UserMinus size={18} color={Colors.text.primary} /> : <UserPlus size={18} color="#FFF" />}
                    style={styles.actionBtn}
                  />
                  <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                    <MessageCircle size={20} color={Colors.primary.blue} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Statistiques</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Matchs" value={profileUser.stats.matchesPlayed} icon={<Swords size={18} color={Colors.primary.blue} />} variant="blue" />
              <StatCard label="Victoires" value={profileUser.stats.wins} icon={<Trophy size={18} color={Colors.status.success} />} variant="default" />
              <StatCard label="MVP" value={profileUser.stats.mvpAwards} icon={<Award size={18} color={Colors.primary.orange} />} variant="orange" />
            </View>
            <View style={styles.statsGrid}>
              <StatCard label="Buts" value={profileUser.stats.goalsScored} icon={<Swords size={18} color={Colors.primary.orange} />} variant="orange" />
              <StatCard label="Passes" value={profileUser.stats.assists} icon={<Users size={18} color={Colors.primary.blue} />} variant="blue" />
              <StatCard label="Fair-play" value={profileUser.stats.fairPlayScore.toFixed(1)} icon={<Star size={18} color={Colors.status.success} />} variant="default" />
            </View>

            {profileUser.sports.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Sports pratiqués</Text>
                {profileUser.sports.map((sport, i) => (
                  <Card key={i} style={styles.sportCard}>
                    <View style={styles.sportRow}>
                      <View style={styles.sportInfo}>
                        <Text style={styles.sportName}>{sportLabels[sport.sport]}</Text>
                        <Text style={styles.sportMeta}>{levelLabels[sport.level]} • {sport.position || 'Non défini'}</Text>
                        <Text style={styles.sportYears}>{sport.yearsPlaying} ans d'expérience</Text>
                      </View>
                      <View style={styles.sportLevel}>
                        <Text style={styles.sportLevelText}>{levelLabels[sport.level]}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {userTeams.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Équipes ({userTeams.length})</Text>
                {userTeams.map((team) => (
                  <Card key={team.id} style={styles.teamCard} onPress={() => router.push(`/team/${team.id}`)}>
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
                          <Text style={styles.captainText}>Capitaine</Text>
                        </View>
                      )}
                    </View>
                  </Card>
                ))}
              </>
            )}

            <View style={styles.joinedRow}>
              <Calendar size={14} color={Colors.text.muted} />
              <Text style={styles.joinedText}>Membre depuis {formatDate(profileUser.createdAt)}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  fullName: { color: Colors.text.primary, fontSize: 24, fontWeight: '700' as const },
  username: { color: Colors.text.muted, fontSize: 15, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { color: Colors.text.secondary, fontSize: 14 },
  bio: { color: Colors.text.secondary, fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 24 },
  statItem: { alignItems: 'center' },
  statValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '700' as const },
  statLabel: { color: Colors.text.muted, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border.light },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  actionBtn: { minWidth: 140 },
  messageBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary.blue },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginTop: 24, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  sportCard: { marginBottom: 12 },
  sportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sportInfo: { flex: 1 },
  sportName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  sportMeta: { color: Colors.text.secondary, fontSize: 14, marginTop: 4 },
  sportYears: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  sportLevel: { backgroundColor: Colors.primary.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  sportLevelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' as const },
  teamCard: { marginBottom: 12 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  teamInfo: { flex: 1 },
  teamName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  teamMeta: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  teamLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  teamLocationText: { color: Colors.text.muted, fontSize: 12 },
  captainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  captainText: { color: Colors.primary.orange, fontSize: 12, fontWeight: '500' as const },
  joinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  joinedText: { color: Colors.text.muted, fontSize: 13 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: Colors.text.primary, fontSize: 16 },
  errorLink: { color: Colors.primary.blue, fontSize: 14 },
  bottomSpacer: { height: 40 },
});
