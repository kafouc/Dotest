import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RATE_LIMITS, type RateLimitRoute } from './constants';
import { logger } from './logger';
import { fetchUserPlan, getSupabaseAdminClient, type SubscriptionPlan } from './subscriptions';

const MINUTE_SECONDS = 60;
const DAY_SECONDS = 86_400;

export type RateLimitScope = 'minute' | 'day';

/** Limite atteinte : à convertir en réponse 429. */
export class RateLimitError extends Error {
  scope: RateLimitScope;
  retryAfterSeconds: number;
  constructor(scope: RateLimitScope, retryAfterSeconds: number) {
    super(
      scope === 'minute'
        ? 'Trop de requêtes. Réessayez dans quelques instants.'
        : "Limite quotidienne d'utilisation atteinte pour votre plan."
    );
    this.scope = scope;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Le limiteur est injoignable : on refuse (fail-closed) plutôt que d'exposer le coût IA. */
export class RateLimiterUnavailableError extends Error {
  constructor(message = 'Service de limitation indisponible.') {
    super(message);
  }
}

type ConsumeResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function consumeRateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<ConsumeResult> {
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    logger.error('[rateLimit] consume_rate_limit failed', error instanceof Error ? error : { error });
    throw new RateLimiterUnavailableError();
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; remaining: number; retry_after_seconds: number }
    | undefined;
  if (!row) throw new RateLimiterUnavailableError();
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

async function resolvePlan(supabase: SupabaseClient): Promise<SubscriptionPlan> {
  const row = await fetchUserPlan(supabase).catch(() => null);
  return row?.plan === 'partial' || row?.plan === 'pro' ? row.plan : 'freemium';
}

/**
 * À appeler juste après l'authentification, AVANT tout appel à un service payant.
 * Applique la limite par minute puis le plafond quotidien du plan de l'utilisateur.
 * Lève RateLimitError (429) ou RateLimiterUnavailableError (503).
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  route: RateLimitRoute
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new RateLimiterUnavailableError('Configuration serveur manquante.');

  const rule = RATE_LIMITS[route];

  // Rafale d'abord : un refus ici ne consomme pas le quota quotidien.
  const burst = await consumeRateLimit(admin, userId, `${route}:minute`, rule.perMinute, MINUTE_SECONDS);
  if (!burst.allowed) throw new RateLimitError('minute', burst.retryAfterSeconds);

  const plan = await resolvePlan(supabase);
  const daily = await consumeRateLimit(admin, userId, `${route}:day`, rule.perDay[plan], DAY_SECONDS);
  if (!daily.allowed) throw new RateLimitError('day', daily.retryAfterSeconds);
}

/** IP du client (Vercel écrase x-forwarded-for : le premier élément n'est pas falsifiable). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** UUID déterministe dérivé de l'IP (on ne stocke pas l'adresse IP en clair). */
function ipToKey(ip: string): string {
  const h = createHash('sha256').update(`rate-limit-ip:${ip}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Pour les routes publiques (sans compte) : limite par IP, avec le plafond quotidien du palier freemium.
 */
export async function enforceIpRateLimit(req: Request, route: RateLimitRoute): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new RateLimiterUnavailableError('Configuration serveur manquante.');

  const rule = RATE_LIMITS[route];
  const key = ipToKey(clientIp(req));

  const burst = await consumeRateLimit(admin, key, `${route}:minute`, rule.perMinute, MINUTE_SECONDS);
  if (!burst.allowed) throw new RateLimitError('minute', burst.retryAfterSeconds);

  const daily = await consumeRateLimit(admin, key, `${route}:day`, rule.perDay.freemium, DAY_SECONDS);
  if (!daily.allowed) throw new RateLimitError('day', daily.retryAfterSeconds);
}

/** Identifiant fixe du compteur partagé par tous les visiteurs (aucune donnée personnelle). */
const GLOBAL_KEY = '00000000-0000-4000-8000-000000000001';

/**
 * Plafond global pour une route publique coûteuse : protège le budget IA contre un afflux de visiteurs
 * (ou un robot qui change d'adresse IP à chaque requête).
 */
export async function enforceGlobalRateLimit(route: RateLimitRoute): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new RateLimiterUnavailableError('Configuration serveur manquante.');

  const rule = RATE_LIMITS[route];
  const burst = await consumeRateLimit(admin, GLOBAL_KEY, `${route}:minute`, rule.perMinute, MINUTE_SECONDS);
  if (!burst.allowed) throw new RateLimitError('minute', burst.retryAfterSeconds);

  const daily = await consumeRateLimit(admin, GLOBAL_KEY, `${route}:day`, rule.perDay.freemium, DAY_SECONDS);
  if (!daily.allowed) throw new RateLimitError('day', daily.retryAfterSeconds);
}

/** Convertit les erreurs du limiteur en réponse HTTP ; retourne null pour toute autre erreur. */
export function rateLimitErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'rate-limited',
        scope: error.scope,
        retryAfter: error.retryAfterSeconds,
        upgrade: error.scope === 'day',
      },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
    );
  }
  if (error instanceof RateLimiterUnavailableError) {
    return NextResponse.json(
      { error: 'Service momentanément indisponible. Réessayez plus tard.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }
  return null;
}
