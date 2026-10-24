import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDeletionError, deleteUserAccount } from '@/lib/accountDeletion';
import { buildAccountExport } from '@/lib/accountExport';

// ---------- Consentement ---------------------------------------------------------------------
describe('consentement', () => {
  const store = new Map<string, string>();
  const dispatched: string[] = [];

  beforeEach(() => {
    store.clear();
    dispatched.length = 0;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      dispatchEvent: (e: Event) => void dispatched.push(e.type),
    });
    vi.stubGlobal('CustomEvent', class { type: string; constructor(type: string) { this.type = type; } });
    vi.stubGlobal('Event', class { type: string; constructor(type: string) { this.type = type; } });
  });

  it('refuse par défaut : aucune mesure sans choix explicite', async () => {
    const { hasAnalyticsConsent, readConsent } = await import('@/lib/consent');
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('mémorise le choix et prévient le reste de l’application', async () => {
    const { hasAnalyticsConsent, writeConsent, readConsent } = await import('@/lib/consent');
    writeConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(readConsent()?.decidedAt).toBeTruthy();
    expect(dispatched).toContain('sop-consent-changed');
    writeConsent(false);
    expect(hasAnalyticsConsent()).toBe(false);
    const { wantsReminders } = await import('@/lib/consent');
    expect(wantsReminders()).toBe(false);
    writeConsent(false, true);
    expect(wantsReminders()).toBe(true);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('ignore une valeur corrompue', async () => {
    const { hasAnalyticsConsent, CONSENT_KEY } = await import('@/lib/consent');
    store.set(CONSENT_KEY, '{"analytics":"oui"}');
    expect(hasAnalyticsConsent()).toBe(false);
    store.set(CONSENT_KEY, 'pas du json');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('trackPageView n’envoie rien sans consentement', async () => {
    const beacon = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon: beacon, userAgent: 'test' });
    vi.stubGlobal('fetch', fetchMock);
    const { trackPageView } = await import('@/lib/trackPageView');
    await trackPageView('/essai');
    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- Suppression de compte ------------------------------------------------------------
function fakeAdmin(options: { isAdmin?: boolean; customerId?: string | null; authError?: string; listPages?: string[][] } = {}) {
  const calls: string[] = [];
  const pages = [...(options.listPages ?? [['a.pdf', 'b.pdf'], []])];

  const builder = (table: string) => {
    const api = {
      select: () => api,
      eq: () => api,
      maybeSingle: async () => {
        if (table === 'admin_users') return { data: options.isAdmin ? { user_id: 'u1' } : null };
        if (table === 'billing_customers') return { data: options.customerId ? { stripe_customer_id: options.customerId } : null };
        return { data: null };
      },
      delete: () => {
        calls.push(`delete:${table}`);
        return { eq: async () => ({ count: table === 'documents' ? 3 : null, error: null }) };
      },
      update: () => ({ eq: async () => { calls.push(`update:${table}`); return { error: null }; } }),
      then: (resolve: (v: unknown) => void) => resolve({ data: table === 'documents' ? [{ id: 7 }] : [], error: null }),
    };
    return api;
  };

  const admin = {
    from: builder,
    storage: {
      from: (bucket: string) => ({
        list: async () => ({ data: (bucket === 'pdfs' ? pages.shift() ?? [] : []).map((name) => ({ name })), error: null }),
        remove: async (paths: string[]) => { calls.push(`storage:${bucket}:${paths.length}`); return { error: null }; },
      }),
    },
    auth: { admin: { deleteUser: async () => { calls.push('auth:delete'); return { error: options.authError ? { message: options.authError } : null }; } } },
  };
  return { admin: admin as never, calls };
}

describe('deleteUserAccount', () => {
  it('résilie l’abonnement d’abord, puis supprime fichiers, données et compte, dans cet ordre', async () => {
    const { admin, calls } = fakeAdmin({ customerId: 'cus_123' });
    const cancelBilling = vi.fn(async () => { calls.push('billing:cancel'); });
    const report = await deleteUserAccount({ admin, userId: 'u1', cancelBilling });

    expect(cancelBilling).toHaveBeenCalledWith('cus_123');
    expect(report).toMatchObject({ billingCancelled: true, storageFilesRemoved: 2, documentsRemoved: 3 });
    const order = (prefix: string) => calls.findIndex((c) => c.startsWith(prefix));
    expect(order('billing:cancel')).toBeLessThan(order('storage:pdfs'));
    expect(order('storage:pdfs')).toBeLessThan(order('delete:documents'));
    expect(order('delete:documents')).toBeLessThan(order('auth:delete'));
    expect(calls).toContain('delete:api_rate_limits');
    expect(calls).toContain('delete:user_sessions');
  });

  it('ne supprime RIEN si l’abonnement ne peut pas être résilié', async () => {
    const { admin, calls } = fakeAdmin({ customerId: 'cus_123' });
    const cancelBilling = vi.fn().mockRejectedValue(new Error('Stripe indisponible'));
    await expect(deleteUserAccount({ admin, userId: 'u1', cancelBilling })).rejects.toMatchObject({ step: 'billing' });
    expect(calls).toEqual([]);
  });

  it('ignore les clients Stripe provisoires (jamais payés)', async () => {
    const { admin } = fakeAdmin({ customerId: 'tmp_abc' });
    const cancelBilling = vi.fn();
    const report = await deleteUserAccount({ admin, userId: 'u1', cancelBilling });
    expect(cancelBilling).not.toHaveBeenCalled();
    expect(report.billingCancelled).toBe(false);
  });

  it('refuse de supprimer un compte administrateur', async () => {
    const { admin, calls } = fakeAdmin({ isAdmin: true });
    await expect(deleteUserAccount({ admin, userId: 'u1' })).rejects.toBeInstanceOf(AccountDeletionError);
    expect(calls).toEqual([]);
  });

  it('remonte l’échec de suppression du compte d’authentification', async () => {
    const { admin } = fakeAdmin({ authError: 'boom' });
    await expect(deleteUserAccount({ admin, userId: 'u1' })).rejects.toMatchObject({ step: 'auth' });
  });
});

// ---------- Export ---------------------------------------------------------------------------
describe('buildAccountExport', () => {
  it('regroupe les données du compte, signale les erreurs de table sans échouer et joint les liens de fichiers', async () => {
    const rowsByTable: Record<string, unknown[]> = {
      documents: [{ id: 1, file_name: 'cours.pdf', file_path: 'u1/cours.pdf', status: 'completed', created_at: '2026-01-01' }],
      flashcards: [{ id: 'c1', question: 'Q', answer: 'R' }],
      quiz_attempts: [{ id: 5, score: 3, total_questions: 5 }],
      quiz_answers: [{ attempt_id: 5, question_index: 0, is_correct: true }],
    };
    const supabase = {
      from: (table: string) => {
        const result = table === 'billing_customers'
          ? { data: null, error: { message: 'permission denied' } }
          : { data: rowsByTable[table] ?? [], error: null };
        const q: Record<string, unknown> = {
          select: () => q, limit: () => q, in: () => q,
          then: (resolve: (v: unknown) => void) => resolve(result),
        };
        return q;
      },
      storage: { from: () => ({ createSignedUrls: async () => ({ data: [{ path: 'u1/cours.pdf', signedUrl: 'https://signed/x' }], error: null }) }) },
    };
    const exported = await buildAccountExport(supabase as never, { id: 'u1', email: 'a@b.fr', created_at: '2026-01-01', last_sign_in_at: null } as never);

    expect(exported.compte).toMatchObject({ id: 'u1', email: 'a@b.fr' });
    expect(exported.donnees.documents).toHaveLength(1);
    expect(exported.donnees.cartes_de_revision).toHaveLength(1);
    expect(exported.donnees.reponses_aux_quiz).toEqual([{ attempt_id: 5, question_index: 0, is_correct: true }]);
    expect(exported.fichiers_originaux).toEqual([{ nom: 'cours.pdf', lien_valable_1h: 'https://signed/x' }]);
    expect(exported.erreurs.some((e) => e.includes('billing_customers'))).toBe(true);
    expect(JSON.stringify(exported)).not.toContain('embedding');
  });
});

