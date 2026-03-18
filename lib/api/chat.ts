import { supabase } from '@/lib/supabase';
import type { ChatRoom, ChatMessage, ChatRequest } from '@/types';

export interface ChatRoomRow {
  id: string;
  team_id: string | null;
  name: string;
  type: string;
  participants?: string[];
  participant_ids?: string[];
  last_message_id: string | null;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  room_id: string | null;
  sender_id: string | null;
  content: string;
  type: string;
  mentions: string[];
  read_by: string[];
  created_at: string;
}

const getRoomParticipants = (row: Partial<ChatRoomRow>) =>
  (row.participants as string[] | undefined) ||
  (row.participant_ids as string[] | undefined) ||
  [];

export const mapChatRoomRowToRoom = (row: ChatRoomRow): ChatRoom => ({
  id: row.id,
  teamId: row.team_id || undefined,
  name: row.name,
  type: row.type as ChatRoom['type'],
  participants: getRoomParticipants(row),
  unreadCount: 0,
  createdAt: new Date(row.created_at),
});

const isMissingParticipantsColumnError = (error: any) => {
  const message = error?.message || '';
  const code = error?.code || '';
  return code === 'PGRST204' && String(message).toLowerCase().includes('participants');
};

const isMissingParticipantIdsColumnError = (error: any) => {
  const message = error?.message || '';
  const code = error?.code || '';
  return code === 'PGRST204' && String(message).toLowerCase().includes('participant_ids');
};

export const mapChatMessageRowToMessage = (row: ChatMessageRow): ChatMessage => ({
  id: row.id,
  roomId: row.room_id || '',
  senderId: row.sender_id || '',
  content: row.content,
  type: row.type as ChatMessage['type'],
  mentions: (row.mentions as string[]) || [],
  readBy: (row.read_by as string[]) || [],
  createdAt: new Date(row.created_at),
});

