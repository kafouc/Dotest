'use client';

import type { DocumentInfo } from '@/lib/types';

type Props = {
  documents: DocumentInfo[];
  onCreateNew: () => void;
  onSelectDocument: (documentId: string) => void;
};

export default function WelcomePanel({ documents, onCreateNew, onSelectDocument }: Props) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center py-12">
        <h2 className="text-3xl font-heading font-bold text-brand-dark mb-4">Bienvenue sur SheetOfPaper</h2>
        <p className="text-gray-600 mb-8">
          Créez un nouveau document ou sélectionnez un document existant pour commencer
        </p>
        <button
          onClick={onCreateNew}
          className="px-6 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-colors"
        >
          Créer un nouveau document
        </button>
      </div>

      {documents.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-heading font-bold text-brand-dark mb-4">Documents récents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.slice(0, 6).map((doc) => {
              const docId = doc.path || doc.name;
              return (
                <button
                  key={docId}
                  onClick={() => onSelectDocument(docId)}
                  className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-brand-yellow hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-brand-dark truncate">{doc.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
