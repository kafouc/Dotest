import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import Groq from 'groq-sdk';
import { THEME_GENERATION_CONFIG, AI_MODELS, AI_OUTPUT_LIMITS } from '@/lib/constants';
import { isJsonValidateFailure, reasoningParams } from '@/lib/groqParams';
import { handleModelFailure } from '@/lib/opsAlerts';
import { detectLanguage, languageInstruction } from '@/lib/language';
import { recordAiUsage } from '@/lib/metricsLogger';
import { extractGroqUsage, estimateGroqCost } from '@/lib/aiUsage';
import { parseJsonBody, generateThemesSchema } from '@/lib/validation';
import { internalError } from '@/lib/apiError';
import { logger } from '@/lib/logger';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';

type SectionRow = {
  content: string;
  page_start?: number | null;
  page_end?: number | null;
};

// Mini-verrou en mémoire pour éviter les appels concurrents sur le même document
// Note: in-memory, non partagé entre instances (suffisant pour un mini-verrou local)
const THEME_MODEL = AI_MODELS.THEME_GENERATION;

// Cache mémoire des thèmes (par instance) : rouvrir un document ne repaie pas une génération.
const THEME_CACHE_TTL_MS = 30 * 60 * 1000;
const THEME_CACHE_MAX = 200;
const themeCache = new Map<string, { themes: string[]; expiresAt: number }>();
const inFlightByDoc = new Map<string, number>(); // value: timestamp de début
const LOCK_TTL_MS = 30_000; // 30s de TTL de sécurité

export async function POST(req: Request) {
  let docKey: string | undefined;
  try {
    const parsedBody = await parseJsonBody(req, generateThemesSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { documentPath, pageRange } = parsedBody.data;

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

    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const cacheKey = documentPath ? `${user.id}|${documentPath}|${pageStart ?? ''}|${pageEnd ?? ''}` : null;
    if (cacheKey) {
      const hit = themeCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return NextResponse.json({ themes: hit.themes, cached: true }, { status: 200 });
      }
    }

    await enforceRateLimit(supabase, user.id, 'generate-themes');
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json(
        { error: 'Configuration IA manquante (GROQ_API_KEY)' },
        { status: 503 }
      );
    }
    const groq = new Groq({ apiKey: groqKey });

    const maxThemes = THEME_GENERATION_CONFIG.MAX_THEMES;
    const contextLimit = THEME_GENERATION_CONFIG.MAX_CONTEXT_CHARS;
    const sectionLimit = THEME_GENERATION_CONFIG.SECTION_SAMPLE_LIMIT;

    const sectionsQuery = supabase
      .from('document_sections')
      .select('content, page_start, page_end')
      .eq('user_id', user.id);

    if (documentPath) {
      sectionsQuery.eq('document_path', documentPath).order('page_start', { ascending: true });
    } else {
      sectionsQuery.order('id', { ascending: false });
    }

    if (pageStart != null) {
      sectionsQuery.gte('page_end', pageStart);
    }
    if (pageEnd != null) {
      sectionsQuery.lte('page_start', pageEnd);
    }

    const { data: sectionsData, error: sectionsError } = await sectionsQuery.limit(sectionLimit);
    if (sectionsError) throw new Error(sectionsError.message);

    const sections = (sectionsData as SectionRow[]) ?? [];

    if (sections.length === 0) {
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
      .slice(0, contextLimit);

    const prompt = `
Tu es un assistant pédagogique. À partir du CONTEXTE suivant, propose une liste concise de thèmes pertinents pour créer des quiz.
${languageInstruction(detectLanguage(context))}
Règles :
  - Propose exactement ${maxThemes} thèmes pertinents, sans doublons.
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
        const groqStartedAt = Date.now();
        const localCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'Tu réponds uniquement avec un JSON valide.' },
            { role: 'user', content: prompt },
          ],
          model: THEME_MODEL,
          temperature: 0.2,
          max_completion_tokens: AI_OUTPUT_LIMITS.THEME_TOKENS,
          response_format: { type: 'json_object' },
          ...reasoningParams(THEME_MODEL, 'low'),
        });
        completion = localCompletion;

        const groqLatencyMs = Date.now() - groqStartedAt;
        const groqUsage = extractGroqUsage(localCompletion.usage);
        await recordAiUsage({
          provider: 'groq',
          model: localCompletion.model ?? THEME_MODEL,
          promptTokens: groqUsage.promptTokens,
          completionTokens: groqUsage.completionTokens,
          totalTokens: groqUsage.totalTokens,
          latencyMs: groqLatencyMs,
          cost: estimateGroqCost(groqUsage.promptTokens, groqUsage.completionTokens, localCompletion.model ?? THEME_MODEL),
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
        if (isJsonValidateFailure(err) && retries < 1) {
          retries++; // JSON refusé par Groq : un nouvel essai suffit généralement
          continue;
        }
        if (status === 429 && retries < maxRetries) {
          // Rate limit atteint, attendre avant de réessayer
          const waitTime = Math.min(1000 * Math.pow(2, retries), 30000); // Max 30 secondes
          logger.info(`Rate limit atteint, retry ${retries + 1}/${maxRetries} dans ${waitTime}ms`);
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
          .slice(0, maxThemes);
      }
    }

    if (cacheKey && themes.length > 0) {
      themeCache.set(cacheKey, { themes, expiresAt: Date.now() + THEME_CACHE_TTL_MS });
      if (themeCache.size > THEME_CACHE_MAX) {
        const oldest = themeCache.keys().next().value;
        if (oldest !== undefined) themeCache.delete(oldest);
      }
    }

    return NextResponse.json({ themes }, { status: 200 });
  } catch (error: unknown) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    if (await handleModelFailure('generate-themes', THEME_MODEL, error)) {
      return NextResponse.json(
        { error: 'Le service de génération est momentanément indisponible. Nous avons été prévenus.' },
        { status: 503, headers: { 'Retry-After': '300' } }
      );
    }
    const upstreamStatus = (typeof error === 'object' && error && 'status' in error) ? (error as { status?: number }).status : undefined;
    if (upstreamStatus === 429 || (error instanceof Error && /rate limit/i.test(error.message))) {
      return NextResponse.json(
        { error: 'Le service est temporairement surchargé. Veuillez réessayer dans quelques secondes.' },
        { status: 429 }
      );
    }
    return internalError('generate-themes', error, 'La génération des thèmes a échoué. Réessayez dans un instant.');
  }
  finally {
    if (docKey) inFlightByDoc.delete(docKey);
  }
}
