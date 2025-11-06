import type { SupabaseClient } from '@supabase/supabase-js';

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
  const { data, error } = await supabase
    .from('shared_quizzes')
    .insert({
      title: params.title,
      questions: params.questions,
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
  sharedQuizId: string
): Promise<QuizSession> {
  // Utilise une RPC sécurisée côté DB pour éviter les erreurs RLS/500
  const { data, error } = await supabase.rpc('create_quiz_session', {
    p_shared_quiz_id: sharedQuizId,
  });

  if (error) throw error;
  // La RPC retourne la ligne quiz_sessions
  return data as unknown as QuizSession;
}

/**
 * Rejoindre une session avec un pseudo
 */
export async function joinSession(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    nickname: string;
  }
): Promise<SessionParticipant> {
  const { data, error } = await supabase
    .from('session_participants')
    .insert({
      session_id: params.sessionId,
      nickname: params.nickname,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soumettre une réponse
 */
export async function submitLiveAnswer(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    participantId: string;
    questionIndex: number;
    answer: string;
    answerText: string | null;
    isCorrect: boolean;
  }
) {
  const { error } = await supabase.from('live_answers').insert({
    session_id: params.sessionId,
    participant_id: params.participantId,
    question_index: params.questionIndex,
    answer: params.answer,
    answer_text: params.answerText,
    is_correct: params.isCorrect,
  });

  if (error) throw error;
}

/**
 * Récupérer un quiz partagé par son code
 */
export async function getSharedQuizByCode(
  supabase: SupabaseClient,
  shareCode: string
): Promise<SharedQuiz | null> {
  const { data, error } = await supabase
    .from('shared_quizzes')
    .select('*')
    .eq('share_code', shareCode.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
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
