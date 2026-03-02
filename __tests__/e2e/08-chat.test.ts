import { supabaseAdmin, createTestUser, createTestTeam, cleanup } from './setup';

describe('CHAT — Messages d\'équipe', () => {
  const createdIds = { users: [] as string[], teams: [] as string[], chat_messages: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Envoyer un message → créé en BDD avec tous les champs', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const messageData = {
      conversation_id: `team_${team.id}`,
      sender_id: user.id,
      content: 'Hello team!',
      read: false
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
    expect(data.read).toBe(false);
  });

  test('✅ Récupérer historique → trié par created_at ASC', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const conversationId = `team_${team.id}`;

    const msg1 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: 'First message',
        read: false
      })
      .select()
      .single();

    await new Promise(resolve => setTimeout(resolve, 100));

    const msg2 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: 'Second message',
        read: false
      })
      .select()
      .single();

    createdIds.chat_messages.push(msg1.data.id, msg2.data.id);

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
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

    const messageData = {
      conversation_id: `team_${team.id}`,
      sender_id: user.id,
      content: 'Test message',
      read: false
    };

    const { data: message } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(message.id);

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({ read: true })
      .eq('id', message.id);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('read')
      .eq('id', message.id)
      .single();

    expect(data?.read).toBe(true);
  });

  test('✅ Message avec émojis → correctement stocké', async () => {
    const user = await createTestUser();
    const team = await createTestTeam(user.id);
    createdIds.users.push(user.id);
    createdIds.teams.push(team.id);

    const messageData = {
      conversation_id: `team_${team.id}`,
      sender_id: user.id,
      content: 'Great game! ⚽🏆😊',
      read: false
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

    const longMessage = 'A'.repeat(1000);

    const messageData = {
      conversation_id: `team_${team.id}`,
      sender_id: user.id,
      content: longMessage,
      read: false
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
  const createdIds = { users: [] as string[], chat_messages: [] as string[] };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  test('✅ Premier message → conversation créée', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const conversationId = `dm_${[user1.id, user2.id].sort().join('_')}`;

    const messageData = {
      conversation_id: conversationId,
      sender_id: user1.id,
      content: 'Hello!',
      read: false
    };

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    createdIds.chat_messages.push(data.id);

    expect(error).toBeNull();
    expect(data.conversation_id).toBe(conversationId);
  });

  test('✅ conversation_id cohérent entre les 2 participants', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const conversationId1 = `dm_${[user1.id, user2.id].sort().join('_')}`;
    const conversationId2 = `dm_${[user2.id, user1.id].sort().join('_')}`;

    expect(conversationId1).toBe(conversationId2);
  });

  test('✅ Supprimer conversation → tous les messages supprimés', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    createdIds.users.push(user1.id, user2.id);

    const conversationId = `dm_${[user1.id, user2.id].sort().join('_')}`;

    const msg1 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user1.id,
        content: 'Message 1',
        read: false
      })
      .select()
      .single();

    const msg2 = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user2.id,
        content: 'Message 2',
        read: false
      })
      .select()
      .single();

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    expect(error).toBeNull();

    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId);

    expect(data?.length).toBe(0);
  });
});

