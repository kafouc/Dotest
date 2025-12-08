'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { recordQuizAttempt, type AttemptContext, type AnswerInput } from '@/lib/scores';
import type { QuizQuestion } from '@/lib/quiz.types';
import { QUIZ_CONFIG } from '@/lib/constants';
import { normalizeLetter, calculateQuizScore, isAnswerCorrect } from '@/lib/utils';

// Props que le composant reçoit
type QuizAttemptProps = {
  quizQuestions: QuizQuestion[];
  onQuizEnd: () => void; // Fonction pour retourner au générateur
  context?: AttemptContext;
};

export default function QuizAttempt({
  quizQuestions,
  onQuizEnd,
  context,
}: QuizAttemptProps) {
  // --- États ---
  const [supabase] = useState(() => createSupabaseBrowserClient()); // Client Supabase
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Index question actuelle
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: string;
  }>({}); // Réponses utilisateur
  const [quizFinished, setQuizFinished] = useState(false); // Statut du quiz
  const [score, setScore] = useState(0); // Score final

  const currentQuestion = quizQuestions[currentQuestionIndex];

  // --- Logique de gestion des réponses ---
  const handleSelectAnswer = (optionKey: string) => {
    // N'autorise pas à changer la réponse si déjà sélectionnée
    if (selectedAnswers[currentQuestionIndex]) return;

    // Enregistre la réponse
    const newAnswers = {
      ...selectedAnswers,
      [currentQuestionIndex]: optionKey,
    };
    setSelectedAnswers(newAnswers);

    // Pause pour feedback (peut être amélioré avec CSS)
    setTimeout(() => {
      // Vérifie si c'est la dernière question
      if (currentQuestionIndex < quizQuestions.length - 1) {
        // Passe à la question suivante
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // Termine le quiz
        setQuizFinished(true);
      }
    }, QUIZ_CONFIG.ANSWER_FEEDBACK_DELAY_MS);
  };

  // --- Effet de fin de quiz (Calcul + Sauvegarde) ---
  useEffect(() => {
    // Ne s'exécute que lorsque le quiz vient de se terminer
    if (!quizFinished) return;

    let isMounted = true;

    // 1. Calculer le score
    const currentScore = calculateQuizScore(quizQuestions, selectedAnswers);
    setScore(currentScore);

    // 2. Sauvegarder la tentative dans Supabase (fonction asynchrone)
    const saveAttempt = async () => {
      if (!isMounted) return;
      
      try {
        // Prépare les réponses détaillées
        const answers: AnswerInput[] = quizQuestions.map((q, idx) => {
          const userLetter = (selectedAnswers[idx] ?? null) as string | null;
          const correctLetter = q.reponse_correcte;
          return {
            questionIndex: idx,
            question: q.question,
            answer: userLetter,
            correctAnswer: correctLetter,
            justification: q.justification,
            isCorrect: isAnswerCorrect(userLetter, correctLetter),
          };
        });

        await recordQuizAttempt(supabase, {
          answers,
          context: context ?? { num_questions: quizQuestions.length },
        });
      } catch (e) {
        if (isMounted) {
          console.error('Erreur lors de la sauvegarde détaillée du quiz:', e);
        }
      }
    };

    saveAttempt(); // Appelle la fonction de sauvegarde

    return () => {
      isMounted = false;
    };
  }, [quizFinished, quizQuestions, selectedAnswers, supabase, context]);

  // --- Animations Framer Motion ---
  const questionVariants = {
    initial: { opacity: 0, x: 100 }, // Commence invisible et à droite
    animate: { opacity: 1, x: 0 }, // Apparaît au centre
    exit: { opacity: 0, x: -100 }, // Disparaît à gauche
  };

  // --- Rendu JSX ---

  // Affichage 1 : Écran des Résultats
  if (quizFinished) {
    return (
      <motion.div
        key="results"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 bg-brand-yellow-light rounded-lg shadow-lg text-center"
      >
        <h2 className="text-2xl font-heading font-bold text-brand-dark mb-4">
          Quiz Terminé !
        </h2>
        <p className="text-4xl font-bold mb-6">
          Votre Score :
          <span className="text-brand-teal-dark ml-2">
            {score} / {quizQuestions.length}
          </span>
        </p>

        {/* Revue des questions */}
        <div className="text-left my-6 space-y-4 max-h-60 overflow-y-auto pr-2">
          {' '}
          {/* Ajout de scroll */}
          <h3 className="text-xl font-heading font-semibold text-brand-dark">
            Revue des questions :
          </h3>
          {quizQuestions.map((q, index) => {
            const userAnswer = selectedAnswers[index];
            const isCorrect = isAnswerCorrect(userAnswer ?? null, q.reponse_correcte);
            return (
              <div
                key={index}
                className="p-3 bg-white rounded shadow-sm border border-brand-yellow"
              >
                <p className="font-semibold">
                  {index + 1}. {q.question}
                </p>
                <p
                  className={`text-sm mt-1 font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}
                >
                  Votre réponse : {userAnswer || 'Aucune'}
                  {isCorrect ? ' (Correct)' : ' (Incorrect)'}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-green-700">
                    Bonne réponse : {q.reponse_correcte}
                  </p>
                )}
                {q.justification && (
                  <p className="text-xs italic text-gray-600 mt-1">
                    Justification : {q.justification}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bouton pour recommencer */}
        <button
          onClick={onQuizEnd} // Revient à l'écran de génération
          className="mt-4 px-6 py-2 cursor-pointer bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-heading font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
        >
          Refaire un quiz
        </button>
      </motion.div>
    );
  }

  // Affichage 2 : Question Actuelle
  return (
    <div className="relative overflow-hidden p-1">
      {' '}
      {/* Conteneur pour l'animation */}
      <AnimatePresence mode="wait">
        {' '}
        {/* Attend la fin de l'exit avant l'animate */}
        <motion.div
          key={currentQuestionIndex} // L'animation se déclenche quand cette clé change
          variants={questionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full"
        >
          <div className="p-6 bg-white rounded-lg shadow-lg border border-brand-yellow">
            {/* Header de la question */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-heading font-semibold text-brand-dark">
                Question {currentQuestionIndex + 1} / {quizQuestions.length}
              </h2>
              <span className="px-3 py-1 bg-brand-teal-light text-brand-teal-dark font-medium rounded-full text-sm">
                QCM
              </span>
            </div>

            {/* Texte de la question */}
            <p className="text-lg text-gray-800 mb-6 min-h-[60px]">
              {currentQuestion.question}
            </p>

            {/* Options de réponse */}
            <div className="space-y-3">
              {Object.entries(currentQuestion.options).map(([key, value], idx) => {
                // On force la lettre A-D selon l'ordre d'affichage pour éviter les clés numériques
                const letter = QUIZ_CONFIG.OPTION_LETTERS[idx] ?? 'A';

                const isAnswerSelected = selectedAnswers[currentQuestionIndex] !== undefined;
                const isThisOptionSelected = selectedAnswers[currentQuestionIndex] === letter;

                return (
                  <motion.button
                    key={`${key}-${idx}`}
                    onClick={() => handleSelectAnswer(letter)}
                    disabled={isAnswerSelected}
                    className={`w-full p-4 text-left font-medium border rounded-lg
                                shadow-sm transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-brand-yellow
                                ${isAnswerSelected ? 'cursor-not-allowed' : 'cursor-pointer'}
                                ${isThisOptionSelected ? 'bg-brand-yellow-light border-brand-yellow ring-2 ring-brand-yellow' : 'border-gray-300'}
                              `}
                    whileHover={isAnswerSelected ? {} : { scale: 1.02, backgroundColor: '#F3E8FF' }}
                    whileTap={isAnswerSelected ? {} : { scale: 0.98 }}
                  >
                    <span className="font-bold text-brand-yellow mr-2">
                      {letter}:
                    </span>{' '}
                    {value}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
