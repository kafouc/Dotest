import { NextResponse } from 'next/server';
import { handleStripeWebhook, syncPlanFromStripe, hasProcessedStripeEvent, markStripeEventProcessed } from '@/lib/billing';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature') ?? undefined;
  const raw = Buffer.from(await request.arrayBuffer());

  try {
    const event = await handleStripeWebhook(raw, signature);
    const alreadyProcessed = await hasProcessedStripeEvent(event.id);
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await syncPlanFromStripe(event);
    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[billing] erreur de webhook', error instanceof Error ? error : { error: String(error) });
    // Signature invalide ou absente : requête rejetée. Autre erreur (base indisponible…) : 500 pour que Stripe réessaie.
    const message = error instanceof Error ? error.message : '';
    const isSignatureProblem = /signature|webhook secret|payload/i.test(message);
    return NextResponse.json(
      { error: isSignatureProblem ? 'Signature invalide.' : 'Traitement impossible, nouvel essai attendu.' },
      { status: isSignatureProblem ? 400 : 500 }
    );
  }
}
