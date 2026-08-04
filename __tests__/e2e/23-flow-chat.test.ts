import {
  supabaseAdmin,
  createTestUser,
  createTestChatRoom,
  createTestChatRequest,
  createTestChatMessage,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW CHAT — Request → Accept → Messages → Read → Mentions', () => {
  const createdIds = {
    users: [] as string[],
    chat_rooms: [] as string[],
    chat_requests: [] as string[],
    chat_messages: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Chat request ──
  test('1. User A envoie une demande de chat à User B → request créée', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const request = await createTestChatRequest(userA.id, userB.id, {
      message: 'Salut, on peut discuter du match ?',
    });
    createdIds.chat_requests.push(request.id);

    expect(request.status).toBe('pending');
    expect(request.requester_id).toBe(userA.id);
    expect(request.recipient_id).toBe(userB.id);
  });

  // ── ÉTAPE 2 : Accepter la demande ──
  test('2. User B accepte → request status="accepted" + chat_room créée', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const request = await createTestChatRequest(userA.id, userB.id);
    createdIds.chat_requests.push(request.id);

    // Accepter
    const { error: acceptError } = await supabaseAdmin
      .from('chat_requests')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    expect(acceptError).toBeNull();

    // Créer chat room
    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const { data: accepted } = await supabaseAdmin
      .from('chat_requests')
      .select('status')
      .eq('id', request.id)
      .single();

    expect(accepted?.status).toBe('accepted');
    expect(room.type).toBe('direct');
    expect(room.participants).toHaveLength(2);
  });

  // ── ÉTAPE 3 : Envoyer un message ──
  test('3. User A envoie un message → chat_message créé', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const msg = await createTestChatMessage(room.id, userA.id, {
      content: 'Hello !',
    });
    createdIds.chat_messages.push(msg.id);

    expect(msg.room_id).toBe(room.id);
    expect(msg.sender_id).toBe(userA.id);
    expect(msg.content).toBe('Hello !');
    expect(msg.type).toBe('text');
  });

  // ── ÉTAPE 4 : Reply ──
  test('4. User B répond → message créé dans la même room', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const msg1 = await createTestChatMessage(room.id, userA.id, { content: 'Salut' });
    const msg2 = await createTestChatMessage(room.id, userB.id, { content: 'Hey, ça va ?' });
    createdIds.chat_messages.push(msg1.id, msg2.id);

    const { data: messages } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });

    expect(messages).toHaveLength(2);
    expect(messages?.[0].sender_id).toBe(userA.id);
    expect(messages?.[1].sender_id).toBe(userB.id);
  });

  // ── ÉTAPE 5 : Read status ──
  test('5. User B lit les messages → read_by mis à jour', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const msg = await createTestChatMessage(room.id, userA.id, {
      content: 'Message non lu',
      read_by: [],
    });
    createdIds.chat_messages.push(msg.id);

    // Marquer comme lu par userB
    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({ read_by: [{ userId: userB.id, readAt: new Date().toISOString() }] })
      .eq('id', msg.id);

    expect(error).toBeNull();

    const { data: readMsg } = await supabaseAdmin
      .from('chat_messages')
      .select('read_by')
      .eq('id', msg.id)
      .single();

    expect(readMsg?.read_by).toHaveLength(1);
    expect(readMsg?.read_by[0].userId).toBe(userB.id);
  });

  // ── ÉTAPE 6 : Mention dans un message ──
  test('6. Message avec mention → notification envoyée', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const msg = await createTestChatMessage(room.id, userA.id, {
      content: `@${userB.username} tu es là ?`,
      mentions: [{ userId: userB.id, username: userB.username }],
    });
    createdIds.chat_messages.push(msg.id);

    // Notification de mention
    const notif = await createTestNotification(userB.id, {
      type: 'chat_mention',
      title: 'Mention dans un message',
      message: `${userA.username} vous a mentionné`,
      data: { roomId: room.id, messageId: msg.id },
    });
    createdIds.notifications.push(notif.id);

    expect(msg.mentions).toHaveLength(1);
    expect(msg.mentions[0].userId).toBe(userB.id);
    expect(notif.type).toBe('chat_mention');
  });

  // ── ÉTAPE 7 : Team chat room ──
  test('7. Team chat room → type="team" avec participants', async () => {
    const captain = await createTestUser();
    const m1 = await createTestUser();
    const m2 = await createTestUser();
    createdIds.users.push(captain.id, m1.id, m2.id);

    const room = await createTestChatRoom({
      name: 'Chat Team Test',
      type: 'team',
      participants: [
        { id: captain.id, username: captain.username },
        { id: m1.id, username: m1.username },
        { id: m2.id, username: m2.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    expect(room.type).toBe('team');
    expect(room.participants).toHaveLength(3);

    // Envoyer un message dans le team chat
    const msg = await createTestChatMessage(room.id, captain.id, {
      content: 'Entraînement demain à 18h',
    });
    createdIds.chat_messages.push(msg.id);

    expect(msg.content).toBe('Entraînement demain à 18h');
  });

  // ── ÉTAPE 8 : Rejeter une demande de chat ──
  test('8. User B rejette la demande → status="rejected"', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const request = await createTestChatRequest(userA.id, userB.id);
    createdIds.chat_requests.push(request.id);

    const { error } = await supabaseAdmin
      .from('chat_requests')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    expect(error).toBeNull();

    const { data: rejected } = await supabaseAdmin
      .from('chat_requests')
      .select('status')
      .eq('id', request.id)
      .single();

    expect(rejected?.status).toBe('rejected');
  });

  // ── ÉTAPE 9 : Notification de nouveau message ──
  test('9. User B reçoit notification de nouveau message', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    createdIds.users.push(userA.id, userB.id);

    const room = await createTestChatRoom({
      type: 'direct',
      participants: [
        { id: userA.id, username: userA.username },
        { id: userB.id, username: userB.username },
      ],
    });
    createdIds.chat_rooms.push(room.id);

    const msg = await createTestChatMessage(room.id, userA.id, {
      content: 'Nouveau message !',
    });
    createdIds.chat_messages.push(msg.id);

    const notif = await createTestNotification(userB.id, {
      type: 'new_message',
      title: 'Nouveau message',
      message: `${userA.username} vous a envoyé un message`,
      data: { roomId: room.id, messageId: msg.id },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('new_message');
    expect(notif.user_id).toBe(userB.id);
  });
});
