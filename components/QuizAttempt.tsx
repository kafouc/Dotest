'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { recordQuizAttempt, type AttemptContext, type AnswerInput } from '@/lib/scores';
import type { QuizQuestion } from '@/lib/quiz.types';
import { QUIZ_CONFIG } from '@/lib/constants';
import { calculateQuizScore, isAnswerCorrect } from '@/lib/utils';
import { initCardState, scheduleReview, getMetrics } from '@/lib/fsrs';

type GateResultsOptions = {
  requireAuth: boolean;
  signupRedirect: string;
  headline?: string;
  message?: string;
  ctaLabel?: string;
};

// Props que le composant reçoit
type QuizAttemptProps = {
  quizQuestions: QuizQuestion[];
  onQuizEnd: () => void; // Fonction pour retourner au générateur
  context?: AttemptContext;
  gateResults?: GateResultsOptions;
  enableShareChallenge?: boolean;
};

export default function QuizAttempt({
  quizQuestions,
  onQuizEnd,
  context,
  gateResults,
  enableShareChallenge = true,
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
  const gateRequiresAuth = gateResults?.requireAuth ?? false;
  const [authStatus, setAuthStatus] = useState<'unknown' | 'authenticated' | 'unauthenticated' | 'error'>('unknown');
  const [shareState, setShareState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    link: string | null;
    message: string | null;
    error: string | null;
  }>({ status: 'idle', link: null, message: null, error: null });
  const [shareCopied, setShareCopied] = useState(false);

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
      if (!quizFinished) return;

      let isMounted = true;
      const finishedAt = new Date().toISOString();

      const currentScore = calculateQuizScore(quizQuestions, selectedAnswers);
      setScore(currentScore);

      const answersForStorage: AnswerInput[] = quizQuestions.map((question, index) => {
        const userAnswerRaw = selectedAnswers[index];
        const normalizedAnswer = Array.isArray(userAnswerRaw)
          ? userAnswerRaw.join(',')
          : (userAnswerRaw as string | undefined) ?? null;
        const correctRaw = 'reponses_correctes' in question ? question.reponses_correctes ?? [] : question.reponse_correcte ?? '';
        const normalizedCorrect = Array.isArray(correctRaw) ? correctRaw.join(',') : correctRaw;
        const isCorrect = isAnswerCorrect(
          Array.isArray(userAnswerRaw) ? userAnswerRaw.join(',') : (userAnswerRaw as string) ?? null,
          correctRaw as string | string[]
        );

        return {
          questionIndex: index,
          question: question.question,
          answer: normalizedAnswer,
          correctAnswer: normalizedCorrect,
          justification: question.justification,
          isCorrect,
        };
      });

      const persistAttempt = async () => {
        if (!isMounted) return;

        if (context?.document_path && documentPathOnStart && context.document_path !== documentPathOnStart) {
          console.warn('Document changé, sauvegarde annulée');
          return;
        }

        try {
          await recordQuizAttempt(supabase, {
            answers: answersForStorage,
            context: context ?? { num_questions: quizQuestions.length },
            completedAt: finishedAt,
          });
        } catch (error) {
          console.error('Erreur lors de la sauvegarde détaillée du quiz:', error);
        }

        try {
          const now = new Date();
          const fsrsPreview = answersForStorage.map((answer) => {
            const baseState = initCardState();
            const rating = answer.isCorrect ? 4 : 1;
            const scheduled = scheduleReview(baseState, rating, now);
            const metrics = getMetrics(baseState, now);
            return {
              index: answer.questionIndex,
              nextReviewAt: scheduled.nextReviewAt,
              nextIntervalDays: scheduled.nextIntervalDays,
              stability: scheduled.newStability,
              retrievability: metrics.R,
            };
          });
          console.log('FSRS schedule preview:', fsrsPreview);
        } catch (error) {
          console.error('Erreur lors du calcul FSRS:', error);
        }
      };

      persistAttempt();

      return () => {
        isMounted = false;
      };
    }, [
      quizFinished,
      quizQuestions,
      selectedAnswers,
      supabase,
      context,
      documentPathOnStart,
    ]);

  useEffect(() => {
    if (!quizFinished || !gateRequiresAuth) return;

    let active = true;

    const run = async () => {
      try {
        const session = await supabase.auth.getSession();
        if (!active) return;
        setAuthStatus(session.data.session?.user ? 'authenticated' : 'unauthenticated');
      } catch {
        if (!active) return;
        setAuthStatus('error');
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [quizFinished, gateRequiresAuth, supabase]);

  const handleShareChallenge = async () => {
    if (!enableShareChallenge || shareState.status === 'loading') return;

    const promptLabel = 'Ton prénom ou pseudo pour le défi ? (optionnel)';
    const authorNameRaw = typeof window !== 'undefined' ? window.prompt(promptLabel, '') : '';

    if (authorNameRaw === null) {
      return;
    }

    setShareState({ status: 'loading', link: null, message: null, error: null });
    setShareCopied(false);

    try {
      const finalScore = resolvedScore;
      const response = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz: quizQuestions,
          score: finalScore,
          total: quizQuestions.length,
          authorName: authorNameRaw?.trim() || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur inattendue.' }));
        throw new Error(err?.error || 'Impossible de créer le défi.');
      }

      const data = (await response.json()) as { shareCode: string };
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}/challenge/${data.shareCode}`;
      const baseMessage = authorNameRaw && authorNameRaw.trim().length > 0
        ? `${authorNameRaw.trim()} a fait ${finalScore}/${quizQuestions.length} sur ce quiz. Viens me défier !`
        : `J'ai fait ${finalScore}/${quizQuestions.length} sur ce quiz. Viens me défier !`;
      const fullMessage = `${baseMessage} ${link}`.trim();

      setShareState({ status: 'success', link, message: fullMessage, error: null });

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ text: fullMessage, url: link });
        } catch {
          // Ignorer, l'utilisateur peut simplement annuler le partage natif
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer le défi.';
      setShareState({ status: 'error', link: null, message: null, error: message });
    }
  };

  const handleCopyShare = async () => {
    const text = shareState.message ?? shareState.link;
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) {
      setShareState((prev) => ({ ...prev, error: prev.error ?? 'Copiez le lien manuellement.' }));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareState((prev) => ({ ...prev, error: prev.error ?? 'Copie impossible, utilisez le copier-coller.' }));
    }
  };

  // --- Animations Framer Motion ---
  const questionVariants = {
    initial: { opacity: 0, x: 100 }, // Commence invisible et à droite
    animate: { opacity: 1, x: 0 }, // Apparaît au centre
    exit: { opacity: 0, x: -100 }, // Disparaît à gauche
  };

  const resolvedScore = quizFinished
    ? (score || calculateQuizScore(quizQuestions, selectedAnswers))
    : score;

  // --- Rendu JSX ---

  // Affichage 1 : Écran des Résultats
  if (quizFinished) {
    if (gateRequiresAuth) {
      if (authStatus === 'unknown') {
        return (
          <div className="p-6 bg-white rounded-lg shadow-lg text-center">
            <p className="text-gray-600 text-sm">Chargement des résultats...</p>
          </div>
        );
      }

      if (authStatus !== 'authenticated') {
        const headline = gateResults?.headline ?? 'Crée un compte pour voir ton score';
        const defaultMessage = gateResults?.message ?? 'Connecte-toi ou inscris-toi pour découvrir ton résultat et débloquer la suite.';
        const message = authStatus === 'error'
          ? 'Une erreur est survenue. Connecte-toi pour continuer.'
          : defaultMessage;
        const ctaLabel = gateResults?.ctaLabel ?? "Je m'inscris";
        const signupTarget = gateResults?.signupRedirect ?? '/signup';

        return (
          <div className="p-6 sm:p-8 bg-white rounded-xl shadow-xl text-center">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-brand-dark mb-3">
              {headline}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {message}
            </p>
            <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = signupTarget;
                  }
                }}
                className="w-full sm:w-auto px-6 py-3 bg-brand-yellow text-brand-dark font-heading font-bold rounded-md shadow-sm hover:bg-brand-yellow-dark transition-colors"
              >
                {ctaLabel}
              </button>
              <button
                type="button"
                onClick={onQuizEnd}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Retour
              </button>
            </div>
          </div>
        );
      }
    }

    return (
      <motion.div
        key="results"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 sm:p-6 bg-brand-yellow-light rounded-lg shadow-lg text-center"
      >
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-brand-dark mb-3 sm:mb-4">
          Quiz Terminé !
        </h2>
        <p className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-6">
          Votre Score :
          <span className="text-brand-teal-dark ml-2">
            {resolvedScore} / {quizQuestions.length}
          </span>
        </p>

        {/* Revue des questions */}
        <div className="text-left my-4 sm:my-6 space-y-3 sm:space-y-4 max-h-60 sm:max-h-80 overflow-y-auto pr-2">
          {' '}
          {/* Ajout de scroll */}
          <h3 className="text-lg sm:text-xl font-heading font-semibold text-brand-dark">
            Revue des questions :
          </h3>
          {quizQuestions.map((q, index) => {
            const userAnswer = selectedAnswers[index];
            const correctRef = ('reponses_correctes' in q) ? q.reponses_correctes : q.reponse_correcte;
            const isCorrect = isAnswerCorrect((Array.isArray(userAnswer) ? userAnswer.join(',') : (userAnswer as string) ?? null), correctRef as string | string[]);
            return (
              <div
                key={index}
                className="p-3 sm:p-4 bg-white rounded shadow-sm border border-brand-yellow"
              >
                <p className="font-semibold text-sm sm:text-base">
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

        {enableShareChallenge && (
          <div className="text-left mt-4 sm:mt-6 bg-white/80 border border-brand-yellow rounded-lg p-4">
            <h3 className="text-base font-heading font-semibold text-brand-dark mb-2">
              Défie un ami
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Partage ton score et invite un ami à essayer de faire mieux.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={handleShareChallenge}
                disabled={shareState.status === 'loading'}
                className="w-full sm:w-auto px-4 py-2 bg-brand-teal text-white rounded-md font-semibold shadow-sm hover:bg-brand-teal-dark disabled:opacity-50"
              >
                {shareState.status === 'loading' ? 'Création...' : 'Générer un lien'}
              </button>
              {shareState.status === 'success' && (
                <button
                  type="button"
                  onClick={handleCopyShare}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {shareCopied ? 'Lien copié !' : 'Copier le message'}
                </button>
              )}
            </div>
            {shareState.status === 'success' && (
              <div className="mt-3">
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md text-sm text-gray-700"
                  rows={3}
                  value={shareState.message ?? ''}
                  readOnly
                />
              </div>
            )}
            {shareState.status === 'error' && shareState.error && (
              <p className="mt-3 text-sm text-red-600">{shareState.error}</p>
            )}
          </div>
        )}

        {/* Bouton pour recommencer */}
        <button
          onClick={onQuizEnd} // Revient à l'écran de génération
          className="mt-4 w-full sm:w-auto px-6 py-3 cursor-pointer bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-heading font-bold rounded-md shadow-sm transition-colors duration-200 text-base sm:text-lg min-h-[44px]"
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
          <div className="p-4 sm:p-6 bg-white rounded-lg shadow-lg border border-brand-yellow">
            {/* Header de la question */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2">
              <h2 className="text-lg sm:text-xl font-heading font-semibold text-brand-dark">
                Question {currentQuestionIndex + 1} / {quizQuestions.length}
              </h2>
              <span className="px-3 py-1 bg-brand-teal-light text-brand-teal-dark font-medium rounded-full text-sm w-fit">
                {isQCM ? 'QCM' : isVF ? 'Vrai/Faux' : 'QCU'}
              </span>
            </div>

            {/* Texte de la question */}
            <p className="text-base sm:text-lg text-gray-800 mb-4 sm:mb-6 min-h-[48px] sm:min-h-[60px]">
              {currentQuestion.question}
            </p>

            {/* Options de réponse */}
            <div className="space-y-2 sm:space-y-3">
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
                    className={`w-full p-3 sm:p-4 text-left text-sm sm:text-base font-medium border rounded-lg
                                shadow-sm transition-all duration-200 min-h-[44px]
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
                    className="w-full sm:w-auto px-4 py-3 bg-brand-teal text-white rounded-md shadow-sm font-semibold disabled:opacity-50 min-h-[44px]"
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
