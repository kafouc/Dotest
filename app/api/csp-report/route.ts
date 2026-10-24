import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/memoryRateLimit';
import { logger } from '@/lib/logger';
import { summarizeViolation } from '@/lib/cspReport';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8_192;

/** Réception des rapports de la politique de sécurité du contenu (mode rapport seul). Public, bridé, sans stockage. */
export async function POST(req: Request) {
  if (!rateLimit(`csp:${clientIp(req)}`, 30, 60_000)) return new NextResponse(null, { status: 429 });

  const raw = await req.text().catch(() => '');
  if (raw.length === 0 || raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });

  try {
    const violation = summarizeViolation(JSON.parse(raw));
    if (violation) logger.warn('[csp] violation signalée', violation);
  } catch {
    // Rapport illisible : ignoré
  }
  return new NextResponse(null, { status: 204 });
}
