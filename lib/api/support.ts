import { supabase } from '@/lib/supabase';
import type { TicketCategory, TicketStatus, SupportTicket, TicketResponse } from '@/contexts/SupportContext';

export interface CreateTicketInput {
  userId: string;
  category: TicketCategory;
  subject: string;
  description: string;
}

export interface CreateTicketResponseInput {
  ticketId: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  message: string;
}

export const supportApi = {
  // Get all tickets (for admin)
  async getAllTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, user_id, category, subject, description, status, priority, responses, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    
    return (data || []).map(mapTicketRow);
  },

  // Get tickets for a specific user
  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, user_id, category, subject, description, status, priority, responses, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    
    return (data || []).map(mapTicketRow);
  },

  // Get pending tickets (open or in_progress)
  async getPendingTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, user_id, category, subject, description, status, priority, responses, created_at, updated_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    
    return (data || []).map(mapTicketRow);
  },

  // Create a new ticket - minimal fields only
  async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: input.userId,
        category: input.category,
        subject: input.subject,
        description: input.description,
        status: 'open',
        priority: 'normal',
      })
      .select('id, user_id, category, subject, description, status, priority, responses, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);
    
    return mapTicketRow(data);
  },

  // Add a response to a ticket
  async addResponse(input: CreateTicketResponseInput): Promise<TicketResponse> {
    // First get current responses
    const { data: ticket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('responses, status')
      .eq('id', input.ticketId)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const response: TicketResponse = {
      id: `response-${Date.now()}`,
      oderId: input.userId,
      userId: input.userId,
      userName: input.userName,
      isAdmin: input.isAdmin,
      message: input.message,
      createdAt: new Date(),
    };

    const updatedResponses = [...(ticket.responses || []), response];
    const newStatus = input.isAdmin ? 'in_progress' : ticket.status;

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({
        responses: updatedResponses,
        status: newStatus,
      })
      .eq('id', input.ticketId);

    if (updateError) throw new Error(updateError.message);

    return response;
  },

  // Update ticket status
  async updateTicketStatus(ticketId: string, status: TicketStatus, priority?: 'low' | 'normal' | 'high' | 'urgent'): Promise<void> {
    const updateData: any = { status };
    if (priority) updateData.priority = priority;

    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) throw new Error(error.message);
  },

  // Delete a ticket
  async deleteTicket(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticketId);

    if (error) throw new Error(error.message);
  },
};

// Helper to map Supabase row to SupportTicket
function mapTicketRow(row: any): SupportTicket {
  return {
    id: row.id,
    oderId: row.user_id,
    userId: row.user_id,
    userName: undefined,
    userEmail: undefined,
    category: row.category || 'other',
    subject: row.subject || '',
    message: row.description || '',
    description: row.description || '',
    status: row.status || 'open',
    priority: row.priority || 'normal',
    responses: row.responses || [],
    createdAt: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
}
