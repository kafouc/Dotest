import type { QuizQuestion, RawQuizQuestion } from './quiz.types';
import { QUIZ_CONFIG } from './constants';

export function normalizeLetter(val: string): string {
  const s = (val ?? '').toString().trim().toUpperCase();
  const m = s.match(/^[\s\(\[]*([ABCD])/);
  if (m) return m[1];
  if (QUIZ_CONFIG.OPTION_LETTERS.includes(s as 'A' | 'B' | 'C' | 'D')) return s;
  return s;
}

export function indexToLetter(index: number): 'A' | 'B' | 'C' | 'D' {
  return QUIZ_CONFIG.OPTION_LETTERS[index] ?? 'A';
}

export function normalizeQuiz(rawQuiz: RawQuizQuestion[]): QuizQuestion[] {
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
    } as QuizQuestion;
  });
}

export function isAnswerCorrect(userAnswer: string | null, correctAnswer: string): boolean {
  return !!userAnswer && normalizeLetter(userAnswer) === normalizeLetter(correctAnswer);
}

export function calculateQuizScore(quizQuestions: QuizQuestion[], selectedAnswers: { [key: number]: string }): number {
  let score = 0;
  quizQuestions.forEach((question, index) => {
    const userAnswer = selectedAnswers[index];
    if (isAnswerCorrect(userAnswer, question.reponse_correcte)) {
      score++;
    }
  });
  return score;
}
