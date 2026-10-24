import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_MODELS, EMBEDDING_CONFIG, RETRIEVAL_CONFIG } from '@/lib/constants';
import { rerankWithJina } from '@/lib/jinaClient';
import { logger } from '@/lib/logger';
import { formatPages } from '@/lib/sourceLabel';

/**
 * Recherche de passages pertinents dans les documents d'un utilisateur :
 *  1. recherche hybride en base (similarité vectorielle + mots-clés, fusion par rang RRF) ;
 *  2. reclassement par un modèle dédié (Jina) pour ne garder que les meilleurs passages.
 * Si la fonction hybride n'existe pas encore en base, on retombe sur la recherche vectorielle seule.
 */

export type Passage = {
  id: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number | null;
  rerankScore: number | null;
};

export type RetrievalMode = 'hybrid+rerank' | 'hybrid' | 'vector+rerank' | 'vector';

type Row = {
  id: number;
  content: string;
  page_start?: number | null;
  page_end?: number | null;
  similarity?: number | null;
};

export type RetrieveOptions = {
  userId: string;
  queryText: string;
  queryEmbedding: number[];
  documentPath?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  candidates?: number;
  finalCount?: number;
  rerank?: boolean;
};

export type RetrieveResult = {
  passages: Passage[];
  mode: RetrievalMode;
  rerankTokens: number;
};

const toPassage = (row: Row): Passage => ({
  id: row.id,
  content: row.content,
  pageStart: row.page_start ?? null,
  pageEnd: row.page_end ?? null,
  similarity: row.similarity ?? null,
  rerankScore: null,
});

/** Erreur « fonction inconnue » (migration pas encore appliquée) */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === '42883' || error.code === 'PGRST202' || /could not find the function|does not exist/i.test(error.message ?? '');
}

export async function retrievePassages(supabase: SupabaseClient, options: RetrieveOptions): Promise<RetrieveResult> {
  const candidates = options.candidates ?? RETRIEVAL_CONFIG.CANDIDATES;
  const finalCount = options.finalCount ?? RETRIEVAL_CONFIG.FINAL_PASSAGES;

  let rows: Row[] = [];
  let hybrid = true;

  const hybridResult = await supabase.rpc('hybrid_search_document_sections', {
    query_embedding: options.queryEmbedding,
    query_text: options.queryText,
    match_count: candidates,
    p_user_id: options.userId,
    p_document_path: options.documentPath ?? null,
    p_page_start: options.pageStart ?? null,
    p_page_end: options.pageEnd ?? null,
    vector_threshold: RETRIEVAL_CONFIG.VECTOR_THRESHOLD,
  });

  if (hybridResult.error) {
    if (!isMissingFunction(hybridResult.error)) throw new Error(hybridResult.error.message);
    logger.warn('[retrieval] recherche hybride indisponible, repli sur la recherche vectorielle');
    hybrid = false;
    const vectorResult = await supabase.rpc('match_document_sections', {
      query_embedding: options.queryEmbedding,
      match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
      match_count: candidates,
      p_user_id: options.userId,
      p_document_path: options.documentPath ?? null,
      p_page_start: options.pageStart ?? null,
      p_page_end: options.pageEnd ?? null,
    });
    if (vectorResult.error) throw new Error(vectorResult.error.message);
    rows = (vectorResult.data as Row[]) ?? [];
  } else {
    rows = (hybridResult.data as Row[]) ?? [];
  }

  let passages = rows.map(toPassage);
  let rerankTokens = 0;
  let reranked = false;

  if ((options.rerank ?? true) && passages.length > finalCount) {
    const result = await rerankWithJina(options.queryText, passages.map((p) => p.content), AI_MODELS.RERANKER, finalCount);
    if (result) {
      passages = result.ranking.map(({ index, score }) => ({ ...passages[index], rerankScore: score }));
      rerankTokens = result.totalTokens;
      reranked = true;
    }
  }

  passages = passages.slice(0, finalCount);
  const mode: RetrievalMode = `${hybrid ? 'hybrid' : 'vector'}${reranked ? '+rerank' : ''}` as RetrievalMode;
  return { passages, mode, rerankTokens };
}

/** Contexte numéroté pour le prompt : « [2] (Pages 4-6) » suivi du texte. */
export function buildNumberedContext(passages: Passage[], maxChars?: number): string {
  const text = passages
    .map((p, i) => {
      const label = formatPages(p.pageStart, p.pageEnd);
      return `[${i + 1}]${label ? ` (${label})` : ''}\n${p.content}`;
    })
    .join('\n\n---\n\n');
  return maxChars ? text.slice(0, maxChars) : text;
}

/** Pages couvertes par un ensemble de passages, fusionnées et triées : « 3-4, 7, 12-15 ». Vide si aucune page connue. */
export function summarizePages(passages: Passage[]): string {
  const ranges = passages
    .filter((p) => p.pageStart ?? p.pageEnd)
    .map((p) => [p.pageStart ?? (p.pageEnd as number), p.pageEnd ?? (p.pageStart as number)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(', ');
}
