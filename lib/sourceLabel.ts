import type { QuizSource } from '@/lib/quiz.types';

/** Libellé de pages : « Page 4 », « Pages 4-6 » ou null si aucune page connue. */
export function formatPages(pageStart: number | null | undefined, pageEnd: number | null | undefined): string | null {
  const start = pageStart ?? pageEnd;
  const end = pageEnd ?? pageStart;
  if (!start) return null;
  return end && end !== start ? `Pages ${start}-${end}` : `Page ${start}`;
}

export function formatSource(source: QuizSource | null | undefined): string | null {
  return source ? formatPages(source.pageStart, source.pageEnd) : null;
}
