/**
 * Constantes centralisées pour l'application
 * Évite les "magic numbers" et facilite la maintenance
 */

// Limites de fichiers
export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 50 * 1024 * 1024, // 50 Mo (pour PDFs de 500 pages)
  MAX_SIZE_MB: 50,
  MAX_PAGES: 500,
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
  CHUNK_SIZE: 1000, // Optimisé: chunks plus gros pour réduire le nombre total
  CHUNK_OVERLAP: 200, // Optimisé: overlap proportionnel
  EMBEDDING_DIMENSION: 768, // Dimension des vecteurs Groq (nomic-embed-text)
  MATCH_THRESHOLD: 0.4,
  MATCH_COUNT: 5,
} as const;

// Configuration de traitement par batch (optimisé)
export const BATCH_CONFIG = {
  BATCH_SIZE: 40, // Nombre de chunks par lot (équilibre vitesse/limites API)
  PARALLEL_BATCHES: 1, // Traiter les lots en série pour lisser la consommation de tokens
  MAX_RETRIES: 4, // Nombre de tentatives en cas d'erreur ponctuelle
  RETRY_BASE_DELAY_MS: 1500, // Backoff de base entre les tentatives
  RATE_LIMIT_DELAY_MS: 4000, // Attente supplémentaire en cas de 429 côté API
  MIN_EMBED_INTERVAL_MS: 1500, // Pause minimum entre deux requêtes d'embedding (ms)
} as const;

// Configuration de quiz
export const QUIZ_CONFIG = {
  ANSWER_FEEDBACK_DELAY_MS: 500, // Délai avant de passer à la question suivante
  OPTION_LETTERS: ['A', 'B', 'C', 'D'] as const,
} as const;

// Modèles IA
export const AI_MODELS = {
  GROQ_EMBEDDING: 'nomic-embed-text',
  GROQ_QUIZ_GENERATION: 'qwen/qwen3-32b',
} as const;

export const THEME_GENERATION_CONFIG = {
  MAX_CONTEXT_CHARS: 8_000,
  MAX_THEMES: 5,
  SECTION_SAMPLE_LIMIT: 24,
} as const;

export const PLAN_LIMITS = {
  freemium: {
    liveParticipants: 10,
    liveParticipantsCap: 10,
    revisionDocsPerWeek: 1,
    quizPerDocumentPerWeek: 3,
    quizMonthlyCap: 50,
    revisionMonthlyCap: 4,
  },
  partial: {
    liveParticipants: 15,
    liveParticipantsCap: 15,
    revisionDocsPerWeek: 10,
    quizPerDocumentPerWeek: 10,
    quizMonthlyCap: null,
    revisionMonthlyCap: null,
  },
  pro: {
    liveParticipants: 300,
    liveParticipantsCap: 300,
    revisionDocsPerWeek: 50,
    quizPerDocumentPerWeek: 50,
    quizMonthlyCap: 50,
    revisionMonthlyCap: 50,
  },
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

