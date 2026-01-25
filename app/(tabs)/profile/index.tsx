import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Edit2, Trophy, Star, Users, ChevronRight, Shield, Award, TrendingUp, Zap, MapPin, History, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useTrophies } from '@/contexts/TrophiesContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels } from '@/mocks/data';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { getUserMatches } = useMatches();
  const { getUserTeams, teams } = useTeams();
  const { getUnlockedCount, getTotalXP, checkAndUnlockTrophies } = useTrophies();

  const userMatches = user ? getUserMatches(user.id) : [];
  const userTeams = user ? getUserTeams(user.id) : [];
  const unlockedTrophies = user ? getUnlockedCount(user.id) : 0;
  const totalXP = user ? getTotalXP(user.id) : 0;
  const isCaptain = teams.some(t => t.captainId === user?.id);

  useEffect(() => {
    if (user) {
      checkAndUnlockTrophies(user.id, {
        matchesPlayed: user.stats.matchesPlayed,
        wins: user.stats.wins,
        goalsScored: user.stats.goalsScored,
        assists: user.stats.assists,
        mvpAwards: user.stats.mvpAwards,
        tournamentWins: user.stats.tournamentWins,
        followers: user.followers,
        isVerified: user.isVerified,
        isPremium: user.isPremium,
        isCaptain,
        fairPlayScore: user.stats.fairPlayScore,
        hasTeam: userTeams.length > 0,
        profileComplete: !!(user.fullName && user.city && user.sports?.length > 0),
      });
    }
  }, [user, isCaptain, userTeams.length, checkAndUnlockTrophies]);

  const winRate = user?.stats ? Math.round((user.stats.wins / (user.stats.matchesPlayed || 1)) * 100) : 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
            <Settings size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[Colors.primary.blue, Colors.primary.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCard}>
            <View style={styles.profileTop}>
              <Avatar uri={user?.avatar} name={user?.fullName} size="xlarge" />
              <TouchableOpacity style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                <Edit2 size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileName}>{user?.fullName || 'Joueur'}</Text>
            <Text style={styles.profileUsername}>@{user?.username || 'username'}</Text>
            {user?.city && (
              <View style={styles.locationRow}>
                <MapPin size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.locationText}>{user.city}, {user.country}</Text>
              </View>
            )}
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.followers || 0}</Text><Text style={styles.profileMetaLabel}>Abonnés</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.following || 0}</Text><Text style={styles.profileMetaLabel}>Abonnements</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.teams?.length || 0}</Text><Text style={styles.profileMetaLabel}>Équipes</Text></View>
            </View>
            {(user?.isPremium || isAdmin) && (
              <View style={styles.premiumBadge}>
                <Shield size={14} color={isAdmin ? Colors.primary.orange : '#F59E0B'} />
                <Text style={styles.premiumText}>{isAdmin ? 'Admin' : 'Premium'}</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.statsGrid}>
            <StatCard label="Matchs" value={user?.stats?.matchesPlayed || 0} icon={<Zap size={20} color={Colors.primary.blue} />} variant="blue" />
            <StatCard label="Victoires" value={`${winRate}%`} icon={<TrendingUp size={20} color={Colors.status.success} />} variant="default" />
            <StatCard label="MVP" value={user?.stats?.mvpAwards || 0} icon={<Award size={20} color={Colors.primary.orange} />} variant="orange" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sports pratiqués</Text>
            {user?.sports && user.sports.length > 0 ? (
              user.sports.map((sport, index) => (
                <Card key={index} style={styles.sportCard}>
                  <View style={styles.sportRow}>
                    <View style={styles.sportInfo}>
                      <Text style={styles.sportName}>{sportLabels[sport.sport] || sport.sport}</Text>
                      <Text style={styles.sportMeta}>{levelLabels[sport.level]} • {sport.yearsPlaying} ans</Text>
                    </View>
                    {sport.position && <View style={styles.positionBadge}><Text style={styles.positionText}>{sport.position}</Text></View>}
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Aucun sport ajouté</Text>
                <TouchableOpacity onPress={() => router.push('/edit-profile')}><Text style={styles.addLink}>Ajouter un sport</Text></TouchableOpacity>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques</Text>
            <Card style={styles.detailCard} variant="gradient">
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Buts marqués</Text><Text style={styles.detailValue}>{user?.stats?.goalsScored || 0}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Passes décisives</Text><Text style={styles.detailValue}>{user?.stats?.assists || 0}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Tournois gagnés</Text><Text style={styles.detailValue}>{user?.stats?.tournamentWins || 0}</Text></View>
              <View style={[styles.detailRow, styles.lastRow]}><Text style={styles.detailLabel}>Score Fair-Play</Text><View style={styles.fairPlayBadge}><Star size={14} color="#F59E0B" /><Text style={styles.fairPlayValue}>{user?.stats?.fairPlayScore?.toFixed(1) || '5.0'}</Text></View></View>
            </Card>
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trophies')}>
              <Trophy size={20} color={Colors.primary.orange} />
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Trophées et récompenses</Text>
                <Text style={styles.menuSubtext}>{unlockedTrophies} débloqués • {totalXP} XP</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/matches')}>
              <History size={20} color={Colors.text.secondary} />
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuText}>Historique des matchs</Text>
                <Text style={styles.menuSubtext}>{userMatches.length} matchs joués</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            {user?.isVerified && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/verification')}>
                <CheckCircle size={20} color={Colors.primary.blue} />
                <Text style={[styles.menuText, { color: Colors.primary.blue }]}>Compte vérifié ✓</Text>
                <ChevronRight size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Info', 'Partagez votre lien de profil')}>
              <Users size={20} color={Colors.text.secondary} /><Text style={styles.menuText}>Inviter des amis</Text><ChevronRight size={20} color={Colors.text.muted} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin')}>
                <Shield size={20} color={Colors.primary.orange} /><Text style={[styles.menuText, { color: Colors.primary.orange }]}>Panneau Admin</Text><ChevronRight size={20} color={Colors.primary.orange} />
              </TouchableOpacity>
            )}

          </View>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: Colors.text.primary, fontSize: 28, fontWeight: '700' as const },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  profileCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  profileTop: { position: 'relative', marginBottom: 16 },
  editButton: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.primary.blue },
  profileName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' as const },
  profileUsername: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  profileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  profileMetaItem: { alignItems: 'center', paddingHorizontal: 20 },
  profileMetaValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' as const },
  profileMetaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  profileMetaDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 16 },
  premiumText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' as const },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 12 },
  sportCard: { marginBottom: 10 },
  sportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sportInfo: { gap: 4 },
  sportName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  sportMeta: { color: Colors.text.secondary, fontSize: 13 },
  positionBadge: { backgroundColor: Colors.primary.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  positionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' as const },
  emptyCard: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  addLink: { color: Colors.primary.blue, fontSize: 14, fontWeight: '500' as const, marginTop: 8 },
  detailCard: { paddingVertical: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { color: Colors.text.secondary, fontSize: 14 },
  detailValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  fairPlayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fairPlayValue: { color: '#F59E0B', fontSize: 16, fontWeight: '600' as const },
  menuSection: { backgroundColor: Colors.background.card, borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.light, gap: 12 },
  menuTextContainer: { flex: 1 },
  menuText: { color: Colors.text.primary, fontSize: 15 },
  menuSubtext: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },

  bottomSpacer: { height: 20 },
});
