/**
 * Limiteur de débit en mémoire (fenêtre glissante simple), par instance serverless.
 * Il freine les abus évidents sur les routes publiques ; pour une garantie globale,
 * il faudra un store partagé (Redis / table Supabase).
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 5_000;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** Renvoie true si la requête est autorisée, false si la limite est dépassée. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);

  if (buckets.size > MAX_KEYS) {
    buckets.forEach((times, k) => {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k);
    });
  }
  return true;
}
