import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(URL && ANON && SERVICE);

const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const service = enabled ? createClient(URL!, SERVICE!, opts) : null;
const anon = enabled ? createClient(URL!, ANON!, opts) : null;

const userIds: string[] = [];
const newUser = () => {
  const id = randomUUID();
  userIds.push(id);
  return id;
};

const consume = (userId: string, bucket: string, limit: number, windowSeconds = 3600) =>
  service!.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

describe.skipIf(!enabled)('consume_rate_limit (base réelle)', () => {
  afterAll(async () => {
    if (service && userIds.length) {
      await service.from('api_rate_limits').delete().in('user_id', userIds);
    }
  });

  it('autorise jusqu’à la limite puis refuse avec un délai de reprise', async () => {
    const user = newUser();
    const results = [];
    for (let i = 0; i < 4; i++) {
      const { data, error } = await consume(user, 't:seq', 3);
      expect(error).toBeNull();
      results.push(data[0]);
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3].retry_after_seconds).toBeGreaterThan(0);
    expect(results[3].retry_after_seconds).toBeLessThanOrEqual(3600);
  });

  it('atomique : 20 appels simultanés pour une limite de 5 => exactement 5 autorisés', async () => {
    const user = newUser();
    const calls = await Promise.all(Array.from({ length: 20 }, () => consume(user, 't:race', 5)));
    const allowed = calls.filter((c) => c.data?.[0]?.allowed === true).length;
    expect(calls.every((c) => c.error === null)).toBe(true);
    expect(allowed).toBe(5);

    const { data } = await service!
      .from('api_rate_limits')
      .select('count')
      .eq('user_id', user)
      .eq('bucket', 't:race');
    expect(data!.reduce((n, r) => n + r.count, 0)).toBe(5); // les refus n'incrémentent pas
  });

  it('les compteurs sont indépendants par utilisateur et par bucket', async () => {
    const a = newUser();
    const b = newUser();
    await consume(a, 't:iso', 1);
    expect((await consume(a, 't:iso', 1)).data[0].allowed).toBe(false);
    expect((await consume(b, 't:iso', 1)).data[0].allowed).toBe(true);
    expect((await consume(a, 't:autre', 1)).data[0].allowed).toBe(true);
  });

  it('paramètres invalides refusés', async () => {
    const user = newUser();
    expect((await consume(user, 't:bad', 0)).error).not.toBeNull();
    expect((await consume(user, '', 5)).error).not.toBeNull();
  });

  it('inaccessible aux clients anon : ni RPC ni lecture de la table', async () => {
    const user = newUser();
    const rpc = await anon!.rpc('consume_rate_limit', {
      p_user_id: user,
      p_bucket: 't:anon',
      p_limit: 1,
      p_window_seconds: 60,
    });
    expect(rpc.error).not.toBeNull();

    await consume(user, 't:visible', 5);
    const read = await anon!.from('api_rate_limits').select('*').eq('user_id', user);
    expect(read.data ?? []).toHaveLength(0);
    const wipe = await anon!.from('api_rate_limits').delete().eq('user_id', user);
    const { data } = await service!.from('api_rate_limits').select('count').eq('user_id', user);
    expect(wipe.error !== null || (data ?? []).length > 0).toBe(true); // l'anon ne peut pas remettre à zéro
  });
});
