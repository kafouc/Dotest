import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Doubles ---------------------------------------------------------------------------
const sendPush = vi.fn();
vi.mock('@/lib/webPush', async () => {
  const actual = await vi.importActual<typeof import('@/lib/webPush')>('@/lib/webPush');
  return { ...actual, sendPush: (...a: unknown[]) => sendPush(...a), isPushConfigured: () => process.env.VAPID_PRIVATE_KEY !== undefined };
});

const adminState = vi.hoisted(() => ({
  candidates: [] as unknown[],
  subscriptions: [] as unknown[],
  claimed: true,
  deleted: [] as string[],
  updated: [] as { table: string; row: unknown; endpoint: unknown }[],
  rpcCalls: [] as { name: string; args: unknown }[],
}));
const fakeAdmin = {
  rpc: async (name: string, args: unknown) => {
    adminState.rpcCalls.push({ name, args });
    if (name === 'notification_candidates') return { data: adminState.candidates, error: null };
    if (name === 'claim_notification') return { data: adminState.claimed, error: null };
    return { data: null, error: null };
  },
  from: (table: string) => ({
    select: () => ({ in: async () => ({ data: adminState.subscriptions, error: null }) }),
    delete: () => ({ eq: async (_c: string, endpoint: string) => { adminState.deleted.push(endpoint); return { error: null }; } }),
    update: (row: unknown) => ({ eq: async (_c: string, endpoint: unknown) => { adminState.updated.push({ table, row, endpoint }); return { error: null }; } }),
  }),
};
vi.mock('@/lib/supabaseAdmin', () => ({ getSupabaseAdmin: () => fakeAdmin }));

const userState = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  existingWelcomedAt: null as string | null,
  existingRow: false,
  upserts: [] as { table: string; row: unknown }[],
  devices: [] as unknown[],
  deletedIn: [] as unknown[],
}));
const fakeUserClient = {
  auth: { getUser: async () => ({ data: { user: userState.user } }) },
  from: (table: string) => ({
    select: () => ({
      eq: (_c: string, _v: unknown) => ({
        maybeSingle: async () => ({ data: userState.existingRow ? { welcomed_at: userState.existingWelcomedAt } : null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: userState.devices, error: null }),
      }),
    }),
    upsert: async (row: unknown) => { userState.upserts.push({ table, row }); return { error: null }; },
    delete: () => ({
      eq: () => ({ eq: async () => ({ error: null }) }),
      in: async (_c: string, values: unknown) => { userState.deletedIn.push(values); return { error: null }; },
    }),
  }),
};
vi.mock('@/lib/supabaseServerClient', () => ({ createSupabaseServerClient: async () => fakeUserClient }));
const enforceRateLimit = vi.fn();
vi.mock('@/lib/rateLimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rateLimit')>('@/lib/rateLimit');
  return { ...actual, enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a) };
});

import { GET as cron } from '@/app/api/cron/notifications/route';
import { POST as subscribe, DELETE as unsubscribe } from '@/app/api/push/subscribe/route';
import { POST as pushTest } from '@/app/api/push/test/route';

const candidate = (over: Record<string, unknown> = {}) => ({
  user_id: 'u1', kind: 'morning', local_day: '2026-10-28', due_count: 4, new_count: 1, quiz_error_due: 2, reviewed_today: 0, daily_goal: 10, current_streak: 3, ...over,
});
const device = (endpoint = 'https://push.example/a') => ({ user_id: 'u1', endpoint, keys: { p256dh: 'k', auth: 'a' } });
const cronRequest = (token?: string) => new Request('http://localhost/api/cron/notifications', { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NOTIFY_CRON_SECRET = 'secret-cron';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  Object.assign(adminState, { candidates: [], subscriptions: [], claimed: true, deleted: [], updated: [], rpcCalls: [] });
  Object.assign(userState, { user: { id: 'u1' }, existingWelcomedAt: null, existingRow: false, upserts: [], devices: [], deletedIn: [] });
  sendPush.mockResolvedValue('sent');
  enforceRateLimit.mockResolvedValue(undefined);
});

