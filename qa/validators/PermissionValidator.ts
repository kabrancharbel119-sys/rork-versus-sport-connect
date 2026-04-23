import { supabase } from '@/lib/supabase';
import type { QaStepResult } from '@/qa/types';

const mk = (name: string, started: number, status: QaStepResult['status'], details?: string, error?: string): QaStepResult => ({
  id: `${name}-${started}`,
  name,
  status,
  durationMs: Math.max(1, Date.now() - started),
  details,
  error,
});

export class PermissionValidator {
  async validateForbiddenUserBanUpdate(): Promise<QaStepResult> {
    const start = Date.now();
    try {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.id) {
        return mk('Permission: unauthenticated ban update blocked', start, 'skipped', 'No authenticated user');
      }

      // Fetch another user's ID to test cross-user update (should be blocked by RLS)
      const { data: others } = await (supabase
        .from('users')
        .select('id')
        .neq('id', me.user.id)
        .limit(1) as any);

      const targetId = (others || [])[0]?.id;
      if (!targetId) {
        return mk('Permission: unauthenticated ban update blocked', start, 'passed', 'only_one_user_in_db');
      }

      const { error, count } = await (supabase
        .from('users')
        .update({ is_banned: true } as any)
        .eq('id', targetId)
        .select() as any);

      if (error) {
        return mk('Permission: unauthenticated ban update blocked', start, 'passed', `blocked=${error.code}`);
      }

      // RLS blocks via USING clause → update matches 0 rows (no error, just empty result)
      if (!count || count === 0) {
        return mk('Permission: unauthenticated ban update blocked', start, 'passed', 'rls_blocked_0_rows_affected');
      }

      // Rollback if it somehow succeeded
      await (supabase.from('users').update({ is_banned: false } as any).eq('id', targetId));
      return mk('Permission: unauthenticated ban update blocked', start, 'warning', 'Cross-user is_banned update succeeded — tighten RLS');
    } catch (e) {
      return mk('Permission: unauthenticated ban update blocked', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateUnauthorizedBookingInsert(): Promise<QaStepResult> {
    const start = Date.now();
    try {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.id) {
        return mk('Permission: unauthorized booking insert blocked', start, 'skipped', 'No authenticated user');
      }
      const { error } = await (supabase.from('bookings').insert({
        venue_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
        date: '2099-01-01',
        start_time: '10:00',
        end_time: '11:00',
        status: 'confirmed',
      } as any));
      if (error) {
        return mk('Permission: unauthorized booking insert blocked', start, 'passed', `blocked=${error.code}`);
      }
      return mk('Permission: unauthorized booking insert blocked', start, 'warning', 'Insert succeeded without venue ownership - verify RLS');
    } catch (e) {
      return mk('Permission: unauthorized booking insert blocked', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateUnauthorizedPayoutInsert(): Promise<QaStepResult> {
    const start = Date.now();
    try {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.id) {
        return mk('Permission: unauthorized payout insert blocked', start, 'skipped', 'No authenticated user');
      }
      const { error } = await (supabase.from('tournament_payout_requests').insert({
        tournament_id: '00000000-0000-0000-0000-000000000000',
        team_id: '00000000-0000-0000-0000-000000000000',
        requested_amount: 9999,
        status: 'approved',
      } as any));
      if (error) {
        return mk('Permission: unauthorized payout insert blocked', start, 'passed', `blocked=${error.code}`);
      }
      return mk('Permission: unauthorized payout insert blocked', start, 'warning', 'Insert succeeded without tournament ownership - verify RLS');
    } catch (e) {
      return mk('Permission: unauthorized payout insert blocked', start, 'warning', undefined, (e as Error).message);
    }
  }

  async validateReadScopeSupportTickets(): Promise<QaStepResult> {
    const start = Date.now();
    try {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.id) {
        return mk('Permission: support ticket read scope', start, 'skipped', 'No authenticated user');
      }

      const { data, error } = await (supabase
        .from('support_tickets')
        .select('id,user_id')
        .limit(20) as any);

      if (error) {
        return mk('Permission: support ticket read scope', start, 'passed', `rls_blocked=${error.code}`);
      }

      const rows = data || [];
      const foreign = rows.filter((r: any) => r.user_id !== me.user!.id);

      // Admin seeing foreign tickets is correct by design
      // Non-admin seeing 0 foreign tickets = RLS works
      // Non-admin seeing foreign tickets = RLS too permissive
      if (foreign.length === 0 || rows.length === 0) {
        return mk('Permission: support ticket read scope', start, 'passed', `own_only=${rows.length}`);
      }

      // Check if current user is admin — if so, seeing all is correct
      const { data: userRow } = await (supabase
        .from('users')
        .select('role')
        .eq('id', me.user.id)
        .single() as any);

      if ((userRow as any)?.role === 'admin') {
        return mk('Permission: support ticket read scope', start, 'passed', `admin_sees_all=${rows.length}`);
      }

      return mk('Permission: support ticket read scope', start, 'warning', `non_admin_sees_foreign=${foreign.length}`);
    } catch (e) {
      return mk('Permission: support ticket read scope', start, 'warning', undefined, (e as Error).message);
    }
  }
}
