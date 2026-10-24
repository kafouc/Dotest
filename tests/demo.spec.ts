import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemoPassages, DEMO_SAMPLE_TEXT } from '@/lib/demo';

const enforceIpRateLimit = vi.fn();
const enforceGlobalRateLimit = vi.fn();
vi.mock('@/lib/rateLimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rateLimit')>('@/lib/rateLimit');
  return {
    ...actual,
    enforceIpRateLimit: (...a: unknown[]) => enforceIpRateLimit(...a),
    enforceGlobalRateLimit: (...a: unknown[]) => enforceGlobalRateLimit(...a),
  };
});

const generateQuiz = vi.fn();
vi.mock('@/lib/quizGeneration', async () => {
  const actual = await vi.importActual<typeof import('@/lib/quizGeneration')>('@/lib/quizGeneration');
  return { ...actual, generateQuiz: (...a: unknown[]) => generateQuiz(...a) };
});
vi.mock('@/lib/metricsLogger', () => ({ logActivity: vi.fn(), recordAiUsage: vi.fn() }));

import { RateLimitError } from '@/lib/rateLimit';
import { QuizGenerationError } from '@/lib/quizGeneration';
import { POST as demoQuiz } from '@/app/api/demo/quiz/route';

const LONG_TEXT = 'La combustion est une réaction chimique entre un combustible et un comburant. '.repeat(6);
const post = (body: unknown) =>
  new Request('http://localhost/api/demo/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('buildDemoPassages', () => {
  it('découpe un texte collé en passages sans pages', () => {
    const passages = buildDemoPassages(LONG_TEXT, false);
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.every((p) => p.pageStart === null)).toBe(true);
    expect(passages.every((p) => p.content.length <= 700)).toBe(true);
  });

  it("garde les pages pour le texte d'exemple, mais pas pour un texte modifié qui se dit exemple", () => {
    expect(buildDemoPassages(DEMO_SAMPLE_TEXT, true).some((p) => p.pageStart === 2)).toBe(true);
    expect(buildDemoPassages(`${DEMO_SAMPLE_TEXT} et plus`, true).every((p) => p.pageStart === null)).toBe(true);
  });
});

describe('POST /api/demo/quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = 'groq';
    enforceIpRateLimit.mockResolvedValue(undefined);
    enforceGlobalRateLimit.mockResolvedValue(undefined);
    generateQuiz.mockResolvedValue({
      questions: [{ question: 'Q ?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, reponse_correcte: 'A' }],
      stats: { received: 3, invalid: 0, ungrounded: 2, duplicates: 0, fuzzyGrounded: 0 },
      calls: [{ model: 'openai/gpt-oss-120b', promptTokens: 500, completionTokens: 200, latencyMs: 1500 }],
    });
  });

  it('400 pour un texte trop court ou trop long, sans consommer de quota ni appeler l’IA', async () => {
    expect((await demoQuiz(post({ text: 'trop court' }))).status).toBe(400);
    expect((await demoQuiz(post({ text: 'x'.repeat(3_001) }))).status).toBe(400);
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
    expect(generateQuiz).not.toHaveBeenCalled();
  });

  it('génère un mini-quiz de 3 questions maximum pour un visiteur anonyme', async () => {
    const res = await demoQuiz(post({ text: LONG_TEXT }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.questions).toHaveLength(1);
    expect(json.language).toBe('fr');
    expect(generateQuiz.mock.calls[0][0]).toMatchObject({ count: 3, mode: 'qcu' });
    expect(enforceIpRateLimit).toHaveBeenCalledWith(expect.anything(), 'demo-quiz');
    expect(enforceGlobalRateLimit).toHaveBeenCalledWith('demo-quiz-global');
  });

  it('429 avec un message adapté quand la limite par IP du jour est atteinte', async () => {
    enforceIpRateLimit.mockRejectedValue(new RateLimitError('day', 3600));
    const res = await demoQuiz(post({ text: LONG_TEXT }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain('Créez un compte gratuit');
    expect(generateQuiz).not.toHaveBeenCalled();
  });

  it('429 quand le plafond global est atteint (budget IA protégé)', async () => {
    enforceGlobalRateLimit.mockRejectedValue(new RateLimitError('day', 7200));
    const res = await demoQuiz(post({ text: LONG_TEXT }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7200');
    expect(generateQuiz).not.toHaveBeenCalled();
  });

  it('422 quand aucune question fiable ne peut être écrite', async () => {
    generateQuiz.mockRejectedValue(new QuizGenerationError('no-valid-questions', 'aucune'));
    const res = await demoQuiz(post({ text: LONG_TEXT }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('no-valid-questions');
  });

  it('503 sans clé IA configurée', async () => {
    delete process.env.GROQ_API_KEY;
    expect((await demoQuiz(post({ text: LONG_TEXT }))).status).toBe(503);
  });
});
