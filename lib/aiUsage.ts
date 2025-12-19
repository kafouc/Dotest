const GROQ_PROMPT_COST_PER_1K = Number(process.env.GROQ_COST_PER_1K_PROMPT ?? 0);
const GROQ_COMPLETION_COST_PER_1K = Number(process.env.GROQ_COST_PER_1K_COMPLETION ?? 0);
const EMBEDDING_COST_PER_1K = Number(process.env.EMBED_COST_PER_1K ?? 0);

export type GroqUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type EmbeddingUsage = {
  promptTokens: number;
  totalTokens: number;
};

export function extractEmbeddingUsage(response: unknown): EmbeddingUsage {
  const usage = (response as { usage?: Record<string, unknown> } | null | undefined)?.usage ?? {};
  const promptTokens = normalizeTokenValue((usage as Record<string, unknown>).prompt_tokens ?? (usage as Record<string, unknown>).promptTokens);
  const totalTokensRaw = (usage as Record<string, unknown>).total_tokens ?? (usage as Record<string, unknown>).totalTokens;
  const totalTokens = normalizeTokenValue(totalTokensRaw, promptTokens);
  return {
    promptTokens,
    totalTokens,
  };
}

export function extractGroqUsage(usage: unknown): GroqUsage {
  const u = usage as Record<string, unknown> | null | undefined;
  const promptTokens = normalizeTokenValue(u?.prompt_tokens ?? u?.promptTokens);
  const completionTokens = normalizeTokenValue(u?.completion_tokens ?? u?.completionTokens);
  const totalTokensRaw = u?.total_tokens ?? u?.totalTokens;
  const totalTokens = normalizeTokenValue(totalTokensRaw, promptTokens + completionTokens);
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

export function estimateGroqCost(promptTokens: number, completionTokens: number): number {
  if (!GROQ_PROMPT_COST_PER_1K && !GROQ_COMPLETION_COST_PER_1K) {
    return 0;
  }
  const promptCost = (promptTokens / 1000) * GROQ_PROMPT_COST_PER_1K;
  const completionCost = (completionTokens / 1000) * GROQ_COMPLETION_COST_PER_1K;
  return Number((promptCost + completionCost).toFixed(4));
}

export function estimateEmbeddingCost(totalTokens: number): number {
  if (!EMBEDDING_COST_PER_1K) {
    return 0;
  }
  const cost = (totalTokens / 1000) * EMBEDDING_COST_PER_1K;
  return Number(cost.toFixed(4));
}

function normalizeTokenValue(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed);
  }
  return fallback;
}
