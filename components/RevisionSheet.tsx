"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import LoadingSpinner from './ui/LoadingSpinner';
import UpgradePrompt from './UpgradePrompt';
import { openPrintableDocument, escapeHtml, formatDateTime } from '@/lib/exporters';

const toPageNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

type SectionKey = 'key_points' | 'definitions' | 'formulas' | 'pitfalls' | 'tips' | 'self_test';

type SectionConfig = {
  key: SectionKey;
  label: string;
  helper?: string;
  items: string[];
};

type RevisionProgress = Record<SectionKey, Set<number>>;

type RevisionData = {
  summary: string;
  key_points: string[];
  definitions: string[];
  formulas: string[];
  pitfalls: string[];
  tips: string[];
  self_test: string[];
};

type Props = {
  documentPath?: string;
  onActivity?: () => void;
};

type StoredProgress = Record<SectionKey, number[]>;

const STUDY_PLAN = [
  {
    title: 'Lecture active',
    description: 'Parcours le résumé et surligne les idées majeures.',
  },
  {
    title: 'Validation des notions',
    description: 'Coche chaque point clé et définition une fois assimilé.',
  },
  {
    title: 'Mémorisation ciblée',
    description: 'Récite les formules et explique les conseils à voix haute.',
  },
  {
    title: 'Auto-évaluation',
    description: 'Réponds aux questions finales sans regarder la fiche.',
  },
];

function buildEmptyProgress(sections: SectionConfig[]): RevisionProgress {
  return sections.reduce((acc, section) => {
    if (!acc[section.key]) {
      acc[section.key] = new Set<number>();
    }
    return acc;
  }, {
    key_points: new Set<number>(),
    definitions: new Set<number>(),
    formulas: new Set<number>(),
    pitfalls: new Set<number>(),
    tips: new Set<number>(),
    self_test: new Set<number>(),
  } as RevisionProgress);
}

function serializeProgress(progress: RevisionProgress): StoredProgress {
  return {
    key_points: Array.from(progress.key_points ?? []),
    definitions: Array.from(progress.definitions ?? []),
    formulas: Array.from(progress.formulas ?? []),
    pitfalls: Array.from(progress.pitfalls ?? []),
    tips: Array.from(progress.tips ?? []),
    self_test: Array.from(progress.self_test ?? []),
  };
}

function restoreProgress(raw: unknown, sections: SectionConfig[]): RevisionProgress {
  const base = buildEmptyProgress(sections);
  if (!raw || typeof raw !== 'object') return base;
  const parsed = raw as Partial<Record<SectionKey, number[]>>;
  sections.forEach((section) => {
    const indexes = Array.isArray(parsed[section.key]) ? parsed[section.key] ?? [] : [];
    const valid = indexes.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < section.items.length);
    base[section.key] = new Set(valid as number[]);
  });
  return base;
}

type RevisionExportArgs = {
  data: RevisionData;
  sections: SectionConfig[];
  documentName?: string;
  generatedLabel: string;
};

function buildRevisionExportHtml({ data, sections, documentName, generatedLabel }: RevisionExportArgs): string {
  const headerMeta = [
    documentName ? `<p><strong>Document :</strong> ${escapeHtml(documentName)}</p>` : '',
    `<p><strong>Généré le :</strong> ${escapeHtml(generatedLabel)}</p>`,
  ].join('');

  const summaryHtml = data.summary
    ? `<section class="export-section"><h2>Résumé essentiel</h2><p>${escapeHtml(data.summary)}</p></section>`
    : '';

  const sectionsHtml = sections
    .map((section) => {
      if (!section.items.length) return '';
      const helper = section.helper ? `<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;">${escapeHtml(section.helper)}</p>` : '';
      const list = section.items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
      return `<section class="export-section">
        <h2>${escapeHtml(section.label)}</h2>
        ${helper}
        <ul>${list}</ul>
      </section>`;
    })
    .join('');

  const planHtml = `<section class="export-section">
    <h2>Plan de révision recommandé</h2>
    <ol style="padding-left:20px;">${STUDY_PLAN.map((step) => `<li style="margin-bottom:8px;"><strong>${escapeHtml(step.title)}:</strong> ${escapeHtml(step.description)}</li>`).join('')}</ol>
  </section>`;

  return `
    <header class="export-header">
      <div>
        <h1>Fiche de révision</h1>
        ${headerMeta}
      </div>
    </header>
    ${summaryHtml}
    ${sectionsHtml}
    ${planHtml}
  `;
}

