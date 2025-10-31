"use client";

import { useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

// Props reçues de page.tsx
type UploadFormProps = {
  session: Session;
  supabase: SupabaseClient;
  onUploadSuccess: () => void; // Fonction pour rafraîchir la liste parente
};

export default function UploadForm({ session, supabase, onUploadSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- CONTRAINTES ---
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
  const MAX_PAGES = 20; // 20 pages max
  // --- FIN CONTRAINTES ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      // Vérification 1: Taille (2 Mo)
      if (file.size > MAX_FILE_SIZE) { 
         setError(`Erreur : Le fichier est trop volumineux. Limite: ${MAX_FILE_SIZE / 1024 / 1024} Mo.`);
         setMessage(''); setFile(null); return;
      }

      // Vérification 2: Type
      if (file.type !== 'application/pdf') {
        setError('Seuls les fichiers PDF sont acceptés.');
        setFile(null);
        e.target.value = '';
        return;
      }
      
      setFile(file);
      setError(null); setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier PDF.'); return;
    }
    setUploading(true);
    setError(null);
    setMessage('1. Téléversement du fichier...');

    try {
      const userId = session.user.id;
      const filePath = `${userId}/${Date.now()}-${file.name}`; // Le chemin complet

      // 1: Upload vers Storage
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      
      setMessage('2. Enregistrement de la tâche...');

      // 2: Insérer la tâche dans la table 'documents'
      const { data: insertData, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_path: filePath,
          file_name: file.name,
          status: 'pending', 
        }).select('id').single();
      if (insertError) throw new Error(`Erreur DB: ${insertError.message}`);
      
      // 3: Déclencher la fonction Edge
      const triggerResponse = await fetch('/api/process-pdf', {
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ filePath: filePath, documentId: insertData.id }),
      });
      if (!triggerResponse.ok) {
          throw new Error("Erreur lors du déclenchement de l'analyse.");
      }

      // Correction ESLint: Remplacement de ' par &apos;
      setMessage(`Succès ! L&apos;analyse de "${file.name}" a commencé. Limite: ${MAX_PAGES} pages.`);
      setFile(null); 
      
      // APPELLE LE PARENT POUR RAFRAÎCHIR LA LISTE
      onUploadSuccess(); 

    } catch (err: unknown) { 
      console.error("Erreur UploadForm:", err);
      const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
      setError(errorMessage);
      setMessage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-brand-purple-dark">Téléverser un Cours (PDF)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Limite : {MAX_FILE_SIZE / 1024 / 1024} Mo et {MAX_PAGES} pages. L&apos;analyse est effectuée en arrière-plan.
      </p>

      <div className="flex items-center space-x-4">
        <label
          htmlFor="file-upload"
          className={`px-4 py-2 cursor-pointer text-white font-semibold rounded-md shadow-sm transition-colors
                      ${uploading ? 'bg-gray-400' : 'bg-brand-purple hover:bg-brand-purple-dark'}`}
        >
          {file ? 'Fichier choisi' : 'Choisir un fichier'}
        </label>
        <input
          type="file" accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          id="file-upload"
          className="hidden"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="px-4 py-2 cursor-pointer bg-brand-pink hover:bg-brand-pink-dark text-white font-semibold rounded-md shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Téléversement...' : 'Téléverser et Analyser'}
        </button>
      </div>

      <div className="mt-4 text-sm min-h-[2em]">
        {file && !message && !error && (
          <p className="text-gray-600">Fichier sélectionné : {file.name}</p>
        )}
        {error && <p className="p-2 bg-red-100 text-red-700 rounded-md">{error}</p>}
        {message && <p className="p-2 bg-green-100 text-green-700 rounded-md">{message}</p>}
      </div>
    </div>
  );
}