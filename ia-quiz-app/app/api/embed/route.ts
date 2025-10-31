import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { CohereClient } from 'cohere-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'; // Gardons l'import ESM standard pour la définition du type

// --- Initialisation du client Cohere ---
if (!process.env.COHERE_API_KEY) {
  throw new Error('La clé API COHERE_API_KEY est manquante');
}
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { path: filePath } = body; 

    if (!filePath) {
      return NextResponse.json({ error: 'Chemin du fichier ("path") manquant' }, { status: 400 });
    }

    // 1. Crée un client Supabase sécurisé (côté serveur)
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

    // 2. Vérifie si l'utilisateur est authentifié
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 3. Télécharge le fichier PDF depuis Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);

    if (downloadError) {
      console.error('Erreur de téléchargement Supabase:', downloadError);
      throw new Error(downloadError.message);
    }
    
    const buffer = await fileData.arrayBuffer();

    // --- CONTOURNNEMENT DU BUG (Chargement dynamique) ---
    // Nous utilisons require() ici, à l'intérieur de la fonction, pour forcer 
    // le chargement du module CommonJS au moment précis de l'exécution.

    const pdfLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfLib.GlobalWorkerOptions.workerSrc = ''; // Applique le correctif au module chargé

    // 4. Lit le texte du PDF
    const loadingTask = pdfLib.getDocument(buffer); // Utilise le module chargé
    const pdf = await loadingTask.promise;
    // ... (suite de l'extraction inchangée) ...
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n'; 
    }
    const text = fullText;
    // --- FIN DU CONTOURNEMENT ---

    // 5. Découpe le texte en "chunks" (morceaux)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500, 
      chunkOverlap: 50,  
    });
    const chunks = await splitter.createDocuments([text]);
    
    const textsToEmbed = chunks.map(chunk => chunk.pageContent);

    // 6. Génère les embeddings (vecteurs) avec l'API Cohere (inchangé)
    const embedResponse = await cohere.embed({
      texts: textsToEmbed,
      model: 'embed-multilingual-v3.0', 
      inputType: 'search_document', 
    });

    // @ts-ignore
    if (!embedResponse.embeddings || embedResponse.embeddings.length === 0) {
      throw new Error("Cohere n'a pas retourné d'embeddings.");
    }

    // 7. Prépare les données à insérer dans Supabase (inchangé)
    const sections = textsToEmbed.map((content, index) => {
      // @ts-ignore
      const embedding = embedResponse.embeddings[index];
      
      if (embedding.length !== 1024) {
        throw new Error(`Taille de vecteur Cohere inattendue: ${embedding.length}`);
      }
      
      return {
        user_id: user.id,
        content: content,
        embedding: embedding, 
        document_path: filePath 
      };
    });

    // 8. Insère les nouveaux chunks et vecteurs (inchangé)
    const { error: insertError } = await supabase
      .from('document_sections')
      .insert(sections);
      
    if (insertError) {
      console.error("Erreur d'insertion Supabase:", insertError);
      throw new Error(insertError.message);
    }

    // 9. Renvoie un succès
    return NextResponse.json({ success: true, chunksCount: sections.length }, { status: 200 });

  } catch (error: any) {
    console.error('Erreur API Embed:', error);
    return NextResponse.json({ error: error.message || "Erreur inconnue" }, { status: 500 });
  }
}