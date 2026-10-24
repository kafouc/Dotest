'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

/** Session Supabase courante ; redirige vers /login dès qu'il n'y en a plus. */
export function useAuthSession(supabase: SupabaseClient) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setIsCheckingAuth(false);
      if (!current) router.push('/login');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) router.push('/login');
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // Ne laisse aucune donnée de l'utilisateur dans les caches de l'appareil
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {
      // Cache indisponible : rien à nettoyer
    }
    setSession(null);
  }, [supabase]);

  return { session, isCheckingAuth, logout };
}
