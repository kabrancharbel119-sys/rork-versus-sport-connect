import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Edit2, Trophy, Star, Users, ChevronRight, Shield, Award, TrendingUp, Zap, MapPin, History, CheckCircle, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { useTrophies, ALL_TROPHIES, RARITY_COLORS } from '@/contexts/TrophiesContext';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { sportLabels, levelLabels } from '@/mocks/data';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { getUserMatches } = useMatches();
  const { getUserTeams, teams } = useTeams();
  const { getUnlockedCount, getTotalXP, checkAndUnlockTrophies, getUserTrophies } = useTrophies();

  const userMatches = user ? getUserMatches(user.id) : [];
  const userTeams = user ? getUserTeams(user.id) : [];
  const unlockedTrophiesCount = user ? getUnlockedCount(user.id) : 0;
  const userTrophyList = user ? getUserTrophies(user.id).filter(t => t.progress >= 100).slice(0, 5) : [];
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
            
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Zap size={14} color={Colors.primary.orange} />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.matchesPlayed || 0}</Text>
                <Text style={styles.quickStatLabel}>Matchs</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <TrendingUp size={14} color={Colors.status.success} />
                </View>
                <Text style={styles.quickStatValue}>{winRate}%</Text>
                <Text style={styles.quickStatLabel}>Victoires</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Award size={14} color="#F59E0B" />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.mvpAwards || 0}</Text>
                <Text style={styles.quickStatLabel}>MVP</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={styles.quickStatIconBg}>
                  <Star size={14} color="#F59E0B" />
                </View>
                <Text style={styles.quickStatValue}>{user?.stats?.fairPlayScore?.toFixed(1) || '5.0'}</Text>
                <Text style={styles.quickStatLabel}>Fair-Play</Text>
              </View>
            </View>
            
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.followers || 0}</Text><Text style={styles.profileMetaLabel}>Abonnés</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.following || 0}</Text><Text style={styles.profileMetaLabel}>Abonnements</Text></View>
              <View style={styles.profileMetaDivider} />
              <View style={styles.profileMetaItem}><Text style={styles.profileMetaValue}>{user?.teams?.length || 0}</Text><Text style={styles.profileMetaLabel}>Équipe</Text></View>
            </View>
            {(user?.isPremium || isAdmin) && (
              <View style={styles.premiumBadge}>
                <Shield size={14} color={isAdmin ? Colors.primary.orange : '#F59E0B'} />
                <Text style={styles.premiumText}>{isAdmin ? 'Admin' : 'Premium'}</Text>
              </View>
            )}
          </LinearGradient>

          {userTrophyList.length > 0 && (
            <TouchableOpacity style={styles.trophiesPreview} onPress={() => router.push('/trophies')} activeOpacity={0.8}>
              <View style={styles.trophiesPreviewHeader}>
                <Trophy size={18} color={Colors.primary.orange} />
                <Text style={styles.trophiesPreviewTitle}>Trophées ({unlockedTrophiesCount})</Text>
                <ChevronRight size={16} color={Colors.text.muted} />
              </View>
              <View style={styles.trophiesBadges}>
                {userTrophyList.map((ut) => (
                  <View key={ut.trophyId} style={[styles.trophyBadge, { borderColor: RARITY_COLORS[ut.trophy?.rarity || 'common'] }]}>
                    <Text style={styles.trophyBadgeIcon}>{ut.trophy?.icon}</Text>
                  </View>
                ))}
                {unlockedTrophiesCount > 5 && (
                  <View style={styles.moreTrophiesBadge}>
                    <Text style={styles.moreTrophiesText}>+{unlockedTrophiesCount - 5}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sports pratiqués</Text>
              <TouchableOpacity onPress={() => router.push('/edit-profile')} style={styles.addSportBtn}>
                <Plus size={16} color={Colors.primary.blue} />
              </TouchableOpacity>
            </View>
            {user?.sports && user.sports.length > 0 ? (
              <View style={styles.sportsBadgesContainer}>
                {user.sports.map((sport, index) => (
                  <View key={index} style={styles.sportBadge}>
                    <Text style={styles.sportBadgeEmoji}>
                      {sport.sport === 'football' ? '⚽' : sport.sport === 'basketball' ? '🏀' : sport.sport === 'volleyball' ? '🏐' : sport.sport === 'tennis' ? '🎾' : '🏃'}
                    </Text>
                    <View style={styles.sportBadgeInfo}>
                      <Text style={styles.sportBadgeName}>{sportLabels[sport.sport] || sport.sport}</Text>
                      <Text style={styles.sportBadgeMeta}>{levelLabels[sport.level]}</Text>
                    </View>
                    {sport.position && <Text style={styles.sportBadgePosition}>{sport.position}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.emptySportsBadge} onPress={() => router.push('/edit-profile')}>
                <Plus size={18} color={Colors.text.muted} />
                <Text style={styles.emptySportsText}>Ajouter un sport</Text>
              </TouchableOpacity>
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
                <Text style={styles.menuSubtext}>{unlockedTrophiesCount} débloqués • {totalXP} XP</Text>
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
  quickStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, marginTop: 16, marginBottom: 8 },
  quickStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  quickStatIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  quickStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' as const },
  quickStatDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },
  profileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  profileMetaItem: { alignItems: 'center', paddingHorizontal: 20 },
  profileMetaValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' as const },
  profileMetaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  profileMetaDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 16 },
  premiumText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' as const },
  
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const, marginBottom: 12 },
  trophiesPreview: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  trophiesPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trophiesPreviewTitle: { flex: 1, color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  trophiesBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  trophyBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  trophyBadgeIcon: { fontSize: 22 },
  moreTrophiesBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center' },
  moreTrophiesText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addSportBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  sportsBadgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light },
  sportBadgeEmoji: { fontSize: 20 },
  sportBadgeInfo: { gap: 2 },
  sportBadgeName: { color: Colors.text.primary, fontSize: 13, fontWeight: '600' as const },
  sportBadgeMeta: { color: Colors.text.muted, fontSize: 11 },
  sportBadgePosition: { color: Colors.primary.blue, fontSize: 11, fontWeight: '500' as const, backgroundColor: 'rgba(21,101,192,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  emptySportsBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.background.card, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.light, borderStyle: 'dashed' as const },
  emptySportsText: { color: Colors.text.muted, fontSize: 14 },
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
