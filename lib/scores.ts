import type { SupabaseClient } from '@supabase/supabase-js';
import { createErrorCards } from '@/lib/flashcards';

export type AttemptContext = {
  document_path?: string;
  user_query?: string;
  num_questions: number;
  page_start?: number | null;
  page_end?: number | null;
};

export type AnswerInput = {
  questionIndex: number;
  question: string;
  answer: string | null;
  correctAnswer: string;
  justification?: string;
  isCorrect: boolean;
  /** Texte de la bonne réponse (pour créer une carte de révision quand la question est ratée) */
  correctAnswerText?: string;
  sourceLabel?: string | null;
};

export async function recordQuizAttempt(
  supabase: SupabaseClient,
  params: {
    answers: AnswerInput[];
    context?: AttemptContext;
    startedAt?: string;
    completedAt?: string;
  }
) {
  const {
    answers,
    context,
    startedAt = new Date().toISOString(),
    completedAt = new Date().toISOString(),
  } = params;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw userErr ?? new Error('Utilisateur non authentifié');
  }
  const userId = userData.user.id;

  const total = answers.length;
  const score = answers.filter((a) => a.isCorrect).length;

  // 1) Create attempt
  const { data: attempt, error: attemptErr } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      score,
      total_questions: total,
      started_at: startedAt,
      completed_at: completedAt,
      context: context ?? null,
    })
    .select('*')
    .single();

  if (attemptErr) throw attemptErr;

  // 2) Insert answers if any
  if (answers.length > 0) {
    const rows = answers.map((a) => ({
      attempt_id: attempt.id,
      question_index: a.questionIndex,
      question: a.question,
      answer: a.answer,
      correct_answer: a.correctAnswer,
      justification: a.justification ?? null,
      is_correct: a.isCorrect,
    }));

    const { error: ansErr } = await supabase.from('quiz_answers').insert(rows);
    if (ansErr) throw ansErr;
  }

  // 3) Les questions ratées deviennent des cartes de révision (espacées par l'algorithme de répétition)
  await createErrorCards(
    supabase,
    userId,
    answers
      .filter((a) => !a.isCorrect && a.correctAnswerText)
      .map((a) => ({
        question: a.question,
        correctAnswerText: a.correctAnswerText as string,
        justification: a.justification,
        sourceLabel: a.sourceLabel,
        documentPath: context?.document_path ?? null,
      }))
  );

  return attempt;
}
