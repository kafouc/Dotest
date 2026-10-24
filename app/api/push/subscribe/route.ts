import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { parseJsonBody, pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validation';
import { internalError } from '@/lib/apiError';
import { buildNotification, isValidTimeZone } from '@/lib/notifications';
import { isPushConfigured, sendPush } from '@/lib/webPush';
import { logger } from '@/lib/logger';

/** DELETE : retire l'appareil de l'utilisateur connecté (désactivation des notifications). */
export async function DELETE(req: Request) {
  try {
    const parsed = await parseJsonBody(req, pushUnsubscribeSchema);
    if (!parsed.ok) return parsed.response;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', parsed.data.endpoint);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return internalError('push-unsubscribe', e);
  }
}

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, pushSubscribeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { subscription, timezone } = parsedBody.data;
    const endpoint = subscription.endpoint;

    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // Appareil déjà accueilli ? (la notification de bienvenue n'est envoyée qu'à la première inscription de l'appareil)
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('welcomed_at')
      .eq('endpoint', endpoint)
      .maybeSingle();
    const alreadyWelcomed = Boolean((existing as { welcomed_at?: string | null } | null)?.welcomed_at);

    const row = {
      user_id: user.id,
      endpoint,
      keys: subscription.keys,
      raw: subscription,
    };

    const { error } = await supabase.from('push_subscriptions').upsert(row, {
      onConflict: 'endpoint',
    });
    if (error) throw error;

    // Fuseau horaire : les rappels du matin et du soir partent à l'heure locale de l'utilisateur
    if (timezone && isValidTimeZone(timezone)) {
      const { error: settingsError } = await supabase.from('user_settings').upsert({ user_id: user.id, timezone }, { onConflict: 'user_id' });
      if (settingsError) logger.warn('[push-subscribe] fuseau horaire non enregistré', { message: settingsError.message });
    }

    // Bienvenue : confirme à l'utilisateur que ça marche, immédiatement. Un échec ne doit jamais faire échouer l'inscription.
    let welcomed = false;
    if (!alreadyWelcomed && isPushConfigured()) {
      const result = await sendPush({ endpoint, keys: subscription.keys }, buildNotification('welcome'));
      welcomed = result === 'sent';
      if (welcomed) {
        const admin = getSupabaseAdmin('push-subscribe');
        await admin?.from('push_subscriptions').update({ welcomed_at: new Date().toISOString() }).eq('endpoint', endpoint);
      }
    }

    return NextResponse.json({ ok: true, welcomed }, { status: 200 });
  } catch (e: unknown) {
    return internalError('push-subscribe', e);
  }
}
