import { supabase } from '@/lib/supabase';
import type { VenueReview } from '@/types';

interface VenueReviewRow {
  id: string;
  venue_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewAuthorRow {
  id: string;
  username: string | null;
  full_name: string | null;
}

const mapVenueReviewRowToVenueReview = (row: VenueReviewRow, authorName?: string): VenueReview => ({
  id: row.id,
  venueId: row.venue_id,
  userId: row.user_id,
  rating: row.rating,
  comment: row.comment ?? undefined,
  authorName,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const getAuthorMap = async (userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, string>();

  const { data, error } = await (supabase
    .from('users')
    .select('id, username, full_name')
    .in('id', userIds) as any);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const user of ((data || []) as ReviewAuthorRow[])) {
    const displayName = user.full_name || user.username || 'Utilisateur';
    map.set(user.id, displayName);
  }
  return map;
};

export const venueReviewsApi = {
  async getByVenue(venueId: string) {
    const { data, error } = await (supabase
      .from('venue_reviews')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false }) as any);

    if (error) throw error;
    const rows = (data || []) as VenueReviewRow[];
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    const authorMap = await getAuthorMap(userIds);
    return rows.map(row => mapVenueReviewRowToVenueReview(row, authorMap.get(row.user_id)));
  },

  async getByVenueAndUser(venueId: string, userId: string) {
    const { data, error } = await (supabase
      .from('venue_reviews')
      .select('*')
      .eq('venue_id', venueId)
      .eq('user_id', userId)
      .maybeSingle() as any);

    if (error) throw error;
    if (!data) return null;
    const row = data as VenueReviewRow;
    const authorMap = await getAuthorMap([row.user_id]);
    return mapVenueReviewRowToVenueReview(row, authorMap.get(row.user_id));
  },

  async canUserReview(venueId: string, userId: string) {
    const { data, error } = await (supabase
      .from('bookings')
      .select('id')
      .eq('venue_id', venueId)
      .eq('user_id', userId)
      .in('status', ['confirmed', 'completed'])
      .limit(1) as any);

    if (error) throw error;
    return (data || []).length > 0;
  },

  async upsert(userId: string, payload: { venueId: string; rating: number; comment?: string }) {
    const { data, error } = await (supabase
      .from('venue_reviews')
      .upsert({
        venue_id: payload.venueId,
        user_id: userId,
        rating: payload.rating,
        comment: payload.comment?.trim() || null,
      } as any, { onConflict: 'venue_id,user_id' })
      .select('*')
      .single() as any);

    if (error) throw error;
    const row = data as VenueReviewRow;
    const authorMap = await getAuthorMap([row.user_id]);
    return mapVenueReviewRowToVenueReview(row, authorMap.get(row.user_id));
  },

  async remove(reviewId: string, userId: string) {
    const { error } = await (supabase
      .from('venue_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId) as any);

    if (error) throw error;
    return { success: true };
  },
};
