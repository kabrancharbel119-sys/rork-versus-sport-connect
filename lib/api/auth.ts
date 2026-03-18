import { supabase } from '../supabase';
import { usersApi } from './users';

export async function signUp(data: {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  city?: string;
  referralCode?: string;
  role?: 'user' | 'venue_manager';
}) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Inscription échouée');

  const userId = authData.user.id;

  let referredBy: string | null = null;
  if (data.referralCode) {
    const { data: referrer } = await (supabase
      .from('users')
      .select('id')
      .eq('referral_code', data.referralCode)
      .single() as any);
    referredBy = referrer?.id || null;
  }

  const referralCode = `VS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const { error: profileError } = await (supabase
    .from('users')
    .insert({
      id: userId,
      email: data.email,
      username: data.username,
      full_name: `${data.firstName} ${data.lastName}`,
      city: data.city || 'Abidjan',
      country: 'Côte d\'Ivoire',
      referral_code: referralCode,
      referred_by: referredBy,
      role: data.role || 'user',
      is_verified: false,
      is_premium: false,
      bio: '',
      sports: [],
      stats: {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsScored: 0,
        assists: 0,
        mvpCount: 0,
        fairPlayScore: 0,
        tournamentsWon: 0,
        cashPrizesTotal: 0,
      },
    } as any));

  if (profileError) throw new Error(profileError.message);
  return usersApi.getById(userId);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'vsport://reset-password',
  });
  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return usersApi.getById(user.id);
}
