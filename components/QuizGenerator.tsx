"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QuizAttempt from './QuizAttempt'; 
import ShareQuizButton from './ShareQuizButton';
import LoadingSpinner from './ui/LoadingSpinner';
import type { DocumentInfo } from '@/lib/types';
import type { QuizQuestion, QuizMode } from '@/lib/quiz.types';
import { PROCESSING_LIMITS, QUIZ_LIMITS } from '@/lib/constants';
import { normalizeQuiz } from '@/lib/utils';

// Props reçues de page.tsx
type QuizGeneratorProps = {
  documents: DocumentInfo[];
  isLoading: boolean;
  activeDocumentPath?: string; // Document actif (optionnel)
};

export default function QuizGenerator({ documents, isLoading, activeDocumentPath }: QuizGeneratorProps) {
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

  // Réinitialiser le quiz quand le document actif change
  useEffect(() => {
    if (activeDocumentPath) {
      // Forcer la réinitialisation si un quiz est en cours
      if (isAttemptingQuiz || quiz) {
        setIsAttemptingQuiz(false);
        setQuiz(null);
        setError(null);
      }
    }
  }, [activeDocumentPath, isAttemptingQuiz, quiz]);

  // Cache des thèmes par document pour éviter les appels API répétés
  const [themesCache] = useState<Map<string, string[]>>(new Map());
  
  // Les thèmes ne sont chargés que sur action utilisateur (bouton)
  // Chargement automatique de 3 thèmes quand un document "Prêt" (completed) est sélectionné
  useEffect(() => {
    const activePath = currentDocument !== 'all' ? currentDocument : null;
    if (!activePath || isLoading) return;
    const doc = documents.find(d => d.path === activePath);
    if (!doc || doc.status !== 'completed') return;
    
    // Vérifier le cache d'abord
    if (themesCache.has(activePath)) {
      setThemes(themesCache.get(activePath) || []);
      return;
    }
    
    let cancelled = false;
    const run = async () => {
      try {
        setThemesLoading(true);
        setSelectedTheme(null);
        const res = await fetch('/api/generate-themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentPath: activePath }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && Array.isArray(data.themes)) {
            setThemes(data.themes);
            themesCache.set(activePath, data.themes); // Mettre en cache
          } else if (res.status === 429) {
            // Rate limit: afficher un message et garder les thèmes vides
            setError('Service temporairement surchargé. Les thèmes seront disponibles dans quelques instants.');
            setThemes([]);
          } else {
            setThemes([]);
          }
        }
      } catch {
        if (!cancelled) setThemes([]);
      } finally {
        if (!cancelled) setThemesLoading(false);
      }
    };
    
    // Debounce de 300ms pour éviter les appels multiples rapides
    const timer = setTimeout(run, 300);
    return () => { 
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentDocument, documents, isLoading, themesCache]);

  // --- CONTRAINTE D'ACTIVITÉ ---
  const countProcessing = documents.filter(
    doc => doc.status === 'pending' || doc.status === 'processing'
  ).length;
  const isOverLimit = countProcessing >= PROCESSING_LIMITS.MAX_CONCURRENT_DOCS;
  // --- FIN CONTRAINTE D'ACTIVITÉ ---


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

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsAttemptingQuiz(false); 

    try {
      const effectiveQuery = query && query.trim().length > 0 ? query : (selectedTheme || '');
      const payload: { query: string; documentPath?: string; numQuestions: number; mode: QuizMode; theme?: string } = {
        query: effectiveQuery, numQuestions: numQuestions, mode, theme: selectedTheme ?? undefined
      };
      if (currentDocument !== 'all') { payload.documentPath = currentDocument; }

      const response = await fetch('/api/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
        throw new Error(errData.error || `Une erreur ${response.status} est survenue.`);
      }
      const data = await response.json();
      if (data.quiz && Array.isArray(data.quiz)) {
        // Normalise la structure du quiz pour assurer des clés A-D et une réponse correcte en lettre
        const normalized = normalizeQuiz(data.quiz, mode);
        setQuiz(normalized);
      } else { throw new Error("L'API n'a pas renvoyé de quiz valide."); }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
    }
    finally { setLoading(false); }
  };

  // --- Rendu JSX ---
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
                  try {
                    const res = await fetch('/api/generate-themes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ documentPath: currentDocument !== 'all' ? currentDocument : undefined }),
                    });
                    const data = await res.json();
                    if (res.ok) setThemes(Array.isArray(data.themes) ? data.themes : []);
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