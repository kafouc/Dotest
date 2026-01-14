"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  FileDown,
  Home,
  ListChecks,
  PlayCircle,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { ONBOARDING_STORAGE_KEYS } from "@/lib/constants";
import { trackPageView } from "@/lib/trackPageView";

const SAMPLE_DOCUMENT = {
  name: "Cours de probabilités.pdf",
  pages: "38 pages",
  addedAgo: "il y a 2 minutes",
  sections: [
    "Variables aléatoires et espérance",
    "Lois usuelles : binomiale, normale, exponentielle",
    "Convergence et théorème central limite",
  ],
  keyIdeas: [
    "Retenir les définitions exactes pour justifier vos réponses",
    "Comparer les distributions via leurs paramètres",
    "Identifier rapidement les exercices qui parlent de TCL",
  ],
};

type StepTarget = "documents" | "summary" | "quiz" | "progress" | "wrap";

type DemoStep = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  target: StepTarget;
};

const highlightClass = (isActive: boolean) =>
  isActive
    ? "border-brand-teal/60 ring-4 ring-brand-teal/40 shadow-[0_25px_80px_-35px_rgba(21,128,61,0.55)]"
    : "border-white/25";

export default function DemoPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    trackPageView("/demo");
  }, []);

  const steps = useMemo<DemoStep[]>(
    () => [
      {
        id: "library",
        title: "Votre premier document est déjà prêt",
        description:
          "Nous avons pré-chargé un support de cours pour vous montrer le résultat immédiat d'un import. Vos propres PDF apparaîtront dans la même liste.",
        bullets: [
          "Chaque fichier importé est analysé automatiquement",
          "Le statut vous indique en direct la progression",
        ],
        target: "documents",
      },
      {
        id: "summary",
        title: "Parcourez la synthèse générée par l'IA",
        description:
          "La fiche résume les chapitres et met en évidence les notions à retenir. Vous pouvez parcourir les sections pour préparer vos révisions.",
        bullets: [
          "Glissez entre les sections pour explorer le document",
          "Ajoutez vos annotations personnelles en un clic",
        ],
        target: "summary",
      },
      {
        id: "quiz",
        title: "Générez un quiz ciblé en quelques secondes",
        description:
          "Choisissez la difficulté et le nombre de questions : l'IA construit un quiz personnalisé pour consolider vos connaissances immédiatement.",
        bullets: [
          "Indiquez vos objectifs (révision rapide, examen, oral)",
          "Recevez un feedback instantané question par question",
        ],
        target: "quiz",
      },
      {
        id: "progress",
        title: "Suivez votre progression sans effort",
        description:
          "Le tableau de bord vous montre vos points forts, les notions à consolider et la prochaine session recommandée pour garder le rythme.",
        bullets: [
          "Des scores clairs pour chaque chapitre",
          "Des rappels intelligents pour ne rien oublier",
        ],
        target: "progress",
      },
      {
        id: "wrap",
        title: "Prêt à maîtriser vos cours ?",
        description:
          "Créez votre compte pour importer vos propres documents et continuer là où vous vous êtes arrêté. Vous pouvez aussi revenir à l'accueil pour explorer davantage.",
        bullets: [
          "Inscription en moins d'une minute",
          "Interface identique à la démo avec vos données",
        ],
        target: "wrap",
      },
    ],
    [],
  );

  const totalSteps = steps.length;
  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const activeTarget = step.target;

  const markDemoCompleted = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEYS.demoCompleted, "true");
    }
  }, []);

  const goToSignup = useCallback(() => {
    markDemoCompleted();
    router.push("/signup");
  }, [markDemoCompleted, router]);

  const goHomeAfterCompletion = useCallback(() => {
    markDemoCompleted();
    router.push("/");
  }, [markDemoCompleted, router]);

  const navigateHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      goToSignup();
      return;
    }
    setCurrentStep((value) => Math.min(totalSteps - 1, value + 1));
  }, [goToSignup, isLastStep, totalSteps]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((value) => Math.max(0, value - 1));
  }, []);

  const handleSkipDemo = useCallback(() => {
    goToSignup();
  }, [goToSignup]);

  const progressFraction = (currentStep + 1) / totalSteps;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-teal-light/30 via-white to-brand-yellow-light/40 pb-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_60%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <button
          type="button"
          onClick={navigateHome}
          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-dark shadow-sm transition hover:border-brand-teal/50 hover:text-brand-teal"
        >
          <Home className="h-4 w-4" />
          Accueil
        </button>
        <div className="text-center text-sm uppercase tracking-[0.35em] text-brand-dark/70">
          Démonstration interactive
        </div>
        <Link
          href="/signup"
          onClick={goToSignup}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-yellow via-brand-yellow-dark to-brand-teal px-5 py-2 text-sm font-semibold text-brand-dark shadow-[0_18px_48px_-24px_rgba(45,143,111,0.55)] transition hover:scale-[1.02]"
        >
          Je crée mon compte
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-stretch">
        <section className="flex-1 rounded-[36px] border border-white/30 bg-white/75 p-6 shadow-[0_40px_120px_-60px_rgba(24,89,74,0.65)] backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-brand-dark/60">Espace de travail</p>
              <h1 className="text-2xl font-heading font-semibold text-brand-dark">
                Aperçu de SheetOfPaper
              </h1>
            </div>
            <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
              Mode démo
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div
                className={`relative overflow-hidden rounded-3xl border ${highlightClass(activeTarget === "documents")} bg-white/85 p-5 transition`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-brand-dark/60">Documents</p>
                    <h2 className="text-lg font-semibold text-brand-dark">Bibliothèque</h2>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-semibold text-brand-teal">
                    <Sparkles className="h-3.5 w-3.5" />
                    Analyse terminée
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-brand-teal/30 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{SAMPLE_DOCUMENT.name}</p>
                        <p className="text-xs text-brand-dark/60">
                          {SAMPLE_DOCUMENT.pages} • Ajouté {SAMPLE_DOCUMENT.addedAgo}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal/10 px-3 py-1 text-xs text-brand-teal">
                        <FileDown className="h-3.5 w-3.5" />
                        Demo.pdf
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-brand-dark/70">
                      <div className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-teal" />
                        Conversion effectuée • Quiz disponibles
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-yellow" />
                        Fiches de révision créées automatiquement
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-dashed border-brand-dark/15 px-4 py-3 text-xs text-brand-dark/60">
                    <span>Vos propres PDF apparaîtront ici dès leur import.</span>
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-full border border-brand-dark/10 bg-white/70 px-3 py-1 font-semibold text-brand-dark/50"
                    >
                      Importer un document
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {activeTarget === "documents" && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="absolute bottom-4 left-4 right-4 rounded-2xl bg-brand-teal/10 px-4 py-3 text-sm text-brand-teal"
                    >
                      Tout est prêt : vous n'avez rien à importer pour cette démo, concentrez-vous sur le parcours.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={`relative overflow-hidden rounded-3xl border ${highlightClass(activeTarget === "summary")} bg-white/85 p-5 transition`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
                    <BookOpenCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-brand-dark/60">Fiche de synthèse</p>
                    <h3 className="text-lg font-semibold text-brand-dark">Notions essentielles</h3>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-brand-dark/80">
                  <p>
                    <span className="font-semibold text-brand-dark">Chapitre du jour :</span> Probabilités discrètes & variables aléatoires.
                  </p>
                  <ul className="space-y-2">
                    {SAMPLE_DOCUMENT.sections.map((section) => (
                      <li key={section} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-teal" />
                        <span>{section}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-2xl bg-brand-sand/50 p-4 text-xs text-brand-dark/70">
                  <p className="font-semibold uppercase tracking-[0.25em] text-brand-dark/60">Points à retenir</p>
                  <ul className="mt-2 space-y-1.5">
                    {SAMPLE_DOCUMENT.keyIdeas.map((idea) => (
                      <li key={idea} className="flex items-start gap-2">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-yellow" />
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <AnimatePresence>
                  {activeTarget === "summary" && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="absolute bottom-4 left-4 right-4 rounded-2xl bg-brand-yellow/15 px-4 py-3 text-sm text-brand-dark"
                    >
                      Chaque section est cliquable dans l'application réelle pour approfondir ou réviser à votre rythme.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-5">
              <div
                className={`relative overflow-hidden rounded-3xl border ${highlightClass(activeTarget === "quiz")} bg-white/85 p-5 transition`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-brand-dark/60">Quiz intelligent</p>
                    <h3 className="text-lg font-semibold text-brand-dark">Question 1 sur 5</h3>
                  </div>
                </div>

                <p className="text-sm font-semibold text-brand-dark">
                  Quelle propriété caractérise une loi normale centrée réduite ?
                </p>

                <div className="mt-4 space-y-2">
                  {["La moyenne vaut 0 et la variance 1", "La moyenne vaut 1 et la variance 0", "Toutes les valeurs positives sont équiprobables", "Elle est discrète et bornée"].map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-2xl border border-brand-teal/15 bg-white px-4 py-3 text-left text-sm text-brand-dark transition hover:border-brand-teal/50 ${
                        index === 0 ? "ring-2 ring-brand-teal/60" : ""
                      }`}
                    >
                      <span>{option}</span>
                      {index === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-semibold text-brand-teal">
                          <PlayCircle className="h-3.5 w-3.5" />
                          Bonne réponse
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-sand/70 px-2 py-0.5 text-[11px] text-brand-dark/60">À revoir</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-brand-dark/60">
                  <span>Feedback immédiat après chaque réponse.</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-1 text-[11px] text-brand-teal">
                    <Sparkles className="h-3 w-3" />
                    Adapté à vous
                  </span>
                </div>

                <AnimatePresence>
                  {activeTarget === "quiz" && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="absolute bottom-4 left-4 right-4 rounded-2xl bg-brand-teal/10 px-4 py-3 text-sm text-brand-teal"
                    >
                      Notre moteur ajuste la difficulté automatiquement selon vos réponses dans la version complète.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={`relative overflow-hidden rounded-3xl border ${highlightClass(activeTarget === "progress")} bg-white/85 p-5 transition`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-brand-dark/60">Progression</p>
                    <h3 className="text-lg font-semibold text-brand-dark">Tableau de bord</h3>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl bg-brand-teal/10 px-4 py-3 text-sm text-brand-teal">
                    <span>Chapitre « Variables aléatoires »</span>
                    <span className="font-semibold">82 % maîtrisé</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-brand-yellow/10 px-4 py-3 text-sm text-brand-dark">
                    <span>Notions à consolider</span>
                    <span className="font-semibold">Espérance conditionnelle</span>
                  </div>
                  <div className="rounded-2xl border border-brand-dark/10 bg-white/90 p-4 text-xs text-brand-dark/70">
                    <div className="flex items-center gap-2 font-semibold text-brand-dark">
                      <TrendingUp className="h-4 w-4" />
                      Prochaine session recommandée demain à 18h
                    </div>
                    <p className="mt-2 leading-relaxed">
                      Notre algorithme planifie vos rappels pour réviser avant l'oubli et consolider vos acquis au bon moment.
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {activeTarget === "progress" && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="absolute bottom-4 left-4 right-4 rounded-2xl bg-brand-teal/10 px-4 py-3 text-sm text-brand-teal"
                    >
                      Vous recevez aussi des notifications de rappel quand c'est pertinent (mobile et email).
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <aside className="md:w-[320px]">
          <div className="sticky top-10 rounded-[32px] border border-white/40 bg-white/85 p-6 shadow-[0_30px_90px_-50px_rgba(21,128,61,0.45)] backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-brand-dark/60">
              <span>Étape {currentStep + 1}</span>
              <span>{totalSteps} au total</span>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-brand-teal/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-yellow to-brand-teal"
                style={{ width: `${Math.round(progressFraction * 100)}%` }}
              />
            </div>

            <h2 className="mt-6 text-xl font-heading font-semibold text-brand-dark">{step.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-dark/75">{step.description}</p>

            <ul className="mt-4 space-y-2 text-sm text-brand-dark/70">
              {step.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-teal" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isFirstStep}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  isFirstStep
                    ? "cursor-not-allowed border-brand-dark/10 text-brand-dark/40"
                    : "border-brand-dark/20 text-brand-dark hover:border-brand-teal/40 hover:text-brand-teal"
                }`}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-yellow via-brand-yellow-dark to-brand-teal px-5 py-2 text-xs font-semibold text-brand-dark shadow-[0_18px_48px_-24px_rgba(45,143,111,0.55)] transition hover:scale-[1.03]"
              >
                {isLastStep ? "Créer mon compte" : "Étape suivante"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-brand-dark/60">
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={handleSkipDemo}
                  className="w-full rounded-full border border-dashed border-brand-dark/20 px-4 py-2 font-semibold text-brand-dark transition hover:border-brand-teal/40 hover:text-brand-teal"
                >
                  Passer la démo et m'inscrire
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goHomeAfterCompletion}
                  className="w-full rounded-full border border-brand-dark/15 px-4 py-2 font-semibold text-brand-dark transition hover:border-brand-teal/40 hover:text-brand-teal"
                >
                  Retourner à l'accueil
                </button>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
