/**
 * Types partagés pour les quiz
 * Évite la duplication de types entre les composants
 */

export type QuizMode = 'qcu' | 'qcm' | 'vf';

/** Pages du document dont la question est tirée */
export type QuizSource = { pageStart: number | null; pageEnd: number | null };

/** Champs communs à toutes les questions générées */
type QuizQuestionExtras = {
  justification?: string;
  /** Extrait du document qui contient la réponse (jamais partagé avec les élèves d'un live) */
  evidence?: string;
  source?: QuizSource | null;
};

export type QuizQuestionQCU = QuizQuestionExtras & {
  question: string;
  options: { [key: string]: string }; // A-D
  reponse_correcte: string; // Lettre unique
};

export type QuizQuestionQCM = QuizQuestionExtras & {
  question: string;
  options: { [key: string]: string }; // A-D
  reponses_correctes: string[]; // Plusieurs lettres
};

export type QuizQuestionVF = QuizQuestionExtras & {
  question: string;
  options: { VRAI: string; FAUX: string };
  reponse_correcte: 'VRAI' | 'FAUX';
};

export type QuizQuestion = QuizQuestionQCU | QuizQuestionQCM | QuizQuestionVF;

export type RawQuizQuestion = {
  question?: unknown;
  options?: unknown;
  reponse_correcte?: unknown;      // QCU/VF
  reponses_correctes?: unknown;    // QCM
  justification?: unknown;
  evidence?: unknown;
  source?: unknown;
};

export type NormalizedQuizQuestion = QuizQuestion;

