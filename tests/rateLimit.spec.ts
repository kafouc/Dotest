import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const rpc = vi.fn();
const fetchUserPlan = vi.fn();

vi.mock('@/lib/subscriptions', () => ({
  getSupabaseAdminClient: () => ({ rpc }),
  fetchUserPlan: (...args: unknown[]) => fetchUserPlan(...args),
}));

import {
  RateLimitError,
  RateLimiterUnavailableError,
  clientIp,
  enforceRateLimit,
  rateLimitErrorResponse,
} from '@/lib/rateLimit';
import { RATE_LIMITS } from '@/lib/constants';

const userClient = {} as SupabaseClient;
const allowed = { data: [{ allowed: true, remaining: 4, retry_after_seconds: 30 }], error: null };
const blocked = (retry = 42) => ({
  data: [{ allowed: false, remaining: 0, retry_after_seconds: retry }],
  error: null,
});

beforeEach(() => {
  rpc.mockReset();
  fetchUserPlan.mockReset();
  fetchUserPlan.mockResolvedValue({ plan: 'freemium' });
});

describe('enforceRateLimit', () => {
  it('laisse passer sous les limites et applique minute puis jour', async () => {
    rpc.mockResolvedValue(allowed);
    await enforceRateLimit(userClient, 'u1', 'generate-quiz');
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_bucket: 'generate-quiz:minute',
      p_limit: RATE_LIMITS['generate-quiz'].perMinute,
      p_window_seconds: 60,
    });
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_bucket: 'generate-quiz:day',
      p_limit: RATE_LIMITS['generate-quiz'].perDay.freemium,
      p_window_seconds: 86_400,
    });
  });

  it('un refus par minute ne consomme pas le quota quotidien', async () => {
    rpc.mockResolvedValueOnce(blocked(12));
    await expect(enforceRateLimit(userClient, 'u1', 'generate-quiz')).rejects.toMatchObject({
      scope: 'minute',
      retryAfterSeconds: 12,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('applique le plafond quotidien du plan', async () => {
    fetchUserPlan.mockResolvedValue({ plan: 'pro' });
    rpc.mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked(3600));
    await expect(enforceRateLimit(userClient, 'u1', 'generate-summary')).rejects.toBeInstanceOf(
      RateLimitError
    );
    expect(rpc.mock.calls[1][1].p_limit).toBe(RATE_LIMITS['generate-summary'].perDay.pro);
  });

  it('plan inconnu ou illisible => freemium', async () => {
    fetchUserPlan.mockRejectedValue(new Error('db down'));
    rpc.mockResolvedValue(allowed);
    await enforceRateLimit(userClient, 'u1', 'generate-themes');
    expect(rpc.mock.calls[1][1].p_limit).toBe(RATE_LIMITS['generate-themes'].perDay.freemium);
  });

  it('fail-closed : erreur du limiteur => RateLimiterUnavailableError', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(enforceRateLimit(userClient, 'u1', 'embed')).rejects.toBeInstanceOf(
      RateLimiterUnavailableError
    );
  });
});

describe('rateLimitErrorResponse', () => {
  it('429 avec Retry-After', async () => {
    const res = rateLimitErrorResponse(new RateLimitError('minute', 17))!;
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(await res.json()).toMatchObject({ code: 'rate-limited', scope: 'minute', upgrade: false });
  });

  it('quota quotidien => upgrade proposé', async () => {
    const res = rateLimitErrorResponse(new RateLimitError('day', 600))!;
    expect(await res.json()).toMatchObject({ scope: 'day', upgrade: true });
  });

  it('503 si limiteur indisponible, null pour les autres erreurs', () => {
    expect(rateLimitErrorResponse(new RateLimiterUnavailableError())!.status).toBe(503);
    expect(rateLimitErrorResponse(new Error('autre'))).toBeNull();
  });
});

describe('clientIp', () => {
  it('prend le premier élément de x-forwarded-for', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });
  it('retombe sur x-real-ip puis unknown', () => {
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '5.6.7.8' } }))).toBe('5.6.7.8');
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
