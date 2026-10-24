import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Doubles : Supabase (session), limiteur de débit, journal d'activité -----------------------
const getUser = vi.fn();
const fakeSupabase = { auth: { getUser: (...a: unknown[]) => getUser(...a) }, from: vi.fn(), rpc: vi.fn() };
vi.mock('@/lib/supabaseServerClient', () => ({ createSupabaseServerClient: () => fakeSupabase }));

const enforceRateLimit = vi.fn();
const enforceIpRateLimit = vi.fn();
vi.mock('@/lib/rateLimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rateLimit')>('@/lib/rateLimit');
  return { ...actual, enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a), enforceIpRateLimit: (...a: unknown[]) => enforceIpRateLimit(...a) };
});

const insert = vi.fn();
const fakeAdmin = {
  from: () => ({ insert: (...a: unknown[]) => ({ select: () => ({ single: () => insert(...a) }) }) }),
};
vi.mock('@/lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => fakeAdmin }));
vi.mock('@/lib/metricsLogger', () => ({
  logActivity: vi.fn(),
  recordAiUsage: vi.fn(),
  logPageView: vi.fn(),
}));

import { RateLimitError } from '@/lib/rateLimit';
import { POST as generateQuiz } from '@/app/api/generate-quiz/route';
import { POST as flashcardsReview } from '@/app/api/flashcards/review/route';
import { POST as checkout } from '@/app/api/billing/create-checkout-session/route';
import { POST as activity } from '@/app/api/analytics/activity/route';
import { POST as challenge } from '@/app/api/challenge/route';
import { GET as documentStatus } from '@/app/api/documents/status/route';
import { POST as processFile } from '@/app/api/process-file/route';

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const loggedIn = () => getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.fr' } } });
const loggedOut = () => getUser.mockResolvedValue({ data: { user: null } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.JINA_API_KEY = 'jina';
  process.env.GROQ_API_KEY = 'groq';
  enforceRateLimit.mockResolvedValue(undefined);
  enforceIpRateLimit.mockResolvedValue(undefined);
  loggedIn();
});

describe('POST /api/generate-quiz', () => {
  it('400 si la requête est vide ou le mode inconnu', async () => {
    expect((await generateQuiz(post('/api/generate-quiz', { query: '  ' }))).status).toBe(400);
    expect((await generateQuiz(post('/api/generate-quiz', { query: 'x', mode: 'essai' }))).status).toBe(400);
  });

  it('401 sans session', async () => {
    loggedOut();
    expect((await generateQuiz(post('/api/generate-quiz', { query: 'résume le cours' }))).status).toBe(401);
  });

  it('429 avec Retry-After quand la limite de débit est atteinte', async () => {
    enforceRateLimit.mockRejectedValue(new RateLimitError('minute', 42));
    const res = await generateQuiz(post('/api/generate-quiz', { query: 'résume le cours' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(await res.json()).toMatchObject({ code: 'rate-limited', scope: 'minute' });
  });
});

describe('POST /api/flashcards/review', () => {
  it('400 si la note est hors échelle', async () => {
    expect((await flashcardsReview(post('/api/flashcards/review', { flashcardId: 'c1', grade: 9 }))).status).toBe(400);
  });
});

describe('POST /api/billing/create-checkout-session', () => {
  it('400 pour le plan freemium ou un plan inconnu', async () => {
    expect((await checkout(post('/api/billing/create-checkout-session', { plan: 'freemium' }))).status).toBe(400);
    expect((await checkout(post('/api/billing/create-checkout-session', { plan: 'gratuit-a-vie' }))).status).toBe(400);
  });

  it('401 sans session pour un plan valide', async () => {
    loggedOut();
    expect((await checkout(post('/api/billing/create-checkout-session', { plan: 'pro' }))).status).toBe(401);
  });
});

describe('POST /api/analytics/activity', () => {
  it('401 sans session', async () => {
    loggedOut();
    expect((await activity(post('/api/analytics/activity', { eventType: 'quiz_generated' }))).status).toBe(401);
  });

  it("400 pour un type d'événement non prévu", async () => {
    expect((await activity(post('/api/analytics/activity', { eventType: 'admin_hack' }))).status).toBe(400);
  });
});

describe('POST /api/challenge', () => {
  const quiz = [{ question: 'Q ?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, reponse_correcte: 'A' }];

  it('200 : enregistre un défi valide et renvoie le code de partage', async () => {
    insert.mockResolvedValue({ data: { share_code: 'ABC123' }, error: null });
    const res = await challenge(post('/api/challenge', { quiz, score: 1, total: 1, authorName: ' Ana ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shareCode: 'ABC123' });
    expect(insert.mock.calls[0][0]).toMatchObject({ score: 1, total: 1, author_name: 'Ana' });
  });

  it('400 : score supérieur au total, quiz vide ou question sans réponse', async () => {
    expect((await challenge(post('/api/challenge', { quiz, score: 5, total: 1 }))).status).toBe(400);
    expect((await challenge(post('/api/challenge', { quiz: [], score: 0, total: 1 }))).status).toBe(400);
    expect((await challenge(post('/api/challenge', { quiz: [{ question: 'Q', options: { A: 'a', B: 'b' } }], score: 0, total: 1 }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('429 quand la limite par IP est atteinte, sans rien écrire', async () => {
    enforceIpRateLimit.mockRejectedValue(new RateLimitError('day', 3600));
    const res = await challenge(post('/api/challenge', { quiz, score: 1, total: 1 }));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('GET /api/documents/status', () => {
  it("400 si l'identifiant n'est pas numérique", async () => {
    expect((await documentStatus(new Request('http://localhost/api/documents/status?id=1%20or%201=1'))).status).toBe(400);
    expect((await documentStatus(new Request('http://localhost/api/documents/status'))).status).toBe(400);
  });
});

describe('POST /api/process-file', () => {
  it('400 sans chemin de fichier ni identifiant de document', async () => {
    expect((await processFile(post('/api/process-file', {}))).status).toBe(400);
    expect((await processFile(post('/api/process-file', { filePath: 'u/doc.pdf', documentId: 'abc' }))).status).toBe(400);
  });

  it('415 pour un type de fichier non pris en charge', async () => {
    expect((await processFile(post('/api/process-file', { filePath: 'u/image.png', documentId: 1, mimeType: 'image/png' }))).status).toBe(415);
  });
});
