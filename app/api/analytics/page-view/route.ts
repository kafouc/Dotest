import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { logPageView } from '@/lib/metricsLogger';
import type { PageViewEvent } from '@/lib/metricsLogger';
import { createHash } from 'node:crypto';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 });
  }

  if (!rateLimit(`page-view:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  try {
    let payload: Partial<PageViewEvent> = {};
    try {
      payload = (await req.json()) as Partial<PageViewEvent>;
    } catch {
      payload = {};
    }

    const requestHeaders = headers();
    const referrer = requestHeaders.get('referer') ?? payload.referrer ?? null;
    const userAgent = requestHeaders.get('user-agent') ?? null;
    const country = requestHeaders.get('x-vercel-ip-country') ?? null;

    const forwardedFor = requestHeaders.get('x-forwarded-for') ?? '';
    const ip = forwardedFor.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || null;
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;

    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    await logPageView({
      route: typeof payload.route === 'string' && payload.route.length > 0 ? payload.route : '/',
      sessionId: payload.sessionId ?? null,
      userId: user?.id ?? null,
      referrer,
      userAgent,
      country,
      ipHash,
      occurredAt: new Date(),
      metadata: payload.metadata ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[page-view] erreur instrumentation:', error);
    return NextResponse.json({ error: 'Instrumentation impossible' }, { status: 500 });
  }
}
