import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { AI_MODELS, EMBEDDING_CONFIG } from '@/lib/constants';
import { createChunks } from '@/lib/chunking';
import { createJinaEmbeddings, extractEmbeddingsFromResponse } from '@/lib/jinaClient';
import { extractEmbeddingUsage, estimateEmbeddingCost } from '@/lib/aiUsage';
import { recordAiUsage, logActivity } from '@/lib/metricsLogger';
import { SAMPLE_DOCUMENT_NAME, SAMPLE_PAGES } from '@/lib/onboarding';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { internalError } from '@/lib/apiError';

export const runtime = 'nodejs';

/**
 * Crée un document d'exemple déjà analysé dans le compte de l'utilisateur : il peut générer un premier quiz
 * immédiatement, sans importer de fichier. Un seul exemple par compte (la route est idempotente).
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const filePath = `${user.id}/exemple-photosynthese.txt`;

    const { data: existing } = await supabase
      .from('documents')
      .select('id, file_path')
      .eq('user_id', user.id)
      .eq('file_path', filePath)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ documentPath: existing.file_path, documentId: existing.id, alreadyExisted: true });
    }

    await enforceRateLimit(supabase, user.id, 'onboarding-sample');

    const chunks = createChunks(SAMPLE_PAGES, EMBEDDING_CONFIG.CHUNK_SIZE, EMBEDDING_CONFIG.CHUNK_OVERLAP);
    const startedAt = Date.now();
    const response = await createJinaEmbeddings(chunks.map((c) => c.content), AI_MODELS.EMBEDDING);
    const embeddings = extractEmbeddingsFromResponse(response);
    if (embeddings.length !== chunks.length || embeddings.some((e) => e.length !== EMBEDDING_CONFIG.EMBEDDING_DIMENSION)) {
      throw new Error("Jina n'a pas retourné d'embeddings valides pour le document d'exemple.");
    }

    const usage = extractEmbeddingUsage(response);
    await recordAiUsage({
      provider: 'jina',
      model: AI_MODELS.EMBEDDING,
      promptTokens: usage.promptTokens,
      completionTokens: 0,
      totalTokens: usage.totalTokens,
      latencyMs: Date.now() - startedAt,
      cost: estimateEmbeddingCost(usage.totalTokens),
      metadata: { route: 'onboarding/sample', chunks: chunks.length },
      userId: user.id,
    });

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_name: SAMPLE_DOCUMENT_NAME,
        status: 'completed',
        status_message: `Document d'exemple : ${chunks.length} segments indexés`,
      })
      .select('id')
      .single();
    if (docError) throw new Error(docError.message);

    const { error: sectionsError } = await supabase.from('document_sections').insert(
      chunks.map((chunk, i) => ({
        user_id: user.id,
        content: chunk.content,
        embedding: embeddings[i],
        document_path: filePath,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
      }))
    );
    if (sectionsError) {
      await supabase.from('documents').delete().eq('id', doc.id);
      throw new Error(sectionsError.message);
    }

    await logActivity({ eventType: 'onboarding_sample_created', userId: user.id, eventData: { chunks: chunks.length } });

    return NextResponse.json({ documentPath: filePath, documentId: doc.id, alreadyExisted: false });
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    return internalError('onboarding-sample', error, "Impossible de créer le document d'exemple. Réessayez dans un instant.");
  }
}
