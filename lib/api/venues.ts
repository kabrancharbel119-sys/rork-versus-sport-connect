import { supabase } from '@/lib/supabase';
import type { Venue, Booking, BookingStatus } from '@/types';
import { notificationsApi } from './notifications';

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
  owner_id: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  opening_hours: any | null;
  auto_approve: boolean;
  is_active: boolean;
  capacity: number | null;
  surface_type: string | null;
  rules: string | null;
  cancellation_hours: number | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  venue_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: string;
  match_id: string | null;
  tournament_id: string | null;
  notes: string | null;
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
  ownerId: row.owner_id ?? undefined,
  description: row.description ?? undefined,
  phone: row.phone ?? undefined,
  email: row.email ?? undefined,
  openingHours: row.opening_hours ?? undefined,
  autoApprove: row.auto_approve ?? true,
  isActive: row.is_active ?? true,
  capacity: row.capacity ?? undefined,
  surfaceType: row.surface_type ?? undefined,
  rules: row.rules ?? undefined,
  cancellationHours: row.cancellation_hours ?? 24,
});

export const mapBookingRowToBooking = (row: BookingRow): Booking => ({
  id: row.id,
  venueId: row.venue_id,
  userId: row.user_id,
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  totalPrice: row.total_amount,
  status: row.status as BookingStatus,
  matchId: row.match_id ?? undefined,
  tournamentId: (row as any).tournament_id ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: new Date(row.created_at),
});

