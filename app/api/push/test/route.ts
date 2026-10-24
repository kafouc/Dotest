import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { buildNotification } from '@/lib/notifications';
import { isPushConfigured, sendPush, type StoredSubscription } from '@/lib/webPush';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { internalError } from '@/lib/apiError';

export const runtime = 'nodejs';

/** POST /api/push/test : envoie une notification de test aux appareils de l'utilisateur connecté. */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!isPushConfigured()) return NextResponse.json({ error: 'Les notifications ne sont pas configurées sur ce serveur.' }, { status: 503 });

    await enforceRateLimit(supabase, user.id, 'push-test');

    const { data, error } = await supabase.from('push_subscriptions').select('endpoint, keys').eq('user_id', user.id);
    if (error) throw error;
    const devices = (data ?? []) as StoredSubscription[];
    if (devices.length === 0) {
      return NextResponse.json({ error: "Aucun appareil enregistré : activez d'abord les notifications." }, { status: 404 });
    }

    const payload = buildNotification('test');
    const results = await Promise.all(devices.map((device) => sendPush(device, payload)));
    const sent = results.filter((r) => r === 'sent').length;
    const gone = devices.filter((_, i) => results[i] === 'gone').map((d) => d.endpoint as string);
    if (gone.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', gone);

    if (sent === 0) {
      return NextResponse.json({ error: "Impossible de joindre l'appareil. Désactivez puis réactivez les notifications." }, { status: 502 });
    }
    return NextResponse.json({ sent, devices: devices.length });
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    return internalError('push-test', error);
  }
}
