'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { DocumentInfo } from '@/lib/types';
import { DOCUMENT_STATUS } from '@/lib/constants';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 5000;

/**
 * Liste des documents de l'utilisateur. Tant qu'un document est en cours d'analyse,
 * la liste est rafraîchie toutes les 5 s ; sinon aucune requête n'est émise.
 */
export function useDocuments(supabase: SupabaseClient, session: Session | null) {
  const userId = session?.user?.id ?? null;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const fetchDocuments = useCallback(
    async (isInitialLoad = false): Promise<DocumentInfo[]> => {
      if (!userId) {
        setDocuments([]);
        if (isInitialLoad) setIsLoadingDocs(false);
        return [];
      }
      if (isInitialLoad) setIsLoadingDocs(true);

      const { data: docs, error } = await supabase
        .from('documents')
        .select('file_name, file_path, created_at, status, status_message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.error('Erreur chargement des documents', error);
        if (isInitialLoad) setIsLoadingDocs(false);
        return [];
      }

      const list: DocumentInfo[] =
        docs?.map((doc) => ({
          name: doc.file_name,
          path: doc.file_path,
          created_at: doc.created_at,
          status: doc.status as DocumentInfo['status'],
          status_message: doc.status_message,
        })) ?? [];

      setDocuments(list);
      if (isInitialLoad) setIsLoadingDocs(false);
      return list;
    },
    [supabase, userId]
  );

  useEffect(() => {
    if (userId) void fetchDocuments(true);
  }, [userId, fetchDocuments]);

  const hasPending = documents.some(
    (doc) => doc.status === DOCUMENT_STATUS.PENDING || doc.status === DOCUMENT_STATUS.PROCESSING
  );
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => void fetchDocuments(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPending, fetchDocuments]);

  /** Supprime sections, ligne `documents` et fichier ; la confirmation est à la charge de l'appelant. */
  const deleteDocument = useCallback(
    async (documentPath: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      setDeletingPath(documentPath);
      try {
        const { error: sectionsError } = await supabase.from('document_sections').delete().eq('document_path', documentPath);
        if (sectionsError) throw sectionsError;

        const { error: docError } = await supabase.from('documents').delete().eq('file_path', documentPath);
        if (docError) throw docError;

        const { error: fileError } = await supabase.storage.from('pdfs').remove([documentPath]);
        if (fileError) throw fileError;

        await fetchDocuments(false);
        return { ok: true };
      } catch (err: unknown) {
        logger.error('Erreur suppression du document', err instanceof Error ? err : { err: String(err) });
        const message = err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression.';
        return { ok: false, message };
      } finally {
        setDeletingPath(null);
      }
    },
    [supabase, fetchDocuments]
  );

  return { documents, isLoadingDocs, fetchDocuments, deleteDocument, deletingPath };
}
