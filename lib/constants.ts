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
  EMBEDDING_DIMENSION: 1024, // Dimension des vecteurs Jina (jina-embeddings-v3)
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
/**
 * Modèles utilisés. Les modèles Groq sont remplaçables par variable d'environnement (Vercel) sans
 * redéploiement de code : Groq retire régulièrement des modèles (qwen/qwen3-32b a été arrêté le
 * 17/07/2026, llama-3.1-8b-instant le 16/08/2026). Voir scripts/check-models.mjs, exécuté chaque
 * semaine par la CI, qui prévient avant qu'un modèle configuré disparaisse.
 *
 * Changer EMBEDDING impose de ré-indexer tous les documents (espaces vectoriels incompatibles).
 */
export const AI_MODELS = {
  EMBEDDING: 'jina-embeddings-v3',
  RERANKER: process.env.JINA_RERANK_MODEL ?? 'jina-reranker-v2-base-multilingual',
  QUIZ_GENERATION: process.env.GROQ_MODEL_QUIZ ?? 'openai/gpt-oss-120b',
  SUMMARY_GENERATION: process.env.GROQ_MODEL_SUMMARY ?? 'openai/gpt-oss-120b',
  THEME_GENERATION: process.env.GROQ_MODEL_THEMES ?? 'openai/gpt-oss-20b',
} as const;

/** Plafonds de sortie (raisonnement inclus pour les modèles gpt-oss) : bornent le coût par appel. */
export const AI_OUTPUT_LIMITS = {
  QUIZ_TOKENS: 6_000,
  SUMMARY_TOKENS: 4_000,
  THEME_TOKENS: 1_500,
} as const;

/** Recherche dans les documents : candidats récupérés puis passages gardés après reclassement. */
export const RETRIEVAL_CONFIG = {
  CANDIDATES: 24,
  FINAL_PASSAGES: 8,
  SUMMARY_PASSAGES: 20,
  VECTOR_THRESHOLD: 0.2,
} as const;

/** Nombre de classes actives par forfait (appliqué en base par le trigger enforce_class_limit). */
export const CLASS_LIMITS = { freemium: 1, partial: 5, pro: 30 } as const;

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

/**
 * Limitation de débit par utilisateur pour les routes qui appellent des services payants.
 * `perMinute` freine les rafales ; `perDay` plafonne le coût selon le plan.
 * Valeurs de départ à ajuster d'après metrics_ai_usage_events.
 * Routes publiques : limite par IP (palier freemium) ; les seuils par minute restent larges
 * car une classe entière partage souvent une seule adresse.
 */
export const RATE_LIMITS = {
  'generate-quiz': { perMinute: 5, perDay: { freemium: 20, partial: 100, pro: 300 } },
  'generate-summary': { perMinute: 3, perDay: { freemium: 5, partial: 30, pro: 100 } },
  'generate-themes': { perMinute: 5, perDay: { freemium: 30, partial: 100, pro: 300 } },
  embed: { perMinute: 3, perDay: { freemium: 20, partial: 100, pro: 300 } },
  'document-process': { perMinute: 5, perDay: { freemium: 10, partial: 50, pro: 200 } },
  'flashcards-generate': { perMinute: 10, perDay: { freemium: 100, partial: 300, pro: 1000 } },
  challenge: { perMinute: 10, perDay: { freemium: 50, partial: 200, pro: 500 } },
  'challenge-read': { perMinute: 60, perDay: { freemium: 1000, partial: 1000, pro: 1000 } },
  'live-quiz-read': { perMinute: 120, perDay: { freemium: 5000, partial: 5000, pro: 5000 } },
  // Essai sans compte : limite par IP puis plafond global (le palier gratuit de Groq est partagé avec les vrais utilisateurs)
  'demo-quiz': { perMinute: 3, perDay: { freemium: 20, partial: 20, pro: 20 } },
  'demo-quiz-global': { perMinute: 15, perDay: { freemium: 150, partial: 150, pro: 150 } },
  'push-test': { perMinute: 2, perDay: { freemium: 10, partial: 10, pro: 10 } },
  'account-export': { perMinute: 2, perDay: { freemium: 5, partial: 5, pro: 5 } },
  'account-delete': { perMinute: 2, perDay: { freemium: 5, partial: 5, pro: 5 } },
  'onboarding-sample': { perMinute: 2, perDay: { freemium: 3, partial: 3, pro: 3 } },
  'page-view': { perMinute: 180, perDay: { freemium: 5000, partial: 5000, pro: 5000 } },
} as const;

export type RateLimitRoute = keyof typeof RATE_LIMITS;

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

export const ONBOARDING_STORAGE_KEYS = {
  demoCompleted: 'dotest_onboarding_demo_completed',
} as const;

