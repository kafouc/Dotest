import type { QuizQuestion, RawQuizQuestion, QuizMode, QuizSource } from './quiz.types';
import { QUIZ_CONFIG } from './constants';

export { cn } from './cn';

export function normalizeLetter(val: string): string {
  const s = (val ?? '').toString().trim().toUpperCase();
  const m = s.match(/^[\s\(\[]*([ABCD])/);
  if (m) return m[1];
  if (QUIZ_CONFIG.OPTION_LETTERS.includes(s as 'A' | 'B' | 'C' | 'D')) return s;
  return s;
}

/** Extrait `evidence` et `source` d'une question brute (présents sur les quiz générés avec citations). */
function extractExtras(q: RawQuizQuestion): { evidence?: string; source?: QuizSource | null } {
  const extras: { evidence?: string; source?: QuizSource | null } = {};
  if (typeof q.evidence === 'string' && q.evidence.trim()) extras.evidence = q.evidence.trim();
  const src = q.source as Partial<QuizSource> | null | undefined;
  if (src && typeof src === 'object') {
    const toPage = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
    const pageStart = toPage(src.pageStart);
    const pageEnd = toPage(src.pageEnd);
    if (pageStart !== null || pageEnd !== null) extras.source = { pageStart, pageEnd };
  }
  return extras;
}

export function indexToLetter(index: number): 'A' | 'B' | 'C' | 'D' {
  return QUIZ_CONFIG.OPTION_LETTERS[index] ?? 'A';
}

export function normalizeQuiz(rawQuiz: RawQuizQuestion[], mode: QuizMode = 'qcu'): QuizQuestion[] {
  if (mode === 'vf') {
    return rawQuiz.map((q) => {
      const correct = ((q.reponse_correcte ?? '') as string).toString().trim().toUpperCase();
      const rc = correct === 'TRUE' || correct === 'VRAI' ? 'VRAI' : 'FAUX';
      return {
        question: (q.question ?? '') as string,
        options: { VRAI: 'Vrai', FAUX: 'Faux' },
        reponse_correcte: rc as 'VRAI' | 'FAUX',
        justification: (q.justification ?? undefined) as string | undefined,
        ...extractExtras(q),
      } as QuizQuestion;
    });
  }

  return rawQuiz.map((q) => {
    let values: string[] = [];
    if (Array.isArray(q.options)) {
      values = (q.options as unknown[]).map((v) => (v ?? '').toString());
    } else if (q.options && typeof q.options === 'object') {
      const obj = q.options as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.some(k => QUIZ_CONFIG.OPTION_LETTERS.includes(k.toUpperCase() as 'A' | 'B' | 'C' | 'D'))) {
        values = QUIZ_CONFIG.OPTION_LETTERS
          .map(k => obj[k] ?? obj[k.toLowerCase()] ?? obj[k.toUpperCase()])
          .filter((v): v is string => typeof v === 'string');
      } else {
        values = Object.values(obj).map((v) => (v ?? '').toString());
      }
    }
    values = values.slice(0, 4);
    while (values.length < 4) values.push('');

    const mappedOptions: Record<string, string> = {
      A: values[0] ?? '',
      B: values[1] ?? '',
      C: values[2] ?? '',
      D: values[3] ?? '',
    };

    if (mode === 'qcm') {
      let rcs: string[] = [];
      if (Array.isArray(q.reponses_correctes)) {
        rcs = (q.reponses_correctes as unknown[])
          .map((v) => normalizeLetter((v ?? '') as string))
          .filter((l) => QUIZ_CONFIG.OPTION_LETTERS.includes(l as 'A' | 'B' | 'C' | 'D'));
      } else if (typeof q.reponses_correctes === 'string') {
        rcs = (q.reponses_correctes as string)
          .split(/[\,\s]+/)
          .map((s) => normalizeLetter(s))
          .filter((l) => QUIZ_CONFIG.OPTION_LETTERS.includes(l as 'A' | 'B' | 'C' | 'D'));
      } else if (q.reponse_correcte) {
        const l = normalizeLetter((q.reponse_correcte ?? '') as string);
        rcs = QUIZ_CONFIG.OPTION_LETTERS.includes(l as 'A' | 'B' | 'C' | 'D') ? [l] : [];
      }
      if (rcs.length === 0) rcs = ['A'];

      return {
        question: (q.question ?? '') as string,
        options: mappedOptions,
        reponses_correctes: Array.from(new Set(rcs)),
        justification: (q.justification ?? undefined) as string | undefined,
        ...extractExtras(q),
      } as QuizQuestion;
    }

    let rc = normalizeLetter((q.reponse_correcte ?? '') as string);
    if (!QUIZ_CONFIG.OPTION_LETTERS.includes(rc as 'A' | 'B' | 'C' | 'D')) {
      const idx = values.findIndex(v => v.trim().toUpperCase() === (q.reponse_correcte ?? '').toString().trim().toUpperCase());
      rc = idx >= 0 ? indexToLetter(idx) : 'A';
    }

    return {
      question: (q.question ?? '') as string,
      options: mappedOptions,
      reponse_correcte: rc,
      justification: (q.justification ?? undefined) as string | undefined,
      ...extractExtras(q),
    } as QuizQuestion;
  });
}

export function isAnswerCorrect(userAnswer: string | null, correct: string | string[]): boolean {
  if (!userAnswer) return false;
  const ua = normalizeLetter(userAnswer);
  if (Array.isArray(correct)) {
    return correct.map(normalizeLetter).includes(ua);
  }
  return normalizeLetter(correct) === ua;
}

export function calculateQuizScore(quizQuestions: QuizQuestion[], selectedAnswers: { [key: number]: string | string[] }): number {
  let score = 0;
  quizQuestions.forEach((question, index) => {
    const userAns = selectedAnswers[index];
    if (!userAns) return;
    if ('reponses_correctes' in question) {
      const ua = Array.isArray(userAns) ? userAns.map(normalizeLetter) : [normalizeLetter(userAns as string)];
      const correct = question.reponses_correctes.map(normalizeLetter);
      const same = ua.length === correct.length && ua.every((l) => correct.includes(l));
      if (same) score++;
    } else if ('reponse_correcte' in question && (question.reponse_correcte === 'VRAI' || question.reponse_correcte === 'FAUX')) {
      score += (userAns === question.reponse_correcte) ? 1 : 0;
    } else {
      if ('reponse_correcte' in question) {
        if (isAnswerCorrect((userAns as string) ?? null, question.reponse_correcte)) score++;
      }
    }
  });
  return score;
}
