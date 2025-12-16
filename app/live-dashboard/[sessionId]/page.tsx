'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  getSession,
  getSessionParticipants,
  getSessionAnswers,
  startSession,
  completeSession,
  type QuizSession,
  type SessionParticipant,
  type LiveAnswer,
  type SharedQuiz,
} from '@/lib/liveQuiz';
import type { QuizQuestion } from '@/lib/quiz.types';
import { openPrintableDocument, escapeHtml, formatDateTime, formatDuration, downloadJsonWorkbook } from '@/lib/exporters';

type ParticipantSummary = {
  id: string;
  nickname: string;
  answered: number;
  correct: number;
  scorePercent: number;
  completionPercent: number;
  durationMs: number;
  firstAnswerAt: string | null;
  lastAnswerAt: string | null;
};

type LiveExportArgs = {
  sessionTitle: string;
  shareCode?: string | null;
  generatedLabel: string;
  startedAt?: string;
  completedAt?: string;
  durationLabel?: string;
  participantSummaries: ParticipantSummary[];
  totalParticipants: number;
  totalQuestions: number;
  totalAnswers: number;
  questionStats: { correct: number; total: number }[];
  questions: QuizQuestion[];
  answers: LiveAnswer[];
};

const LIVE_EXPORT_STYLES = `
.session-meta { list-style: none; padding: 0; margin: 0; }
.session-meta li { margin-bottom: 6px; font-size: 14px; color: #374151; }
.question-distribution { list-style: none; padding: 0; margin: 8px 0 0 0; }
.question-distribution li { margin-bottom: 4px; font-size: 13px; color: #1f2937; }
.question-distribution li strong { color: #f59e0b; margin-right: 6px; }
.question-note { margin-top: 10px; font-size: 13px; color: #4b5563; }
`;

function formatCorrectAnswer(question: QuizQuestion): string {
  if ('reponses_correctes' in question) {
    return (question.reponses_correctes ?? []).map((choice) => {
      const key = choice.toString().toUpperCase();
      const text = (question.options ?? {})[key] ?? (question.options ?? {})[key.toLowerCase()];
      return text ? `${key} – ${text}` : key;
    }).join(', ');
  }

  if ('reponse_correcte' in question) {
    if (question.reponse_correcte === 'VRAI' || question.reponse_correcte === 'FAUX') {
      const label = question.reponse_correcte === 'VRAI' ? 'Vrai' : 'Faux';
      const text = (question.options ?? {})[question.reponse_correcte];
      return text ? text : label;
    }
    const key = question.reponse_correcte?.toString().toUpperCase() ?? '';
    const text = (question.options ?? {})[key] ?? (question.options ?? {})[key.toLowerCase()];
    return text ? `${key} – ${text}` : key;
  }

  return '';
}

function getOptionCounts(question: QuizQuestion, index: number, answers: LiveAnswer[]): Record<string, number> {
  const base = Object.keys(question.options ?? {}).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  answers
    .filter((answer) => answer.question_index === index)
    .forEach((answer) => {
      const normalized = (answer.answer ?? '').toString().trim().toUpperCase();
      const matchKey = Object.keys(question.options ?? {}).find((key) => key.toUpperCase() === normalized);
      if (matchKey) {
        base[matchKey] = (base[matchKey] ?? 0) + 1;
      }
    });

  return base;
}

