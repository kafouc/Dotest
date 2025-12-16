"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import QuizAttempt from './QuizAttempt'; 
import ShareQuizButton from './ShareQuizButton';
import LoadingSpinner from './ui/LoadingSpinner';
import type { DocumentInfo } from '@/lib/types';
import type { QuizQuestion, QuizMode } from '@/lib/quiz.types';
import { PROCESSING_LIMITS, QUIZ_LIMITS } from '@/lib/constants';
import { normalizeQuiz } from '@/lib/utils';
import { openPrintableDocument, escapeHtml, formatDateTime } from '@/lib/exporters';
import UpgradePrompt from './UpgradePrompt';

const toPageNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const MODE_LABELS: Record<QuizMode, string> = {
  qcu: 'QCU (Choix unique)',
  qcm: 'QCM (Choix multiple)',
  vf: 'Vrai / Faux',
};

type LastQuizContext = {
  prompt: string;
  documentPath?: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  mode: QuizMode;
  numQuestions: number;
};

type QuizExportMeta = {
  title: string;
  generatedLabel: string;
  docLabel?: string;
  prompt?: string;
  modeLabel: string;
  pageRangeLabel?: string;
  questionCount: number;
};

const QUIZ_EXPORT_STYLES = `
.quiz-metadata ul { list-style: none; padding: 0; margin: 0; }
.quiz-metadata li { margin-bottom: 6px; font-size: 14px; color: #374151; }
.quiz-question { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; background: #f9fafb; margin-bottom: 20px; }
.quiz-question h2 { font-size: 18px; margin: 0 0 8px 0; color: #0f172a; }
.quiz-question-text { margin: 0 0 12px 0; font-size: 15px; color: #1f2937; }
.quiz-options { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.quiz-option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid #e5e7eb; background: #ffffff; border-radius: 10px; font-size: 14px; }
.quiz-option-text { flex: 1; }
.quiz-option-correct { border-color: #10b981; background: #ecfdf5; }
.quiz-letter { font-weight: 600; color: #f59e0b; min-width: 28px; text-transform: uppercase; }
.quiz-option-tag { margin-left: auto; font-size: 12px; font-weight: 600; color: #047857; }
.quiz-justification { margin-top: 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid #fcd34d; background: #fef3c7; font-size: 13px; color: #92400e; }
`;

function buildQuizExportHtml(quizQuestions: QuizQuestion[], meta: QuizExportMeta): string {
  const metadataItems = [
    meta.docLabel ? `<li><strong>Document :</strong> ${escapeHtml(meta.docLabel)}</li>` : '',
    meta.prompt ? `<li><strong>Demande :</strong> ${escapeHtml(meta.prompt)}</li>` : '',
    `<li><strong>Type de quiz :</strong> ${escapeHtml(meta.modeLabel)}</li>`,
    `<li><strong>Nombre de questions :</strong> ${escapeHtml(meta.questionCount)}</li>`,
    meta.pageRangeLabel ? `<li><strong>Plage :</strong> ${escapeHtml(meta.pageRangeLabel)}</li>` : '',
    `<li><strong>Généré le :</strong> ${escapeHtml(meta.generatedLabel)}</li>`,
  ].filter(Boolean).join('');

  const metadataHtml = `
    <section class="export-section quiz-metadata">
      <h2>Détails</h2>
      <ul>${metadataItems}</ul>
    </section>
  `;

  const questionsHtml = quizQuestions
    .map((question, index) => {
      const correctSet = new Set<string>();
      if ('reponses_correctes' in question) {
        (question.reponses_correctes ?? []).forEach((value) => {
          if (value) correctSet.add(value.toString().toUpperCase());
        });
      } else if ('reponse_correcte' in question && question.reponse_correcte) {
        correctSet.add(question.reponse_correcte.toString().toUpperCase());
      }

      const optionsEntries = Object.entries(question.options ?? {});
      const optionsHtml = optionsEntries
        .map(([key, value]) => {
          const normalizedKey = key.toString().toUpperCase();
          const isCorrect = correctSet.has(normalizedKey);
          const label = key.length === 1 ? `${normalizedKey}.` : normalizedKey;
          return `
            <li class="quiz-option${isCorrect ? ' quiz-option-correct' : ''}">
              <span class="quiz-letter">${escapeHtml(label)}</span>
              <span class="quiz-option-text">${escapeHtml(value ?? '')}</span>
              ${isCorrect ? '<span class="quiz-option-tag">Bonne réponse</span>' : ''}
            </li>
          `;
        })
        .join('');

      const justificationHtml = question.justification
        ? `<p class="quiz-justification"><strong>Justification :</strong> ${escapeHtml(question.justification)}</p>`
        : '';

      return `
        <section class="export-section quiz-question">
          <h2>Question ${index + 1}</h2>
          <p class="quiz-question-text">${escapeHtml(question.question)}</p>
          <ul class="quiz-options">${optionsHtml}</ul>
          ${justificationHtml}
        </section>
      `;
    })
    .join('');

  return `
    <header class="export-header">
      <div>
        <h1>${escapeHtml(meta.title)}</h1>
        <p>Quiz généré automatiquement</p>
      </div>
    </header>
    ${metadataHtml}
    ${questionsHtml}
  `;
}