describe('GET /api/cron/notifications', () => {
  it('401 sans le secret ou avec un mauvais secret', async () => {
    expect((await cron(cronRequest())).status).toBe(401);
    expect((await cron(cronRequest('mauvais'))).status).toBe(401);
  });

  it('accepte aussi le secret des statistiques quand NOTIFY_CRON_SECRET n’est pas défini', async () => {
    delete process.env.NOTIFY_CRON_SECRET;
    process.env.METRICS_CRON_SECRET = 'metrics-secret';
    expect((await cron(cronRequest('metrics-secret'))).status).toBe(200);
    delete process.env.METRICS_CRON_SECRET;
  });

  it('503 sans clés VAPID', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await cron(cronRequest('secret-cron'))).status).toBe(503);
  });

  it('envoie la notification du jour avec les vraies données de l’utilisateur', async () => {
    adminState.candidates = [candidate()];
    adminState.subscriptions = [device('https://push.example/a'), device('https://push.example/b')];
    const res = await cron(cronRequest('secret-cron'));
    expect(await res.json()).toMatchObject({ candidates: 1, sent: 1, errors: 0 });
    expect(sendPush).toHaveBeenCalledTimes(2); // un envoi par appareil
    const payload = sendPush.mock.calls[0][1] as { title: string; body: string; url: string };
    expect(payload.body).toContain('5 cartes vous attendent');
    expect(payload.url).toBe('/review');
    expect(adminState.rpcCalls.find((c) => c.name === 'claim_notification')?.args).toMatchObject({ p_user_id: 'u1', p_kind: 'morning', p_local_day: '2026-10-28' });
  });

  it('n’envoie rien si le rappel du jour a déjà été réservé (exécutions simultanées)', async () => {
    adminState.candidates = [candidate()];
    adminState.subscriptions = [device()];
    adminState.claimed = false;
    expect(await (await cron(cronRequest('secret-cron'))).json()).toMatchObject({ sent: 0, skippedClaimed: 1 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('retire de la base les appareils qui ont supprimé leur abonnement', async () => {
    adminState.candidates = [candidate({ kind: 'evening' })];
    adminState.subscriptions = [device('https://push.example/mort'), device('https://push.example/vivant')];
    sendPush.mockImplementation(async (d: { endpoint: string }) => (d.endpoint.endsWith('mort') ? 'gone' : 'sent'));
    expect(await (await cron(cronRequest('secret-cron'))).json()).toMatchObject({ sent: 1, removedDevices: 1 });
    expect(adminState.deleted).toEqual(['https://push.example/mort']);
  });

  it('ignore un utilisateur sans appareil, sans consommer son rappel du jour', async () => {
    adminState.candidates = [candidate()];
    adminState.subscriptions = [];
    expect(await (await cron(cronRequest('secret-cron'))).json()).toMatchObject({ noDevice: 1, sent: 0 });
    expect(adminState.rpcCalls.some((c) => c.name === 'claim_notification')).toBe(false);
  });

  it('personne à notifier : réponse vide sans requête d’abonnements', async () => {
    expect(await (await cron(cronRequest('secret-cron'))).json()).toMatchObject({ candidates: 0, sent: 0 });
  });
});

describe('POST /api/push/subscribe', () => {
  const body = (extra: Record<string, unknown> = {}) =>
    new Request('http://localhost/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } }, ...extra }),
    });

  it('première inscription de l’appareil : envoie la notification de bienvenue et la marque', async () => {
    const res = await subscribe(body({ timezone: 'Europe/Paris' }));
    expect(await res.json()).toEqual({ ok: true, welcomed: true });
    expect((sendPush.mock.calls[0][1] as { title: string }).title).toContain('Bienvenue');
    expect(adminState.updated[0]).toMatchObject({ table: 'push_subscriptions', endpoint: 'https://push.example/a' });
    expect(userState.upserts.find((u) => u.table === 'user_settings')?.row).toMatchObject({ user_id: 'u1', timezone: 'Europe/Paris' });
  });

  it('appareil déjà accueilli : pas de seconde bienvenue', async () => {
    userState.existingRow = true;
    userState.existingWelcomedAt = '2026-10-01T10:00:00Z';
    expect(await (await subscribe(body())).json()).toEqual({ ok: true, welcomed: false });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('l’échec de la bienvenue ne fait pas échouer l’inscription et ne la marque pas', async () => {
    sendPush.mockResolvedValue('error');
    const res = await subscribe(body());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, welcomed: false });
    expect(adminState.updated).toEqual([]);
  });

  it('ignore un fuseau horaire invalide et refuse une inscription sans session', async () => {
    await subscribe(body({ timezone: 'Mars/Olympus' }));
    expect(userState.upserts.some((u) => u.table === 'user_settings')).toBe(false);
    userState.user = null;
    expect((await subscribe(body())).status).toBe(401);
  });

  it('DELETE retire l’appareil', async () => {
    const res = await unsubscribe(new Request('http://localhost/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: 'https://push.example/a' }) }));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/push/test', () => {
  it('401 sans session, 404 sans appareil', async () => {
    userState.user = null;
    expect((await pushTest()).status).toBe(401);
    userState.user = { id: 'u1' };
    expect((await pushTest()).status).toBe(404);
  });

  it('envoie le test aux appareils de l’utilisateur', async () => {
    userState.devices = [{ endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } }];
    const res = await pushTest();
    expect(await res.json()).toEqual({ sent: 1, devices: 1 });
    expect((sendPush.mock.calls[0][1] as { title: string }).title).toContain('Test réussi');
  });

  it('502 quand l’appareil est injoignable', async () => {
    userState.devices = [{ endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } }];
    sendPush.mockResolvedValue('error');
    expect((await pushTest()).status).toBe(502);
  });
});
