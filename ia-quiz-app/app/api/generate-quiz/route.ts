import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Groq from 'groq-sdk';

// Importation Cohere (pour l'embedding de la question)
import { CohereClient } from 'cohere-ai';

// --- Initialisation Cohere ---
if (!process.env.COHERE_API_KEY) {
  throw new Error('La clé API COHERE_API_KEY est manquante');
}
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// --- Initialisation Groq (pour la génération du quiz) ---
if (!process.env.GROQ_API_KEY) {
  throw new Error('La clé API GROQ_API_KEY est manquante');
}
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query: userQuery, documentPath, numQuestions = 5 } = body;
    const count = Math.min(Math.max(1, numQuestions), 10); // Force entre 1 et 10

    if (!userQuery) {
      return NextResponse.json({ error: 'Question ("query") manquante' }, { status: 400 });
    }

    // 1. Client Supabase
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

    // 2. Vérifier l'utilisateur
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 3. Générer le vecteur de la question avec Cohere
    const embedResponse = await cohere.embed({
      texts: [userQuery],
      model: 'embed-multilingual-v3.0',
      inputType: 'search_query',
    });

    // @ts-expect-error (Corrige l'erreur ESLint)
    if (!embedResponse.embeddings || embedResponse.embeddings.length === 0) {
      throw new Error("Cohere n'a pas retourné d'embedding pour la question.");
    }
    // @ts-expect-error (Corrige l'erreur ESLint)
    const queryEmbedding = embedResponse.embeddings[0]; 

    // 4. Appel de la fonction SQL (RAG)
    const { data: sections, error: matchError } = await supabase.rpc(
      'match_document_sections', 
      {
        query_embedding: queryEmbedding, 
        match_threshold: 0.4,
        match_count: 7,
        p_user_id: user.id,
        p_document_path: documentPath 
      }
    );

    if (matchError) { throw new Error(matchError.message); }
    if (!sections || sections.length === 0) {
      return NextResponse.json({ error: "Je n'ai trouvé aucune information pertinente dans vos documents pour répondre à cette demande." }, { status: 404 });
    }

    // 5. Contexte
    const context = sections.map((s: { content: string }) => s.content).join('\n\n---\n\n'); // Type 'any' corrigé

    // 6. Prompt pour Groq
    const prompt = `
      Tu es un assistant pédagogique extrêmement rigoureux.
      CONTEXTE: """ ${context} """
      INSTRUCTIONS:
      1. Basé exclusivement sur le CONTEXTE, génère ${count} questions QCM.
      2. Pour chaque question:
         - Écris la "question".
         - Propose quatre "options" (A, B, C, D) plausibles.
         - Indique la "reponse_correcte" (lettre A, B, C ou D).
         - Ajoute une "justification" (citation courte du contexte).
      3. Format de réponse: JSON { "quiz": [...] }
      Réponds **uniquement** avec l'objet JSON valide.
    `;

    // 7. Appel Groq
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Tu réponds uniquement en format JSON valide.' },
        { role: 'user', content: prompt }
      ],
      model: 'qwen/qwen3-32b', // Le modèle que vous avez choisi
      temperature: 0.1,
      response_format: { type: 'json_object' }, 
    });
    
    const text = chatCompletion.choices[0]?.message?.content;
    if (!text) { throw new Error("L'IA n'a pas renvoyé de réponse."); }

    // 8. Parser la réponse
    let quizData;
    try {
      quizData = JSON.parse(text);
      if (!quizData || !Array.isArray(quizData.quiz)) {
        throw new Error("Le JSON reçu n'a pas la structure attendue { quiz: [...] }.");
      }
    } catch (parseError) {
      throw new Error("L'IA a renvoyé une réponse JSON mal formatée.");
    }

    // 9. Renvoyer le quiz
    return NextResponse.json({ quiz: quizData.quiz }, { status: 200 });

  } catch (error: unknown) { // 'any' corrigé en 'unknown'
    console.error('Erreur API Generate Quiz:', error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}