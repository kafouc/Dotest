import { describe, it, expect } from 'vitest';
import { createChunks, chunkText } from '@/lib/chunking';

const words = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');

describe('createChunks', () => {
  it('ne dépasse jamais la taille demandée et ne coupe pas les mots', () => {
    const chunks = chunkText(words(2000), 1000, 200);
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000);
      expect(chunk).toMatch(/^mot\d+/);
      expect(chunk).toMatch(/mot\d+$/);
    }
  });

  it('assure un recouvrement entre segments consécutifs', () => {
    const chunks = chunkText(words(1500), 1000, 200);
    for (let i = 1; i < chunks.length; i++) {
      const firstWordOfNext = chunks[i].split(' ')[0];
      expect(chunks[i - 1]).toContain(firstWordOfNext);
    }
  });

  it('préfère couper à une fin de paragraphe', () => {
    const paragraph = (c: string) => `${c.repeat(450)}.`;
    const chunks = chunkText(`${paragraph('a')}\n\n${paragraph('b')}\n\n${paragraph('c')}`, 700, 0);
    expect(chunks[0]).toMatch(/^a+\.$/);
  });

  it('mémorise les pages couvertes par chaque segment', () => {
    const segments = [
      { text: 'a '.repeat(300), page: 1 },
      { text: 'b '.repeat(300), page: 2 },
      { text: 'c '.repeat(300), page: 3 },
    ];
    const chunks = createChunks(segments, 500, 50);
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 1 });
    expect(chunks[chunks.length - 1]).toMatchObject({ pageEnd: 3 });
    expect(chunks.some((c) => c.pageStart !== c.pageEnd)).toBe(true);
  });

  it('renvoie des pages nulles pour un texte sans page', () => {
    expect(createChunks([{ text: 'bonjour le monde', page: null }], 100, 10)).toEqual([
      { content: 'bonjour le monde', pageStart: null, pageEnd: null },
    ]);
  });

  it('supporte un très gros segment unique sans erreur de pile', () => {
    const big = 'lorem ipsum dolor sit amet '.repeat(100_000);
    const chunks = createChunks([{ text: big, page: 1 }], 1000, 200);
    expect(chunks.length).toBeGreaterThan(1000);
  });

  it('gère les entrées vides et les mots plus longs que la fenêtre', () => {
    expect(createChunks([], 100, 10)).toEqual([]);
    expect(createChunks([{ text: '   ', page: 1 }], 100, 10)).toEqual([]);
    const chunks = chunkText('x'.repeat(2500), 1000, 100);
    expect(chunks.join('').length).toBeGreaterThanOrEqual(2500);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });

  it('refuse un recouvrement supérieur à la taille', () => {
    expect(() => createChunks([{ text: 'abc', page: null }], 10, 10)).toThrow();
  });
});
