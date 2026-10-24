import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDeletionError } from '@/lib/accountDeletion';

// ---------- Routes ---------------------------------------------------------------------------
const getUser = vi.fn();
vi.mock('@/lib/supabaseServerClient', () => ({
  createSupabaseServerClient: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) }, from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }), storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) } }),
}));
const enforceRateLimit = vi.fn();
vi.mock('@/lib/rateLimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rateLimit')>('@/lib/rateLimit');
  return { ...actual, enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a) };
});
const deleteAccountMock = vi.fn();
vi.mock('@/lib/accountDeletion', async () => {
  const actual = await vi.importActual<typeof import('@/lib/accountDeletion')>('@/lib/accountDeletion');
  return { ...actual, deleteUserAccount: (...a: unknown[]) => deleteAccountMock(...a) };
});
vi.mock('@/lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock('@/lib/billing', () => ({ cancelStripeSubscriptionsForAccount: vi.fn() }));

import { DELETE as deleteAccount } from '@/app/api/account/route';
import { GET as exportAccount } from '@/app/api/account/export/route';

const del = (body: unknown) => new Request('http://localhost/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('routes /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'Eleve@Exemple.fr' } } });
    enforceRateLimit.mockResolvedValue(undefined);
    deleteAccountMock.mockResolvedValue({ storageFilesRemoved: 2, documentsRemoved: 1, billingCancelled: false });
  });

  it('401 sans session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await deleteAccount(del({ confirmEmail: 'a@b.fr' }))).status).toBe(401);
    expect((await exportAccount()).status).toBe(401);
  });

  it('400 si l’adresse saisie ne correspond pas, et rien n’est supprimé', async () => {
    const res = await deleteAccount(del({ confirmEmail: 'autre@exemple.fr' }));
    expect(res.status).toBe(400);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it('supprime le compte quand l’adresse correspond (sans tenir compte de la casse)', async () => {
    const res = await deleteAccount(del({ confirmEmail: 'eleve@exemple.fr' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: true, storageFilesRemoved: 2 });
    expect(deleteAccountMock).toHaveBeenCalledTimes(1);
  });

  it('403 pour un compte administrateur', async () => {
    deleteAccountMock.mockRejectedValue(new AccountDeletionError('admin', 'Les comptes administrateurs ne peuvent pas être supprimés.'));
    expect((await deleteAccount(del({ confirmEmail: 'eleve@exemple.fr' }))).status).toBe(403);
  });

  it('l’export est un téléchargement JSON non mis en cache', async () => {
    const res = await exportAccount();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="sheet-of-paper-export-');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.parse(await res.text()).compte.id).toBe('u1');
  });
});
