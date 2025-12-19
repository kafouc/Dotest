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
