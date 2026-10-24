import { describe, it, expect } from 'vitest';
import {
  computeQuestionStats,
  computeParticipantSummaries,
  formatCorrectAnswer,
  getOptionCounts,
} from '@/lib/liveReport';
import type { LiveAnswer } from '@/lib/liveQuiz';
import type { QuizQuestion } from '@/lib/quiz.types';

const questions: QuizQuestion[] = [
  { question: 'Q1', options: { A: 'Paris', B: 'Lyon', C: 'Nice', D: 'Lille' }, reponse_correcte: 'A' },
  { question: 'Q2', options: { A: 'x', B: 'y', C: 'z', D: 'w' }, reponses_correctes: ['A', 'C'] },
];

const answer = (p: string, q: number, a: string, ok: boolean, at: string): LiveAnswer =>
  ({ id: `${p}${q}`, participant_id: p, question_index: q, answer: a, is_correct: ok, answered_at: at } as unknown as LiveAnswer);

const answers = [
  answer('p1', 0, 'A', true, '2026-01-01T10:00:00Z'),
  answer('p1', 1, 'B', false, '2026-01-01T10:00:30Z'),
  answer('p2', 0, 'b', false, '2026-01-01T10:00:10Z'),
];

describe('liveReport', () => {
  it('compte les réponses correctes par question', () => {
    expect(computeQuestionStats(questions, answers)).toEqual([
      { questionIndex: 0, correct: 1, total: 2 },
      { questionIndex: 1, correct: 0, total: 1 },
    ]);
  });

  it('résume chaque participant (score, complétion, durée)', () => {
    const [p1, p2] = computeParticipantSummaries(
      [{ id: 'p1', nickname: 'Ana' }, { id: 'p2', nickname: 'Bob' }],
      answers,
      questions.length
    );
    expect(p1).toMatchObject({ answered: 2, correct: 1, scorePercent: 50, completionPercent: 100, durationMs: 30_000 });
    expect(p2).toMatchObject({ answered: 1, correct: 0, scorePercent: 0, completionPercent: 50, durationMs: 0 });
  });

  it('évite la division par zéro sans question', () => {
    const [p] = computeParticipantSummaries([{ id: 'p1', nickname: 'Ana' }], [], 0);
    expect(p.scorePercent).toBe(0);
    expect(p.completionPercent).toBe(0);
  });

  it('répartit les réponses par option sans tenir compte de la casse', () => {
    expect(getOptionCounts(questions[0], 0, answers)).toEqual({ A: 1, B: 1, C: 0, D: 0 });
  });

  it('formate la bonne réponse (unique ou multiple)', () => {
    expect(formatCorrectAnswer(questions[0])).toBe('A – Paris');
    expect(formatCorrectAnswer(questions[1])).toBe('A – x, C – z');
  });
});
