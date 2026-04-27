import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp, Award, Target, Users, Zap, Star } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { Card } from '@/components/Card';
import { BarChart, ProgressRing, StatComparison, MatchHistoryReal, MatchHistory } from '@/components/StatisticsChart';
import { EmptyState } from '@/components/EmptyState';
import { sportLabels } from '@/mocks/data';

export default function StatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getUserMatches, getCompletedUserMatches } = useMatches();

  const userMatches = useMemo(() => user ? getUserMatches(user.id) : [], [user, getUserMatches]);
  const completedMatches = useMemo(() => user ? getCompletedUserMatches(user.id) : [], [user, getCompletedUserMatches]);
  const historyItems = useMemo(() => completedMatches.slice(0, 10).map(m => ({
    id: m.id,
    label: `${(sportLabels as Record<string, string>)[m.sport] || m.sport} • ${m.format}`,
    score: m.score ? `${m.score.home} - ${m.score.away}` : '–',
    date: m.dateTime instanceof Date ? m.dateTime.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : new Date(m.dateTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  })), [completedMatches]);
  const stats = user?.stats || { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, assists: 0, mvpAwards: 0, fairPlayScore: 5, tournamentWins: 0 };
  
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;
  const goalsPerMatch = stats.matchesPlayed > 0 ? (stats.goalsScored / stats.matchesPlayed).toFixed(1) : '0.0';
  const assistsPerMatch = stats.matchesPlayed > 0 ? (stats.assists / stats.matchesPlayed).toFixed(1) : '0.0';

  const monthlyData = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short' });
      const count = completedMatches.filter(m => {
        const md = m.dateTime instanceof Date ? m.dateTime : new Date(m.dateTime);
        return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
      }).length;
      result.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1, 3), value: count, color: Colors.primary.blue });
    }
    return result;
  }, [completedMatches]);

  const performanceData = [
    { label: 'Buts', value: stats.goalsScored, color: Colors.primary.blue },
    { label: 'Passes', value: stats.assists, color: Colors.primary.orange },
    { label: 'MVP', value: stats.mvpAwards, color: Colors.status.success },
    { label: 'Tournois', value: stats.tournamentWins, color: '#8B5CF6' },
  ];

  const matchHistory = useMemo(() => {
    if (!user) return [];
    const results: Array<{ result: 'win' | 'loss' | 'draw'; date: string }> = [];
    for (const m of completedMatches.slice(0, 10)) {
      const score = m.score;
      // Exclure les matchs sans score saisi — ils ne permettent pas de déduire W/L/D
      if (!score || (score.home === 0 && score.away === 0 && !m.homeTeamId && !m.awayTeamId)) continue;
      // Déterminer le côté du joueur :
      // 1. Équipe home → le joueur est dans une des équipes du joueur
      // 2. Équipe away → idem pour away
      // 3. Match open (pas d'équipes) → on ne peut pas déterminer le côté, on skip
      let isHome: boolean | null = null;
      if (m.homeTeamId && m.awayTeamId) {
        if (user.teams?.includes(m.homeTeamId)) isHome = true;
        else if (user.teams?.includes(m.awayTeamId)) isHome = false;
        // Si le joueur n'est dans aucune équipe (ex: rejoint en solo), skip
        if (isHome === null) continue;
      } else {
        // Match open sans équipes : pas de notion home/away claire, skip les dots
        continue;
      }
      const myScore = isHome ? score.home : score.away;
      const theirScore = isHome ? score.away : score.home;
      let result: 'win' | 'loss' | 'draw';
      if (myScore > theirScore) result = 'win';
      else if (myScore < theirScore) result = 'loss';
      else result = 'draw';
      results.push({
        result,
        date: (m.dateTime instanceof Date ? m.dateTime : new Date(m.dateTime)).toISOString(),
      });
    }
    return results;
  }, [completedMatches, user]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0D1420']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router, '/(tabs)/profile')} accessibilityLabel="Retour"><ArrowLeft size={24} color={Colors.text.primary} /></TouchableOpacity>
            <Text style={styles.headerTitle} accessibilityRole="header">Statistiques détaillées</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {completedMatches.length === 0 ? (
              <EmptyState
                icon={Target}
                title="Pas encore de statistiques"
                message="Jouez votre premier match pour voir vos statistiques ici"
              />
            ) : (
              <>
                <View style={styles.ringRow}>
                  <View style={styles.ringItem}>
                    <ProgressRing progress={winRate} size={100} color={Colors.status.success} label="Victoires" />
                  </View>
                  <View style={styles.ringItem}>
                    <ProgressRing progress={Math.min(stats.fairPlayScore * 10, 100)} size={100} color={Colors.primary.orange} label="Fair-Play" />
                  </View>
                  <View style={styles.ringItem}>
                    <ProgressRing progress={Math.min((user?.reputation || 5) * 10, 100)} size={100} color={Colors.primary.blue} label="Réputation" />
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Performance globale</Text>
                <Card style={styles.chartCard}><BarChart data={performanceData} height={140} /></Card>

                <Text style={styles.sectionTitle}>Évolution mensuelle</Text>
                <Card style={styles.chartCard}><BarChart data={monthlyData} height={120} /></Card>

                <Text style={styles.sectionTitle}>Comparaison</Text>
                <StatComparison label="Buts par match" userValue={parseFloat(goalsPerMatch)} avgValue={1.2} />
                <View style={styles.spacer} />
                <StatComparison label="Passes par match" userValue={parseFloat(assistsPerMatch)} avgValue={0.8} />

                {matchHistory.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Derniers résultats</Text>
                    <Card style={styles.chartCard}>
                      <MatchHistory matches={matchHistory} />
                    </Card>
                  </>
                )}

                {historyItems.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Historique des matchs</Text>
                    <MatchHistoryReal items={historyItems} />
                  </>
                )}

                <Text style={styles.sectionTitle}>Détails</Text>
                <Card style={styles.detailsCard}>
                  <View style={styles.detailRow}><View style={styles.detailIcon}><Zap size={18} color={Colors.primary.blue} /></View><Text style={styles.detailLabel}>Matchs joués</Text><Text style={styles.detailValue}>{stats.matchesPlayed}</Text></View>
                  <View style={styles.detailRow}><View style={styles.detailIcon}><TrendingUp size={18} color={Colors.status.success} /></View><Text style={styles.detailLabel}>Victoires</Text><Text style={styles.detailValue}>{stats.wins}</Text></View>
                  <View style={styles.detailRow}><View style={styles.detailIcon}><Award size={18} color={Colors.primary.orange} /></View><Text style={styles.detailLabel}>Nuls</Text><Text style={styles.detailValue}>{stats.draws}</Text></View>
                  <View style={styles.detailRow}><View style={styles.detailIcon}><Users size={18} color={Colors.status.error} /></View><Text style={styles.detailLabel}>Défaites</Text><Text style={styles.detailValue}>{stats.losses}</Text></View>
                  <View style={styles.detailRow}><View style={styles.detailIcon}><Star size={18} color='#8B5CF6' /></View><Text style={styles.detailLabel}>Tournois gagnés</Text><Text style={styles.detailValue}>{stats.tournamentWins}</Text></View>
                </Card>
              </>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600' as const },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  ringRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24, paddingVertical: 16 },
  ringItem: { alignItems: 'center' },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const, marginBottom: 12, marginTop: 8 },
  chartCard: { marginBottom: 16 },
  spacer: { height: 12 },
  detailsCard: { padding: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background.cardLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { flex: 1, color: Colors.text.secondary, fontSize: 14 },
  detailValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' as const },
  bottomSpacer: { height: 20 },
});
