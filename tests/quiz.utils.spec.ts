import { describe, it, expect } from 'vitest';
import { normalizeQuiz, calculateQuizScore } from '@/lib/utils';
import type { RawQuizQuestion } from '@/lib/quiz.types';

describe('normalizeQuiz + calculateQuizScore', () => {
  it('QCU: normalise options et calcule score', () => {
    const raw: RawQuizQuestion[] = [
      { question: 'Capital de la France?', options: { A: 'Paris', B: 'Lyon', C: 'Marseille', D: 'Nice' }, reponse_correcte: 'A' },
      { question: '2+2=?', options: ['3', '4', '5', '6'], reponse_correcte: 'B' },
    ];
    const quiz = normalizeQuiz(raw, 'qcu');
    expect(quiz[0].options.A).toBe('Paris');
    expect((quiz[0] as any).reponse_correcte).toBe('A');
    const score = calculateQuizScore(quiz, { 0: 'A', 1: 'B' });
    expect(score).toBe(2);
  });

  it('QCM: accepte plusieurs bonnes réponses et exige ensemble exact', () => {
    const raw: RawQuizQuestion[] = [
      { question: 'Langages typés?', options: { A: 'TypeScript', B: 'JavaScript', C: 'Rust', D: 'Python' }, reponses_correctes: ['A', 'C'] },
    ];
    const quiz = normalizeQuiz(raw, 'qcm');
    expect(Array.isArray((quiz[0] as any).reponses_correctes)).toBe(true);
    const ok = calculateQuizScore(quiz, { 0: ['A', 'C'] });
    const ko_missing = calculateQuizScore(quiz, { 0: ['A'] });
    const ko_extra = calculateQuizScore(quiz, { 0: ['A', 'C', 'D'] });
    expect(ok).toBe(1);
    expect(ko_missing).toBe(0);
    expect(ko_extra).toBe(0);
  });

  it('VF: mappe VRAI/FAUX et calcule score', () => {
    const raw: RawQuizQuestion[] = [
      { question: 'Le soleil est une étoile.', options: {}, reponse_correcte: 'VRAI' },
      { question: 'La Terre est plate.', options: {}, reponse_correcte: 'FAUX' },
    ];
    const quiz = normalizeQuiz(raw, 'vf');
    expect((quiz[0] as any).options.VRAI).toBeTruthy();
    expect((quiz[1] as any).reponse_correcte).toBe('FAUX');
    const score = calculateQuizScore(quiz, { 0: 'VRAI', 1: 'FAUX' });
    expect(score).toBe(2);
  });
});
