import { describe, it, expect, vi } from 'vitest';
import { createErrorCards, getReviewSummary, listDueFlashcards, questionKey } from '@/lib/flashcards';
import { correctAnswerText } from '@/lib/utils';
import type { QuizQuestion } from '@/lib/quiz.types';

describe('questionKey', () => {
  it('est identique malgré accents, casse, ponctuation et espaces', () => {
    expect(questionKey('Quel est le rôle de la mitochondrie ?')).toBe(questionKey('  quel EST le role de la  mitochondrie '));
  });
  it('distingue des questions différentes', () => {
    expect(questionKey('Que produit la photosynthèse ?')).not.toBe(questionKey('Que produit la respiration ?'));
  });
});

describe('correctAnswerText', () => {
  const options = { A: 'Paris', B: 'Lyon', C: 'Nice', D: 'Lille' };
  it('QCU : lettre et texte', () => {
    expect(correctAnswerText({ question: 'Q', options, reponse_correcte: 'B' } as QuizQuestion)).toBe('B – Lyon');
  });
  it('QCM : toutes les bonnes réponses', () => {
    expect(correctAnswerText({ question: 'Q', options, reponses_correctes: ['A', 'C'] } as QuizQuestion)).toBe('A – Paris ; C – Nice');
  });
  it('Vrai/faux', () => {
    expect(correctAnswerText({ question: 'Q', options: { VRAI: 'Vrai', FAUX: 'Faux' }, reponse_correcte: 'FAUX' } as QuizQuestion)).toBe('Faux');
  });
});

describe('createErrorCards', () => {
  it('crée une carte par erreur, sans doublon, avec la bonne réponse et la source', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const upsert = vi.fn().mockReturnValue({ select });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    const created = await createErrorCards(supabase as never, 'u1', [
      { question: 'Q1 ?', correctAnswerText: 'B – Lyon', justification: 'Parce que.', sourceLabel: 'Page 4', documentPath: 'u1/cours.pdf' },
    ]);

    expect(created).toBe(1);
    expect(supabase.from).toHaveBeenCalledWith('flashcards');
    const [rows, options] = upsert.mock.calls[0];
    expect(options).toMatchObject({ onConflict: 'user_id,question_key', ignoreDuplicates: true });
    expect(rows[0]).toMatchObject({ user_id: 'u1', source: 'quiz_error', document_path: 'u1/cours.pdf', question: 'Q1 ?' });
    expect(rows[0].answer).toContain('Bonne réponse : B – Lyon');
    expect(rows[0].answer).toContain('Source : Page 4');
    expect(rows[0].question_key).toBe(questionKey('Q1 ?'));
  });

  it("n'échoue jamais : migration absente ou erreur réseau", async () => {
    const failing = { from: () => ({ upsert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'column does not exist' } }) }) }) };
    expect(await createErrorCards(failing as never, 'u1', [{ question: 'Q', correctAnswerText: 'A' }])).toBe(0);
    const throwing = { from: () => { throw new Error('réseau'); } };
    expect(await createErrorCards(throwing as never, 'u1', [{ question: 'Q', correctAnswerText: 'A' }])).toBe(0);
    expect(await createErrorCards({} as never, 'u1', [])).toBe(0);
  });
});

describe('révision du jour', () => {
  it('lit les compteurs renvoyés par la base', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ due_count: 4, new_count: 2, quiz_error_due: 3, reviewed_today: 5, daily_goal: 10 }], error: null });
    expect(await getReviewSummary({ rpc } as never)).toEqual({ dueCount: 4, newCount: 2, quizErrorDue: 3, reviewedToday: 5, dailyGoal: 10 });
  });

  it('renvoie null tant que la migration n’est pas appliquée', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    expect(await getReviewSummary({ rpc } as never)).toBeNull();
  });

  it('utilise la fonction SQL pour lister les cartes dues', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'c1', question: 'Q', answer: 'R', document_path: null, created_at: '', due_at: null }], error: null });
    const cards = await listDueFlashcards({ rpc } as never, { documentPath: 'u/doc.pdf', limit: 5 });
    expect(rpc).toHaveBeenCalledWith('list_due_flashcards', { p_document_path: 'u/doc.pdf', p_limit: 5 });
    expect(cards).toHaveLength(1);
  });
});
