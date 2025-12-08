"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import AuthForm from '@/components/AuthForm';
import type { Session } from '@supabase/supabase-js';

export default function SignupPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      if (session) {
        router.push('/app');
      }
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        router.push('/app');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-brand-dark">Chargement...</div>
      </div>
    );
  }

  if (session) {
    return null; // Redirection en cours
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-gradient-to-br from-brand-yellow-light via-white to-brand-teal-light">
      <AuthForm supabase={supabase} view="sign_up" showBackButton={true} backHref="/" />
    </div>
  );
}

