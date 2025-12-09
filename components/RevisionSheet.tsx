"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import LoadingSpinner from './ui/LoadingSpinner';

type RevisionData = {
  summary: string;
  key_points: string[];
  definitions: string[];
  formulas: string[];
  pitfalls: string[];
  tips: string[];
  self_test: string[];
};

export default function RevisionSheet({ documentPath }: { documentPath?: string }) {
  const [data, setData] = useState<RevisionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const generate = async () => {
    if (!documentPath) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentPath }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec de génération');
      setData(json as RevisionData);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setErr(null);
    // Option: auto-générer à la sélection du document
    // if (documentPath) generate();
  }, [documentPath]);

  const downloadPdf = () => {
    if (!contentRef.current) return;
    const html = contentRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;
    const styles = `
      <style>
        :root { --brand-dark: #1f2937; --muted: #374151; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; margin: 24px; }
        h2 { font-size: 20px; margin: 0 0 12px; color: var(--brand-dark); }
        h3 { font-size: 16px; margin: 16px 0 8px; color: var(--brand-dark); }
        p, li { font-size: 12px; line-height: 1.6; color: #374151; }
        ul { margin: 0 0 8px 18px; padding: 0; }
        .watermark { position: fixed; right: 24px; bottom: 18px; display: flex; align-items: center; gap: 8px; opacity: .6; color: #6b7280; }
        .watermark img { width: 14px; height: 14px; }
        @page { margin: 16mm; }
      </style>
    `;
    const doc = `
      <html>
        <head><meta charset="utf-8" />${styles}<title>Fiche de révision</title></head>
        <body>
          <h2>Fiche de révision</h2>
          ${html}
          <div class="watermark">
            <img src="${location.origin}/brand/logo/paper_logo.svg" alt="Sheet of Paper" />
            <span>générée par Sheet of Paper</span>
          </div>
          <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 300); };</script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(doc);
    win.document.close();
  };

  return (
    <div className="relative p-4 sm:p-6 pb-12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
        <h2 className="text-lg sm:text-xl font-heading font-semibold text-brand-dark">Fiche de révision</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={downloadPdf}
            disabled={!data || loading || !documentPath}
            className="w-full sm:w-auto px-3 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-300 shadow-sm min-h-[44px]"
          >
            Télécharger en PDF
          </button>
          <button
            onClick={generate}
            disabled={loading || !documentPath}
            className="w-full sm:w-auto px-4 py-3 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? 'Génération...' : (data ? 'Régénérer' : 'Générer')}
          </button>
        </div>
      </div>

      {!documentPath && (
        <p className="text-sm text-gray-500">Sélectionnez un document pour générer la fiche.</p>
      )}

      {err && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded mb-3 text-sm">{err}</div>
      )}

      {loading && (
        <div className="py-4 sm:py-6">
          <LoadingSpinner size="md" text="Création de la fiche..." />
        </div>
      )}

      {!loading && data && (
        <div ref={contentRef} className="space-y-5">
          {data.summary && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Résumé</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
            </section>
          )}

          {data.key_points?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Points clés</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.key_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {data.definitions?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Définitions</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.definitions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {data.formulas?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Formules</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.formulas.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {data.pitfalls?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Pièges à éviter</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.pitfalls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {data.tips?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Conseils</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.tips.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {data.self_test?.length > 0 && (
            <section>
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Auto-évaluation</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {data.self_test.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Filigrane en bas à droite */}
      <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-2 opacity-60 text-gray-400">
        <Image
          src="/brand/logo/paper_logo.svg"
          alt="Sheet of Paper"
          width={16}
          height={16}
          className="w-4 h-4"
          aria-hidden
        />
        <span className="text-xs select-none">générée par Sheet of Paper</span>
      </div>
    </div>
  );
}
