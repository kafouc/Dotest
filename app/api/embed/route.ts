import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { extractText } from 'unpdf';
import { EMBEDDING_CONFIG, AI_MODELS } from '@/lib/constants';
import { chunkText } from '@/lib/chunking';
import { recordAiUsage } from '@/lib/metricsLogger';
import { extractEmbeddingUsage, estimateEmbeddingCost } from '@/lib/aiUsage';
import { createJinaEmbeddings, extractEmbeddingsFromResponse } from '@/lib/jinaClient';
import { internalError } from '@/lib/apiError';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path: filePath } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: 'Chemin du fichier ("path") manquant' },
        { status: 400 }
      );
    }

    // 1. Crée un client Supabase
    const supabase = await createSupabaseServerClient();

    // 2. Vérifie l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await enforceRateLimit(supabase, user.id, 'embed');
    // 3. Télécharge le fichier PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);
    if (downloadError) {
      throw new Error(downloadError.message);
    }

    const buffer = await fileData.arrayBuffer();
    const uint8array = new Uint8Array(buffer);

    // --- 4. Lit le texte du PDF (avec unpdf) ---
    const { text: textPages } = await extractText(uint8array);
    const text = textPages.join('\n\n');
    // --- FIN MODIFICATION ---

    // 5. Découpe le texte en "chunks"
    const textsToEmbed = chunkText(
      text,
      EMBEDDING_CONFIG.CHUNK_SIZE,
      EMBEDDING_CONFIG.CHUNK_OVERLAP
    );

    // 6. Génère les embeddings (vecteurs)
    const embedStartedAt = Date.now();
    const embedResponse = await createJinaEmbeddings(textsToEmbed, AI_MODELS.EMBEDDING);
    const embeddings = extractEmbeddingsFromResponse(embedResponse);
    if (embeddings.length !== textsToEmbed.length || embeddings.some((vector) => !Array.isArray(vector) || vector.length === 0)) {
      throw new Error("Jina n'a pas retourné d'embeddings valides.");
    }

    const embedLatencyMs = Date.now() - embedStartedAt;
    const usage = extractEmbeddingUsage(embedResponse);
    await recordAiUsage({
      provider: 'jina',
      model: AI_MODELS.EMBEDDING,
      promptTokens: usage.promptTokens,
      completionTokens: 0,
      totalTokens: usage.totalTokens,
      latencyMs: embedLatencyMs,
      cost: estimateEmbeddingCost(usage.totalTokens),
      metadata: {
        route: 'embed',
        chunks: textsToEmbed.length,
        documentPath: filePath,
      },
      userId: user.id,
    });

    // 7. Prépare les données
    const sections = textsToEmbed.map((content, index) => {
      const embedding = embeddings[index];
      if (embedding.length !== EMBEDDING_CONFIG.EMBEDDING_DIMENSION) {
        throw new Error(
          `Taille de vecteur Jina inattendue: ${embedding.length} (attendu: ${EMBEDDING_CONFIG.EMBEDDING_DIMENSION})`
        );
      }
      return {
        user_id: user.id,
        content: content,
        embedding: embedding,
        document_path: filePath,
      };
    });

    // 8. Insère les chunks
    const { error: insertError } = await supabase
      .from('document_sections')
      .insert(sections);
    if (insertError) {
      throw new Error(insertError.message);
    }

    // 9. Renvoie un succès
    return NextResponse.json(
      { success: true, chunksCount: sections.length },
      { status: 200 }
    );
  } catch (error: unknown) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    return internalError('embed', error);
  }
}
