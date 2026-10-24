import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { buildAccountExport } from '@/lib/accountExport';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { internalError } from '@/lib/apiError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/account/export : télécharge toutes les données personnelles de l'utilisateur connecté (JSON). */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    await enforceRateLimit(supabase, user.id, 'account-export');

    const exported = await buildAccountExport(supabase, user);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="sheet-of-paper-export-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    return internalError('account-export', error, "L'export a échoué. Réessayez dans un instant.");
  }
}
