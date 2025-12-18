import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { QuizQuestion } from '@/lib/quiz.types';

type ChallengePayload = {
  quiz: QuizQuestion[];
  score: number;
  total: number;
  authorName?: string | null;
};

let cachedClient: SupabaseClient | null = null;
let initAttempted = false;

function getAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  if (initAttempted) {
    return null;
  }

  initAttempted = true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[challenge] Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return null;
  }

  cachedClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'challenge-api',
      },
    },
  });

  return cachedClient;
}

export async function POST(request: Request) {
  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  let payload: ChallengePayload;

  try {
    payload = (await request.json()) as ChallengePayload;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  if (!Array.isArray(payload.quiz) || payload.quiz.length === 0) {
    return NextResponse.json({ error: 'Quiz manquant' }, { status: 400 });
  }

  const score = Number.parseInt(String(payload.score), 10);
  const total = Number.parseInt(String(payload.total), 10);

  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) {
    return NextResponse.json({ error: 'Score invalide' }, { status: 400 });
  }

  const authorName = payload.authorName?.trim().slice(0, 80) || null;

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
