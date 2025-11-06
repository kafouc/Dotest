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

  // --- CONTRAINTE D'ACTIVITÉ ---
  const MAX_PROCESSING_DOCS = 2; // Limite à 2 documents en cours d'analyse
  const countProcessing = documents.filter(
    doc => doc.status === 'pending' || doc.status === 'processing'
  ).length;
  const isOverLimit = countProcessing >= MAX_PROCESSING_DOCS;
  // --- FIN CONTRAINTE D'ACTIVITÉ ---


  // --- handleSubmit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    // --- VÉRIFICATION DE LA LIMITE (si le bouton était disabled, c'est une sécurité) ---
    if (isOverLimit) {
        setError(`Vous ne pouvez pas générer de quiz tant que ${MAX_PROCESSING_DOCS} documents sont en cours d'analyse.`);
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
        // Normalise la structure du quiz pour assurer des clés A-D et une réponse correcte en lettre
        const normalizeLetter = (val: string): string => {
          const s = (val ?? '').toString().trim().toUpperCase();
          // Cherche une lettre A-D au début (éventuellement suivie de ponctuation)
          const m = s.match(/^[\s\(\[]*([ABCD])([\)\.:\-]|\s|$)/);
          if (m) return m[1];
          // Si c'est exactement A/B/C/D
          if (["A","B","C","D"].includes(s)) return s;
          return s;
        };

        const toLetter = (index: number) => (['A','B','C','D'][index] ?? 'A');

        type RawQuestion = {
          question?: unknown;
          options?: unknown;
          reponse_correcte?: unknown;
          justification?: unknown;
        };

        const normalized: QuizQuestion[] = (data.quiz as RawQuestion[]).map((q) => {
          // Récupère les options comme tableau de texte
          let values: string[] = [];
          if (Array.isArray(q.options)) {
            values = (q.options as unknown[]).map((v) => (v ?? '').toString());
          } else if (q.options && typeof q.options === 'object') {
            // Si les clés sont déjà A-D, les utiliser dans l'ordre A-D
            const obj = q.options as Record<string, unknown>;
            const keys = Object.keys(obj);
            if (keys.some(k => ['A','B','C','D'].includes(k.toUpperCase()))) {
              values = ['A','B','C','D']
                .map(k => obj[k] ?? obj[k.toLowerCase()] ?? obj[k.toUpperCase()])
                .filter((v): v is string => typeof v === 'string');
            } else {
              values = Object.values(obj).map((v) => (v ?? '').toString());
            }
          }
          // Coupe à 4 options max, remplit si moins (évite erreurs)
          values = values.slice(0, 4);
          while (values.length < 4) values.push('');

          const mappedOptions: Record<string, string> = {
            A: values[0] ?? '',
            B: values[1] ?? '',
            C: values[2] ?? '',
            D: values[3] ?? '',
          };

          // Normalise la réponse correcte
          let rc = normalizeLetter((q.reponse_correcte ?? '') as string);
          if (!['A','B','C','D'].includes(rc)) {
            // Si ce n'est pas une lettre, tente de faire correspondre par valeur
            const idx = values.findIndex(v => v.trim().toUpperCase() === (q.reponse_correcte ?? '').toString().trim().toUpperCase());
            rc = idx >= 0 ? toLetter(idx) : 'A';
          }

          return {
            question: (q.question ?? '') as string,
            options: mappedOptions,
            reponse_correcte: rc,
            justification: (q.justification ?? undefined) as string | undefined,
          } as QuizQuestion;
        });

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
      <h2 className="text-xl font-semibold mb-4 text-brand-purple-dark">Générer un Quiz</h2>

      {isAttemptingQuiz && quiz ? (
        <QuizAttempt
          quizQuestions={quiz}
          onQuizEnd={() => {
            setIsAttemptingQuiz(false);
            setQuiz(null); 
          }}
          context={{
            document_path: selectedDocument !== 'all' ? selectedDocument : undefined,
            user_query: query,
            num_questions: numQuestions,
          }}
        />
      ) : (
        <>
          {/* Avertissement de limite */}
          {isOverLimit && (
            <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-md">
                ⚠️ Vous avez **{countProcessing}** analyses en cours. Attendez la fin du traitement pour une génération de quiz fiable.
            </div>
          )}

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
              // Désactivé si en chargement, si la query est vide, OU si la limite est dépassée
              disabled={loading || !query || isOverLimit} 
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