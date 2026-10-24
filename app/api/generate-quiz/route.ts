import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import Groq from 'groq-sdk';
import { EMBEDDING_CONFIG, AI_MODELS, QUIZ_LIMITS } from '@/lib/constants';
import { retrievePassages } from '@/lib/retrieval';
import { generateQuiz, QuizGenerationError, QUIZ_PROMPT_VERSION } from '@/lib/quizGeneration';
import { recordAiUsage } from '@/lib/metricsLogger';
import { touchUserStreak } from '@/lib/streaks';
import { extractEmbeddingUsage, estimateGroqCost, estimateEmbeddingCost } from '@/lib/aiUsage';
import { ensureQuizQuota, QuotaError } from '@/lib/quota';
import { logExportEvent } from '@/lib/exportEvents';
import { parseJsonBody, generateQuizSchema } from '@/lib/validation';
import { createQueryEmbedding } from '@/lib/jinaClient';
import { internalError, providerBusyResponse } from '@/lib/apiError';
import { handleModelFailure } from '@/lib/opsAlerts';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';

// Initialisation déplacée dans le handler pour gérer proprement l'absence de config

// --- Handler de la route API (POST) ---
export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, generateQuizSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    // Vérifier la configuration Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
        { status: 503 }
      );
    }

    const jinaKey = process.env.JINA_API_KEY;
    if (!jinaKey) {
      return NextResponse.json(
        { error: 'Configuration IA manquante (JINA_API_KEY)' },
        { status: 503 }
      );
    }

    // Initialisation client Groq avec vérification de la clé
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json(
        { error: 'Configuration IA manquante (GROQ_API_KEY)' },
        { status: 503 }
      );
    }
    const groq = new Groq({ apiKey: groqKey });
    const userQuery = body.query;
    const documentPath = body.documentPath;
    const numQuestions = body.numQuestions ?? QUIZ_LIMITS.DEFAULT_QUESTIONS;
    const mode = body.mode;
    const theme = body.theme || undefined;
    const pageStart = body.pageRange?.start ?? null;
    const pageEnd = body.pageRange?.end ?? null;

    const allowedCounts = [5, 7, 10];
    const nearestAllowed = allowedCounts.reduce((prev, cur) => {
      const n = typeof numQuestions === 'number' ? numQuestions : QUIZ_LIMITS.DEFAULT_QUESTIONS;
      return Math.abs(cur - n) < Math.abs(prev - n) ? cur : prev;
    }, QUIZ_LIMITS.DEFAULT_QUESTIONS);
    const count = allowedCounts.includes(numQuestions) ? numQuestions : nearestAllowed;

    // 1. Client Supabase
    const supabase = await createSupabaseServerClient();

    // 2. Vérifier l'utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await enforceRateLimit(supabase, user.id, 'generate-quiz');
    await ensureQuizQuota(supabase, user.id, documentPath ?? null);

    // 3. Vecteur de la question (avec cache mémoire : un même thème rouvert ne repaie pas Jina)
    const embedStartedAt = Date.now();
    const query = await createQueryEmbedding(userQuery, AI_MODELS.EMBEDDING);
    if (query.embedding.length !== EMBEDDING_CONFIG.EMBEDDING_DIMENSION) {
      throw new Error(
        `Dimension d'embedding Jina inattendue: ${query.embedding.length} (attendu: ${EMBEDDING_CONFIG.EMBEDDING_DIMENSION}).`
      );
    }
    if (query.response) {
      const embedUsage = extractEmbeddingUsage(query.response);
      await recordAiUsage({
        provider: 'jina',
        model: AI_MODELS.EMBEDDING,
        promptTokens: embedUsage.promptTokens,
        completionTokens: 0,
        totalTokens: embedUsage.totalTokens,
        latencyMs: Date.now() - embedStartedAt,
        cost: estimateEmbeddingCost(embedUsage.totalTokens),
        metadata: { route: 'generate-quiz', stage: 'embedding', hasDocument: Boolean(documentPath) },
        userId: user.id,
      });
    }

    // 4. Passages pertinents : recherche hybride (vecteurs + mots-clés) puis reclassement
    const retrievalStartedAt = Date.now();
    const retrieval = await retrievePassages(supabase, {
      userId: user.id,
      queryText: [userQuery, theme].filter(Boolean).join(' — '),
      queryEmbedding: query.embedding,
      documentPath,
      pageStart,
      pageEnd,
    });
    if (retrieval.rerankTokens > 0) {
      await recordAiUsage({
        provider: 'jina',
        model: AI_MODELS.RERANKER,
        promptTokens: retrieval.rerankTokens,
        completionTokens: 0,
        totalTokens: retrieval.rerankTokens,
        latencyMs: Date.now() - retrievalStartedAt,
        cost: estimateEmbeddingCost(retrieval.rerankTokens),
        metadata: { route: 'generate-quiz', stage: 'rerank', mode: retrieval.mode },
        userId: user.id,
      });
    }
    if (retrieval.passages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Je n'ai trouvé aucune information pertinente dans vos documents pour répondre à cette demande.",
        },
        { status: 404 }
      );
    }

    // 5-8. Génération, vérification des citations, dédoublonnage, mélange des propositions
    const generation = await generateQuiz({ groq, passages: retrieval.passages, count, mode, theme });
    for (const call of generation.calls) {
      await recordAiUsage({
        provider: 'groq',
        model: call.model,
        promptTokens: call.promptTokens,
        completionTokens: call.completionTokens,
        totalTokens: call.promptTokens + call.completionTokens,
        latencyMs: call.latencyMs,
        cost: estimateGroqCost(call.promptTokens, call.completionTokens, call.model),
        metadata: {
          route: 'generate-quiz',
          mode,
          questionCount: count,
          produced: generation.questions.length,
          retrieval: retrieval.mode,
          promptVersion: QUIZ_PROMPT_VERSION,
          ...generation.stats,
        },
        userId: user.id,
      });
    }
    const quizData = { quiz: generation.questions };

    // 9. Enregistrer la progression utilisateur (flamme)
    await touchUserStreak(supabase, user.id);
    await logExportEvent(supabase, {
      userId: user.id,
      kind: 'quiz_export',
      documentPath: documentPath ?? null,
      context: JSON.stringify({
        questionCount: count,
        mode,
        theme: theme ?? null,
      }),
    });

    // Logger l'activité pour le dashboard admin
    const { logActivity } = await import('@/lib/metricsLogger');
    await logActivity({
      eventType: 'quiz_generated',
      userId: user.id,
      eventData: {
        documentPath: documentPath ?? null,
        questionCount: count,
        mode,
        theme: theme ?? null,
      },
    });

    // 10. Renvoyer le quiz
    return NextResponse.json({ quiz: quizData.quiz }, { status: 200 });
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
    const busy = providerBusyResponse(error);
    if (busy) return busy;
    if (await handleModelFailure('generate-quiz', AI_MODELS.QUIZ_GENERATION, error)) {
      return NextResponse.json(
        { error: 'Le service de génération est momentanément indisponible. Nous avons été prévenus.' },
        { status: 503, headers: { 'Retry-After': '300' } }
      );
    }
    if (error instanceof QuizGenerationError && error.code === 'no-valid-questions') {
      return NextResponse.json(
        {
          error:
            "Je n'ai pas pu écrire de questions fiables à partir des passages trouvés. Essayez un autre thème, une autre formulation ou une plage de pages différente.",
          code: 'no-valid-questions',
        },
        { status: 422 }
      );
    }
    return internalError('generate-quiz', error, 'La génération du quiz a échoué. Réessayez dans un instant.');
  }
}
