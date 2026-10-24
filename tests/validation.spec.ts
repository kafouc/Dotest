import { describe, it, expect } from 'vitest';
import {
  generateQuizSchema,
  flashcardsReviewSchema,
  flashcardsGenerateSchema,
  activityEventSchema,
  checkoutSchema,
  challengeSchema,
  pushSubscribeSchema,
  documentStatusQuerySchema,
  validateModelQuiz,
} from '@/lib/validation';

const question = {
  question: 'Capitale de la France ?',
  options: { A: 'Paris', B: 'Lyon', C: 'Nice', D: 'Lille' },
  reponse_correcte: 'A',
};

describe('generateQuizSchema', () => {
  it('applique les valeurs par défaut et accepte un pageRange partiel', () => {
    const r = generateQuizSchema.parse({ query: ' résumé ', pageRange: { start: 2, end: null } });
    expect(r.query).toBe('résumé');
    expect(r.mode).toBe('qcu');
    expect(r.pageRange).toEqual({ start: 2, end: null });
  });
  it('accepte des numéros de page sous forme de texte', () => {
    expect(generateQuizSchema.parse({ query: 'x', pageRange: { start: '3', end: '9' } }).pageRange).toEqual({ start: 3, end: 9 });
  });
  it('refuse une question vide, un mode inconnu ou un nombre aberrant', () => {
    expect(generateQuizSchema.safeParse({ query: '   ' }).success).toBe(false);
    expect(generateQuizSchema.safeParse({ query: 'x', mode: 'essai' }).success).toBe(false);
    expect(generateQuizSchema.safeParse({ query: 'x', numQuestions: 5000 }).success).toBe(false);
  });
});

describe('flashcards', () => {
  it('refuse une note hors de 0..5 ou non entière', () => {
    expect(flashcardsReviewSchema.safeParse({ flashcardId: 'a', grade: 6 }).success).toBe(false);
    expect(flashcardsReviewSchema.safeParse({ flashcardId: 'a', grade: 2.5 }).success).toBe(false);
    expect(flashcardsReviewSchema.safeParse({ flashcardId: 'a', grade: 5 }).success).toBe(true);
  });
  it('borne la limite de génération', () => {
    expect(flashcardsGenerateSchema.parse({ documentPath: 'a/b.pdf' }).limit).toBe(20);
    expect(flashcardsGenerateSchema.safeParse({ documentPath: 'a/b.pdf', limit: 100000 }).success).toBe(false);
  });
});

describe('autres entrées', () => {
  it("limite les types d'événements d'activité", () => {
    expect(activityEventSchema.safeParse({ eventType: 'quiz_generated' }).success).toBe(true);
    expect(activityEventSchema.safeParse({ eventType: 'admin_hack' }).success).toBe(false);
    expect(activityEventSchema.safeParse({ eventType: 'quiz_generated', eventData: { x: 'a'.repeat(6000) } }).success).toBe(false);
  });
  it('refuse le plan freemium au paiement', () => {
    expect(checkoutSchema.safeParse({ plan: 'pro' }).success).toBe(true);
    expect(checkoutSchema.safeParse({ plan: 'freemium' }).success).toBe(false);
  });
  it('exige une souscription push complète', () => {
    const ok = { subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'k', auth: 'a' } } };
    expect(pushSubscribeSchema.safeParse(ok).success).toBe(true);
    expect(pushSubscribeSchema.safeParse({ subscription: { endpoint: 'pas-une-url', keys: { p256dh: 'k', auth: 'a' } } }).success).toBe(false);
  });
  it("n'accepte qu'un identifiant de document numérique", () => {
    expect(documentStatusQuerySchema.safeParse({ id: '42' }).success).toBe(true);
    expect(documentStatusQuerySchema.safeParse({ id: '42 or 1=1' }).success).toBe(false);
  });
});

describe('challengeSchema', () => {
  it('accepte un défi valide et retire les champs inconnus', () => {
    const r = challengeSchema.parse({ quiz: [{ ...question, extra: '<script>' }], score: '1', total: 1 });
    expect(r.score).toBe(1);
    expect('extra' in r.quiz[0]).toBe(false);
  });
  it('refuse un score supérieur au total ou une question sans réponse', () => {
    expect(challengeSchema.safeParse({ quiz: [question], score: 3, total: 1 }).success).toBe(false);
    const { reponse_correcte: _omit, ...sansReponse } = question;
    expect(challengeSchema.safeParse({ quiz: [sansReponse], score: 0, total: 1 }).success).toBe(false);
  });
});

describe('validateModelQuiz', () => {
  it('garde les questions exploitables et compte les rejetées', () => {
    const r = validateModelQuiz({ quiz: [question, { question: 'sans options' }, { ...question, options: ['a', 'b', 'c', 'd'] }] });
    expect(r?.valid).toHaveLength(2);
    expect(r?.dropped).toBe(1);
  });
  it("renvoie null si la forme n'est pas { quiz: [...] }", () => {
    expect(validateModelQuiz({ questions: [] })).toBeNull();
    expect(validateModelQuiz('texte')).toBeNull();
  });
});
