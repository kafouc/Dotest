import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createBillingPortalSession } from '@/lib/billing';

function resolveOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }
}

export async function POST(request: Request) {
  try {
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

    const origin = resolveOrigin(request);
    const session = await createBillingPortalSession({
      userId: user.id,
      email: user.email,
      returnUrl: `${origin}/app`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing] portal session error:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
