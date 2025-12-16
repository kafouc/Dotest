import { NextResponse } from 'next/server';
import { handleStripeWebhook, syncPlanFromStripe } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature') ?? undefined;
  const raw = Buffer.from(await request.arrayBuffer());

  try {
    const event = await handleStripeWebhook(raw, signature);
    await syncPlanFromStripe(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[billing] webhook error:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
