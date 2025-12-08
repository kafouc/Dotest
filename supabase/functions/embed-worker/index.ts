// supabase/functions/embed-worker/index.ts

// --- IMPORTS (Deno Natif et ESM) ---
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0"; 
import { extractText } from "unpdf"; // Utilise l'alias 'unpdf' pour l'extraction PDF
import mammoth from "npm:mammoth"; // Extraction DOCX
import JSZip from "npm:jszip"; // Lecture PPTX (ZIP)

// --- TYPES ET CONFIGURATION ---
interface WebhookPayload {
  filePath: string; // ex: user/123-file.docx
  documentId: number;
  mimeType?: string; // peut être vide côté navigateur
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
async function prepareFileForEmbedding(payload: WebhookPayload) {
  const { filePath, documentId, mimeType } = payload;
    
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

        // 1. Télécharge le fichier depuis Storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('pdfs')
            .download(filePath);
        if (downloadError) throw new Error(`Erreur Supabase Storage: ${downloadError.message}`);
        
        const buffer = await fileData.arrayBuffer();
        const uint8array = new Uint8Array(buffer); 

        // 2. Lit et extrait le texte selon le type
        // Détermine le type via mimeType OU extension du chemin si manquant
        const lowerPath = (filePath || '').toLowerCase();
        let type = (mimeType ?? '').toLowerCase();
        if (!type) {
          if (lowerPath.endsWith('.pdf')) type = 'application/pdf';
          else if (lowerPath.endsWith('.docx')) type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (lowerPath.endsWith('.pptx')) type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        }
        if (!type) {
          throw new Error(`Type de fichier indéterminé pour ${filePath}`);
        }
        let text = '';
        if (type === 'application/pdf') {
          const { text: textPages } = await extractText(uint8array);
          text = textPages.join('\n\n');
        } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // DOCX: tente mammoth, puis fallback JSZip si mammoth échoue ou renvoie vide
          try {
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            text = (result.value ?? '').toString();
          } catch (e) {
            console.warn('mammoth a échoué, fallback JSZip pour DOCX:', e);
            text = '';
          }
          if (!text || text.trim().length === 0) {
            const zip = await JSZip.loadAsync(buffer);
            const docXml = zip.file('word/document.xml');
            const bodies: string[] = [];
            if (docXml) {
              const xml = await docXml.async('string');
              const plain = xml
                .replace(/<w:t[^>]*>/g, ' ')
                .replace(/<\/w:t>/g, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (plain) bodies.push(plain);
            }
            // Inclure entêtes/pieds si présents
            for (const name of Object.keys(zip.files)) {
              if (/word\/(header\d+|footer\d+)\.xml$/.test(name)) {
                const file = zip.file(name);
                if (!file) continue;
                const xml = await file.async('string');
                const plain = xml
                  .replace(/<w:t[^>]*>/g, ' ')
                  .replace(/<\/w:t>/g, ' ')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (plain) bodies.push(plain);
              }
            }
            text = bodies.join('\n\n');
          }
        } else if (type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
          const zip = await JSZip.loadAsync(buffer);
          const slidesFolder = zip.folder('ppt/slides');
          const slideFiles = slidesFolder ? Object.keys(slidesFolder.files).filter((f) => f.endsWith('.xml')) : [];
          const texts: string[] = [];
          for (const f of slideFiles) {
            const file = slidesFolder!.file(f);
            if (!file) continue;
            const xml = await file.async('string');
            const plain = xml
              .replace(/<a:t[^>]*>/g, ' ')
              .replace(/<\/a:t>/g, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (plain) texts.push(plain);
          }
          text = texts.join('\n\n');
        } else {
          throw new Error(`Type de fichier non pris en charge: ${type}`);
        }

        if (!text || text.trim().length === 0) {
          throw new Error('Extraction du texte vide ou impossible.');
        }
        
        const chunksToEmbed = createChunks(text, 500, 50);
        console.log(`[+] (Prepare) Document ${documentId}: ${chunksToEmbed.length} chunks créés (type: ${type}).`);

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
        const errorMessage = `Échec de la PRÉPARATION du fichier (ID: ${documentId}): ${error.message}`;
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
        prepareFileForEmbedding(payload); 
        
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