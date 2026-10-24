// app/api/documents/status/route.ts
// API pour surveiller l'état du traitement d'un document

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { parseSearchParams, documentStatusQuerySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const parsedQuery = parseSearchParams(req, documentStatusQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;
    const documentId = parsedQuery.data.id;

    // 1. Créer le client Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante' },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient();

    // 2. Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 3. Récupérer l'état du document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, file_path, status, status_message, created_at')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    // 4. Compter les chunks indexés si le document est en cours de traitement
    let chunksIndexed = 0;
    if (doc.status === 'processing' || doc.status === 'completed') {
      const { count, error: countError } = await supabase
        .from('document_sections')
        .select('*', { count: 'exact', head: true })
        .eq('document_path', doc.file_path);

      if (!countError && count !== null) {
        chunksIndexed = count;
      }
    }

    // 5. Calculer le temps écoulé
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(doc.created_at).getTime()) / 60000
    );

    return NextResponse.json({
      id: doc.id,
      file_name: doc.file_name,
      status: doc.status,
      status_message: doc.status_message,
      chunks_indexed: chunksIndexed,
      elapsed_minutes: elapsedMinutes,
      created_at: doc.created_at,
    });
  } catch (error: unknown) {
    console.error('[Document Status] Erreur:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erreur interne';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
