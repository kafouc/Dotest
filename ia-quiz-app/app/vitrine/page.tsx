'use client';

import Link from 'next/link';

// Page vitrine/accueil avec slides sticky et animations de scroll
export default function VitrinePage() {
  return (
    <div className="vitrine-wrapper">
      {/* Contrôles d'effets (inspirés du modèle 2) */}
      <header className="site-header">
        <h1 className="sr-only">IA Quiz App – Page vitrine</h1>
        <div className="fieldset-wrapper">
          <fieldset>
            <legend className="sr-only">Effets</legend>
            <input id="blink-effect" type="radio" name="effect" value="blink" defaultChecked className="sr-only" />
            <label htmlFor="blink-effect">Blink</label>
            <input id="horizontal-scroll-effect" type="radio" name="effect" value="horizontal-scroll" className="sr-only" />
            <label htmlFor="horizontal-scroll-effect">Horizontal scroll</label>
            <input id="backwards-scroll-effect" type="radio" name="effect" value="backwards-scroll" className="sr-only" />
            <label htmlFor="backwards-scroll-effect">Backwards scroll</label>
            <input id="zoom-scroll-effect" type="radio" name="effect" value="zoom-scroll" className="sr-only" />
            <label htmlFor="zoom-scroll-effect">Zoom scroll</label>
          </fieldset>
        </div>

        <div className="header-right">
          <nav>
            <ul className="indicator">
              <li><a href="#intro"><span className="sr-only">Intro</span></a></li>
              <li><a href="#features"><span className="sr-only">Fonctionnalités</span></a></li>
              <li><a href="#how"><span className="sr-only">Utilisation</span></a></li>
              <li><a href="#live"><span className="sr-only">Live Quiz</span></a></li>
              <li><a href="#flashcards"><span className="sr-only">Flashcards</span></a></li>
              <li><a href="#contact"><span className="sr-only">Contact</span></a></li>
            </ul>
          </nav>
          <Link href="/app" className="access-app">Accéder à l&apos;application</Link>
        </div>
      </header>

      <main>
        {/* Modèle 1: sections sticky plein écran + dégradés */}
        <section id="intro" className="section">
          <div className="content bg-gradient-to-b from-green-200 to-blue-200 text-black flex flex-col items-center justify-center">
            <h2 className="text-4xl md:text-6xl font-bold text-center">IA Quiz App</h2>
            <p className="mt-4 text-lg max-w-2xl text-center">
              Générez des quiz à partir de vos PDF, animez des sessions en direct pour vos élèves, et révisez avec des flashcards à répétition espacée.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/" className="px-5 py-2 rounded-md bg-brand-purple text-white hover:bg-brand-purple-dark">Ouvrir l&apos;application</Link>
              <Link href="/join" className="px-5 py-2 rounded-md bg-brand-pink text-white hover:bg-brand-pink-dark">Rejoindre un quiz</Link>
            </div>
            <p className="mt-6 text-sm opacity-80">Faites défiler pour découvrir</p>
          </div>
        </section>

        <section id="features" className="section">
          <div className="content bg-gradient-to-b from-indigo-800 to-purple-800 text-white flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold">Fonctionnalités</h2>
            <ul className="mt-4 space-y-2 text-lg">
              <li>• Génération de quiz depuis vos documents</li>
              <li>• Partage en temps réel par code/QR</li>
              <li>• Tableau de bord enseignant: participants, réponses, corrections</li>
              <li>• Scores, distributions par question, détails par élève</li>
              <li>• Flashcards avec SM‑2 simplifié pour mémoriser</li>
            </ul>
          </div>
        </section>

        <section id="how" className="section">
          <div className="content bg-gradient-to-b from-purple-800 to-pink-800 text-white flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold">Comment l&apos;utiliser</h2>
            <ol className="mt-4 space-y-2 text-lg max-w-3xl">
              <li>1. Importez un PDF et attendez le traitement.</li>
              <li>2. Générez un quiz à partir du document.</li>
              <li>3. Partagez le quiz en direct (QR/code) et démarrez la session.</li>
              <li>4. Suivez les réponses des élèves sur le tableau de bord.</li>
              <li>5. Créez des flashcards depuis le document et révisez-les.</li>
            </ol>
          </div>
        </section>

        <section id="live" className="section">
          <div className="content bg-gradient-to-b from-blue-200 to-indigo-100 text-black flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold">Live Quiz</h2>
            <p className="mt-4 text-lg max-w-2xl text-center">
              Sessions en direct sécurisées avec Supabase Realtime et RLS. Les élèves rejoignent en quelques secondes et répondent en temps réel.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/join" className="px-5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Rejoindre</Link>
              <Link href="/live-dashboard/preview" className="px-5 py-2 rounded-md bg-gray-900 text-white opacity-60 pointer-events-none" aria-disabled>Voir un exemple</Link>
            </div>
          </div>
        </section>

        <section id="flashcards" className="section">
          <div className="content bg-gradient-to-b from-amber-100 to-rose-100 text-black flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold">Flashcards</h2>
            <p className="mt-4 text-lg max-w-2xl text-center">
              Créez des cartes depuis vos documents et révisez avec un algorithme de répétition espacée (SM‑2 simplifié).
            </p>
            <Link href="/flashcards" className="mt-6 px-5 py-2 rounded-md bg-brand-purple text-white hover:bg-brand-purple-dark">Réviser des flashcards</Link>
          </div>
        </section>

        <section id="contact" className="section">
          <div className="content bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold">À propos du développeur</h2>
            <p className="mt-4 text-lg max-w-2xl text-center">
              Mathieu Coulibaly — Développeur Full‑Stack, étudiant et freelancer. Passionné par l’éducation augmentée par l’IA.
            </p>
            <a href="mailto:kafoumathieu.coulibaly@gmail.com" className="mt-6 px-5 py-2 rounded-md bg-brand-pink text-white hover:bg-brand-pink-dark">
              Me contacter: kafoumathieu.coulibaly@gmail.com
            </a>
          </div>
        </section>
      </main>

      {/* Styles adaptés des modèles fournis, encapsulés dans le wrapper .vitrine */}
      <style jsx global>{`
        .vitrine-wrapper {
          /* Conteneur scroll dédié pour pouvoir fixer le snapping ici */
          height: 100dvh;
          overflow-y: auto;
          scroll-snap-type: y mandatory;
          timeline-scope: --section, --main, --site-header;
          --color-background: black;
        }
        .vitrine-wrapper main { view-timeline: --main; }

        .vitrine-wrapper .section {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          view-timeline: --section;
          height: 100dvh;
          position: relative;
        }
        .vitrine-wrapper .content {
          overflow: hidden;
          position: sticky; /* comportement modèle 1: sticky plein écran */
          top: 0;
          inset-inline: 0;
          min-height: 100dvh;
          background-color: var(--color-background, black);

          /* paramètres d'animation modèle 2 */
          --contrast: 4;
          --blur: 0.5rem;
          animation: blink ease-in-out both;
          animation-timeline: --section;
        }
        @keyframes blink {
          0%, 100% {
            filter: blur(var(--blur)) contrast(var(--contrast));
            opacity: 0;
            visibility: hidden;
          }
          50% {
            filter: blur(0) contrast(1);
            opacity: 1;
            visibility: visible;
          }
        }
        /* Indicateur de progression inspiré du modèle */
        .site-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: .75rem 1rem; backdrop-filter: blur(6px); background: rgba(255,255,255,.25); }
        .site-header .fieldset-wrapper fieldset { display: flex; gap: .5rem; align-items: center; }
        .site-header label { cursor: pointer; padding: .25rem .5rem; border-radius: .375rem; background: rgba(0,0,0,.4); color: white; font-size: .875rem; }
        .indicator { display: flex; gap: .5rem; list-style: none; margin: 0; padding: 0; }
        .indicator a { display: block; width: .625rem; height: .625rem; border-radius: 9999px; background: var(--color-indicator, #6b46c1); }
        .indicator::before { content: ''; display: block; position: absolute; width: .625rem; height: .625rem; border-radius: 9999px; background: var(--color-indicator, #6b46c1); }
        .vitrine-wrapper .indicator::before {
          animation: indicate linear both;
          animation-timeline: --main;
          animation-range: contain;
        }
        .header-right { display: flex; align-items: center; gap: .75rem; }
        .access-app { display: inline-block; padding: .5rem .75rem; border-radius: .5rem; background: #6b46c1; color: white; font-weight: 600; }
        .access-app:hover { background: #553c9a; }
        @keyframes indicate {
          0% { --color-indicator: #6b46c1; transform: translateY(0); }
          25% { --color-indicator: #ecc94b; }
          50% { --color-indicator: #2b6cb0; }
          75% { --color-indicator: #e53e3e; }
          100% { --color-indicator: #805ad5; transform: translateY(calc(100% - .625rem)); }
        }
        /* Commutation d'effets via radio (utilise :has) */
        .vitrine-wrapper:has([value="horizontal-scroll"]:checked) .content {
          animation: horizontal-scroll ease-in-out both;
          animation-timeline: --section;
        }
        .vitrine-wrapper:has([value="backwards-scroll"]:checked) .content {
          animation: backwards-scroll ease-in-out both;
          animation-timeline: --section;
        }
        .vitrine-wrapper:has([value="zoom-scroll"]:checked) .content {
          animation: zoom-scroll ease-in-out both;
          animation-timeline: --section;
        }
        @keyframes horizontal-scroll {
          0% { transform: translate3d(100%, 0%, 0); }
          50% { transform: none; }
          100% { transform: translate3d(-100%, 0%, 0); }
        }
        @keyframes backwards-scroll {
          0% { transform: translate3d(0%, -100%, 0); }
          50% { transform: none; }
          100% { transform: translate3d(0%, 100%, 0); }
        }
        @keyframes zoom-scroll {
          0% { filter: blur(5rem); transform: scale(0); opacity: 0; visibility: hidden; }
          50% { filter: blur(0); transform: none; opacity: 1; visibility: visible; }
          100% { filter: blur(3rem); transform: scale(1.5); opacity: 0; visibility: hidden; }
        }
        /* Helpers */
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      `}</style>
    </div>
  );
}
