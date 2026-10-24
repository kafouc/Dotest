type JinaEmbeddingData = {
  embedding?: number[];
  index?: number;
};

type JinaEmbeddingResponse = {
  data?: JinaEmbeddingData[];
  model?: string;
  usage?: {
    prompt_tokens?: number;
    promptTokens?: number;
    total_tokens?: number;
    totalTokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
};

class JinaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'JinaError';
    this.status = status;
  }
}

const DEFAULT_ENDPOINT = 'https://api.jina.ai/v1/embeddings';

export async function createJinaEmbeddings(input: string[], model: string): Promise<JinaEmbeddingResponse> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new JinaError('Configuration IA manquante (JINA_API_KEY)', 503);
  }

  const endpoint = process.env.JINA_API_URL ?? DEFAULT_ENDPOINT;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input,
      model,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JinaEmbeddingResponse;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Jina API error (${response.status})`;
    throw new JinaError(message, response.status);
  }

  return payload;
}

export function extractEmbeddingsFromResponse(response: JinaEmbeddingResponse): number[][] {
  return (response.data ?? []).map((item) => Array.isArray(item.embedding) ? item.embedding : []);
}

export function formatJinaError(error: unknown): string {
  if (error instanceof JinaError) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message?: string }).message ?? 'Erreur inconnue auprès de Jina';
  }
  return 'Erreur inconnue auprès de Jina';
}

// ---------------------------------------------------------------------------
// Embedding de requête avec cache mémoire (une même question ou un même thème rouvert ne repaie pas Jina)
// ---------------------------------------------------------------------------

const QUERY_CACHE_MAX = 200;
const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;
const queryCache = new Map<string, { embedding: number[]; expiresAt: number }>();

export async function createQueryEmbedding(
  text: string,
  model: string
): Promise<{ embedding: number[]; response: JinaEmbeddingResponse | null; cached: boolean }> {
  const key = `${model}:${text}`;
  const hit = queryCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    // Réinsertion pour garder l'ordre « le plus récemment utilisé en dernier »
    queryCache.delete(key);
    queryCache.set(key, hit);
    return { embedding: hit.embedding, response: null, cached: true };
  }

  const response = await createJinaEmbeddings([text], model);
  const embedding = extractEmbeddingsFromResponse(response)[0];
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new JinaError("Jina n'a pas retourné d'embedding valide.", 502);
  }

  queryCache.set(key, { embedding, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
  if (queryCache.size > QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  return { embedding, response, cached: false };
}

// ---------------------------------------------------------------------------
// Reclassement (reranker) : ordonne des passages par pertinence réelle pour la question
// ---------------------------------------------------------------------------

type JinaRerankResponse = {
  results?: { index?: number; relevance_score?: number }[];
  usage?: { total_tokens?: number; prompt_tokens?: number };
};

export type RerankResult = {
  ranking: { index: number; score: number }[];
  totalTokens: number;
};

/**
 * Renvoie les `topN` meilleurs documents, ou null si le reclassement échoue : l'appelant garde alors
 * l'ordre de la recherche hybride (le reclassement améliore le résultat mais n'est jamais indispensable).
 */
export async function rerankWithJina(
  query: string,
  documents: string[],
  model: string,
  topN: number
): Promise<RerankResult | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || documents.length === 0) return null;

  try {
    const response = await fetch(process.env.JINA_RERANK_URL ?? 'https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, query, documents, top_n: Math.min(topN, documents.length), return_documents: false }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as JinaRerankResponse;
    const ranking = (payload.results ?? [])
      .filter((r): r is { index: number; relevance_score: number } =>
        typeof r.index === 'number' && typeof r.relevance_score === 'number' && r.index >= 0 && r.index < documents.length
      )
      .map((r) => ({ index: r.index, score: r.relevance_score }));
    if (ranking.length === 0) return null;

    return { ranking, totalTokens: payload.usage?.total_tokens ?? payload.usage?.prompt_tokens ?? 0 };
  } catch {
    return null;
  }
}
