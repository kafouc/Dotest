import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseJsonBody, pushSubscribeSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, pushSubscribeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { subscription } = parsedBody.data;
    const endpoint = subscription.endpoint;

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
      keys: subscription.keys,
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
