"use client";

import { useState, useEffect, useCallback } from 'react';
// Auth et ThemeSupa ne sont plus nécessaires ici
import type { Session } from '@supabase/supabase-js'; 
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'; 

// Importe les composants
import UploadForm from '../components/UploadForm';
import QuizGenerator from '../components/QuizGenerator';
import DocumentList from '../components/DocumentList';
import ProgressTracker from '../components/ProgressTracker';
import LoadingScreen from '../components/LoadingScreen'; 
import WelcomeScreen from '../components/WelcomeScreen'; // <-- Le composant qui gère l'auth

import { motion, AnimatePresence } from 'framer-motion'; 

// Type partagé
export type DocumentInfo = {
  name: string; path: string; created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_message?: string;
};

// --- DÉFINITION DES TRADUCTIONS ICI ---
const authLocalization = {
  variables: {
    sign_in: { 
      email_label: 'Adresse email', 
      password_label: 'Mot de passe', 
      button_label: 'Se connecter', 
      link_text: "Vous n'avez pas de compte ? S'inscrire", // <-- Traduction
      loading_button_label: 'Chargement...'
    },
    sign_up: { 
      email_label: 'Adresse email', 
      password_label: 'Mot de passe', 
      button_label: "S'inscrire", 
      link_text: 'Vous avez déjà un compte ? Se connecter', // <-- Traduction
      loading_button_label: 'Chargement...'
    },
    forgotten_password: { 
      email_label: 'Adresse email', 
      email_input_placeholder: 'Votre adresse email', 
      button_label: 'Envoyer les instructions', 
      link_text: 'Retour à la connexion',
      loading_button_label: 'Chargement...'
    },
    magic_link: {
      empty_email_address: 'Veuillez entrer une adresse email'
    }
  }
};
// --- FIN DES TRADUCTIONS ---


export default function Home() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // ... (Toute votre logique fetchDocuments et useEffects reste inchangée) ...
  const fetchDocuments = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoadingDocs(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { if (isInitialLoad) setIsLoadingDocs(false); return; }
    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('file_name, file_path, created_at, status, status_message')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (fetchError) console.error("Erreur chargement DB:", fetchError);
    else if (docs) {
      const documentList = docs.map(doc => ({
        name: doc.file_name, path: doc.file_path, created_at: doc.created_at,
        status: doc.status as DocumentInfo['status'], status_message: doc.status_message,
      }));
      setDocuments(documentList);
    } else setDocuments([]);
    if (isInitialLoad) setIsLoadingDocs(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => { setIsAppLoading(false); }, 5000); 
    return () => clearTimeout(timer);
  }, []); 

  useEffect(() => {
    if (session) fetchDocuments(true); 
  }, [session, fetchDocuments]);

  useEffect(() => {
    const isProcessing = documents.some(doc => doc.status === 'pending' || doc.status === 'processing');
    if (isProcessing) {
      const interval = setInterval(() => { fetchDocuments(false); }, 5000); 
      return () => clearInterval(interval);
    }
  }, [documents, fetchDocuments]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- Rendu Conditionnel (Loader -> App) ---
  return (
    <AnimatePresence mode="wait">
      {isAppLoading ? (
        <LoadingScreen key="loader" />
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          {!session ? (
            // --- 1. AFFICHAGE SI NON CONNECTÉ (Corrigé) ---
            <div className="flex justify-center items-center min-h-screen p-4">
              {/* On passe les traductions en prop ici */}
              <WelcomeScreen supabase={supabase} localization={authLocalization} />
            </div>
          ) : (
            // --- 2. AFFICHAGE SI CONNECTÉ (Tableau de Bord) ---
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="container mx-auto p-4 md:p-8 max-w-6xl mt-8 mb-8 bg-white/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/50"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-300">
                <div className="mb-4 md:mb-0">
                  <h1 className="text-3xl font-bold text-brand-purple-dark">Tableau de Bord</h1>
                  <p className="text-gray-600 mt-1">{session.user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 cursor-pointer bg-brand-pink hover:bg-brand-pink-dark text-white font-semibold rounded-md shadow-sm transition-colors duration-200"
                >
                  Se déconnecter
                </button>
              </div>

              {/* Disposition en grille */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Colonne de Gauche (Sidebar) */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="lg:col-span-1 p-6 bg-purple-50/50 rounded-lg shadow-inner border border-purple-100 space-y-6"
                >
                  <DocumentList 
                    supabase={supabase} 
                    documents={documents} 
                    isLoading={isLoadingDocs}
                    onDeleteSuccess={() => fetchDocuments(false)} 
                  />
                  <ProgressTracker supabase={supabase} />
                </motion.div>

                {/* Colonne de Droite (Contenu) */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="lg:col-span-2 space-y-8"
                >
                  <UploadForm 
                    session={session} 
                    supabase={supabase} 
                    onUploadSuccess={() => fetchDocuments(false)} 
                  />
                  <QuizGenerator documents={documents} isLoading={isLoadingDocs} />
                </motion.div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}