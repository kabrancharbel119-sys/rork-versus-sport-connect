import { supabase } from '@/lib/supabase';
import { getApiBaseUrl } from '@/lib/api-base-url';
import { logger } from '@/lib/logger';
import type { User, UserSport, UserStats } from '@/types';

/** Colonnes user sans password_hash : à utiliser pour tout select exposé au client */
const USER_PUBLIC_COLUMNS =
  'id,email,username,full_name,avatar,phone,city,country,bio,sports,stats,reputation,wallet_balance,teams,followers,following,is_verified,is_premium,is_banned,role,location_lat,location_lng,location_city,location_country,availability,referral_code,created_at';

function getAuthBaseUrl(): string {
  return getApiBaseUrl();
}

function useBackendAuth(): boolean {
  return (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_BACKEND_AUTH === 'true' && !!getAuthBaseUrl()) || false;
}

function normalizeBackendUser(raw: Record<string, unknown>): User {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt ?? '')),
    location:
      raw.location && typeof raw.location === 'object' && raw.location !== null
        ? {
            ...(raw.location as object),
            lastUpdated:
              (raw.location as { lastUpdated?: unknown }).lastUpdated instanceof Date
                ? (raw.location as { lastUpdated: Date }).lastUpdated
                : new Date(),
          }
        : undefined,
  } as User;
}


export interface UserRow {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  sports: UserSport[];
  stats: UserStats;
  reputation: number;
  wallet_balance: number;
  teams: string[];
  followers: number;
  following: number;
  is_verified: boolean;
  is_premium: boolean;
  is_banned: boolean;
  role: string;
  location_lat: number | null;
  location_lng: number | null;
  location_city: string | null;
  location_country: string | null;
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  referral_code: string | null;
  created_at: string;
}

export const mapUserRowToUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  username: row.username,
  fullName: row.full_name,
  avatar: row.avatar ?? undefined,
  phone: row.phone ?? undefined,
  city: row.city ?? '',
  country: row.country ?? '',
  bio: row.bio ?? undefined,
  sports: (row.sports as UserSport[]) || [],
  stats: (row.stats as UserStats) || {
    matchesPlayed: 0, wins: 0, losses: 0, draws: 0,
    goalsScored: 0, assists: 0, mvpAwards: 0,
    fairPlayScore: 5, tournamentWins: 0, totalCashPrize: 0
  },
  reputation: row.reputation ?? 5.0,
  walletBalance: row.wallet_balance ?? 0,
  teams: (row.teams as string[]) || [],
  followers: row.followers ?? 0,
  following: row.following ?? 0,
  isVerified: row.is_verified ?? false,
  isPremium: row.is_premium ?? false,
  isBanned: row.is_banned ?? false,
  role: (row.role as 'user' | 'admin') ?? 'user',
  location: row.location_lat && row.location_lng ? {
    latitude: row.location_lat,
    longitude: row.location_lng,
    city: row.location_city || '',
    country: row.location_country || '',
    lastUpdated: new Date()
  } : undefined,
  availability: row.availability || [],
  createdAt: new Date(row.created_at),
});

