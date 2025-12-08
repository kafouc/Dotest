'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import AttemptDetails from './AttemptDetails';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';

// Type pour les données d'une tentative de quiz
type QuizAttempt = {
  id: number;
  created_at: string;
  score: number;
  total_questions: number;
};

// Le composant reçoit le client Supabase en prop (créé dans page.tsx)
export default function ProgressTracker({
  supabase,
  documentPath,
}: {
  supabase: SupabaseClient;
  documentPath?: string;
}) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsAttemptId, setDetailsAttemptId] = useState<number | null>(null);

  useEffect(() => {
    type DBAttempt = {
      id: number;
      created_at: string;
      score: number;
      total_questions: number;
      context?: { document_path?: string } | null;
    };
    const fetchAttempts = async () => {
      setLoading(true);
      setError(null);

      // Récupère les tentatives de l'utilisateur (grâce à RLS)
        let query = supabase
          .from('quiz_attempts')
          .select('id, created_at, score, total_questions, context')
          .order('created_at', { ascending: false })
          .limit(5);

        // Si un document est précisé, filtrer par ce document via le JSONB context
        if (documentPath) {
          query = query.contains('context', { document_path: documentPath });
        }

        const { data, error: fetchError } = await query as unknown as { data: DBAttempt[] | null; error: unknown };

      if (fetchError) {
        console.error('Erreur chargement tentatives:', fetchError);
        setError("Impossible de charger l'historique.");
        setAttempts([]);
      } else if (data) {
          // Normalise et retire le champ context côté UI
          setAttempts(
            data.map((a: DBAttempt) => ({
              id: a.id,
              created_at: a.created_at,
              score: a.score,
              total_questions: a.total_questions,
            }))
          );
      } else {
        setAttempts([]);
      }
      setLoading(false);
    };

    fetchAttempts();

    // Récupère l'utilisateur pour filtrer le canal Realtime par user_id
    let isMounted = true;
    let channel: ReturnType<SupabaseClient['channel']> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted || !user) return;

      channel = supabase
        .channel('quiz_attempts_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'quiz_attempts',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
              // Si documentPath est fourni, ignorer les tentatives d'autres documents
              const ctx = (payload.new as unknown as DBAttempt)?.context;
              if (documentPath && ctx?.document_path !== documentPath) {
                return;
              }
              const n = payload.new as unknown as DBAttempt;
              const item: QuizAttempt = {
                id: n.id,
                created_at: n.created_at,
                score: n.score,
                total_questions: n.total_questions,
              };
              setAttempts((currentAttempts) => {
                // Déduplication: vérifier si l'ID existe déjà
                const exists = currentAttempts.some(a => a.id === item.id);
                if (exists) return currentAttempts;
                return [item, ...currentAttempts].slice(0, 5);
              });
          }
        )
        .subscribe();
    })();

    // Nettoyage
    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, documentPath]);

  // Mémorisation du score moyen pour éviter le recalcul à chaque render
  const averageScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    const sum = attempts.reduce(
      (acc, attempt) => acc + (attempt.score / attempt.total_questions),
      0
    );
    return (sum / attempts.length) * 100;
  }, [attempts]);

  return (
    // La div parente (dans page.tsx) a déjà les classes 'p-6 bg-brand-yellow-light/50 rounded-lg shadow-inner'
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-heading font-semibold text-brand-dark">
          Historique
        </h2>
        {/* Affiche le score moyen */}
        {attempts.length > 0 && (
          <div className="text-right">
            <span className="text-sm text-gray-600">Moyenne</span>
            <p className="text-2xl font-heading font-bold text-brand-yellow">
              {averageScore.toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="py-8">
          <LoadingSpinner size="md" text="Chargement de l'historique..." />
        </div>
      )}
      {error && (
        <p className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </p>
      )}

      {!loading && !error && attempts.length === 0 && (
        <EmptyState
          title="Aucune tentative"
          description="Les résultats de vos quiz apparaîtront ici une fois que vous aurez complété un quiz."
          icon={
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      )}

      {!loading && !error && attempts.length > 0 && (
        <ul className="space-y-3">
          {attempts.map((attempt) => {
            const percentage = (attempt.score / attempt.total_questions) * 100;
            // Couleur de la bordure basée sur le score - mémorisé
            const borderColorClass =
              percentage >= 80
                ? 'border-brand-teal'
                : percentage >= 50
                  ? 'border-brand-yellow'
                  : 'border-red-400';
            
            // Formatage de date mémorisé
            const formattedDate = new Date(attempt.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
            });

            return (
              <li
                key={attempt.id}
                className={`flex justify-between items-center p-3 bg-white rounded-md shadow-sm border-l-4 ${borderColorClass}`}
              >
                <div>
                  <span className="font-semibold text-gray-700">
                    {attempt.score} / {attempt.total_questions}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {formattedDate}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-heading font-bold text-brand-dark">
                    {percentage.toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailsAttemptId(attempt.id)}
                    className="text-sm px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                    aria-label={`Voir le détail de la tentative ${attempt.id}`}
                  >
                    Détails
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {detailsAttemptId !== null && (
        <AttemptDetails
          supabase={supabase}
          attemptId={detailsAttemptId}
          onClose={() => setDetailsAttemptId(null)}
        />
      )}
    </div>
  );
}
