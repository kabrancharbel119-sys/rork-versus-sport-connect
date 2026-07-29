import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, UserCheck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/contexts/UsersContext';
import { usersApi } from '@/lib/api/users';
import { Avatar } from '@/components/Avatar';
import { sportLabels } from '@/mocks/data';
import type { User } from '@/types';

export default function FollowingScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user: currentUser } = useAuth();
  const { getFollowing: getFollowingLocal } = useUsers();

  const targetUserId = userId || currentUser?.id || '';
  const isOwn = currentUser?.id === targetUserId;

  const { data: apiFollowing, isLoading } = useQuery<User[]>({
    queryKey: ['following', targetUserId],
    queryFn: () => usersApi.getFollowing(targetUserId),
    enabled: !!targetUserId,
    staleTime: 0,
    retry: 1,
  });

  // Fallback to context data if API returns empty or fails
  const localFollowing = getFollowingLocal(targetUserId);
  const following = apiFollowing && apiFollowing.length > 0 ? apiFollowing : localFollowing;

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
            <Text style={styles.headerTitle}>Abonnements</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={Colors.primary.orange} />
              </View>
            ) : following.length > 0 ? (
              following.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => router.push(`/user/${u.id}`)}
                  activeOpacity={0.7}
                >
                  <Avatar uri={u.avatar} name={u.fullName} size="medium" />
                  <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName} numberOfLines={1}>{u.fullName}</Text>
                      {u.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
                    </View>
                    <Text style={styles.userUsername} numberOfLines={1}>@{u.username}</Text>
                    {u.city && <Text style={styles.userCity}>{u.city}</Text>}
                  </View>
                  {u.sports?.length > 0 && (
                    <View style={styles.sportChip}>
                      <Text style={styles.sportChipText}>{sportLabels[u.sports[0].sport] || u.sports[0].sport}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <UserCheck size={40} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>Aucun abonnement</Text>
                <Text style={styles.emptySubtitle}>{isOwn ? 'Les joueurs que vous suivez apparaîtront ici' : 'Aucun abonnement pour cet utilisateur'}</Text>
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
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.background.card, borderRadius: 14, marginBottom: 8 },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  verifiedBadge: { color: Colors.status.success, fontSize: 13, fontWeight: '700' },
  userUsername: { color: Colors.text.muted, fontSize: 13, marginTop: 2 },
  userCity: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  sportChip: { backgroundColor: Colors.primary.blue + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  sportChipText: { color: Colors.primary.blue, fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: Colors.text.muted, fontSize: 14 },
  loadingState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});