export const usersApi = {
  async getAll(options?: { page?: number; limit?: number }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    logger.debug('UsersAPI', 'Getting all users', { page, limit });
    const { data, error, count } = await (supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS, { count: 'exact' })
      .eq('is_banned', false)
      .range(from, to)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    return {
      users: ((data || []) as UserRow[]).map(row => mapUserRowToUser(row)),
      total: count ?? 0,
      page,
      limit,
      hasMore: count ? (page * limit) < count : false,
    };
  },

  async getById(id: string) {
    logger.debug('UsersAPI', 'Getting user by id:', id);
    const { data, error } = await (supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .eq('id', id)
      .single() as any);
    
    if (error) throw error;
    if (!data) throw new Error('Utilisateur non trouvé');
    return mapUserRowToUser(data as UserRow);
  },

  async getByPhone(phone: string) {
    logger.debug('UsersAPI', 'Getting user by phone');
    const { data, error } = await (supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .eq('phone', phone)
      .single() as any);
    
    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapUserRowToUser(data as UserRow) : null;
  },

  async create(userData: {
    id: string;
    username: string;
    fullName: string;
    phone: string;
    city?: string;
    country?: string;
  }) {
    logger.debug('UsersAPI', 'Creating user:', userData.username);
    if (useBackendAuth()) {
      try {
        const base = getAuthBaseUrl().replace(/\/$/, '');
        const res = await fetch(`${base}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: userData.id,
            username: userData.username,
            fullName: userData.fullName,
            phone: userData.phone,
            city: userData.city,
            country: userData.country,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { user?: Record<string, unknown>; message?: string };
        if (!res.ok) throw new Error(json.message ?? 'Erreur lors de la création du compte');
        if (!json.user) throw new Error('Réponse invalide');
        return normalizeBackendUser(json.user);
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error('Service d’authentification indisponible');
      }
    }
    // Check if phone already exists
    const { data: existingByPhone } = await (supabase
      .from('users')
      .select('id')
      .eq('phone', userData.phone)
      .single() as any);
    
    if (existingByPhone) {
      throw new Error('Ce numéro est déjà utilisé. Essayez de vous connecter.');
    }
    
    // Check if username already exists
    const { data: existingByUsername } = await (supabase
      .from('users')
      .select('id')
      .eq('username', userData.username)
      .single() as any);
    
    if (existingByUsername) {
      throw new Error('Ce nom d\'utilisateur est déjà pris. Choisissez-en un autre.');
    }
    
    const referralCode = `VS${userData.id.slice(-6).toUpperCase()}`;
    const timestamp = Date.now();
    const fakeEmail = `${userData.phone.replace(/\D/g, '')}_${timestamp}@local.app`;
    
    const insertData: Record<string, unknown> = {
      id: userData.id,
      email: fakeEmail,
      username: userData.username,
      full_name: userData.fullName,
      phone: userData.phone,
      city: userData.city || 'Non spécifié',
      country: userData.country || 'Non spécifié',
      referral_code: referralCode,
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
        cashPrizesTotal: 0
      },
      bio: '',
    };
    
    const { data, error } = await (supabase
      .from('users')
      .insert(insertData as any)
      .select(USER_PUBLIC_COLUMNS)
      .single() as any);
    
    if (error) {
      logger.debug('UsersAPI', 'Create error:', error?.message ?? error);
      if (error.code === '23505') {
        if (error.message?.includes('phone')) {
          throw new Error('Ce numéro est déjà utilisé. Essayez de vous connecter.');
        }
        if (error.message?.includes('username')) {
          throw new Error('Ce nom d\'utilisateur est déjà pris.');
        }
        if (error.message?.includes('email')) {
          throw new Error('Une erreur est survenue. Réessayez.');
        }
        throw new Error('Ce compte existe déjà. Essayez de vous connecter.');
      }
      throw error;
    }
    
    logger.debug('UsersAPI', 'User created successfully');
    return mapUserRowToUser(data as UserRow);
  },

  async authenticate(_phone: string, _password: string) {
    throw new Error('[usersApi.authenticate] Déprécié — utiliser supabase.auth.signInWithPassword() via lib/api/auth.ts');
  },

  async updateProfile(id: string, updates: Partial<{
    fullName: string;
    username: string;
    phone: string;
    city: string;
    country: string;
    bio: string;
    avatar: string;
    sports: UserSport[];
  }>) {
    logger.debug('UsersAPI', 'Updating user profile:', id);
    // Champs autorisés pour un user normal (pas admin)
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.sports !== undefined) dbUpdates.sports = updates.sports;
    
    const { data, error } = await ((supabase.from('users') as any)
      .update(dbUpdates)
      .eq('id', id)
      .select(USER_PUBLIC_COLUMNS)
      .single());
    
    if (error) throw error;
    return mapUserRowToUser(data as UserRow);
  },

  async update(id: string, updates: Partial<{
    fullName: string;
    username: string;
    phone: string;
    city: string;
    country: string;
    bio: string;
    avatar: string;
    sports: UserSport[];
    stats: UserStats;
    teams: string[];
    isVerified: boolean;
    isPremium: boolean;
    role: string;
  }>) {
    logger.debug('UsersAPI', 'Updating user (admin):', id);
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.sports !== undefined) dbUpdates.sports = updates.sports;
    if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
    if (updates.teams !== undefined) dbUpdates.teams = updates.teams;
    if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;
    if (updates.isPremium !== undefined) dbUpdates.is_premium = updates.isPremium;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    
    const { data, error } = await ((supabase.from('users') as any)
      .update(dbUpdates)
      .eq('id', id)
      .select(USER_PUBLIC_COLUMNS)
      .single());
    
    if (error) throw error;
    return mapUserRowToUser(data as UserRow);
  },

  async delete(id: string) {
    logger.debug('UsersAPI', 'Deleting user:', id);
    const { error } = await (supabase
      .from('users')
      .delete()
      .eq('id', id) as any);
    
    if (error) throw error;
    return { success: true };
  },

  async search(params: {
    query?: string;
    sport?: string;
    level?: string;
    city?: string;
    minReputation?: number;
    isVerified?: boolean;
  }) {
    logger.debug('UsersAPI', 'Searching users');
    let query = supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .eq('is_banned', false) as any;

    if (params.city) {
      query = query.ilike('city', params.city);
    }
    if (params.minReputation) {
      query = query.gte('reputation', params.minReputation);
    }
    if (params.isVerified !== undefined) {
      query = query.eq('is_verified', params.isVerified);
    }

    const { data, error } = await query;
    if (error) throw error;

    let users = ((data || []) as UserRow[]).map(row => mapUserRowToUser(row));

    if (params.query) {
      const q = params.query.toLowerCase();
      users = users.filter(u => 
        u.username.toLowerCase().includes(q) || 
        u.fullName.toLowerCase().includes(q)
      );
    }
    if (params.sport) {
      users = users.filter(u => u.sports.some(s => s.sport === params.sport));
    }
    if (params.level) {
      users = users.filter(u => u.sports.some(s => s.level === params.level));
    }

    return users;
  },

  async follow(followerId: string, followingId: string) {
    logger.debug('UsersAPI', 'Following');
    
    const { error: insertError } = await (supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      } as any) as any);
    
    if (insertError) throw insertError;

    await (supabase.rpc as any)('increment_following', { user_id: followerId });
    await (supabase.rpc as any)('increment_followers', { user_id: followingId });

    return { success: true };
  },

  async unfollow(followerId: string, followingId: string) {
    logger.debug('UsersAPI', 'Unfollowing');
    
    const { error } = await (supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId) as any);
    
    if (error) throw error;

    await (supabase.rpc as any)('decrement_following', { user_id: followerId });
    await (supabase.rpc as any)('decrement_followers', { user_id: followingId });

    return { success: true };
  },

  async getFollowers(userId: string) {
    logger.debug('UsersAPI', 'Getting followers');
    const { data, error } = await (supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId) as any);
    
    if (error) throw error;
    
    const followerIds = ((data || []) as { follower_id: string }[]).map(f => f.follower_id).filter(Boolean);
    if (followerIds.length === 0) return [];

    const { data: users, error: usersError } = await (supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .in('id', followerIds) as any);
    
    if (usersError) throw usersError;
    return ((users || []) as UserRow[]).map(row => mapUserRowToUser(row));
  },

  async getFollowing(userId: string) {
    logger.debug('UsersAPI', 'Getting following');
    const { data, error } = await (supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId) as any);
    
    if (error) throw error;
    
    const followingIds = ((data || []) as { following_id: string }[]).map(f => f.following_id).filter(Boolean);
    if (followingIds.length === 0) return [];

    const { data: users, error: usersError } = await (supabase
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .in('id', followingIds) as any);
    
    if (usersError) throw usersError;
    return ((users || []) as UserRow[]).map(row => mapUserRowToUser(row));
  },

  async isFollowing(followerId: string, followingId: string) {
    const { data, error } = await (supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single() as any);
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },
};
