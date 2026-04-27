import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { User } from '@/types';
import { mockUser, mockAdminUser } from '@/mocks/data';
import { usersApi } from '@/lib/api/users';
import { verificationsApi } from '@/lib/api/verifications';
import { supabase } from '@/lib/supabase';

const USERS_REFETCH_INTERVAL_MS = 30_000;

const USERS_STORAGE_KEY = 'vs_all_users';
const FOLLOWS_STORAGE_KEY = 'vs_follows';

interface FollowRelation {
  followerId: string;
  followingId: string;
  createdAt: Date;
}

const initialUsers: User[] = [
  mockUser,
  mockAdminUser,
  { id: 'user-2', email: 'ama.koffi@email.com', username: 'ama_koffi', fullName: 'Ama Koffi', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', phone: '+225 07 11 11 11', city: 'Abidjan', country: 'Côte d\'Ivoire', bio: 'Défenseure solide', sports: [{ sport: 'football', level: 'advanced', position: 'Défenseur', yearsPlaying: 8 }], stats: { matchesPlayed: 98, wins: 52, losses: 30, draws: 16, goalsScored: 12, assists: 28, mvpAwards: 5, fairPlayScore: 4.9, tournamentWins: 2, totalCashPrize: 200000 }, reputation: 4.7, walletBalance: 50000, teams: ['team-1'], followers: 156, following: 89, isVerified: true, isPremium: false, isBanned: false, role: 'user', createdAt: new Date('2023-02-01'), availability: [] },
  { id: 'user-3', email: 'jean.traore@email.com', username: 'jean_traore', fullName: 'Jean Traoré', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop', phone: '+225 07 22 22 22', city: 'Abidjan', country: 'Côte d\'Ivoire', bio: 'Attaquant rapide', sports: [{ sport: 'football', level: 'expert', position: 'Attaquant', yearsPlaying: 12 }], stats: { matchesPlayed: 210, wins: 130, losses: 50, draws: 30, goalsScored: 180, assists: 65, mvpAwards: 25, fairPlayScore: 4.6, tournamentWins: 8, totalCashPrize: 800000 }, reputation: 4.9, walletBalance: 300000, teams: ['team-1'], followers: 520, following: 120, isVerified: true, isPremium: true, isBanned: false, role: 'user', createdAt: new Date('2022-06-15'), availability: [] },
  { id: 'user-4', email: 'marie.diallo@email.com', username: 'marie_diallo', fullName: 'Marie Diallo', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop', phone: '+225 07 33 33 33', city: 'Abidjan', country: 'Côte d\'Ivoire', bio: 'Gardienne expérimentée', sports: [{ sport: 'football', level: 'advanced', position: 'Gardien', yearsPlaying: 10 }], stats: { matchesPlayed: 145, wins: 78, losses: 45, draws: 22, goalsScored: 0, assists: 5, mvpAwards: 15, fairPlayScore: 4.95, tournamentWins: 3, totalCashPrize: 350000 }, reputation: 4.8, walletBalance: 150000, teams: ['team-2'], followers: 280, following: 95, isVerified: true, isPremium: false, isBanned: false, role: 'user', createdAt: new Date('2023-05-01'), availability: [] },
  { id: 'user-5', email: 'paul.kouadio@email.com', username: 'paul_k', fullName: 'Paul Kouadio', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop', city: 'Bouaké', country: 'Côte d\'Ivoire', bio: 'Milieu créatif', sports: [{ sport: 'football', level: 'intermediate', position: 'Milieu', yearsPlaying: 5 }], stats: { matchesPlayed: 45, wins: 20, losses: 15, draws: 10, goalsScored: 15, assists: 22, mvpAwards: 3, fairPlayScore: 4.5, tournamentWins: 1, totalCashPrize: 75000 }, reputation: 4.3, walletBalance: 25000, teams: [], followers: 45, following: 60, isVerified: false, isPremium: false, isBanned: false, role: 'user', createdAt: new Date('2024-01-10'), availability: [] },
];

