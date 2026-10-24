'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaTrash, FaRedo } from 'react-icons/fa';
import dynamic from 'next/dynamic';
import { DOCUMENT_STATUS } from '@/lib/constants';
import type { DocumentInfo } from '@/lib/types';

// Blocs lourds (générateur de quiz, exports, fiche de révision) chargés à la demande : la page d'accueil de l'application reste légère
function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="h-40 animate-pulse rounded-lg bg-gray-100" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
const ProgressTracker = dynamic(() => import('@/components/ProgressTracker'), { loading: () => <PanelSkeleton label="Chargement du suivi" /> });
const QuizGenerator = dynamic(() => import('@/components/QuizGenerator'), { loading: () => <PanelSkeleton label="Chargement du générateur de quiz" /> });
const RevisionSheet = dynamic(() => import('@/components/RevisionSheet'), { loading: () => <PanelSkeleton label="Chargement de la fiche de révision" /> });

type Props = {
  supabase: SupabaseClient;
  document: DocumentInfo;
  documents: DocumentInfo[];
  isLoadingDocs: boolean;
  deletingPath: string | null;
  onDelete: (documentPath: string) => void;
  onRetry: (doc: DocumentInfo) => void;
  onActivity: () => void;
};

function isProcessing(status: DocumentInfo['status']) {
  return status === DOCUMENT_STATUS.PENDING || status === DOCUMENT_STATUS.PROCESSING;
}

function StatusIcon({ status }: { status: DocumentInfo['status'] }) {
  if (isProcessing(status)) return <FaSpinner className="w-5 h-5 text-yellow-600 animate-spin" aria-hidden="true" />;
  if (status === DOCUMENT_STATUS.FAILED) return <FaTimesCircle className="w-5 h-5 text-red-600" aria-hidden="true" />;
  return <FaCheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />;
}

function statusText(status: DocumentInfo['status']) {
  if (isProcessing(status)) return "En cours d'analyse";
  if (status === DOCUMENT_STATUS.FAILED) return 'Échec';
  return 'Prêt';
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** En-tête du document actif (statut, suppression) et outils : suivi, quiz, fiche de révision. */
export default function ActiveDocument({ supabase, document: doc, documents, isLoadingDocs, deletingPath, onDelete, onRetry, onActivity }: Props) {
  const isDeleting = deletingPath === doc.path;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-heading font-bold text-brand-dark">{doc.name}</h2>
              <StatusIcon status={doc.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <span className="font-medium">Statut:</span>
                <span>{statusText(doc.status)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">Déposé le:</span>
                <span>{formatDate(doc.created_at)}</span>
              </span>
            </div>
            {doc.status === DOCUMENT_STATUS.FAILED && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {doc.status_message || "L'analyse de ce document a échoué."}
              </p>
            )}
          </div>
          {doc.status === DOCUMENT_STATUS.FAILED && (
            <button
              onClick={() => onRetry(doc)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-colors"
              title="Relancer l'analyse du document"
            >
              <FaRedo className="w-4 h-4" aria-hidden="true" />
              <span>Relancer l&apos;analyse</span>
            </button>
          )}
          <button
            onClick={() => onDelete(doc.path)}
            disabled={isDeleting || deletingPath !== null}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Supprimer le document"
          >
            <FaTrash className="w-4 h-4" aria-hidden="true" />
            <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <ProgressTracker key={doc.path} supabase={supabase} documentPath={doc.path} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6">
            <QuizGenerator
              key={doc.path}
              documents={documents}
              isLoading={isLoadingDocs}
              activeDocumentPath={doc.path}
              onActivity={onActivity}
            />
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <RevisionSheet documentPath={doc.path} onActivity={onActivity} />
          </div>
        </div>
      </div>
    </div>
  );
}
