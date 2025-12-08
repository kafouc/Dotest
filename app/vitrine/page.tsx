/* eslint-disable @next/next/no-img-element */
// NOTE: Cette page a besoin de GSAP côté client; le metadata doit être déplacé dans un segment server.
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// metadata retiré car incompatible avec 'use client'. Créer un fichier server `app/vitrine/metadata.ts` si nécessaire.

// Page vitrine utilisant layout "cards" GSAP
export default function VitrinePage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const cards = gsap.utils.toArray<HTMLElement>('.vitrine-cards .c-card');
    if (!cards.length) return;
    const lastCardIndex = cards.length - 1;

    const lastCardST = ScrollTrigger.create({
      trigger: cards[cards.length - 1],
      start: 'center center',
    });

    cards.forEach((card, index) => {
      const scale = index === lastCardIndex ? 1 : 0.5;
      const scaleDown = gsap.to(card, { scale });
      ScrollTrigger.create({
        trigger: card,
        start: 'top top',
        end: () => lastCardST.start,
        pin: true,
        pinSpacing: false,
        scrub: 0.5,
        animation: scaleDown,
        toggleActions: 'restart none none reverse',
      });

      // Parallax doux sur l'image
      const img = card.querySelector<HTMLImageElement>('.c-card__figure img');
      if (img) {
        gsap.fromTo(
          img,
          { y: 20 },
          {
            y: -20,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              start: 'top top',
              end: () => lastCardST.start,
              scrub: 0.6,
            },
          },
        );
      }
    });

    // Typewriter effect (JS) inspiré du snippet
    let typingTimer: number | undefined;
    const tw = document.querySelector<HTMLElement>('.vitrine-cards .typewriter');
    if (tw) {
      const words = [
        'lancez des quiz en direct',
        'partagez par QR code',
        'corrigez instantanément',
        'révisez avec des flashcards',
      ];
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        tw.textContent = words[0];
      } else {
        let wi = 0; // word index
        let ci = 0; // char index
        let deleting = false;
        const tick = () => {
          const word = words[wi];
          if (!deleting) {
            tw.textContent = word.slice(0, ++ci);
            if (ci === word.length) {
              deleting = true;
              typingTimer = window.setTimeout(tick, 1200);
              return;
            }
          } else {
            tw.textContent = word.slice(0, --ci);
            if (ci === 0) {
              deleting = false;
              wi = (wi + 1) % words.length;
            }
          }
          typingTimer = window.setTimeout(tick, deleting ? 35 : 55);
        };
        typingTimer = window.setTimeout(tick, 300);
      }
    }

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      if (typingTimer) window.clearTimeout(typingTimer);
    };
  }, []);

  // Données structurées FAQ (JSON-LD)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Comment créer un quiz à partir d\'un PDF ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Importez votre PDF et validez. Le quiz est généré automatiquement en quelques secondes, prêt à être partagé en classe.',
        },
      },
      {
        '@type': 'Question',
        name: 'Faut-il un compte pour les élèves ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Non. Les élèves rejoignent via QR code ou code de session et saisissent un simple pseudo pour répondre.',
        },
      },
      {
        '@type': 'Question',
        name: 'Puis-je corriger en direct et afficher la bonne réponse ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Oui. Le tableau de bord professeur affiche les réponses en temps réel et permet de révéler la bonne réponse avec un commentaire.',
        },
      },
      {
        '@type': 'Question',
        name: 'La révision espacée est-elle incluse ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Oui. Convertissez les notions clés en flashcards et planifiez des révisions avec l\'algorithme SM‑2.',
        },
      },
    ],
  } as const;

  return (
    <section className="vitrine-cards">
      <header className="v-header">
        <p>Sheet of Paper · La plateforme de quiz en temps réel</p>
        <h1>
          Créez des quiz depuis vos PDF,
          {' '}
          <span className="typewriter" aria-live="polite" />
        </h1>
        <div>
          Importez un PDF et obtenez un quiz prêt à l’emploi en quelques secondes. 
        </div>
        <Link href="/app" className="v-link">Essayer gratuitement</Link>
      </header>

      <div className="l-cards">
  {/* CARD 1 – Génération depuis PDF (ordre image 1) */}
        <div className="c-card">
          <div className="c-card__description">
            <div className="c-card__tagline">Créez</div>
            <h2 className="c-card__title">Génération de quiz depuis PDF</h2>
            <div className="c-card__excerpt">Transformez vos cours et sujets en quiz en 1 clic. Idéal pour enseignants, formateurs, tuteurs et etudiants.</div>
            <div className="c-card__cta">
              <Link href="/app">Créer un quiz</Link>
            </div>
          </div>
          <figure className="c-card__figure">
            <img src={`/api/image-proxy?url=${encodeURIComponent('https://ibb.co/7xvQ4N2v')}`} alt="Génération de quiz depuis un PDF en 1 clic" />
          </figure>
        </div>

  {/* CARD 2 – Partage QR / code (ordre image 2) */}
        <div className="c-card">
          <div className="c-card__description">
            <div className="c-card__tagline">Partagez</div>
            <h2 className="c-card__title">QR code & code de session</h2>
            <div className="c-card__excerpt">Les élèves rejoignent en quelques secondes, sans compte. Smartphone, tablette ou ordinateur.</div>
                <div className="c-card__cta">
                  <Link href="/join">Rejoindre un quiz</Link>
                </div>
              </div>
              <figure className="c-card__figure">
                <img src={`/api/image-proxy?url=${encodeURIComponent('https://ibb.co/spKhbw69')}`} alt="Rejoindre un quiz par QR code ou code de session" />
              </figure>
            </div>

            {/* CARD 3 – Réponses & corrections (ordre image 3) */}
            <div className="c-card">
              <div className="c-card__description">
                <div className="c-card__tagline">Animez</div>
                <h2 className="c-card__title">Réponses en direct & corrections</h2>
                <div className="c-card__excerpt">Tableau de bord professeur: suivez les réponses en temps réel, affichez la bonne réponse et donnez un feedback immédiat.</div>
                <div className="c-card__cta">
                  <Link href="/live-dashboard/demo">Voir un exemple</Link>
                </div>
              </div>
              <figure className="c-card__figure">
                <img src={`/api/image-proxy?url=${encodeURIComponent('https://ibb.co/nMJ255bk')}`} alt="Tableau de bord des réponses en temps réel et corrections" />
              </figure>
            </div>

            {/* (Carte Analytics supprimée) */}

  {/* (ancienne carte Flashcards supprimée à votre demande) */}
  {/* CARD 4 – À propos (ordre image 4) */}
        <div className="c-card">
          <div className="c-card__description">
            <div className="c-card__tagline">À propos</div>
            <h2 className="c-card__title">Pourquoi Sheet of Paper</h2>
            <div className="c-card__excerpt">Conçu par <strong>Mathieu Coulibaly</strong>, développeur Full‑Stack, pour aider enseignants et formateurs à gagner du temps et à engager leurs apprenants.</div>
            <div className="c-card__cta">
              <a href="mailto:kafoumathieu.coulibaly@gmail.com">Me contacter</a>
            </div>
          </div>
          <figure className="c-card__figure">
            <img src={`/api/image-proxy?url=${encodeURIComponent('https://ibb.co/zVJxmHjs')}`} alt="À propos de Sheet of Paper et de son créateur" />
          </figure>
        </div>
        {/* CARD 5 – Contact (ordre image 5) */}
        <div className="c-card">
          <div className="c-card__description">
            <div className="c-card__tagline">Contact</div>
            <h2 className="c-card__title">Demander une démo</h2>
            <div className="c-card__excerpt">Vous souhaitez tester en classe ou en formation ? Écrivez‑moi et je vous montre comment démarrer en 5 minutes.</div>
            <div className="c-card__cta">
              <a href="mailto:kafoumathieu.coulibaly@gmail.com">Me contacter</a>
            </div>
          </div>
          <figure className="c-card__figure">
            <img src={`/api/image-proxy?url=${encodeURIComponent('https://ibb.co/pqcZmPp')}`} alt="Demander une démo par email" />
          </figure>
        </div>
      </div>

      {/* Extras: FAQ + Cas d'usage */}
      <section className="v-extras">
        <div className="v-faq">
          <h2>FAQ — Quiz en temps réel depuis PDF</h2>
          <details>
            <summary>Comment créer un quiz à partir d’un PDF&nbsp;?</summary>
            <div>
              Importez votre PDF et validez. Le quiz est généré automatiquement en quelques secondes, prêt à être partagé.
            </div>
          </details>
          <details>
            <summary>Faut‑il un compte pour les élèves&nbsp;?</summary>
            <div>
              Non. Ils rejoignent via QR code ou code de session et utilisent un simple pseudo.
            </div>
          </details>
          <details>
            <summary>Puis‑je corriger en direct et afficher la bonne réponse&nbsp;?</summary>
            <div>
              Oui. Le tableau de bord professeur affiche les réponses en temps réel et permet de révéler la bonne réponse avec un commentaire.
            </div>
          </details>
          <details>
            <summary>La révision espacée est‑elle incluse&nbsp;?</summary>
            <div>
              Oui. Convertissez les notions clés en flashcards et planifiez des révisions avec l’algorithme SM‑2.
            </div>
          </details>
        </div>

        <div className="v-usecases">
          <h2>Cas d’usage — Enseignement et formation</h2>
          <ul>
            <li><strong>Cours en présentiel</strong> — lancez un quiz de démarrage ou de fin de séance pour garder l’attention.</li>
            <li><strong>Classe inversée / devoirs</strong> — vérifiez la compréhension à distance en quelques minutes.</li>
            <li><strong>Formation pro / onboarding</strong> — mesurez l’acquisition rapide des notions clés.</li>
            <li><strong>Préparation examens & concours</strong> — révisez régulièrement avec des flashcards ciblées.</li>
          </ul>
        </div>

        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </section>

     

      {/* CTA final */}
      <section className="v-final-cta" aria-labelledby="final-cta-heading">
        <h2 id="final-cta-heading">Prêt à essayer ?</h2>
        <p>
          Enseignants, formateurs <strong>et étudiants</strong> : générez un quiz à partir de vos documents ou
          révisez vos cours avec des quiz et des flashcards espacées. Commencez gratuitement, sans carte bancaire.
        </p>
        <div className="v-final-cta__actions">
          <Link href="/app" className="v-final-cta__btn">Créer un quiz maintenant</Link>
        
        </div>
      </section>

      <div className="spacer" />
  <div className="wave" />
  <div className="wave" />
  <div className="wave" />

      <style jsx global>{`
        .vitrine-cards *, .vitrine-cards *::before, .vitrine-cards *::after { box-sizing: border-box; }
  .vitrine-cards { --color-dark:#202330; --color-white:#fff; background: transparent; color: var(--color-white); }
        .vitrine-cards .v-header { max-width:1024px; margin:0 auto; padding:64px 20px; text-align:center; }
        .vitrine-cards .v-header p { margin-bottom:16px; }
        .vitrine-cards .v-header h1 { margin-bottom:24px; font-size: clamp(28px,4vw,44px); line-height:1.15; font-weight: 700; letter-spacing:-.01em; }
        .vitrine-cards .v-header div { margin-bottom:24px; font-size:18px; line-height:32px; opacity:.95; }
        .vitrine-cards .v-header .v-link { font-size:20px; color: var(--color-white); opacity:1; text-decoration: underline; }
        .vitrine-cards .v-header .v-link:hover { opacity:.85; }

        /* Typewriter inspiré du snippet fourni */
        .vitrine-cards .typewriter { position: relative; display:inline-block; min-width: 22ch; text-align:left; white-space: nowrap; vertical-align: -0.1em; }
        .vitrine-cards .typewriter::after { content: ""; border-right: 2px solid currentColor; margin-left: 2px; animation: vt-caret .7s step-end infinite; }
        @keyframes vt-caret { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .vitrine-cards .typewriter::after { animation: none; } }
        .vitrine-cards .l-cards { width:100%; max-width:1200px; margin:0 auto; }
        .vitrine-cards .c-card { display:grid; grid-template-columns: repeat(2, 1fr); gap:24px; margin-top:20px; width:100%; height:90vh; min-height:600px; background:#fff; color:#000; border:1px solid var(--color-dark); transform-origin:center center; }
        .vitrine-cards .c-card__description { display:flex; flex-direction:column; justify-content:center; padding:40px; }
        .vitrine-cards .c-card__tagline { font-size:16px; font-weight:600; text-transform:uppercase; }
        .vitrine-cards .c-card__title { font-size: clamp(24px,3vw,36px); margin:8px 0 12px; }
        .vitrine-cards .c-card__excerpt { font-size:16px; line-height:1.6; opacity:.95; }
        .vitrine-cards .c-card__cta { display:flex; align-items:center; gap:16px; margin-top:32px; }
  .vitrine-cards .c-card__cta a { position:relative; width:max-content; padding:12px 24px; border:1px solid #000; color:#000; font-size:16px; text-decoration:none; border-radius:10px; background:#fff; transition: transform .2s ease, box-shadow .25s ease, background .25s ease, color .25s ease; overflow:hidden; }
  .vitrine-cards .c-card__cta a::before { content:''; position:absolute; top:0; left:-150%; height:100%; width:50%; background: linear-gradient(120deg, transparent, rgba(255,255,255,.55), transparent); transform: skewX(-20deg); transition: left .6s ease; }
  .vitrine-cards .c-card__cta a:hover::before { left: 150%; }
  .vitrine-cards .c-card__cta a:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 30px -12px rgba(0,0,0,.35); background:#111; color:#fff; }
  .vitrine-cards .c-card__cta a:active { transform: translateY(0) scale(0.99); }
        .vitrine-cards .c-card__figure { position:relative; overflow:hidden; }
        .vitrine-cards .c-card__figure img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .vitrine-cards .spacer { width:100%; height:100vh; }
  /* Extras */
  .vitrine-cards .v-extras { max-width:1024px; margin: 40px auto 0; padding: 0 20px 20px; }
  .vitrine-cards .v-faq, .vitrine-cards .v-usecases { border:1px solid rgba(255,255,255,.18); border-radius:16px; padding:24px; background: rgba(0,0,0,.15); backdrop-filter: blur(2px); margin-bottom: 16px; }
  .vitrine-cards .v-faq h2, .vitrine-cards .v-usecases h2 { font-size: clamp(20px,2.4vw,28px); margin:0 0 12px; }
  .vitrine-cards .v-faq details { border-top: 1px dashed rgba(255,255,255,.2); padding: 12px 0; }
  .vitrine-cards .v-faq details:first-of-type { border-top: 0; }
  .vitrine-cards .v-faq summary { cursor: pointer; font-weight: 600; list-style: none; }
  .vitrine-cards .v-faq summary::-webkit-details-marker { display:none; }
  .vitrine-cards .v-faq details > div { opacity: .95; margin-top: 8px; line-height: 1.6; }
  .vitrine-cards .v-usecases ul { display:grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; padding:0; margin:0; list-style: none; }
  .vitrine-cards .v-usecases li { line-height:1.6; }
  @media (max-width: 720px) { .vitrine-cards .v-usecases ul { grid-template-columns: 1fr; } }

  /* Témoignages */
  .vitrine-cards .v-testimonials { max-width:1024px; margin: 20px auto 0; padding: 0 20px 10px; }
  .vitrine-cards .v-testimonials h2 { font-size: clamp(20px,2.4vw,28px); margin:0 0 24px; }
  .vitrine-cards .v-testimonials__grid { display:grid; gap:20px; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); }
  .vitrine-cards .v-testimonial { background: rgba(0,0,0,.15); border:1px solid rgba(255,255,255,.18); padding:20px 20px 16px; border-radius:14px; backdrop-filter: blur(2px); }
  .vitrine-cards .v-testimonial blockquote { margin:0 0 12px; font-size:15px; line-height:1.5; font-style:italic; }
  .vitrine-cards .v-testimonial figcaption { font-size:13px; opacity:.85; }

  /* CTA final */
  .vitrine-cards .v-final-cta { max-width:1024px; margin: 20px auto 0; padding: 28px 24px 40px; text-align:center; background: linear-gradient(135deg, rgba(0,0,0,.15), rgba(0,0,0,.35)); border:1px solid rgba(255,255,255,.18); border-radius:20px; backdrop-filter: blur(3px); }
  .vitrine-cards .v-final-cta h2 { margin:0 0 16px; font-size: clamp(24px,3vw,34px); }
  .vitrine-cards .v-final-cta p { max-width:760px; margin:0 auto 28px; font-size:16px; line-height:1.6; }
  .vitrine-cards .v-final-cta__actions { display:flex; flex-wrap:wrap; gap:16px; justify-content:center; }
  .vitrine-cards .v-final-cta__btn { position:relative; padding:14px 28px; border:1px solid #fff; border-radius:12px; text-decoration:none; color:#fff; font-weight:600; font-size:16px; background: rgba(255,255,255,.08); backdrop-filter: blur(2px); transition: background .25s, transform .25s, box-shadow .3s; }
  .vitrine-cards .v-final-cta__btn:hover { background: #fff; color:#000; transform: translateY(-3px); box-shadow:0 14px 30px -12px rgba(0,0,0,.55); }
  .vitrine-cards .v-final-cta__btn:active { transform: translateY(0); }
  .vitrine-cards .v-final-cta__btn.alt { border-color:#fff; }
  @media (max-width:600px) { .vitrine-cards .v-final-cta__actions { flex-direction:column; } }
        @media (max-width: 960px) { .vitrine-cards .c-card { grid-template-columns:1fr; height:auto; min-height:80vh; } .vitrine-cards .c-card__figure { min-height:40vh; } }
      `}</style>
    </section>
  );
}
