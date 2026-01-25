import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy, Star, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTrophies, ALL_TROPHIES, RARITY_COLORS, TrophyRarity } from '@/contexts/TrophiesContext';
import { useTeams } from '@/contexts/TeamsContext';
import { Card } from '@/components/Card';

type FilterType = 'all' | 'unlocked' | 'locked';
type CategoryType = 'all' | 'matches' | 'wins' | 'goals' | 'assists' | 'mvp' | 'tournaments' | 'social' | 'special';

export default function TrophiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUserTrophies, getUnlockedCount, getTotalXP, checkAndUnlockTrophies } = useTrophies();
  const { teams } = useTeams();
  const [filter, setFilter] = useState<FilterType>('all');
  const [category, setCategory] = useState<CategoryType>('all');

  const userTrophies = user ? getUserTrophies(user.id) : [];
  const unlockedCount = user ? getUnlockedCount(user.id) : 0;
  const totalXP = user ? getTotalXP(user.id) : 0;
  const unlockedIds = userTrophies.filter(t => t.progress >= 100).map(t => t.trophyId);

  useEffect(() => {
    if (user) {
      const isCaptain = teams.some(t => t.captainId === user.id);
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
      });
    }
  }, [user, teams]);

  const filteredTrophies = ALL_TROPHIES.filter(trophy => {
    const isUnlocked = unlockedIds.includes(trophy.id);
    if (filter === 'unlocked' && !isUnlocked) return false;
    if (filter === 'locked' && isUnlocked) return false;
    if (category !== 'all' && trophy.category !== category) return false;
    return true;
  });

  const getProgress = (trophyId: string) => {
    const ut = userTrophies.find(t => t.trophyId === trophyId);
    return ut?.progress || 0;
  };

  const getRarityLabel = (rarity: TrophyRarity) => {
    switch (rarity) {
      case 'common': return 'Commun';
      case 'rare': return 'Rare';
      case 'epic': return 'Épique';
      case 'legendary': return 'Légendaire';
    }
  };

  const categories: { key: CategoryType; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'matches', label: 'Matchs' },
    { key: 'wins', label: 'Victoires' },
    { key: 'goals', label: 'Buts' },
    { key: 'mvp', label: 'MVP' },
    { key: 'tournaments', label: 'Tournois' },
    { key: 'social', label: 'Social' },
    { key: 'special', label: 'Spécial' },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Trophées & Récompenses</Text>
            <View style={styles.placeholder} />
          </View>

          <Card style={styles.statsCard} variant="gradient">
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Trophy size={24} color={Colors.primary.orange} />
                <Text style={styles.statValue}>{unlockedCount}</Text>
                <Text style={styles.statLabel}>Débloqués</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Star size={24} color="#F59E0B" />
                <Text style={styles.statValue}>{ALL_TROPHIES.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Zap size={24} color={Colors.status.success} />
                <Text style={styles.statValue}>{totalXP.toLocaleString()}</Text>
                <Text style={styles.statLabel}>XP gagné</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(unlockedCount / ALL_TROPHIES.length) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round((unlockedCount / ALL_TROPHIES.length) * 100)}% complété</Text>
          </Card>

          <View style={styles.filterRow}>
            {(['all', 'unlocked', 'locked'] as FilterType[]).map(f => (
              <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'Tous' : f === 'unlocked' ? 'Débloqués' : 'Verrouillés'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={styles.categoriesContent}>
            {categories.map(cat => (
              <TouchableOpacity key={cat.key} style={[styles.categoryChip, category === cat.key && styles.categoryActive]} onPress={() => setCategory(cat.key)}>
                <Text style={[styles.categoryText, category === cat.key && styles.categoryTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {filteredTrophies.map(trophy => {
              const isUnlocked = unlockedIds.includes(trophy.id);
              const progress = getProgress(trophy.id);
              return (
                <Card key={trophy.id} style={[styles.trophyCard, !isUnlocked && styles.trophyLocked]}>
                  <View style={styles.trophyRow}>
                    <View style={[styles.trophyIcon, { borderColor: RARITY_COLORS[trophy.rarity] }, !isUnlocked && styles.iconLocked]}>
                      <Text style={styles.trophyEmoji}>{trophy.icon}</Text>
                    </View>
                    <View style={styles.trophyInfo}>
                      <View style={styles.trophyNameRow}>
                        <Text style={[styles.trophyName, !isUnlocked && styles.textLocked]}>{trophy.name}</Text>
                        <View style={[styles.rarityBadge, { backgroundColor: `${RARITY_COLORS[trophy.rarity]}20` }]}>
                          <Text style={[styles.rarityText, { color: RARITY_COLORS[trophy.rarity] }]}>{getRarityLabel(trophy.rarity)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.trophyDesc, !isUnlocked && styles.textLocked]}>{trophy.description}</Text>
                      {!isUnlocked && progress > 0 && (
                        <View style={styles.trophyProgress}>
                          <View style={styles.trophyProgressBar}><View style={[styles.trophyProgressFill, { width: `${progress}%` }]} /></View>
                          <Text style={styles.trophyProgressText}>{Math.round(progress)}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.xpBadge}>
                      <Zap size={12} color={isUnlocked ? Colors.status.success : Colors.text.muted} />
                      <Text style={[styles.xpText, isUnlocked && styles.xpUnlocked]}>{trophy.xpReward}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
            {filteredTrophies.length === 0 && (
              <View style={styles.emptyState}><Text style={styles.emptyText}>Aucun trophée dans cette catégorie</Text></View>
            )}
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
  statsCard: { marginHorizontal: 20, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '700' as const },
  statLabel: { color: Colors.text.muted, fontSize: 12 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border.light },
  progressBar: { height: 8, backgroundColor: Colors.background.cardLight, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary.orange, borderRadius: 4 },
  progressText: { color: Colors.text.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background.card },
  filterActive: { backgroundColor: Colors.primary.blue },
  filterText: { color: Colors.text.secondary, fontSize: 13 },
  filterTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  categoriesScroll: { maxHeight: 44, marginBottom: 12 },
  categoriesContent: { paddingHorizontal: 20, gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background.card },
  categoryActive: { backgroundColor: Colors.primary.orange },
  categoryText: { color: Colors.text.secondary, fontSize: 12 },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '500' as const },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  trophyCard: { marginBottom: 12 },
  trophyLocked: { opacity: 0.7 },
  trophyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trophyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  iconLocked: { borderColor: Colors.text.muted + '40' },
  trophyEmoji: { fontSize: 24 },
  trophyInfo: { flex: 1 },
  trophyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  trophyName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' as const },
  textLocked: { color: Colors.text.muted },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rarityText: { fontSize: 10, fontWeight: '600' as const },
  trophyDesc: { color: Colors.text.secondary, fontSize: 13 },
  trophyProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  trophyProgressBar: { flex: 1, height: 4, backgroundColor: Colors.background.cardLight, borderRadius: 2, overflow: 'hidden' },
  trophyProgressFill: { height: '100%', backgroundColor: Colors.primary.blue },
  trophyProgressText: { color: Colors.text.muted, fontSize: 11 },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background.cardLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  xpText: { color: Colors.text.muted, fontSize: 12, fontWeight: '600' as const },
  xpUnlocked: { color: Colors.status.success },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: Colors.text.muted, fontSize: 14 },
  bottomSpacer: { height: 40 },
});
