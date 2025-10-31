// supabase/functions/embed-worker/index.ts

// --- IMPORTS (Deno Natif et ESM) ---
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0"; 
import { extractText } from "unpdf"; // Utilise l'alias 'unpdf' pour l'extraction PDF

// --- TYPES ET CONFIGURATION ---
interface WebhookPayload {
  filePath: string;
  documentId: number;
}
const CHUNK_STORAGE_BUCKET = 'chunks'; // Bucket pour stocker temporairement les fichiers JSON

// --- NOTRE PROPRE FONCTION DE DÉCOUPAGE ---
function createChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap doit être plus petit que chunkSize");
  }

  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    let endIndex = i + chunkSize;
    if (endIndex > text.length) {
      endIndex = text.length;
    }
    chunks.push(text.substring(i, endIndex));
    i += (chunkSize - chunkOverlap);
  }
  return chunks;
}

// --- FONCTION PRINCIPALE (PRÉPARATION) ---
async function preparePdfForEmbedding(payload: WebhookPayload) {
    const { filePath, documentId } = payload;
    
    // Initialise le client Supabase (Service Role Key)
    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SERVICE_ROLE_KEY")! 
    );
    
    // Fonction utilitaire pour mettre à jour le statut
    const updateDocumentStatus = async (status: 'processing' | 'failed', message?: string) => {
        await supabaseClient
            .from('documents')
            .update({ status: status, status_message: message || null })
            .eq('id', documentId);
    };

    try {
        await updateDocumentStatus('processing'); // Statut: "En cours de traitement"

        // 1. Télécharge le fichier PDF depuis Storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('pdfs')
            .download(filePath);
        if (downloadError) throw new Error(`Erreur Supabase Storage: ${downloadError.message}`);
        
        const buffer = await fileData.arrayBuffer();
        const uint8array = new Uint8Array(buffer); 

        // 2. Lit et découpe le texte
        const { text: textPages } = await extractText(uint8array); 
        const text = textPages.join('\n\n'); 
        
        const chunksToEmbed = createChunks(text, 500, 50);
        console.log(`[+] (Prepare) Document ${documentId}: ${chunksToEmbed.length} chunks créés.`);

        // 3. Crée le fichier JSON des chunks
        const chunkJson = JSON.stringify(chunksToEmbed);
        const chunkFilePath = `doc_${documentId}_chunks.json`; // Nom unique dans le bucket 'chunks'

        // 4. Sauvegarde le JSON dans le bucket 'chunks' (Opération rapide)
        const { error: uploadChunkError } = await supabaseClient.storage
          .from(CHUNK_STORAGE_BUCKET)
          .upload(chunkFilePath, chunkJson, { 
            contentType: 'application/json', 
            upsert: true // Écrase si la préparation est relancée
          });
        if (uploadChunkError) throw new Error(`Erreur sauvegarde chunks: ${uploadChunkError.message}`);

        // 5. SUCCÈS : Déclenche le "worker" d'IA (process-batch)
        console.log(`[+] (Prepare) Document ${documentId}: Chunks JSON sauvegardés. Déclenchement du process-batch...`);
        
        // On n'attend pas la réponse, on lance juste le travail (pour éviter le timeout)
        supabaseClient.functions.invoke('process-batch', {
            body: { 
              documentId: documentId,
              chunkFilePath: chunkFilePath // On passe le chemin du JSON
            },
        });

        // Cette fonction (embed-worker) a terminé son travail.
        return { success: true, chunks: chunksToEmbed.length };

    } catch (error: any) {
        // En cas de crash, on met à jour le statut en 'failed' (très important pour le feedback utilisateur)
        const errorMessage = `Échec de la PRÉPARATION du PDF (ID: ${documentId}): ${error.message}`;
        console.error(errorMessage);
        await updateDocumentStatus('failed', errorMessage); 
        return { success: false, error: errorMessage };
    }
}


// --- GESTION DES REQUÊTES HTTP (Point d'entrée Deno) ---
serve(async (req) => {
    // S'assure que seule la méthode POST est utilisée
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
            status: 405, headers: { "Content-Type": "application/json" },
        });
    }
    try {
        const payload: WebhookPayload = await req.json();
        
        // Lance la préparation SANS 'await' pour répondre immédiatement
        preparePdfForEmbedding(payload); 
        
        // Réponse HTTP immédiate (Résout l'erreur de timeout 504/500)
        return new Response(JSON.stringify({ message: "Préparation de l'analyse démarrée." }), {
            status: 200, headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Erreur de Webhook (embed-worker):", error);
        return new Response(JSON.stringify({ error: "Erreur interne." }), {
            status: 500, headers: { "Content-Type": "application/json" },
        });
    }
});