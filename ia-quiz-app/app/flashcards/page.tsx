'use client';

import { useEffect, useState } from 'react';
import FlashcardStudy from '@/components/FlashcardStudy';
import { useSearchParams, useRouter } from 'next/navigation';

export default function FlashcardsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialDoc = searchParams.get('document') || '';
  const [documentPath, setDocumentPath] = useState(initialDoc);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // keep URL in sync (shallow)
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (documentPath) {
      params.set('document', documentPath);
    } else {
      params.delete('document');
    }
    router.replace(`/flashcards?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPath]);

  const onGenerate = async () => {
    if (!documentPath) {
      setMessage('Veuillez saisir le chemin du document (document_sections.document_path)');
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Echec de génération');
      setMessage(`Cartes générées: ${data.inserted ?? 0}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setMessage(`Erreur: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-brand-purple-dark mb-4">Flashcards</h1>

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par document (optionnel)</label>
        <input
          type="text"
          value={documentPath}
          onChange={(e) => setDocumentPath(e.target.value)}
          placeholder="ex: documents/mon-fichier.pdf"
          className="w-full border rounded-md px-3 py-2"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-4 py-2 bg-brand-purple text-white rounded-md hover:bg-brand-purple-dark disabled:opacity-60"
          >
            {generating ? 'Génération…' : 'Générer des cartes depuis ce document'}
          </button>
          {message && <span className="text-sm text-gray-700">{message}</span>}
        </div>
      </div>

      <FlashcardStudy documentPath={documentPath || undefined} />
    </div>
  );
}
