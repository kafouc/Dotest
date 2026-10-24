import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserPlan } from './subscriptions';
import { PLAN_LIMITS } from './constants';
import type { SubscriptionPlan } from './subscriptions';

export type SharedQuiz = {
  id: string;
  creator_id: string;
  title: string;
  questions: unknown[];
  share_code: string;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
};

/** Question telle que vue par un élève : sans clés de correction. */
export type PublicQuizQuestion = {
  question: string;
  options: { [key: string]: string };
};

/** Quiz tel que vu par un élève : sans `reponse_correcte`, `reponses_correctes` ni `justification`. */
export type PublicQuiz = {
  id: string;
  title: string;
  share_code: string;
  questions: PublicQuizQuestion[];
};

export type SubmitAnswerResult = {
  is_correct: boolean;
  correct_answer: string;
  justification: string | null;
};

export type QuizSession = {
  id: string;
  shared_quiz_id: string;
  status: 'waiting' | 'active' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  nickname: string;
  user_id: string | null;
  joined_at: string;
  last_activity_at: string;
};

export type LiveAnswer = {
  id: string;
  session_id: string;
  participant_id: string;
  question_index: number;
  answer: string;
  answer_text: string | null;
  is_correct: boolean;
  answered_at: string;
};

export type ActiveSessionInfo = {
  session_id: string | null;
  share_code: string;
  title: string;
  status: 'waiting' | 'active' | 'completed';
  started_at: string | null;
  expires_at: string | null;
  questions_count: number;
};

/**
 * Crée un quiz partagé
 */
export async function createSharedQuiz(
  supabase: SupabaseClient,
  params: {
    title: string;
    questions: unknown[];
  }
): Promise<SharedQuiz> {
  const planRow = await fetchUserPlan(supabase);
  const plan = (planRow?.plan as SubscriptionPlan | null) ?? 'freemium';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.freemium;

  const { data, error } = await supabase
    .from('shared_quizzes')
    .insert({
      title: params.title,
      // `evidence` (citation qui contient la réponse) ne doit jamais être stockée dans un quiz partagé
      questions: params.questions.map((q) => {
        if (!q || typeof q !== 'object') return q;
        const copy = { ...(q as Record<string, unknown>) };
        delete copy.evidence;
        return copy;
      }),
      max_participants: limits.liveParticipants,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Crée une session de quiz
 */
export async function createQuizSession(
  supabase: SupabaseClient,
  sharedQuizId: string,
  classId?: string | null
): Promise<QuizSession> {
  // Utilise une RPC sécurisée côté DB pour éviter les erreurs RLS/500.
  // `p_class_id` n'est envoyé que si une classe est choisie (compatible avec l'ancienne signature).
  const { data, error } = await supabase.rpc('create_quiz_session', {
    p_shared_quiz_id: sharedQuizId,
    ...(classId ? { p_class_id: classId } : {}),
  });

  if (error) throw error;
  // La RPC retourne la ligne quiz_sessions
  return data as unknown as QuizSession;
}

/**
 * Rejoindre une session avec un pseudo (RPC : valide l'état de la session).
 * Le `token` retourné authentifie les réponses suivantes : à garder en mémoire côté élève.
 */
export async function joinSession(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    nickname: string;
  }
): Promise<SessionParticipant & { token: string }> {
  const { data, error } = await supabase.rpc('join_session', {
    p_session_id: params.sessionId,
    p_nickname: params.nickname,
  });

  if (error) throw error;
  const row = data as { id: string; session_id: string; nickname: string; token: string };
  const now = new Date().toISOString();
  return {
    id: row.id,
    session_id: row.session_id,
    nickname: row.nickname,
    token: row.token,
    user_id: null,
    joined_at: now,
    last_activity_at: now,
  };
}

/**
 * Soumettre une réponse : la correction est calculée côté base.
 */
export async function submitLiveAnswer(
  supabase: SupabaseClient,
  params: {
    participantId: string;
    token: string;
    questionIndex: number;
    answer: string;
  }
): Promise<SubmitAnswerResult> {
  const { data, error } = await supabase.rpc('submit_live_answer', {
    p_participant_id: params.participantId,
    p_token: params.token,
    p_question_index: params.questionIndex,
    p_answer: params.answer,
  });

  if (error) throw error;
  return data as SubmitAnswerResult;
}

/**
 * Récupérer un quiz partagé par son code, sans les bonnes réponses (RPC publique)
 */
export async function getSharedQuizByCode(
  supabase: SupabaseClient,
  shareCode: string
): Promise<PublicQuiz | null> {
  const { data, error } = await supabase.rpc('get_public_quiz', {
    p_share_code: shareCode.toUpperCase(),
  });

  if (error) throw error;
  return (data as PublicQuiz | null) ?? null;
}

/**
 * Récupérer la session active/en attente pour un code de partage
 * via la RPC SECURITY DEFINER côté DB (bypass RLS lecture pour les élèves)
 */
export async function getActiveSessionByShareCode(
  supabase: SupabaseClient,
  shareCode: string
): Promise<ActiveSessionInfo | null> {
  const { data, error } = await supabase.rpc('list_active_session', {
    p_share_code: shareCode.toUpperCase(),
  });

  if (error) throw error;
  if (!data) return null;

  // Supabase peut retourner un objet ou un tableau selon la définition; normalisons en objet
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    session_id: row.session_id ?? null,
    share_code: row.share_code,
    title: row.title,
    status: row.status,
    started_at: row.started_at ?? null,
    expires_at: row.expires_at ?? null,
    questions_count: row.questions_count ?? 0,
  } as ActiveSessionInfo;
}

/**
 * Récupérer une session par ID
 */
export async function getSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<QuizSession | null> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Démarrer une session
 */
export async function startSession(
  supabase: SupabaseClient,
  sessionId: string
) {
  const { error } = await supabase
    .from('quiz_sessions')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

/**
 * Terminer une session
 */
export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string
) {
  const { error } = await supabase
    .from('quiz_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

/**
 * Récupérer les participants d'une session
 */
export async function getSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionParticipant[]> {
  const { data, error } = await supabase
    .from('session_participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Récupérer les réponses d'une session
 */
export async function getSessionAnswers(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LiveAnswer[]> {
  const { data, error } = await supabase
    .from('live_answers')
    .select('*')
    .eq('session_id', sessionId)
    .order('answered_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
