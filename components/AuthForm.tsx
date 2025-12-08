"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authLocalization } from '@/lib/authLocalization';

type AuthFormProps = {
  supabase: SupabaseClient;
  view: 'sign_in' | 'sign_up' | 'forgotten_password';
  showBackButton?: boolean;
  backHref?: string;
};

export default function AuthForm({ supabase, view, showBackButton = false, backHref = '/' }: AuthFormProps) {
  // URL de retour pour OAuth (GitHub/Google)
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  const getTitle = () => {
    switch (view) {
      case 'sign_in':
        return 'Se connecter';
      case 'sign_up':
        return "S'inscrire";
      case 'forgotten_password':
        return 'Réinitialiser le mot de passe';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/50"
    >
      {showBackButton && (
        <Link
          href={backHref}
          className="mb-4 inline-block text-sm text-brand-yellow hover:underline"
        >
          &larr; Revenir
        </Link>
      )}

      <h2 className="text-2xl font-heading font-bold text-brand-dark mb-6 text-center">
        {getTitle()}
      </h2>

      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['github', 'google']}
        view={view}
        redirectTo={redirectTo}
        localization={authLocalization}
      />

      {/* Lien "Mot de passe oublié" uniquement pour sign_in */}
      {view === 'sign_in' && (
        <div className="mt-4 text-center">
          <Link
            href="/login?view=forgotten_password"
            className="text-sm text-gray-600 hover:text-brand-yellow hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      )}

      {/* Liens de basculement sign_in <-> sign_up */}
      {view === 'sign_in' && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Vous n&apos;avez pas de compte ?{' '}
          <Link href="/signup" className="text-brand-yellow font-medium hover:underline">
            S&apos;inscrire
          </Link>
        </div>
      )}

      {view === 'sign_up' && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="text-brand-yellow font-medium hover:underline">
            Se connecter
          </Link>
        </div>
      )}

      {view === 'forgotten_password' && (
        <div className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="text-brand-yellow font-medium hover:underline">
            Retour à la connexion
          </Link>
        </div>
      )}
    </motion.div>
  );
}

