/**
 * Paramètres de raisonnement selon la famille de modèle Groq.
 * - openai/gpt-oss-* : effort de raisonnement réglable ; le raisonnement est exclu de la réponse.
 * - qwen/* : raisonnement masqué dans la réponse (sinon des balises <think> cassent le JSON).
 * - autres modèles : aucun paramètre (les envoyer provoquerait une erreur 400).
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

export function reasoningParams(model: string, effort: ReasoningEffort = 'low') {
  if (model.startsWith('openai/gpt-oss')) {
    return { reasoning_effort: effort, include_reasoning: false } as const;
  }
  if (model.startsWith('qwen/')) {
    return { reasoning_format: 'hidden' } as const;
  }
  return {} as const;
}

/**
 * Groq valide le JSON côté serveur en mode `json_object` et répond 400 `json_validate_failed` quand le modèle
 * en produit un invalide (surtout les petits modèles). L'erreur est passagère : un nouvel essai suffit souvent.
 */
export function isJsonValidateFailure(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string; error?: { error?: { code?: string } } } | null;
  if (!e) return false;
  const code = e.code ?? e.error?.error?.code ?? '';
  return code === 'json_validate_failed' || (e.status === 400 && /failed to generate json/i.test(e.message ?? ''));
}

/** Les modèles gpt-oss acceptent un schéma JSON strict (sortie garantie conforme) ; les autres, le mode JSON simple. */
export function supportsStrictSchema(model: string): boolean {
  return model.startsWith('openai/gpt-oss');
}

/** Exécute un appel Groq et le relance une fois si Groq a refusé un JSON invalide. */
export async function withJsonRetry<T>(call: () => Promise<T>, attempts = 2): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!isJsonValidateFailure(error) || attempt >= attempts) throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Limite de débit du fournisseur (429)
// ---------------------------------------------------------------------------

/** Groq est saturé pour le moment (palier gratuit : 8 000 jetons/minute, tous utilisateurs confondus). */
export class ProviderBusyError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('Le service IA est très sollicité.');
    this.name = 'ProviderBusyError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Délai conseillé par Groq : en-tête Retry-After, sinon « try again in 8.4s » / « 1m2.5s » dans le message. */
export function parseRetryAfterSeconds(error: unknown): number | null {
  const e = error as { headers?: Record<string, string> | Headers; message?: string } | null;
  if (!e) return null;
  const headers = e.headers as unknown;
  const header =
    headers && typeof (headers as Headers).get === 'function'
      ? (headers as Headers).get('retry-after')
      : (headers as Record<string, string> | undefined)?.['retry-after'];
  if (header && Number.isFinite(Number(header))) return Number(header);

  const message = e.message ?? '';
  const match = message.match(/try again in (?:(\d+)m)?\s*([\d.]+)s/i);
  if (!match) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2]);
}

export function isRateLimitError(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null;
  return e?.status === 429 || e?.code === 'rate_limit_exceeded';
}

/** Attend et réessaie une fois si le délai est court ; sinon lève ProviderBusyError avec le délai à communiquer. */
export async function withRateLimitRetry<T>(call: () => Promise<T>, maxWaitMs = 12_000): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    const wait = parseRetryAfterSeconds(error);
    if (wait !== null && wait * 1000 <= maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 500));
      try {
        return await call();
      } catch (second) {
        if (!isRateLimitError(second)) throw second;
        throw new ProviderBusyError(Math.ceil(parseRetryAfterSeconds(second) ?? wait + 10));
      }
    }
    throw new ProviderBusyError(Math.ceil(wait ?? 30));
  }
}
