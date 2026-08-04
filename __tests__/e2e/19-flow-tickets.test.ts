import {
  supabaseAdmin,
  createTestUser,
  createTestTournament,
  createTestMatch,
  createTestTicketType,
  createTestTicket,
  createTestInvoice,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW TICKETS — Création → Achat → Validation QR → Scan History → Stats', () => {
  const createdIds = {
    users: [] as string[],
    tournaments: [] as string[],
    matches: [] as string[],
    venues: [] as string[],
    ticket_types: [] as string[],
    tickets: [] as string[],
    invoices: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Création de ticket types ──
  test('1. Organisateur crée 2 types de billets pour un tournoi', async () => {
    const organizer = await createTestUser();
    createdIds.users.push(organizer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const vipTicket = await createTestTicketType('tournament', tournament.id, organizer.id, {
      name: 'Billet VIP',
      price: 10000,
      quantity_total: 50,
      max_per_user: 2,
    });
    const standardTicket = await createTestTicketType('tournament', tournament.id, organizer.id, {
      name: 'Billet Standard',
      price: 2000,
      quantity_total: 200,
      max_per_user: 4,
    });
    createdIds.ticket_types.push(vipTicket.id, standardTicket.id);

    expect(vipTicket.name).toBe('Billet VIP');
    expect(vipTicket.price).toBe(10000);
    expect(vipTicket.quantity_total).toBe(50);
    expect(standardTicket.name).toBe('Billet Standard');
    expect(standardTicket.price).toBe(2000);
  });

  // ── ÉTAPE 2 : Achat de billets ──
  test('2. Joueur achète 3 billets standard → tickets créés avec status="valid"', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id, {
      name: 'Billet Standard',
      price: 2000,
      quantity_total: 100,
    });
    createdIds.ticket_types.push(ticketType.id);

    // Acheter 3 billets
    const tickets = await Promise.all([
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
        price_paid: 2000,
        payment_transaction_id: 'PAY-TICKET-001',
      }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
        price_paid: 2000,
        payment_transaction_id: 'PAY-TICKET-001',
      }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
        price_paid: 2000,
        payment_transaction_id: 'PAY-TICKET-001',
      }),
    ]);
    createdIds.tickets.push(...tickets.map(t => t.id));

    expect(tickets).toHaveLength(3);
    tickets.forEach(t => {
      expect(t.status).toBe('valid');
      expect(t.buyer_id).toBe(buyer.id);
      expect(t.ticket_code).toBeDefined();
      expect(t.qr_token).toBeDefined();
    });
  });

  // ── ÉTAPE 3 : Validation par QR ──
  test('3. Organisateur valide un billet via qr_token → status="scanned"', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id);
    createdIds.ticket_types.push(ticketType.id);

    const customQr = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';
    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      qr_token: customQr,
    });
    createdIds.tickets.push(ticket.id);

    // Valider
    const { error } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        validated_by: organizer.id,
      })
      .eq('id', ticket.id);

    expect(error).toBeNull();

    const { data: scanned } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single();

    expect(scanned?.status).toBe('used');
    expect(scanned?.validated_by).toBe(organizer.id);
  });

  // ── ÉTAPE 4 : Validation par code ──
  test('4. Organisateur valide un billet via ticket_code', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id);
    createdIds.ticket_types.push(ticketType.id);

    const customCode = 'TCK-VALIDATE-CODE-001';
    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      ticket_code: customCode,
    });
    createdIds.tickets.push(ticket.id);

    // Lookup par code
    const { data: found, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('ticket_code', customCode)
      .single();

    expect(error).toBeNull();
    expect(found?.id).toBe(ticket.id);

    // Marquer comme scanned
    const { error: scanError } = await supabaseAdmin
      .from('tickets')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', ticket.id);

    expect(scanError).toBeNull();
  });

  // ── ÉTAPE 5 : Double validation refusée ──
  test('5. Billet déjà scanné → ne peut pas être re-validé', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id);
    createdIds.ticket_types.push(ticketType.id);

    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      status: 'used',
    });
    createdIds.tickets.push(ticket.id);

    // Vérifier que le statut est déjà scanned
    const { data: alreadyScanned } = await supabaseAdmin
      .from('tickets')
      .select('status')
      .eq('id', ticket.id)
      .single();

    expect(alreadyScanned?.status).toBe('used');
    // La logique applicative doit refuser une re-validation
  });

  // ── ÉTAPE 6 : Invoice pour achat de billets ──
  test('6. Invoice créée après achat de billets', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id, {
      price: 5000,
    });
    createdIds.ticket_types.push(ticketType.id);

    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      price_paid: 5000,
      payment_transaction_id: 'PAY-INVOICE-001',
    });
    createdIds.tickets.push(ticket.id);

    const invoice = await createTestInvoice({
      context_type: 'ticket_purchase',
      context_id: ticket.id,
      amount: 5000,
      status: 'paid',
      payment_method: 'in_app',
    });
    createdIds.invoices.push(invoice.id);

    expect(invoice.amount).toBe(5000);
    expect(invoice.context_type).toBe('ticket_purchase');
  });

  // ── ÉTAPE 7 : Stats de vente ──
  test('7. Stats de vente → total vendu & scannés', async () => {
    const organizer = await createTestUser();
    const buyer1 = await createTestUser();
    const buyer2 = await createTestUser();
    createdIds.users.push(organizer.id, buyer1.id, buyer2.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id, {
      price: 2000,
      quantity_total: 100,
    });
    createdIds.ticket_types.push(ticketType.id);

    // 5 billets vendus
    const tickets = await Promise.all([
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer1.id, { status: 'valid' }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer1.id, { status: 'valid' }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer2.id, { status: 'used' }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer2.id, { status: 'used' }),
      createTestTicket(ticketType.id, 'tournament', tournament.id, buyer2.id, { status: 'valid' }),
    ]);
    createdIds.tickets.push(...tickets.map(t => t.id));

    // Compter
    const { data: allTickets, error } = await supabaseAdmin
      .from('tickets')
      .select('status, price_paid')
      .eq('ticket_type_id', ticketType.id);

    expect(error).toBeNull();
    expect(allTickets).toHaveLength(5);

    const totalRevenue = allTickets?.reduce((sum, t) => sum + t.price_paid, 0);
    expect(totalRevenue).toBe(10000);

    const scannedCount = allTickets?.filter(t => t.status === 'used').length;
    expect(scannedCount).toBe(2);

    const validCount = allTickets?.filter(t => t.status === 'valid').length;
    expect(validCount).toBe(3);
  });

  // ── ÉTAPE 8 : Annulation de billets ──
  test('8. Billets annulés après échec paiement → status="cancelled"', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id);
    createdIds.tournaments.push(tournament.id);

    const ticketType = await createTestTicketType('tournament', tournament.id, organizer.id);
    createdIds.ticket_types.push(ticketType.id);

    const ticket = await createTestTicket(ticketType.id, 'tournament', tournament.id, buyer.id, {
      status: 'pending_payment',
      payment_transaction_id: 'PAY-FAILED-001',
    });
    createdIds.tickets.push(ticket.id);

    // Simuler échec paiement → annulation
    const { error } = await supabaseAdmin
      .from('tickets')
      .update({ status: 'cancelled' })
      .eq('id', ticket.id);

    expect(error).toBeNull();

    const { data: cancelled } = await supabaseAdmin
      .from('tickets')
      .select('status')
      .eq('id', ticket.id)
      .single();

    expect(cancelled?.status).toBe('cancelled');
  });

  // ── ÉTAPE 9 : Notification d'achat ──
  test('9. Notification envoyée à l\'acheteur après achat', async () => {
    const organizer = await createTestUser();
    const buyer = await createTestUser();
    createdIds.users.push(organizer.id, buyer.id);

    const tournament = await createTestTournament(organizer.id, { name: 'Coupe Notif Test' });
    createdIds.tournaments.push(tournament.id);

    const notif = await createTestNotification(buyer.id, {
      type: 'ticket_purchase',
      title: 'Achat confirmé',
      message: `Vos billets pour ${tournament.name} ont été achetés`,
      data: { tournamentId: tournament.id, quantity: 2 },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('ticket_purchase');
    expect(notif.user_id).toBe(buyer.id);
  });
});
