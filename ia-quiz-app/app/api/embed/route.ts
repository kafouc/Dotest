import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
// 'RecursiveCharacterTextSplitter' est supprimé (erreur "never used")
import { CohereClient } from 'cohere-ai';

// --- NOUVEL IMPORT (unpdf) ---
import { extractText } from 'unpdf';

// --- Initialisation du client Cohere ---
if (!process.env.COHERE_API_KEY) {
  throw new Error('La clé API COHERE_API_KEY est manquante');
}
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// --- Notre propre fonction de découpage ---
function createChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  // ... (code de createChunks, inchangé)
  const chunks: string[] = []; let i = 0;
  while (i < text.length) {
    let endIndex = i + chunkSize;
    if (endIndex > text.length) endIndex = text.length;
    chunks.push(text.substring(i, endIndex));
    i += (chunkSize - chunkOverlap);
  }
  return chunks;
}

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path: filePath } = body; 

    if (!filePath) {
      return NextResponse.json({ error: 'Chemin du fichier ("path") manquant' }, { status: 400 });
    }

    // 1. Crée un client Supabase
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookies().get(name)?.value; },
          set(name: string, value: string, options) { cookies().set(name, value, options); },
          remove(name: string, options) { cookies().delete(name, options); },
        },
      }
    );

    // 2. Vérifie l'utilisateur
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 3. Télécharge le fichier PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);
    if (downloadError) { throw new Error(downloadError.message); }

    const buffer = await fileData.arrayBuffer();
    const uint8array = new Uint8Array(buffer); 

    // --- 4. Lit le texte du PDF (avec unpdf) ---
    const { text: textPages } = await extractText(uint8array); 
    const text = textPages.join('\n\n'); 
    // --- FIN MODIFICATION ---

    // 5. Découpe le texte en "chunks"
    const textsToEmbed = createChunks(text, 500, 50);

    // 6. Génère les embeddings (vecteurs)
    const embedResponse = await cohere.embed({
      texts: textsToEmbed,
      model: 'embed-multilingual-v3.0', 
      inputType: 'search_document', 
    });

    // @ts-expect-error (Corrige l'erreur ESLint)
    if (!embedResponse.embeddings || embedResponse.embeddings.length === 0) {
      throw new Error("Cohere n'a pas retourné d'embeddings.");
    }

    // 7. Prépare les données
    const sections = textsToEmbed.map((content, index) => {
      // @ts-expect-error (Corrige l'erreur ESLint)
      const embedding = embedResponse.embeddings[index];
      if (embedding.length !== 1024) {
        throw new Error(`Taille de vecteur Cohere inattendue: ${embedding.length}`);
      }
      return {
        user_id: user.id, content: content,
        embedding: embedding, document_path: filePath 
      };
    });

    // 8. Insère les chunks
    const { error: insertError } = await supabase
      .from('document_sections')
      .insert(sections);
    if (insertError) { throw new Error(insertError.message); }

    // 9. Renvoie un succès
    return NextResponse.json({ success: true, chunksCount: sections.length }, { status: 200 });

  } catch (error: unknown) { // 'any' corrigé en 'unknown'
    console.error('Erreur API Embed:', error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}