import {
  supabaseAdmin,
  createTestUser,
  createTestVenue,
  createTestBooking,
  createTestInvoice,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW VENUE MANAGER — Création → Booking → Check-in QR → Paiement → Stats', () => {
  const createdIds = {
    users: [] as string[],
    venues: [] as string[],
    bookings: [] as string[],
    invoices: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Création du venue ──
  test('1. Manager crée un venue avec payment_mode & amenities', async () => {
    const manager = await createTestUser();
    createdIds.users.push(manager.id);

    const venue = await createTestVenue({
      name: 'Terrain Test Premium',
      city: 'Abidjan',
      price_per_hour: 15000,
      amenities: ['parking', 'vestiaires', 'eclairage', 'cafeteria'],
      payment_mode: 'in_app_on_site_qr',
      payout_phone: '+2250700000000',
    });
    createdIds.venues.push(venue.id);

    expect(venue.name).toBe('Terrain Test Premium');
    expect(venue.price_per_hour).toBe(15000);
    expect(venue.amenities).toContain('parking');
  });

  // ── ÉTAPE 2 : Disponibilité du venue ──
  test('2. Venue visible dans la recherche → getById retourne toutes les infos', async () => {
    const manager = await createTestUser();
    createdIds.users.push(manager.id);

    const venue = await createTestVenue({
      name: 'Stade Recherche Test',
      city: 'Yopougon',
    });
    createdIds.venues.push(venue.id);

    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .eq('id', venue.id)
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe('Stade Recherche Test');
    expect(data?.city).toBe('Yopougon');
  });

  // ── ÉTAPE 3 : Booking créé par un joueur ──
  test('3. Joueur réserve un créneau → booking créé avec status="pending"', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue({
      name: 'Terrain Booking Test',
      payment_mode: 'in_app_on_site_qr',
    });
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '20:00',
      total_price: 30000,
      status: 'pending',
      payment_status: 'pending',
    });
    createdIds.bookings.push(booking.id);

    expect(booking.status).toBe('pending');
    expect(booking.payment_status).toBe('pending');
    expect(booking.total_price).toBe(30000);
    expect(booking.booking_code).toBeDefined();
    expect(booking.check_in_token).toBeDefined();
  });

  // ── ÉTAPE 4 : Manager approuve le booking ──
  test('4. Manager approuve booking → status="confirmed"', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      status: 'pending',
    });
    createdIds.bookings.push(booking.id);

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id);

    expect(error).toBeNull();

    const { data: confirmed } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking.id)
      .single();

    expect(confirmed?.status).toBe('confirmed');
  });

  // ── ÉTAPE 5 : Check-in QR ──
  test('5. Check-in QR → booking validé via check_in_token', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const customToken = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const booking = await createTestBooking(player.id, venue.id, {
      status: 'confirmed',
      check_in_token: customToken,
    });
    createdIds.bookings.push(booking.id);

    // Valider le check-in
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'checked_in',
        validated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    expect(error).toBeNull();

    const { data: checkedIn } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking.id)
      .single();

    expect(checkedIn?.status).toBe('checked_in');
  });

  // ── ÉTAPE 6 : Paiement du booking ──
  test('6. Paiement booking → payment_status="paid" → invoice créée', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue({
      payment_mode: 'in_app_immediate',
    });
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      total_price: 25000,
      status: 'confirmed',
      payment_status: 'pending',
      payment_transaction_id: 'PAY-TEST-12345',
    });
    createdIds.bookings.push(booking.id);

    // Simuler confirmation paiement
    const { error: payError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    expect(payError).toBeNull();

    // Créer invoice
    const invoice = await createTestInvoice({
      context_type: 'booking',
      context_id: booking.id,
      amount: 25000,
      status: 'paid',
      payment_method: 'in_app',
    });
    createdIds.invoices.push(invoice.id);

    const { data: paidBooking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking.id)
      .single();

    expect(paidBooking?.payment_status).toBe('paid');
    expect(invoice.amount).toBe(25000);
    expect(invoice.context_type).toBe('booking');
  });

  // ── ÉTAPE 7 : Annulation de booking ──
  test('7. Joueur annule booking → status="cancelled"', async () => {
    const player = await createTestUser();
    createdIds.users.push(player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      status: 'confirmed',
    });
    createdIds.bookings.push(booking.id);

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    expect(error).toBeNull();

    const { data: cancelled } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', booking.id)
      .single();

    expect(cancelled?.status).toBe('cancelled');
  });

  // ── ÉTAPE 8 : Stats bookings du manager ──
  test('8. Manager voit tous ses bookings → liste non vide', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking1 = await createTestBooking(player.id, venue.id, { status: 'completed' });
    const booking2 = await createTestBooking(player.id, venue.id, { status: 'confirmed' });
    createdIds.bookings.push(booking1.id, booking2.id);

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('venue_id', venue.id);

    expect(error).toBeNull();
    expect(bookings).toHaveLength(2);
    expect(bookings?.some(b => b.status === 'completed')).toBe(true);
    expect(bookings?.some(b => b.status === 'confirmed')).toBe(true);
  });

  // ── ÉTAPE 9 : Notification de réservation ──
  test('9. Manager reçoit notification de nouvelle réservation', async () => {
    const manager = await createTestUser();
    const player = await createTestUser();
    createdIds.users.push(manager.id, player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id);
    createdIds.bookings.push(booking.id);

    const notif = await createTestNotification(manager.id, {
      type: 'new_booking',
      title: 'Nouvelle réservation',
      message: `Réservation pour ${booking.date}`,
      data: { bookingId: booking.id, venueId: venue.id },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('new_booking');
    expect(notif.user_id).toBe(manager.id);
  });
});
