import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { touchUserStreak } from '@/lib/streaks';
import { parseJsonBody, flashcardsReviewSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, flashcardsReviewSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { flashcardId, grade } = parsedBody.data; // grade : échelle SM-2 (0 à 5)

    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Récupère la dernière révision pour calcul SM-2 simplifié
    const { data: last } = await supabase
      .from('flashcard_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('flashcard_id', flashcardId)
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .single();

    let ease = last?.ease ?? 2.5;
    let reps = last?.repetitions ?? 0;
    let interval = last?.interval_days ?? 0;

    // SM-2 update
    if (grade >= 3) {
      if (reps === 0) {
        interval = 1;
      } else if (reps === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease);
      }
      reps += 1;
      ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    } else {
      reps = 0;
      interval = 1; // On revoit demain
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + interval);

    const { error: insErr } = await supabase
      .from('flashcard_reviews')
      .insert({
        user_id: user.id,
        flashcard_id: flashcardId,
        grade,
        ease,
        interval_days: interval,
        repetitions: reps,
        due_at: dueAt.toISOString(),
      });
    if (insErr) throw insErr;

    await touchUserStreak(supabase, user.id);

    return NextResponse.json({ ok: true, next: dueAt.toISOString() });
  } catch (e: unknown) {
    console.error('Flashcards review error:', e);
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
