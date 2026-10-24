import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildNotification, type NotificationKind } from '@/lib/notifications';
import { isPushConfigured, sendPush, type StoredSubscription } from '@/lib/webPush';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Plafond par passage : les passages ont lieu toutes les 15 minutes, le reste est traité au suivant. */
const MAX_NOTIFICATIONS_PER_RUN = 300;
const CONCURRENCY = 10;

type Candidate = {
  user_id: string;
  kind: Exclude<NotificationKind, 'welcome' | 'test'>;
  local_day: string;
  due_count: number;
  new_count: number;
  quiz_error_due: number;
  reviewed_today: number;
  daily_goal: number;
  current_streak: number;
};

function authorized(request: Request): boolean {
  // Secret dédié, ou à défaut celui déjà utilisé par le calcul des statistiques (aucune nouvelle variable à créer)
  const secret = process.env.NOTIFY_CRON_SECRET || process.env.METRICS_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runInBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(task));
  }
}

/**
 * Appelée toutes les 15 minutes par pg_cron (pg_net). Pour chaque utilisateur dont l'heure locale correspond à un rappel
 * (matin, révision espacée, soir), réserve l'envoi du jour puis notifie tous ses appareils.
 */
async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: 'Clés VAPID manquantes' }, { status: 503 });

  const admin = getSupabaseAdmin('push-cron');
  if (!admin) return NextResponse.json({ error: 'Base indisponible' }, { status: 503 });

  const { data, error } = await admin.rpc('notification_candidates', { p_now: new Date().toISOString() });
  if (error) {
    logger.error('[push-cron] sélection impossible', { message: error.message, code: error.code });
    return NextResponse.json({ error: 'Sélection impossible' }, { status: 500 });
  }

  const candidates = ((data ?? []) as Candidate[]).slice(0, MAX_NOTIFICATIONS_PER_RUN);
  const summary = { candidates: candidates.length, sent: 0, skippedClaimed: 0, noDevice: 0, removedDevices: 0, errors: 0 };
  if (candidates.length === 0) return NextResponse.json(summary);

  const userIds = Array.from(new Set(candidates.map((c) => c.user_id)));
  const { data: subs, error: subsError } = await admin.from('push_subscriptions').select('user_id, endpoint, keys').in('user_id', userIds);
  if (subsError) {
    logger.error('[push-cron] abonnements illisibles', { message: subsError.message });
    return NextResponse.json({ error: 'Abonnements illisibles' }, { status: 500 });
  }
  const byUser = new Map<string, StoredSubscription[]>();
  for (const sub of (subs ?? []) as (StoredSubscription & { user_id: string })[]) {
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
  }

  await runInBatches(candidates, CONCURRENCY, async (candidate) => {
    try {
      const devices = byUser.get(candidate.user_id) ?? [];
      if (devices.length === 0) {
        summary.noDevice++;
        return;
      }

      // Réservation atomique : une seule exécution peut envoyer ce rappel pour cette journée
      const { data: claimed, error: claimError } = await admin.rpc('claim_notification', {
        p_user_id: candidate.user_id,
        p_kind: candidate.kind,
        p_local_day: candidate.local_day,
      });
      if (claimError) throw new Error(claimError.message);
      if (!claimed) {
        summary.skippedClaimed++;
        return;
      }

      const payload = buildNotification(candidate.kind, {
        dueCount: candidate.due_count,
        newCount: candidate.new_count,
        quizErrorDue: candidate.quiz_error_due,
        reviewedToday: candidate.reviewed_today,
        dailyGoal: candidate.daily_goal,
        currentStreak: candidate.current_streak,
      });

      let delivered = false;
      for (const device of devices) {
        const result = await sendPush(device, payload);
        if (result === 'sent') delivered = true;
        if (result === 'gone' && device.endpoint) {
          await admin.from('push_subscriptions').delete().eq('endpoint', device.endpoint);
          summary.removedDevices++;
        }
      }
      if (delivered) summary.sent++;
      else summary.errors++;
    } catch (err) {
      summary.errors++;
      logger.error('[push-cron] envoi échoué', err instanceof Error ? err : { err: String(err) });
    }
  });

  logger.info('[push-cron] terminé', summary);
  return NextResponse.json(summary);
}

export const POST = handle;
export const GET = handle;
