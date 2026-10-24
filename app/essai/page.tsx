'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import DemoQuiz from '@/components/demo/DemoQuiz';
import { DEMO_SAMPLE_TEXT } from '@/lib/demo';
import { DEMO_TEXT_LIMITS } from '@/lib/validation';
import type { QuizQuestion } from '@/lib/quiz.types';
import { trackPageView } from '@/lib/trackPageView';

type Phase = 'input' | 'loading' | 'quiz' | 'result';

const STEPS = ['Votre texte', 'Génération', 'Quiz', 'Résultat'];
const PHASE_INDEX: Record<Phase, number> = { input: 0, loading: 1, quiz: 2, result: 3 };

export default function TryPage() {
  const [text, setText] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    trackPageView('/essai');
  }, []);

  // Place le focus sur le titre à chaque étape (lecteurs d'écran, clavier)
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  const length = text.trim().length;
  const tooShort = length < DEMO_TEXT_LIMITS.min;
  const tooLong = length > DEMO_TEXT_LIMITS.max;

  const generate = async () => {
    setError(null);
    setPhase('loading');
    try {
      const response = await fetch('/api/demo/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), sample: isSample }),
      });
      const data = (await response.json().catch(() => null)) as { questions?: QuizQuestion[]; error?: string } | null;
      if (!response.ok || !data?.questions?.length) {
        setError(data?.error || "La génération a échoué. Réessayez dans un instant.");
        setPhase('input');
        return;
      }
      setQuestions(data.questions);
      setPhase('quiz');
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.');
      setPhase('input');
    }
  };

  const restart = () => {
    setQuestions([]);
    setScore(0);
    setPhase('input');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-yellow-light via-white to-brand-teal-light px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="font-heading text-lg font-bold text-brand-dark">
            Sheet of Paper
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand-dark-light underline-offset-2 hover:underline">
            J&apos;ai déjà un compte
          </Link>
        </div>

        <ol className="mb-6 flex items-center gap-2 text-xs" aria-label="Étapes de l'essai">
          {STEPS.map((label, i) => {
            const state = i < PHASE_INDEX[phase] ? 'done' : i === PHASE_INDEX[phase] ? 'current' : 'todo';
            return (
              <li key={label} className="flex flex-1 items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold ${
                    state === 'done' ? 'bg-green-600 text-white' : state === 'current' ? 'bg-brand-yellow text-brand-dark' : 'bg-white text-gray-400'
                  }`}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className={`hidden sm:inline ${state === 'current' ? 'font-semibold text-brand-dark' : 'text-gray-500'}`}>{label}</span>
              </li>
            );
          })}
        </ol>

        {phase === 'input' && (
          <section aria-labelledby="try-title">
            <h1 id="try-title" ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-bold text-brand-dark outline-none sm:text-3xl">
              Essayez, sans créer de compte
            </h1>
            <p className="mt-2 text-gray-700">
              Collez un extrait de cours : vous obtenez 3 questions en quelques secondes, chacune avec <strong>la phrase de votre texte qui la justifie</strong>.
            </p>

            <div className="mt-5 rounded-2xl bg-white p-4 shadow">
              <label htmlFor="try-text" className="mb-1 block text-sm font-medium text-gray-700">
                Votre texte
              </label>
              <textarea
                id="try-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setIsSample(false);
                }}
                rows={9}
                maxLength={DEMO_TEXT_LIMITS.max + 500}
                placeholder="Collez ici un paragraphe de cours, de 200 à 3 000 caractères…"
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm"
                aria-describedby="try-count"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p id="try-count" className={`text-xs ${tooLong ? 'text-red-600' : 'text-gray-500'}`}>
                  {length} / {DEMO_TEXT_LIMITS.max} caractères
                  {tooShort && length > 0 ? ` (au moins ${DEMO_TEXT_LIMITS.min})` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setText(DEMO_SAMPLE_TEXT);
                    setIsSample(true);
                  }}
                  className="text-sm font-medium text-brand-dark underline underline-offset-2 hover:text-brand-dark-light"
                >
                  Utiliser un texte d&apos;exemple (photosynthèse)
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={generate}
              disabled={tooShort || tooLong}
              className="mt-4 w-full rounded-full bg-brand-yellow px-6 py-3 text-lg font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Générer mon mini-quiz
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              Votre texte n&apos;est pas conservé. Aucun compte, aucune carte bancaire.
            </p>

            <details className="mt-6 rounded-xl bg-white/70 p-4 text-sm text-gray-700">
              <summary className="cursor-pointer font-medium text-brand-dark">Comment ça marche ?</summary>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>L&apos;IA lit votre texte et écrit des questions qui n&apos;utilisent que ce qu&apos;il contient.</li>
                <li>Chaque question cite la phrase qui la justifie, vérifiée mot à mot : pas de question inventée.</li>
                <li>Avec un compte gratuit : vos PDF, Word et PowerPoint, des fiches de révision, et vos erreurs reviennent en révision espacée.</li>
              </ol>
            </details>
          </section>
        )}

        {phase === 'loading' && (
          <section className="rounded-2xl bg-white p-8 text-center shadow" aria-live="polite" aria-busy="true">
            <h1 ref={headingRef} tabIndex={-1} className="font-heading text-xl font-bold text-brand-dark outline-none">
              Lecture de votre texte…
            </h1>
            <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-brand-yellow/30 border-t-brand-yellow" role="status">
              <span className="sr-only">Chargement</span>
            </div>
            <p className="mt-4 text-sm text-gray-600">Quelques secondes : l&apos;IA écrit les questions puis vérifie chaque citation.</p>
          </section>
        )}

        {phase === 'quiz' && (
          <section aria-labelledby="quiz-title">
            <h1 id="quiz-title" ref={headingRef} tabIndex={-1} className="mb-3 font-heading text-xl font-bold text-brand-dark outline-none">
              Votre mini-quiz
            </h1>
            <DemoQuiz
              questions={questions}
              onFinish={(finalScore) => {
                setScore(finalScore);
                setPhase('result');
              }}
            />
          </section>
        )}

        {phase === 'result' && (
          <section aria-labelledby="result-title" className="rounded-2xl bg-white p-6 text-center shadow-lg">
            <h1 id="result-title" ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-bold text-brand-dark outline-none">
              {score} / {questions.length}
              {score === questions.length ? ' — bravo !' : ''}
            </h1>
            <p className="mt-2 text-gray-700">C&apos;est le principe : de vos cours à des quiz vérifiables, en quelques secondes.</p>

            <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-gray-800">
              <li>📄 Importez vos PDF, Word et PowerPoint, jusqu&apos;à plusieurs centaines de pages.</li>
              <li>🔁 Vos erreurs reviennent automatiquement en révision, au bon moment.</li>
              <li>🧑‍🏫 Enseignants : séances en direct avec QR code, résultats par classe.</li>
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup" className="rounded-full bg-brand-yellow px-8 py-3 font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark">
                Créer mon compte gratuit
              </Link>
              <button type="button" onClick={restart} className="rounded-full border border-gray-300 px-6 py-3 font-medium text-brand-dark hover:bg-gray-50">
                Essayer avec un autre texte
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Sans carte bancaire.</p>
          </section>
        )}
      </div>
    </main>
  );
}
