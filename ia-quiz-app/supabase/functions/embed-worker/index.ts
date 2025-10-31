// supabase/functions/embed-worker/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js"; 
import { extractText } from "unpdf"; 

// --- TYPES ET CONFIGURATION ---
interface WebhookPayload {
  filePath: string;
  documentId: number;
}
const CHUNK_STORAGE_BUCKET = 'chunks'; // Le bucket que nous venons de créer

// --- FONCTION DE DÉCOUPAGE (Inchangée) ---
function createChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  // ... (code de createChunks, inchangé)
  if (chunkOverlap >= chunkSize) { throw new Error("..."); }
  const chunks: string[] = []; let i = 0;
  while (i < text.length) {
    let endIndex = i + chunkSize;
    if (endIndex > text.length) endIndex = text.length;
    chunks.push(text.substring(i, endIndex));
    i += (chunkSize - chunkOverlap);
  }
  return chunks;
}

// --- FONCTION PRINCIPALE (PRÉPARATION) ---
async function preparePdfForEmbedding(payload: WebhookPayload) {
    const { filePath, documentId } = payload;
    
    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SERVICE_ROLE_KEY")! 
    );
    
    const updateDocumentStatus = async (status: 'processing' | 'failed', message?: string) => {
        await supabaseClient
            .from('documents')
            .update({ status: status, status_message: message || null })
            .eq('id', documentId);
    };

    try {
        await updateDocumentStatus('processing'); 

        // 1. Télécharge le fichier PDF
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('pdfs')
            .download(filePath);
        if (downloadError) throw new Error(`Erreur Supabase Storage: ${downloadError.message}`);
        
        const buffer = await fileData.arrayBuffer();
        const uint8array = new Uint8Array(buffer); 

        // 2. Lit le texte du PDF
        const { text: textPages } = await extractText(uint8array); 
        const text = textPages.join('\n\n'); 
        
        // 3. Découpe le texte
        const chunksToEmbed = createChunks(text, 500, 50);
        console.log(`[+] (Prepare) Document ${documentId}: ${chunksToEmbed.length} chunks créés.`);

        // 4. Crée le fichier JSON des chunks
        const chunkJson = JSON.stringify(chunksToEmbed);
        const chunkFilePath = `doc_${documentId}_chunks.json`;

        // 5. Sauvegarde le JSON dans le bucket 'chunks' (très rapide)
        const { error: uploadChunkError } = await supabaseClient.storage
          .from(CHUNK_STORAGE_BUCKET)
          .upload(chunkFilePath, chunkJson, { 
            contentType: 'application/json', 
            upsert: true 
          });
        if (uploadChunkError) throw new Error(`Erreur sauvegarde chunks: ${uploadChunkError.message}`);

        // 6. SUCCÈS : Déclenche le premier lot du "worker" d'IA
        console.log(`[+] (Prepare) Document ${documentId}: Chunks JSON sauvegardés. Déclenchement du process-batch...`);
        
        const { error: invokeError } = await supabaseClient.functions.invoke('process-batch', {
            body: { 
              documentId: documentId,
              chunkFilePath: chunkFilePath // On passe le chemin du JSON
            },
        });
        if (invokeError) throw new Error(`Erreur lors du déclenchement de process-batch: ${invokeError.message}`);

        return { success: true };

    } catch (error: any) {
        const errorMessage = `Échec de la PRÉPARATION du PDF (ID: ${documentId}): ${error.message}`;
        console.error(errorMessage);
        await updateDocumentStatus('failed', errorMessage); 
        return { success: false, error: errorMessage };
    }
}

// --- GESTION DES REQUÊTES HTTP (Inchangé) ---
serve(async (req) => {
    if (req.method !== "POST") { /* ... */ }
    try {
        const payload: WebhookPayload = await req.json();
        preparePdfForEmbedding(payload); // Lance SANS 'await'
        return new Response(JSON.stringify({ message: "Préparation de l'analyse démarrée." }), {
            status: 200, headers: { "Content-Type": "application/json" },
        });
    } catch (error) { /* ... */ }
});