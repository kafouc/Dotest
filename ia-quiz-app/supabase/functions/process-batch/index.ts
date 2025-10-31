// supabase/functions/process-batch/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';

// --- CONFIGURATION ---
interface WebhookPayload {
  documentId: number;
  chunkFilePath: string; // Chemin vers le JSON (ex: doc_30_chunks.json)
  batchIndex?: number; // Le lot actuel (ex: 0, 1, 2...)
}
const cohere = new CohereClient({
  token: Deno.env.get('COHERE_API_KEY')!,
});
const BATCH_SIZE = 50; // Traite 50 chunks à la fois
const CHUNK_STORAGE_BUCKET = 'chunks';

// --- FONCTION PRINCIPALE (Le "Worker" de l'IA) ---
async function processBatch(payload: WebhookPayload) {
  const { documentId, chunkFilePath, batchIndex = 0 } = payload; // batchIndex commence à 0

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!
  );

  const updateDocumentStatus = async (
    status: 'completed' | 'failed',
    message?: string
  ) => {
    await supabaseClient
      .from('documents')
      .update({ status: status, status_message: message || null })
      .eq('id', documentId);
  };

  try {
    console.log(`[+] (Batch) Doc ${documentId}, Lot ${batchIndex}: Démarrage.`);

    // 1. Récupère le user_id et le file_path (pour l'insertion)
    const { data: docData, error: fetchDocError } = await supabaseClient
      .from('documents')
      .select('user_id, file_path')
      .eq('id', documentId)
      .single();
    if (fetchDocError || !docData)
      throw new Error(`Impossible de trouver le document ID: ${documentId}`);
    const { user_id, file_path } = docData;

    // 2. Télécharge le fichier JSON contenant TOUS les chunks
    const { data: chunkFileData, error: downloadError } =
      await supabaseClient.storage
        .from(CHUNK_STORAGE_BUCKET)
        .download(chunkFilePath);
    if (downloadError)
      throw new Error(
        `Erreur téléchargement chunks JSON: ${downloadError.message}`
      );

    const allChunks: string[] = JSON.parse(await chunkFileData.text());

    // 3. Calcule le lot (batch) actuel
    const startIndex = batchIndex * BATCH_SIZE;
    const batchTexts = allChunks.slice(startIndex, startIndex + BATCH_SIZE);

    // 4. VÉRIFICATION DE FIN : S'il n'y a plus de chunks dans ce lot...
    if (batchTexts.length === 0) {
      console.log(
        `[+] (Batch) Doc ${documentId}: Terminé. Tous les lots sont traités.`
      );
      await updateDocumentStatus('completed');

      // (Optionnel) Supprime le fichier JSON temporaire
      await supabaseClient.storage
        .from(CHUNK_STORAGE_BUCKET)
        .remove([chunkFilePath]);

      return { success: true, message: 'Traitement terminé.' };
    }

    console.log(
      `[+] (Batch) Doc ${documentId}, Lot ${batchIndex}: Envoi de ${batchTexts.length} chunks à Cohere...`
    );

    // 5. Appelle Cohere pour ce lot
    const embedResponse = await cohere.embed({
      texts: batchTexts,
      model: 'embed-multilingual-v3.0',
      inputType: 'search_document',
    });

    // @ts-ignore
    if (!embedResponse.embeddings)
      throw new Error("Cohere n'a pas retourné d'embeddings.");
    // @ts-ignore
    const embeddings = embedResponse.embeddings;

    // 6. Prépare les données pour ce lot
    const sections = batchTexts.map((content, index) => ({
      user_id: user_id,
      content: content,
      embedding: embeddings[index],
      document_path: file_path,
    }));

    // 7. Insère ce lot dans la base de données
    const { error: insertError } = await supabaseClient
      .from('document_sections')
      .insert(sections);
    if (insertError)
      throw new Error(`Erreur update DB: ${insertError.message}`);

    // 8. RELANCE (Self-Invoke) : Appelle le lot suivant
    console.log(
      `[+] (Batch) Doc ${documentId}, Lot ${batchIndex}: Terminé. Déclenchement du lot ${batchIndex + 1}...`
    );
    supabaseClient.functions.invoke('process-batch', {
      body: {
        documentId: documentId,
        chunkFilePath: chunkFilePath,
        batchIndex: batchIndex + 1, // Incrémente le lot
      },
    });

    return { success: true, message: 'Lot traité, relance en cours.' };
  } catch (error: any) {
    const errorMessage = `Échec du Lot ${batchIndex} (Doc ID: ${documentId}): ${error.message}`;
    console.error(errorMessage);
    await updateDocumentStatus('failed', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// --- GESTION DES REQUÊTES HTTP (Inchangé) ---
serve(async (req) => {
  if (req.method !== 'POST') {
    /* ... */
  }
  try {
    const payload: WebhookPayload = await req.json();
    processBatch(payload); // Lance SANS 'await'
    return new Response(
      JSON.stringify({ message: 'Traitement du lot démarré.' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    /* ... */
  }
});
