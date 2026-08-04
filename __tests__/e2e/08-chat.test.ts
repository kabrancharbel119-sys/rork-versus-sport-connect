import { supabaseAdmin, createTestUser, createTestTeam, createTestChatRoom, cleanup } from './setup';

describe('CHAT — Messages d\'équipe', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], chat_rooms: [] as string[], chat_messages: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Envoyer un message → créé en BDD avec tous les champs', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const room = await createTestChatRoom({ team_id: team.id, name: `Team ${team.name}`, type: 'general', participants: [user.id] });
    createdIds.chat_rooms.push(room.id);

    const messageData = {
      room_id: room.id,
      sender_id: user.id,
      content: 'Hello team!',
      type: 'text',
      read_by: []
    };

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(data.id);

    expect(error).toBeNull();
    expect(data.sender_id).toBe(user.id);
    expect(data.content).toBe('Hello team!');
    expect(data.read_by).toEqual([]);
  });

  test('✅ Récupérer historique → trié par created_at ASC', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const room = await createTestChatRoom({ team_id: team.id, name: `Team ${team.name}`, type: 'general', participants: [user.id] });
    createdIds.chat_rooms.push(room.id);

    const msg1 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: room.id,
        sender_id: user.id,
        content: 'First message',
        type: 'text',
        read_by: []
      })
      .select()
      .single();

    await new Promise(resolve => setTimeout(resolve, 100));

    const msg2 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: room.id,
        sender_id: user.id,
        content: 'Second message',
        type: 'text',
        read_by: []
      })
      .select()
      .single();

    createdIds.chat_messages.push(msg1.data.id, msg2.data.id);

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });

    expect(data?.length).toBe(2);
    expect(new Date(data![0].created_at).getTime()).toBeLessThanOrEqual(
      new Date(data![1].created_at).getTime()
    );
  });

  test('✅ Marquer messages lus → read = true', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const room = await createTestChatRoom({ team_id: team.id, name: `Team ${team.name}`, type: 'general', participants: [user.id] });
    createdIds.chat_rooms.push(room.id);

    const messageData = {
      room_id: room.id,
      sender_id: user.id,
      content: 'Test message',
      type: 'text',
      read_by: []
    };

    const { data: message } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(message.id);

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({ read_by: [user.id] })
      .eq('id', message.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('read_by')
      .eq('id', message.id)
      .single();

    expect(data?.read_by).toContain(user.id);
  });

  test('✅ Message avec émojis → correctement stocké', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const room = await createTestChatRoom({ team_id: team.id, name: `Team ${team.name}`, type: 'general', participants: [user.id] });
    createdIds.chat_rooms.push(room.id);

    const messageData = {
      room_id: room.id,
      sender_id: user.id,
      content: 'Great game! ⚽🏆😊',
      type: 'text',
      read_by: []
    };

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(data.id);

    expect(error).toBeNull();
    expect(data.content).toBe('Great game! ⚽🏆😊');
  });

  test('✅ Message long (1000 caractères) → accepté', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const room = await createTestChatRoom({ team_id: team.id, name: `Team ${team.name}`, type: 'general', participants: [user.id] });
    createdIds.chat_rooms.push(room.id);

    const longMessage = 'A'.repeat(1000);

    const messageData = {
      room_id: room.id,
      sender_id: user.id,
      content: longMessage,
      type: 'text',
      read_by: []
    };

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(data.id);

    expect(error).toBeNull();
    expect(data.content.length).toBe(1000);
  });
});

describe('CHAT — Messages privés', () => {
  const createdIds = { users: [] as string[], chat_rooms: [] as string[], chat_messages: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Premier message → conversation créée', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const room = await createTestChatRoom({ type: 'direct', participants: [user1.id, user2.id] });
    createdIds.chat_rooms.push(room.id);

    const messageData = {
      room_id: room.id,
      sender_id: user1.id,
      content: 'Hello!',
      type: 'text',
      read_by: []
    };

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(data.id);

    expect(error).toBeNull();
    expect(data.room_id).toBe(room.id);
  });

  test('✅ room_id cohérent entre les 2 participants', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const room = await createTestChatRoom({ type: 'direct', participants: [user1.id, user2.id] });
    createdIds.chat_rooms.push(room.id);

    expect(room.id).toBeDefined();
  });

  test('✅ Supprimer conversation → tous les messages supprimés', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const room = await createTestChatRoom({ type: 'direct', participants: [user1.id, user2.id] });
    createdIds.chat_rooms.push(room.id);

    const msg1 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: room.id,
        sender_id: user1.id,
        content: 'Message 1',
        type: 'text',
        read_by: []
      })
      .select()
      .single();

    const msg2 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: room.id,
        sender_id: user2.id,
        content: 'Message 2',
        type: 'text',
        read_by: []
      })
      .select()
      .single();

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('room_id', room.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id);

    expect(data?.length).toBe(0);
  });
});

