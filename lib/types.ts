export type DocumentInfo = {
  /** Identifiant en base (absent des listes construites localement) */
  id?: number;
  name: string;
  path: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_message?: string;
};
