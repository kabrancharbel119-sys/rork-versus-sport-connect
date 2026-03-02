import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Award, Target, MapPin, Zap, Star, Crown, Medal, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { rankingApi } from '@/lib/api/ranking';
import { PlayerRanking, Leaderboard, Badge } from '@/types/ranking';
import { Sport } from '@/types';
import { sportLabels } from '@/mocks/data';
import { Avatar } from '@/components/Avatar';

type TabType = 'global' | 'sport' | 'city' | 'my-stats';

export default function RankingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [selectedSport, setSelectedSport] = useState<Sport>('football');
  const [globalLeaderboard, setGlobalLeaderboard] = useState<Leaderboard | null>(null);
  const [sportLeaderboard, setSportLeaderboard] = useState<Leaderboard | null>(null);
  const [cityLeaderboard, setCityLeaderboard] = useState<Leaderboard | null>(null);
  const [myRanking, setMyRanking] = useState<PlayerRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedSport]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user) {
        const ranking = await rankingApi.getPlayerRanking(user.id);
        setMyRanking(ranking);
      }

      if (activeTab === 'global') {
        const leaderboard = await rankingApi.getGlobalLeaderboard(100);
        setGlobalLeaderboard(leaderboard);
      } else if (activeTab === 'sport') {
        const leaderboard = await rankingApi.getSportLeaderboard(selectedSport, 100);
        setSportLeaderboard(leaderboard);
      } else if (activeTab === 'city' && user?.city) {
        const leaderboard = await rankingApi.getCityLeaderboard(user.city, 100);
        setCityLeaderboard(leaderboard);
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getEloColor = (elo: number) => {
    if (elo >= 2000) return '#9333EA'; // Violet - Elite
    if (elo >= 1800) return '#FFD700'; // Or - Avancé
    if (elo >= 1500) return '#1565C0'; // Bleu - Confirmé
    if (elo >= 1200) return '#10B981'; // Vert - Intermédiaire
    return Colors.text.muted; // Gris - Débutant
  };

  const getEloLabel = (elo: number) => {
    if (elo >= 2000) return 'Elite';
    if (elo >= 1800) return 'Avancé';
    if (elo >= 1500) return 'Confirmé';
    if (elo >= 1200) return 'Intermédiaire';
    return 'Débutant';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={20} color="#FFD700" />;
    if (rank === 2) return <Medal size={20} color="#C0C0C0" />;
    if (rank === 3) return <Medal size={20} color="#CD7F32" />;
    return null;
  };

  const getBadgeColor = (badge: Badge) => {
    return badge.color || Colors.primary.orange;
  };

  const PlayerCard = ({ player, index, showSport }: { player: PlayerRanking; index: number; showSport?: Sport }) => {
    const isCurrentUser = user?.id === player.userId;
    const rank = index + 1;
    const eloColor = getEloColor(player.eloRating);
    const sportRank = showSport ? player.sportRankings[showSport] : null;
    const displayElo = sportRank ? sportRank.eloRating : player.eloRating;
    const displayRank = sportRank ? sportRank.rank : rank;

    return (
      <TouchableOpacity
        style={[styles.playerCard, isCurrentUser && styles.playerCardHighlight]}
        activeOpacity={0.7}
        onPress={() => router.push(`/user/${player.userId}` as any)}
      >
        <View style={styles.playerRank}>
          {getRankIcon(displayRank) || <Text style={styles.playerRankText}>#{displayRank}</Text>}
        </View>

        <Avatar uri={player.avatar} name={player.username} size="medium" />

        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {player.fullName || player.username}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>Vous</Text>
              </View>
            )}
          </View>

          {player.city && (
            <View style={styles.playerCity}>
              <MapPin size={12} color={Colors.text.muted} />
              <Text style={styles.playerCityText}>{player.city}</Text>
            </View>
          )}

          <View style={styles.playerBadges}>
            {player.badges.slice(0, 3).map((badge, i) => (
              <View key={i} style={[styles.badge, { backgroundColor: getBadgeColor(badge) + '20' }]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.playerStats}>
          <View style={[styles.eloContainer, { backgroundColor: eloColor + '20' }]}>
            <Text style={[styles.eloValue, { color: eloColor }]}>{displayElo}</Text>
            <Text style={styles.eloLabel}>{getEloLabel(displayElo)}</Text>
          </View>

          {player.eloChange !== 0 && (
            <View style={styles.eloChange}>
              {player.eloChange > 0 ? (
                <TrendingUp size={14} color={Colors.status.success} />
              ) : (
                <TrendingDown size={14} color={Colors.status.error} />
              )}
              <Text style={[styles.eloChangeText, { color: player.eloChange > 0 ? Colors.status.success : Colors.status.error }]}>
                {player.eloChange > 0 ? '+' : ''}{player.eloChange}
              </Text>
            </View>
          )}

          <View style={styles.playerRecord}>
            <Text style={styles.playerRecordText}>
              {player.stats.wins}W - {player.stats.losses}L
            </Text>
            <Text style={styles.playerWinRate}>
              {player.stats.winRate.toFixed(0)}%
            </Text>
          </View>
        </View>

        <ChevronRight size={16} color={Colors.text.muted} />
      </TouchableOpacity>
    );
  };

  const MyStatsCard = () => {
    if (!myRanking) return null;

    return (
      <View style={styles.myStatsContainer}>
        <LinearGradient
          colors={[Colors.primary.orange, '#E65100']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.myStatsGradient}
        >
          <View style={styles.myStatsHeader}>
            <View style={styles.myStatsLeft}>
              <Avatar uri={user?.avatar} name={user?.fullName} size="large" />
              <View style={styles.myStatsInfo}>
                <Text style={styles.myStatsName}>{user?.fullName || user?.username}</Text>
                <View style={styles.myStatsRank}>
                  <Trophy size={16} color="#FFD700" />
                  <Text style={styles.myStatsRankText}>Rang #{myRanking.rank}</Text>
                </View>
              </View>
            </View>

            <View style={styles.myStatsElo}>
              <Text style={styles.myStatsEloValue}>{myRanking.eloRating}</Text>
              <Text style={styles.myStatsEloLabel}>ELO</Text>
              {myRanking.eloChange !== 0 && (
                <View style={styles.myStatsEloChange}>
                  <Text style={styles.myStatsEloChangeText}>
                    {myRanking.eloChange > 0 ? '+' : ''}{myRanking.eloChange}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.myStatsGrid}>
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myRanking.stats.totalMatches}</Text>
              <Text style={styles.myStatLabel}>Matchs</Text>
            </View>
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myRanking.stats.wins}</Text>
              <Text style={styles.myStatLabel}>Victoires</Text>
            </View>
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myRanking.stats.winRate.toFixed(0)}%</Text>
              <Text style={styles.myStatLabel}>Taux</Text>
            </View>
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myRanking.stats.totalGoals}</Text>
              <Text style={styles.myStatLabel}>Buts</Text>
            </View>
          </View>

          {myRanking.stats.recentForm.length > 0 && (
            <View style={styles.recentForm}>
              <Text style={styles.recentFormLabel}>Forme récente</Text>
              <View style={styles.recentFormRow}>
                {myRanking.stats.recentForm.slice(0, 10).map((result, i) => (
                  <View
                    key={i}
                    style={[
                      styles.formBadge,
                      result === 'W' && styles.formWin,
                      result === 'L' && styles.formLoss,
                      result === 'D' && styles.formDraw,
                    ]}
                  >
                    <Text style={styles.formText}>{result}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {myRanking.achievements.length > 0 && (
            <TouchableOpacity style={styles.achievementsBtn} onPress={() => router.push('/achievements' as any)}>
              <Award size={16} color="#FFD700" />
              <Text style={styles.achievementsBtnText}>
                {myRanking.achievements.length} Achievements
              </Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
  };

  const currentLeaderboard = activeTab === 'global' ? globalLeaderboard : activeTab === 'sport' ? sportLeaderboard : cityLeaderboard;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Classements</Text>
              <Text style={styles.headerSubtitle}>Compétition mondiale</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
            {[
              ['my-stats', 'Mes Stats', <Star key="s" size={16} />],
              ['global', 'Global', <Trophy key="g" size={16} />],
              ['sport', 'Par Sport', <Target key="sp" size={16} />],
              ['city', 'Ma Ville', <MapPin key="c" size={16} />],
            ].map(([key, label, icon]) => (
              <TouchableOpacity
                key={key as string}
                style={[styles.tab, activeTab === key && styles.tabActive]}
                onPress={() => setActiveTab(key as TabType)}
              >
                {React.cloneElement(icon as React.ReactElement, { color: activeTab === key ? '#FFFFFF' : Colors.text.secondary })}
                <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeTab === 'sport' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportScroll} contentContainerStyle={styles.sportTabs}>
              {(['football', 'basketball', 'volleyball', 'tennis'] as Sport[]).map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportTab, selectedSport === sport && styles.sportTabActive]}
                  onPress={() => setSelectedSport(sport)}
                >
                  <Text style={[styles.sportTabText, selectedSport === sport && styles.sportTabTextActive]}>
                    {sportLabels[sport]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.orange} />}
          >
            {activeTab === 'my-stats' ? (
              <MyStatsCard />
            ) : loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary.orange} />
                <Text style={styles.loadingText}>Chargement du classement...</Text>
              </View>
            ) : currentLeaderboard && currentLeaderboard.players.length > 0 ? (
              <>
                <View style={styles.leaderboardHeader}>
                  <Zap size={18} color={Colors.primary.orange} />
                  <Text style={styles.leaderboardTitle}>
                    {activeTab === 'global' && 'Top 100 Mondial'}
                    {activeTab === 'sport' && `Top 100 ${sportLabels[selectedSport]}`}
                    {activeTab === 'city' && `Top 100 ${user?.city}`}
                  </Text>
                </View>

                {currentLeaderboard.players.map((player, index) => (
                  <PlayerCard key={player.userId} player={player} index={index} showSport={activeTab === 'sport' ? selectedSport : undefined} />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Trophy size={64} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun classement</Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'city' ? 'Aucun joueur dans votre ville pour le moment.' : 'Jouez des matchs pour apparaître dans le classement !'}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text.primary },
  headerSubtitle: { fontSize: 13, color: Colors.text.muted, marginTop: 2 },
  placeholder: { width: 40 },

  tabsScroll: { maxHeight: 60 },
  tabs: { paddingHorizontal: 20, gap: 12, paddingVertical: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.background.card },
  tabActive: { backgroundColor: Colors.primary.orange },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  tabTextActive: { color: '#FFFFFF' },

  sportScroll: { maxHeight: 50 },
  sportTabs: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  sportTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background.card, borderWidth: 1, borderColor: Colors.border.light },
  sportTabActive: { backgroundColor: Colors.primary.blue, borderColor: Colors.primary.blue },
  sportTabText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  sportTabTextActive: { color: '#FFFFFF' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 12 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.text.muted },

  leaderboardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  leaderboardTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },

  playerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.light },
  playerCardHighlight: { borderColor: Colors.primary.orange, borderWidth: 2, backgroundColor: Colors.primary.orange + '08' },
  playerRank: { width: 32, alignItems: 'center' },
  playerRankText: { fontSize: 16, fontWeight: '700', color: Colors.text.muted },
  playerInfo: { flex: 1, gap: 4 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  youBadge: { backgroundColor: Colors.primary.orange, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  playerCity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerCityText: { fontSize: 12, color: Colors.text.muted },
  playerBadges: { flexDirection: 'row', gap: 4, marginTop: 4 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 12 },
  playerStats: { alignItems: 'flex-end', gap: 6 },
  eloContainer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  eloValue: { fontSize: 18, fontWeight: '700' },
  eloLabel: { fontSize: 10, fontWeight: '600', color: Colors.text.muted, marginTop: -2 },
  eloChange: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  eloChangeText: { fontSize: 12, fontWeight: '600' },
  playerRecord: { alignItems: 'flex-end' },
  playerRecordText: { fontSize: 12, color: Colors.text.secondary },
  playerWinRate: { fontSize: 11, color: Colors.text.muted },

  myStatsContainer: { marginBottom: 20 },
  myStatsGradient: { borderRadius: 20, padding: 20, gap: 16 },
  myStatsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myStatsLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  myStatsInfo: { gap: 4, flex: 1 },
  myStatsName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  myStatsRank: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  myStatsRankText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  myStatsElo: { alignItems: 'center', gap: 2 },
  myStatsEloValue: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  myStatsEloLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  myStatsEloChange: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  myStatsEloChangeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  myStatsGrid: { flexDirection: 'row', gap: 12 },
  myStatItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' },
  myStatValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  myStatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  recentForm: { gap: 8 },
  recentFormLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  recentFormRow: { flexDirection: 'row', gap: 6 },
  formBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formWin: { backgroundColor: '#10B981' },
  formLoss: { backgroundColor: '#EF4444' },
  formDraw: { backgroundColor: '#6B7280' },
  formText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  achievementsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, justifyContent: 'center' },
  achievementsBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginTop: 16 },
  emptyText: { fontSize: 14, color: Colors.text.muted, textAlign: 'center', marginTop: 8, maxWidth: 280 },
});
