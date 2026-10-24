import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validation des entrées des routes API (corps JSON, paramètres d'URL) et de la sortie du modèle.
 * Chaque route déclare un schéma ; une entrée invalide renvoie une 400 avec le champ fautif.
 */

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

function fail(error: z.ZodError): { ok: false; response: NextResponse } {
  const issue = error.issues[0];
  const path = issue?.path.join('.') || 'payload';
  return {
    ok: false,
    response: NextResponse.json({ error: `Paramètre invalide : ${path}`, field: path }, { status: 400 }),
  };
}

export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParseResult<z.infer<S>>> {
  const raw = await request.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  return result.success ? { ok: true, data: result.data } : fail(result.error);
}

export function parseSearchParams<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): ParseResult<z.infer<S>> {
  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(raw);
  return result.success ? { ok: true, data: result.data } : fail(result.error);
}

// ---------- Briques communes ----------

const documentPath = z.string().trim().min(1).max(500);
const pageNumber = z
  .union([z.number(), z.string().regex(/^\d{1,6}$/).transform(Number)])
  .pipe(z.number().int().min(0).max(100_000));
const nullableInt = pageNumber.nullish();

export const pageRangeSchema = z
  .object({ start: nullableInt, end: nullableInt })
  .nullish();

// ---------- Routes de génération ----------

export const generateQuizSchema = z.object({
  query: z.string().trim().min(1, 'Question manquante').max(500),
  documentPath: documentPath.optional(),
  // Valeur arrondie ensuite à 5 / 7 / 10 par la route
  numQuestions: z.number().int().min(1).max(50).optional(),
  mode: z.enum(['qcu', 'qcm', 'vf']).default('qcu'),
  theme: z.string().trim().max(120).optional(),
  pageRange: pageRangeSchema,
});

export const generateSummarySchema = z.object({
  documentPath,
  pageRange: pageRangeSchema,
});

export const generateThemesSchema = z.object({
  documentPath: documentPath.optional(),
  pageRange: pageRangeSchema,
});

export const flashcardsGenerateSchema = z.object({
  documentPath,
  limit: z.number().int().min(1).max(50).default(20),
});

export const flashcardsReviewSchema = z.object({
  flashcardId: z.string().trim().min(1).max(100),
  grade: z.number().int().min(0).max(5),
});

// ---------- Autres routes ----------

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().trim().url().max(2_000),
    expirationTime: z.number().nullish(),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
});

export const ACTIVITY_EVENT_TYPES = [
  'document_uploaded',
  'document_processed',
  'quiz_generated',
  'summary_generated',
  'flashcards_generated',
] as const;

export const activityEventSchema = z.object({
  eventType: z.enum(ACTIVITY_EVENT_TYPES),
  eventData: z.record(z.string(), z.unknown()).nullish().refine(
    (value) => !value || JSON.stringify(value).length <= 5_000,
    'eventData trop volumineux'
  ),
});

export const checkoutSchema = z.object({
  plan: z.enum(['partial', 'pro']),
});

export const documentStatusQuerySchema = z.object({
  id: z.string().regex(/^\d{1,15}$/, 'ID de document invalide'),
});

export const processFileSchema = z.object({
  filePath: z.string().trim().min(1).max(500),
  documentId: z.number().int().positive(),
  mimeType: z.string().trim().max(200).optional(),
});

// ---------- Quiz ----------

const optionText = z.string().max(1_000);

/** Question telle qu'enregistrée après normalisation côté client (défi partagé publiquement). */
export const storedQuizQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(2_000),
    options: z.record(z.string().max(10), optionText).refine((o) => Object.keys(o).length >= 2 && Object.keys(o).length <= 6),
    reponse_correcte: z.string().trim().max(10).optional(),
    reponses_correctes: z.array(z.string().trim().max(10)).max(6).optional(),
    justification: z.string().max(3_000).nullish(),
    source: z
      .object({ pageStart: z.number().int().min(1).max(100_000).nullable(), pageEnd: z.number().int().min(1).max(100_000).nullable() })
      .nullish(),
  })
  .refine((q) => q.reponse_correcte !== undefined || (q.reponses_correctes?.length ?? 0) > 0, {
    message: 'Réponse correcte manquante',
  });

export const challengeSchema = z.object({
  quiz: z.array(storedQuizQuestionSchema).min(1).max(50),
  score: z.coerce.number().int().min(0),
  total: z.coerce.number().int().min(1).max(50),
  authorName: z.string().trim().max(80).nullish(),
}).refine((c) => c.score <= c.total, { message: 'Score supérieur au total', path: ['score'] });

/**
 * Sortie brute du modèle : volontairement souple (le client la normalise ensuite avec
 * normalizeQuiz), mais elle doit être un tableau de questions exploitables.
 */
const rawModelQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(3_000),
    options: z.union([z.array(z.unknown()).min(2).max(8), z.record(z.string(), z.unknown())]),
    reponse_correcte: z.unknown().optional(),
    reponses_correctes: z.unknown().optional(),
    justification: z.unknown().optional(),
  })
  .refine((q) => q.reponse_correcte !== undefined || q.reponses_correctes !== undefined);

/** Garde les questions valides ; renvoie null si le JSON n'a pas la forme { quiz: [...] }. */
export function validateModelQuiz(parsed: unknown): { valid: unknown[]; dropped: number } | null {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { quiz?: unknown }).quiz)) {
    return null;
  }
  const items = (parsed as { quiz: unknown[] }).quiz;
  const valid = items.filter((item) => rawModelQuestionSchema.safeParse(item).success);
  return { valid, dropped: items.length - valid.length };
}
