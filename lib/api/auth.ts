import { supabase } from '../supabase';
import { usersApi } from './users';

function formatBanEndDate(date: Date): string {
  try {
    return date.toLocaleString('fr-FR');
  } catch {
    return date.toISOString();
  }
}

async function getBanPeriodFromNotification(userId: string): Promise<string | null> {
  const { data, error } = await (supabase
    .from('notifications')
    .select('message,created_at')
    .eq('user_id', userId)
    .eq('type', 'system')
    .eq('title', 'Compte suspendu')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as any);

  if (error || !data?.message) return null;

  const message = String(data.message);

  const untilMatch = message.match(/jusqu'au\s+(.+?)(?:\.|$)/i);
  if (untilMatch?.[1]) return `jusqu'au ${untilMatch[1].trim()}`;

  if (message.toLowerCase().includes('de manière permanente')) {
    return 'de manière permanente';
  }

  return null;
}

async function enforceBanPolicy(userId: string) {
  const profile = await usersApi.getById(userId);
  if (!profile?.isBanned) return;

  const now = new Date();
  const banEnd = profile.bannedUntil;
  const isTemporaryBanExpired = !!banEnd && banEnd.getTime() <= now.getTime();

  if (isTemporaryBanExpired) {
    await usersApi.setBanStatus(userId, false, null, null);
    return;
  }

  let suspensionMessage = 'Ce compte a été suspendu';

  if (banEnd) {
    suspensionMessage = `Compte suspendu jusqu'au ${formatBanEndDate(banEnd)}`;
  } else {
    const notificationPeriod = await getBanPeriodFromNotification(userId);
    if (notificationPeriod) {
      suspensionMessage = `Compte suspendu ${notificationPeriod}`;
    }
  }

  await supabase.auth.signOut();
  throw new Error(suspensionMessage);
}

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
  if (data.user?.id) {
    await enforceBanPolicy(data.user.id);
  }
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
  await enforceBanPolicy(user.id);
  return usersApi.getById(user.id);
}
