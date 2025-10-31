import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Groq from 'groq-sdk';

// --- Importation du client Cohere ---
import { CohereClient } from 'cohere-ai';

// --- Initialisation du client Cohere (pour l'embedding de la question) ---
if (!process.env.COHERE_API_KEY) {
  throw new Error('La clé API COHERE_API_KEY est manquante');
}
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// --- Initialisation du client Groq (pour la génération du quiz) ---
if (!process.env.GROQ_API_KEY) {
  throw new Error('La clé API GROQ_API_KEY est manquante');
}
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    // 1. Récupération des paramètres du client
    const body = await req.json();
    const { query: userQuery, documentPath, numQuestions = 5 } = body;
    
    // Valide le nombre de questions (entre 1 et 10)
    const count = Math.min(Math.max(1, numQuestions), 10);

    if (!userQuery) {
      return NextResponse.json({ error: 'Question ("query") manquante' }, { status: 400 });
    }

    // 2. Création du client Supabase (côté serveur)
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

    // 3. Vérification de l'utilisateur
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 4. Génération du vecteur (embedding) pour la question avec Cohere
    const embedResponse = await cohere.embed({
      texts: [userQuery], // Un seul texte : la question
      model: 'embed-multilingual-v3.0',
      inputType: 'search_query', // Important : type d'input pour la RECHERCHE
    });

    // @ts-ignore
    if (!embedResponse.embeddings || embedResponse.embeddings.length === 0) {
      throw new Error("Cohere n'a pas retourné d'embedding pour la question.");
    }
    // @ts-ignore
    const queryEmbedding = embedResponse.embeddings[0]; // Vecteur de taille 1024

    // 5. Appel à la fonction SQL Supabase pour trouver les chunks pertinents
    const { data: sections, error: matchError } = await supabase.rpc(
      'match_document_sections', // La fonction qui attend un vecteur 1024
      {
        query_embedding: queryEmbedding, // Le vecteur 1024 de Cohere
        match_threshold: 0.4,            // Seuil de similarité
        match_count: 7,                  // Nombre de chunks à récupérer
        p_user_id: user.id,              // Filtre de sécurité
        p_document_path: documentPath    // Filtre de document (optionnel)
      }
    );

    if (matchError) {
      console.error('Erreur RPC Supabase:', matchError);
      throw new Error(matchError.message);
    }
    if (!sections || sections.length === 0) {
      console.log('Aucune section trouvée pour la recherche.');
      return NextResponse.json({ error: "Je n'ai trouvé aucune information pertinente dans vos documents pour répondre à cette demande." }, { status: 404 });
    }

    // 6. Construction du contexte pour l'IA
    const context = sections.map((s: any) => s.content).join('\n\n---\n\n');

    // 7. Construction du prompt pour Groq
    const prompt = `
      Tu es un assistant pédagogique extrêmement rigoureux chargé de créer des questions de quiz **factuellement exactes** basées **exclusivement** sur un texte fourni.

      CONTEXTE FOURNI:
      """
      ${context}
      """

      INSTRUCTIONS:
      1. Lis attentivement le CONTEXTE FOURNI. Ignore toute connaissance extérieure.
      2. Génère jusqu'à ${count} questions à choix multiples (QCM) dont la réponse se trouve **explicitement ou par déduction très directe** dans le CONTEXTE FOURNI.
      3. Pour chaque question :
         - Écris la question.
         - Propose quatre options (A, B, C, D). Une seule doit être correcte **selon le contexte**. Les autres options (distracteurs) doivent être plausibles mais **incorrectes selon le contexte**.
         - Indique la lettre de la bonne réponse.
         - **IMPORTANT : Ajoute une courte phrase de justification citant directement la partie du CONTEXTE FOURNI qui prouve la bonne réponse.**
      4. **Ne fais absolutely aucune supposition.** Si une question ou une justification ne peut pas être créée à partir du CONTEXTE FOURNI, ne l'inclus pas.

      Format de réponse attendu (JSON) :
      {
        "quiz": [
          {
            "question": "Votre question ici",
            "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
            "reponse_correcte": "A",
            "justification": "Citation directe du contexte..."
          }
        ]
      }
      Réponds **uniquement** avec l'objet JSON valide, sans aucun autre texte avant ou après.
    `;

    // 8. Appel de l'API Groq pour générer le quiz
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Tu es un assistant expert en création de quiz qui répond uniquement en format JSON valide.' },
        { role: 'user', content: prompt }
      ],
      // Utilisation du modèle Qwen que vous avez trouvé meilleur
      model: 'qwen/qwen3-32b', 
      temperature: 0.1,             // Très peu de créativité
      response_format: { type: 'json_object' }, // Force la réponse en JSON
    });

    const text = chatCompletion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("L'IA n'a pas renvoyé de réponse.");
    }

    // 9. Parsing de la réponse JSON
    let quizData;
    try {
      quizData = JSON.parse(text);
      if (!quizData || !Array.isArray(quizData.quiz)) {
        throw new Error("Le JSON reçu n'a pas la structure attendue { quiz: [...] }.");
      }
      if (quizData.quiz.length > 0 && !quizData.quiz[0].justification) {
          console.warn("L'IA n'a pas inclus de justification dans la réponse.");
      }
    } catch (parseError) {
      console.error("Erreur de parsing du JSON de Groq:", parseError, "Texte reçu:", text);
      throw new Error("L'IA a renvoyé une réponse JSON mal formatée.");
    }

    // 10. Renvoi du quiz au client
    return NextResponse.json({ quiz: quizData.quiz }, { status: 200 });

  } catch (error: any) {
    console.error('Erreur API Generate Quiz:', error);
    return NextResponse.json({ error: error.message || "Erreur inconnue" }, { status: 500 });
  }
}