import { NextResponse } from 'next/server';
import { enforceIpRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

function getAdminClient() {
  return getSupabaseAdmin('challenge-api');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await enforceIpRateLimit(request, 'challenge-read');
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    throw error;
  }

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const shareCode = ((await params).code ?? '').trim().toUpperCase();
  if (!shareCode) {
    return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
  }

  try {
    const { data, error } = await client
      .from('quiz_challenges')
      .select('quiz, score, total, author_name, created_at')
      .eq('share_code', shareCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Défi introuvable.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      quiz: data.quiz,
      score: data.score,
      total: data.total,
      authorName: data.author_name,
      createdAt: data.created_at,
      shareCode,
    });
  } catch (err) {
    logger.error('[challenge] Erreur récupération défi:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du défi.' }, { status: 500 });
  }
}
