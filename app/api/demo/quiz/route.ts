import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { AI_MODELS } from '@/lib/constants';
import { estimateGroqCost } from '@/lib/aiUsage';
import { buildDemoPassages, DEMO_QUESTION_COUNT } from '@/lib/demo';
import { detectLanguage } from '@/lib/language';
import { generateQuiz, QuizGenerationError } from '@/lib/quizGeneration';
import { recordAiUsage, logActivity } from '@/lib/metricsLogger';
import { handleModelFailure } from '@/lib/opsAlerts';
import { enforceGlobalRateLimit, enforceIpRateLimit, RateLimitError, rateLimitErrorResponse } from '@/lib/rateLimit';
import { internalError, providerBusyResponse } from '@/lib/apiError';
import { demoQuizSchema, parseJsonBody } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Essai sans compte. Public, donc cadré de partout : texte de 200 à 3 000 caractères, 3 questions, aucune écriture
 * en base d'utilisateur, limite par IP, plafond global quotidien (le palier gratuit Groq est partagé avec les vrais utilisateurs).
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, demoQuizSchema);
    if (!parsed.ok) return parsed.response;
    const { text, sample } = parsed.data;

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "La démonstration n'est pas disponible pour le moment." }, { status: 503 });
    }

    try {
      await enforceIpRateLimit(req, 'demo-quiz');
      await enforceGlobalRateLimit('demo-quiz-global');
    } catch (limitError) {
      if (limitError instanceof RateLimitError) {
        return NextResponse.json(
          {
            error:
              limitError.scope === 'day'
                ? "L'essai gratuit est très demandé aujourd'hui. Créez un compte gratuit pour continuer, ou revenez demain."
                : `Un peu de patience, réessayez dans ${limitError.retryAfterSeconds} s.`,
            code: 'demo-limited',
            retryAfter: limitError.retryAfterSeconds,
          },
          { status: 429, headers: { 'Retry-After': String(limitError.retryAfterSeconds) } }
        );
      }
      throw limitError;
    }

    const passages = buildDemoPassages(text, Boolean(sample));
    const generation = await generateQuiz({
      groq: new Groq({ apiKey: groqKey }),
      passages,
      count: DEMO_QUESTION_COUNT,
      mode: 'qcu',
    });

    for (const call of generation.calls) {
      await recordAiUsage({
        provider: 'groq',
        model: call.model,
        promptTokens: call.promptTokens,
        completionTokens: call.completionTokens,
        totalTokens: call.promptTokens + call.completionTokens,
        latencyMs: call.latencyMs,
        cost: estimateGroqCost(call.promptTokens, call.completionTokens, call.model),
        metadata: { route: 'demo/quiz', produced: generation.questions.length, ...generation.stats },
        userId: null,
      });
    }
    await logActivity({
      eventType: 'demo_quiz_generated',
      userId: null,
      eventData: { produced: generation.questions.length, sample: Boolean(sample), chars: text.length },
    });

    return NextResponse.json({
      questions: generation.questions,
      language: detectLanguage(text).code,
    });
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    const busy = providerBusyResponse(error);
    if (busy) return busy;
    if (await handleModelFailure('demo/quiz', AI_MODELS.QUIZ_GENERATION, error)) {
      return NextResponse.json({ error: "La démonstration est momentanément indisponible." }, { status: 503, headers: { 'Retry-After': '300' } });
    }
    if (error instanceof QuizGenerationError && error.code === 'no-valid-questions') {
      return NextResponse.json(
        {
          error: "Je n'ai pas pu écrire de questions fiables à partir de ce texte. Essayez un passage plus long et plus explicatif (un paragraphe de cours, par exemple).",
          code: 'no-valid-questions',
        },
        { status: 422 }
      );
    }
    return internalError('demo-quiz', error, 'La génération a échoué. Réessayez dans un instant.');
  }
}
