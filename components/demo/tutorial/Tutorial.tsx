'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ONBOARDING_STORAGE_KEYS } from '@/lib/constants';
import { TUTORIAL_STEPS, type TutorialStepId } from '@/lib/tutorialSteps';
import { trackPageView } from '@/lib/trackPageView';
import { AnalysisScreen, GenerateScreen, IntroScreen, MobileScreen, QuizScreen, ReviewScreen, TeacherScreen, UploadScreen } from './screens';

const SCREENS: Partial<Record<TutorialStepId, () => React.JSX.Element>> = {
  intro: IntroScreen,
  upload: UploadScreen,
  analysis: AnalysisScreen,
  generate: GenerateScreen,
  quiz: QuizScreen,
  review: ReviewScreen,
  teacher: TeacherScreen,
  mobile: MobileScreen,
};

function markCompleted() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEYS.demoCompleted, 'true');
  } catch {
    // Stockage indisponible : le tutoriel pourra simplement être reproposé
  }
}

/** Tutoriel interactif de l'application, avant l'inscription : texte à gauche, écran simulé cliquable à droite. */
export default function Tutorial() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const step = TUTORIAL_STEPS[index];
  const total = TUTORIAL_STEPS.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const Screen = SCREENS[step.id];

  useEffect(() => {
    trackPageView('/demo');
  }, []);

  // Le tutoriel est considéré comme vu dès qu'on atteint la conclusion (l'accueil proposera alors directement l'inscription)
  useEffect(() => {
    if (isLast) markCompleted();
  }, [isLast]);

  // Focus sur le titre à chaque étape (clavier, lecteurs d'écran), sans voler le focus au chargement
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [index]);

  const go = useCallback(
    (delta: number) => setIndex((current) => Math.min(total - 1, Math.max(0, current + delta))),
    [total]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const skip = () => {
    markCompleted();
    router.push('/signup');
  };

  const motionProps = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.25 } };

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-yellow-light via-white to-brand-teal-light">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/logo/paper_logo.svg" alt="" width={28} height={28} className="h-7 w-auto" />
          <span className="font-heading text-lg font-bold text-brand-dark">Sheet of Paper</span>
        </Link>
        {!isLast && (
          <button type="button" onClick={skip} className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-dark-light underline-offset-2 hover:underline">
            Passer le tutoriel
          </button>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-10">
        <nav aria-label="Étapes du tutoriel" className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500" aria-live="polite">
            Étape {index + 1} sur {total}
          </p>
          <ol className="flex gap-1.5">
            {TUTORIAL_STEPS.map((s, i) => (
              <li key={s.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`Étape ${i + 1} : ${s.title}`}
                  className={`h-2 w-full rounded-full transition-colors ${i === index ? 'bg-brand-yellow' : i < index ? 'bg-brand-teal' : 'bg-gray-200 hover:bg-gray-300'}`}
                />
              </li>
            ))}
          </ol>
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={step.id} {...motionProps} className="grid items-start gap-8 lg:grid-cols-[1fr_1.15fr]">
            <section aria-labelledby="tutorial-title" className="order-1">
              {step.label && (
                <p className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow font-heading text-sm font-bold text-brand-dark" aria-hidden="true">
                  {step.label}
                </p>
              )}
              <h1 id="tutorial-title" ref={titleRef} tabIndex={-1} className="font-heading text-2xl font-bold text-brand-dark outline-none sm:text-3xl lg:text-4xl">
                {step.title}
              </h1>
              <p className="mt-3 text-base text-brand-dark-light sm:text-lg">{step.lead}</p>
              <ul className="mt-5 space-y-2">
                {step.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-gray-700 sm:text-base">
                    <span aria-hidden="true" className="mt-0.5 text-brand-teal-dark">✓</span>
                    {bullet}
                  </li>
                ))}
              </ul>
              {step.tryIt && (
                <p className="mt-5 rounded-xl border border-brand-yellow bg-white/80 p-3 text-sm text-brand-dark">
                  <strong>À vous de jouer :</strong> {step.tryIt}
                </p>
              )}
              {step.id === 'mobile' && (
                <Link href="/#installer" className="mt-4 inline-block text-sm font-semibold text-brand-dark underline underline-offset-2">
                  Voir comment installer l’application →
                </Link>
              )}

              {isLast && (
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link href="/signup" className="rounded-full bg-brand-yellow px-8 py-3 text-center font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark">
                    Créer mon compte gratuit
                  </Link>
                  <Link href="/essai" className="rounded-full border border-gray-300 bg-white px-6 py-3 text-center font-medium text-brand-dark hover:bg-gray-50">
                    Essayer avec mon texte, sans compte
                  </Link>
                </div>
              )}
            </section>

            <div className="order-2" aria-label="Aperçu interactif de l’application">
              {Screen ? (
                <Screen />
              ) : (
                <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
                  <p className="text-5xl" aria-hidden="true">🎓</p>
                  <p className="mt-3 font-heading text-xl font-bold text-brand-dark">Du cours au quiz, du quiz à la mémoire</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                    <li>📄 Importer · ✨ Générer · ✅ Vérifier la source</li>
                    <li>🔁 Réviser au bon moment · 🧑‍🏫 Animer en direct</li>
                    <li>📱 Installer · 🔔 Rappels</li>
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={isFirst}
            className="rounded-full border border-gray-300 bg-white px-6 py-2.5 font-medium text-brand-dark hover:bg-gray-50 disabled:invisible"
          >
            ← Précédent
          </button>
          {!isLast ? (
            <button type="button" onClick={() => go(1)} className="rounded-full bg-brand-dark px-8 py-2.5 font-semibold text-white hover:bg-brand-dark-light">
              {isFirst ? 'Commencer le tutoriel' : 'Suivant →'}
            </button>
          ) : (
            <button type="button" onClick={() => setIndex(0)} className="rounded-full border border-gray-300 bg-white px-6 py-2.5 font-medium text-brand-dark hover:bg-gray-50">
              Revoir le tutoriel
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
