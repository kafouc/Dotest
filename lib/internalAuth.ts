import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Authentification des appels internes entre routes (extract -> embed-batch-optimized).
 * Le jeton est un HMAC du contenu de la requête, signé avec SUPABASE_SERVICE_ROLE_KEY :
 * aucune variable d'environnement supplémentaire, et il change avec la clé lors d'une rotation.
 */
export const INTERNAL_AUTH_HEADER = 'x-internal-signature';

function sign(payload: string): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createHmac('sha256', key).update(`internal:${payload}`).digest('hex');
}

export function signInternalRequest(payload: string): string {
  const signature = sign(payload);
  if (!signature) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante : impossible de signer la requête interne.');
  }
  return signature;
}

export function verifyInternalRequest(payload: string, provided: string | null): boolean {
  const expected = sign(payload);
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
