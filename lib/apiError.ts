import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';

import { ProviderBusyError } from '@/lib/groqParams';

/** 429 « service IA saturé » avec le délai à patienter, ou null si l'erreur n'en est pas une. */
export function providerBusyResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProviderBusyError)) return null;
  return NextResponse.json(
    {
      error: `Le service de génération est très sollicité. Réessayez dans ${error.retryAfterSeconds} s.`,
      code: 'ai-busy',
      retryAfter: error.retryAfterSeconds,
    },
    { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
  );
}

/**
 * Réponse 500 uniforme : le détail technique va dans les logs, le client reçoit un message
 * générique et un identifiant (`requestId`) à communiquer au support pour retrouver l'erreur.
 */
export function internalError(
  scope: string,
  error: unknown,
  publicMessage = 'Une erreur est survenue. Réessayez dans un instant.'
): NextResponse {
  const requestId = randomUUID().slice(0, 8);
  logger.error(`[${scope}] erreur interne`, error instanceof Error ? error : { error: String(error) }, { requestId });
  return NextResponse.json({ error: publicMessage, requestId }, { status: 500 });
}
