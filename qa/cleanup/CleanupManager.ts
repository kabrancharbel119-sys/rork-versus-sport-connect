import { supabase } from '@/lib/supabase';
import type { QaStepResult } from '@/qa/types';

export class CleanupManager {
  constructor(private readonly prefix: string) {}

  async cleanupSyntheticData(): Promise<QaStepResult> {
    const started = Date.now();
    const tag = `[QA ${this.prefix}]`;
    try {
      const [supportDel, verificationDel, notifDel] = await Promise.all([
        (supabase.from('support_tickets').delete().like('subject', `%${tag}%`) as any),
        (supabase.from('verification_requests').delete().like('reason', `%${tag}%`) as any),
        (supabase.from('notifications').delete().like('title', `%${tag}%`) as any),
      ]);

      const deleted = {
        support: supportDel?.count ?? 0,
        verification: verificationDel?.count ?? 0,
        notifications: notifDel?.count ?? 0,
      };

      return {
        id: `cleanup-${started}`,
        name: 'Cleanup synthetic QA data',
        status: 'passed',
        durationMs: Math.max(1, Date.now() - started),
        details: `support=${deleted.support}, verification=${deleted.verification}, notifications=${deleted.notifications}`,
      };
    } catch (e) {
      return {
        id: `cleanup-${started}`,
        name: 'Cleanup synthetic QA data',
        status: 'warning',
        durationMs: Math.max(1, Date.now() - started),
        error: (e as Error).message,
      };
    }
  }
}
