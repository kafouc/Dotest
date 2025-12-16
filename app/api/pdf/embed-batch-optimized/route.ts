// app/api/pdf/embed-batch-optimized/route.ts
// Route optimisée avec parallélisation contrôlée + retry/backoff
// Traite les embeddings par lot tout en respectant les limites de Cohere

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';
import { AI_MODELS, BATCH_CONFIG } from '@/lib/constants';
import { recordAiUsage } from '@/lib/metricsLogger';
import { extractCohereTokenUsage, estimateCohereEmbedCost } from '@/lib/aiUsage';
import type { ChunkPayload } from '@/app/api/pdf/extract/route';

const EMBED_SLOT_KEY = '__cohere_next_available__';

const waitForEmbedSlot = async () => {
  const interval = BATCH_CONFIG.MIN_EMBED_INTERVAL_MS ?? 0;
  if (!interval) {
    return;
  }

  const now = Date.now();
  const nextAvailable = (globalThis as Record<string, number>)[EMBED_SLOT_KEY] ?? now;
  const waitMs = Math.max(0, nextAvailable - now);

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  (globalThis as Record<string, number>)[EMBED_SLOT_KEY] = Date.now() + interval;
};

// Configuration pour gérer les gros traitements
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Types
interface BatchPayload {
  documentId: number;
  chunkFilePath: string;
  totalChunks?: number;
}

