'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { recordQuizAttempt, type AttemptContext, type AnswerInput } from '@/lib/scores';
import type { QuizQuestion } from '@/lib/quiz.types';
import { QUIZ_CONFIG } from '@/lib/constants';
import { calculateQuizScore, isAnswerCorrect } from '@/lib/utils';
import { initCardState, scheduleReview, getMetrics } from '@/lib/fsrs';

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
    [key: number]: string | string[];
  }>({}); // Réponses utilisateur (QCU/VF: string, QCM: string[])
  const [quizFinished, setQuizFinished] = useState(false); // Statut du quiz
  const [score, setScore] = useState(0); // Score final
  const [documentPathOnStart] = useState(context?.document_path); // Figer le document au démarrage

  const currentQuestion = quizQuestions[currentQuestionIndex];

  // Détection du changement de document pendant le quiz
  useEffect(() => {
    if (context?.document_path && documentPathOnStart && context.document_path !== documentPathOnStart) {
      // L'utilisateur a changé de document pendant le quiz, on annule
      console.warn('Document changé pendant le quiz, annulation de la tentative');
      onQuizEnd(); // Retour au générateur
    }
  }, [context?.document_path, documentPathOnStart, onQuizEnd]);

  // --- Logique de gestion des réponses ---
  const isQCM = 'reponses_correctes' in currentQuestion;
  const isUnique = 'reponse_correcte' in currentQuestion;
  const isVF = isUnique && (currentQuestion.reponse_correcte === 'VRAI' || currentQuestion.reponse_correcte === 'FAUX');

  const handleSelectAnswer = (optionKey: string) => {
    if (isQCM) {
      const existing = selectedAnswers[currentQuestionIndex];
      const arr = Array.isArray(existing) ? [...existing] : [];
      const idx = arr.indexOf(optionKey);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(optionKey);
      }
      setSelectedAnswers({ ...selectedAnswers, [currentQuestionIndex]: arr });
      return;
    }

    // QCU / VF: une seule sélection et avance
    if (selectedAnswers[currentQuestionIndex]) return;
    const newAnswers = { ...selectedAnswers, [currentQuestionIndex]: optionKey };
    setSelectedAnswers(newAnswers);
    setTimeout(() => {
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
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
      
      // Vérification de sécurité: le document n'a pas changé pendant le quiz
      if (context?.document_path && documentPathOnStart && context.document_path !== documentPathOnStart) {
        console.warn('Document changé, sauvegarde annulée');
        return;
      }
      
      try {
        // Prépare les réponses détaillées
        const answers: AnswerInput[] = quizQuestions.map((q, idx) => {
          const userAnswer = (selectedAnswers[idx] ?? null) as string | null;
          // Utiliser le bon format pour l'évaluation et l'export
          const correctForEval = 'reponses_correctes' in q ? q.reponses_correctes : q.reponse_correcte;
          const correctForStore = Array.isArray(correctForEval) ? correctForEval.join(',') : correctForEval;
          return {
            questionIndex: idx,
            question: q.question,
            answer: userAnswer,
            correctAnswer: correctForStore,
            justification: q.justification,
            isCorrect: isAnswerCorrect(userAnswer, correctForEval as string | string[]),
          };
        });

        const now = new Date();
        // Compute FSRS schedule suggestions per question (not persisted yet)
        const fsrs = quizQuestions.map((q, idx) => {
          const isCorrect = isAnswerCorrect((selectedAnswers[idx] ?? null) as string | null, ('reponse_correcte' in q ? q.reponse_correcte : ''));
          const rating = isCorrect ? 3 : 1; // Easy if correct, Hard if wrong (simplified)
          const state = initCardState(now);
          const scheduled = scheduleReview(state, rating, now);
          const metrics = getMetrics(state, now);
          return {
            index: idx,
            nextReviewAt: scheduled.nextReviewAt,
            nextIntervalDays: scheduled.nextIntervalDays,
            stability: scheduled.newStability,
            retrievability: metrics.R,
          };
        });

        await recordQuizAttempt(supabase, {
          answers,
          context: context ?? { num_questions: quizQuestions.length },
        });

        // Optionally: we could store fsrs per item in a dedicated table. For now, log.
        console.log('FSRS schedule preview:', fsrs);
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
  }, [quizFinished, quizQuestions, selectedAnswers, supabase, context, documentPathOnStart]);

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
            const correctRef = ('reponses_correctes' in q) ? q.reponses_correctes : q.reponse_correcte;
            const isCorrect = isAnswerCorrect((Array.isArray(userAnswer) ? userAnswer.join(',') : (userAnswer as string) ?? null), correctRef as string | string[]);
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
                  Votre réponse : {Array.isArray(userAnswer) ? (userAnswer.length ? userAnswer.join(', ') : 'Aucune') : (userAnswer || 'Aucune')}
                  {isCorrect ? ' (Correct)' : ' (Incorrect)'}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-green-700">
                    Bonne réponse : {Array.isArray(correctRef) ? correctRef.join(', ') : correctRef}
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
                {isQCM ? 'QCM' : isVF ? 'Vrai/Faux' : 'QCU'}
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
                const letter = (isVF ? (idx === 0 ? 'VRAI' : 'FAUX') : (QUIZ_CONFIG.OPTION_LETTERS[idx] ?? 'A')) as string;

                const currentSelected = selectedAnswers[currentQuestionIndex];
                const isAnswerSelected = currentSelected !== undefined && (!Array.isArray(currentSelected) || currentSelected.length > 0);
                const isThisOptionSelected = Array.isArray(currentSelected) ? currentSelected.includes(letter) : currentSelected === letter;

                return (
                  <motion.button
                    key={`${key}-${idx}`}
                    onClick={() => handleSelectAnswer(letter)}
                    disabled={!isQCM && isAnswerSelected}
                    className={`w-full p-4 text-left font-medium border rounded-lg
                                shadow-sm transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-brand-yellow
                                ${!isQCM && isAnswerSelected ? 'cursor-not-allowed' : 'cursor-pointer'}
                                ${isThisOptionSelected ? 'bg-brand-yellow-light border-brand-yellow ring-2 ring-brand-yellow' : 'border-gray-300'}
                              `}
                    whileHover={!isQCM && isAnswerSelected ? {} : { scale: 1.02, backgroundColor: '#F3E8FF' }}
                    whileTap={!isQCM && isAnswerSelected ? {} : { scale: 0.98 }}
                  >
                    <span className="font-bold text-brand-yellow mr-2">
                      {letter}:
                    </span>{' '}
                    {value}
                  </motion.button>
                );
              })}

              {isQCM && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      const currentSelected = selectedAnswers[currentQuestionIndex];
                      const hasSelection = Array.isArray(currentSelected) && currentSelected.length > 0;
                      if (!hasSelection) return;
                      if (currentQuestionIndex < quizQuestions.length - 1) {
                        setCurrentQuestionIndex(currentQuestionIndex + 1);
                      } else {
                        setQuizFinished(true);
                      }
                    }}
                    className="px-4 py-2 bg-brand-teal text-white rounded-md shadow-sm font-semibold disabled:opacity-50"
                    disabled={!Array.isArray(selectedAnswers[currentQuestionIndex]) || (selectedAnswers[currentQuestionIndex] as string[]).length === 0}
                  >
                    Valider et Continuer
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
