import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { logActivity } from '@/lib/metricsLogger';
import { parseJsonBody, activityEventSchema } from '@/lib/validation';
import { internalError } from '@/lib/apiError';

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const parsedBody = await parseJsonBody(req, activityEventSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { eventType, eventData } = parsedBody.data;

    await logActivity({
      eventType,
      userId: user.id,
      eventData: eventData ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError('activity', error);
  }
}
