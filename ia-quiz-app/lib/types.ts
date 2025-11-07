export type DocumentInfo = {
  name: string;
  path: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_message?: string;
};
