import webpush from 'web-push';
import type { PushPayload } from '@/lib/notifications';

/**
 * Envoi de notifications push (protocole Web Push, clés VAPID). Les clés sont déjà configurées sur Vercel :
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY.
 */

export type StoredSubscription = {
  endpoint: string | null;
  keys: { p256dh?: string | null; auth?: string | null } | null;
};

export type PushResult = 'sent' | 'gone' | 'invalid' | 'error';

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure(): void {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT ?? 'mailto:kafoumathieu.coulibaly@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  configured = true;
}

/**
 * `gone` : le navigateur a supprimé l'abonnement (404/410) → à retirer de la base.
 * `invalid` : abonnement incomplet. `error` : panne temporaire, on réessaiera au prochain passage.
 */
export async function sendPush(subscription: StoredSubscription, payload: PushPayload, ttlSeconds = 3600): Promise<PushResult> {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return 'invalid';
  if (!isPushConfigured()) return 'error';

  try {
    configure();
    await webpush.sendNotification({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, JSON.stringify({ ...payload, data: { url: payload.url } }), {
      TTL: ttlSeconds,
      urgency: 'normal',
    });
    return 'sent';
  } catch (error) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    return status === 404 || status === 410 ? 'gone' : 'error';
  }
}
