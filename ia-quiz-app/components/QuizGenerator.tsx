"use client";

import { useState } from 'react';
import QuizAttempt from './QuizAttempt'; 
import type { DocumentInfo } from '../app/page'; // Importe le type partagé

// Types
type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

// Props reçues de page.tsx
type QuizGeneratorProps = {
  documents: DocumentInfo[];
  isLoading: boolean;
};

export default function QuizGenerator({ documents, isLoading }: QuizGeneratorProps) {
  // --- États ---
  const [selectedDocument, setSelectedDocument] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false); // Chargement de la génération
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [isAttemptingQuiz, setIsAttemptingQuiz] = useState<boolean>(false); 

  // --- handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsAttemptingQuiz(false); 

    try {
      const payload: { query: string; documentPath?: string; numQuestions: number; } = {
        query: query, numQuestions: numQuestions
      };
      if (selectedDocument !== 'all') { payload.documentPath = selectedDocument; }

      const response = await fetch('/api/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
        throw new Error(errData.error || `Une erreur ${response.status} est survenue.`);
      }
      const data = await response.json();
      if (data.quiz && Array.isArray(data.quiz)) {
        setQuiz(data.quiz);
      } else { throw new Error("L'API n'a pas renvoyé de quiz valide."); }

    } catch (err: unknown) { // 'any' corrigé en 'unknown'
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
    }
    finally { setLoading(false); }
  };

  // --- Rendu JSX ---
  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-brand-purple-dark">Générer un Quiz</h2>

      {isAttemptingQuiz && quiz ? (
        // --- MODE TENTATIVE ---
        <QuizAttempt
          quizQuestions={quiz}
          onQuizEnd={() => {
            setIsAttemptingQuiz(false);
            setQuiz(null); 
          }}
        />
      ) : (
        // --- MODE GÉNÉRATION ---
        <>
          {/* Sélection du document */}
          <div className="mb-4">
            <label htmlFor="document-select" className="block text-sm font-medium text-gray-700 mr-2 mb-1">
              Basé sur le document :
            </label>
            <select
              id="document-select"
              value={selectedDocument}
              onChange={(e) => setSelectedDocument(e.target.value)}
              disabled={loading || isLoading || documents.length === 0} 
              className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple w-full md:w-auto"
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

          {/* Formulaire de génération */}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-0 md:flex md:items-end md:space-x-4">
            <div className="flex-grow">
              <label htmlFor="quiz-query" className="block text-sm font-medium text-gray-700 mb-1">
                {/* Correction ESLint: Remplacement de ' par &apos; */}
                Votre demande pour l&apos;IA :
              </label>
              <input
                type="text"
                id="quiz-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Fais 5 QCM sur les concepts clés..."
                disabled={loading}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>
            <div>
              <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">Nombre:</label>
              <input
                type="number"
                id="num-questions"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                min="1" max="10" disabled={loading}
                className="w-20 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple text-center"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query}
              className="w-full md:w-auto px-4 py-2 cursor-pointer bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold rounded-md shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Génération...' : 'Générer'}
            </button>
          </form>

          {/* Zone d'affichage (Erreur ou Bouton Commencer) */}
          <div className="mt-6">
            {error && (
              <p className="p-3 bg-red-100 text-red-700 rounded-md">
                <strong>Erreur :</strong> {error}
              </p>
            )}
            {quiz && !isAttemptingQuiz && (
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <h3 className="text-lg font-medium text-brand-purple-dark">Quiz Généré !</h3>
                <p className="mt-1 text-gray-700">Un quiz de {quiz.length} questions est prêt.</p>
                <button
                  onClick={() => setIsAttemptingQuiz(true)} 
                  className="mt-4 px-6 py-2 cursor-pointer bg-brand-pink hover:bg-brand-pink-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
                >
                  Commencer le Quiz !
                </button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
  );
}