export const chatApi = {
  async getRooms(userId: string) {
    console.log('[ChatAPI] Getting rooms for user:', userId);
    const { data, error } = await (supabase
      .from('chat_rooms')
      .select(`
        *,
        chat_messages(
          id,
          content,
          type,
          sender_id,
          created_at,
          read_by
        )
      `)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    
    const rows = (data || []) as any[];
    const hasParticipantData = rows.some(r => getRoomParticipants(r).length > 0);

    const rooms = rows
      .filter(r => !hasParticipantData || getRoomParticipants(r).includes(userId))
      .map(row => {
        const room = mapChatRoomRowToRoom(row);
        // Get the latest message if available
        if (row.chat_messages && row.chat_messages.length > 0) {
          const latestMessage = row.chat_messages
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          
          room.lastMessage = {
            id: latestMessage.id,
            roomId: room.id,
            senderId: latestMessage.sender_id,
            content: latestMessage.content,
            type: latestMessage.type || 'text',
            createdAt: new Date(latestMessage.created_at),
            readBy: latestMessage.read_by || [],
          };
        }
        return room;
      });
    
    return rooms;
  },

  async getRoom(roomId: string, userId: string) {
    console.log('[ChatAPI] Getting room:', roomId);
    const { data, error } = await (supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single() as any);
    
    if (error) throw error;
    if (!data) throw new Error('Salon non trouvé');
    
    const row = data as ChatRoomRow;
    const participants = getRoomParticipants(row);
    if (participants.length > 0 && !participants.includes(userId)) {
      throw new Error('Non autorisé');
    }
    
    return mapChatRoomRowToRoom(row);
  },

  async createRoom(userId: string, roomData: {
    teamId?: string;
    name: string;
    type: 'general' | 'match' | 'strategy' | 'direct';
    participants: string[];
  }) {
    console.log('[ChatAPI] Creating room:', roomData.name);

    const participantIds = [...new Set([userId, ...roomData.participants])];

    if (roomData.type === 'direct') {
      const { data: directRooms } = await (supabase
        .from('chat_rooms')
        .select('*')
        .eq('type', 'direct') as any);

      const existingDirect = ((directRooms || []) as ChatRoomRow[]).find((row) => {
        const rowParticipants = getRoomParticipants(row);
        return (
          rowParticipants.length === 2 &&
          participantIds.length === 2 &&
          rowParticipants.includes(participantIds[0]) &&
          rowParticipants.includes(participantIds[1])
        );
      });

      if (existingDirect) {
        return mapChatRoomRowToRoom(existingDirect);
      }
    } else {
      const q = supabase.from('chat_rooms').select('*').eq('name', roomData.name);
      const query = roomData.teamId != null ? q.eq('team_id', roomData.teamId) : q.is('team_id', null);
      const { data: existing } = await (query.maybeSingle() as any);

      if (existing) {
        return mapChatRoomRowToRoom(existing as ChatRoomRow);
      }
    }

    const { data, error } = await (supabase
      .from('chat_rooms')
      .insert({
        team_id: roomData.teamId || null,
        name: roomData.name,
        type: roomData.type,
        participants: participantIds,
      } as any)
      .select()
      .single() as any);

    if (error && isMissingParticipantsColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await (supabase
        .from('chat_rooms')
        .insert({
          team_id: roomData.teamId || null,
          name: roomData.name,
          type: roomData.type,
          participant_ids: participantIds,
        } as any)
        .select()
        .single() as any);

      if (fallbackError) throw fallbackError;
      return mapChatRoomRowToRoom(fallbackData as ChatRoomRow);
    }

    if (error && isMissingParticipantIdsColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await (supabase
        .from('chat_rooms')
        .insert({
          team_id: roomData.teamId || null,
          name: roomData.name,
          type: roomData.type,
        } as any)
        .select()
        .single() as any);

      if (fallbackError) throw fallbackError;
      return mapChatRoomRowToRoom(fallbackData as ChatRoomRow);
    }

    if (error) throw error;
    return mapChatRoomRowToRoom(data as ChatRoomRow);
  },

  async createTeamChats(userId: string, teamId: string, teamName: string, members: string[]) {
    console.log('[ChatAPI] Creating team chats for:', teamId);
    
    const { data: existing } = await (supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', teamId) as any);
    
    if (existing && existing.length > 0) {
      return (existing as ChatRoomRow[]).map(row => mapChatRoomRowToRoom(row));
    }

    const { data: rooms, error } = await (supabase
      .from('chat_rooms')
      .insert([
        {
          team_id: teamId,
          name: `${teamName} - Général`,
          type: 'general',
          participants: members,
        },
        {
          team_id: teamId,
          name: `${teamName} - Stratégie`,
          type: 'strategy',
          participants: members,
        }
      ] as any)
      .select() as any);

    let roomsData = rooms as ChatRoomRow[];

    if (error && isMissingParticipantsColumnError(error)) {
      const { data: fallbackRooms, error: fallbackError } = await (supabase
        .from('chat_rooms')
        .insert([
          {
            team_id: teamId,
            name: `${teamName} - Général`,
            type: 'general',
            participant_ids: members,
          },
          {
            team_id: teamId,
            name: `${teamName} - Stratégie`,
            type: 'strategy',
            participant_ids: members,
          }
        ] as any)
        .select() as any);

      if (fallbackError) throw fallbackError;
      roomsData = (fallbackRooms || []) as ChatRoomRow[];
    } else if (error && isMissingParticipantIdsColumnError(error)) {
      const { data: fallbackRooms, error: fallbackError } = await (supabase
        .from('chat_rooms')
        .insert([
          {
            team_id: teamId,
            name: `${teamName} - Général`,
            type: 'general',
          },
          {
            team_id: teamId,
            name: `${teamName} - Stratégie`,
            type: 'strategy',
          }
        ] as any)
        .select() as any);

      if (fallbackError) throw fallbackError;
      roomsData = (fallbackRooms || []) as ChatRoomRow[];
    } else if (error) {
      throw error;
    }

    if (roomsData && roomsData.length > 0) {
      await (supabase.from('chat_messages').insert({
        room_id: roomsData[0].id,
        sender_id: 'system',
        content: `Bienvenue dans le chat de ${teamName}! 🎉`,
        type: 'system',
        read_by: [],
      } as any) as any);
    }

    return (roomsData || []).map(row => mapChatRoomRowToRoom(row));
  },

  async getMessages(roomId: string, userId: string, limit: number = 50, before?: string) {
    console.log('[ChatAPI] Getting messages for room:', roomId);
    
    const room = await this.getRoom(roomId, userId);
    if (!room) throw new Error('Salon non trouvé');

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await (query as any);
    if (error) throw error;

    return ((data || []) as ChatMessageRow[]).map(row => mapChatMessageRowToMessage(row));
  },

  async sendMessage(roomId: string, userId: string, content: string, type: 'text' | 'image' | 'video' = 'text') {
    console.log('[ChatAPI] Sending message to room:', roomId);
    
    const { data: room } = await (supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single() as any);
    
    if (!room) throw new Error('Salon non trouvé');
    
    const roomData = room as ChatRoomRow;
    const participants = getRoomParticipants(roomData);
    if (participants.length > 0 && !participants.includes(userId)) {
      throw new Error('Non autorisé');
    }

    const { data: message, error } = await (supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content,
        type,
        read_by: [userId],
      } as any)
      .select()
      .single() as any);
    
    if (error) throw error;

    const messageData = message as ChatMessageRow;
    await ((supabase.from('chat_rooms') as any)
      .update({ last_message_id: messageData.id })
      .eq('id', roomId));

    const { data: user } = await (supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single() as any);

    for (const participantId of participants.filter(p => p !== userId)) {
      await (supabase.from('notifications').insert({
        user_id: participantId,
        type: 'chat',
        title: roomData.name,
        message: `${user?.username || 'Quelqu\'un'}: ${content.slice(0, 50)}`,
        data: { roomId: roomData.id }
      } as any) as any);
    }

    return mapChatMessageRowToMessage(messageData);
  },

  async deleteMessage(messageId: string, userId: string) {
    const { data: msg, error: fetchErr } = await (supabase
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .single() as any);
    if (fetchErr || !msg) throw new Error('Message non trouvé');
    if ((msg as { sender_id: string }).sender_id !== userId) throw new Error('Vous ne pouvez supprimer que vos propres messages');
    const { error } = await (supabase.from('chat_messages').delete().eq('id', messageId) as any);
    if (error) throw error;
  },

  async markAsRead(roomId: string, userId: string) {
    console.log('[ChatAPI] Marking messages as read in room:', roomId);
    
    const { data: messages } = await (supabase
      .from('chat_messages')
      .select('id, read_by')
      .eq('room_id', roomId) as any);

    for (const msg of (messages || []) as { id: string; read_by: string[] }[]) {
      const readBy = msg.read_by || [];
      if (!readBy.includes(userId)) {
        await ((supabase.from('chat_messages') as any)
          .update({ read_by: [...readBy, userId] })
          .eq('id', msg.id));
      }
    }

    return { success: true };
  },

  async getTeamRooms(teamId: string) {
    console.log('[ChatAPI] Getting rooms for team:', teamId);
    const { data, error } = await (supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', teamId) as any);
    
    if (error) throw error;
    return ((data || []) as ChatRoomRow[]).map(row => mapChatRoomRowToRoom(row));
  },

  subscribeToMessages(roomId: string, callback: (message: ChatMessage) => void) {
    console.log('[ChatAPI] Subscribing to messages in room:', roomId);
    
    return supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        callback(mapChatMessageRowToMessage(payload.new as ChatMessageRow));
      })
      .subscribe();
  },

  // Chat Requests (for direct messages)
  async createChatRequest(requesterId: string, recipientId: string, message?: string) {
    console.log('[ChatAPI] Creating chat request from', requesterId, 'to', recipientId);
    
    // Check if request already exists
    const { data: existing } = await (supabase
      .from('chat_requests')
      .select('*')
      .eq('requester_id', requesterId)
      .eq('recipient_id', recipientId)
      .single() as any);
    
    if (existing && existing.status === 'pending') {
      throw new Error('Demande déjà envoyée');
    }
    
    const { data, error } = await (supabase
      .from('chat_requests')
      .insert({
        requester_id: requesterId,
        recipient_id: recipientId,
        status: 'pending',
        message: message || null,
      } as any)
      .select()
      .single() as any);
    
    if (error) throw error;
    return data;
  },

  async getChatRequests(userId: string) {
    console.log('[ChatAPI] Getting chat requests for user:', userId);
    const { data, error } = await (supabase
      .from('chat_requests')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false }) as any);
    
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      requesterId: row.requester_id,
      recipientId: row.recipient_id,
      status: row.status,
      message: row.message,
      createdAt: new Date(row.created_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    }));
  },

  async respondToChatRequest(requestId: string, recipientId: string, action: 'accept' | 'reject') {
    console.log('[ChatAPI] Responding to chat request:', requestId, action);
    
    const { data: request, error: fetchError } = await (supabase
      .from('chat_requests')
      .select('*')
      .eq('id', requestId)
      .single() as any);
    
    if (fetchError || !request) throw new Error('Demande non trouvée');
    if (request.recipient_id !== recipientId) throw new Error('Non autorisé');
    if (request.status !== 'pending') throw new Error('Demande déjà traitée');
    
    const status = action === 'accept' ? 'accepted' : 'rejected';
    const updatePayload = {
      status,
      // responded_at n'existe pas dans la DB, on ne l'envoie pas
    };

    console.log('[ChatAPI] Updating request in DB:', requestId, 'payload:', updatePayload);

    const { data, error } = await supabase
      .from('chat_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select()
      .single();

    console.log('[ChatAPI] Update result - data:', data, 'error:', error);

    if (error) {
      console.error('[ChatAPI] Supabase update error:', error.message, error);
      throw new Error(`Failed to update chat request: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after update');
    }

    console.log('[ChatAPI] Request successfully updated:', requestId, 'new status:', status);
    
    let directRoom: ChatRoom | null = null;

    // If accepted, create (or reuse) direct chat room
    if (action === 'accept') {
      directRoom = await this.createRoom(recipientId, {
        name: 'Conversation directe',
        type: 'direct',
        participants: [request.requester_id, request.recipient_id],
      });
    }

    return {
      request: data,
      room: directRoom || undefined,
      roomId: directRoom?.id,
    };
  },
};
