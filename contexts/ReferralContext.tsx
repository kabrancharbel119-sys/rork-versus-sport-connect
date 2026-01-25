import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Share, Platform } from 'react-native';
import { useAuth } from './AuthContext';

const REFERRALS_KEY = 'vs_referrals';

interface Referral { id: string; referrerId: string; referredId: string; referredUsername: string; reward: number; status: 'pending' | 'completed'; createdAt: Date; }

export const [ReferralProvider, useReferral] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const referralsQuery = useQuery({
    queryKey: ['referrals', user?.id] as const,
    queryFn: async () => {
      if (!user) return [];
      const stored = await AsyncStorage.getItem(REFERRALS_KEY);
      const all = stored ? JSON.parse(stored) : [];
      return all.filter((r: Referral) => r.referrerId === user.id);
    },
    enabled: !!user,
  });

  useEffect(() => { if (referralsQuery.data) setReferrals(referralsQuery.data); }, [referralsQuery.data]);

  const getReferralCode = useCallback(() => user ? `VS${user.id.slice(-6).toUpperCase()}` : null, [user]);

  const shareCodeMutation = useMutation({
    mutationFn: async () => {
      const code = getReferralCode();
      if (!code) throw new Error('Non connecté');
      const message = `🏆 Rejoins VS - L'app qui révolutionne le sport amateur!\n\nUtilise mon code: ${code}\n\nTélécharge l'app et gagne 50 FCFA de bonus!`;
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: 'VS - Versus', text: message });
        else await navigator.clipboard.writeText(message);
      } else {
        await Share.share({ message, title: 'Rejoins VS!' });
      }
    },
  });

  const applyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error('Non connecté');
      const stored = await AsyncStorage.getItem(REFERRALS_KEY);
      const all: Referral[] = stored ? JSON.parse(stored) : [];
      if (all.some(r => r.referredId === user.id)) throw new Error('Vous avez déjà utilisé un code');
      const allUsersData = await AsyncStorage.getItem('vs_all_users');
      const allUsers = allUsersData ? JSON.parse(allUsersData) : [];
      const referrer = allUsers.find((u: any) => `VS${u.id.slice(-6).toUpperCase()}` === code);
      if (!referrer) throw new Error('Code invalide');
      if (referrer.id === user.id) throw new Error('Vous ne pouvez pas utiliser votre propre code');
      const referral: Referral = { id: `ref-${Date.now()}`, referrerId: referrer.id, referredId: user.id, referredUsername: user.username, reward: 100, status: 'completed', createdAt: new Date() };
      all.push(referral);
      await AsyncStorage.setItem(REFERRALS_KEY, JSON.stringify(all));
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      return { reward: 50 };
    },
  });

  const getTotalRewards = useCallback(() => referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.reward, 0), [referrals]);

  return {
    referrals, isLoading: referralsQuery.isLoading, getReferralCode, shareCode: shareCodeMutation.mutateAsync,
    applyCode: applyCodeMutation.mutateAsync, getTotalRewards, isSharing: shareCodeMutation.isPending, isApplying: applyCodeMutation.isPending,
  };
});
