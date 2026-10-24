import { NextResponse } from 'next/server';
import { enforceIpRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

type RpcActiveSessionRow = {
  session_id: string | null;
  share_code: string;
  title: string;
  status: 'waiting' | 'active' | 'completed';
  started_at: string | null;
  expires_at: string | null;
  questions_count: number;
};

const ANSWER_KEYS = ['reponse_correcte', 'reponses_correctes', 'justification', 'evidence'];

/** Retire les clés de correction : l'élève ne doit jamais recevoir les bonnes réponses. */
function stripAnswers(questions: unknown): unknown[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    if (!q || typeof q !== 'object') return q;
    const copy = { ...(q as Record<string, unknown>) };
    for (const key of ANSWER_KEYS) delete copy[key];
    return copy;
  });
}

function getAdminClient() {
  return getSupabaseAdmin('live-quiz-api');
}

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    await enforceIpRateLimit(request, 'live-quiz-read');
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    throw error;
  }

  const adminClient = getAdminClient();

  if (!adminClient) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const shareCode = (params.code ?? '').trim().toUpperCase();

  if (!shareCode) {
    return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
  }

  const { data: quiz, error: quizError } = await adminClient
    .from('shared_quizzes')
    .select('id, title, questions, share_code, is_active, created_at, expires_at, qr_code_url')
    .eq('share_code', shareCode)
    .single();

  if (quizError) {
    if (quizError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Quiz introuvable ou expiré.' }, { status: 404 });
    }

    logger.error('[live-quiz] Erreur chargement quiz:', quizError);
    return NextResponse.json({ error: 'Erreur lors du chargement du quiz.' }, { status: 500 });
  }

  if (!quiz || !quiz.is_active || (quiz.expires_at && new Date(quiz.expires_at) <= new Date())) {
    return NextResponse.json({ error: 'Quiz inactif ou expiré.' }, { status: 404 });
  }

  let session: RpcActiveSessionRow | null = null;

  try {
    const { data: sessionData, error: sessionError } = await adminClient.rpc('list_active_session', {
      p_share_code: shareCode,
    });

    if (sessionError) {
      throw sessionError;
    }

    const row = Array.isArray(sessionData)
      ? (sessionData[0] as RpcActiveSessionRow | undefined)
      : (sessionData as RpcActiveSessionRow | null);

    if (row?.session_id) {
      session = row;
    }
  } catch (rpcError) {
    const err = rpcError as { code?: string };
    if (err?.code !== 'PGRST202') {
      logger.error('[live-quiz] Erreur récupération session:', rpcError);
      return NextResponse.json({ error: 'Erreur lors du chargement du quiz.' }, { status: 500 });
    }

    // Fallback direct query si la RPC n'est pas disponible (env incomplet)
    const { data: sessions, error: directError } = await adminClient
      .from('quiz_sessions')
      .select('id, status, started_at, created_at')
      .eq('shared_quiz_id', quiz.id)
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (directError) {
      logger.error('[live-quiz] Fallback session query failed:', directError);
      return NextResponse.json({ error: 'Erreur lors du chargement du quiz.' }, { status: 500 });
    }

    const directSession = sessions?.[0];
    if (directSession?.id) {
      session = {
        session_id: directSession.id,
        share_code: quiz.share_code,
        title: quiz.title,
        status: directSession.status as RpcActiveSessionRow['status'],
        started_at: directSession.started_at,
        expires_at: quiz.expires_at,
        questions_count: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
      };
    }
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      share_code: quiz.share_code,
      questions: stripAnswers(quiz.questions),
    },
    session,
  });
}
