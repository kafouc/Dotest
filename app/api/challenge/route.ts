import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { parseJsonBody, challengeSchema } from '@/lib/validation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function getAdminClient() {
  return getSupabaseAdmin('challenge-api');
}

export async function POST(request: Request) {
  if (!rateLimit(`challenge:${clientIp(request)}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
  }

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const parsedBody = await parseJsonBody(request, challengeSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const payload = parsedBody.data;
  const { score, total } = payload;

  const authorName = payload.authorName || null;

  try {
    const { data, error } = await client
      .from('quiz_challenges')
      .insert({
        quiz: payload.quiz,
        score,
        total,
        author_name: authorName,
      })
      .select('share_code')
      .single();

    if (error) {
      throw error;
    }

    // Logger l'activité pour le dashboard admin
    const { logActivity } = await import('@/lib/metricsLogger');
    await logActivity({
      eventType: 'challenge_created',
      userId: null,
      eventData: {
        shareCode: data.share_code,
        questionCount: payload.quiz.length,
        score,
        total,
        authorName,
      },
    });

    return NextResponse.json({ shareCode: data.share_code });
  } catch (error) {
    console.error('[challenge] Erreur création défi:', error);
    return NextResponse.json({ error: 'Impossible de créer le défi.' }, { status: 500 });
  }
}
