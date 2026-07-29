import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/contexts/TeamsContext';
import { teamsApi } from '@/lib/api/teams';
import { Avatar } from '@/components/Avatar';
import { sportLabels } from '@/mocks/data';
import type { Team } from '@/types';

export default function MyTeamsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user: currentUser } = useAuth();
  const { getUserTeams: getUserTeamsLocal } = useTeams();

  const targetUserId = userId || currentUser?.id || '';
  const isOwn = currentUser?.id === targetUserId;

  const { data: allTeams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['allTeams', 'my-teams'],
    queryFn: async () => {
      const result = await teamsApi.getAll();
      return result.teams ?? result;
    },
    staleTime: 0,
    retry: 1,
  });

  const apiTeams = allTeams.filter(t =>
    t.captainId === targetUserId ||
    t.members?.some(m => m.userId === targetUserId) ||
    (t.fans ?? []).includes(targetUserId)
  );

  // Fallback to context data if API returns empty or fails
  const localTeams = getUserTeamsLocal(targetUserId);
  const teams = apiTeams.length > 0 ? apiTeams : localTeams;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient colors={[Colors.background.dark, '#0d111d']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes équipes</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={Colors.primary.orange} />
              </View>
            ) : teams.length > 0 ? (
              teams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={styles.teamRow}
                  onPress={() => router.push(`/team/${team.id}`)}
                  activeOpacity={0.7}
                >
                  <Avatar uri={team.logo} name={team.name} size="medium" />
                  <View style={styles.teamInfo}>
                    <View style={styles.teamNameRow}>
                      <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                      {team.captainId === currentUser?.id && (
                        <View style={styles.captainBadge}>
                          <Shield size={11} color={Colors.primary.orange} />
                          <Text style={styles.captainText}>Cap.</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.teamMeta}>{sportLabels[team.sport] || team.sport} • {team.format}</Text>
                    {team.city && (
                      <View style={styles.teamLocation}>
                        <MapPin size={11} color={Colors.text.muted} />
                        <Text style={styles.teamLocationText}>{team.city}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Shield size={40} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucune équipe</Text>
                <Text style={styles.emptySubtitle}>{isOwn ? 'Vos équipes apparaîtront ici' : 'Aucune équipe pour cet utilisateur'}</Text>
                {isOwn && (
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.push('/create-team')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyCtaText}>Créer une équipe</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.background.card, borderRadius: 14, marginBottom: 8 },
  teamInfo: { flex: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  captainBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary.orange + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  captainText: { color: Colors.primary.orange, fontSize: 10, fontWeight: '700' },
  teamMeta: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  teamLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  teamLocationText: { color: Colors.text.muted, fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: Colors.text.muted, fontSize: 14 },
  emptyCta: { marginTop: 8, backgroundColor: Colors.primary.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyCtaText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  loadingState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});