// Extract hour from a TIMESTAMPTZ string or a plain time string
// Handles: '2026-03-16T18:00:00+00:00', '2026-03-16T18:00:00', '18:00:00', '18:00'
const parseHourFromTimestamp = (val: string): number => {
  if (!val) return 0;
  // If it contains 'T', it's a full timestamp — parse the time part after T
  if (val.includes('T')) {
    const timePart = val.split('T')[1]; // '18:00:00+00:00'
    return parseInt(timePart.split(':')[0], 10) || 0;
  }
  // Otherwise treat as plain time string
  return parseInt(val.split(':')[0], 10) || 0;
};

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
      .select(`
        id,
        name,
        address,
        city,
        sport,
        price_per_hour,
        images,
        rating,
        amenities,
        latitude,
        longitude,
        owner_id,
        description,
        phone,
        email,
        opening_hours,
        auto_approve,
        is_active,
        capacity,
        surface_type,
        rules,
        created_at
      `)
      .order('rating', { ascending: false }) as any);
    
    if (error) {
      console.error('[VenuesAPI] Error getting all venues:', error);
      throw error;
    }
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
    const selectedDayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const openingHours = Array.isArray(venue.openingHours) ? venue.openingHours : [];
    const dayHours = openingHours.find((d: any) => Number(d?.dayOfWeek) === selectedDayOfWeek);

    if (dayHours?.isClosed) {
      return [];
    }

    let openHour = 8;
    let closeHour = 22;
    if (dayHours && !dayHours.isClosed) {
      const parsedOpen = parseInt(String(dayHours.openTime || '').split(':')[0], 10);
      const parsedClose = parseInt(String(dayHours.closeTime || '').split(':')[0], 10);
      if (!isNaN(parsedOpen) && !isNaN(parsedClose) && parsedOpen < parsedClose) {
        openHour = parsedOpen;
        closeHour = parsedClose;
      }
    }

    const { data: bookings, error: bookingsError } = await (supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('venue_id', venueId)
      .eq('date', date)
      .neq('status', 'cancelled') as any);

    if (bookingsError) {
      console.error('[VenuesAPI] Error fetching bookings:', bookingsError);
    }

    const bookingsData = (bookings || []) as { start_time: string; end_time: string }[];

    // Parse booked hour ranges — start_time/end_time are TIMESTAMPTZ
    const bookedHours = new Set<number>();
    for (const b of bookingsData) {
      const startH = parseHourFromTimestamp(b.start_time);
      const endH = parseHourFromTimestamp(b.end_time);
      for (let h = startH; h < endH; h++) {
        bookedHours.add(h);
      }
    }

    const slots = [];
    for (let hour = openHour; hour < closeHour; hour++) {
      slots.push({
        hour,
        available: !bookedHours.has(hour),
        price: venue.pricePerHour ?? 0,
      });
    }

    return slots;
  },

  async book(userId: string, booking: {
    venueId: string;
    date: string;
    startTime: string;
    endTime: string;
    matchId?: string;
    tournamentId?: string;
  }) {
    console.log('[VenuesAPI] Creating booking:', booking);
    
    const venue = await this.getById(booking.venueId);
    const selectedDayOfWeek = new Date(`${booking.date}T00:00:00`).getDay();
    const openingHours = Array.isArray(venue.openingHours) ? venue.openingHours : [];
    const dayHours = openingHours.length > 0
      ? openingHours.find((d: any) => Number(d?.dayOfWeek) === selectedDayOfWeek)
      : undefined;

    // Validate input
    const startHour = parseInt(booking.startTime.split(':')[0], 10);
    const endHour = parseInt(booking.endTime.split(':')[0], 10);
    if (isNaN(startHour) || isNaN(endHour) || startHour >= endHour) {
      throw new Error('Heures de début et fin invalides. Vérifiez votre sélection.');
    }

    // Only block if opening hours are configured AND day is explicitly closed
    if (dayHours !== undefined && dayHours?.isClosed === true) {
      throw new Error('Ce terrain est fermé le jour sélectionné.');
    }

    // Only enforce hour limits if opening hours are configured for this day
    if (dayHours !== undefined && !dayHours.isClosed) {
      const parsedOpen = parseInt(String(dayHours.openTime || '').split(':')[0], 10);
      const parsedClose = parseInt(String(dayHours.closeTime || '').split(':')[0], 10);
      if (!isNaN(parsedOpen) && !isNaN(parsedClose) && parsedOpen < parsedClose) {
        if (startHour < parsedOpen || endHour > parsedClose) {
          throw new Error(`Les réservations sont possibles entre ${parsedOpen}h et ${parsedClose}h.`);
        }
      }
    }

    // Check for conflicts using numeric comparison
    const { data: existingBookings, error: fetchErr } = await (supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('venue_id', booking.venueId)
      .eq('date', booking.date)
      .neq('status', 'cancelled') as any);

    if (fetchErr) {
      console.error('[VenuesAPI] Error checking existing bookings:', fetchErr);
      throw new Error('Impossible de vérifier la disponibilité. Réessayez.');
    }

    const existingData = (existingBookings || []) as { start_time: string; end_time: string }[];
    const bookedHours = new Set<number>();
    for (const b of existingData) {
      const bStart = parseHourFromTimestamp(b.start_time);
      const bEnd = parseHourFromTimestamp(b.end_time);
      for (let h = bStart; h < bEnd; h++) {
        bookedHours.add(h);
      }
    }

    // Check each requested hour
    const conflictHours: number[] = [];
    for (let h = startHour; h < endHour; h++) {
      if (bookedHours.has(h)) conflictHours.push(h);
    }
    if (conflictHours.length > 0) {
      const conflictStr = conflictHours.map(h => `${h}h-${h + 1}h`).join(', ');
      throw new Error(`Créneaux déjà réservés : ${conflictStr}. Choisissez d'autres horaires.`);
    }

    const duration = endHour - startHour;
    const totalPrice = duration * (venue.pricePerHour ?? 0);

    // Format as full ISO timestamps for TIMESTAMPTZ columns
    const startTimestamp = `${booking.date}T${String(startHour).padStart(2, '0')}:00:00`;
    const endTimestamp = `${booking.date}T${String(endHour).padStart(2, '0')}:00:00`;

    const insertPayload = {
      venue_id: booking.venueId,
      user_id: userId,
      date: booking.date,
      start_time: startTimestamp,
      end_time: endTimestamp,
      total_amount: totalPrice,
      match_id: booking.matchId || null,
      tournament_id: booking.tournamentId || null,
      status: venue.autoApprove === false ? 'pending' : 'confirmed',
    };
    console.log('[VenuesAPI] Booking insert payload:', JSON.stringify(insertPayload));

    const { data, error } = await (supabase
      .from('bookings')
      .insert(insertPayload as any)
      .select()
      .single() as any);

    if (error) {
      console.error('[VenuesAPI] Booking insert error:', JSON.stringify(error));
      throw new Error(`Erreur lors de la réservation : ${error.message || 'Erreur inconnue'} (code: ${error.code || '?'})`);
    }

    // Send notification to venue owner
    if (venue.ownerId) {
      try {
        const bookingStatus = venue.autoApprove === false ? 'pending' : 'confirmed';
        const formattedDate = booking.date; // YYYY-MM-DD
        const timeRange = `${startHour}h-${endHour}h`;
        
        if (bookingStatus === 'pending') {
          // Notification for manual approval required
          await notificationsApi.send(venue.ownerId, {
            type: 'booking',
            title: '🏟️ Nouvelle demande de réservation',
            message: `${venue.name} - ${formattedDate} à ${timeRange} (${totalPrice.toLocaleString()} FCFA)`,
            data: {
              bookingId: data.id,
              venueId: venue.id,
              venueName: venue.name,
              date: booking.date,
              startTime: startTimestamp,
              endTime: endTimestamp,
              status: 'pending',
            },
          });
          console.log('[VenuesAPI] Notification sent to owner for pending booking');
        } else {
          // Notification for auto-confirmed booking
          await notificationsApi.send(venue.ownerId, {
            type: 'booking',
            title: '✅ Nouvelle réservation confirmée',
            message: `${venue.name} - ${formattedDate} à ${timeRange} (${totalPrice.toLocaleString()} FCFA)`,
            data: {
              bookingId: data.id,
              venueId: venue.id,
              venueName: venue.name,
              date: booking.date,
              startTime: startTimestamp,
              endTime: endTimestamp,
              status: 'confirmed',
            },
          });
          console.log('[VenuesAPI] Notification sent to owner for auto-confirmed booking');
        }
      } catch (notifError) {
        console.error('[VenuesAPI] Failed to send notification:', notifError);
        // Don't fail the booking if notification fails
      }
    }

    return data;
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

  // ── Venue Manager CRUD ──

  async getByOwner(ownerId: string) {
    console.log('[VenuesAPI] Getting venues for owner:', ownerId);
    const { data, error } = await (supabase
      .from('venues')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false }) as any);
    if (error) throw error;
    return ((data || []) as VenueRow[]).map(mapVenueRowToVenue);
  },

  async create(ownerId: string, venue: {
    name: string;
    address: string;
    city: string;
    sport: string[];
    pricePerHour: number;
    description?: string;
    phone?: string;
    email?: string;
    amenities?: string[];
    images?: string[];
    latitude?: number;
    longitude?: number;
    openingHours?: any;
    autoApprove?: boolean;
    capacity?: number;
    surfaceType?: string;
    rules?: string;
    cancellationHours?: number;
  }) {
    console.log('[VenuesAPI] Creating venue for owner:', ownerId);
    // Filter out any local file URLs - only public http/https URLs allowed
    const publicImages = (venue.images || []).filter(url => 
      typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
    );
    const { data, error } = await (supabase
      .from('venues')
      .insert({
        owner_id: ownerId,
        name: venue.name,
        address: venue.address,
        city: venue.city,
        sport: venue.sport,
        price_per_hour: venue.pricePerHour,
        description: venue.description || null,
        phone: venue.phone || null,
        email: venue.email || null,
        amenities: venue.amenities || [],
        images: publicImages,
        latitude: venue.latitude || null,
        longitude: venue.longitude || null,
        opening_hours: venue.openingHours || null,
        auto_approve: venue.autoApprove ?? true,
        is_active: true,
        rating: 4.0,
        capacity: venue.capacity || null,
        surface_type: venue.surfaceType || null,
        rules: venue.rules || null,
        cancellation_hours: venue.cancellationHours ?? 24,
      } as any)
      .select()
      .single() as any);
    if (error) throw error;
    return mapVenueRowToVenue(data as VenueRow);
  },

  async update(venueId: string, ownerId: string, updates: Partial<{
    name: string;
    address: string;
    city: string;
    sport: string[];
    pricePerHour: number;
    description: string;
    phone: string;
    email: string;
    amenities: string[];
    images: string[];
    latitude: number;
    longitude: number;
    openingHours: any;
    autoApprove: boolean;
    isActive: boolean;
    capacity: number;
    surfaceType: string;
    rules: string;
    cancellationHours: number;
  }>) {
    console.log('[VenuesAPI] Updating venue:', venueId);
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.sport !== undefined) payload.sport = updates.sport;
    if (updates.pricePerHour !== undefined) payload.price_per_hour = updates.pricePerHour;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.amenities !== undefined) payload.amenities = updates.amenities;
    if (updates.images !== undefined) {
      // Filter out any local file URLs - only public http/https URLs allowed
      payload.images = updates.images.filter(url => 
        typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
      );
    }
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.openingHours !== undefined) payload.opening_hours = updates.openingHours;
    if (updates.autoApprove !== undefined) payload.auto_approve = updates.autoApprove;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.surfaceType !== undefined) payload.surface_type = updates.surfaceType;
    if (updates.rules !== undefined) payload.rules = updates.rules;
    if (updates.cancellationHours !== undefined) payload.cancellation_hours = updates.cancellationHours;

    const { data, error } = await (supabase
      .from('venues')
      .update(payload as any)
      .eq('id', venueId)
      .eq('owner_id', ownerId)
      .select()
      .single() as any);
    if (error) throw error;
    return mapVenueRowToVenue(data as VenueRow);
  },

  async delete(venueId: string, ownerId: string) {
    console.log('[VenuesAPI] Deleting venue:', venueId);
    const { error } = await (supabase
      .from('venues')
      .delete()
      .eq('id', venueId)
      .eq('owner_id', ownerId) as any);
    if (error) throw error;
    return { success: true };
  },

  // ── Booking Management (for venue managers) ──

  async getVenueBookings(venueId: string) {
    console.log('[VenuesAPI] Getting bookings for venue:', venueId);
    const { data, error } = await (supabase
      .from('bookings')
      .select('*')
      .eq('venue_id', venueId)
      .order('date', { ascending: true }) as any);
    if (error) throw error;
    return ((data || []) as BookingRow[]).map(mapBookingRowToBooking);
  },

  async getOwnerBookings(ownerId: string) {
    console.log('[VenuesAPI] Getting all bookings for owner:', ownerId);
    
    // First get owner's venues
    const venues = await this.getByOwner(ownerId);
    console.log('[VenuesAPI] Owner has', venues.length, 'venues');
    
    const venueIds = venues.map(v => v.id);
    if (venueIds.length === 0) {
      console.log('[VenuesAPI] No venues found for owner, returning empty bookings');
      return [];
    }
    
    console.log('[VenuesAPI] Fetching bookings for venue IDs:', venueIds);

    const { data, error } = await (supabase
      .from('bookings')
      .select('*')
      .in('venue_id', venueIds)
      .order('date', { ascending: false }) as any);
    
    if (error) {
      console.error('[VenuesAPI] Error fetching owner bookings:', error);
      throw error;
    }
    
    console.log('[VenuesAPI] Found', (data || []).length, 'bookings for owner');
    const rows = (data || []) as BookingRow[];

    // Enrich tournament bookings with tournament name, organizer and team info
    const enriched = await Promise.all(rows.map(async (row) => {
      const booking = mapBookingRowToBooking(row);
      const tId = (row as any).tournament_id;
      if (!tId) return booking;
      try {
        const { data: tRow } = await (supabase
          .from('tournaments')
          .select('id, name, created_by')
          .eq('id', tId)
          .single() as any);
        if (!tRow) return booking;

        // Get organizer display name
        const { data: uRow } = await (supabase
          .from('users')
          .select('id, full_name, username')
          .eq('id', tRow.created_by)
          .single() as any);

        // Get organizer's team for this tournament
        const { data: teamRows } = await (supabase
          .from('teams')
          .select('id, name')
          .eq('captain_id', tRow.created_by)
          .limit(1) as any);

        return {
          ...booking,
          tournamentName: tRow.name as string,
          organizerName: (uRow?.full_name || uRow?.username || 'Organisateur') as string,
          organizerTeamName: (teamRows?.[0]?.name ?? null) as string | null,
        };
      } catch {
        return booking;
      }
    }));

    console.log('[VenuesAPI] Mapped bookings:', enriched.length);
    return enriched;
  },

  async getUserBookings(userId: string) {
    console.log('[VenuesAPI] Getting bookings for user:', userId);
    const { data, error } = await (supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }) as any);
    if (error) throw error;
    return ((data || []) as BookingRow[]).map(mapBookingRowToBooking);
  },

  async cancelBooking(bookingId: string, userId: string) {
    console.log('[VenuesAPI] User cancelling booking:', bookingId);

    // Fetch the booking
    const { data: bookingData, error: bookingErr } = await (supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single() as any);
    if (bookingErr || !bookingData) throw new Error('Réservation introuvable.');

    const booking = mapBookingRowToBooking(bookingData as BookingRow);

    if (booking.status === 'cancelled' || booking.status === 'rejected' || booking.status === 'completed') {
      throw new Error('Cette réservation ne peut plus être annulée.');
    }

    // Fetch venue to get cancellationHours
    const venue = await this.getById(booking.venueId);
    const cancellationHours = venue.cancellationHours ?? 24;

    // Parse booking start datetime
    const [y, m, d] = booking.date.split('-').map(Number);
    const startHour = parseInt((booking.startTime || '00').split('T').pop()!.split(':')[0], 10);
    const bookingStart = new Date(y, m - 1, d, startHour, 0, 0);
    const now = new Date();
    const hoursUntilStart = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < cancellationHours) {
      throw new Error(
        `Annulation impossible : le délai de ${cancellationHours}h avant le créneau est dépassé.\n` +
        `Il reste ${Math.max(0, Math.floor(hoursUntilStart))}h avant le début.`
      );
    }

    // Cancel the booking
    const { error: updateErr } = await (supabase
      .from('bookings')
      .update({ status: 'cancelled' } as any)
      .eq('id', bookingId)
      .eq('user_id', userId) as any);
    if (updateErr) throw new Error('Impossible d\'annuler la réservation : ' + updateErr.message);

    // Cascade to linked match if any
    if (booking.matchId) {
      try {
        await (supabase
          .from('matches')
          .update({ status: 'cancelled' } as any)
          .eq('id', booking.matchId)
          .in('status', ['venue_pending', 'open', 'confirmed']) as any);
      } catch (e: any) {
        console.warn('[VenuesAPI] Match cascade on user cancel failed (non-blocking):', e?.message);
      }
    }

    // Notify venue owner
    if (venue.ownerId) {
      try {
        const startH = parseInt((booking.startTime || '00').split('T').pop()!.split(':')[0], 10);
        const endH = parseInt((booking.endTime || '00').split('T').pop()!.split(':')[0], 10);
        await notificationsApi.send(venue.ownerId, {
          type: 'booking',
          title: '🚫 Réservation annulée par le joueur',
          message: `${venue.name} — ${booking.date} ${startH}h-${endH}h a été annulée par le joueur.`,
          data: {
            bookingId: booking.id,
            venueId: venue.id,
            venueName: venue.name,
            date: booking.date,
            status: 'cancelled',
          },
        });
      } catch (e: any) {
        console.warn('[VenuesAPI] Owner cancel notification failed (non-blocking):', e?.message);
      }
    }

    return { success: true, cancellationHours };
  },

  async updateBookingStatus(bookingId: string, status: BookingStatus) {
    console.log('[VenuesAPI] Updating booking status:', bookingId, status);
    let { data, error } = await (supabase
      .from('bookings')
      .update({ status } as any)
      .eq('id', bookingId)
      .select()
      .single() as any);

    let resolvedStatus = status;

    if (error && status === 'rejected') {
      console.warn('[VenuesAPI] Rejected status update failed, retrying with cancelled for compatibility:', error?.message || error);
      const fallback = await (supabase
        .from('bookings')
        .update({ status: 'cancelled' } as any)
        .eq('id', bookingId)
        .select()
        .single() as any);

      if (!fallback.error) {
        data = fallback.data;
        error = null;
        resolvedStatus = 'cancelled';
      }
    }

    if (error) throw error;

    const booking = mapBookingRowToBooking(data as BookingRow);

    // Cascade booking status to linked match (venue_pending -> open / cancelled)
    if (booking.matchId) {
      try {
        const newMatchStatus = resolvedStatus === 'confirmed' ? 'open'
          : (resolvedStatus === 'rejected' || resolvedStatus === 'cancelled') ? 'cancelled'
          : null;
        if (newMatchStatus) {
          await (supabase
            .from('matches')
            .update({ status: newMatchStatus } as any)
            .eq('id', booking.matchId)
            .eq('status', 'venue_pending') as any);
        }
      } catch (matchErr: any) {
        console.warn('[VenuesAPI] Match status cascade failed (non-blocking):', matchErr?.message);
      }
    }

    // Cascade booking status to linked tournament (venue_pending -> registration / cancelled)
    if ((booking as any).tournamentId) {
      try {
        const newTournamentStatus = resolvedStatus === 'confirmed' ? 'registration'
          : (resolvedStatus === 'rejected' || resolvedStatus === 'cancelled') ? 'cancelled'
          : null;
        if (newTournamentStatus) {
          // Update the tournament status
          await (supabase
            .from('tournaments')
            .update({ status: newTournamentStatus } as any)
            .eq('id', (booking as any).tournamentId)
            .eq('status', 'venue_pending') as any);
          // Cascade to all other pending bookings of this tournament
          const newBookingStatus = resolvedStatus === 'confirmed' ? 'confirmed' : 'cancelled';
          await (supabase
            .from('bookings')
            .update({ status: newBookingStatus } as any)
            .eq('tournament_id', (booking as any).tournamentId)
            .eq('status', 'pending')
            .neq('id', booking.id) as any).catch(() => {});
        }
      } catch (tournErr: any) {
        console.warn('[VenuesAPI] Tournament status cascade failed (non-blocking):', tournErr?.message);
      }
    }

    // Send notification to user about status change
    try {
      const venue = await this.getById(booking.venueId);
      const startH = parseHourFromTimestamp(booking.startTime);
      const endH = parseHourFromTimestamp(booking.endTime);
      const timeRange = `${startH}h-${endH}h`;
      const isMatchBooking = !!booking.matchId;
      const isTournamentBooking = !!(booking as any).tournamentId;
      const context = isTournamentBooking ? ' (Tournoi)' : isMatchBooking ? ' (Match)' : '';

      if (resolvedStatus === 'confirmed') {
        await notificationsApi.send(booking.userId, {
          type: 'booking',
          title: `✅ Terrain confirmé${context}`,
          message: isMatchBooking
            ? `Le gestionnaire de ${venue.name} a approuvé votre créneau du ${booking.date} à ${timeRange}. Votre match est maintenant ouvert aux inscriptions !`
            : `Votre réservation pour ${venue.name} le ${booking.date} à ${timeRange} a été approuvée !`,
          data: {
            bookingId: booking.id,
            venueId: venue.id,
            venueName: venue.name,
            date: booking.date,
            ...(booking.matchId ? { matchId: booking.matchId } : {}),
            status: 'confirmed',
          },
        });
        console.log('[VenuesAPI] Confirmation notification sent to user');
      } else if (resolvedStatus === 'rejected' || resolvedStatus === 'cancelled') {
        await notificationsApi.send(booking.userId, {
          type: 'booking',
          title: `❌ Terrain refusé${context}`,
          message: isMatchBooking
            ? `Le gestionnaire de ${venue.name} a refusé votre créneau du ${booking.date} à ${timeRange}. Votre match a été annulé.`
            : `Votre demande de réservation pour ${venue.name} le ${booking.date} à ${timeRange} a été refusée.`,
          data: {
            bookingId: booking.id,
            venueId: venue.id,
            venueName: venue.name,
            date: booking.date,
            ...(booking.matchId ? { matchId: booking.matchId } : {}),
            status: resolvedStatus,
          },
        });
        console.log('[VenuesAPI] Rejection notification sent to user');
      }
    } catch (notifError) {
      console.error('[VenuesAPI] Failed to send status update notification:', notifError);
      // Don't fail the status update if notification fails
    }

    return booking;
  },
};
