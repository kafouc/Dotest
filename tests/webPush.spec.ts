import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: send } }));

import { sendPush } from '@/lib/webPush';
import { buildNotification } from '@/lib/notifications';

const sub = { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
});

describe('sendPush', () => {
  it('envoie le contenu avec l’adresse de destination dans les données', async () => {
    send.mockResolvedValue({});
    expect(await sendPush(sub, buildNotification('morning', { dueCount: 3 }))).toBe('sent');
    const [target, payload, options] = send.mock.calls[0];
    expect(target).toEqual({ endpoint: sub.endpoint, keys: sub.keys });
    expect(JSON.parse(payload).data.url).toBe('/review');
    expect(options).toMatchObject({ TTL: 3600 });
  });

  it('distingue appareil disparu (404/410), abonnement incomplet et panne temporaire', async () => {
    send.mockRejectedValueOnce({ statusCode: 410 });
    expect(await sendPush(sub, buildNotification('test'))).toBe('gone');
    send.mockRejectedValueOnce({ statusCode: 404 });
    expect(await sendPush(sub, buildNotification('test'))).toBe('gone');
    send.mockRejectedValueOnce({ statusCode: 503 });
    expect(await sendPush(sub, buildNotification('test'))).toBe('error');
    expect(await sendPush({ endpoint: null, keys: null }, buildNotification('test'))).toBe('invalid');
  });

  it('ne tente rien sans clés VAPID', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await sendPush(sub, buildNotification('test'))).toBe('error');
    expect(send).not.toHaveBeenCalled();
  });
});
