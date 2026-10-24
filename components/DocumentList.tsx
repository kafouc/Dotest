'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentInfo } from '@/lib/types';
import { DOCUMENT_STATUS } from '@/lib/constants';
import { FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import EmptyState from './ui/EmptyState';

// Props reçues de page.tsx
type DocumentListProps = {
  supabase: SupabaseClient;
  documents: DocumentInfo[];
  isLoading: boolean;
  onDeleteSuccess: () => void; // Fonction pour rafraîchir la liste
  onSelectDocument?: (documentId: string) => void; // Fonction optionnelle pour sélectionner un document
};

export default function DocumentList(props: DocumentListProps) {
  const { documents, isLoading, onSelectDocument } = props;

  // Suppression déplacée côté pages; la liste n’appelle plus directement la suppression

  return (
    <div>
      {isLoading && (
        <p className="text-gray-600 text-sm">Chargement des documents...</p>
      )}

      {!isLoading && documents.length === 0 && (
        <EmptyState
          title="Aucun document"
          description="Commencez par téléverser un PDF pour générer des quiz."
          icon={
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      )}

      {!isLoading && documents.length > 0 && (
        <ul className="space-y-1">
          {documents.map((doc) => {
            const docId = doc.path || doc.name;

            // Déterminer l'icône selon le statut
            const getStatusIcon = () => {
              if (doc.status === DOCUMENT_STATUS.PENDING || doc.status === DOCUMENT_STATUS.PROCESSING) {
                return <FaSpinner className="w-4 h-4 text-yellow-600 animate-spin" title="En cours d'analyse" />;
              }
              if (doc.status === DOCUMENT_STATUS.FAILED) {
                return <FaTimesCircle className="w-4 h-4 text-red-600" title="Échec" />;
              }
              return <FaCheckCircle className="w-4 h-4 text-green-600" title="Prêt" />;
            };

            return (
              <li
                key={docId}
                className={`flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 transition-all duration-200 cursor-pointer`}
                onClick={() => onSelectDocument && onSelectDocument(docId)}
                title={doc.status_message || doc.name}
              >
                {getStatusIcon()}
                <span
                  className="text-sm font-medium text-brand-dark truncate flex-1"
                  title={doc.name}
                >
                  {doc.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
