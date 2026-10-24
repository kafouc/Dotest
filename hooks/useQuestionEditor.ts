'use client';

import { useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharedQuiz } from '@/lib/liveQuiz';
import type { QuizQuestion } from '@/lib/quiz.types';
import { confirmDialog } from '@/components/ui/confirm';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const messageOf = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Édition des questions d'un quiz partagé (ajout, modification, suppression) avec enregistrement immédiat. */
export function useQuestionEditor(
  supabase: SupabaseClient,
  quiz: SharedQuiz | null,
  questions: QuizQuestion[],
  setQuiz: (updater: (prev: SharedQuiz | null) => SharedQuiz | null) => void
) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuizQuestion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = useCallback(
    async (nextQuestions: QuizQuestion[]) => {
      if (!quiz) throw new Error('Quiz introuvable.');
      setSaving(true);
      setFormError(null);
      try {
        const { error } = await supabase.from('shared_quizzes').update({ questions: nextQuestions }).eq('id', quiz.id);
        if (error) throw error;
        setQuiz((prev) => (prev ? { ...prev, questions: nextQuestions } : prev));
      } finally {
        setSaving(false);
      }
    },
    [supabase, quiz, setQuiz]
  );

  const startEdit = (index: number) => {
    const target = questions[index];
    if (!target) return;
    setEditingIndex(index);
    setDraft(clone(target));
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(null);
    setFormError(null);
  };

  const addQuestion = async () => {
    const template: QuizQuestion = {
      question: 'Nouvelle question',
      options: { A: '', B: '', C: '', D: '' },
      reponse_correcte: 'A',
    };
    const next = [...questions, template];
    try {
      await persist(next);
      setEditingIndex(next.length - 1);
      setDraft(clone(next[next.length - 1]));
    } catch (err) {
      setFormError(messageOf(err, 'Impossible d’ajouter la question.'));
    }
  };

  const deleteQuestion = async (index: number) => {
    if (!questions[index]) return;
    const confirmed = await confirmDialog({
      title: 'Supprimer cette question ?',
      message: 'La question sera retirée du quiz.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await persist(questions.filter((_, idx) => idx !== index));
      cancelEdit();
    } catch (err) {
      setFormError(messageOf(err, 'Impossible de supprimer la question.'));
    }
  };

  const changeOption = (optionKey: string, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, options: { ...draft.options, [optionKey]: value } });
  };

  const selectCorrect = (optionKey: string, checked: boolean) => {
    if (!draft) return;
    if ('reponses_correctes' in draft) {
      const updated = new Set(draft.reponses_correctes ?? []);
      if (checked) updated.add(optionKey);
      else updated.delete(optionKey);
      setDraft({ ...draft, reponses_correctes: Array.from(updated) });
    } else if ('reponse_correcte' in draft) {
      setDraft({ ...draft, reponse_correcte: optionKey });
    }
  };

  const saveQuestion = async () => {
    if (editingIndex === null || !draft) return;

    const trimmedQuestion = draft.question?.trim() ?? '';
    if (!trimmedQuestion) {
      setFormError('La question ne peut pas être vide.');
      return;
    }

    const sanitizedOptions = Object.fromEntries(
      Object.entries(draft.options ?? {}).map(([key, value]) => [key, (value ?? '').toString()])
    ) as Record<string, string>;

    if (Object.values(sanitizedOptions).every((v) => v.trim() === '')) {
      setFormError('Ajoute au moins une proposition.');
      return;
    }

    const updated = { ...draft, question: trimmedQuestion, options: sanitizedOptions } as QuizQuestion;

    if ('reponses_correctes' in updated) {
      const valid = Array.from(new Set((updated.reponses_correctes ?? []).filter((key) => sanitizedOptions[key] !== undefined)));
      if (valid.length === 0) {
        setFormError('Sélectionne au moins une bonne réponse.');
        return;
      }
      updated.reponses_correctes = valid;
    } else if ('reponse_correcte' in updated) {
      if (!sanitizedOptions[updated.reponse_correcte]) {
        const fallback = Object.keys(sanitizedOptions)[0];
        if (!fallback) {
          setFormError('Sélectionne une bonne réponse.');
          return;
        }
        updated.reponse_correcte = fallback;
      }
    }

    try {
      await persist(questions.map((q, idx) => (idx === editingIndex ? updated : q)));
      cancelEdit();
    } catch (err) {
      setFormError(messageOf(err, 'Impossible de sauvegarder la question.'));
    }
  };

  return {
    editingIndex,
    draft,
    setDraft,
    formError,
    saving,
    startEdit,
    cancelEdit,
    addQuestion,
    deleteQuestion,
    changeOption,
    selectCorrect,
    saveQuestion,
  };
}
