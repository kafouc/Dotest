import type { SupabaseClient } from '@supabase/supabase-js';
import type { RpcReturns, Tables, TablesInsert } from '@/lib/dbTypes';

/** Accès aux classes d'un enseignant et à leurs statistiques (migration teacher_classes). */

export type ClassRow = Pick<Tables<'classes'>, 'id' | 'name' | 'level' | 'archived' | 'created_at'>;

// Les colonnes ci-dessus sont vérifiées par TypeScript contre le schéma réel de la base.
const CLASS_COLUMNS = 'id, name, level, archived, created_at' satisfies string;

/** Ligne de class_sessions_summary(), typée d'après la base ; seul le statut est précisé. */
export type ClassSessionSummary = Omit<RpcReturns<'class_sessions_summary'>[number], 'status' | 'started_at' | 'completed_at'> & {
  status: 'waiting' | 'active' | 'completed';
  started_at: string | null;
  completed_at: string | null;
};

export type QuestionStat = {
  question_index: number;
  question: string;
  answers: number;
  correct: number;
  success_pct: number | null;
};

export type StudentScore = { session_id: string; score_pct: number | null; answered: number };

export type StudentProgress = {
  nickname: string;
  sessions_count: number;
  avg_score_pct: number | null;
  last_session_at: string | null;
  scores: StudentScore[];
};

export type UnassignedSession = {
  id: string;
  created_at: string;
  status: string;
  title: string;
};

/** La migration teacher_classes n'est pas appliquée (table ou fonction absente). */
export function isClassesUnavailable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    /could not find the (function|table)|does not exist|schema cache/i.test(error.message ?? '')
  );
}

/** Limite de classes du forfait atteinte (levée par le trigger enforce_class_limit). */
export function isClassLimitError(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === 'P0001' || /nombre maximal de classes/i.test(error.message ?? '')));
}

export async function listClasses(supabase: SupabaseClient, includeArchived = false): Promise<ClassRow[]> {
  let query = supabase.from('classes').select(CLASS_COLUMNS).order('created_at', { ascending: false });
  if (!includeArchived) query = query.eq('archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function getClass(supabase: SupabaseClient, classId: string): Promise<ClassRow | null> {
  const { data, error } = await supabase.from('classes').select(CLASS_COLUMNS).eq('id', classId).maybeSingle();
  if (error) throw error;
  return (data as ClassRow | null) ?? null;
}

export async function createClass(supabase: SupabaseClient, params: { name: string; level?: string | null }): Promise<ClassRow> {
  const row: TablesInsert<'classes'> = { name: params.name.trim(), level: params.level?.trim() || null };
  const { data, error } = await supabase.from('classes').insert(row).select(CLASS_COLUMNS).single();
  if (error) throw error;
  return data as ClassRow;
}

export async function setClassArchived(supabase: SupabaseClient, classId: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('classes').update({ archived }).eq('id', classId);
  if (error) throw error;
}

export async function getClassSessions(supabase: SupabaseClient, classId: string): Promise<ClassSessionSummary[]> {
  const { data, error } = await supabase.rpc('class_sessions_summary', { p_class_id: classId });
  if (error) throw error;
  return ((data ?? []) as ClassSessionSummary[]).map((row) => ({
    ...row,
    avg_score_pct: Number(row.avg_score_pct),
    completion_pct: Number(row.completion_pct),
  }));
}

export async function getQuestionStats(supabase: SupabaseClient, classId: string, sessionId: string): Promise<QuestionStat[]> {
  const { data, error } = await supabase.rpc('class_question_stats', { p_class_id: classId, p_session_id: sessionId });
  if (error) throw error;
  return ((data ?? []) as QuestionStat[]).map((row) => ({ ...row, success_pct: row.success_pct === null ? null : Number(row.success_pct) }));
}

export async function getStudentsProgress(supabase: SupabaseClient, classId: string): Promise<StudentProgress[]> {
  const { data, error } = await supabase.rpc('class_students_progress', { p_class_id: classId });
  if (error) throw error;
  return ((data ?? []) as StudentProgress[]).map((row) => ({
    ...row,
    avg_score_pct: row.avg_score_pct === null ? null : Number(row.avg_score_pct),
    scores: Array.isArray(row.scores) ? row.scores : [],
  }));
}

/** Séances passées de l'enseignant qui ne sont rattachées à aucune classe. */
export async function listUnassignedSessions(supabase: SupabaseClient, limit = 50): Promise<UnassignedSession[]> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('id, created_at, status, shared_quizzes(title)')
    .is('class_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; created_at: string; status: string; shared_quizzes: { title: string } | { title: string }[] | null }[]).map((row) => {
    const quiz = Array.isArray(row.shared_quizzes) ? row.shared_quizzes[0] : row.shared_quizzes;
    return { id: row.id, created_at: row.created_at, status: row.status, title: quiz?.title ?? 'Quiz' };
  });
}

export async function assignSessionToClass(supabase: SupabaseClient, sessionId: string, classId: string): Promise<void> {
  const { error } = await supabase.from('quiz_sessions').update({ class_id: classId }).eq('id', sessionId);
  if (error) throw error;
}