export default function RevisionSheet({ documentPath, onActivity }: Props) {
  const [data, setData] = useState<RevisionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState<string>('');
  const [pageEnd, setPageEnd] = useState<string>('');
  const [progress, setProgress] = useState<RevisionProgress>(() => buildEmptyProgress([]));
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const sections = useMemo<SectionConfig[]>(() => {
    if (!data) return [];
    const entries = [
      { key: 'key_points', label: 'Points clés', helper: 'Vérifie ta compréhension de chaque idée forte.', items: data.key_points ?? [] },
      { key: 'definitions', label: 'Définitions', helper: 'Formule chaque notion avec tes propres mots.', items: data.definitions ?? [] },
      { key: 'formulas', label: 'Formules', helper: 'Récite-les à voix haute puis applique-les sur un exemple.', items: data.formulas ?? [] },
      { key: 'pitfalls', label: 'Pièges à éviter', helper: 'Note les erreurs fréquentes dans ta marge.', items: data.pitfalls ?? [] },
      { key: 'tips', label: 'Conseils', helper: 'Transforme chaque conseil en action concrète.', items: data.tips ?? [] },
      { key: 'self_test', label: 'Auto-évaluation', helper: 'Réponds sans regarder la fiche puis compare.', items: data.self_test ?? [] },
    ] satisfies SectionConfig[];
    return entries.filter((section) => section.items && section.items.length > 0);
  }, [data]);

  const totalItems = useMemo(() => sections.reduce((sum, section) => sum + section.items.length, 0), [sections]);
  const completedItems = useMemo(
    () => sections.reduce((sum, section) => sum + (progress[section.key]?.size ?? 0), 0),
    [sections, progress]
  );
  const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const storageKey = useMemo(() => (documentPath ? `revision-progress:${documentPath}` : null), [documentPath]);

  useEffect(() => {
    setData(null);
    setErr(null);
    setPageStart('');
    setPageEnd('');
    setProgress(buildEmptyProgress([]));
    setUpgradeMessage(null);
  }, [documentPath]);

  useEffect(() => {
    if (!sections.length) {
      setProgress(buildEmptyProgress([]));
      return;
    }
    if (!storageKey) {
      setProgress(buildEmptyProgress(sections));
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setProgress(buildEmptyProgress(sections));
        return;
      }
      const parsed = JSON.parse(raw) as StoredProgress;
      setProgress(restoreProgress(parsed, sections));
    } catch {
      setProgress(buildEmptyProgress(sections));
    }
  }, [sections, storageKey]);

  useEffect(() => {
    if (!storageKey || !sections.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(serializeProgress(progress)));
    } catch {
      // Ignorer le stockage silencieusement
    }
  }, [progress, storageKey, sections]);

  const toggleItem = useCallback(
    (key: SectionKey, index: number) => {
      setProgress((prev) => {
        const baseline = restoreProgress(serializeProgress(prev), sections);
        const target = baseline[key] ?? new Set<number>();
        if (target.has(index)) {
          target.delete(index);
        } else {
          target.add(index);
        }
        return {
          ...baseline,
          [key]: new Set(target),
        };
      });
    },
    [sections]
  );

  const resetProgress = useCallback(() => {
    setProgress(buildEmptyProgress(sections));
  }, [sections]);

  const generate = async () => {
    if (!documentPath) return;
    const startPage = toPageNumber(pageStart);
    const endPage = toPageNumber(pageEnd);
    if (startPage && endPage && endPage < startPage) {
      setErr('La page de fin doit être supérieure ou égale à la page de début.');
      return;
    }
    setLoading(true);
    setErr(null);
    setUpgradeMessage(null);
    try {
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentPath,
          pageRange: startPage || endPage ? { start: startPage ?? null, end: endPage ?? null } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          const upgradeMessage = json?.error
            ? `${json.error} Passez au plan Partiel ou Pro pour continuer.`
            : 'Quota atteint. Passez au plan Partiel ou Pro pour continuer.';
          setErr(upgradeMessage);
          setUpgradeMessage(upgradeMessage);
          setData(null);
          return;
        }
        throw new Error(json.error || 'Échec de génération');
      }
      setData(json as RevisionData);
      setUpgradeMessage(null);
      onActivity?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
      setUpgradeMessage(null);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = useCallback(() => {
    if (!data) return;
    const label = formatDateTime(new Date());
    const body = buildRevisionExportHtml({
      data,
      sections,
      documentName: documentPath,
      generatedLabel: label,
    });
    openPrintableDocument({
      title: `Fiche de révision - ${documentPath ?? 'Document'}`,
      body,
    });
  }, [data, sections, documentPath]);

  return (
    <div className="relative p-4 sm:p-6 pb-12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-5 gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-semibold text-brand-dark">Fiche de révision</h2>
          {documentPath && (
            <p className="text-xs text-gray-500">Source : {documentPath}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={exportPdf}
            disabled={!data || loading}
            className="w-full sm:w-auto px-3 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-300 shadow-sm min-h-[44px]"
          >
            Exporter en PDF
          </button>
          <button
            onClick={generate}
            disabled={loading || !documentPath}
            className="w-full sm:w-auto px-4 py-3 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? 'Génération...' : data ? 'Régénérer' : 'Générer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="summary-page-start" className="block text-sm font-medium text-gray-700 mb-1">
            Page de début (optionnelle)
          </label>
          <input
            type="number"
            id="summary-page-start"
            min={1}
            step={1}
            inputMode="numeric"
            value={pageStart}
            onChange={(e) => {
              setPageStart(e.target.value);
              setErr(null);
            }}
            placeholder="Ex: 10"
            disabled={loading}
            className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
          />
        </div>
        <div>
          <label htmlFor="summary-page-end" className="block text-sm font-medium text-gray-700 mb-1">
            Page de fin (optionnelle)
          </label>
          <input
            type="number"
            id="summary-page-end"
            min={1}
            step={1}
            inputMode="numeric"
            value={pageEnd}
            onChange={(e) => {
              setPageEnd(e.target.value);
              setErr(null);
            }}
            placeholder="Ex: 25"
            disabled={loading}
            className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
          />
        </div>
      </div>

      {!documentPath && (
        <p className="text-sm text-gray-500">Sélectionnez un document pour générer la fiche.</p>
      )}

      {err && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded mb-3 text-sm">{err}</div>
      )}
      <UpgradePrompt visible={Boolean(upgradeMessage)} message={upgradeMessage ?? ''} />

      {loading && (
        <div className="py-4 sm:py-6">
          <LoadingSpinner size="md" text="Création de la fiche..." />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          <div className="bg-brand-yellow-light/60 border border-brand-yellow/40 rounded-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-dark">Progression de ta révision</p>
                <p className="text-xs text-brand-dark-lighter">
                  {completedItems}/{totalItems} éléments validés
                </p>
              </div>
              <button
                type="button"
                onClick={resetProgress}
                className="self-start sm:self-auto text-xs font-semibold text-brand-dark hover:underline"
              >
                Réinitialiser
              </button>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/70">
              <div
                className="h-2 rounded-full bg-brand-teal"
                style={{ width: `${completionPercent}%` }}
                aria-hidden
              />
            </div>
          </div>

          {data.summary && (
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-heading font-semibold text-brand-dark mb-2">Résumé essentiel</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {sections.map((section) => (
                <section key={section.key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-heading font-semibold text-brand-dark">{section.label}</h3>
                      {section.helper && (
                        <p className="text-xs text-gray-500 mt-0.5">{section.helper}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-500">
                      {(progress[section.key]?.size ?? 0)}/{section.items.length}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {section.items.map((item, index) => {
                      const checked = progress[section.key]?.has(index) ?? false;
                      return (
                        <li key={index}>
                          <button
                            type="button"
                            onClick={() => toggleItem(section.key, index)}
                            className={`w-full text-left rounded-md border px-3 py-2 text-sm transition shadow-sm flex items-start gap-3 ${
                              checked
                                ? 'border-brand-teal bg-brand-teal-light/40 text-brand-dark'
                                : 'border-gray-200 hover:border-brand-teal-light hover:bg-brand-yellow-light/40'
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded ${
                                checked ? 'bg-brand-teal text-white' : 'border border-gray-300 text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                            <span>{item}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <aside className="space-y-4">
              <section className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-base font-heading font-semibold text-brand-dark mb-2">Plan de session</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                  {STUDY_PLAN.map((step, index) => (
                    <li key={index}>
                      <span className="font-semibold text-brand-dark">{step.title}:</span> {step.description}
                    </li>
                  ))}
                </ol>
              </section>
              <section className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-base font-heading font-semibold text-brand-dark mb-2">Conseil méthodo</h3>
                <p className="text-sm text-gray-700">
                  Termine ta fiche par une restitution totale : cache le contenu et reformule chaque partie. Un doute ?
                  Retourne sur la section concernée et décoche-la pour la revoir plus tard.
                </p>
              </section>
            </aside>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Génère une fiche de révision pour structurer tes apprentissages.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-2 opacity-70 text-gray-400">
        <Image
          src="/brand/logo/paper_logo.svg"
          alt="Sheet of Paper"
          width={16}
          height={16}
          className="w-4 h-4"
          aria-hidden
        />
        <span className="text-xs select-none">Généré par Sheet of Paper</span>
      </div>
    </div>
  );
}
