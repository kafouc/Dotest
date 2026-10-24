import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { touchUserStreak } from '@/lib/streaks';
import { parseJsonBody, flashcardsGenerateSchema } from '@/lib/validation';
import { internalError } from '@/lib/apiError';

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, flashcardsGenerateSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { documentPath, limit } = parsedBody.data;

    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Récupère quelques sections du document pour fabriquer des cartes simples
    const { data: sections, error: secErr } = await supabase
      .from('document_sections')
      .select('content, document_path')
      .eq('user_id', user.id)
      .eq('document_path', documentPath)
      .limit(Math.min(200, limit * 5));
    if (secErr) throw secErr;

    const cards: { question: string; answer: string }[] = [];
    for (const s of sections || []) {
      const text = (s.content || '').trim();
      if (!text) continue;
      // Heuristique MVP: question "Que dit ce passage ?" + réponse = résumé court (troncature)
      const answer = text.split('\n')[0].slice(0, 240);
      const question = 'Que dit ce passage ?';
      if (answer.length > 30) {
        cards.push({ question, answer });
      }
      if (cards.length >= limit) break;
    }

    if (cards.length === 0) {
      return NextResponse.json({ created: 0, message: 'Aucune section exploitable.' }, { status: 200 });
    }

    const rows = cards.map((c) => ({
      user_id: user.id,
      document_path: documentPath,
      question: c.question,
      answer: c.answer,
    }));

    const { error: insErr, count } = await supabase
      .from('flashcards')
      .insert(rows, { count: 'exact' });
    if (insErr) throw insErr;

    await touchUserStreak(supabase, user.id);

    // Logger l'activité pour le dashboard admin
    const { logActivity } = await import('@/lib/metricsLogger');
    await logActivity({
      eventType: 'flashcards_generated',
      userId: user.id,
      eventData: {
        documentPath,
        cardCount: count ?? rows.length,
      },
    });

    return NextResponse.json({ created: count ?? rows.length }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    const lower = (msg || '').toLowerCase();
    if ((lower.includes('does not exist') || lower.includes('relation')) && lower.includes('flashcards')) {
      return NextResponse.json({
        error: "FLASHCARDS_TABLE_MISSING: Les tables 'flashcards' et 'flashcard_reviews' ne sont pas installées. Exécutez la migration supabase/migrations/20251106_flashcards.sql dans votre projet Supabase.",
      }, { status: 400 });
    }
    if ((lower.includes('does not exist') || lower.includes('relation')) && lower.includes('document_sections')) {
      return NextResponse.json({
        error: "DOCUMENT_SECTIONS_MISSING: La table 'document_sections' est absente. Veuillez exécuter les migrations initiales (voir docs/sql/INSTALL_STEP_BY_STEP.sql).",
      }, { status: 400 });
    }
    return internalError('flashcards-generate', e);
  }
}
