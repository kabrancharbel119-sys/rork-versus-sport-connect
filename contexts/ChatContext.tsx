import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ChatRoom, ChatMessage, ChatRequest } from '@/types';
import { mockChatRooms, mockMessages } from '@/mocks/data';
import { emitRealtimeEvent } from '@/lib/realtime';
import { chatApi } from '@/lib/api/chat';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const CHATS_STORAGE_KEY = 'vs_chats';
const MESSAGES_STORAGE_KEY = 'vs_messages';

export const [ChatProvider, useChat] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [isPollingActive, setIsPollingActive] = useState(true);
  const roomIdsRef = useRef<Set<string>>(new Set());

  const currentUserId = authUser?.id ?? null;

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      const active = state === 'active';
      setIsPollingActive(active);
      logger.debug('Chat', 'App state changed, polling:', active);
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  const chatsQuery = useQuery({
    queryKey: ['chats', currentUserId],
    queryFn: async () => {
      logger.debug('Chat', 'Loading chats...');
      
      if (currentUserId) {
        try {
          const serverRooms = await chatApi.getRooms(currentUserId);
          await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(serverRooms));

          const allMessages: ChatMessage[] = [];
          for (const room of serverRooms) {
            const roomMessages = await chatApi.getMessages(room.id, currentUserId);
            allMessages.push(...roomMessages);
          }
          await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
          return { rooms: serverRooms, messages: allMessages };
        } catch (e) {
          logger.error('Chat', 'Server fetch failed for authenticated user:', e);

          const [storedRooms, storedMessages] = await Promise.all([
            AsyncStorage.getItem(CHATS_STORAGE_KEY),
            AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
          ]);

          return {
            rooms: storedRooms ? JSON.parse(storedRooms) : [],
            messages: storedMessages ? JSON.parse(storedMessages) : [],
          };
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
      
      // Merge server messages with existing local messages to prevent loss
      setMessages(prevMessages => {
        const serverMessages: ChatMessage[] = chatsQuery.data.messages;
        const serverMessageIds = new Set(serverMessages.map((m: ChatMessage) => m.id));
        
        // Keep local messages that aren't on the server yet (recently sent)
        const localOnlyMessages = prevMessages.filter(m => !serverMessageIds.has(m.id));
        
        // Combine server messages with local-only messages
        const merged = [...serverMessages, ...localOnlyMessages];
        
        // Sort by creation date
        return merged.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    }
  }, [chatsQuery.data]);

  useEffect(() => {
    roomIdsRef.current = new Set(chatRooms.map(room => room.id));
  }, [chatRooms]);

  // Supabase Realtime subscription for chat messages
  useEffect(() => {
    if (!currentUserId) return;

    logger.debug('Chat', 'Setting up Realtime subscription for messages');

    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          logger.debug('Chat', 'Realtime: New message received', payload.new);
          
          const newMessage = payload.new as any;
          const chatMessage: ChatMessage = {
            id: newMessage.id,
            roomId: newMessage.room_id,
            senderId: newMessage.sender_id,
            content: newMessage.content,
            type: newMessage.type || 'text',
            createdAt: new Date(newMessage.created_at),
            readBy: newMessage.read_by || [],
          };

          if (!roomIdsRef.current.has(chatMessage.roomId)) {
            return;
          }

          setChatRooms(prevRooms => {
            const roomIndex = prevRooms.findIndex(r => r.id === chatMessage.roomId);
            if (roomIndex === -1) return prevRooms;
            const updatedRooms = [...prevRooms];
            updatedRooms[roomIndex] = {
              ...updatedRooms[roomIndex],
              lastMessage: chatMessage,
              unreadCount:
                chatMessage.senderId === currentUserId
                  ? updatedRooms[roomIndex].unreadCount
                  : updatedRooms[roomIndex].unreadCount + 1,
            };
            AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updatedRooms));
            return updatedRooms;
          });

          // Only add if message is not from current user (to avoid duplicates)
          // Current user's messages are already added optimistically
          if (chatMessage.senderId !== currentUserId) {
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(m => m.id === chatMessage.id)) {
                return prev;
              }
              const updated = [...prev, chatMessage].sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      logger.debug('Chat', 'Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const saveRooms = useCallback(async (updated: ChatRoom[]) => {
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(updated));
    setChatRooms(updated);
  }, []);

  const saveMessages = useCallback(async (updated: ChatMessage[]) => {
    await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updated));
    setMessages(updated);
  }, []);

  const resolveServerRoomId = useCallback(async (roomId: string): Promise<string> => {
    if (!currentUserId || !roomId.startsWith('chat-')) return roomId;

    const localRoom = chatRooms.find(r => r.id === roomId);
    if (!localRoom) return roomId;

    const serverRooms = await chatApi.getRooms(currentUserId);
    let serverRoom = serverRooms.find(r =>
      r.teamId === localRoom.teamId &&
      r.name === localRoom.name &&
      r.type === localRoom.type
    );

    if (!serverRoom) {
      serverRoom = await chatApi.createRoom(currentUserId, {
        teamId: localRoom.teamId,
        name: localRoom.name,
        type: localRoom.type as 'general' | 'match' | 'strategy' | 'direct',
        participants: localRoom.participants,
      });
    }

    const mergedRoom: ChatRoom = {
      ...localRoom,
      ...serverRoom,
    };

    const updatedRooms = [
      ...chatRooms.filter(r => r.id !== roomId && r.id !== serverRoom.id),
      mergedRoom,
    ];
    await saveRooms(updatedRooms);

    setMessages(prev => {
      const remapped = prev.map(m =>
        m.roomId === roomId ? { ...m, roomId: serverRoom!.id } : m
      );
      AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(remapped));
      return remapped;
    });

    return serverRoom.id;
  }, [chatRooms, currentUserId, saveRooms]);

  const createRoomMutation = useMutation({
    mutationFn: async ({ teamId, name, type, participants }: { teamId: string; name: string; type: 'general' | 'match' | 'strategy'; participants: string[] }) => {
      logger.debug('Chat', 'Creating room:', name);
      
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
          const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
          logger.error('Chat', `Failed to create room on server: ${errorMessage}`);
          throw new Error(errorMessage);
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
      logger.debug('Chat', 'Sending message to room:', roomId, 'type:', messageType);

      if (currentUserId) {
        try {
          let targetRoomId = roomId;
          let message: ChatMessage;

          try {
            message = await chatApi.sendMessage(targetRoomId, senderId, content, messageType);
          } catch (sendErr) {
            const sendErrMessage = sendErr instanceof Error ? sendErr.message : JSON.stringify(sendErr);
            if (!sendErrMessage.toLowerCase().includes('salon non trouvé')) {
              throw sendErr;
            }

            logger.debug('Chat', `Room ${targetRoomId} not found on server, attempting recovery`);
            targetRoomId = await resolveServerRoomId(targetRoomId);
            message = await chatApi.sendMessage(targetRoomId, senderId, content, messageType);
          }

          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            const updatedMessages = [...prev, message].sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updatedMessages));
            return updatedMessages;
          });
          
          const roomIndex = chatRooms.findIndex(r => r.id === message.roomId);
          if (roomIndex !== -1) {
            const updatedRooms = [...chatRooms];
            updatedRooms[roomIndex] = {
              ...updatedRooms[roomIndex],
              lastMessage: message,
              unreadCount: updatedRooms[roomIndex].unreadCount,
            };
            await saveRooms(updatedRooms);
          }
          
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          emitRealtimeEvent('chat', 'create', { message, roomId: message.roomId, senderName });
          return message;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
          logger.error('Chat', `Supabase sendMessage failed: ${errorMessage}`);
          throw new Error(errorMessage);
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
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        const updatedMessages = [...prev, newMessage].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updatedMessages));
        return updatedMessages;
      });
      
      const roomIndex = chatRooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        const updatedRooms = [...chatRooms];
        updatedRooms[roomIndex] = {
          ...updatedRooms[roomIndex],
          lastMessage: newMessage,
          unreadCount: updatedRooms[roomIndex].unreadCount,
        };
        await saveRooms(updatedRooms);
      }
      
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'create', { message: newMessage, roomId, senderName });
      logger.debug('Chat', 'Message sent successfully');
      return newMessage;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (currentUserId) {
        try {
          await chatApi.markAsRead(roomId, userId);
        } catch (e) {
          logger.debug('Chat', 'Supabase markAsRead failed');
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
      logger.debug('Chat', 'Deleting room:', roomId);
      const updatedRooms = chatRooms.filter(r => r.id !== roomId);
      const updatedMessages = messages.filter(m => m.roomId !== roomId);
      await Promise.all([saveRooms(updatedRooms), saveMessages(updatedMessages)]);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      emitRealtimeEvent('chat', 'delete', { roomId });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: string; userId: string }) => {
      logger.debug('Chat', 'Adding participant:', userId);
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
      logger.debug('Chat', 'Removing participant:', userId);
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
      logger.error('ChatContext', 'deleteMessage error:', error);
    },
  });

  const createTeamChatsMutation = useMutation({
    mutationFn: async ({ teamId, teamName, members }: { teamId: string; teamName: string; members: string[] }) => {
      logger.debug('Chat', 'Creating team chats for:', teamName);
      
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
          const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
          logger.error('Chat', `Failed to create team chats on server: ${errorMessage}`);
          throw new Error(errorMessage);
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
  const getTotalUnread = useCallback(() => {
    if (!currentUserId) return 0;

    const myRoomIds = new Set(
      chatRooms
        .filter(room => room.participants.includes(currentUserId))
        .map(room => room.id)
    );

    return messages.reduce((sum, msg) => {
      const isInMyRoom = myRoomIds.has(msg.roomId);
      const isMyMessage = msg.senderId === currentUserId;
      const isReadByMe = msg.readBy.includes(currentUserId);
      if (!isInMyRoom || isMyMessage || isReadByMe) return sum;
      return sum + 1;
    }, 0);
  }, [chatRooms, currentUserId, messages]);
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
        logger.debug('Chat', 'Failed to load chat requests');
        return [];
      }
    },
    enabled: !!currentUserId,
    refetchInterval: isPollingActive ? 10000 : false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 secondes
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
        
        if (action === 'accept') {
          const acceptedRoom = (result as any)?.room as ChatRoom | undefined;
          if (acceptedRoom) {
            const alreadyExists = chatRooms.some(r => r.id === acceptedRoom.id);
            if (!alreadyExists) {
              const updatedRooms = [...chatRooms, acceptedRoom];
              await saveRooms(updatedRooms);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          setChatRequests(prev => {
            const next = prev.filter(r => r.id !== requestId);
            logger.debug('Chat', 'Request accepted, removing:', requestId, '| remaining:', next.length);
            return next;
          });
          // Ne pas invalider ici : onSuccess le fera après 1 s
        }
        
        return result;
      } catch (e) {
        logger.debug('Chat', 'Supabase error, using local');
        setChatRequests(prev => prev.filter(r => r.id !== requestId));
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
          return { success: true, room: directRoom, roomId: directRoom.id };
        }
        queryClient.invalidateQueries({ queryKey: ['chatRequests'] });
        return { success: true };
      }
    },
    onSuccess: (_, variables) => {
      const { requestId, action } = variables;
      if (action === 'accept') {
        logger.debug('Chat', 'Request accepted, removing from state:', requestId);
        
        // Retire immédiatement de l'état local
        setChatRequests(prev => {
          const filtered = prev.filter(r => r.id !== requestId);
          logger.debug('Chat', 'Remaining requests:', filtered.length);
          return filtered;
        });
        
        // Attends 1 seconde avant d'invalider le cache
        // pour laisser le temps à Supabase de mettre à jour
        setTimeout(() => {
          logger.debug('Chat', 'Invalidating cache after delay');
          queryClient.invalidateQueries({ queryKey: ['chatRequests'] });
        }, 1000);
      } else {
        // Pour reject, invalide immédiatement
        queryClient.invalidateQueries({ queryKey: ['chatRequests'] });
      }
    },
  });

  const getPendingChatRequests = useCallback(() => {
    if (!currentUserId) return [];
    return chatRequests.filter(r => r.status === 'pending' && r.recipientId === currentUserId);
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
