import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { createBillingPortalSession } from '@/lib/billing';
import { internalError } from '@/lib/apiError';

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

    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const origin = resolveOrigin(request);
    const session = await createBillingPortalSession({
      userId: user.id,
      email: user.email ?? null,
      returnUrl: `${origin}/app`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return internalError('billing-portal', error, 'Impossible de contacter le service de paiement. Réessayez dans un instant.');
  }
}
