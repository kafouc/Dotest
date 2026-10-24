'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { startSession, completeSession } from '@/lib/liveQuiz';
import type { QuizQuestion } from '@/lib/quiz.types';
import { openPrintableDocument, formatDateTime, formatDuration, downloadJsonWorkbook } from '@/lib/exporters';
import {
  LIVE_EXPORT_STYLES,
  buildLiveSessionExportHtml,
  computeParticipantSummaries,
  computeQuestionStats,
  formatCorrectAnswer,
  getOptionCounts,
} from '@/lib/liveReport';
import { useLiveSession } from '@/hooks/useLiveSession';
import { useQuestionEditor } from '@/hooks/useQuestionEditor';
import { logger } from '@/lib/logger';
import ToastContainer, { useToast } from '@/components/ui/Toast';

export default function LiveDashboardPage() {
  const params = useParams();
  const sessionId = (params?.sessionId as string) || '';

  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { loading, error, session, quiz, setQuiz, participants, answers } = useLiveSession(supabase, sessionId);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  const handleStart = async () => {
    if (!session) return;
    try {
      await startSession(supabase, sessionId);
      showToast('Session démarrée.', 'success');
    } catch (err) {
      logger.error('Action session live échouée', err instanceof Error ? err : { err: String(err) });
      showToast('Erreur lors du démarrage.', 'error');
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      await completeSession(supabase, sessionId);
      showToast('Session clôturée.', 'success');
    } catch (err) {
      logger.error('Action session live échouée', err instanceof Error ? err : { err: String(err) });
      showToast('Erreur lors de la clôture.', 'error');
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
      showToast('Export Excel prêt.', 'success');
    } catch (error) {
      logger.error('Erreur lors de l\'export Excel', error instanceof Error ? error : { error: String(error) });
      showToast('Erreur lors de l\'export Excel.', 'error');
    }
  };

  const questions = useMemo<QuizQuestion[]>(() => (quiz?.questions as QuizQuestion[]) ?? [], [quiz]);
  const [showSolutions, setShowSolutions] = useState(true);

  const questionStats = useMemo(() => computeQuestionStats(questions, answers), [questions, answers]);
  const participantSummaries = useMemo(
    () => computeParticipantSummaries(participants, answers, questions.length),
    [participants, answers, questions.length]
  );

  const editor = useQuestionEditor(supabase, quiz, questions, setQuiz);
  const {
    editingIndex: editingQuestionIndex,
    draft: editQuestionDraft,
    setDraft: setEditQuestionDraft,
    formError: questionFormError,
    saving: savingQuestion,
    startEdit: startEditQuestion,
    cancelEdit: cancelEditQuestion,
    addQuestion: handleAddQuestion,
    deleteQuestion: handleDeleteQuestion,
    changeOption: handleOptionChange,
    selectCorrect: handleSelectCorrect,
    saveQuestion: handleSaveQuestion,
  } = editor;

  if (loading) {
    return (
      <>
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p className="text-lg text-gray-700">Chargement du dashboard...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 py-8">
      <ToastContainer toasts={toasts} onClose={removeToast} />
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
