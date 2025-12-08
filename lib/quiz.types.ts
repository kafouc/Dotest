/**
 * Types partagés pour les quiz
 * Évite la duplication de types entre les composants
 */

export type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

export type RawQuizQuestion = {
  question?: unknown;
  options?: unknown;
  reponse_correcte?: unknown;
  justification?: unknown;
};

export type NormalizedQuizQuestion = QuizQuestion;

