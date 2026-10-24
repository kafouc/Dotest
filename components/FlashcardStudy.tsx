'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { listDueFlashcards, reviewFlashcard, type FlashcardWithDue } from '@/lib/flashcards';
import { logger } from '@/lib/logger';
import LoadingSpinner from './ui/LoadingSpinner';
import EmptyState from './ui/EmptyState';

type Props = {
  documentPath?: string;
  /** Nombre de cartes chargées à la fois */
  limit?: number;
  /** Appelé après chaque carte notée (rafraîchir la série, les compteurs…) */
  onActivity?: () => void;
};

type Grade = 0 | 3 | 4 | 5;

/** Notes envoyées à l'algorithme (échelle 0 à 5) derrière des libellés compréhensibles. */
const GRADES: { grade: Grade; label: string; hint: string; className: string }[] = [
  { grade: 0, label: 'À revoir', hint: 'Je ne savais pas : demain', className: 'bg-red-500 hover:bg-red-600' },
  { grade: 3, label: 'Difficile', hint: 'Avec effort', className: 'bg-orange-500 hover:bg-orange-600' },
  { grade: 4, label: 'Bien', hint: 'Je savais', className: 'bg-green-600 hover:bg-green-700' },
  { grade: 5, label: 'Facile', hint: 'Sans hésiter', className: 'bg-emerald-600 hover:bg-emerald-700' },
];

export default function FlashcardStudy({ documentPath, limit = 30, onActivity }: Props) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<FlashcardWithDue[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const due = await listDueFlashcards(supabase, { documentPath, limit });
        setCards(due);
        setIndex(0);
        setShowAnswer(false);
      } catch (e) {
        logger.error('Chargement des flashcards échoué', e instanceof Error ? e : { e: String(e) });
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
  }, [supabase, documentPath, limit]);

  const current = cards[index];
  const total = cards.length;

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!current || saving) return;
      setSaving(true);
      try {
        await reviewFlashcard(current.id, grade);
        onActivity?.();
      } catch (e) {
        logger.error('Notation de la carte échouée', e instanceof Error ? e : { e: String(e) });
        setSaving(false);
        return;
      }

      if (index < total - 1) {
        setIndex(index + 1);
        setShowAnswer(false);
      } else {
        try {
          const due = await listDueFlashcards(supabase, { documentPath, limit });
          setCards(due);
          setIndex(0);
          setShowAnswer(false);
        } catch (e) {
          logger.error('Rechargement des flashcards échoué', e instanceof Error ? e : { e: String(e) });
        }
      }
      setSaving(false);
    },
    [current, saving, index, total, supabase, documentPath, limit, onActivity]
  );

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
            <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        <span className="text-sm text-gray-600" aria-live="polite">
          {index + 1} / {total}
        </span>
      </div>
      <div className="border rounded-lg p-6 bg-brand-yellow-light">
        {current.source === 'quiz_error' && (
          <span className="mb-2 inline-block rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-orange-700">
            Erreur d&apos;un quiz
          </span>
        )}
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
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              onClick={() => handleGrade(g.grade)}
              disabled={saving}
              title={g.hint}
              className={`rounded-md px-3 py-2 text-white disabled:opacity-60 ${g.className}`}
            >
              <span className="block font-semibold">{g.label}</span>
              <span className="block text-[11px] opacity-90">{g.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
