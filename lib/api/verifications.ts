import { supabase } from '@/lib/supabase';
import type { VerificationStatus } from '@/contexts/SupportContext';

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  documentType?: string;
  documentUrl?: string;
  reason?: string;
  status: VerificationStatus;
  rejectionReason?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  createdAt: Date;
}

export interface CreateVerificationInput {
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  documentType?: string;
  documentUrl?: string;
  reason?: string;
}

export interface HandleVerificationInput {
  requestId: string;
  action: 'approve' | 'reject';
  reason?: string;
  adminId: string;
}

export const verificationsApi = {
  // Get all verification requests (for admin)
  async getAll(): Promise<VerificationRequest[]> {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToRequest);
  },

  // Get pending verification requests
  async getPending(): Promise<VerificationRequest[]> {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToRequest);
  },

  // Get user's verification requests
  async getByUser(userId: string): Promise<VerificationRequest[]> {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapRowToRequest);
  },

  // Get user's pending verification request
  async getUserPending(userId: string): Promise<VerificationRequest | null> {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRowToRequest(data) : null;
  },

  // Create a new verification request
  async create(input: CreateVerificationInput): Promise<VerificationRequest> {
    // Check if user already has a pending request
    const existing = await this.getUserPending(input.userId);
    if (existing) {
      throw new Error('Vous avez déjà une demande de vérification en attente');
    }

    const { data, error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: input.userId,
        user_name: input.userName,
        user_email: input.userEmail,
        user_avatar: input.userAvatar,
        document_type: input.documentType || 'identity',
        document_url: input.documentUrl,
        reason: input.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRowToRequest(data);
  },

  // Handle (approve/reject) a verification request
  async handle(input: HandleVerificationInput): Promise<VerificationRequest> {
    const { data, error } = await supabase
      .from('verification_requests')
      .update({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        rejection_reason: input.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.adminId,
      })
      .eq('id', input.requestId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRowToRequest(data);
  },

  // Delete a verification request
  async delete(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('verification_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw new Error(error.message);
  },
};

// Helper to map Supabase row to VerificationRequest
function mapRowToRequest(row: any): VerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userAvatar: row.user_avatar,
    documentType: row.document_type,
    documentUrl: row.document_url,
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}
