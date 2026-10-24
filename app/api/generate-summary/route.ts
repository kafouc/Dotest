import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Groq from 'groq-sdk';
import { EMBEDDING_CONFIG, AI_MODELS } from '@/lib/constants';
import { recordAiUsage } from '@/lib/metricsLogger';
import { touchUserStreak } from '@/lib/streaks';
import { extractEmbeddingUsage, extractGroqUsage, estimateGroqCost, estimateEmbeddingCost } from '@/lib/aiUsage';
import { ensureRevisionQuota, QuotaError } from '@/lib/quota';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { logExportEvent } from '@/lib/exportEvents';
import { createJinaEmbeddings, extractEmbeddingsFromResponse, formatJinaError } from '@/lib/jinaClient';

type PageRange = {
  start?: number | null;
  end?: number | null;
};

type SectionRow = {
  content: string;
  page_start?: number | null;
  page_end?: number | null;
};

if (!process.env.GROQ_API_KEY) {
  throw new Error('La clé API GROQ_API_KEY est manquante');
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentPath, pageRange } = (body || {}) as {
      documentPath?: string;
      pageRange?: PageRange | null;
    };
    if (!documentPath) {
      return NextResponse.json({ error: 'documentPath requis' }, { status: 400 });
    }

    const pageStart = pageRange?.start ?? null;
    const pageEnd = pageRange?.end ?? null;


    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    await enforceRateLimit(supabase, user.id, 'generate-summary');
    await ensureRevisionQuota(supabase, user.id);

    if (!process.env.JINA_API_KEY) {
      return NextResponse.json({ error: 'Configuration IA manquante (JINA_API_KEY)' }, { status: 503 });
    }

    // 1) Embedding d'une requête neutre pour récupérer des sections représentatives
    const embedStartedAt = Date.now();
    const embedResponse = await createJinaEmbeddings([
      'Synthétise le document: points clés, définitions, formules, erreurs fréquentes, conseils, 5 questions d’auto-évaluation.',
    ], AI_MODELS.EMBEDDING);
    const rawEmbedding = extractEmbeddingsFromResponse(embedResponse)[0];
    if (!Array.isArray(rawEmbedding) || rawEmbedding.length === 0) {
      throw new Error("Jina n'a pas renvoyé d'embedding valide.");
    }
    if (rawEmbedding.length !== EMBEDDING_CONFIG.EMBEDDING_DIMENSION) {
      throw new Error(
        `Dimension d'embedding Jina inattendue: ${rawEmbedding.length} (attendu: ${EMBEDDING_CONFIG.EMBEDDING_DIMENSION}).`
      );
    }
    const queryEmbedding = rawEmbedding as number[];

    const embedLatencyMs = Date.now() - embedStartedAt;
    const embedUsage = extractEmbeddingUsage(embedResponse);
    await recordAiUsage({
      provider: 'jina',
      model: AI_MODELS.EMBEDDING,
      promptTokens: embedUsage.promptTokens,
      completionTokens: 0,
      totalTokens: embedUsage.totalTokens,
      latencyMs: embedLatencyMs,
      cost: estimateEmbeddingCost(embedUsage.totalTokens),
      metadata: {
        route: 'generate-summary',
        stage: 'embedding',
        hasPageRange: Boolean(pageRange),
      },
      userId: user.id,
    });

    // 2) Récupération sections (RAG)
    const { data: sections, error: matchErr } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
      match_count: Math.max(EMBEDDING_CONFIG.MATCH_COUNT, 28),
      p_user_id: user.id,
      p_document_path: documentPath,
      p_page_start: pageStart,
      p_page_end: pageEnd,
    });
    if (matchErr) throw new Error(matchErr.message);
    if (!sections || sections.length === 0) {
      return NextResponse.json({ error: 'Aucune section pertinente trouvée.' }, { status: 404 });
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
      .slice(0, 12000);

    // 3) Prompt résumé structuré
    const prompt = `
Tu es un excellent pédagogue. À partir du CONTEXTE ci-dessous, produis une fiche de révision concise et structurée.
Règles:
- Écris un JSON valide: { "summary": string, "key_points": string[], "definitions": string[], "formulas": string[], "pitfalls": string[], "tips": string[], "self_test": string[] }
- "summary": 120-200 mots maximum, sans redondance.
- "key_points": 5-8 items (phrases courtes).
- "definitions": 3-6 items (concept: définition).
- "formulas": 0-6 items (si applicable), en texte simple.
- "pitfalls": 3-6 erreurs fréquentes ou confusions à éviter.
- "tips": 3-6 conseils pratiques de mémorisation/application.
- "self_test": 5 questions d'auto-évaluation (claires et ciblées).
- N'inventes pas hors du CONTEXTE.
- Réponds uniquement avec l'objet JSON.

CONTEXTE:
"""
${context}
"""
`.trim();

    const groqStartedAt = Date.now();
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Tu réponds uniquement avec un JSON valide.' },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const groqLatencyMs = Date.now() - groqStartedAt;
    const groqUsage = extractGroqUsage(completion.usage);
    await recordAiUsage({
      provider: 'groq',
      model: completion.model ?? 'llama-3.1-8b-instant',
      promptTokens: groqUsage.promptTokens,
      completionTokens: groqUsage.completionTokens,
      totalTokens: groqUsage.totalTokens,
      latencyMs: groqLatencyMs,
      cost: estimateGroqCost(groqUsage.promptTokens, groqUsage.completionTokens),
      metadata: {
        route: 'generate-summary',
        sections: Array.isArray(sections) ? sections.length : null,
      },
      userId: user.id,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error("L'IA n'a pas renvoyé de réponse.");

    type SummaryJSON = {
      summary?: unknown;
      key_points?: unknown;
      definitions?: unknown;
      formulas?: unknown;
      pitfalls?: unknown;
      tips?: unknown;
      self_test?: unknown;
    };
    let parsed: SummaryJSON;
    try {
      parsed = JSON.parse(text) as SummaryJSON;
    } catch {
      throw new Error('Réponse JSON mal formée pour la fiche de révision.');
    }

    const toText = (value: unknown): string => {
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        const inner = value.map((v) => toText(v)).filter((s) => s.length > 0);
        return inner.join(' — ');
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '';
        const lower = (k: string) => k.toLowerCase();
        const labelKeys = ['term','terme','concept','notion','mot','cle','clé','label','name','titre','topic','subject'];
        const defKeys = ['definition','définition','meaning','desc','description','explication','explanation','def','texte','text','value','content'];
        const lk = keys.find((k) => labelKeys.includes(lower(k)));
        const dk = keys.find((k) => defKeys.includes(lower(k)));
        if (lk || dk) {
          const left = lk ? toText(obj[lk]) : '';
          const right = dk ? toText(obj[dk]) : '';
          const combined = [left, right].filter((s) => s && s.length > 0).join(' — ');
          if (combined.length > 0) return combined;
        }
        const values = keys.map((k) => toText(obj[k])).filter((s) => s.length > 0);
        return values.join(' — ');
      }
      return '';
    };

    const sanitizeList = (v: unknown, max: number) =>
      (Array.isArray(v) ? v : [])
        .map((x) => toText(x))
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, max);

    const result = {
      summary: toText(parsed?.summary),
      key_points: sanitizeList(parsed?.key_points, 8),
      definitions: sanitizeList(parsed?.definitions, 6),
      formulas: sanitizeList(parsed?.formulas, 6),
      pitfalls: sanitizeList(parsed?.pitfalls, 6),
      tips: sanitizeList(parsed?.tips, 6),
      self_test: sanitizeList(parsed?.self_test, 5),
    };

    await touchUserStreak(supabase, user.id);
    await logExportEvent(supabase, {
      userId: user.id,
      kind: 'summary_export',
      documentPath,
      context: pageRange ? JSON.stringify({ pageRange }) : null,
    });

    // Logger l'activité pour le dashboard admin
    const { logActivity } = await import('@/lib/metricsLogger');
    await logActivity({
      eventType: 'summary_generated',
      userId: user.id,
      eventData: {
        documentPath,
        pageRange: pageRange ?? null,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    if (error instanceof QuotaError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        upgrade: true,
      }, { status: 402 });
    }
    console.error('Erreur API Generate Summary:', error);
    const msg = error instanceof Error ? formatJinaError(error) : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
