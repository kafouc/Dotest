/**
 * Constantes centralisées pour l'application
 * Évite les "magic numbers" et facilite la maintenance
 */

// Limites de fichiers
export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2 Mo
  MAX_SIZE_MB: 2,
  MAX_PAGES: 20,
} as const;

// Limites de traitement
export const PROCESSING_LIMITS = {
  MAX_CONCURRENT_DOCS: 2, // Nombre max de documents en traitement simultané
} as const;

// Limites de quiz
export const QUIZ_LIMITS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 10,
  DEFAULT_QUESTIONS: 5,
} as const;

// Configuration d'embedding
export const EMBEDDING_CONFIG = {
  CHUNK_SIZE: 500,
  CHUNK_OVERLAP: 50,
  EMBEDDING_DIMENSION: 1024, // Dimension des vecteurs Cohere
  MATCH_THRESHOLD: 0.4,
  MATCH_COUNT: 7,
} as const;

// Configuration de quiz
export const QUIZ_CONFIG = {
  ANSWER_FEEDBACK_DELAY_MS: 500, // Délai avant de passer à la question suivante
  OPTION_LETTERS: ['A', 'B', 'C', 'D'] as const,
} as const;

// Modèles IA
export const AI_MODELS = {
  COHERE_EMBEDDING: 'embed-multilingual-v3.0',
  GROQ_QUIZ_GENERATION: 'qwen/qwen3-32b',
} as const;

// Types de statut de document
export const DOCUMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Types de statut de session
export const SESSION_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