// Props reçues de page.tsx
type QuizGeneratorProps = {
  documents: DocumentInfo[];
  isLoading: boolean;
  activeDocumentPath?: string; // Document actif (optionnel)
  onActivity?: () => void;
};

export default function QuizGenerator({ documents, isLoading, activeDocumentPath, onActivity }: QuizGeneratorProps) {
  // --- États ---
  // Si activeDocumentPath est fourni, on l'utilise directement, sinon on permet la sélection
  const [selectedDocument, setSelectedDocument] = useState<string>(activeDocumentPath || 'all');
  
  // Utiliser le document actif si fourni
  const currentDocument = activeDocumentPath || selectedDocument;
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false); // Chargement de la génération
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(QUIZ_LIMITS.DEFAULT_QUESTIONS);
  const [isAttemptingQuiz, setIsAttemptingQuiz] = useState<boolean>(false); 
  const [mode, setMode] = useState<QuizMode>('qcu');
  const [themes, setThemes] = useState<string[]>([]);
  const [themesLoading, setThemesLoading] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState<string>('');
  const [pageEnd, setPageEnd] = useState<string>('');
  const [lastQuizContext, setLastQuizContext] = useState<LastQuizContext | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  // Réinitialiser le quiz quand le document actif change (mais pas en boucle)
  const previousDocumentPath = React.useRef<string | undefined>(activeDocumentPath);
  useEffect(() => {
    // Ne réinitialiser que si le document a réellement changé
    if (activeDocumentPath !== previousDocumentPath.current) {
      previousDocumentPath.current = activeDocumentPath;
      setIsAttemptingQuiz(false);
      setQuiz(null);
      setError(null);
    }
  }, [activeDocumentPath]);

  // Cache des thèmes par document pour éviter les appels API répétés
  const [themesCache] = useState<Map<string, string[]>>(new Map());
  const themesAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPageStart('');
    setPageEnd('');
  }, [currentDocument]);
  
  // Les thèmes ne sont chargés que sur action utilisateur (bouton)
  // Chargement automatique de 3 thèmes quand un document "Prêt" (completed) est sélectionné
  useEffect(() => {
    const activePath = currentDocument !== 'all' ? currentDocument : null;
    if (!activePath || isLoading) return;
    const doc = documents.find(d => d.path === activePath);
    if (!doc || doc.status !== 'completed') return;

    const startPage = toPageNumber(pageStart);
    const endPage = toPageNumber(pageEnd);
    if (startPage && endPage && endPage < startPage) {
      setError('La page de fin doit être supérieure ou égale à la page de début.');
      setThemes([]);
      return;
    }

    const rangeKey = startPage || endPage ? `${startPage ?? ''}-${endPage ?? ''}` : 'all';
    const cacheKey = `${activePath}::${rangeKey}`;

    if (themesCache.has(cacheKey)) {
      setThemes(themesCache.get(cacheKey) || []);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;
    const run = async () => {
      try {
        setThemesLoading(true);
        setSelectedTheme(null);
        setError(null);
        controller?.abort();
        themesAbortRef.current?.abort();
        controller = new AbortController();
        themesAbortRef.current = controller;
        const payload: Record<string, unknown> = { documentPath: activePath };
        if (startPage || endPage) {
          payload.pageRange = {
            start: startPage ?? null,
            end: endPage ?? null,
          };
        }
        const res = await fetch('/api/generate-themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && Array.isArray(data.themes)) {
            setThemes(data.themes);
            themesCache.set(cacheKey, data.themes);
          } else if (res.status === 429) {
            setError('Service temporairement surchargé. Les thèmes seront disponibles dans quelques instants.');
            setThemes([]);
          } else {
            setThemes([]);
          }
        }
      } catch (err: unknown) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        if (!cancelled && !aborted) setThemes([]);
      } finally {
        if (themesAbortRef.current === controller) {
          themesAbortRef.current = null;
        }
        if (!cancelled) setThemesLoading(false);
      }
    };

    const timer = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [currentDocument, documents, isLoading, pageStart, pageEnd, themesCache]);

  // --- CONTRAINTE D'ACTIVITÉ ---
  const countProcessing = documents.filter(
    doc => doc.status === 'pending' || doc.status === 'processing'
  ).length;
  const isOverLimit = countProcessing >= PROCESSING_LIMITS.MAX_CONCURRENT_DOCS;
  // --- FIN CONTRAINTE D'ACTIVITÉ ---

  const handleExportQuiz = () => {
    if (!quiz) return;
    const generatedLabel = formatDateTime(new Date());
    const context = lastQuizContext;

    const resolveDocumentLabel = (): string | undefined => {
      const path = context?.documentPath ?? (currentDocument !== 'all' ? currentDocument : undefined);
      if (!path) {
        return currentDocument === 'all' ? 'Documents prêts (Tous)' : undefined;
      }
      const doc = documents.find((d) => d.path === path);
      return doc?.name ?? path;
    };

    const buildPageLabel = (): string | undefined => {
      const start = context?.pageStart ?? null;
      const end = context?.pageEnd ?? null;
      if (start && end) return `Pages ${start} à ${end}`;
      if (start) return `Depuis la page ${start}`;
      if (end) return `Jusqu'à la page ${end}`;
      return undefined;
    };

    const documentLabel = resolveDocumentLabel();
    const promptLabelRaw = (context?.prompt ?? query ?? '').trim();
    const promptLabel = promptLabelRaw.length > 0 ? promptLabelRaw : undefined;
    const pageLabel = buildPageLabel();
    const modeLabel = MODE_LABELS[context?.mode ?? mode];
    const questionCount = quiz.length;
    const exportTitle = documentLabel ? `Quiz - ${documentLabel}` : 'Quiz généré';

    const body = buildQuizExportHtml(quiz, {
      title: exportTitle,
      generatedLabel,
      docLabel: documentLabel,
      prompt: promptLabel,
      modeLabel,
      pageRangeLabel: pageLabel,
      questionCount,
    });

    openPrintableDocument({
      title: exportTitle,
      body,
      styles: QUIZ_EXPORT_STYLES,
    });
  };


  // --- handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query && !selectedTheme) return;

    // --- VÉRIFICATION DE LA LIMITE (si le bouton était disabled, c'est une sécurité) ---
    if (isOverLimit) {
        setError(`Vous ne pouvez pas générer de quiz tant que ${PROCESSING_LIMITS.MAX_CONCURRENT_DOCS} documents sont en cours d'analyse.`);
        return;
    }
    // --- FIN VÉRIFICATION ---

    const startPage = toPageNumber(pageStart);
    const endPage = toPageNumber(pageEnd);
    if (startPage && endPage && endPage < startPage) {
      setError('La page de fin doit être supérieure ou égale à la page de début.');
      return;
    }

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsAttemptingQuiz(false); 
    setLastQuizContext(null);
    setUpgradeMessage(null);

    try {
      const effectiveQuery = query && query.trim().length > 0 ? query : (selectedTheme || '');
      const documentPathForQuiz = currentDocument !== 'all' ? currentDocument : undefined;
      const payload: { query: string; documentPath?: string; numQuestions: number; mode: QuizMode; theme?: string; pageRange?: { start?: number | null; end?: number | null } } = {
        query: effectiveQuery, numQuestions: numQuestions, mode, theme: selectedTheme ?? undefined
      };
      if (documentPathForQuiz) { payload.documentPath = documentPathForQuiz; }
      if (startPage || endPage) {
        payload.pageRange = {
          start: startPage ?? null,
          end: endPage ?? null,
        };
      }

      const response = await fetch('/api/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (response.status === 402) {
          const upgrade = errData?.error
            ? `${errData.error} Passez au plan Partiel ou Pro pour continuer.`
            : 'Quota atteint. Passez au plan Partiel ou Pro pour continuer.';
          setError(upgrade);
          setUpgradeMessage(upgrade);
          return;
        }
        throw new Error(errData?.error || `Une erreur ${response.status} est survenue.`);
      }
      const data = await response.json();
      if (data.quiz && Array.isArray(data.quiz)) {
        // Normalise la structure du quiz pour assurer des clés A-D et une réponse correcte en lettre
        const normalized = normalizeQuiz(data.quiz, mode);
        console.log('[DEBUG] Quiz normalisé:', normalized);
        console.log('[DEBUG] Nombre de questions:', normalized.length);
        setQuiz(normalized);
        setLastQuizContext({
          prompt: effectiveQuery,
          documentPath: documentPathForQuiz,
          pageStart: startPage ?? null,
          pageEnd: endPage ?? null,
          mode,
          numQuestions: normalized.length,
        });
        setUpgradeMessage(null);
        console.log('[DEBUG] setQuiz appelé, isAttemptingQuiz:', isAttemptingQuiz);
        onActivity?.();
      } else { throw new Error("L'API n'a pas renvoyé de quiz valide."); }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      if (!errorMessage.includes('Passez au plan')) {
        setUpgradeMessage(null);
      }
    }
    finally { setLoading(false); }
  };

  // --- Rendu JSX ---
  console.log('[DEBUG] Render - quiz:', quiz ? `${quiz.length} questions` : 'null', 'isAttemptingQuiz:', isAttemptingQuiz);
  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 text-brand-dark">Générer un Quiz</h2>

      {isAttemptingQuiz && quiz ? (
        <QuizAttempt
          quizQuestions={quiz}
          onQuizEnd={() => {
            setIsAttemptingQuiz(false);
            setQuiz(null); 
          }}
          context={{
            document_path: currentDocument !== 'all' ? currentDocument : undefined,
            user_query: query,
            num_questions: numQuestions,
            page_start: toPageNumber(pageStart) ?? undefined,
            page_end: toPageNumber(pageEnd) ?? undefined,
          }}
        />
      ) : (
        <>
          {/* Avertissement de limite amélioré */}
          {isOverLimit && (
            <div className="p-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <svg
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  Limite de traitement atteinte
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Vous avez {countProcessing} analyse{countProcessing > 1 ? 's' : ''} en cours. 
                  Attendez la fin du traitement pour une génération de quiz fiable.
                </p>
              </div>
            </div>
          )}

          {/* Sélection du document - seulement si activeDocumentPath n'est pas fourni */}
          {!activeDocumentPath && (
            <div className="mb-4">
              <label htmlFor="document-select" className="block text-sm font-medium text-gray-700 mr-2 mb-1">
                Basé sur le document :
              </label>
              <select
                id="document-select"
                value={selectedDocument}
                onChange={(e) => setSelectedDocument(e.target.value)}
                disabled={loading || isLoading || documents.length === 0} 
                className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow w-full md:w-auto"
              >
                <option value="all">Documents Prêts (Tous)</option>
                {documents.map((doc) => (
                  <option 
                    key={doc.path} 
                    value={doc.path} 
                    disabled={doc.status !== 'completed'} 
                  >
                    {doc.name} 
                    {doc.status === 'completed' ? ' ✅' : ` (Analyse... ⏳)`}
                  </option>
                ))}
              </select>
              {documents.length === 0 && !isLoading && ( <span className="text-sm text-gray-500 ml-2">(Aucun document)</span> )}
            </div>
          )}

          {/* Formulaire de génération */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="w-full">
              <label htmlFor="quiz-query" className="block text-sm font-medium text-gray-700 mb-1">
                Votre demande pour l&apos;IA :
              </label>
              <input
                type="text"
                id="quiz-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Fais 5 QCM sur les concepts clés..."
                disabled={loading}
                className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="page-start" className="block text-sm font-medium text-gray-700 mb-1">
                  Page de début (optionnelle)
                </label>
                <input
                  type="number"
                  id="page-start"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  placeholder="Ex: 10"
                  disabled={loading}
                  className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
                />
              </div>
              <div>
                <label htmlFor="page-end" className="block text-sm font-medium text-gray-700 mb-1">
                  Page de fin (optionnelle)
                </label>
                <input
                  type="number"
                  id="page-end"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  placeholder="Ex: 25"
                  disabled={loading}
                  className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="quiz-mode" className="block text-sm font-medium text-gray-700 mb-1">Type de quiz:</label>
                <select
                  id="quiz-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as QuizMode)}
                  disabled={loading}
                  className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
                >
                  <option value="qcu">QCU (Choix unique)</option>
                  <option value="qcm">QCM (Choix multiple)</option>
                  <option value="vf">Vrai / Faux</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">Nombre de questions:</label>
                <select
                  id="num-questions"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  disabled={loading}
                  className="w-full p-3 text-base border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
                >
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                  <option value={10}>10</option>
                </select>
              </div>
              
              <div className="sm:flex sm:items-end">
                <button
                  type="submit"
                  disabled={loading || (!query && !selectedTheme) || isOverLimit}
                  className="w-full px-4 py-3 text-base cursor-pointer bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10 touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Génération...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Générer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Thèmes suggérés */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Thèmes suggérés</label>
              <button
                type="button"
                onClick={async () => {
                  setThemesLoading(true);
                  setSelectedTheme(null);
                  setError(null);
                  try {
                    const startPage = toPageNumber(pageStart);
                    const endPage = toPageNumber(pageEnd);
                    if (startPage && endPage && endPage < startPage) {
                      setError('La page de fin doit être supérieure ou égale à la page de début.');
                      setThemesLoading(false);
                      return;
                    }
                    const res = await fetch('/api/generate-themes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        documentPath: currentDocument !== 'all' ? currentDocument : undefined,
                        pageRange: startPage || endPage ? { start: startPage ?? null, end: endPage ?? null } : undefined,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      const themesList = Array.isArray(data.themes) ? data.themes : [];
                      setThemes(themesList);
                      if (currentDocument !== 'all') {
                        const rangeKey = startPage || endPage ? `${startPage ?? ''}-${endPage ?? ''}` : 'all';
                        const cacheKey = `${currentDocument}::${rangeKey}`;
                        themesCache.set(cacheKey, themesList);
                      }
                    }
                  } catch {
                    // ignore
                  } finally {
                    setThemesLoading(false);
                  }
                }}
                className="text-sm text-brand-teal hover:underline disabled:opacity-50"
                disabled={isLoading || loading}
              >
                {themesLoading ? 'Chargement…' : "Voir d'autres thèmes"}
              </button>
            </div>
            {themes.length === 0 && !themesLoading && (
              <p className="text-sm text-gray-500">Aucun thème suggéré pour le moment.</p>
            )}
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {themes.map((t) => {
                  const active = selectedTheme === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const next = active ? null : t;
                        setSelectedTheme(next);
                        if (!query && next) setQuery(next);
                      }}
                      className={`px-3 py-2 rounded-full border text-sm transition-colors min-h-[40px] touch-manipulation ${active ? 'bg-brand-teal text-white border-brand-teal' : 'bg-white border-gray-300 hover:border-brand-teal hover:text-brand-teal'}`}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zone d'affichage (Erreur ou Bouton Commencer) */}
          <div className="mt-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Erreur de génération</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Fermer l'erreur"
                >
                  ✕
                </button>
              </div>
            )}
            <UpgradePrompt visible={Boolean(upgradeMessage)} message={upgradeMessage ?? ''} />
            {quiz && !isAttemptingQuiz && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-6 bg-gradient-to-br from-brand-yellow-light to-brand-teal-light border border-brand-yellow rounded-lg text-center"
              >
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 text-green-500 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-bold text-brand-dark mb-2">Quiz Généré !</h3>
                <p className="text-gray-700 mb-4">
                  Un quiz de <strong>{quiz.length} question{quiz.length > 1 ? 's' : ''}</strong> est prêt.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    onClick={() => setIsAttemptingQuiz(true)}
                    className="px-6 py-3 cursor-pointer bg-brand-teal hover:bg-brand-teal-dark text-white font-bold rounded-md shadow-lg transition-all duration-200 text-lg hover:scale-105 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Commencer le Quiz !
                  </button>
                  <button
                    type="button"
                    onClick={handleExportQuiz}
                    className="px-6 py-3 cursor-pointer bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-bold rounded-md shadow-lg transition-all duration-200 text-lg flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Exporter en PDF
                  </button>
                  <ShareQuizButton
                    quizTitle={`Quiz - ${currentDocument !== 'all' ? documents.find(d => d.path === currentDocument)?.name : 'Tous documents'}`}
                    questions={quiz}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}