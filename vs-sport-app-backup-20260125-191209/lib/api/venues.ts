import { supabase } from '@/lib/supabase';
import type { Venue } from '@/types';

export interface VenueRow {
  id: string;
  name: string;
  address: string;
  city: string;
  sport: string[];
  price_per_hour: number;
  images: string[];
  rating: number;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export const mapVenueRowToVenue = (row: VenueRow): Venue => ({
  id: row.id,
  name: row.name,
  address: row.address,
  city: row.city,
  sport: ((row.sport as string[]) || []) as Venue['sport'],
  pricePerHour: row.price_per_hour ?? 0,
  images: (row.images as string[]) || [],
  rating: row.rating ?? 4.0,
  amenities: (row.amenities as string[]) || [],
  coordinates: row.latitude && row.longitude ? {
    latitude: row.latitude,
    longitude: row.longitude
  } : undefined,
});

const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const venuesApi = {
  async getAll() {
    console.log('[VenuesAPI] Getting all venues');
    const { data, error } = await (supabase
      .from('venues')
      .select('*')
      .order('rating', { ascending: false }) as any);
    
    if (error) throw error;
    return ((data || []) as VenueRow[]).map(row => mapVenueRowToVenue(row));
  },

  async getById(id: string) {
    console.log('[VenuesAPI] Getting venue by id:', id);
    const { data, error } = await (supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single() as any);
    
    if (error) throw error;
    if (!data) throw new Error('Terrain non trouvé');
    return mapVenueRowToVenue(data as VenueRow);
  },

  async search(params: {
    city?: string;
    sport?: string;
    minRating?: number;
    maxPrice?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) {
    console.log('[VenuesAPI] Searching venues:', params);
    let query = supabase.from('venues').select('*') as any;

    if (params.city) {
      query = query.ilike('city', params.city);
    }
    if (params.minRating) {
      query = query.gte('rating', params.minRating);
    }
    if (params.maxPrice) {
      query = query.lte('price_per_hour', params.maxPrice);
    }

    const { data, error } = await query;
    if (error) throw error;

    let venues = ((data || []) as VenueRow[]).map(row => mapVenueRowToVenue(row));

    if (params.sport) {
      venues = venues.filter(v => (v.sport as string[]).includes(params.sport!));
    }

    if (params.lat && params.lng && params.radiusKm) {
      venues = venues.filter(v => {
        if (!v.coordinates) return false;
        return getDistance(params.lat!, params.lng!, v.coordinates.latitude, v.coordinates.longitude) <= params.radiusKm!;
      });
    }

    return venues;
  },

  async getAvailability(venueId: string, date: string) {
    console.log('[VenuesAPI] Getting availability for:', venueId, date);
    
    const venue = await this.getById(venueId);

    const { data: bookings } = await (supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('venue_id', venueId)
      .eq('date', date)
      .neq('status', 'cancelled') as any);

    const bookingsData = (bookings || []) as { start_time: string; end_time: string }[];
    const slots = [];
    for (let hour = 8; hour < 22; hour++) {
      const hourStr = `${hour}:00`;
      const isBooked = bookingsData.some(b => 
        b.start_time <= hourStr && b.end_time > hourStr
      );
      slots.push({ hour, available: !isBooked, price: venue.pricePerHour });
    }

    return slots;
  },

  async book(userId: string, booking: {
    venueId: string;
    date: string;
    startTime: string;
    endTime: string;
    matchId?: string;
  }) {
    console.log('[VenuesAPI] Creating booking');
    
    const venue = await this.getById(booking.venueId);

    const { data: existingBookings } = await (supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('venue_id', booking.venueId)
      .eq('date', booking.date)
      .neq('status', 'cancelled') as any);

    const existingData = (existingBookings || []) as { start_time: string; end_time: string }[];
    const hasConflict = existingData.some(b =>
      (booking.startTime >= b.start_time && booking.startTime < b.end_time) ||
      (booking.endTime > b.start_time && booking.endTime <= b.end_time)
    );

    if (hasConflict) {
      throw new Error('Créneau déjà réservé');
    }

    const startHour = parseInt(booking.startTime.split(':')[0]);
    const endHour = parseInt(booking.endTime.split(':')[0]);
    const duration = endHour - startHour;
    const totalPrice = duration * venue.pricePerHour;

    const { data, error } = await (supabase
      .from('bookings')
      .insert({
        venue_id: booking.venueId,
        user_id: userId,
        date: booking.date,
        start_time: booking.startTime,
        end_time: booking.endTime,
        total_price: totalPrice,
        match_id: booking.matchId,
        status: 'confirmed',
      } as any)
      .select()
      .single() as any);

    if (error) throw error;
    return data;
  },

  async cancelBooking(bookingId: string, userId: string) {
    console.log('[VenuesAPI] Cancelling booking:', bookingId);
    
    const { error } = await ((supabase.from('bookings') as any)
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', userId));

    if (error) throw error;
    return { success: true };
  },

  async getUserBookings(userId: string) {
    console.log('[VenuesAPI] Getting bookings for user:', userId);
    
    const { data, error } = await (supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('date', { ascending: true }) as any);

    if (error) throw error;
    return data || [];
  },

  async getNearby(lat: number, lng: number, radiusKm: number = 20) {
    console.log('[VenuesAPI] Getting nearby venues');
    
    const { data, error } = await (supabase.from('venues').select('*') as any);
    if (error) throw error;

    return ((data || []) as VenueRow[])
      .map(row => {
        const venue = mapVenueRowToVenue(row);
        const distance = venue.coordinates 
          ? getDistance(lat, lng, venue.coordinates.latitude, venue.coordinates.longitude)
          : null;
        return { ...venue, distance };
      })
      .filter(v => v.distance !== null && v.distance <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  },
};
