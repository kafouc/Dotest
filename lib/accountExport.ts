import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Export des données personnelles (droit d'accès et à la portabilité).
 * Lecture sous la session de l'utilisateur : la RLS garantit qu'il ne peut voir que ses propres lignes.
 * Les vecteurs (embeddings) ne sont pas exportés : ils n'ont aucun sens hors de l'application. Le texte extrait de vos documents
 * l'est lui via les liens vers les fichiers d'origine.
 */

export const EXPORT_ROW_LIMIT = 5_000;
const FILE_LINK_TTL_SECONDS = 3_600;

type Section = { rows: unknown[]; truncated: boolean };

type Filterable = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & {
  in: (column: string, values: unknown[]) => Filterable;
};

async function fetchRows(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  inFilter?: { column: string; values: unknown[] }
): Promise<{ section?: Section; error?: string }> {
  try {
    let query = supabase.from(table).select(columns).limit(EXPORT_ROW_LIMIT + 1) as unknown as Filterable;
    if (inFilter) query = query.in(inFilter.column, inFilter.values);
    const { data, error } = await query;
    if (error) return { error: `${table} : ${error.message}` };
    const rows = data ?? [];
    return { section: { rows: rows.slice(0, EXPORT_ROW_LIMIT), truncated: rows.length > EXPORT_ROW_LIMIT } };
  } catch (error) {
    return { error: `${table} : ${error instanceof Error ? error.message : 'erreur inconnue'}` };
  }
}

export type AccountExport = {
  exporte_le: string;
  note: string;
  compte: { id: string; email: string | undefined; cree_le: string | undefined; derniere_connexion: string | null | undefined };
  donnees: Record<string, unknown[]>;
  tronque: string[];
  fichiers_originaux: { nom: string; lien_valable_1h: string }[];
  erreurs: string[];
};

export async function buildAccountExport(supabase: SupabaseClient, user: User): Promise<AccountExport> {
  const errors: string[] = [];
  const truncated: string[] = [];
  const data: Record<string, unknown[]> = {};

  const tables: { key: string; table: string; columns: string; order?: string }[] = [
    { key: 'documents', table: 'documents', columns: 'id, file_name, file_path, status, created_at' },
    { key: 'cartes_de_revision', table: 'flashcards', columns: 'id, document_path, question, answer, source, created_at' },
    { key: 'revisions_de_cartes', table: 'flashcard_reviews', columns: 'flashcard_id, grade, interval_days, due_at, reviewed_at' },
    { key: 'tentatives_de_quiz', table: 'quiz_attempts', columns: 'id, score, total_questions, created_at, context' },
    { key: 'quiz_partages', table: 'shared_quizzes', columns: 'id, title, questions, share_code, created_at' },
    { key: 'classes', table: 'classes', columns: 'id, name, level, archived, created_at' },
    { key: 'forfait', table: 'user_plans', columns: 'plan, assigned_at, updated_at' },
    { key: 'abonnement_paiement', table: 'billing_customers', columns: 'plan, subscription_status, current_period_end, stripe_customer_id' },
    { key: 'serie_de_jours', table: 'user_streaks', columns: 'current_streak, longest_streak, last_active_date' },
    { key: 'reglages', table: 'user_settings', columns: 'daily_goal, updated_at' },
    { key: 'appareils_notifications', table: 'push_subscriptions', columns: 'created_at' },
    { key: 'activite', table: 'activity_events', columns: 'event_type, event_data, occurred_at' },
  ];

  const results = await Promise.all(tables.map((t) => fetchRows(supabase, t.table, t.columns)));
  results.forEach((result, index) => {
    const { key } = tables[index];
    if (result.error) errors.push(result.error);
    data[key] = result.section?.rows ?? [];
    if (result.section?.truncated) truncated.push(key);
  });

  // Réponses détaillées des tentatives de quiz
  const attemptIds = (data.tentatives_de_quiz as { id: number }[]).map((a) => a.id);
  const answers: unknown[] = [];
  for (let i = 0; i < attemptIds.length && answers.length < EXPORT_ROW_LIMIT; i += 200) {
    const chunk = attemptIds.slice(i, i + 200);
    const result = await fetchRows(
      supabase,
      'quiz_answers',
      'attempt_id, question_index, question, answer, correct_answer, justification, is_correct',
      { column: 'attempt_id', values: chunk }
    );
    if (result.error) {
      errors.push(result.error);
      break;
    }
    answers.push(...(result.section?.rows ?? []));
  }
  data.reponses_aux_quiz = answers.slice(0, EXPORT_ROW_LIMIT);
  if (answers.length > EXPORT_ROW_LIMIT) truncated.push('reponses_aux_quiz');

  // Liens temporaires vers les fichiers d'origine
  const files: AccountExport['fichiers_originaux'] = [];
  const docs = data.documents as { file_name: string; file_path: string }[];
  const paths = docs.map((d) => d.file_path).filter(Boolean);
  if (paths.length > 0) {
    try {
      const { data: signed, error } = await supabase.storage.from('pdfs').createSignedUrls(paths, FILE_LINK_TTL_SECONDS);
      if (error) errors.push(`fichiers : ${error.message}`);
      (signed ?? []).forEach((item) => {
        if (item.signedUrl && item.path) {
          files.push({ nom: docs.find((d) => d.file_path === item.path)?.file_name ?? item.path, lien_valable_1h: item.signedUrl });
        }
      });
    } catch (error) {
      errors.push(`fichiers : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
  }

  return {
    exporte_le: new Date().toISOString(),
    note:
      "Export de vos données personnelles Sheet of Paper. Les vecteurs d'indexation ne sont pas inclus. Les liens vers vos fichiers d'origine expirent au bout d'une heure : téléchargez-les rapidement.",
    compte: { id: user.id, email: user.email, cree_le: user.created_at, derniere_connexion: user.last_sign_in_at },
    donnees: data,
    tronque: truncated,
    fichiers_originaux: files,
    erreurs: errors,
  };
}
