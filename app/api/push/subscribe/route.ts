import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    type WebPushSubscription = {
      endpoint: string;
      expirationTime?: number | null;
      keys?: { p256dh?: string; auth?: string };
      [k: string]: unknown;
    };
    const { subscription } = (body ?? {}) as { subscription?: WebPushSubscription };
    if (!subscription) {
      return NextResponse.json({ error: 'subscription requis' }, { status: 400 });
    }

    const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
    const p256dh = subscription.keys?.p256dh ?? null;
    const auth = subscription.keys?.auth ?? null;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'subscription invalide (endpoint/keys manquants)' }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookies().set(name, value, options);
          },
          remove(name: string, options) {
            cookies().delete({ ...options, name });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // Upsert into push_subscriptions
    const row = {
      user_id: user.id,
      endpoint,
      keys: subscription?.keys ?? null,
      raw: subscription,
    };

    const { error } = await supabase.from('push_subscriptions').upsert(row, {
      onConflict: 'endpoint',
    });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    console.error('Push subscribe error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
