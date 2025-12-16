import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CohereClient } from 'cohere-ai';
import Groq from 'groq-sdk';
import { AI_MODELS, BATCH_CONFIG, EMBEDDING_CONFIG } from '@/lib/constants';
import { recordAiUsage } from '@/lib/metricsLogger';
import { extractCohereTokenUsage, extractGroqUsage, estimateCohereEmbedCost, estimateGroqCost } from '@/lib/aiUsage';

type PageRange = {
  start?: number | null;
  end?: number | null;
};

type SectionRow = {
  content: string;
  page_start?: number | null;
  page_end?: number | null;
};

const EMBED_SLOT_KEY = '__cohere_next_available__';

const waitForEmbedSlot = async () => {
  const interval = BATCH_CONFIG.MIN_EMBED_INTERVAL_MS ?? 0;
  if (!interval) {
    return;
  }

  const now = Date.now();
  const nextAvailable = (globalThis as Record<string, number>)[EMBED_SLOT_KEY] ?? now;
  const waitMs = Math.max(0, nextAvailable - now);

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  (globalThis as Record<string, number>)[EMBED_SLOT_KEY] = Date.now() + interval;
};

// Initialisation déplacée dans le handler pour une gestion propre des erreurs de configuration

// Mini-verrou en mémoire pour éviter les appels concurrents sur le même document
// Note: in-memory, non partagé entre instances (suffisant pour un mini-verrou local)
const inFlightByDoc = new Map<string, number>(); // value: timestamp de début
const LOCK_TTL_MS = 30_000; // 30s de TTL de sécurité

export async function POST(req: Request) {
  let docKey: string | undefined;
  try {
    const body = await req.json();
    const { documentPath, pageRange } = (body || {}) as {
      documentPath?: string;
      pageRange?: PageRange | null;
    };

    const pageStart = pageRange?.start ?? null;
    const pageEnd = pageRange?.end ?? null;

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

    const embedPrompt = 'Identifier les thèmes principaux, chapitres, sujets clés et sous-thèmes pertinents du document.';
    const embedMaxRetries = 1 + (BATCH_CONFIG.MAX_RETRIES ?? 3);
    const embedBaseDelay = BATCH_CONFIG.RETRY_BASE_DELAY_MS ?? 1500;
    const embedRateDelay = BATCH_CONFIG.RATE_LIMIT_DELAY_MS ?? 4000;

    let queryEmbedding: number[] | null = null;
    for (let attempt = 0; attempt < embedMaxRetries; attempt++) {
      try {
        await waitForEmbedSlot();

        const embedStartedAt = Date.now();
        const embedResponse = await cohere.embed({
          texts: [embedPrompt],
          model: AI_MODELS.COHERE_EMBEDDING,
          inputType: 'search_query',
        });
        // @ts-expect-error cohere types
        queryEmbedding = embedResponse.embeddings?.[0] ?? null;
        if (!queryEmbedding) {
          throw new Error("Cohere n'a pas retourné d'embedding pour la requête thèmes.");
        }
        const embedLatencyMs = Date.now() - embedStartedAt;
        const cohereUsage = extractCohereTokenUsage(embedResponse);
        await recordAiUsage({
          provider: 'cohere',
          model: AI_MODELS.COHERE_EMBEDDING,
          promptTokens: cohereUsage.inputTokens,
          completionTokens: cohereUsage.outputTokens,
          totalTokens: cohereUsage.totalTokens,
          latencyMs: embedLatencyMs,
          cost: estimateCohereEmbedCost(cohereUsage.totalTokens),
          metadata: {
            route: 'generate-themes',
            hasDocument: Boolean(documentPath),
            attempt,
          },
          userId: user.id,
        });
        break;
      } catch (err: unknown) {
        const statusCode = typeof err === 'object' && err && 'statusCode' in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
        if (statusCode === 429 && attempt < embedMaxRetries - 1) {
          const waitMs = embedRateDelay * (attempt + 1);
          console.warn(`[GenerateThemes] Rate limit Cohere, retry ${attempt + 1}/${embedMaxRetries - 1} dans ${waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        if (attempt < embedMaxRetries - 1) {
          const waitMs = embedBaseDelay * (attempt + 1);
          console.warn(`[GenerateThemes] Erreur Cohere, retry ${attempt + 1}/${embedMaxRetries - 1} dans ${waitMs}ms`, err);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }

    if (!queryEmbedding) {
      throw new Error("Impossible de récupérer l'embedding de la requête thèmes.");
    }

    const { data: sections, error: matchError } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
      match_count: Math.max(EMBEDDING_CONFIG.MATCH_COUNT, 20),
      p_user_id: user.id,
      p_document_path: documentPath,
      p_page_start: pageStart,
      p_page_end: pageEnd,
    });

    if (matchError) throw new Error(matchError.message);
    if (!sections || sections.length === 0) {
      return NextResponse.json({ themes: [] }, { status: 200 });
    }

    const context = (sections as SectionRow[])
      .map((section) => {
        const start = section.page_start ?? null;
        const end = section.page_end ?? null;
        if (start || end) {
          const label = start && end && start !== end
            ? `Pages ${start}-${end}`
            : `Page ${start ?? end}`;
          return `${label} :
${section.content}`;
        }
        return section.content;
      })
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
        const groqStartedAt = Date.now();
        const localCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'Tu réponds uniquement avec un JSON valide.' },
            { role: 'user', content: prompt },
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        completion = localCompletion;

        const groqLatencyMs = Date.now() - groqStartedAt;
        const groqUsage = extractGroqUsage(localCompletion.usage);
        await recordAiUsage({
          provider: 'groq',
          model: localCompletion.model ?? 'llama-3.1-8b-instant',
          promptTokens: groqUsage.promptTokens,
          completionTokens: groqUsage.completionTokens,
          totalTokens: groqUsage.totalTokens,
          latencyMs: groqLatencyMs,
          cost: estimateGroqCost(groqUsage.promptTokens, groqUsage.completionTokens),
          metadata: {
            route: 'generate-themes',
            sections: Array.isArray(sections) ? sections.length : null,
            attempt: retries,
          },
          userId: user.id,
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
