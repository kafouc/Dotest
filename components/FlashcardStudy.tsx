'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { listDueFlashcards, reviewFlashcard, type FlashcardWithDue } from '@/lib/flashcards';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';

type Props = {
  documentPath?: string;
  onActivity?: () => void;
};

export default function FlashcardStudy({ documentPath, onActivity }: Props) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<FlashcardWithDue[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const due = await listDueFlashcards(supabase, { documentPath, limit: 30 });
        setCards(due);
        setIndex(0);
        setShowAnswer(false);
      } catch (e) {
        console.error('Load flashcards error:', e);
        const msg = e instanceof Error ? e.message : 'Erreur inconnue';
        if (msg === 'FLASHCARDS_TABLE_MISSING') {
          setLoadError("Les tables 'flashcards' et 'flashcard_reviews' ne semblent pas installées. Exécutez la migration supabase/migrations/20251106_flashcards.sql dans votre projet Supabase.");
        } else {
          setLoadError('Erreur lors du chargement des flashcards.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, documentPath]);

  const current = cards[index];
  const total = cards.length;

  // Mémorisation de handleGrade pour éviter les re-créations
  const handleGrade = useCallback(async (grade: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!current) return;
    
    try {
      await reviewFlashcard(current.id, grade);
      onActivity?.();
    } catch (e) {
      console.error('Review error:', e);
      return; // Ne continue pas si l'erreur survient
    }
    
    // Passe à la carte suivante
    if (index < total - 1) {
      setIndex(index + 1);
      setShowAnswer(false);
    } else {
      // Recharge seulement les nouvelles cartes dues (optimisation)
      try {
        const due = await listDueFlashcards(supabase, { documentPath, limit: 30 });
        setCards(due);
        setIndex(0);
        setShowAnswer(false);
      } catch (e) {
        console.error('Reload error:', e);
        // En cas d'erreur, on reste sur la dernière carte
      }
    }
  }, [current, index, total, supabase, documentPath, onActivity]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow">
        <LoadingSpinner size="md" text="Chargement des cartes..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 bg-white rounded-xl shadow border border-red-200">
        <p className="text-red-700 font-medium">{loadError}</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="p-6 bg-white rounded-xl shadow">
        <EmptyState
          title="Aucune carte due maintenant"
          description="Toutes vos cartes sont à jour ! Revenez plus tard pour de nouvelles révisions."
          icon={
            <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-bold text-brand-dark">Révision</h3>
        <span className="text-sm text-gray-600">{index + 1} / {total}</span>
      </div>
      <div className="border rounded-lg p-6 bg-brand-yellow-light">
        <p className="text-gray-900 font-medium">{current.question}</p>
        {showAnswer ? (
          <p className="mt-3 text-gray-800 whitespace-pre-wrap">{current.answer}</p>
        ) : (
          <button
            type="button"
            onClick={() => setShowAnswer(true)}
            className="mt-4 px-4 py-2 bg-brand-yellow text-brand-dark rounded-md hover:bg-brand-yellow-dark font-semibold"
          >
            Afficher la réponse
          </button>
        )}
      </div>

      {showAnswer && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {[0,1,2,3,4,5].map((g) => (
            <button
              key={g}
              onClick={() => handleGrade(g as 0|1|2|3|4|5)}
              className={`px-3 py-2 rounded-md text-white ${g < 3 ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
