/**
 * Découpage de texte en segments pour l'indexation (RAG).
 * Coupe de préférence à une fin de paragraphe, puis de phrase, puis d'espace, plutôt qu'au milieu d'un
 * mot, et mémorise l'intervalle de pages couvert par chaque segment.
 */

export interface TextSegment {
  text: string;
  page: number | null;
}

export interface ChunkPayload {
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
}

type PageSpan = { start: number; end: number; page: number };

/** Part de la fenêtre dans laquelle on accepte de reculer pour trouver une coupure naturelle. */
const MIN_FILL_RATIO = 0.6;
const SEPARATOR = '\n\n';

function findBreak(text: string, from: number, to: number): number {
  const window = text.slice(from, to);
  const paragraph = window.lastIndexOf('\n\n');
  if (paragraph >= 0) return from + paragraph + 2;
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '), window.lastIndexOf('\n'));
  if (sentence >= 0) return from + sentence + 1;
  const space = window.lastIndexOf(' ');
  if (space >= 0) return from + space + 1;
  return -1;
}

export function createChunks(segments: TextSegment[], chunkSize: number, chunkOverlap: number): ChunkPayload[] {
  if (chunkSize <= 0) throw new Error('chunkSize doit être positif');
  if (chunkOverlap >= chunkSize) throw new Error('chunkOverlap doit être plus petit que chunkSize');

  // Texte complet + intervalle de caractères de chaque page
  const parts: string[] = [];
  const spans: PageSpan[] = [];
  let length = 0;
  for (const segment of segments) {
    const text = segment.text?.trimEnd();
    if (!text || text.trim().length === 0) continue;
    if (parts.length > 0) {
      parts.push(SEPARATOR);
      length += SEPARATOR.length;
    }
    parts.push(text);
    if (segment.page && segment.page > 0) spans.push({ start: length, end: length + text.length, page: segment.page });
    length += text.length;
  }
  const full = parts.join('');
  if (full.length === 0) return [];

  const pagesOf = (start: number, end: number) => {
    let min = Infinity;
    let max = -Infinity;
    for (const span of spans) {
      if (span.end <= start) continue;
      if (span.start >= end) break;
      min = Math.min(min, span.page);
      max = Math.max(max, span.page);
    }
    return min === Infinity ? { pageStart: null, pageEnd: null } : { pageStart: min, pageEnd: max };
  };

  const chunks: ChunkPayload[] = [];
  let start = 0;
  while (start < full.length) {
    let end = Math.min(start + chunkSize, full.length);
    if (end < full.length) {
      const earliest = start + Math.floor(chunkSize * MIN_FILL_RATIO);
      const cut = findBreak(full, earliest, end);
      if (cut > start) end = cut;
    }

    const content = full.slice(start, end).trim();
    if (content.length > 0) chunks.push({ content, ...pagesOf(start, end) });
    if (end >= full.length) break;

    // Recouvrement : on repart un peu avant la coupure, au début d'un mot, sans jamais reculer
    let next = Math.max(start + 1, end - chunkOverlap);
    if (chunkOverlap > 0) {
      const space = full.indexOf(' ', next);
      if (space >= 0 && space < end) next = space + 1;
    }
    start = next;
  }
  return chunks;
}

/** Variante pour un texte brut sans pages. */
export function chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  return createChunks([{ text, page: null }], chunkSize, chunkOverlap).map((chunk) => chunk.content);
}
