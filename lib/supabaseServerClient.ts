import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    throw new Error('Supabase environment variables manquantes (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const cookieStore = await cookies();
  type CookieSetInput = Parameters<typeof cookieStore.set>[0];
  type CookieDeleteInput = Parameters<typeof cookieStore.delete>[0];

  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: Omit<CookieSetInput, 'name' | 'value'>) {
        cookieStore.set({ ...(options ?? {}), name, value });
      },
      remove(name: string, options?: Omit<CookieDeleteInput, 'name'>) {
        cookieStore.delete({ ...(options ?? {}), name });
      },
    },
  });
}
