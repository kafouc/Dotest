import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const MARKETING_PATHS = ['/', '/vitrine'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!MARKETING_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        response.cookies.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options) {
        response.cookies.set({ name, value: '', ...(options ?? {}) });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/vitrine'],
};
