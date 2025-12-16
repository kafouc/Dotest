import type { SupabaseClient } from '@supabase/supabase-js';

type ExportKind = 'challenge_share' | 'quiz_export' | 'summary_export' | 'live_recap_export' | 'excel_export';

export async function logExportEvent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    kind: ExportKind;
    context?: string | null;
    documentPath?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from('export_events').insert({
    user_id: params.userId,
    kind: params.kind,
    context: params.context ?? null,
    document_path: params.documentPath ?? null,
  });

  if (error) {
    console.warn('[exportEvents] logExportEvent failed:', error);
  }
}

export async function countExportEvents(
  supabase: SupabaseClient,
  params: {
    userId: string;
    kind: ExportKind;
    since?: string;
    documentPath?: string | null;
  }
): Promise<number> {
  let query = supabase
    .from('export_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)
    .eq('kind', params.kind);

  if (params.since) {
    query = query.gte('created_at', params.since);
  }
  if (params.documentPath) {
    query = query.eq('document_path', params.documentPath);
  }

  const { count, error } = await query;
  if (error) {
    console.warn('[exportEvents] countExportEvents failed:', error);
    return 0;
  }
  return count ?? 0;
}
