import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();

    // Échanger le code pour une session
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Rediriger vers l'app après connexion
  return NextResponse.redirect(new URL('/app', requestUrl.origin));
}

