"use client";

import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';

// --- Configuration de l'Animation (traduit de votre SCSS) ---
const animationTime = 45; // 45s
const numberOfRainbows = 25;
const colors = {
  purple: 'rgb(232 121 249)',
  blue: 'rgb(96 165 250)',
  green: 'rgb(94 234 212)',
};

// Fonction pour mélanger les couleurs (simule le random())
const getRandomColors = () => {
  const colorArray = [colors.purple, colors.blue, colors.green];
  for (let i = colorArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorArray[i], colorArray[j]] = [colorArray[j], colorArray[i]];
  }
  return colorArray;
};
// --- Fin Configuration Animation ---

// Props du composant
type WelcomeScreenProps = {
  supabase: SupabaseClient;
  localization: { [key: string]: unknown }; 
};

export default function WelcomeScreen({ supabase, localization }: WelcomeScreenProps) {
  // 'welcome' = page d'accueil, 'sign_in' | 'sign_up' = formulaire
  const [authView, setAuthView] = useState<'welcome' | 'sign_in' | 'sign_up'>('welcome');

  return (
    // Ce conteneur "fragment" (<>) permet d'avoir deux éléments frères :
    // 1. L'arrière-plan (en plein écran)
    // 2. Le contenu (centré)
    <>
      {/* --- FOND ANIMÉ (Plein écran) --- */}
      <AnimatePresence>
        {authView === 'welcome' && ( // Ne s'affiche que sur la vue 'welcome'
          <motion.div 
            // CORRECTION: 'fixed inset-0' force le plein écran
            // 'z-0' le place en arrière-plan
            className="welcome-background fixed inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            {/* Recrée la boucle SCSS en JavaScript */}
            {Array.from({ length: numberOfRainbows }).map((_, i) => {
              const [color1, color2, color3] = getRandomColors();
              const delay = -((i / numberOfRainbows) * animationTime);
              const duration = (animationTime - (animationTime / numberOfRainbows / 2) * i);

              return (
                <div
                  key={i}
                  className="rainbow" // Style de globals.css
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
            {/* Vignettes blanches (CSS de globals.css) */}
            <div className="h-vignette"></div>
            <div className="v-vignette"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CONTENU CENTRÉ (Au-dessus du fond) --- */}
      {/* Ce 'div' est celui qui est centré par 'page.tsx'.
        'relative z-10' le place au-dessus du fond animé.
      */}
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
                Transformez vos notes de cours en quiz interactifs grâce à l&apos;IA.
              </p>
              
              <button
                onClick={() => setAuthView('sign_in')}
                className="w-full px-6 py-3 mb-4 cursor-pointer bg-brand-purple hover:bg-brand-purple-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
              >
                Se connecter
              </button>
              
              <button
                onClick={() => setAuthView('sign_up')}
                className="w-full px-6 py-3 cursor-pointer bg-brand-pink hover:bg-brand-pink-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
              >
                S'inscrire
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
                onClick={() => setAuthView('welcome')}
                className="mb-4 text-sm text-brand-purple hover:underline"
              >
                &larr; Revenir
              </button>
              
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={['github', 'google']}
                view={authView} 
                localization={localization as any} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}