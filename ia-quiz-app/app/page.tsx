"use client";

import { useState, useEffect, useCallback } from 'react'; // Importez useCallback
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'; 

import UploadForm from '../components/UploadForm';
import QuizGenerator from '../components/QuizGenerator';
import DocumentList from '../components/DocumentList';
import ProgressTracker from '../components/ProgressTracker';

import { motion } from 'framer-motion';

// On définit le type de Document au niveau de la page
type DocumentInfo = {
  name: string;
  path: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_message?: string;
};

export default function Home() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);

  // --- L'ÉTAT DES DOCUMENTS EST MAINTENANT ICI ---
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // --- LA FONCTION DE RÉCUPÉRATION EST ICI ---
  const fetchDocuments = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoadingDocs(true);

    const { data: { user } } = await supabase.auth.getUser();
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
      console.error("Erreur chargement DB:", fetchError);
      // On pourrait mettre une erreur globale ici
    } else if (docs) {
      const documentList = docs.map(doc => ({
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
  }, [supabase]); // Dépend de supabase

  // --- Effet 1 : Chargement Initial (quand la session change) ---
  useEffect(() => {
    if (session) {
      fetchDocuments(true); // Fait le premier chargement
    }
  }, [session, fetchDocuments]);

  // --- Effet 2 : Logique de Polling (quand 'documents' change) ---
  useEffect(() => {
    const isProcessing = documents.some(
      doc => doc.status === 'pending' || doc.status === 'processing'
    );

    if (isProcessing) {
      // S'il y a un document en cours, on revérifie dans 5 secondes
      const interval = setInterval(() => {
        console.log("Polling: Vérification du statut des documents...");
        fetchDocuments(false); // Récupère la liste à jour
      }, 5000); 

      return () => clearInterval(interval);
    }
  }, [documents, fetchDocuments]); // Se re-déclenche si 'documents' change

  // --- GESTION DE LA SESSION (Inchangé) ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- Rendu JSX ---

  if (!session) {
    return (
      // ... (Code du formulaire de connexion, inchangé)
      <div className="flex justify-center items-center min-h-screen p-4">
         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.5 }}
           className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/50"
         >
           <h2 className="text-2xl font-bold text-center text-brand-purple-dark mb-6">Connexion</h2>
           <Auth
             supabaseClient={supabase}
             appearance={{ theme: ThemeSupa }}
             providers={['github', 'google']}
             localization={{ /* ... vos traductions ... */ }}
           />
         </motion.div>
       </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="container mx-auto p-4 md:p-8 max-w-6xl mt-8 mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-2xl border border-white/50"
    >
      {/* Header (inchangé) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-300">
        <div>
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

      {/* Disposition en grille (inchangée) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* --- Colonne de Gauche (Sidebar) --- */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-1 p-6 bg-purple-50/50 rounded-lg shadow-inner border border-purple-100 space-y-6"
        >
          {/* On passe les documents et le client en props */}
          <DocumentList 
            supabase={supabase} 
            documents={documents} 
            isLoading={isLoadingDocs}
            onDeleteSuccess={() => fetchDocuments(false)} // Permet de rafraîchir après suppression
          />
          <ProgressTracker supabase={supabase} />
        </motion.div>

        {/* --- Colonne de Droite (Contenu) --- */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="lg:col-span-2 space-y-8"
        >
          {/* On passe la fonction de rafraîchissement en prop */}
          <UploadForm 
            session={session} 
            supabase={supabase} 
            onUploadSuccess={() => fetchDocuments(false)} // L'action qui manquait !
          />
          {/* On passe les documents en prop */}
          <QuizGenerator documents={documents} isLoading={isLoadingDocs} />
        </motion.div>
      </div>
      
    </motion.div>
  );
}