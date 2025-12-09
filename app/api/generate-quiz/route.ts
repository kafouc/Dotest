import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';
import { EMBEDDING_CONFIG, AI_MODELS, QUIZ_LIMITS } from '@/lib/constants';

// Initialisation déplacée dans le handler pour gérer proprement l'absence de config

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
        // Vérifier la configuration Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnon) {
          return NextResponse.json(
            { error: 'Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
            { status: 503 }
          );
        }

        // Initialisation clients IA avec vérification des clés
        const cohereKey = process.env.COHERE_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;
        if (!cohereKey || !groqKey) {
          return NextResponse.json(
            { error: 'Configuration IA manquante (COHERE_API_KEY / GROQ_API_KEY)' },
            { status: 503 }
          );
        }
        const cohere = new CohereClient({ token: cohereKey });
        const groq = new Groq({ apiKey: groqKey });
    const { query: userQuery, documentPath, numQuestions = QUIZ_LIMITS.DEFAULT_QUESTIONS, mode = 'qcu', theme } = body as { query: string; documentPath?: string; numQuestions?: number; mode?: 'qcu'|'qcm'|'vf'; theme?: string };
    const allowedCounts = [5, 7, 10];
    const nearestAllowed = allowedCounts.reduce((prev, cur) => {
      const n = typeof numQuestions === 'number' ? numQuestions : QUIZ_LIMITS.DEFAULT_QUESTIONS;
      return Math.abs(cur - n) < Math.abs(prev - n) ? cur : prev;
    }, QUIZ_LIMITS.DEFAULT_QUESTIONS);
    const count = allowedCounts.includes(numQuestions) ? numQuestions : nearestAllowed;
    if (!['qcu','qcm','vf'].includes(mode)) {
      return NextResponse.json({ error: 'Mode invalide (qcu|qcm|vf)' }, { status: 400 });
    }

    if (!userQuery) {
      return NextResponse.json(
        { error: 'Question ("query") manquante' },
        { status: 400 }
      );
    }

    // 1. Client Supabase
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

    // 2. Vérifier l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 3. Générer le vecteur de la question avec Cohere
    const embedResponse = await cohere.embed({
      texts: [userQuery],
      model: AI_MODELS.COHERE_EMBEDDING,
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
        match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
        match_count: EMBEDDING_CONFIG.MATCH_COUNT,
        p_user_id: user.id,
        p_document_path: documentPath,
      }
    );

    if (matchError) {
      throw new Error(matchError.message);
    }
    if (!sections || sections.length === 0) {
      return NextResponse.json(
        {
          error:
            "Je n'ai trouvé aucune information pertinente dans vos documents pour répondre à cette demande.",
        },
        { status: 404 }
      );
    }

    // 5. Contexte (Type 'any' corrigé en 'unknown' puis vérifié)
    const context = (sections as { content: string }[])
      .map((s) => s.content)
      .join('\n\n---\n\n');

    // 6. Prompt pour Groq
    const formatInstructions =
      mode === 'vf'
        ? `Pour chaque question:\n- "question"\n- "options": {"VRAI": "Vrai", "FAUX": "Faux"}\n- "reponse_correcte": "VRAI" ou "FAUX"\n- "justification"`
        : mode === 'qcm'
        ? `Pour chaque question:\n- "question"\n- "options": {"A": "...", "B": "...", "C": "...", "D": "..."}\n- "reponses_correctes": ["A","C"] (une ou plusieurs lettres)\n- "justification"`
        : `Pour chaque question:\n- "question"\n- "options": {"A": "...", "B": "...", "C": "...", "D": "..."}\n- "reponse_correcte": "A" | "B" | "C" | "D"\n- "justification"`;

    const prompt = `
      Tu es un assistant pédagogique extrêmement rigoureux.
      CONTEXTE: """ ${context} """
      INSTRUCTIONS:
      1. Basé exclusivement sur le CONTEXTE, génère ${count} questions ${mode.toUpperCase()}.
         ${theme ? `Thème ciblé: "${theme.replace(/"/g, '\\"')}".` : ''}
      2. ${formatInstructions}
      3. Format de réponse: JSON { "quiz": [...] }
      Réponds **uniquement** avec l'objet JSON valide.
    `;

    // 7. Appel Groq
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Tu réponds uniquement en format JSON valide.',
        },
        { role: 'user', content: prompt },
      ],
      model: AI_MODELS.GROQ_QUIZ_GENERATION,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const text = chatCompletion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("L'IA n'a pas renvoyé de réponse.");
    }

    // 8. Parser la réponse
    let quizData;
    try {
      quizData = JSON.parse(text);
      if (!quizData || !Array.isArray(quizData.quiz)) {
        throw new Error(
          "Le JSON reçu n'a pas la structure attendue { quiz: [...] }."
        );
      }
    } catch (parseError) {
      // 'parseError' est maintenant utilisé
      console.error(
        'Erreur de parsing du JSON de Groq:',
        parseError,
        'Texte reçu:',
        text
      );
      // On lance une nouvelle erreur qui inclut le message d'origine
      throw new Error(
        `L'IA a renvoyé une réponse JSON mal formatée. Erreur: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // 9. Renvoyer le quiz
    return NextResponse.json({ quiz: quizData.quiz }, { status: 200 });
  } catch (error: unknown) {
    // 'any' corrigé en 'unknown'
    console.error('Erreur API Generate Quiz:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
