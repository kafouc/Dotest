'use client';

import { useCallback, useState, useTransition } from 'react';
import type { DocumentInfo } from '@/lib/types';

/** Onglets de documents ouverts, document actif et affichage du formulaire d'import. */
export function useDocumentTabs(refresh: (isInitialLoad?: boolean) => Promise<DocumentInfo[]>) {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [openDocumentIds, setOpenDocumentIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const createNew = useCallback(() => {
    setShowUploadForm(true);
    setActiveDocumentId(null);
  }, []);

  const selectDocument = useCallback(
    (documentId: string) => {
      startTransition(() => {
        setActiveDocumentId(documentId);
        setShowUploadForm(false);
        setOpenDocumentIds((prev) => new Set(prev).add(documentId));
      });
      void refresh(false);
    },
    [refresh]
  );

  const closeDocument = useCallback(
    (documentId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const remaining = Array.from(openDocumentIds).filter((id) => id !== documentId);
      setOpenDocumentIds(new Set(remaining));
      if (activeDocumentId === documentId) {
        setActiveDocumentId(remaining[0] ?? null);
        if (remaining.length === 0) setShowUploadForm(false);
      }
      void refresh(false);
    },
    [openDocumentIds, activeDocumentId, refresh]
  );

  /** Après un import réussi : ouvre le document le plus récent. */
  const afterUpload = useCallback(async () => {
    setShowUploadForm(false);
    const refreshed = await refresh(false);
    const docId = refreshed[0]?.path || refreshed[0]?.name;
    if (!docId) return;
    setActiveDocumentId(docId);
    setOpenDocumentIds((prev) => new Set(prev).add(docId));
  }, [refresh]);

  /** Après une suppression : retire l'onglet et bascule sur un autre document ouvert. */
  const afterDelete = useCallback(
    (documentPath: string) => {
      const remaining = Array.from(openDocumentIds).filter((id) => id !== documentPath);
      setOpenDocumentIds(new Set(remaining));
      if (activeDocumentId === documentPath) setActiveDocumentId(remaining[0] ?? null);
    },
    [openDocumentIds, activeDocumentId]
  );

  return {
    activeDocumentId,
    openDocumentIds,
    showUploadForm,
    createNew,
    selectDocument,
    closeDocument,
    afterUpload,
    afterDelete,
  };
}
