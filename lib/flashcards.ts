import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@/lib/dbTypes';

/** Carte de révision, typée d'après la table `flashcards` ; `source` vaut `quiz_error` pour une carte tirée d'une question ratée. */
export type Flashcard = Pick<Tables<'flashcards'>, 'id' | 'document_path' | 'question' | 'answer' | 'created_at'> & {
  user_id?: string;
  source?: 'generated' | 'quiz_error';
};

export type FlashcardWithDue = Flashcard & { due_at?: string | null };

export async function listDueFlashcards(
  supabase: SupabaseClient,
  params?: { documentPath?: string; limit?: number }
): Promise<FlashcardWithDue[]> {
  const { documentPath, limit = 20 } = params || {};

  // Fonction SQL (migration review_today) : une requête, déjà triée (retards d'abord, puis nouvelles cartes)
  const rpc = await supabase.rpc('list_due_flashcards', { p_document_path: documentPath ?? null, p_limit: limit });
  if (!rpc.error) return (rpc.data ?? []) as FlashcardWithDue[];

  // Migration pas encore appliquée : ancienne méthode (jointure côté navigateur)
  // Jointure manuelle: on prend les dernières reviews pour chaque carte
  // Simplicité: on récupère les cartes puis on récupère la dernière review par carte
  let query = supabase.from('flashcards').select('*').order('created_at', { ascending: false }).limit(200);
  if (documentPath) query = query.eq('document_path', documentPath);
  const { data: cards, error } = await query;
  if (error) {
    const err = error as unknown as { message?: string; status?: number };
    const msg = (err.message || '').toLowerCase();
    const isMissing = msg.includes('does not exist') || (msg.includes('relation') && msg.includes('flashcards'));
    if (isMissing || err.status === 404) {
      throw new Error('FLASHCARDS_TABLE_MISSING');
    }
    throw error;
  }
  const cardIds = (cards ?? []).map((c) => c.id);
  if (cardIds.length === 0) return [];

  const { data: reviews, error: revErr } = await supabase
    .from('flashcard_reviews')
    .select('flashcard_id, due_at, reviewed_at')
    .in('flashcard_id', cardIds)
    .order('reviewed_at', { ascending: false });
  if (revErr) {
    const err = revErr as unknown as { message?: string; status?: number };
    const msg = (err.message || '').toLowerCase();
    const isMissing = msg.includes('does not exist') || (msg.includes('relation') && msg.includes('flashcard_reviews'));
    if (isMissing || err.status === 404) {
      throw new Error('FLASHCARDS_TABLE_MISSING');
    }
  }

  const lastDue = new Map<string, string>();
  for (const r of reviews || []) {
    if (!lastDue.has(r.flashcard_id)) lastDue.set(r.flashcard_id, r.due_at as string);
  }
  const now = new Date();
  const dueCards = (cards || [])
    .map((c) => ({ ...c, due_at: lastDue.get(c.id) || null }))
    .filter((c) => !c.due_at || new Date(c.due_at) <= now)
    .slice(0, limit);
  return dueCards as FlashcardWithDue[];
}

export async function reviewFlashcard(
  flashcardId: string,
  grade: 0 | 1 | 2 | 3 | 4 | 5
) {
  const res = await fetch('/api/flashcards/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flashcardId, grade }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateFlashcards(documentPath: string, limit = 20) {
  const res = await fetch('/api/flashcards/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentPath, limit }),
  });
  if (!res.ok) {
    let text = await res.text();
    try { const j = JSON.parse(text); text = j.error || text; } catch {}
    throw new Error(text);
  }
  return res.json();
}


// ---------------------------------------------------------------------------
// Révision du jour
// ---------------------------------------------------------------------------

export type ReviewSummary = {
  dueCount: number;
  newCount: number;
  quizErrorDue: number;
  reviewedToday: number;
  dailyGoal: number;
};

export const DAILY_GOAL_OPTIONS = [5, 10, 20, 30] as const;

/** Compteurs de la page « À réviser aujourd'hui ». Renvoie null si la migration review_today n'est pas appliquée. */
export async function getReviewSummary(supabase: SupabaseClient): Promise<ReviewSummary | null> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  const { data, error } = await supabase.rpc('review_summary', { p_timezone: timezone });
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { due_count: number; new_count: number; quiz_error_due: number; reviewed_today: number; daily_goal: number }
    | undefined;
  if (!row) return null;
  return {
    dueCount: row.due_count,
    newCount: row.new_count,
    quizErrorDue: row.quiz_error_due,
    reviewedToday: row.reviewed_today,
    dailyGoal: row.daily_goal,
  };
}

export async function setDailyGoal(supabase: SupabaseClient, goal: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Utilisateur non authentifié');
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userData.user.id, daily_goal: goal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Clé stable d'une question (sans accents, casse ni ponctuation) : une seule carte par question et par utilisateur. */
export function questionKey(question: string): string {
  const text = question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // Deux empreintes 32 bits (djb2 et sdbm) : collisions négligeables à l'échelle d'un utilisateur
  let h1 = 5381;
  let h2 = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = (c + (h2 << 6) + (h2 << 16) - h2) | 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${text.length.toString(36)}`;
}

export type ErrorCardInput = {
  question: string;
  correctAnswerText: string;
  justification?: string | null;
  sourceLabel?: string | null;
  documentPath?: string | null;
};

/**
 * Transforme les questions ratées d'un quiz en cartes de révision. Les doublons sont ignorés (clé unique) ;
 * toute erreur est avalée : la sauvegarde du quiz ne doit jamais échouer à cause de cette fonction.
 */
export async function createErrorCards(supabase: SupabaseClient, userId: string, items: ErrorCardInput[]): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items.map((item) => {
    const lines = [`Bonne réponse : ${item.correctAnswerText}`];
    if (item.justification) lines.push('', item.justification);
    if (item.sourceLabel) lines.push('', `Source : ${item.sourceLabel}`);
    return {
      user_id: userId,
      document_path: item.documentPath ?? null,
      question: item.question,
      answer: lines.join('\n'),
      source: 'quiz_error',
      question_key: questionKey(item.question),
    };
  });
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .upsert(rows, { onConflict: 'user_id,question_key', ignoreDuplicates: true })
      .select('id');
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}
