import { supabase } from '@/lib/supabase';

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

export interface ReferralWithUsers extends Referral {
  referrer?: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  referred?: {
    id: string;
    fullName: string;
    avatar?: string;
  };
}

export const referralsApi = {
  // Get all referrals
  async getAll(): Promise<ReferralWithUsers[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:referrer_id(id, full_name, avatar_url),
        referred:referred_id(id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToReferral);
  },

  // Get referrals by referrer
  async getByReferrer(referrerId: string): Promise<ReferralWithUsers[]> {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:referrer_id(id, full_name, avatar_url),
        referred:referred_id(id, full_name, avatar_url)
      `)
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToReferral);
  },

  // Get user's referral (as referred)
  async getUserReferral(userId: string): Promise<ReferralWithUsers | null> {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:referrer_id(id, full_name, avatar_url),
        referred:referred_id(id, full_name, avatar_url)
      `)
      .eq('referred_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRowToReferral(data) : null;
  },

  // Apply a referral code
  async applyCode(code: string, userId: string): Promise<{ reward: number; referral: Referral }> {
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (userError) throw new Error('Utilisateur non trouvé');

    // Check if user already used a referral
    const existing = await this.getUserReferral(userId);
    if (existing) {
      throw new Error('Vous avez déjà utilisé un code de parrainage');
    }

    // Find referrer by code
    const { data: referrer, error: referrerError } = await supabase
      .from('users')
      .select('id, referral_code')
      .eq('referral_code', code)
      .single();

    if (referrerError || !referrer) {
      throw new Error('Code de parrainage invalide');
    }

    if (referrer.id === userId) {
      throw new Error('Vous ne pouvez pas utiliser votre propre code');
    }

    // Create referral
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: userId,
        referral_code: code,
        reward_amount: 50,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { reward: 50, referral: mapRowToReferral(data) };
  },

  // Get user's referral code
  async getUserCode(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (error || !data?.referral_code) {
      // Generate and update if not exists
      const code = `VS${userId.slice(-6).toUpperCase()}`;
      await supabase
        .from('users')
        .update({ referral_code: code })
        .eq('id', userId);
      return code;
    }

    return data.referral_code;
  },

  // Get total rewards for a user
  async getTotalRewards(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('referrals')
      .select('reward_amount')
      .eq('referrer_id', userId)
      .eq('status', 'completed');

    if (error) throw new Error(error.message);
    return (data || []).reduce((sum, r) => sum + r.reward_amount, 0);
  },

  // Get referral stats for admin
  async getStats(): Promise<{
    totalReferrals: number;
    completedReferrals: number;
    totalRewards: number;
    uniqueReferrers: number;
  }> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*');

    if (error) throw new Error(error.message);

    const referrals = data || [];
    const completed = referrals.filter(r => r.status === 'completed');
    const uniqueReferrers = new Set(referrals.map(r => r.referrer_id));

    return {
      totalReferrals: referrals.length,
      completedReferrals: completed.length,
      totalRewards: completed.reduce((sum, r) => sum + r.reward_amount, 0),
      uniqueReferrers: uniqueReferrers.size,
    };
  },
};

// Helper to map Supabase row to Referral
function mapRowToReferral(row: any): ReferralWithUsers {
  return {
    id: row.id,
    referrerId: row.referrer_id,
    referredId: row.referred_id,
    referralCode: row.referral_code,
    rewardAmount: row.reward_amount,
    status: row.status,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
    referrer: row.referrer ? {
      id: row.referrer.id,
      fullName: row.referrer.full_name,
      avatar: row.referrer.avatar_url,
    } : undefined,
    referred: row.referred ? {
      id: row.referred.id,
      fullName: row.referred.full_name,
      avatar: row.referred.avatar_url,
    } : undefined,
  };
}
