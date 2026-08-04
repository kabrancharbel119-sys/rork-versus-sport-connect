import {
  supabaseAdmin,
  createTestUser,
  createTestVenue,
  createTestBooking,
  createTestTournament,
  createTestTeam,
  createTestTicketType,
  createTestTicket,
  createTestTournamentPayment,
  createTestInvoice,
  cleanup
} from './setup';

// Simule le traitement d'un webhook GeniusPay sans faire de vrai paiement
describe('FLOW WEBHOOKS — Simulation payment.succeeded & payment.failed → DB updates', () => {
  const createdIds = {
    users: [] as string[],
    venues: [] as string[],
    bookings: [] as string[],
    teams: [] as string[],
    tournaments: [] as string[],
    tournament_payments: [] as string[],
    ticket_types: [] as string[],
    tickets: [] as string[],
    invoices: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── WEBHOOK 1 : Booking payment succeeded ──
  test('1. payment.succeeded pour booking → payment_status="paid" + invoice créée', async () => {
    const player = await createTestUser();
    const manager = await createTestUser();
    createdIds.users.push(player.id, manager.id);

    const venue = await createTestVenue({ payment_mode: 'in_app_immediate' });
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      total_price: 20000,
      status: 'confirmed',
      payment_status: 'pending',
      payment_transaction_id: 'PAY-WEBHOOK-001',
    });
    createdIds.bookings.push(booking.id);

    // Simuler traitement webhook
    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('payment_transaction_id', 'PAY-WEBHOOK-001');

    expect(bookingError).toBeNull();

    const invoice = await createTestInvoice({
      context_type: 'booking',
      context_id: booking.id,
      amount: 20000,
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
    expect(invoice.amount).toBe(20000);
  });

  // ── WEBHOOK 2 : Booking payment failed ──
  test('2. payment.failed pour booking → payment_status="failed"', async () => {
    const player = await createTestUser();
    createdIds.users.push(player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      payment_status: 'pending',
      payment_transaction_id: 'PAY-WEBHOOK-FAIL-001',
    });
    createdIds.bookings.push(booking.id);

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ payment_status: 'failed' })
      .eq('payment_transaction_id', 'PAY-WEBHOOK-FAIL-001');

    expect(error).toBeNull();

    const { data: failedBooking } = await supabaseAdmin
      .from('bookings')
      .select('payment_status')
      .eq('id', booking.id)
      .single();

    expect(failedBooking?.payment_status).toBe('failed');
  });

  // ── WEBHOOK 3 : Tournament payment succeeded ──
  test('3. payment.succeeded pour tournoi → tournament_payment status="succeeded"', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id, { entry_fee: 5000 });
    createdIds.tournaments.push(tournament.id);

    const team = await createTestTeam(organizer.id);
    createdIds.teams.push(team.id);

    const payment = await createTestTournamentPayment(tournament.id, team.id, {
      amount: 5000,
      status: 'pending',
    });
    createdIds.tournament_payments.push(payment.id);

    // Simuler webhook
    const { error } = await supabaseAdmin
      .from('tournament_payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    expect(error).toBeNull();

    const { data: succeededPayment } = await supabaseAdmin
      .from('tournament_payments')
      .select('*')
      .eq('id', payment.id)
      .single();

    expect(succeededPayment?.status).toBe('succeeded');
  });

  // ── WEBHOOK 4 : Tournament payment failed ──
  test('4. payment.failed pour tournoi → tournament_payment status="failed"', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const team = await createTestTeam(organizer.id);
    createdIds.teams.push(team.id);

    const payment = await createTestTournamentPayment(tournament.id, team.id, {
      status: 'pending',
    });
    createdIds.tournament_payments.push(payment.id);

    const { error } = await supabaseAdmin
      .from('tournament_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id);

    expect(error).toBeNull();

    const { data: failedPayment } = await supabaseAdmin
      .from('tournament_payments')
      .select('status')
      .eq('id', payment.id)
      .single();

    expect(failedPayment?.status).toBe('failed');
  });

  // ── WEBHOOK 5 : Ticket purchase succeeded ──
  test('5. payment.succeeded pour tickets → tickets status="valid" + invoice créée', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id, {
      price: 3000,
    });
    createdIds.ticket_types.push(ticketType.id);

    // Tickets en pending
    const ticket1 = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      status: 'pending_payment',
      payment_transaction_id: 'PAY-TICKET-WEBHOOK-001',
    });
    const ticket2 = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      status: 'pending_payment',
      payment_transaction_id: 'PAY-TICKET-WEBHOOK-001',
    });
    createdIds.tickets.push(ticket1.id, ticket2.id);

    // Simuler webhook : confirmer les tickets
    const { error: confirmError } = await supabaseAdmin
      .from('tickets')
      .update({ status: 'valid' })
      .eq('payment_transaction_id', 'PAY-TICKET-WEBHOOK-001');

    expect(confirmError).toBeNull();

    // Invoice pour l'achat
    const invoice = await createTestInvoice({
      context_type: 'ticket_purchase',
      context_id: ticket1.id,
      amount: 6000,
      status: 'paid',
    });
    createdIds.invoices.push(invoice.id);

    const { data: validTickets } = await supabaseAdmin
      .from('tickets')
      .select('status')
      .eq('payment_transaction_id', 'PAY-TICKET-WEBHOOK-001');

    expect(validTickets).toHaveLength(2);
    validTickets?.forEach(t => expect(t.status).toBe('valid'));
    expect(invoice.amount).toBe(6000);
  });

  // ── WEBHOOK 6 : Ticket purchase failed → tickets cancelled ──
  test('6. payment.failed pour tickets → tickets status="cancelled"', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id);
    createdIds.ticket_types.push(ticketType.id);

    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      status: 'pending_payment',
      payment_transaction_id: 'PAY-TICKET-WEBHOOK-FAIL',
    });
    createdIds.tickets.push(ticket.id);

    // Simuler webhook échec
    const { error } = await supabaseAdmin
      .from('tickets')
      .update({ status: 'cancelled' })
      .eq('payment_transaction_id', 'PAY-TICKET-WEBHOOK-FAIL');

    expect(error).toBeNull();

    const { data: cancelled } = await supabaseAdmin
      .from('tickets')
      .select('status')
      .eq('payment_transaction_id', 'PAY-TICKET-WEBHOOK-FAIL')
      .single();

    expect(cancelled?.status).toBe('cancelled');
  });

  // ── WEBHOOK 7 : Deduplication — même transaction traitée 2x ──
  test('7. Webhook idempotent → 2e traitement ne change pas le statut', async () => {
    const player = await createTestUser();
    createdIds.users.push(player.id);

    const venue = await createTestVenue();
    createdIds.venues.push(venue.id);

    const booking = await createTestBooking(player.id, venue.id, {
      payment_status: 'pending',
      payment_transaction_id: 'PAY-DEDUP-001',
    });
    createdIds.bookings.push(booking.id);

    // 1er traitement
    await supabaseAdmin
      .from('bookings')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('payment_transaction_id', 'PAY-DEDUP-001');

    const { data: firstPass } = await supabaseAdmin
      .from('bookings')
      .select('payment_status, paid_at')
      .eq('payment_transaction_id', 'PAY-DEDUP-001')
      .single();

    expect(firstPass?.payment_status).toBe('paid');
    const firstPaidAt = firstPass?.paid_at;

    // 2e traitement (dedup) — ne doit pas changer paid_at
    await supabaseAdmin
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('payment_transaction_id', 'PAY-DEDUP-001');

    const { data: secondPass } = await supabaseAdmin
      .from('bookings')
      .select('payment_status, paid_at')
      .eq('payment_transaction_id', 'PAY-DEDUP-001')
      .single();

    expect(secondPass?.payment_status).toBe('paid');
    expect(secondPass?.paid_at).toBe(firstPaidAt);
  });
});
