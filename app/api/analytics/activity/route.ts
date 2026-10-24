import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { logActivity } from '@/lib/metricsLogger';
import { parseJsonBody, activityEventSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookies().set(name, value, options);
          },
          remove(name: string, options) {
            cookies().delete({ ...options, name });
          },
        },
      }
    );

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
    console.error('[Activity API] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
