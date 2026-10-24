import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChunks } from '@/lib/chunking';
import { computeOnboardingSteps, SAMPLE_PAGES } from '@/lib/onboarding';
import { detectLanguage } from '@/lib/language';

// --- Doubles pour la route ----------------------------------------------------------------------
const getUser = vi.fn();
const maybeSingle = vi.fn();
const insertDocument = vi.fn();
const insertSections = vi.fn();
const deleteDocument = vi.fn();

const fakeSupabase = {
  auth: { getUser: (...a: unknown[]) => getUser(...a) },
  from: (table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
        insert: (row: unknown) => ({ select: () => ({ single: () => insertDocument(row) }) }),
        delete: () => ({ eq: (...a: unknown[]) => deleteDocument(...a) }),
      };
    }
    return { insert: (rows: unknown) => insertSections(rows) };
  },
};
vi.mock('@/lib/supabaseServerClient', () => ({ createSupabaseServerClient: () => fakeSupabase }));

const enforceRateLimit = vi.fn();
vi.mock('@/lib/rateLimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rateLimit')>('@/lib/rateLimit');
  return { ...actual, enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a) };
});
vi.mock('@/lib/metricsLogger', () => ({ logActivity: vi.fn(), recordAiUsage: vi.fn() }));
const embed = vi.fn();
vi.mock('@/lib/jinaClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jinaClient')>('@/lib/jinaClient');
  return { ...actual, createJinaEmbeddings: (...a: unknown[]) => embed(...a) };
});

import { RateLimitError } from '@/lib/rateLimit';
import { POST as createSample } from '@/app/api/onboarding/sample/route';

describe('parcours guidé', () => {
  it('déduit les étapes terminées des données réelles', () => {
    const steps = computeOnboardingSteps({ documents: 1, quizzesGenerated: 1, quizAttempts: 0, cardsReviewed: 0 });
    expect(steps.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(computeOnboardingSteps({ documents: 0, quizzesGenerated: 0, quizAttempts: 0, cardsReviewed: 0 }).every((s) => !s.done)).toBe(true);
  });

  it("le document d'exemple est en français, sur 3 pages, découpé en plusieurs segments", () => {
    const chunks = createChunks(SAMPLE_PAGES, 1000, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[chunks.length - 1].pageEnd).toBe(3);
    expect(detectLanguage(SAMPLE_PAGES.map((p) => p.text).join(' ')).code).toBe('fr');
  });
});

describe('POST /api/onboarding/sample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JINA_API_KEY = 'jina';
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    maybeSingle.mockResolvedValue({ data: null });
    enforceRateLimit.mockResolvedValue(undefined);
    insertDocument.mockResolvedValue({ data: { id: 42 }, error: null });
    insertSections.mockResolvedValue({ error: null });
    embed.mockImplementation(async (texts: string[]) => ({
      data: texts.map((_, index) => ({ index, embedding: new Array(1024).fill(0.01) })),
      usage: { total_tokens: 300 },
    }));
  });

  it('401 sans session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await createSample()).status).toBe(401);
  });

  it('est idempotent : un exemple existant est renvoyé sans rien recréer ni consommer de quota', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 7, file_path: 'u1/exemple-photosynthese.txt' } });
    const res = await createSample();
    expect(await res.json()).toMatchObject({ documentId: 7, alreadyExisted: true });
    expect(embed).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it('crée le document terminé et ses segments indexés, avec les pages', async () => {
    const res = await createSample();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ documentPath: 'u1/exemple-photosynthese.txt', documentId: 42, alreadyExisted: false });
    expect(insertDocument.mock.calls[0][0]).toMatchObject({ user_id: 'u1', status: 'completed' });
    const rows = insertSections.mock.calls[0][0] as { user_id: string; page_start: number; embedding: number[]; document_path: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((r) => r.user_id === 'u1' && r.embedding.length === 1024 && r.document_path === 'u1/exemple-photosynthese.txt')).toBe(true);
  });

  it('429 quand la limite est atteinte', async () => {
    enforceRateLimit.mockRejectedValue(new RateLimitError('day', 3600));
    expect((await createSample()).status).toBe(429);
    expect(embed).not.toHaveBeenCalled();
  });

  it('annule le document si l’insertion des segments échoue', async () => {
    insertSections.mockResolvedValue({ error: { message: 'boom' } });
    deleteDocument.mockResolvedValue({ error: null });
    expect((await createSample()).status).toBe(500);
    expect(deleteDocument).toHaveBeenCalledWith('id', 42);
  });
});
