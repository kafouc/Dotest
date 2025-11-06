import type { SupabaseClient } from '@supabase/supabase-js';

export type Flashcard = {
  id: string;
  user_id: string;
  document_path: string | null;
  question: string;
  answer: string;
  created_at: string;
};

export type FlashcardWithDue = Flashcard & { due_at?: string | null };

export async function listDueFlashcards(
  supabase: SupabaseClient,
  params?: { documentPath?: string; limit?: number }
): Promise<FlashcardWithDue[]> {
  const { documentPath, limit = 20 } = params || {};
  // Jointure manuelle: on prend les dernières reviews pour chaque carte
  // Simplicité: on récupère les cartes puis on récupère la dernière review par carte
  let query = supabase.from('flashcards').select('*').order('created_at', { ascending: false }).limit(200);
  if (documentPath) query = query.eq('document_path', documentPath);
  const { data: cards, error } = await query;
  if (error) throw error;
  const cardIds = (cards ?? []).map((c) => c.id);
  if (cardIds.length === 0) return [];

  const { data: reviews } = await supabase
    .from('flashcard_reviews')
    .select('flashcard_id, due_at, reviewed_at')
    .in('flashcard_id', cardIds)
    .order('reviewed_at', { ascending: false });

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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
