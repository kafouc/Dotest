import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function getAdminClient() {
  return getSupabaseAdmin('challenge-api');
}

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  if (!rateLimit(`challenge-get:${clientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const shareCode = (params.code ?? '').trim().toUpperCase();
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
    console.error('[challenge] Erreur récupération défi:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du défi.' }, { status: 500 });
  }
}
