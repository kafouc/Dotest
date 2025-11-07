'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  getSharedQuizByCode,
  getActiveSessionByShareCode,
  joinSession,
  submitLiveAnswer,
  type SharedQuiz,
  type QuizSession,
  type SessionParticipant,
} from '@/lib/liveQuiz';
import { motion, AnimatePresence } from 'framer-motion';

type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

export default function JoinCodePage() {
  const params = useParams();
  const code = (params?.code as string) || '';
  
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participant, setParticipant] = useState<SessionParticipant | null>(null);
  
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);

  // Charger le quiz et la session
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const quizData = await getSharedQuizByCode(supabase, code);
        if (!quizData) {
          setError('Quiz introuvable ou expiré.');
          setLoading(false);
          return;
        }
        setQuiz(quizData);

        // Récupérer la session active via RPC (bypass RLS pour les élèves)
        const active = await getActiveSessionByShareCode(supabase, code);
        if (active && active.session_id) {
          // Construire un objet minimal de session; il sera remplacé par Realtime lors d'un update
          setSession({
            id: active.session_id,
            shared_quiz_id: quizData.id,
            status: active.status as QuizSession['status'],
            started_at: active.started_at,
            completed_at: null,
            created_at: new Date().toISOString(),
          });
        } else {
          setError('Aucune session active pour ce quiz.');
        }
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement du quiz.');
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [supabase, code]);

  // Écoute Realtime du statut de la session
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`session_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(payload.new as QuizSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !nickname.trim()) return;

    try {
      const p = await joinSession(supabase, {
        sessionId: session.id,
        nickname: nickname.trim(),
      });
      setParticipant(p);
      setHasJoined(true);
    } catch (err) {
      console.error(err);
      alert('Impossible de rejoindre. Le pseudo est peut-être déjà pris.');
    }
  };

  const questions = useMemo(() => (quiz?.questions as QuizQuestion[]) || [], [quiz]);
  const currentQuestion = questions[currentQuestionIndex];

  const normalizeLetter = (val: string): string => {
    const s = (val ?? '').toString().trim().toUpperCase();
    const m = s.match(/^[\s\(\[]*([ABCD])/);
    return m ? m[1] : s;
  };

  const handleSelectAnswer = useCallback(
    async (optionKey: string) => {
      if (!participant || !session || selectedAnswers[currentQuestionIndex]) return;

      const newAnswers = {
        ...selectedAnswers,
        [currentQuestionIndex]: optionKey,
      };
      setSelectedAnswers(newAnswers);

      // Soumettre la réponse
      const correctAnswer = currentQuestion.reponse_correcte;
      const isCorrect = normalizeLetter(optionKey) === normalizeLetter(correctAnswer);

      try {
        await submitLiveAnswer(supabase, {
          sessionId: session.id,
          participantId: participant.id,
          questionIndex: currentQuestionIndex,
          answer: optionKey,
          answerText: currentQuestion.options[optionKey] || null,
          isCorrect,
        });
      } catch (err) {
        console.error('Erreur soumission réponse:', err);
      }

      // Passer à la question suivante
      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          // Quiz terminé
          let finalScore = 0;
          questions.forEach((q, idx) => {
            const userAnswer = newAnswers[idx];
            if (userAnswer && normalizeLetter(userAnswer) === normalizeLetter(q.reponse_correcte)) {
              finalScore++;
            }
          });
          setScore(finalScore);
          setQuizFinished(true);
        }
      }, 500);
    },
    [
      participant,
      session,
      selectedAnswers,
      currentQuestionIndex,
      currentQuestion,
      questions,
      supabase,
    ]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
        <p className="text-lg text-gray-700">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-brand-purple-dark mb-4 text-center">
            {quiz?.title}
          </h1>
          <p className="text-gray-600 text-center mb-6">
            {session?.status === 'waiting' && 'En attente du démarrage...'}
            {session?.status === 'active' && 'Le quiz a commencé !'}
            {session?.status === 'completed' && 'Ce quiz est terminé.'}
          </p>

          {session?.status !== 'completed' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Votre pseudo
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ex: Alexandre"
                  maxLength={30}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-brand-purple text-white font-bold rounded-md hover:bg-brand-purple-dark"
              >
                Rejoindre
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (session?.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-brand-purple-dark mb-4">
            Bienvenue, {participant?.nickname} !
          </h2>
          <p className="text-gray-600">
            En attente du démarrage du quiz par le professeur...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="animate-pulse flex space-x-2">
              <div className="w-3 h-3 bg-brand-purple rounded-full"></div>
              <div className="w-3 h-3 bg-brand-pink rounded-full"></div>
              <div className="w-3 h-3 bg-brand-purple rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (quizFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-8 max-w-md w-full text-center"
        >
          <h2 className="text-2xl font-bold text-brand-purple-dark mb-4">
            Quiz Terminé !
          </h2>
          <p className="text-4xl font-bold mb-6">
            <span className="text-brand-pink-dark">
              {score} / {questions.length}
            </span>
          </p>
          <p className="text-gray-600">
            Votre professeur peut maintenant voir vos résultats.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const letters = ['A', 'B', 'C', 'D'] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-brand-purple-dark">
              Question {currentQuestionIndex + 1} / {questions.length}
            </h2>
            <span className="text-sm text-gray-600">{participant?.nickname}</span>
          </div>

          <p className="text-lg text-gray-800 mb-6">{currentQuestion.question}</p>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {Object.entries(currentQuestion.options).map(([key, value], idx) => {
                const letter = letters[idx] ?? 'A';
                const isAnswerSelected = selectedAnswers[currentQuestionIndex] !== undefined;
                const isThisOptionSelected = selectedAnswers[currentQuestionIndex] === letter;

                return (
                  <motion.button
                    key={`${key}-${idx}`}
                    onClick={() => handleSelectAnswer(letter)}
                    disabled={isAnswerSelected}
                    className={`w-full p-4 text-left font-medium border rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-purple-dark ${
                      isAnswerSelected ? 'cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      isThisOptionSelected
                        ? 'bg-brand-purple-light border-brand-purple-dark ring-2 ring-brand-purple-dark'
                        : 'border-gray-300 hover:bg-purple-50'
                    }`}
                    whileHover={isAnswerSelected ? {} : { scale: 1.02 }}
                    whileTap={isAnswerSelected ? {} : { scale: 0.98 }}
                  >
                    <span className="font-bold text-brand-purple mr-2">{letter}:</span>
                    {value}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
