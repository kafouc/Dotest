'use client';

import { useState } from 'react'; // <-- LIGNE CORRIGÉE
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentInfo } from '../app/page'; // Importe le type partagé

// Props reçues de page.tsx
type DocumentListProps = {
  supabase: SupabaseClient;
  documents: DocumentInfo[];
  isLoading: boolean;
  onDeleteSuccess: () => void; // Fonction pour rafraîchir la liste
};

export default function DocumentList({
  supabase,
  documents,
  isLoading,
  onDeleteSuccess,
}: DocumentListProps) {
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // La logique de fetch/useEffect a été déplacée vers page.tsx

  const handleDelete = async (documentPath: string) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer ce document et ses données associées ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    setDeletingPath(documentPath);
    setDeleteError(null);
    try {
      // 1. Supprimer les sections
      const { error: deleteSectionsError } = await supabase
        .from('document_sections')
        .delete()
        .eq('document_path', documentPath);
      if (deleteSectionsError) throw deleteSectionsError;

      // 2. Supprimer la ligne de la table 'documents'
      const { error: deleteDocError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', documentPath);
      if (deleteDocError) throw deleteDocError;

      // 3. Supprimer le fichier PDF du Storage
      const { error: deleteFileError } = await supabase.storage
        .from('pdfs')
        .remove([documentPath]);
      if (deleteFileError) throw deleteFileError;

      // 4. Appelle la fonction de rafraîchissement du parent
      onDeleteSuccess();
    } catch (err: unknown) {
      // <-- CORRECTION ICI (any -> unknown)
      console.error('Erreur suppression:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Une erreur inconnue est survenue.';
      setDeleteError(errorMessage);
    } finally {
      setDeletingPath(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-brand-purple-dark">
        Documents Analysés
      </h2>

      {deleteError && (
        <p className="p-3 mb-4 bg-red-100 text-red-700 rounded-md text-sm">
          {deleteError}
        </p>
      )}
      {isLoading && (
        <p className="text-gray-600 text-sm">Chargement des documents...</p>
      )}

      {!isLoading && documents.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">
          Aucun document téléversé.
        </p>
      )}

      {!isLoading && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const isDeleting = deletingPath === doc.path;

            let statusText = 'Prêt ✅';
            let statusClass = 'bg-green-100 text-green-700';
            if (doc.status === 'pending' || doc.status === 'processing') {
              statusText = 'Analyse... ⏳';
              statusClass = 'bg-yellow-100 text-yellow-700 animate-pulse';
            } else if (doc.status === 'failed') {
              statusText = 'Échec ❌';
              statusClass = 'bg-red-100 text-red-700';
            }

            return (
              <li
                key={doc.path}
                className={`flex justify-between items-center p-3 rounded-md shadow-sm border border-purple-100 
                            bg-white hover:bg-purple-50 transition-all duration-200 
                            ${isDeleting ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="flex flex-col flex-grow truncate mr-2">
                  <span
                    className="text-sm font-medium text-brand-purple-dark truncate"
                    title={doc.name}
                  >
                    {doc.name}
                  </span>
                  <span
                    className={`text-xs mt-1 px-2 py-0.5 rounded-full self-start ${statusClass}`}
                    title={doc.status_message} // Affiche l'erreur au survol
                  >
                    {statusText}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(doc.path)}
                  disabled={deletingPath !== null}
                  className={`flex items-center px-3 py-2 rounded-md text-white transition-colors flex-shrink-0
                              ${isDeleting ? 'bg-gray-400' : 'bg-brand-pink hover:bg-brand-pink-dark'}
                              disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Supprimer le document"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span className="ml-1 hidden md:inline text-sm">
                    Supprimer
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
