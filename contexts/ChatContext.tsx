import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ChatRoom, ChatMessage, ChatRequest } from '@/types';
import { mockChatRooms, mockMessages } from '@/mocks/data';
import { emitRealtimeEvent } from '@/lib/realtime';
import { chatApi } from '@/lib/api/chat';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const CHATS_STORAGE_KEY = 'vs_chats';
const MESSAGES_STORAGE_KEY = 'vs_messages';

export const [ChatProvider, useChat] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  const currentUserId = useMemo(() => authUser?.id ?? supabaseUserId, [authUser?.id, supabaseUserId]);

  useEffect(() => {
    if (authUser?.id && supabaseUserId && authUser.id !== supabaseUserId) {
      console.warn('[ChatContext] ⚠️ User ID mismatch!', {
        authUser: authUser.id,
        supabaseUser: supabaseUserId,
      });
    } else if (authUser?.id) {
      console.log('[ChatContext] ✅ User ID matched:', authUser.id);
    }
  }, [authUser?.id, supabaseUserId]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      const active = state === 'active';
      setIsPollingActive(active);
      console.log('[Chat] App state changed, polling:', active);
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  const chatsQuery = useQuery({
    queryKey: ['chats', currentUserId],
    queryFn: async () => {
      console.log('[Chat] Loading chats...');
      
      if (currentUserId) {
        try {
          const serverRooms = await chatApi.getRooms(currentUserId);
          if (serverRooms.length > 0) {
            await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(serverRooms));
            
            const allMessages: ChatMessage[] = [];
            for (const room of serverRooms) {
              const roomMessages = await chatApi.getMessages(room.id, currentUserId);
              allMessages.push(...roomMessages);
            }
            await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
            return { rooms: serverRooms, messages: allMessages };
          }
        } catch (e) {
          console.log('[Chat] Server fetch failed, using local storage');
        }
      }

      const [storedRooms, storedMessages] = await Promise.all([
        AsyncStorage.getItem(CHATS_STORAGE_KEY),
        AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
      ]);
      
      let rooms = mockChatRooms;
      let msgs = mockMessages;
      
      if (storedRooms) rooms = JSON.parse(storedRooms);
      else await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(mockChatRooms));
      
      if (storedMessages) msgs = JSON.parse(storedMessages);
      else await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(mockMessages));
      
      return { rooms, messages: msgs };
    },
    refetchInterval: isPollingActive ? 5000 : false,
    refetchIntervalInBackground: false,
    enabled: true,
  });

  useEffect(() => {
    if (chatsQuery.data) {
      setChatRooms(chatsQuery.data.rooms);
      setMessages(chatsQuery.data.messages);
    }
  }, [chatsQuery.data]);

  const saveRooms = useCallback(async (updated: ChatRoom[]) => {
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updated));
    setChatRooms(updated);
  }, []);

  const saveMessages = useCallback(async (updated: ChatMessage[]) => {
    await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updated));
    setMessages(updated);
  }, []);

  const createRoomMutation = useMutation({
    mutationFn: async ({ teamId, name, type, participants }: { teamId: string; name: string; type: 'general' | 'match' | 'strategy'; participants: string[] }) => {
      console.log('[Chat] Creating room:', name);
      
      const existingRoom = chatRooms.find(r => r.teamId === teamId && r.name === name);
      if (existingRoom) return existingRoom;

      if (currentUserId) {
        try {
          const room = await chatApi.createRoom(currentUserId, { teamId, name, type, participants });
          const updatedRooms = [...chatRooms, room];
          await saveRooms(updatedRooms);
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          emitRealtimeEvent('chat', 'create', { room });
          return room;
        } catch (e) {
          console.log('[Chat] Supabase error, using local');
        }
      }

      const newRoom: ChatRoom = {
        id: `chat-${Date.now()}`,
        teamId,
        name,
        type,
        unreadCount: 0,
        participants,
        createdAt: new Date(),
      };
      const updatedRooms = [...chatRooms, newRoom];
      await saveRooms(updatedRooms);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'create', { room: newRoom });
      return newRoom;
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ roomId, senderId, content, senderName, type }: { roomId: string; senderId: string; content: string; senderName?: string; type?: 'text' | 'image' | 'video' }) => {
      const messageType = type || 'text';
      console.log('[Chat] Sending message to room:', roomId, 'type:', messageType);

      if (currentUserId) {
        try {
          const message = await chatApi.sendMessage(roomId, senderId, content, messageType);
          const updatedMessages = [...messages, message];
          await saveMessages(updatedMessages);
          
          const roomIndex = chatRooms.findIndex(r => r.id === roomId);
          if (roomIndex !== -1) {
            const updatedRooms = [...chatRooms];
            updatedRooms[roomIndex] = {
              ...updatedRooms[roomIndex],
              lastMessage: message,
              unreadCount: updatedRooms[roomIndex].unreadCount + 1,
            };
            await saveRooms(updatedRooms);
          }
          
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          emitRealtimeEvent('chat', 'create', { message, roomId, senderName });
          return message;
        } catch (e) {
          console.log('[Chat] Supabase error, using local');
        }
      }

      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId,
        senderId,
        content,
        type: messageType,
        createdAt: new Date(),
        readBy: [senderId],
      };
      const updatedMessages = [...messages, newMessage];
      await saveMessages(updatedMessages);
      
      const roomIndex = chatRooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        const updatedRooms = [...chatRooms];
        updatedRooms[roomIndex] = {
          ...updatedRooms[roomIndex],
          lastMessage: newMessage,
          unreadCount: updatedRooms[roomIndex].unreadCount + 1,
        };
        await saveRooms(updatedRooms);
      }
      
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'create', { message: newMessage, roomId, senderName });
      console.log('[Chat] Message sent successfully');
      return newMessage;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (currentUserId) {
        try {
          await chatApi.markAsRead(roomId, userId);
        } catch (e) {
          console.log('[Chat] Supabase markAsRead failed');
        }
      }

      const updatedMessages = messages.map(msg => {
        if (msg.roomId === roomId && !msg.readBy.includes(userId)) {
          return { ...msg, readBy: [...msg.readBy, userId] };
        }
        return msg;
      });
      await saveMessages(updatedMessages);
      
      const roomIndex = chatRooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        const updatedRooms = [...chatRooms];
        updatedRooms[roomIndex] = { ...updatedRooms[roomIndex], unreadCount: 0 };
        await saveRooms(updatedRooms);
      }
      
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      console.log('[Chat] Deleting room:', roomId);
      const updatedRooms = chatRooms.filter(r => r.id !== roomId);
      const updatedMessages = messages.filter(m => m.roomId !== roomId);
      await Promise.all([saveRooms(updatedRooms), saveMessages(updatedMessages)]);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'delete', { roomId });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log('[Chat] Adding participant:', userId);
      const updatedRooms = chatRooms.map(r => {
        if (r.id === roomId && !r.participants.includes(userId)) {
          return { ...r, participants: [...r.participants, userId] };
        }
        return r;
      });
      await saveRooms(updatedRooms);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log('[Chat] Removing participant:', userId);
      const updatedRooms = chatRooms.map(r => {
        if (r.id === roomId) {
          return { ...r, participants: r.participants.filter(p => p !== userId) };
        }
        return r;
      });
      await saveRooms(updatedRooms);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ messageId, userId }: { messageId: string; userId: string }) => {
      if (!currentUserId) throw new Error('Non connecté');
      try {
        await chatApi.deleteMessage(messageId, userId);
      } catch (e) {
        const msg = messages.find(m => m.id === messageId);
        if (!msg || msg.senderId !== userId) throw e;
        const updatedMessages = messages.filter(m => m.id !== messageId);
        await saveMessages(updatedMessages);
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        return;
      }
      const updatedMessages = messages.filter(m => m.id !== messageId);
      await saveMessages(updatedMessages);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error) => {
      console.error('[ChatContext] deleteMessage error:', error);
    },
  });

  const createTeamChatsMutation = useMutation({
    mutationFn: async ({ teamId, teamName, members }: { teamId: string; teamName: string; members: string[] }) => {
      console.log('[Chat] Creating team chats for:', teamName);
      
      const existingTeamRooms = chatRooms.filter(r => r.teamId === teamId);
      if (existingTeamRooms.length > 0) return existingTeamRooms;

      if (currentUserId) {
        try {
          const rooms = await chatApi.createTeamChats(currentUserId, teamId, teamName, members);
          const updatedRooms = [...chatRooms, ...rooms];
          await saveRooms(updatedRooms);
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          emitRealtimeEvent('chat', 'create', { rooms });
          return rooms;
        } catch (e) {
          console.log('[Chat] Supabase error, using local');
        }
      }

      const generalRoom: ChatRoom = {
        id: `chat-${Date.now()}-general`,
        teamId,
        name: `${teamName} - Général`,
        type: 'general',
        unreadCount: 0,
        participants: members,
        createdAt: new Date(),
      };
      
      const strategyRoom: ChatRoom = {
        id: `chat-${Date.now()}-strategy`,
        teamId,
        name: `${teamName} - Stratégie`,
        type: 'strategy',
        unreadCount: 0,
        participants: members,
        createdAt: new Date(),
      };
      
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}-welcome`,
        roomId: generalRoom.id,
        senderId: 'system',
        content: `Bienvenue dans le chat de ${teamName} ! 🎉`,
        type: 'system',
        createdAt: new Date(),
        readBy: [],
      };
      
      const updatedRooms = [...chatRooms, generalRoom, strategyRoom];
      const updatedMessages = [...messages, welcomeMessage];
      await Promise.all([saveRooms(updatedRooms), saveMessages(updatedMessages)]);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'create', { rooms: [generalRoom, strategyRoom] });
      return [generalRoom, strategyRoom];
    },
  });

  const getRoomMessages = useCallback((roomId: string) => {
    return messages
      .filter(m => m.roomId === roomId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages]);

  const getTeamRooms = useCallback((teamId: string) => chatRooms.filter(r => r.teamId === teamId), [chatRooms]);
  const getTotalUnread = useCallback(() => chatRooms.reduce((sum, room) => sum + room.unreadCount, 0), [chatRooms]);
  const getUserRooms = useCallback((userId: string) => chatRooms.filter(r => r.participants.includes(userId)), [chatRooms]);

  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chats'] });
  }, [queryClient]);

  // Chat Requests
  const chatRequestsQuery = useQuery({
    queryKey: ['chatRequests', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      try {
        return await chatApi.getChatRequests(currentUserId);
      } catch (e) {
        console.log('[Chat] Failed to load chat requests');
        return [];
      }
    },
    enabled: !!currentUserId,
    refetchInterval: isPollingActive ? 10000 : false,
  });

  useEffect(() => {
    if (chatRequestsQuery.data) {
      setChatRequests(chatRequestsQuery.data);
    }
  }, [chatRequestsQuery.data]);

  const createChatRequestMutation = useMutation({
    mutationFn: async ({ recipientId, message }: { recipientId: string; message?: string }) => {
      if (!currentUserId) throw new Error('Non connecté');
      return await chatApi.createChatRequest(currentUserId, recipientId, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatRequests'] });
    },
  });

  const respondToChatRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'accept' | 'reject' }) => {
      if (!currentUserId) throw new Error('Non connecté');
      
      const request = chatRequests.find(r => r.id === requestId);
      if (!request) throw new Error('Demande non trouvée');
      
      try {
        const result = await chatApi.respondToChatRequest(requestId, currentUserId, action);
        
        // If accepted, create direct chat room locally
        if (action === 'accept') {
          const directRoom: ChatRoom = {
            id: `direct-${Date.now()}`,
            name: `Conversation directe`,
            type: 'direct',
            participants: [request.requesterId, request.recipientId],
            unreadCount: 0,
            createdAt: new Date(),
          };
          
          const updatedRooms = [...chatRooms, directRoom];
          await saveRooms(updatedRooms);
          queryClient.invalidateQueries({ queryKey: ['chats'] });
        }
        
        return result;
      } catch (e) {
        console.log('[Chat] Supabase error, using local');
        // Update request status locally
        const updatedRequests = chatRequests.map(r => 
          r.id === requestId 
            ? { ...r, status: action === 'accept' ? 'accepted' as const : 'rejected' as const, respondedAt: new Date() }
            : r
        );
        setChatRequests(updatedRequests);
        
        // If accepted, create direct chat room locally
        if (action === 'accept') {
          const directRoom: ChatRoom = {
            id: `direct-${Date.now()}`,
            name: `Conversation directe`,
            type: 'direct',
            participants: [request.requesterId, request.recipientId],
            unreadCount: 0,
            createdAt: new Date(),
          };
          
          const updatedRooms = [...chatRooms, directRoom];
          await saveRooms(updatedRooms);
        }
        
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatRequests'] });
    },
  });

  const getPendingChatRequests = useCallback(() => {
    if (!currentUserId) return [];
    return chatRequests.filter(r => 
      r.recipientId === currentUserId && r.status === 'pending'
    );
  }, [chatRequests, currentUserId]);

  const getSentChatRequests = useCallback(() => {
    if (!currentUserId) return [];
    return chatRequests.filter(r => 
      r.requesterId === currentUserId && r.status === 'pending'
    );
  }, [chatRequests, currentUserId]);

  return {
    chatRooms,
    messages,
    chatRequests,
    isLoading: chatsQuery.isLoading,
    isPollingActive,
    createRoom: createRoomMutation.mutateAsync,
    sendMessage: sendMessageMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    deleteRoom: deleteRoomMutation.mutateAsync,
    addParticipant: addParticipantMutation.mutateAsync,
    removeParticipant: removeParticipantMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    createTeamChats: createTeamChatsMutation.mutateAsync,
    createChatRequest: createChatRequestMutation.mutateAsync,
    respondToChatRequest: respondToChatRequestMutation.mutateAsync,
    getRoomMessages,
    getTeamRooms,
    getTotalUnread,
    getUserRooms,
    getPendingChatRequests,
    getSentChatRequests,
    forceRefresh,
    isSending: sendMessageMutation.isPending,
    isCreatingRoom: createRoomMutation.isPending,
    isCreatingRequest: createChatRequestMutation.isPending,
  };
});
