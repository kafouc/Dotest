/**
 * Utilitaires pour les documents
 */

import { DOCUMENT_STATUS } from './constants';
import type { DocumentInfo } from './types';

export type DocumentStatusInfo = {
  text: string;
  className: string;
};

/**
 * Retourne les informations de statut d'un document (texte et classes CSS)
 */
export function getDocumentStatusInfo(status: DocumentInfo['status']): DocumentStatusInfo {
  switch (status) {
    case DOCUMENT_STATUS.PENDING:
    case DOCUMENT_STATUS.PROCESSING:
      return {
        text: 'Analyse... ⏳',
        className: 'bg-yellow-100 text-yellow-700 animate-pulse',
      };
    case DOCUMENT_STATUS.FAILED:
      return {
        text: 'Échec ❌',
        className: 'bg-red-100 text-red-700',
      };
    case DOCUMENT_STATUS.COMPLETED:
    default:
      return {
        text: 'Prêt ✅',
        className: 'bg-green-100 text-green-700',
      };
  }
}

