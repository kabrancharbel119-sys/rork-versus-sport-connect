import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { supportApi } from '@/lib/api/support';
import { verificationsApi } from '@/lib/api/verifications';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'bug' | 'account' | 'payment' | 'feature' | 'team' | 'match' | 'other';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface SupportTicket {
  id: string; oderId?: string; oderId_legacy?: string; userId: string; userName?: string; userEmail?: string; category: TicketCategory;
  subject: string; message?: string; description?: string; status: TicketStatus; priority: 'low' | 'normal' | 'high' | 'urgent';
  responses: TicketResponse[]; createdAt: Date; updatedAt: Date;
}

export interface TicketResponse {
  id: string; oderId?: string; oderId_legacy?: string; oderId_response?: string; userId?: string; userName: string; isAdmin: boolean; message: string; createdAt: Date;
}

export interface VerificationRequest {
  id: string; oderId?: string; oderId_legacy?: string; userId: string; userName: string; userEmail?: string; userAvatar?: string;
  documentType?: string; documentUrl?: string; reason?: string; status: VerificationStatus; rejectionReason?: string;
  createdAt: Date; reviewedAt?: Date; reviewedBy?: string;
}

export const [SupportProvider, useSupport] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  // Load tickets from Supabase
  const ticketsQuery = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: async () => {
      console.log('[Support] Loading tickets from Supabase...');
      return supportApi.getAllTickets();
    },
  });

  // Load verification requests from Supabase
  const verificationQuery = useQuery({
    queryKey: ['support', 'verifications'],
    queryFn: async () => {
      console.log('[Support] Loading verification requests from Supabase...');
      return verificationsApi.getAll();
    },
  });

  useEffect(() => {
    if (verificationQuery.data) {
      setVerificationRequests(verificationQuery.data);
    }
  }, [verificationQuery.data]);

  const tickets = ticketsQuery.data || [];

  const invalidateTickets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
  }, [queryClient]);

  const invalidateVerifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['support', 'verifications'] });
  }, [queryClient]);

  const createTicketMutation = useMutation({
    mutationFn: async (data: { oderId?: string; userId?: string; category: TicketCategory; subject: string; message?: string; description?: string }) => {
      console.log('[Support] Creating ticket...');
      const newTicket = await supportApi.createTicket({
        userId: data.userId || data.oderId || '',
        category: data.category,
        subject: data.subject,
        description: data.description || data.message || '',
      });
      invalidateTickets();
      return newTicket;
    },
  });

  const respondToTicketMutation = useMutation({
    mutationFn: async (data: { ticketId: string; oderId: string; userName: string; isAdmin: boolean; message: string }) => {
      const response = await supportApi.addResponse({
        ticketId: data.ticketId,
        userId: data.oderId,
        userName: data.userName,
        isAdmin: data.isAdmin,
        message: data.message,
      });
      invalidateTickets();
      return response;
    },
  });

  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status, priority }: { ticketId: string; status: TicketStatus; priority?: 'low' | 'normal' | 'high' | 'urgent' }) => {
      await supportApi.updateTicketStatus(ticketId, status, priority);
      invalidateTickets();
    },
  });

  const submitVerificationMutation = useMutation({
    mutationFn: async (data: { oderId?: string; userId?: string; userName: string; userEmail?: string; userAvatar?: string; documentType?: string; documentUrl?: string; reason?: string }) => {
      console.log('[Support] Submitting verification request...');
      const newRequest = await verificationsApi.create({
        userId: data.userId || data.oderId || '',
        userName: data.userName,
        userEmail: data.userEmail,
        userAvatar: data.userAvatar,
        documentType: data.documentType || 'identity',
        documentUrl: data.documentUrl,
        reason: data.reason,
      });
      invalidateVerifications();
      return newRequest;
    },
  });

  const handleVerificationMutation = useMutation({
    mutationFn: async ({ requestId, action, reason, adminId }: { requestId: string; action: 'approve' | 'reject'; reason?: string; adminId: string }) => {
      const updated = await verificationsApi.handle({
        requestId,
        action,
        reason,
        adminId,
      });
      invalidateVerifications();
      return updated;
    },
  });

  const getUserTickets = useCallback((userId: string) => tickets.filter(t => t.userId === userId), [tickets]);
  const getPendingTickets = useCallback(() => tickets.filter(t => t.status === 'open' || t.status === 'in_progress'), [tickets]);
  const getPendingVerifications = useCallback(() => verificationRequests.filter(v => v.status === 'pending'), [verificationRequests]);
  const getUserVerificationStatus = useCallback((userId: string) => {
    // Return synchronous result from cached verificationRequests
    return verificationRequests.find(v => v.userId === userId && v.status === 'pending') || null;
  }, [verificationRequests]);

  return {
    tickets, 
    verificationRequests, 
    isLoading: ticketsQuery.isLoading || verificationQuery.isLoading,
    createTicket: createTicketMutation.mutateAsync, 
    respondToTicket: respondToTicketMutation.mutateAsync,
    updateTicketStatus: updateTicketStatusMutation.mutateAsync, 
    submitVerification: submitVerificationMutation.mutateAsync,
    handleVerification: handleVerificationMutation.mutateAsync,
    getUserTickets, 
    getPendingTickets, 
    getPendingVerifications, 
    getUserVerificationStatus,
    isCreatingTicket: createTicketMutation.isPending, 
    isSubmittingVerification: submitVerificationMutation.isPending,
    // Expose for admin
    refetchVerifications: invalidateVerifications,
  };
});
