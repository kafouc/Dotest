'use client';

import Link from 'next/link';

// Page vitrine/accueil avec slides sticky et animations de scroll
export default function VitrinePage() {
  return (
    <div className="vitrine-wrapper">
      {/* En-tête: CTA centré */}
      <header className="site-header">
        <h1 className="sr-only">Sheet of Paper – Page vitrine</h1>
        <Link href="/app" className="access-app">Accéder à l&apos;application</Link>
      </header>

      <main>
        {/* Modèle 1: sections sticky plein écran + dégradés */}
        <section id="intro" className="section">
          <div className="content bg-gradient-to-b from-green-200 to-blue-200 text-black flex flex-col items-center justify-center px-4">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-center">Sheet of Paper</h2>
            <p className="mt-4 text-base sm:text-lg md:text-xl max-w-3xl text-center leading-relaxed">
              Créez des <strong>quiz</strong> interactifs en 1 clic, partagez en <strong>temps réel</strong>, et mémorisez avec des <strong>flashcards</strong>.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/join" className="px-5 py-2 rounded-md bg-brand-pink text-white hover:bg-brand-pink-dark text-center">Rejoindre un quiz</Link>
            </div>
            <p className="mt-6 text-xs sm:text-sm opacity-80">Faites défiler pour découvrir</p>
          </div>
        </section>

        <section id="features" className="section">
          <div className="content bg-gradient-to-b from-indigo-800 to-purple-800 text-white flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center">Fonctionnalités clés</h2>
            <ul className="mt-4 space-y-2 text-base sm:text-lg max-w-2xl">
              <li>• Génération <strong>intelligente</strong> de quiz à partir de vos PDF</li>
              <li>• Partage <strong>instantané</strong> par <strong>QR</strong> ou code</li>
              <li>• <strong>Tableau de bord</strong> enseignant: participants, réponses, corrections</li>
              <li>• <strong>Statistiques</strong>: distribution, score, détails par élève</li>
              <li>• <strong>Flashcards</strong> avec SM‑2 simplifié pour ancrer les connaissances</li>
            </ul>
          </div>
        </section>

        <section id="how" className="section">
          <div className="content bg-gradient-to-b from-purple-800 to-pink-800 text-white flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-center">Comment l&apos;utiliser</h2>
            <ol className="mt-4 space-y-2 text-base sm:text-lg max-w-3xl">
              <li>1. Importez un PDF — traitement <strong>automatique</strong>.</li>
              <li>2. Générez un <strong>quiz</strong> en un clic.</li>
              <li>3. Partagez en <strong>live</strong> (QR/code) et démarrez la session.</li>
              <li>4. Suivez les réponses sur le <strong>dashboard</strong>.</li>
              <li>5. Créez des <strong>flashcards</strong> et révisez-les.</li>
            </ol>
          </div>
        </section>

        <section id="live" className="section">
          <div className="content bg-gradient-to-b from-blue-200 to-indigo-100 text-black flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl sm:text-4xl font-bold">Live Quiz</h2>
            <p className="mt-4 text-base sm:text-lg max-w-2xl text-center">
              Sessions en direct sécurisées (Supabase Realtime + RLS). Rejoindre en secondes, réponses <strong>instantanées</strong>.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/join" className="px-5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-center">Rejoindre</Link>
            </div>
          </div>
        </section>

        <section id="flashcards" className="section">
          <div className="content bg-gradient-to-b from-amber-100 to-rose-100 text-black flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl sm:text-4xl font-bold">Flashcards</h2>
            <p className="mt-4 text-base sm:text-lg max-w-2xl text-center">
              Répétez avec <strong>SM‑2</strong> pour ancrer durablement. Ciblé. Efficace. Durable.
            </p>
            <Link href="/flashcards" className="mt-6 px-5 py-2 rounded-md bg-brand-purple text-white hover:bg-brand-purple-dark text-center">Réviser des flashcards</Link>
          </div>
        </section>

        <section id="contact" className="section">
          <div className="content bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl sm:text-4xl font-bold">À propos</h2>
            <p className="mt-4 text-base sm:text-lg max-w-2xl text-center">
              Je suis <strong>Mathieu Coulibaly</strong>, développeur <strong>Full‑Stack</strong>, étudiant et freelancer. Mon focus: des outils simples, <strong>utiles</strong>, et <strong>rapides</strong> pour l’éducation.
            </p>
            <a href="mailto:kafoumathieu.coulibaly@gmail.com" className="mt-6 px-5 py-2 rounded-md bg-brand-pink text-white hover:bg-brand-pink-dark text-center">
              Me contacter: kafoumathieu.coulibaly@gmail.com
            </a>
          </div>
        </section>
      </main>

      {/* Styles: effet unique zoom-scroll + header centré + responsive */}
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
          position: sticky;
          top: 0;
          inset-inline: 0;
          min-height: 100dvh;
          background-color: var(--color-background, black);
          animation: zoom-scroll ease-in-out both;
          animation-timeline: --section;
        }
        /* Header centré et responsive */
        .site-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center; padding: .75rem 1rem; backdrop-filter: blur(8px); background: rgba(0,0,0,.15); }
        .access-app { display: inline-block; padding: .6rem 1rem; border-radius: .625rem; background: #6b46c1; color: white; font-weight: 700; letter-spacing: .2px; }
        .access-app:hover { background: #553c9a; }
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
