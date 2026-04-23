import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { Share, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { referralsApi } from '@/lib/api/referrals';

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  rewardAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt?: Date;
  createdAt: Date;
}

export const [ReferralProvider, useReferral] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Get user's referral code
  const codeQuery = useQuery({
    queryKey: ['referral', 'code', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return referralsApi.getUserCode(user.id);
    },
    enabled: !!user,
  });

  // Get user's referrals
  const referralsQuery = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return referralsApi.getByReferrer(user.id);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (codeQuery.data) setReferralCode(codeQuery.data);
  }, [codeQuery.data]);

  useEffect(() => {
    if (referralsQuery.data) setReferrals(referralsQuery.data);
  }, [referralsQuery.data]);

  const getReferralCode = useCallback(() => referralCode, [referralCode]);

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
      const result = await referralsApi.applyCode(code, user.id);
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      return result;
    },
  });

  const getTotalRewards = useCallback(() => {
    return referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.rewardAmount, 0);
  }, [referrals]);

  return {
    referrals,
    isLoading: referralsQuery.isLoading || codeQuery.isLoading,
    getReferralCode,
    shareCode: shareCodeMutation.mutateAsync,
    applyCode: applyCodeMutation.mutateAsync,
    getTotalRewards,
    isSharing: shareCodeMutation.isPending,
    isApplying: applyCodeMutation.isPending,
  };
});