export const [UsersProvider, useUsers] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<User[]>([]);
  const [follows, setFollows] = useState<FollowRelation[]>([]);
  const [isAppActive, setIsAppActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const usersQuery = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      console.log('[Users] Loading users...');
      
      try {
        const result = await usersApi.getAll();
        const serverUsers = result.users ?? result;
        if (serverUsers.length > 0) {
          await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(serverUsers));
          const storedFollows = await AsyncStorage.getItem(FOLLOWS_STORAGE_KEY);
          const followsList = storedFollows ? JSON.parse(storedFollows) : [];
          return { users: serverUsers, follows: followsList };
        }
      } catch (e) {
        console.log('[Users] Server fetch failed, using local storage');
      }

      const [storedUsers, storedFollows] = await Promise.all([
        AsyncStorage.getItem(USERS_STORAGE_KEY),
        AsyncStorage.getItem(FOLLOWS_STORAGE_KEY),
      ]);
      
      let usersList = initialUsers;
      let followsList: FollowRelation[] = [];
      
      if (storedUsers) usersList = JSON.parse(storedUsers);
      else await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
      
      if (storedFollows) followsList = JSON.parse(storedFollows);
      
      return { users: usersList, follows: followsList };
    },
    refetchInterval: isAppActive ? USERS_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(usersQuery.data.users);
      setFollows(usersQuery.data.follows);
    }
  }, [usersQuery.data]);

  const saveUsers = useCallback(async (updated: User[]) => {
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    setUsers(updated);
  }, []);

  const saveFollows = useCallback(async (updated: FollowRelation[]) => {
    await AsyncStorage.setItem(FOLLOWS_STORAGE_KEY, JSON.stringify(updated));
    setFollows(updated);
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
  }, [queryClient]);

  const followMutation = useMutation({
    mutationFn: async ({ followerId, followingId }: { followerId: string; followingId: string }) => {
      console.log('[Users] Following user:', followingId);
      
      if (follows.find(f => f.followerId === followerId && f.followingId === followingId)) {
        throw new Error('Déjà suivi');
      }

      try {
        await usersApi.follow(followerId, followingId);
      } catch (e) {
        console.log('[Users] Supabase follow failed, using local');
      }

      const newFollow: FollowRelation = { followerId, followingId, createdAt: new Date() };
      const updatedFollows = [...follows, newFollow];
      await saveFollows(updatedFollows);
      
      const updatedUsers = users.map(u => {
        if (u.id === followerId) return { ...u, following: u.following + 1 };
        if (u.id === followingId) return { ...u, followers: u.followers + 1 };
        return u;
      });
      await saveUsers(updatedUsers);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async ({ followerId, followingId }: { followerId: string; followingId: string }) => {
      console.log('[Users] Unfollowing user:', followingId);

      try {
        await usersApi.unfollow(followerId, followingId);
      } catch (e) {
        console.log('[Users] Supabase unfollow failed, using local');
      }

      const updatedFollows = follows.filter(f => !(f.followerId === followerId && f.followingId === followingId));
      await saveFollows(updatedFollows);
      
      const updatedUsers = users.map(u => {
        if (u.id === followerId) return { ...u, following: Math.max(0, u.following - 1) };
        if (u.id === followingId) return { ...u, followers: Math.max(0, u.followers - 1) };
        return u;
      });
      await saveUsers(updatedUsers);
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (input: string | { userId: string; bannedUntil?: Date | null; banReason?: string | null }) => {
      const userId = typeof input === 'string' ? input : input.userId;
      const bannedUntil = typeof input === 'string' ? null : (input.bannedUntil ?? null);
      const banReason = typeof input === 'string' ? null : (input.banReason ?? null);

      console.log('[Users] Banning user:', userId, 'until:', bannedUntil);
      
      try {
        await usersApi.setBanStatus(
          userId,
          true,
          bannedUntil ? bannedUntil.toISOString() : null,
          banReason ?? null,
        );
      } catch (e) {
        console.error('[Users] Supabase ban failed:', e);
        throw e;
      }
      
      const latestUsers = ((queryClient.getQueryData(['allUsers']) as { users?: User[] } | undefined)?.users ?? users);
      const updatedUsers = latestUsers.map(u => u.id === userId
        ? {
            ...u,
            isBanned: true,
            bannedUntil: bannedUntil ?? undefined,
            banReason: banReason ?? undefined,
          }
        : u,
      );
      await saveUsers(updatedUsers);
      await usersQuery.refetch();
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log('[Users] Unbanning user:', userId);
      
      try {
        await usersApi.setBanStatus(userId, false);
      } catch (e) {
        console.error('[Users] Supabase unban failed:', e);
        throw e;
      }
      
      const latestUsers = ((queryClient.getQueryData(['allUsers']) as { users?: User[] } | undefined)?.users ?? users);
      const updatedUsers = latestUsers.map(u => u.id === userId ? { ...u, isBanned: false, bannedUntil: undefined, banReason: undefined } : u);
      await saveUsers(updatedUsers);
      await usersQuery.refetch();
    },
  });

  const verifyUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log('[Users] Verifying user:', userId);

      const verifiedUser = await usersApi.update(userId, { isVerified: true });
      const updatedUsers = users.map(u => (u.id === userId ? { ...u, ...verifiedUser, isVerified: true } : u));
      await saveUsers(updatedUsers);
      await queryClient.refetchQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
  });

  const unverifyUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log('[Users] Unverifying user:', userId);
      await usersApi.update(userId, { isVerified: false });
      const updatedUsers = users.map(u => (u.id === userId ? { ...u, isVerified: false } : u));
      await saveUsers(updatedUsers);
      // Si l'utilisateur cible est connecté, mettre à jour son cache local
      try {
        const raw = await AsyncStorage.getItem('vs_user');
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.id === userId) {
            await AsyncStorage.setItem('vs_user', JSON.stringify({ ...cached, isVerified: false }));
          }
        }
      } catch (_) {}
      // Remettre la demande de vérification approved → rejected pour permettre une re-soumission
      try {
        const requests = await verificationsApi.getByUser(userId);
        const approved = requests.find(r => r.status === 'approved');
        if (approved) {
          await supabase
            .from('verification_requests')
            .update({ status: 'rejected', rejection_reason: 'Vérification retirée par un administrateur' })
            .eq('id', approved.id);
        }
      } catch (_) {}
      await queryClient.refetchQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<User> }) => {
      console.log('[Users] Updating user:', userId);
      
      try {
        await usersApi.update(userId, data);
      } catch (e) {
        console.log('[Users] Supabase update failed, using local');
      }
      
      const updatedUsers = users.map(u => u.id === userId ? { ...u, ...data } : u);
      await saveUsers(updatedUsers);
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (user: User) => {
      console.log('[Users] Adding new user:', user.email);
      const existing = users.find(u => u.email === user.email);
      if (existing) {
        const updatedUsers = users.map(u => u.email === user.email ? { ...u, ...user } : u);
        await saveUsers(updatedUsers);
        return existing;
      }
      await saveUsers([...users, user]);
      return user;
    },
  });

  const getUserById = useCallback(async (id: string) => {
    const local = users.find(u => u.id === id);
    if (local) return local;
    try {
      return await usersApi.getById(id);
    } catch {
      return undefined;
    }
  }, [users]);
  const getUserByIdSync = useCallback((id: string) => users.find(u => u.id === id), [users]);
  const getUserByEmail = useCallback((email: string) => users.find(u => u.email === email), [users]);
  const isFollowing = useCallback((followerId: string, followingId: string) => follows.some(f => f.followerId === followerId && f.followingId === followingId), [follows]);
  const getFollowers = useCallback((userId: string) => follows
    .filter(f => f.followingId === userId)
    .map(f => users.find(u => u.id === f.followerId))
    .filter((u): u is User => !!u && u.isProfileVisible !== false), [follows, users]);
  const getFollowing = useCallback((userId: string) => follows
    .filter(f => f.followerId === userId)
    .map(f => users.find(u => u.id === f.followingId))
    .filter((u): u is User => !!u && u.isProfileVisible !== false), [follows, users]);
  const searchUsers = useCallback((query: string) => users
    .filter(u => u.isProfileVisible !== false)
    .filter(u => u.fullName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()) || (u.city ?? '').toLowerCase().includes(query.toLowerCase())), [users]);

  return {
    users,
    follows,
    isLoading: usersQuery.isLoading,
    follow: followMutation.mutateAsync,
    unfollow: unfollowMutation.mutateAsync,
    banUser: banUserMutation.mutateAsync,
    unbanUser: unbanUserMutation.mutateAsync,
    verifyUser: verifyUserMutation.mutateAsync,
    unverifyUser: unverifyUserMutation.mutateAsync,
    updateUser: updateUserMutation.mutateAsync,
    addUser: addUserMutation.mutateAsync,
    getUserById,
    getUserByIdSync,
    getUserByEmail,
    isFollowing,
    getFollowers,
    getFollowing,
    searchUsers,
  };
});