// Handler principal
export async function POST(req: Request) {
  let documentId: number | null = null;
  let supabaseAdmin = null as ReturnType<typeof createClient> | null;
  const startTime = Date.now();
  
  try {
    // 1. Vérifier la configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const cohereKey = process.env.COHERE_API_KEY;
    
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante' },
        { status: 503 }
      );
    }
    
    if (!supabaseServiceRole) {
      return NextResponse.json(
        { error: 'Clé de service Supabase manquante' },
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
    
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // 3. Parser le payload
    const body: BatchPayload = await req.json();
    const { documentId: docId, chunkFilePath, totalChunks } = body;
    
    documentId = docId;
    
    if (!documentId || !chunkFilePath) {
      return NextResponse.json(
        { error: 'Paramètres manquants (documentId, chunkFilePath)' },
        { status: 400 }
      );
    }
    
    console.log(`[Embed Optimized] Doc ${documentId}: Démarrage traitement parallèle`);
    
    // 4. Fonction pour mettre à jour le statut
    const updateDocumentStatus = async (
      status: 'processing' | 'completed' | 'failed',
      message?: string
    ) => {
      await supabaseAdmin
        .from('documents')
        .update({ status, status_message: message || null })
        .eq('id', documentId);
    };
    
    // 5. Récupérer les infos du document
    const { data: docData, error: fetchDocError } = await supabaseAdmin
      .from('documents')
      .select('user_id, file_path')
      .eq('id', documentId)
      .single();
      
    if (fetchDocError || !docData) {
      throw new Error(`Document introuvable: ${documentId}`);
    }
    
    const { user_id, file_path } = docData;
    
    // 6. Télécharger le fichier JSON contenant tous les chunks
    const { data: chunkFileData, error: downloadError } = await supabaseAdmin.storage
      .from('chunks')
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

      const total = totalChunks || allChunks.length;
    
    const {
      BATCH_SIZE,
      PARALLEL_BATCHES,
      MAX_RETRIES,
      RETRY_BASE_DELAY_MS = 1000,
      RATE_LIMIT_DELAY_MS = 4000,
    } = BATCH_CONFIG;

    console.log(`[Embed Optimized] Doc ${documentId}: ${total} chunks à traiter (parallélisme max: ${PARALLEL_BATCHES})`);
    
    await updateDocumentStatus('processing', `Indexation: 0/${total} chunks (0%)`);
    
    // 7. Fonction pour traiter un batch avec retry
    let processedCount = 0;
    
    const processBatchWithRetry = async (
      batchChunks: ChunkPayload[],
      startIndex: number,
      retries = MAX_RETRIES
    ): Promise<void> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const batchTexts = batchChunks.map((chunk) => chunk.content);

          // Générer les embeddings avec le modèle Cohere standard (dimension 1024)
          await waitForEmbedSlot();

          const embedStartedAt = Date.now();
          const embedResponse = await cohere.embed({
            texts: batchTexts,
            model: AI_MODELS.COHERE_EMBEDDING,
            inputType: 'search_document',
          });
          
          // @ts-expect-error - Cohere types
          if (!embedResponse.embeddings) {
            throw new Error("Cohere n'a pas retourné d'embeddings");
          }
          
          // @ts-expect-error - Cohere types
          const embeddings = embedResponse.embeddings;

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
              route: 'pdf/embed-batch-optimized',
              documentId,
              startIndex,
              chunkCount: batchChunks.length,
              attempt,
            },
            userId: user_id,
          });
          
          // Préparer les données
          const sections = batchChunks.map((chunk, index) => ({
            user_id,
            content: chunk.content,
            embedding: embeddings[index],
            document_path: file_path,
            page_start: chunk.pageStart,
            page_end: chunk.pageEnd,
          }));
          
          // Insérer dans la base de données
          const { error: insertError } = await supabaseAdmin
            .from('document_sections')
            .insert(sections);
            
          if (insertError) {
            throw new Error(`Erreur insertion DB: ${insertError.message}`);
          }
          
          processedCount += batchChunks.length;
          return; // Succès
          
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;

          const baseDelay = statusCode === 429 ? RATE_LIMIT_DELAY_MS : RETRY_BASE_DELAY_MS;
          const waitMs = baseDelay * (attempt + 1);

          if (attempt === retries - 1) {
            console.error(`[Embed Optimized] Batch ${startIndex}-${startIndex + batchChunks.length} échec après ${retries} tentatives:`, error);
            throw error;
          }

          console.warn(`[Embed Optimized] Batch ${startIndex}: Retry ${attempt + 1}/${retries} dans ${waitMs}ms${statusCode === 429 ? ' (rate limit Cohere)' : ''}`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    };
    
    // 8. Traitement par lots avec parallélisme limité
    const batchSize = BATCH_SIZE;
    const parallelCount = Math.max(1, PARALLEL_BATCHES);
    let cursor = 0;

    while (cursor < allChunks.length) {
      const tasks: Promise<void>[] = [];
      const batchStarts: number[] = [];

      for (let j = 0; j < parallelCount && cursor < allChunks.length; j++) {
        const start = cursor;
        const batchChunks = allChunks.slice(start, Math.min(start + batchSize, allChunks.length));
        cursor += batchSize;
        batchStarts.push(start);
        tasks.push(processBatchWithRetry(batchChunks, start));
      }

      const results = await Promise.allSettled(tasks);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length > 0) {
        const reason = failed[0].reason instanceof Error ? failed[0].reason.message : String(failed[0].reason);
        throw new Error(`${failed.length}/${tasks.length} lot(s) n'ont pas pu être traités: ${reason}`);
      }

      const progress = Math.min(Math.round((processedCount / total) * 100), 99);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = processedCount === 0
        ? 0
        : Math.round((processedCount / (Date.now() - startTime)) * 1000 * 60);

      await updateDocumentStatus(
        'processing',
        `Indexation: ${processedCount}/${total} chunks (${progress}%) | ${rate} chunks/min`
      );

      console.log(`[Embed Optimized] Doc ${documentId}: ${processedCount}/${total} (${progress}%) | ${elapsed}s | ${rate} chunks/min`);
    }
    
    // 9. Finaliser
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = Math.round((processedCount / (Date.now() - startTime)) * 1000 * 60);
    
    if (processedCount !== total) {
      throw new Error(`Indexation incomplète: ${processedCount}/${total} segments traités`);
    }

    console.log(`[Embed Optimized] Doc ${documentId}: ✅ Terminé - ${processedCount} chunks en ${totalTime}s (${avgRate} chunks/min)`);
    
    await updateDocumentStatus('completed', `Analyse terminée: ${processedCount} segments indexés en ${totalTime}s`);
    
    // Supprimer le fichier temporaire
    await supabaseAdmin.storage
      .from('chunks')
      .remove([chunkFilePath]);
    
    return NextResponse.json({
      success: true,
      totalChunks: processedCount,
      time: `${totalTime}s`,
      rate: `${avgRate} chunks/min`,
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Embed Optimized] Erreur après ${elapsed}s:`, errorMessage);
    
    // Mettre à jour le statut du document en cas d'erreur
    if (documentId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceRole) {
        const supabase = createClient(supabaseUrl, supabaseServiceRole, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        
        await supabase
          .from('documents')
          .update({ 
            status: 'failed', 
            status_message: `Erreur: ${errorMessage}` 
          })
          .eq('id', documentId);
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
