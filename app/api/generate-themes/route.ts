import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CohereClient } from 'cohere-ai';
import Groq from 'groq-sdk';
import { EMBEDDING_CONFIG } from '@/lib/constants';

// Initialisation déplacée dans le handler pour une gestion propre des erreurs de configuration

// Mini-verrou en mémoire pour éviter les appels concurrents sur le même document
// Note: in-memory, non partagé entre instances (suffisant pour un mini-verrou local)
const inFlightByDoc = new Map<string, number>(); // value: timestamp de début
const LOCK_TTL_MS = 30_000; // 30s de TTL de sécurité

export async function POST(req: Request) {
  let docKey: string | undefined;
  try {
    const body = await req.json();
    const { documentPath } = (body || {}) as { documentPath?: string };

    // Verrouillage par documentPath (si fourni)
    if (documentPath) {
      docKey = documentPath;
      const now = Date.now();
      const startedAt = inFlightByDoc.get(documentPath);
      // Si déjà en cours et pas expiré → 429
      if (startedAt && (now - startedAt) < LOCK_TTL_MS) {
        return NextResponse.json(
          { error: 'Génération de thèmes déjà en cours pour ce document. Réessayez dans quelques secondes.' },
          { status: 429 }
        );
      }
      inFlightByDoc.set(documentPath, now);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
        { status: 503 }
      );
    }

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Embedding d'une requête neutre pour récupérer des sections représentatives
    // Initialiser les clients IA
    const cohereKey = process.env.COHERE_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!cohereKey || !groqKey) {
      return NextResponse.json(
        { error: 'Configuration IA manquante (COHERE_API_KEY / GROQ_API_KEY)' },
        { status: 503 }
      );
    }
    const cohere = new CohereClient({ token: cohereKey });

    const embedResponse = await cohere.embed({
      texts: [
        'Identifier les thèmes principaux, chapitres, sujets clés et sous-thèmes pertinents du document.'
      ],
      model: 'embed-multilingual-v3.0',
      inputType: 'search_query',
    });
    // @ts-expect-error cohere types
    const queryEmbedding = embedResponse.embeddings?.[0];
    if (!queryEmbedding) {
      throw new Error("Cohere n'a pas retourné d'embedding pour la requête thèmes.");
    }

    const { data: sections, error: matchError } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
      match_count: Math.max(EMBEDDING_CONFIG.MATCH_COUNT, 20),
      p_user_id: user.id,
      p_document_path: documentPath,
    });

    if (matchError) throw new Error(matchError.message);
    if (!sections || sections.length === 0) {
      return NextResponse.json({ themes: [] }, { status: 200 });
    }

    const context = (sections as { content: string }[])
      .map((s) => s.content)
      .join('\n\n---\n\n')
      .slice(0, 12000); // limite le contexte

    const prompt = `
Tu es un assistant pédagogique. À partir du CONTEXTE suivant, propose une liste concise de thèmes pertinents pour créer des quiz.
Règles :
  - Propose exactement 3 thèmes pertinents, sans doublons.
- Chaque thème doit être court (3-7 mots) et spécifique au contenu.
- Réponds uniquement avec un JSON valide du format : { "themes": ["...", "..."] }.

CONTEXTE:
"""
${context}
"""
`;

    // Retry avec exponential backoff pour gérer les rate limits
    let completion;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'Tu réponds uniquement avec un JSON valide.' },
            { role: 'user', content: prompt },
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        break; // Succès, sortir de la boucle
      } catch (err: unknown) {
        const status = (typeof err === 'object' && err && 'status' in err)
          ? (err as { status?: number }).status
          : undefined;
        if (status === 429 && retries < maxRetries) {
          // Rate limit atteint, attendre avant de réessayer
          const waitTime = Math.min(1000 * Math.pow(2, retries), 30000); // Max 30 secondes
          console.log(`Rate limit atteint, retry ${retries + 1}/${maxRetries} dans ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw err; // Autre erreur ou max retries atteint
        }
      }
    }

    if (!completion) {
      throw new Error('Impossible de générer les thèmes après plusieurs tentatives.');
    }

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error("L'IA n'a pas renvoyé de réponse.");

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Réponse JSON mal formée pour les thèmes.');
    }

    let themes: string[] = [];
    if (typeof data === 'object' && data && 'themes' in data) {
      const raw = (data as { themes?: unknown }).themes;
      if (Array.isArray(raw)) {
        themes = raw
          .map((t) => (t ?? '').toString())
          .filter((s) => s.trim().length > 0)
          .slice(0, 3);
      }
    }

    return NextResponse.json({ themes }, { status: 200 });
  } catch (error: unknown) {
    console.error('Erreur API Generate Themes:', error);
    let message = 'Erreur inconnue';
    let status = 500;
    
    if (error instanceof Error) {
      message = error.message;
      // Détecter les rate limits pour donner un message plus clair
      if (message.includes('Rate limit') || message.includes('429')) {
        message = 'Le service est temporairement surchargé. Veuillez réessayer dans quelques secondes.';
        status = 429;
      }
    }
    
    return NextResponse.json({ error: message }, { status });
  }
  finally {
    if (docKey) inFlightByDoc.delete(docKey);
  }
}