function buildLiveSessionExportHtml(args: LiveExportArgs): string {
  const metaItems = [
    args.shareCode ? `<li><strong>Code de partage :</strong> ${escapeHtml(args.shareCode)}</li>` : '',
    `<li><strong>Participants :</strong> ${escapeHtml(args.totalParticipants)}</li>`,
    `<li><strong>Questions :</strong> ${escapeHtml(args.totalQuestions)}</li>`,
    `<li><strong>Réponses reçues :</strong> ${escapeHtml(args.totalAnswers)}</li>`,
    args.startedAt ? `<li><strong>Début :</strong> ${escapeHtml(args.startedAt)}</li>` : '',
    args.completedAt ? `<li><strong>Fin :</strong> ${escapeHtml(args.completedAt)}</li>` : '',
    args.durationLabel ? `<li><strong>Durée :</strong> ${escapeHtml(args.durationLabel)}</li>` : '',
    `<li><strong>Rapport généré :</strong> ${escapeHtml(args.generatedLabel)}</li>`,
  ].filter(Boolean).join('');

  const participantsTable = args.participantSummaries.length
    ? `
      <table class="export-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Participant</th>
            <th>Réponses données</th>
            <th>Bonnes réponses</th>
            <th>Score</th>
            <th>Questions complétées</th>
            <th>Temps actif</th>
            <th>Première réponse</th>
            <th>Dernière réponse</th>
          </tr>
        </thead>
        <tbody>
          ${args.participantSummaries
            .map((participant, index) => {
              const first = participant.firstAnswerAt ? formatDateTime(new Date(participant.firstAnswerAt)) : '—';
              const last = participant.lastAnswerAt ? formatDateTime(new Date(participant.lastAnswerAt)) : '—';
              const duration = participant.durationMs > 0 ? formatDuration(participant.durationMs) : '—';
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(participant.nickname)}</td>
                  <td>${escapeHtml(`${participant.answered}/${args.totalQuestions}`)}</td>
                  <td>${escapeHtml(participant.correct)}</td>
                  <td>${escapeHtml(`${participant.scorePercent}%`)}</td>
                  <td>${escapeHtml(`${participant.completionPercent}%`)}</td>
                  <td>${escapeHtml(duration)}</td>
                  <td>${escapeHtml(first)}</td>
                  <td>${escapeHtml(last)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
    : '<p>Aucun participant n’a encore répondu au quiz.</p>';

  const questionSections = args.questions
    .map((question, index) => {
      const stat = args.questionStats[index] ?? { correct: 0, total: 0 };
      const optionCounts = getOptionCounts(question, index, args.answers);
      const successRate = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      const correctSet = new Set<string>();
      if ('reponses_correctes' in question) {
        (question.reponses_correctes ?? []).forEach((value) => value && correctSet.add(value.toString().toUpperCase()));
      } else if ('reponse_correcte' in question && question.reponse_correcte) {
        correctSet.add(question.reponse_correcte.toString().toUpperCase());
      }

      const distributionItems = Object.entries(question.options ?? {})
        .map(([key, value]) => {
          const normalizedKey = key.toString().toUpperCase();
          const count = optionCounts[key] ?? 0;
          const plural = count > 1 ? 's' : '';
          const isCorrect = correctSet.has(normalizedKey);
          return `
            <li>
              ${isCorrect ? '✅ ' : ''}<strong>${escapeHtml(normalizedKey)}</strong>
              ${value ? `– ${escapeHtml(value)}` : ''}
              — ${escapeHtml(`${count} réponse${plural}`)}
            </li>
          `;
        })
        .join('');

      const justification = question.justification
        ? `<p class="question-note"><strong>Justification :</strong> ${escapeHtml(question.justification)}</p>`
        : '';

      return `
        <section class="export-section">
          <h2>Question ${index + 1}</h2>
          <p><strong>Intitulé :</strong> ${escapeHtml(question.question)}</p>
          <p><strong>Bonne(s) réponse(s) :</strong> ${escapeHtml(formatCorrectAnswer(question) || '—')}</p>
          <p><strong>Taux de réussite :</strong> ${escapeHtml(`${successRate}%`)} (${escapeHtml(`${stat.correct}/${stat.total}`)} corrects)</p>
          <ul class="question-distribution">${distributionItems}</ul>
          ${justification}
        </section>
      `;
    })
    .join('');

  return `
    <header class="export-header">
      <div>
        <h1>${escapeHtml(args.sessionTitle)}</h1>
        <p>Rapport de session live</p>
      </div>
    </header>
    <section class="export-section">
      <h2>Résumé de session</h2>
      <ul class="session-meta">${metaItems}</ul>
    </section>
    <section class="export-section">
      <h2>Résultats par participant</h2>
      ${participantsTable}
    </section>
    ${questionSections}
  `;
}

export default function LiveDashboardPage() {
  const params = useParams();
  const sessionId = (params?.sessionId as string) || '';

  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<QuizSession | null>(null);
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = useState<QuizQuestion | null>(null);
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier que l'utilisateur est connecté (sinon RLS refusera l'accès)
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          setError('Veuillez vous connecter pour accéder au dashboard.');
          setLoading(false);
          return;
        }

        const sessionData = await getSession(supabase, sessionId);
        if (!sessionData) {
          setError('Session introuvable.');
          setLoading(false);
          return;
        }
        setSession(sessionData);

        // Charger le quiz
        const { data: quizData } = await supabase
          .from('shared_quizzes')
          .select('*')
          .eq('id', sessionData.shared_quiz_id)
          .single();

        if (quizData) {
          setQuiz(quizData);
        }

        // Charger participants et réponses
        const [participantsData, answersData] = await Promise.all([
          getSessionParticipants(supabase, sessionId),
          getSessionAnswers(supabase, sessionId),
        ]);

        setParticipants(participantsData);
        setAnswers(answersData);
      } catch (err) {
        // Afficher plus d'infos pour diagnostiquer (code/message)
        const e = err as { message?: string; code?: string };
        console.error('Dashboard load error:', e);
        setError(
          e?.message
            ? `Erreur lors du chargement: ${e.message}${e?.code ? ` (code ${e.code})` : ''}`
            : 'Erreur lors du chargement.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, sessionId]);

  // Realtime: écoute des participants
  useEffect(() => {
    if (!sessionId) return;

    const participantsChannel = supabase
      .channel(`participants_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as SessionParticipant]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
  }, [supabase, sessionId]);

  // Realtime: écoute des réponses
  useEffect(() => {
    if (!sessionId) return;

    const answersChannel = supabase
      .channel(`answers_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_answers',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setAnswers((prev) => [...prev, payload.new as LiveAnswer]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(answersChannel);
    };
  }, [supabase, sessionId]);

  // Realtime: écoute du statut de la session
  useEffect(() => {
    if (!sessionId) return;

    const sessionChannel = supabase
      .channel(`session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new as QuizSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [supabase, sessionId]);

  const handleStart = async () => {
    if (!session) return;
    try {
      await startSession(supabase, sessionId);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du démarrage.');
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      await completeSession(supabase, sessionId);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la clôture.');
    }
  };

  const handleExportSessionPdf = () => {
    if (!quiz || !session) return;
    const sessionTitle = quiz.title ?? 'Session live';
    const shareCode = quiz.share_code ?? null;
    const generatedLabel = formatDateTime(new Date());
    const startedAt = session.started_at ? formatDateTime(new Date(session.started_at)) : undefined;
    const completedAt = session.completed_at ? formatDateTime(new Date(session.completed_at)) : undefined;
    const durationLabel = session.started_at && session.completed_at
      ? formatDuration(Math.max(0, new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()))
      : undefined;

    const body = buildLiveSessionExportHtml({
      sessionTitle,
      shareCode,
      generatedLabel,
      startedAt,
      completedAt,
      durationLabel,
      participantSummaries,
      totalParticipants: participants.length,
      totalQuestions: questions.length,
      totalAnswers: answers.length,
      questionStats,
      questions,
      answers,
    });

    openPrintableDocument({
      title: `Rapport session - ${sessionTitle}`,
      body,
      styles: LIVE_EXPORT_STYLES,
    });
  };

  const handleExportSessionWorkbook = async () => {
    if (!quiz) return;
    const participantRows = participantSummaries.map((participant) => ({
      Participant: participant.nickname,
      'Réponses données': `${participant.answered}/${questions.length}`,
      'Bonnes réponses': participant.correct,
      'Score (%)': participant.scorePercent,
      'Questions complétées (%)': participant.completionPercent,
      'Temps actif': participant.durationMs > 0 ? formatDuration(participant.durationMs) : '—',
      'Première réponse': participant.firstAnswerAt ? formatDateTime(new Date(participant.firstAnswerAt)) : '—',
      'Dernière réponse': participant.lastAnswerAt ? formatDateTime(new Date(participant.lastAnswerAt)) : '—',
    }));

    const questionRows = questions.map((question, index) => {
      const stat = questionStats[index] ?? { correct: 0, total: 0 };
      const optionCounts = getOptionCounts(question, index, answers);
      const distribution = Object.entries(question.options ?? {})
        .map(([key, value]) => {
          const count = optionCounts[key] ?? 0;
          return `${key.toString().toUpperCase()} (${count})${value ? ` – ${value}` : ''}`;
        })
        .join(' | ');

      return {
        'Question #': index + 1,
        Question: question.question,
        'Bonne(s) réponse(s)': formatCorrectAnswer(question) || '—',
        'Réponses totales': stat.total,
        'Réponses correctes': stat.correct,
        'Taux de réussite (%)': stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
        Répartition: distribution,
      };
    });

    try {
      await downloadJsonWorkbook(`rapport-session-${sessionId}`, [
        { name: 'Participants', rows: participantRows },
        { name: 'Questions', rows: questionRows },
      ]);
    } catch (error) {
      console.error('Erreur lors de l\'export Excel', error);
    }
  };

  const questions = useMemo<QuizQuestion[]>(() => (quiz?.questions as QuizQuestion[]) ?? [], [quiz]);
  const [showSolutions, setShowSolutions] = useState(true);

  // Mémorisation des statistiques par question pour éviter le recalcul à chaque render
  const questionStats = useMemo(() => {
    return questions.map((q, idx) => {
      const answersForQuestion = answers.filter((a) => a.question_index === idx);
      const correctCount = answersForQuestion.filter((a) => a.is_correct).length;
      const totalCount = answersForQuestion.length;
      return { questionIndex: idx, correct: correctCount, total: totalCount };
    });
  }, [questions, answers]);

  const participantSummaries = useMemo<ParticipantSummary[]>(() => {
    if (!participants.length) return [];
    return participants.map((participant) => {
      const participantAnswers = answers.filter((answer) => answer.participant_id === participant.id);
      const sorted = [...participantAnswers].sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime());
      const first = sorted[0]?.answered_at ?? null;
      const last = sorted[sorted.length - 1]?.answered_at ?? null;
      const durationMs = first && last ? Math.max(0, new Date(last).getTime() - new Date(first).getTime()) : 0;
      const correct = participantAnswers.filter((answer) => answer.is_correct).length;
      const answered = participantAnswers.length;
      const totalQuestions = questions.length;
      const scorePercent = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      const completionPercent = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

      return {
        id: participant.id,
        nickname: participant.nickname,
        answered,
        correct,
        scorePercent,
        completionPercent,
        durationMs,
        firstAnswerAt: first,
        lastAnswerAt: last,
      };
    });
  }, [participants, answers, questions.length]);

  const persistQuestions = async (nextQuestions: QuizQuestion[]) => {
    if (!quiz) {
      throw new Error('Quiz introuvable.');
    }

    setSavingQuestion(true);
    setQuestionFormError(null);
    try {
      const { error: updateError } = await supabase
        .from('shared_quizzes')
        .update({ questions: nextQuestions })
        .eq('id', quiz.id);

      if (updateError) {
        throw updateError;
      }

      setQuiz((prev) => (prev ? { ...prev, questions: nextQuestions } : prev));
    } finally {
      setSavingQuestion(false);
    }
  };

  const startEditQuestion = (index: number) => {
    const target = questions[index];
    if (!target) return;

    setEditingQuestionIndex(index);
    setEditQuestionDraft(JSON.parse(JSON.stringify(target)) as QuizQuestion);
    setQuestionFormError(null);
  };

  const cancelEditQuestion = () => {
    setEditingQuestionIndex(null);
    setEditQuestionDraft(null);
    setQuestionFormError(null);
  };

  const handleAddQuestion = async () => {
    const template: QuizQuestion = {
      question: 'Nouvelle question',
      options: { A: '', B: '', C: '', D: '' },
      reponse_correcte: 'A',
    };

    const nextQuestions = [...questions, template];

    try {
      await persistQuestions(nextQuestions);
      const newIndex = nextQuestions.length - 1;
      setEditingQuestionIndex(newIndex);
      setEditQuestionDraft(JSON.parse(JSON.stringify(nextQuestions[newIndex])) as QuizQuestion);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d’ajouter la question.';
      setQuestionFormError(message);
    }
  };

  const handleDeleteQuestion = async (index: number) => {
    if (!questions[index]) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Supprimer cette question ?');
    if (!confirmed) return;

    const nextQuestions = questions.filter((_, idx) => idx !== index);
    try {
      await persistQuestions(nextQuestions);
      cancelEditQuestion();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de supprimer la question.';
      setQuestionFormError(message);
    }
  };

  const handleOptionChange = (optionKey: string, value: string) => {
    if (!editQuestionDraft) return;
    setEditQuestionDraft({
      ...editQuestionDraft,
      options: {
        ...editQuestionDraft.options,
        [optionKey]: value,
      },
    });
  };

  const handleSelectCorrect = (optionKey: string, checked: boolean) => {
    if (!editQuestionDraft) return;

    if ('reponses_correctes' in editQuestionDraft) {
      const updated = new Set(editQuestionDraft.reponses_correctes ?? []);
      if (checked) {
        updated.add(optionKey);
      } else {
        updated.delete(optionKey);
      }
      setEditQuestionDraft({
        ...editQuestionDraft,
        reponses_correctes: Array.from(updated),
      });
    } else if ('reponse_correcte' in editQuestionDraft) {
      setEditQuestionDraft({
        ...editQuestionDraft,
        reponse_correcte: optionKey,
      });
    }
  };

  const handleSaveQuestion = async () => {
    if (editingQuestionIndex === null || !editQuestionDraft) return;

    const trimmedQuestion = editQuestionDraft.question?.trim() ?? '';
    if (!trimmedQuestion) {
      setQuestionFormError('La question ne peut pas être vide.');
      return;
    }

    const sanitizedOptions = Object.fromEntries(
      Object.entries(editQuestionDraft.options ?? {}).map(([key, value]) => [key, (value ?? '').toString()])
    ) as Record<string, string>;

    if (Object.values(sanitizedOptions).every((v) => v.trim() === '')) {
      setQuestionFormError('Ajoute au moins une proposition.');
      return;
    }

    const updatedDraft = {
      ...editQuestionDraft,
      question: trimmedQuestion,
      options: sanitizedOptions,
    } as QuizQuestion;

    if ('reponses_correctes' in updatedDraft) {
      const valid = Array.from(new Set((updatedDraft.reponses_correctes ?? []).filter((key) => sanitizedOptions[key] !== undefined)));
      if (valid.length === 0) {
        setQuestionFormError('Sélectionne au moins une bonne réponse.');
        return;
      }
      updatedDraft.reponses_correctes = valid;
    } else if ('reponse_correcte' in updatedDraft) {
      if (!sanitizedOptions[updatedDraft.reponse_correcte]) {
        const fallback = Object.keys(sanitizedOptions)[0];
        if (!fallback) {
          setQuestionFormError('Sélectionne une bonne réponse.');
          return;
        }
        updatedDraft.reponse_correcte = fallback;
      }
    }

    const nextQuestions = questions.map((q, idx) => (idx === editingQuestionIndex ? updatedDraft : q));

    try {
      await persistQuestions(nextQuestions);
      setEditingQuestionIndex(null);
      setEditQuestionDraft(null);
      setQuestionFormError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de sauvegarder la question.';
      setQuestionFormError(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">Chargement du dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-brand-dark">{quiz?.title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Code: <span className="font-mono font-bold">{quiz?.share_code}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {session?.status === 'waiting' && (
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Démarrer le Quiz
                </button>
              )}
              {session?.status === 'active' && (
                <button
                  type="button"
                  onClick={handleComplete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Terminer le Quiz
                </button>
              )}
              {session?.status === 'completed' && (
                <span className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-medium">
                  Terminé
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-brand-yellow-light p-4 rounded-lg">
              <p className="text-sm text-gray-600">Participants</p>
              <p className="text-3xl font-heading font-bold text-brand-yellow">{participants.length}</p>
            </div>
            <div className="bg-brand-teal-light p-4 rounded-lg">
              <p className="text-sm text-gray-600">Questions</p>
              <p className="text-3xl font-heading font-bold text-brand-teal">{questions.length}</p>
            </div>
            <div className="bg-brand-yellow-light p-4 rounded-lg">
              <p className="text-sm text-gray-600">Réponses reçues</p>
              <p className="text-3xl font-heading font-bold text-brand-yellow">{answers.length}</p>
            </div>
          </div>

          {session?.status === 'completed' && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={handleExportSessionPdf}
                className="w-full sm:w-auto px-4 py-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md border border-yellow-300 shadow-sm transition"
              >
                Exporter le rapport PDF
              </button>
              <button
                type="button"
                onClick={() => { void handleExportSessionWorkbook(); }}
                className="w-full sm:w-auto px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-md shadow-sm transition"
              >
                Exporter les résultats (Excel)
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participants */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-heading font-bold text-brand-dark mb-4">
              Participants ({participants.length})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {participants.map((p) => {
                const participantAnswers = answers.filter((a) => a.participant_id === p.id);
                const correctAnswers = participantAnswers.filter((a) => a.is_correct).length;
                const progress = questions.length > 0 ? (participantAnswers.length / questions.length) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                    onClick={() => setSelectedParticipantId(p.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-800">{p.nickname}</p>
                      <p className="text-xs text-gray-500">
                        {participantAnswers.length} / {questions.length} réponses
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-yellow">
                        {correctAnswers} / {participantAnswers.length}
                      </p>
                      <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-brand-yellow h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {participants.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucun participant pour le moment.</p>
              )}
            </div>
          </div>

          {/* Statistiques par question */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-heading font-bold text-brand-dark mb-4">
              Statistiques par Question
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {questionStats.map((stat) => {
                const percentage = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
                return (
                  <div key={stat.questionIndex} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium text-gray-800">
                        Question {stat.questionIndex + 1}
                      </p>
                      <p className="text-sm text-gray-600">
                        {stat.correct} / {stat.total} correct
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          percentage >= 75
                            ? 'bg-green-500'
                            : percentage >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {percentage.toFixed(0)}% de réussite
                    </p>
                  </div>
                );
              })}
              {questions.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucune question.</p>
              )}
            </div>
          </div>
        </div>

        {/* Questions + Corrections */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl font-heading font-bold text-brand-dark">Questions et corrections</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={savingQuestion}
                className="px-3 py-1 text-sm bg-brand-teal text-white rounded-md hover:bg-brand-teal-dark disabled:opacity-50"
              >
                Ajouter une question
              </button>
              <button
                type="button"
                onClick={() => setShowSolutions((v) => !v)}
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
              >
                {showSolutions ? 'Masquer les corrections' : 'Afficher les corrections'}
              </button>
            </div>
          </div>

          {questionFormError && (
            <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {questionFormError}
            </div>
          )}
          {savingQuestion && (
            <p className="mb-4 text-sm text-gray-500">Sauvegarde en cours...</p>
          )}

          {questions.length === 0 ? (
            <p className="text-gray-500">Aucune question à afficher.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const isEditing = editingQuestionIndex === idx;
                const draft = isEditing && editQuestionDraft ? editQuestionDraft : q;
                const optionsEntries = Object.entries(draft.options || {});
                const answersForQuestion = answers.filter((a) => a.question_index === idx);
                const total = answersForQuestion.length;
                const optionCountByKey = optionsEntries.reduce<Record<string, number>>((acc, [key]) => {
                  acc[key] = 0;
                  return acc;
                }, {});
                const optionLookup = optionsEntries.reduce<Record<string, string>>((acc, [key]) => {
                  acc[key.toUpperCase()] = key;
                  return acc;
                }, {});
                answersForQuestion.forEach((a) => {
                  const lookupKey = optionLookup[(a.answer ?? '').toUpperCase()];
                  if (lookupKey) {
                    optionCountByKey[lookupKey] += 1;
                  }
                });
                const correctSet = new Set(
                  ('reponses_correctes' in draft
                    ? (draft.reponses_correctes ?? [])
                    : [draft.reponse_correcte ?? '']
                  ).map((value) => value?.toUpperCase())
                );

                return (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          Question {idx + 1}
                        </p>
                        {isEditing ? (
                          <textarea
                            value={draft.question}
                            onChange={(event) =>
                              setEditQuestionDraft((prev) =>
                                prev ? { ...prev, question: event.target.value } : prev
                              )
                            }
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-yellow text-sm"
                            rows={3}
                          />
                        ) : (
                          <p className="text-gray-800 mt-1">{q.question}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {!isEditing && showSolutions && (
                          <span className="inline-block px-2 py-1 text-xs font-bold rounded-md bg-green-100 text-green-700">
                            Réponse: {'reponse_correcte' in q ? q.reponse_correcte : (q.reponses_correctes ?? []).join(', ')}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleSaveQuestion}
                                disabled={savingQuestion}
                                className="px-3 py-1 text-sm bg-brand-yellow text-brand-dark rounded-md hover:bg-brand-yellow-dark disabled:opacity-50"
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditQuestion}
                                disabled={savingQuestion}
                                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
                              >
                                Annuler
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditQuestion(idx)}
                                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(idx)}
                                className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 space-y-3">
                        <div className="space-y-3">
                          {optionsEntries.map(([key, value]) => {
                            const normalized = key.toUpperCase();
                            const isMulti = 'reponses_correctes' in draft;
                            const isSelected = isMulti
                              ? (draft.reponses_correctes ?? []).some((c) => c.toUpperCase() === normalized)
                              : (draft.reponse_correcte ?? '').toUpperCase() === normalized;
                            return (
                              <div key={key} className="flex items-start gap-3">
                                <input
                                  type={isMulti ? 'checkbox' : 'radio'}
                                  name={isMulti ? `option-${idx}-${key}` : `correct-${idx}`}
                                  checked={isSelected}
                                  onChange={(event) =>
                                    handleSelectCorrect(key, isMulti ? event.target.checked : true)
                                  }
                                  className="mt-2 h-4 w-4"
                                />
                                <input
                                  type="text"
                                  value={value ?? ''}
                                  onChange={(event) => handleOptionChange(key, event.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-yellow text-sm"
                                  placeholder={`Proposition ${key}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {optionsEntries.map(([key, value]) => {
                            const normalized = key.toUpperCase();
                            const count = optionCountByKey[key] ?? 0;
                            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                            const isCorrect = correctSet.has(normalized);
                            return (
                              <div
                                key={`${idx}-${key}`}
                                className={`p-3 rounded-md border ${
                                  isCorrect && showSolutions ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-gray-900">
                                    <span className="font-bold text-brand-yellow mr-2">{key}:</span>
                                    {value}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {count} réponses{total > 0 ? ` • ${percent}%` : ''}
                                  </p>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                  <div
                                    className={`${isCorrect && showSolutions ? 'bg-green-500' : 'bg-brand-yellow'} h-2 rounded-full`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {showSolutions && q.justification && (
                          <p className="text-sm text-gray-600 mt-3">
                            Justification: {q.justification}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Popup: Détails réponses par élève */}
        {selectedParticipantId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-heading font-bold text-brand-dark">Réponses de l&apos;élève</h3>
                <button
                  type="button"
                  onClick={() => setSelectedParticipantId(null)}
                  className="p-2 rounded hover:bg-gray-100"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {(() => {
                  const participant = participants.find((pp) => pp.id === selectedParticipantId);
                  const pa = answers
                    .filter((a) => a.participant_id === selectedParticipantId)
                    .sort((a, b) => a.question_index - b.question_index);

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Élève:</span>
                        <span className="font-semibold text-gray-900">{participant?.nickname}</span>
                      </div>

                      {questions.map((q, idx) => {
                        const a = pa.find((x) => x.question_index === idx);
                        const chosen = a?.answer?.toUpperCase();
                        const correctAnswer = 'reponse_correcte' in q ? q.reponse_correcte : (q.reponses_correctes?.[0] ?? '');
                        const correct = (correctAnswer || '').toUpperCase();
                        // const isCorrect = chosen && chosen === correct; // non utilisé, conservé via couleurs ci-dessous
                        const letters = ['A','B','C','D'] as const;
                        const opts = Object.entries(q.options || {});
                        return (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
                            <p className="font-medium text-gray-900 mb-2">Question {idx + 1}: {q.question}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {opts.map(([key, value], i) => {
                                const letter = letters[i] ?? 'A';
                                const isChosen = chosen === letter;
                                const isCorr = letter === correct;
                                return (
                                  <div
                                    key={`${idx}-${key}-${i}`}
                                    className={`p-2 rounded-md border text-sm ${
                                      isChosen ? (isCorr ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                                      : isCorr ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                                    }`}
                                  >
                                    <span className="font-bold text-brand-yellow mr-2">{letter}:</span>
                                    {value}
                                    {isChosen && (
                                      <span className={`ml-2 text-xs font-semibold ${isCorr ? 'text-green-700' : 'text-red-700'}`}>
                                        {isCorr ? 'Correct' : 'Choisie'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="p-4 border-t flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedParticipantId(null)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
