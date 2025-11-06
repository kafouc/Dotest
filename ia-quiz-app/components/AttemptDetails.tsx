"use client";

import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';

type Attempt = {
  id: number;
  created_at: string;
  completed_at: string | null;
  score: number;
  total_questions: number;
  context: null | {
    document_path?: string;
    user_query?: string;
    num_questions?: number;
    [k: string]: unknown;
  };
};

type Answer = {
  question_index: number;
  question: string | null;
  answer: string | null; // lettre A-D
  correct_answer: string | null; // lettre A-D
  justification: string | null;
  is_correct: boolean;
};

type Props = {
  supabase: SupabaseClient;
  attemptId: number;
  onClose: () => void;
};

export default function AttemptDetails({ supabase, attemptId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: att, error: aErr } = await supabase
        .from('quiz_attempts')
        .select('id, created_at, completed_at, score, total_questions, context')
        .eq('id', attemptId)
        .single();
      if (aErr) throw aErr;

      const { data: ans, error: qErr } = await supabase
        .from('quiz_answers')
        .select('question_index, question, answer, correct_answer, justification, is_correct')
        .eq('attempt_id', attemptId)
        .order('question_index');
      if (qErr) throw qErr;

      setAttempt(att as Attempt);
      setAnswers((ans ?? []) as Answer[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase, attemptId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fermer avec Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-purple-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-brand-purple-dark">Détail de la tentative</h3>
              {attempt && (
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(attempt.completed_at ?? attempt.created_at).toLocaleString('fr-FR')}
                  {' · '}Score {attempt.score}/{attempt.total_questions}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="ml-2 rounded-md p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {loading && <p className="text-sm text-gray-600">Chargement…</p>}
            {error && (
              <p className="p-2 bg-red-100 text-red-700 rounded-md text-sm">{error}</p>
            )}

            {!loading && !error && attempt && (
              <div className="space-y-2">
                {attempt.context && (
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50 text-sm text-gray-700">
                    {attempt.context.document_path && (
                      <div><span className="font-medium">Document:</span> {attempt.context.document_path}</div>
                    )}
                    {attempt.context.user_query && (
                      <div><span className="font-medium">Demande:</span> {attempt.context.user_query}</div>
                    )}
                    {typeof attempt.context.num_questions === 'number' && (
                      <div><span className="font-medium">Questions:</span> {attempt.context.num_questions}</div>
                    )}
                  </div>
                )}

                {answers.length === 0 ? (
                  <p className="text-sm text-gray-600">Aucune réponse enregistrée.</p>
                ) : (
                  <ul className="space-y-3">
                    {answers.map((a) => {
                      const isOK = a.is_correct;
                      return (
                        <li key={a.question_index} className={`p-3 rounded-md border ${isOK ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-800">
                              {a.question ? `${a.question}` : `Question ${a.question_index + 1}`}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isOK ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                              {isOK ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <div><span className="font-medium">Votre réponse:</span> {a.answer ?? '—'}</div>
                            {!isOK && (
                              <div><span className="font-medium">Bonne réponse:</span> {a.correct_answer ?? '—'}</div>
                            )}
                            {a.justification && (
                              <div className="mt-1 text-gray-600 italic">Justification: {a.justification}</div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
