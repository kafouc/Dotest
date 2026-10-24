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
