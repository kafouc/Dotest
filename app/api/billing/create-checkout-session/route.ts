import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createCheckoutSession } from '@/lib/billing';
import { parseJsonBody, checkoutSchema } from '@/lib/validation';

function getOrigin(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }
}

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJsonBody(request, checkoutSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { plan } = parsedBody.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 503 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
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
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const origin = getOrigin(request);
    const successUrl = `${origin}/app?checkout=${plan}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/settings?checkout=cancel`;

    const session = await createCheckoutSession({
      userId: user.id,
      plan,
      email: user.email ?? null,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing] checkout session error:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
