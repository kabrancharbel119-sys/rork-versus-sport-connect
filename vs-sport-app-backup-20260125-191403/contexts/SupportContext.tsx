import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

const TICKETS_KEY = 'vs_support_tickets';
const VERIFICATION_REQUESTS_KEY = 'vs_verification_requests';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'bug' | 'account' | 'payment' | 'feature' | 'team' | 'match' | 'other';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface SupportTicket {
  id: string; oderId?: string; oderId_legacy?: string; userId: string; userName: string; userEmail: string; category: TicketCategory;
  subject: string; message: string; description?: string; status: TicketStatus; priority: 'low' | 'normal' | 'high' | 'urgent';
  responses: TicketResponse[]; createdAt: Date; updatedAt: Date;
}

export interface TicketResponse {
  id: string; oderId?: string; oderId_legacy?: string; oderId_response?: string; userId?: string; userName: string; isAdmin: boolean; message: string; createdAt: Date;
}

export interface VerificationRequest {
  id: string; oderId?: string; oderId_legacy?: string; userId: string; userName: string; userEmail: string; userAvatar?: string;
  documentType?: string; documentUrl?: string; reason?: string; status: VerificationStatus; rejectionReason?: string;
  createdAt: Date; reviewedAt?: Date; reviewedBy?: string;
}

export const [SupportProvider, useSupport] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  const supportQuery = useQuery({
    queryKey: ['support'],
    queryFn: async () => {
      console.log('[Support] Loading tickets and verification requests...');
      const [ticketsData, verificationsData] = await Promise.all([
        AsyncStorage.getItem(TICKETS_KEY),
        AsyncStorage.getItem(VERIFICATION_REQUESTS_KEY),
      ]);
      return {
        tickets: ticketsData ? JSON.parse(ticketsData) : [],
        verifications: verificationsData ? JSON.parse(verificationsData) : [],
      };
    },
  });

  useEffect(() => {
    if (supportQuery.data) {
      setTickets(supportQuery.data.tickets);
      setVerificationRequests(supportQuery.data.verifications);
    }
  }, [supportQuery.data]);

  const saveTickets = useCallback(async (updated: SupportTicket[]) => {
    await AsyncStorage.setItem(TICKETS_KEY, JSON.stringify(updated));
    setTickets(updated);
    queryClient.invalidateQueries({ queryKey: ['support'] });
  }, [queryClient]);

  const saveVerifications = useCallback(async (updated: VerificationRequest[]) => {
    await AsyncStorage.setItem(VERIFICATION_REQUESTS_KEY, JSON.stringify(updated));
    setVerificationRequests(updated);
    queryClient.invalidateQueries({ queryKey: ['support'] });
  }, [queryClient]);

  const createTicketMutation = useMutation({
    mutationFn: async (data: { oderId?: string; userId?: string; userName: string; userEmail: string; category: TicketCategory; subject: string; message?: string; description?: string }) => {
      console.log('[Support] Creating ticket...');
      const newTicket: SupportTicket = {
        id: `ticket-${Date.now()}`, oderId: data.oderId || data.userId || '', userId: data.userId || data.oderId || '', userName: data.userName, userEmail: data.userEmail,
        category: data.category, subject: data.subject, message: data.message || data.description || '', description: data.description || data.message, status: 'open', priority: 'normal',
        responses: [], createdAt: new Date(), updatedAt: new Date(),
      };
      await saveTickets([newTicket, ...tickets]);
      return newTicket;
    },
  });

  const respondToTicketMutation = useMutation({
    mutationFn: async (data: { ticketId: string; oderId: string; userName: string; isAdmin: boolean; message: string }) => {
      const ticketIdx = tickets.findIndex(t => t.id === data.ticketId);
      if (ticketIdx === -1) throw new Error('Ticket non trouvé');
      const response: TicketResponse = {
        id: `response-${Date.now()}`, oderId: data.oderId, userName: data.userName, isAdmin: data.isAdmin, message: data.message, createdAt: new Date(),
      };
      const updated = [...tickets];
      updated[ticketIdx] = {
        ...updated[ticketIdx], responses: [...updated[ticketIdx].responses, response],
        status: data.isAdmin ? 'in_progress' : updated[ticketIdx].status, updatedAt: new Date(),
      };
      await saveTickets(updated);
      return response;
    },
  });

  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status, priority }: { ticketId: string; status: TicketStatus; priority?: 'low' | 'normal' | 'high' | 'urgent' }) => {
      const updated = tickets.map(t => t.id === ticketId ? { ...t, status, priority: priority || t.priority, updatedAt: new Date() } : t);
      await saveTickets(updated);
    },
  });

  const submitVerificationMutation = useMutation({
    mutationFn: async (data: { oderId?: string; userId?: string; userName: string; userEmail: string; userAvatar?: string; documentType?: string; documentUrl?: string; reason?: string }) => {
      console.log('[Support] Submitting verification request...');
      const oderId = data.oderId || data.userId || '';
      if (verificationRequests.find(v => (v.oderId === oderId || v.userId === oderId) && v.status === 'pending')) {
        throw new Error('Vous avez déjà une demande en attente');
      }
      const newRequest: VerificationRequest = {
        id: `verification-${Date.now()}`, oderId: data.oderId || data.userId || '', userId: data.userId || data.oderId || '', userName: data.userName, userEmail: data.userEmail,
        userAvatar: data.userAvatar, documentType: data.documentType || 'identity', documentUrl: data.documentUrl || '', reason: data.reason, status: 'pending', createdAt: new Date(),
      };
      await saveVerifications([newRequest, ...verificationRequests]);
      return newRequest;
    },
  });

  const handleVerificationMutation = useMutation({
    mutationFn: async ({ requestId, action, reason, adminId }: { requestId: string; action: 'approve' | 'reject'; reason?: string; adminId: string }) => {
      const updated = verificationRequests.map(v =>
        v.id === requestId ? { ...v, status: action === 'approve' ? 'approved' as const : 'rejected' as const, rejectionReason: reason, reviewedAt: new Date(), reviewedBy: adminId } : v
      );
      await saveVerifications(updated);
      return updated.find(v => v.id === requestId);
    },
  });

  const getUserTickets = useCallback((oderId: string) => tickets.filter(t => t.oderId === oderId || t.userId === oderId), [tickets]);
  const getPendingTickets = useCallback(() => tickets.filter(t => t.status === 'open' || t.status === 'in_progress'), [tickets]);
  const getPendingVerifications = useCallback(() => verificationRequests.filter(v => v.status === 'pending'), [verificationRequests]);
  const getUserVerificationStatus = useCallback((oderId: string) => verificationRequests.find(v => (v.oderId === oderId || v.userId === oderId) && v.status === 'pending'), [verificationRequests]);

  return {
    tickets, verificationRequests, isLoading: supportQuery.isLoading,
    createTicket: createTicketMutation.mutateAsync, respondToTicket: respondToTicketMutation.mutateAsync,
    updateTicketStatus: updateTicketStatusMutation.mutateAsync, submitVerification: submitVerificationMutation.mutateAsync,
    handleVerification: handleVerificationMutation.mutateAsync,
    getUserTickets, getPendingTickets, getPendingVerifications, getUserVerificationStatus,
    isCreatingTicket: createTicketMutation.isPending, isSubmittingVerification: submitVerificationMutation.isPending,
  };
});
