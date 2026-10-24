import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runDailyAggregation } from '@/lib/metricsLogger';

const CRON_SECRET = process.env.METRICS_CRON_SECRET;

function safeEqual(a: string | null, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function isAuthorized(request: Request): boolean {
  // Sans secret configuré la route reste fermée (et non ouverte à tous).
  if (!CRON_SECRET) {
    return false;
  }
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return safeEqual(token, CRON_SECRET) || safeEqual(request.headers.get('x-cron-secret'), CRON_SECRET);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    let targetDate: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.targetDate === 'string' && body.targetDate.length === 10) {
        targetDate = body.targetDate;
      }
    } catch {
      // Pas de payload JSON
    }

    await runDailyAggregation(targetDate);
 
    return NextResponse.json({ success: true, targetDate: targetDate ?? 'auto' });
  } catch (error) {
    console.error('[aggregate-metrics] échec agrégation', error);
    return NextResponse.json({ error: 'Agrégation impossible' }, { status: 500 });
  }
}
