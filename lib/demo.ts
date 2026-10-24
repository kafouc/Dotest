import { createChunks } from '@/lib/chunking';
import { SAMPLE_PAGES } from '@/lib/onboarding';
import type { Passage } from '@/lib/retrieval';

/** Essai sans compte : un mini-quiz de 3 questions généré à partir d'un texte collé, sans rien enregistrer. */

export const DEMO_QUESTION_COUNT = 3;

/** Longueur du texte accepté (caractères). Défini ici, sans dépendance serveur : la page /essai l'importe côté navigateur. */
export const DEMO_TEXT_LIMITS = { min: 200, max: 3_000 } as const;

/** Texte d'exemple proposé aux visiteurs (le même que le document d'exemple de l'application). */
export const DEMO_SAMPLE_TEXT = SAMPLE_PAGES.map((page) => page.text).join('\n\n');

/**
 * Passages envoyés au modèle. Pour le texte d'exemple, on garde le découpage par pages : les questions
 * citent alors « Page 2 », comme dans l'application. Pour un texte collé, il n'y a pas de pages.
 */
export function buildDemoPassages(text: string, isSample: boolean): Passage[] {
  const sampleMatches = isSample && text.trim() === DEMO_SAMPLE_TEXT.trim();
  const chunks = createChunks(sampleMatches ? SAMPLE_PAGES : [{ text, page: null }], 700, 100);
  return chunks.map((chunk, index) => ({
    id: index + 1,
    content: chunk.content,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    similarity: null,
    rerankScore: null,
  }));
}
