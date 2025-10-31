"use client";

import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Type pour les données d'une tentative de quiz
type QuizAttempt = {
  id: number;
  created_at: string;
  score: number;
  total_questions: number;
};

// Le composant reçoit le client Supabase en prop (créé dans page.tsx)
export default function ProgressTracker({ supabase }: { supabase: SupabaseClient }) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      setLoading(true);
      setError(null);

      // Récupère les tentatives de l'utilisateur (grâce à RLS)
      const { data, error: fetchError } = await supabase
        .from('quiz_attempts')
        .select('id, created_at, score, total_questions') // Sélectionne les colonnes
        .order('created_at', { ascending: false }) // Trie (plus récent en premier)
        .limit(5); // Limite aux 5 dernières tentatives

      if (fetchError) {
        console.error("Erreur chargement tentatives:", fetchError);
        setError("Impossible de charger l'historique.");
        setAttempts([]);
      } else if (data) {
        setAttempts(data);
      } else {
        setAttempts([]);
      }
      setLoading(false);
    };

    fetchAttempts();

    // Écoute les nouveaux inserts dans quiz_attempts
    const channel = supabase.channel('quiz_attempts_changes')
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'quiz_attempts' 
        }, 
        (payload) => {
          // Ajoute la nouvelle tentative en haut de la liste
          setAttempts(currentAttempts => [payload.new as QuizAttempt, ...currentAttempts].slice(0, 5));
        }
      )
      .subscribe();

    // Nettoie l'écouteur
    return () => {
      supabase.removeChannel(channel);
    };

  }, [supabase]);

  // Calcule le score moyen
  const averageScore = attempts.length > 0
    ? (attempts.reduce((acc, attempt) => acc + (attempt.score / attempt.total_questions), 0) / attempts.length) * 100
    : 0;

  return (
    // La div parente (dans page.tsx) a déjà les classes 'p-6 bg-purple-50/50 rounded-lg shadow-inner'
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-brand-purple-dark">Historique</h2>
        {/* Affiche le score moyen */}
        {attempts.length > 0 && (
          <div className="text-right">
            <span className="text-sm text-gray-600">Moyenne</span>
            <p className="text-2xl font-bold text-brand-purple">
              {averageScore.toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      {loading && <p className="text-gray-600 text-sm">Chargement...</p>}
      {error && <p className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</p>}
      
      {!loading && !error && attempts.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">Aucune tentative.</p>
      )}

      {!loading && !error && attempts.length > 0 && (
        <ul className="space-y-3">
          {attempts.map((attempt) => {
            const percentage = (attempt.score / attempt.total_questions) * 100;
            // Couleur de la bordure basée sur le score
            const borderColorClass = percentage >= 80 ? 'border-green-400' 
                                    : percentage >= 50 ? 'border-yellow-400' 
                                    : 'border-brand-pink'; // Utilise le rose pour les scores bas

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
                    {new Date(attempt.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <span className="text-lg font-bold text-brand-purple-dark">
                  {percentage.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}