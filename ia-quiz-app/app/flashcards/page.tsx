'use client';

import { useEffect, useState } from 'react';
import FlashcardStudy from '@/components/FlashcardStudy';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

export default function FlashcardsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [documentPath, setDocumentPath] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [docs, setDocs] = useState<{ name: string; path: string }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    // Hydrate initial value from URL on client
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get('document') || '';
      if (d) setDocumentPath(d);
    } catch {}
  }, []);

  useEffect(() => {
    // Keep URL in sync (shallow)
    const q = documentPath ? `?document=${encodeURIComponent(documentPath)}` : '';
    router.replace(`/flashcards${q}`);
  }, [documentPath, router]);

  useEffect(() => {
    const loadDocs = async () => {
      setLoadingDocs(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('file_name, file_path')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setDocs(
          (data || []).map((d) => ({ name: d.file_name as string, path: d.file_path as string }))
        );
      } catch (e) {
        console.error('Load documents error:', e);
      } finally {
        setLoadingDocs(false);
      }
    };
    loadDocs();
  }, [supabase]);

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
      setMessage(`Cartes générées: ${data.created ?? 0}`);
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un document</label>
        <select
          value={documentPath}
          onChange={(e) => setDocumentPath(e.target.value)}
          className="w-full border rounded-md px-3 py-2"
        >
          <option value="">— Tous les documents —</option>
          {docs.map((d) => (
            <option key={d.path} value={d.path}>
              {d.name}
            </option>
          ))}
        </select>
        {loadingDocs && <p className="text-sm text-gray-500 mt-1">Chargement des documents…</p>}
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
