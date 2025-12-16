// app/api/pdf/embed-batch/route.ts
// Route Next.js serverless pour le traitement par batch des embeddings
// Remplace: supabase/functions/process-batch

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CohereClient } from 'cohere-ai';
import { AI_MODELS } from '@/lib/constants';
import { recordAiUsage } from '@/lib/metricsLogger';
import { extractCohereTokenUsage, estimateCohereEmbedCost } from '@/lib/aiUsage';
import type { ChunkPayload } from '@/app/api/pdf/extract/route';

// Configuration pour gérer les gros traitements
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Configuration
const BATCH_SIZE = 50; // Nombre de chunks traités à la fois
const CHUNK_STORAGE_BUCKET = 'chunks';

// Types
interface BatchPayload {
  documentId: number;
  chunkFilePath: string;
  batchIndex?: number;
}

// Handler principal
export async function POST(req: Request) {
  let documentId: number | null = null;
  let batchIndex = 0;
  
  try {
    // 1. Vérifier la configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const cohereKey = process.env.COHERE_API_KEY;
    
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante' },
        { status: 503 }
      );
    }
    
    if (!cohereKey) {
      return NextResponse.json(
        { error: 'Clé API Cohere manquante' },
        { status: 503 }
      );
    }
    
    // 2. Initialiser les clients
    const cohere = new CohereClient({ token: cohereKey });
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnon,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookies().set(name, value, options);
          },
          remove(name: string, options) {
            cookies().delete({ ...options, name });
          },
        },
      }
    );
    
    // 3. Parser le payload
    const body: BatchPayload = await req.json();
    const { documentId: docId, chunkFilePath, batchIndex: batchIdx = 0 } = body;
    
    documentId = docId;
    batchIndex = batchIdx;
    
    if (!documentId || !chunkFilePath) {
      return NextResponse.json(
        { error: 'Paramètres manquants (documentId, chunkFilePath)' },
        { status: 400 }
      );
    }
    
    console.log(`[Embed Batch] Doc ${documentId}, Lot ${batchIndex}: Démarrage`);
    
    // 4. Fonction pour mettre à jour le statut
    const updateDocumentStatus = async (
      status: 'processing' | 'completed' | 'failed',
      message?: string
    ) => {
      await supabase
        .from('documents')
        .update({ status, status_message: message || null })
        .eq('id', documentId);
    };
    
    // 5. Récupérer les infos du document
    const { data: docData, error: fetchDocError } = await supabase
      .from('documents')
      .select('user_id, file_path')
      .eq('id', documentId)
      .single();
      
    if (fetchDocError || !docData) {
      throw new Error(`Document introuvable: ${documentId}`);
    }
    
    const { user_id, file_path } = docData;
    
    // 6. Télécharger le fichier JSON contenant tous les chunks
    const { data: chunkFileData, error: downloadError } = await supabase.storage
      .from(CHUNK_STORAGE_BUCKET)
      .download(chunkFilePath);
      
    if (downloadError) {
      throw new Error(`Erreur téléchargement chunks: ${downloadError.message}`);
    }
    
    type StoredChunk = ChunkPayload & { content: string } | string;
    const rawChunks: StoredChunk[] = JSON.parse(await chunkFileData.text());
    const allChunks: ChunkPayload[] = rawChunks.map((item) => {
      if (typeof item === 'string') {
        return {
          content: item,
          pageStart: null,
          pageEnd: null,
        };
      }
      const content = typeof item?.content === 'string' ? item.content : '';
      return {
        content,
        pageStart: item?.pageStart ?? null,
        pageEnd: item?.pageEnd ?? null,
      } satisfies ChunkPayload;
    });
    const totalChunks = allChunks.length;
    
    // 7. Calculer le lot actuel
    const startIndex = batchIndex * BATCH_SIZE;
    const batchChunks = allChunks.slice(startIndex, startIndex + BATCH_SIZE);
    
    // 8. Vérifier si on a terminé
    if (batchChunks.length === 0) {
      console.log(`[Embed Batch] Doc ${documentId}: Traitement terminé (${totalChunks} chunks)`);
      
      await updateDocumentStatus('completed', `Analyse terminée: ${totalChunks} segments indexés`);
      
      // Supprimer le fichier temporaire
      await supabase.storage
        .from(CHUNK_STORAGE_BUCKET)
        .remove([chunkFilePath]);
      
      return NextResponse.json({
        success: true,
        message: 'Traitement terminé',
        totalChunks,
      });
    }
    
    // 9. Calculer le pourcentage de progression
    const processedChunks = batchIndex * BATCH_SIZE;
    const progress = Math.min(Math.round((processedChunks / totalChunks) * 100), 99);
    
    await updateDocumentStatus(
      'processing',
      `Génération des embeddings (${progress}%)...`
    );
    
    console.log(`[Embed Batch] Doc ${documentId}, Lot ${batchIndex}: Traitement de ${batchChunks.length} chunks (${progress}%)`);
    
    // 10. Appeler Cohere pour générer les embeddings
    const embedStartedAt = Date.now();
    const embedResponse = await cohere.embed({
      texts: batchChunks.map((chunk) => chunk.content),
      model: AI_MODELS.COHERE_EMBEDDING,
      inputType: 'search_document',
    });
    
    const embeddingsPayload = embedResponse as unknown as {
      embeddings?: number[][];
    };
    const embeddings = embeddingsPayload.embeddings;
    if (!embeddings) {
      throw new Error("Cohere n'a pas retourné d'embeddings");
    }

    const embedLatencyMs = Date.now() - embedStartedAt;
    const cohereUsage = extractCohereTokenUsage(embedResponse);
    await recordAiUsage({
      provider: 'cohere',
      model: AI_MODELS.COHERE_EMBEDDING,
      promptTokens: cohereUsage.inputTokens,
      completionTokens: cohereUsage.outputTokens,
      totalTokens: cohereUsage.totalTokens,
      latencyMs: embedLatencyMs,
      cost: estimateCohereEmbedCost(cohereUsage.totalTokens),
      metadata: {
        route: 'pdf/embed-batch',
        documentId,
        batchIndex,
        chunkCount: batchChunks.length,
      },
      userId: user_id,
    });
    
    // 11. Préparer les données pour ce lot
    const sections = batchChunks.map((chunk, index) => ({
      user_id,
      content: chunk.content,
      embedding: embeddings[index] ?? [],
      document_path: file_path,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
    }));
    
    // 12. Insérer dans la base de données
    const { error: insertError } = await supabase
      .from('document_sections')
      .insert(sections);
      
    if (insertError) {
      throw new Error(`Erreur insertion DB: ${insertError.message}`);
    }
    
    console.log(`[Embed Batch] Doc ${documentId}, Lot ${batchIndex}: ${batchChunks.length} chunks insérés`);
    
    // 13. Déclencher le lot suivant
    const nextBatchIndex = batchIndex + 1;
    
    // Appel récursif pour le prochain batch (fire and forget)
    fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        chunkFilePath,
        batchIndex: nextBatchIndex,
      }),
    }).catch((err) => {
      console.error(`[Embed Batch] Erreur déclenchement lot ${nextBatchIndex}:`, err);
    });
    
    return NextResponse.json({
      success: true,
      message: `Lot ${batchIndex} traité, lot ${nextBatchIndex} en cours`,
      processedChunks: processedChunks + batchChunks.length,
      totalChunks,
      progress,
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    console.error(`[Embed Batch] Erreur lot ${batchIndex}:`, errorMessage);
    
    // Mettre à jour le statut du document en cas d'erreur
    if (documentId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnon) {
        const supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookies().get(name)?.value;
            },
            set() {},
            remove() {},
          },
        });
        
        await supabase
          .from('documents')
          .update({ 
            status: 'failed', 
            status_message: `Erreur lot ${batchIndex}: ${errorMessage}` 
          })
          .eq('id', documentId);
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
