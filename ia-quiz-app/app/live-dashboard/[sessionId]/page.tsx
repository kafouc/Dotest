'use client';

import { useState, useEffect } from 'react';
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

type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

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

  const questions = (quiz?.questions as QuizQuestion[]) || [];
  const [showSolutions, setShowSolutions] = useState(true);
  const letters = ['A', 'B', 'C', 'D'] as const;

  // Statistiques par question
  const questionStats = questions.map((q, idx) => {
    const answersForQuestion = answers.filter((a) => a.question_index === idx);
    const correctCount = answersForQuestion.filter((a) => a.is_correct).length;
    const totalCount = answersForQuestion.length;
    return { questionIndex: idx, correct: correctCount, total: totalCount };
  });

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
              <h1 className="text-2xl font-bold text-brand-purple-dark">{quiz?.title}</h1>
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
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Participants</p>
              <p className="text-3xl font-bold text-brand-purple">{participants.length}</p>
            </div>
            <div className="bg-pink-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Questions</p>
              <p className="text-3xl font-bold text-brand-pink">{questions.length}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Réponses reçues</p>
              <p className="text-3xl font-bold text-blue-600">{answers.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participants */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-brand-purple-dark mb-4">
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
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{p.nickname}</p>
                      <p className="text-xs text-gray-500">
                        {participantAnswers.length} / {questions.length} réponses
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-purple">
                        {correctAnswers} / {participantAnswers.length}
                      </p>
                      <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-brand-purple h-2 rounded-full transition-all"
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
            <h2 className="text-xl font-bold text-brand-purple-dark mb-4">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand-purple-dark">Questions et corrections</h2>
            <button
              type="button"
              onClick={() => setShowSolutions((v) => !v)}
              className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
            >
              {showSolutions ? 'Masquer les corrections' : 'Afficher les corrections'}
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="text-gray-500">Aucune question à afficher.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const answersForQuestion = answers.filter((a) => a.question_index === idx);
                const total = answersForQuestion.length;
                const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
                answersForQuestion.forEach((a) => {
                  const key = (a.answer || '').toUpperCase();
                  if (optionCounts[key] !== undefined) optionCounts[key] += 1;
                });

                // Options: on respecte l'ordre utilisé côté élève (A-D)
                const opts = Object.entries(q.options || {});

                return (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Question {idx + 1}
                        </p>
                        <p className="text-gray-800 mt-1">{q.question}</p>
                      </div>
                      {showSolutions && (
                        <span className="shrink-0 inline-block px-2 py-1 text-xs font-bold rounded-md bg-green-100 text-green-700">
                          Réponse: {q.reponse_correcte}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {opts.map(([key, value], i) => {
                        const letter = letters[i] ?? 'A';
                        const count = optionCounts[letter] ?? 0;
                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isCorrect = letter.toUpperCase() === (q.reponse_correcte || '').toUpperCase();
                        return (
                          <div
                            key={`${idx}-${key}-${i}`}
                            className={`p-3 rounded-md border ${
                              isCorrect && showSolutions ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">
                                <span className="font-bold text-brand-purple mr-2">{letter}:</span>
                                {value}
                              </p>
                              <p className="text-sm text-gray-600">
                                {count} réponses{total > 0 ? ` • ${percent}%` : ''}
                              </p>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div
                                className={`${isCorrect && showSolutions ? 'bg-green-500' : 'bg-brand-purple'} h-2 rounded-full`}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
