import { supabase } from '@/lib/supabase';

interface GeneratedIds {
  supportTicketIds: string[];
  verificationRequestIds: string[];
}

export class DataGenerator {
  private readonly prefix: string;
  private readonly ids: GeneratedIds = {
    supportTicketIds: [],
    verificationRequestIds: [],
  };

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  get trackedIds(): GeneratedIds {
    return this.ids;
  }

  async createSyntheticSupportTicket(userId: string): Promise<string | null> {
    const payload = {
      user_id: userId,
      category: 'other',
      subject: `[QA ${this.prefix}] Synthetic Ticket`,
      description: 'Synthetic QA ticket for workflow validation.',
      status: 'open',
      priority: 'normal',
    };

    const { data, error } = await (supabase
      .from('support_tickets')
      .insert(payload)
      .select('id')
      .single() as any);

    if (error) {
      console.warn('[QA] createSyntheticSupportTicket failed:', error.message);
      return null;
    }

    const id = data?.id as string | undefined;
    if (id) this.ids.supportTicketIds.push(id);
    return id || null;
  }

  async createSyntheticVerificationRequest(userId: string, userName: string): Promise<string | null> {
    const payload = {
      user_id: userId,
      user_name: userName,
      reason: `[QA ${this.prefix}] verification request`,
      status: 'pending',
    };

    const { data, error } = await (supabase
      .from('verification_requests')
      .insert(payload)
      .select('id')
      .single() as any);

    if (error) {
      console.warn('[QA] createSyntheticVerificationRequest failed:', error.message);
      return null;
    }

    const id = data?.id as string | undefined;
    if (id) this.ids.verificationRequestIds.push(id);
    return id || null;
  }
}
