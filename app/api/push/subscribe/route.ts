import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { parseJsonBody, pushSubscribeSchema } from '@/lib/validation';
import { internalError } from '@/lib/apiError';

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, pushSubscribeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { subscription } = parsedBody.data;
    const endpoint = subscription.endpoint;

    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // Upsert into push_subscriptions
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    return internalError('push-subscribe', e);
  }
}
