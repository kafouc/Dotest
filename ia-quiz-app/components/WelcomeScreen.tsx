"use client";

import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { I18nVariables } from '@supabase/auth-ui-shared';

// Props du composant
type WelcomeScreenProps = {
  supabase: SupabaseClient;
  localization: { variables?: I18nVariables };
};

// --- Configuration de l'Animation (traduit de votre SCSS) ---
const animationTime = 45; // 45s
const numberOfRainbows = 25;
const colors = {
  purple: 'rgb(232 121 249)',
  blue: 'rgb(96 165 250)',
  green: 'rgb(94 234 212)',
};

// Fonction pour mélanger les couleurs
const getRandomColors = () => {
  const colorArray = [colors.purple, colors.blue, colors.green];
  for (let i = colorArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorArray[i], colorArray[j]] = [colorArray[j], colorArray[i]];
  }
  return colorArray;
};
// --- Fin Configuration Animation ---

export default function WelcomeScreen({ supabase, localization }: WelcomeScreenProps) {
  const [authView, setAuthView] = useState<'welcome' | 'sign_in' | 'sign_up' | 'forgotten_password'>('welcome');

  // URL de retour pour OAuth (GitHub/Google)
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  return (
    // --- CORRECTION : Remplacement de <> par <div className="contents"> ---
    <div className="contents">
      {/* --- FOND ANIMÉ (Plein écran) --- */}
      <AnimatePresence>
        {authView === 'welcome' && (
          <motion.div 
            className="welcome-background fixed inset-0 z-0" // z-0 = arrière-plan
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            {Array.from({ length: numberOfRainbows }).map((_, i) => {
              const [color1, color2, color3] = getRandomColors();
              const delay = -((i / numberOfRainbows) * animationTime);
              const duration = (animationTime - (animationTime / numberOfRainbows / 2) * i);

              return (
                <div
                  key={i}
                  className="rainbow"
                  style={{
                    boxShadow: `
                      -130px 0 80px 40px white, 
                      -50px 0 50px 25px ${color1},
                      0 0 50px 25px ${color2}, 
                      50px 0 50px 25px ${color3},
                      130px 0 80px 40px white
                    `,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                  }}
                />
              );
            })}
            <div className="h-vignette"></div>
            <div className="v-vignette"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CONTENU CENTRÉ (Au-dessus du fond) --- */}
      <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/50 relative z-10">
        <AnimatePresence mode="wait">
          {authView === 'welcome' ? (
            // --- ÉTAT 1 : Les Boutons de Bienvenue ---
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h1 className="text-3xl font-bold text-brand-purple-dark mb-4">
                Bienvenue sur IA Quiz
              </h1>
              <p className="text-gray-700 mb-8">
                {/* CORRECTION ESLint: ' remplacé par &apos; */}
                Transformez vos notes de cours en quiz interactifs grâce à l&apos;IA.
              </p>
              
              <button
                type="button"
                onClick={() => setAuthView('sign_in')}
                className="w-full px-6 py-3 mb-4 cursor-pointer bg-brand-purple hover:bg-brand-purple-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
              >
                Se connecter
              </button>
              
              <button
                type="button"
                onClick={() => setAuthView('sign_up')}
                className="w-full px-6 py-3 cursor-pointer bg-brand-pink hover:bg-brand-pink-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
              >
                S&apos;inscrire
              </button>
            </motion.div>

          ) : (
            // --- ÉTAT 2 : Le Formulaire d'Authentification ---
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <button 
                type="button"
                aria-label="Revenir à l'écran de bienvenue"
                onClick={() => setAuthView('welcome')}
                className="mb-4 text-sm text-brand-purple hover:underline"
              >
                &larr; Revenir
              </button>

              {/* Titre différencié selon la vue */}
              <h2 className="text-2xl font-bold text-brand-purple-dark mb-4 text-center">
                {authView === 'sign_in' && 'Se connecter'}
                {authView === 'sign_up' && 'S\'inscrire'}
                {authView === 'forgotten_password' && 'Réinitialiser le mot de passe'}
              </h2>
              
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={['github', 'google']}
                view={authView} 
                redirectTo={redirectTo}
                localization={localization}
              />

              {/* Lien "Mot de passe oublié" uniquement pour sign_in */}
              {authView === 'sign_in' && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthView('forgotten_password')}
                    className="text-sm text-gray-600 hover:text-brand-purple hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              {/* Lien de basculement sign_in <-> sign_up */}
              {authView === 'sign_in' && (
                <div className="mt-4 text-center text-sm text-gray-600">
                  Vous n&apos;avez pas de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthView('sign_up')}
                    className="text-brand-purple font-medium hover:underline"
                  >
                    S&apos;inscrire
                  </button>
                </div>
              )}

              {authView === 'sign_up' && (
                <div className="mt-4 text-center text-sm text-gray-600">
                  Vous avez déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthView('sign_in')}
                    className="text-brand-purple font-medium hover:underline"
                  >
                    Se connecter
                  </button>
                </div>
              )}

              {authView === 'forgotten_password' && (
                <div className="mt-4 text-center text-sm text-gray-600">
                  <button
                    type="button"
                    onClick={() => setAuthView('sign_in')}
                    className="text-brand-purple font-medium hover:underline"
                  >
                    Retour à la connexion
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}