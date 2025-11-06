'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { listDueFlashcards, reviewFlashcard, type FlashcardWithDue } from '@/lib/flashcards';

type Props = {
  documentPath?: string;
};

export default function FlashcardStudy({ documentPath }: Props) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<FlashcardWithDue[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, documentPath]);

  const current = cards[index];
  const total = cards.length;

  const handleGrade = async (grade: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!current) return;
    try {
      await reviewFlashcard(current.id, grade);
    } catch (e) {
      console.error('Review error:', e);
    }
    // Next card
    if (index < total - 1) {
      setIndex(index + 1);
      setShowAnswer(false);
    } else {
      // Reload session
      const due = await listDueFlashcards(supabase, { documentPath, limit: 30 });
      setCards(due);
      setIndex(0);
      setShowAnswer(false);
    }
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-xl shadow">Chargement des cartes...</div>;
  }

  if (!current) {
    return <div className="p-6 bg-white rounded-xl shadow">Aucune carte due maintenant 🎉</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-brand-purple-dark">Révision</h3>
        <span className="text-sm text-gray-600">{index + 1} / {total}</span>
      </div>
      <div className="border rounded-lg p-6 bg-purple-50">
        <p className="text-gray-900 font-medium">{current.question}</p>
        {showAnswer ? (
          <p className="mt-3 text-gray-800 whitespace-pre-wrap">{current.answer}</p>
        ) : (
          <button
            type="button"
            onClick={() => setShowAnswer(true)}
            className="mt-4 px-4 py-2 bg-brand-purple text-white rounded-md hover:bg-brand-purple-dark"
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
