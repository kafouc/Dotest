import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { syncUserPlanFromStripe } from '@/lib/billing';
import { internalError } from '@/lib/apiError';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 503 });
    }

    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const plan = await syncUserPlanFromStripe(user.id);
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    return internalError('billing-resync', error, 'Impossible de contacter le service de paiement. Réessayez dans un instant.');
  }
}
