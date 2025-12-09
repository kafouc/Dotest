"use client";

import type { DocumentInfo } from '@/lib/types';

type DocumentTabsProps = {
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onCloseDocument: (documentId: string, e: React.MouseEvent) => void;
  onCreateNew: () => void;
  openDocumentIds: Set<string>;
};

export default function DocumentTabs({
  documents,
  activeDocumentId,
  onSelectDocument,
  onCloseDocument,
  onCreateNew,
  openDocumentIds,
}: DocumentTabsProps) {
  return (
    <div className="bg-white border-b border-gray-200 flex items-center overflow-x-auto">
      {/* Bouton nouveau document */}
      <button
        onClick={onCreateNew}
        className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-600 hover:bg-gray-100 border-r border-gray-200 flex items-center gap-2 whitespace-nowrap min-h-[40px]"
        title="Nouveau document"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Nouveau</span>
      </button>

      {/* Onglets des documents */}
      <div className="flex items-center flex-1 overflow-x-auto">
        {documents
          .filter((doc) => {
            const docId = doc.path || doc.name;
            return openDocumentIds.has(docId);
          })
          .map((doc) => {
            const docId = doc.path || doc.name;
            const isActive = activeDocumentId === docId;
          
          return (
            <div
              key={docId}
              className={`group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-r border-gray-200 cursor-pointer transition-colors whitespace-nowrap min-h-[40px] ${
                isActive
                  ? 'bg-white text-brand-dark border-b-2 border-brand-yellow'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => onSelectDocument(docId)}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-sm truncate max-w-[160px] sm:max-w-[200px]">{doc.name}</span>
              <button
                onClick={(e) => onCloseDocument(docId, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                aria-label="Fermer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

