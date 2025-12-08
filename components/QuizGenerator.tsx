"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import QuizAttempt from './QuizAttempt'; 
import ShareQuizButton from './ShareQuizButton';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';
import type { DocumentInfo } from '@/lib/types';
import type { QuizQuestion } from '@/lib/quiz.types';
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

  // --- CONTRAINTE D'ACTIVITÉ ---
  const countProcessing = documents.filter(
    doc => doc.status === 'pending' || doc.status === 'processing'
  ).length;
  const isOverLimit = countProcessing >= PROCESSING_LIMITS.MAX_CONCURRENT_DOCS;
  // --- FIN CONTRAINTE D'ACTIVITÉ ---


  // --- handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

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
      const payload: { query: string; documentPath?: string; numQuestions: number; } = {
        query: query, numQuestions: numQuestions
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
        const normalized = normalizeQuiz(data.quiz);
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
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-heading font-semibold mb-4 text-brand-dark">Générer un Quiz</h2>

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
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-0 md:flex md:items-end md:space-x-4">
            <div className="flex-grow">
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
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow"
              />
            </div>
            <div>
              <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">Nombre:</label>
              <input
                type="number"
                id="num-questions"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(QUIZ_LIMITS.MIN_QUESTIONS, parseInt(e.target.value) || QUIZ_LIMITS.MIN_QUESTIONS))}
                min={QUIZ_LIMITS.MIN_QUESTIONS} max={QUIZ_LIMITS.MAX_QUESTIONS} disabled={loading}
                className="w-20 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-yellow focus:border-brand-yellow text-center"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query || isOverLimit}
              className="w-full md:w-auto px-4 py-2 cursor-pointer bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
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
          </form>

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