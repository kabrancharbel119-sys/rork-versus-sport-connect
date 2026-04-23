import { supabase } from '@/lib/supabase';
import type { QaStepResult } from '@/qa/types';

interface StressRunConfig {
  label: string;
  concurrency: number;
  request: () => Promise<void>;
}

const mk = (name: string, started: number, status: QaStepResult['status'], details?: string, metrics?: Record<string, number>, error?: string): QaStepResult => ({
  id: `${name}-${started}`,
  name,
  status,
  durationMs: Math.max(1, Date.now() - started),
  details,
  metrics,
  error,
});

export class StressEngine {
  private async runConcurrent(config: StressRunConfig): Promise<QaStepResult> {
    const start = Date.now();
    let failed = 0;

    await Promise.all(
      Array.from({ length: config.concurrency }).map(async () => {
        try {
          await config.request();
        } catch {
          failed += 1;
        }
      }),
    );

    const totalMs = Date.now() - start;
    const success = config.concurrency - failed;
    const failureRate = config.concurrency > 0 ? failed / config.concurrency : 0;
    const status: QaStepResult['status'] = failureRate > 0.2 ? 'failed' : failureRate > 0 ? 'warning' : 'passed';

    return mk(
      `Stress: ${config.label}`,
      start,
      status,
      `concurrency=${config.concurrency}, success=${success}, failed=${failed}`,
      {
        concurrency: config.concurrency,
        success,
        failed,
        failureRate,
        avgMsPerRequest: config.concurrency > 0 ? totalMs / config.concurrency : 0,
      },
    );
  }

  async runCoreStressSuite(): Promise<QaStepResult[]> {
    const readUsers = await this.runConcurrent({
      label: 'users read burst',
      concurrency: 100,
      request: async () => {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
      },
    });

    const readMatches = await this.runConcurrent({
      label: 'matches read burst',
      concurrency: 80,
      request: async () => {
        const { error } = await supabase.from('matches').select('id,status').limit(5);
        if (error) throw error;
      },
    });

    const readChat = await this.runConcurrent({
      label: 'chat messages read burst',
      concurrency: 120,
      request: async () => {
        const { error } = await supabase.from('chat_messages').select('id').limit(5);
        if (error) throw error;
      },
    });

    const readTournaments = await this.runConcurrent({
      label: 'tournaments read burst',
      concurrency: 60,
      request: async () => {
        const { error } = await supabase.from('tournaments').select('id,status').limit(5);
        if (error) throw error;
      },
    });

    const readBookings = await this.runConcurrent({
      label: 'bookings read burst',
      concurrency: 60,
      request: async () => {
        const { error } = await supabase.from('bookings').select('id,status').limit(5);
        if (error) throw error;
      },
    });

    const readNotifications = await this.runConcurrent({
      label: 'notifications read burst',
      concurrency: 80,
      request: async () => {
        const { error } = await supabase.from('notifications').select('id,is_read').limit(5);
        if (error) throw error;
      },
    });

    const readRankings = await this.runConcurrent({
      label: 'player_rankings read burst',
      concurrency: 50,
      request: async () => {
        const { error } = await supabase.from('player_rankings').select('user_id,elo_rating').limit(5);
        if (error) throw error;
      },
    });

    const readVenues = await this.runConcurrent({
      label: 'venues read burst',
      concurrency: 50,
      request: async () => {
        const { error } = await supabase.from('venues').select('id').limit(5);
        if (error) throw error;
      },
    });

    return [readUsers, readMatches, readChat, readTournaments, readBookings, readNotifications, readRankings, readVenues];
  }
}
