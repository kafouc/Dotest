'use client';

import { useState, useEffect, useCallback } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

import UploadForm from '../components/UploadForm';
import QuizGenerator from '../components/QuizGenerator';
import DocumentList from '../components/DocumentList';
import ProgressTracker from '../components/ProgressTracker';

import { motion } from 'framer-motion';

// Type partagé pour les documents (utilisé par page, DocumentList, et QuizGenerator)
export type DocumentInfo = {
  name: string;
  path: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_message?: string;
};

export default function Home() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);

  // État centralisé pour les documents
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Fonction pour récupérer les documents
  const fetchDocuments = useCallback(
    async (isInitialLoad = false) => {
      if (isInitialLoad) setIsLoadingDocs(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (isInitialLoad) setIsLoadingDocs(false);
        return;
      }

      const { data: docs, error: fetchError } = await supabase
        .from('documents')
        .select('file_name, file_path, created_at, status, status_message')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        // Handle error silently or log to a service in production
      } else if (docs) {
        const documentList = docs.map((doc) => ({
          name: doc.file_name,
          path: doc.file_path,
          created_at: doc.created_at,
          status: doc.status as DocumentInfo['status'],
          status_message: doc.status_message,
        }));
        setDocuments(documentList);
      } else {
        setDocuments([]);
      }

      if (isInitialLoad) setIsLoadingDocs(false);
    },
    [supabase]
  ); // Dépend de supabase

  // Effet 1 : Chargement Initial (quand la session change)
  useEffect(() => {
    if (session) {
      fetchDocuments(true);
    }
  }, [session, fetchDocuments]);

  // Effet 2 : Polling (Vérification du statut)
  useEffect(() => {
    const isProcessing = documents.some(
      (doc) => doc.status === 'pending' || doc.status === 'processing'
    );

    if (isProcessing) {
      // S'il y a un document en cours, on revérifie dans 5 secondes
      const interval = setInterval(() => {
        fetchDocuments(false); // Récupère la liste à jour
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [documents, fetchDocuments]); // Se re-déclenche si 'documents' change

  // Gestion de la session (Authentification)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fonction de déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- 1. AFFICHAGE SI NON CONNECTÉ ---
  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/50"
        >
          <h2 className="text-2xl font-bold text-center text-brand-purple-dark mb-6">
            Connexion
          </h2>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['github', 'google']}
            localization={{
              variables: {
                // --- CORRECTION FINALE ICI ---
                sign_in: {
                  email_label: 'Adresse email',
                  password_label: 'Mot de passe',
                  button_label: 'Se connecter',
                  link_text: "Vous n'avez pas de compte ? S'inscrire",
                },
                sign_up: {
                  email_label: 'Adresse email',
                  password_label: 'Mot de passe',
                  button_label: "S'inscrire",
                  link_text: 'Vous avez déjà un compte ? Se connecter',
                },
                forgotten_password: {
                  email_label: 'Adresse email',
                  email_input_placeholder: 'Votre adresse email',
                  button_label: 'Envoyer les instructions',
                  link_text: 'Retour à la connexion',
                },
                // --- FIN CORRECTION ---
              },
            }}
          />
        </motion.div>
      </div>
    );
  }

  // --- 2. AFFICHAGE SI CONNECTÉ (Le Tableau de Bord) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="container mx-auto p-4 md:p-8 max-w-6xl mt-8 mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-2xl border border-white/50"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-300">
        <div className="mb-4 md:mb-0">
          <h1 className="text-3xl font-bold text-brand-purple-dark">
            Tableau de Bord
          </h1>
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
  );
}
