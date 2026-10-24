import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const MARKETING_PATHS = ['/', '/vitrine'];
const PROTECTED_PREFIXES = ['/app', '/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isMarketing = MARKETING_PATHS.includes(pathname);
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isMarketing && !isProtected) {
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

  // getUser() valide le jeton auprès de Supabase (getSession() ne fait que lire le cookie).
  const {
    data: { user: session },
  } = await supabase.auth.getUser();

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isMarketing && session) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/vitrine', '/app/:path*', '/settings/:path*'],
};
