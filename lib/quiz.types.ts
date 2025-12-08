/**
 * Types partagés pour les quiz
 * Évite la duplication de types entre les composants
 */

export type QuizMode = 'qcu' | 'qcm' | 'vf';

export type QuizQuestionQCU = {
  question: string;
  options: { [key: string]: string }; // A-D
  reponse_correcte: string; // Lettre unique
  justification?: string;
};

export type QuizQuestionQCM = {
  question: string;
  options: { [key: string]: string }; // A-D
  reponses_correctes: string[]; // Plusieurs lettres
  justification?: string;
};

export type QuizQuestionVF = {
  question: string;
  options: { VRAI: string; FAUX: string };
  reponse_correcte: 'VRAI' | 'FAUX';
  justification?: string;
};

export type QuizQuestion = QuizQuestionQCU | QuizQuestionQCM | QuizQuestionVF;

export type RawQuizQuestion = {
  question?: unknown;
  options?: unknown;
  reponse_correcte?: unknown;      // QCU/VF
  reponses_correctes?: unknown;    // QCM
  justification?: unknown;
};

export type NormalizedQuizQuestion = QuizQuestion;

