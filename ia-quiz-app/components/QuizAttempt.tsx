"use client";

import { useState, useEffect } from 'react';
// On importe les outils d'animation
import { motion, AnimatePresence } from 'framer-motion';
// On importe le client Supabase pour sauvegarder le score
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

// Type pour les questions (reçu de QuizGenerator)
type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

// Props que le composant reçoit
type QuizAttemptProps = {
  quizQuestions: QuizQuestion[];
  onQuizEnd: () => void; // Fonction pour retourner au générateur
};

export default function QuizAttempt({ quizQuestions, onQuizEnd }: QuizAttemptProps) {
  // --- États ---
  const [supabase] = useState(() => createSupabaseBrowserClient()); // Client Supabase
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // Index question actuelle
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({}); // Réponses utilisateur
  const [quizFinished, setQuizFinished] = useState(false); // Statut du quiz
  const [score, setScore] = useState(0); // Score final

  const currentQuestion = quizQuestions[currentQuestionIndex];

  // --- Logique de gestion des réponses ---
  const handleSelectAnswer = (optionKey: string) => {
    // N'autorise pas à changer la réponse si déjà sélectionnée
    if (selectedAnswers[currentQuestionIndex]) return; 

    // Enregistre la réponse
    const newAnswers = { ...selectedAnswers, [currentQuestionIndex]: optionKey };
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
    }, 500); // 0.5 seconde de délai
  };

  // --- Effet de fin de quiz (Calcul + Sauvegarde) ---
  useEffect(() => {
    // Ne s'exécute que lorsque le quiz vient de se terminer
    if (quizFinished) {
      
      // 1. Calculer le score
      let currentScore = 0;
      quizQuestions.forEach((question, index) => {
        if (selectedAnswers[index] === question.reponse_correcte) {
          currentScore++;
        }
      });
      setScore(currentScore);

      // 2. Sauvegarder la tentative dans Supabase (fonction asynchrone)
      const saveAttempt = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("Impossible de sauvegarder : utilisateur non trouvé.");
          return;
        }

        // Prépare la ligne à insérer
        const attemptData = {
          user_id: user.id,
          score: currentScore,
          total_questions: quizQuestions.length,
        };

        // Insère dans la table 'quiz_attempts'
        const { error } = await supabase
          .from('quiz_attempts')
          .insert(attemptData);

        if (error) {
          console.error("Erreur lors de la sauvegarde de la tentative:", error);
        } else {
          console.log("Tentative de quiz sauvegardée !");
        }
      };

      saveAttempt(); // Appelle la fonction de sauvegarde
    }
  }, [quizFinished, quizQuestions, selectedAnswers, supabase]); // Dépendances de l'effet

  // --- Animations Framer Motion ---
  const questionVariants = {
    initial: { opacity: 0, x: 100 }, // Commence invisible et à droite
    animate: { opacity: 1, x: 0 },   // Apparaît au centre
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
        className="p-6 bg-purple-50 rounded-lg shadow-lg text-center"
      >
        <h2 className="text-2xl font-bold text-brand-purple-dark mb-4">Quiz Terminé !</h2>
        <p className="text-4xl font-bold mb-6">
          Votre Score :
          <span className="text-brand-pink-dark ml-2">{score} / {quizQuestions.length}</span>
        </p>

        {/* Revue des questions */}
        <div className="text-left my-6 space-y-4 max-h-60 overflow-y-auto pr-2"> {/* Ajout de scroll */}
          <h3 className="text-xl font-semibold text-brand-purple-dark">Revue des questions :</h3>
          {quizQuestions.map((q, index) => {
            const userAnswer = selectedAnswers[index];
            const isCorrect = userAnswer === q.reponse_correcte;
            return (
              <div key={index} className="p-3 bg-white rounded shadow-sm border border-purple-100">
                <p className="font-semibold">{index + 1}. {q.question}</p>
                <p className={`text-sm mt-1 font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  Votre réponse : {userAnswer || "Aucune"}
                  {isCorrect ? " (Correct)" : " (Incorrect)"}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-green-700">
                    Bonne réponse : {q.reponse_correcte}
                  </p>
                )}
                {q.justification && (
                  <p className="text-xs italic text-gray-600 mt-1">Justification : {q.justification}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bouton pour recommencer */}
        <button
          onClick={onQuizEnd} // Revient à l'écran de génération
          className="mt-4 px-6 py-2 cursor-pointer bg-brand-purple hover:bg-brand-purple-dark text-white font-bold rounded-md shadow-sm transition-colors duration-200 text-lg"
        >
          Refaire un quiz
        </button>
      </motion.div>
    );
  }

  // Affichage 2 : Question Actuelle
  return (
    <div className="relative overflow-hidden p-1"> {/* Conteneur pour l'animation */}
      <AnimatePresence mode="wait"> {/* Attend la fin de l'exit avant l'animate */}
        <motion.div
          key={currentQuestionIndex} // L'animation se déclenche quand cette clé change
          variants={questionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full"
        >
          <div className="p-6 bg-white rounded-lg shadow-lg border border-purple-100">
            {/* Header de la question */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-brand-purple-dark">Question {currentQuestionIndex + 1} / {quizQuestions.length}</h2>
              <span className="px-3 py-1 bg-brand-pink-light text-brand-pink-dark font-medium rounded-full text-sm">QCM</span>
            </div>

            {/* Texte de la question */}
            <p className="text-lg text-gray-800 mb-6 min-h-[60px]">{currentQuestion.question}</p>

            {/* Options de réponse */}
            <div className="space-y-3">
              {Object.entries(currentQuestion.options).map(([key, value]) => {
                // Vérifie si une réponse a été sélectionnée pour cette question
                const isAnswerSelected = selectedAnswers[currentQuestionIndex] !== undefined;
                // Vérifie si cette option est celle sélectionnée par l'utilisateur
                const isThisOptionSelected = selectedAnswers[currentQuestionIndex] === key;
                
                return (
                  <motion.button
                    key={key}
                    onClick={() => handleSelectAnswer(key)}
                    disabled={isAnswerSelected} // Désactive les boutons après un choix
                    // Style de base
                    className={`w-full p-4 text-left font-medium border rounded-lg
                                shadow-sm transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-brand-purple-dark
                                ${isAnswerSelected ? 'cursor-not-allowed' : 'cursor-pointer'}
                                ${isThisOptionSelected ? 'bg-brand-purple-light border-brand-purple-dark ring-2 ring-brand-purple-dark' : 'border-gray-300'}
                              `}
                    // Animations Framer Motion
                    whileHover={isAnswerSelected ? {} : { scale: 1.02, backgroundColor: '#F3E8FF' }}
                    whileTap={isAnswerSelected ? {} : { scale: 0.98 }}
                  >
                    <span className="font-bold text-brand-purple mr-2">{key}:</span> {value}
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