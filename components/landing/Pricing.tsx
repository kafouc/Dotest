'use client';

import Link from 'next/link';

const plans = [
  {
    name: 'Découverte',
    price: '0€',
    period: '',
    description: 'Idéal pour tester SheetOfPaper en autonomie.',
    features: [
      'Notifications push FSRS incluses',
      '2 documents / semaine · 100 pages max/document',
      'Fiches de révision : 1 document/semaine',
      'Quiz générés : 3/semaine/document',
      'Sessions live : 10 participants max (sans co-animateur)',
      'Accès au centre d’aide',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pass Partiel',
    price: '2,99€',
    period: '/7 jours',
    description: 'Pour les périodes d’examen ou les ateliers intensifs.',
    features: [
      '10 documents / semaine · 100 pages max/document',
      'Notifications push FSRS incluses',
      'Fiches de révision : 10 documents/semaine',
      'Quiz générés : 10/semaine/document',
      'Sessions live : 15 participants max (sans co-animateur)',
      'Délimitation de pages assistée',
      'Analytics essentiels',
      'Accès aux modèles IA intermédiaires',
    ],
    cta: 'Activer le Pass Partiel',
    popular: true,
  },
  {
    name: 'Passe Sérénité',
    price: '4,99€',
    period: '/mois',
    description: 'Accès complet, conçu pour les formateurs exigeants.',
    features: [
      'Documents illimités · 100 pages max/document',
      'Notifications push FSRS incluses',
      'Fiches de révision illimitées (cap 50/mois)',
      'Quiz générés illimités (cap 50/mois)',
      'Sessions live illimitées (jusqu\'à 300 participants, sans co-animateur)',
      'Délimitation de pages avancée',
      'Analytics complets + exports',
      'Modèles IA Pro (GPT & associés)',
      'Support prioritaire 24h',
    ],
    cta: 'Choisir Sérénité',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-4xl text-center md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-brand-dark mb-4 md:mb-6">
            Une offre freemium claire pour chaque situation
          </h2>
          <p className="text-base md:text-xl text-brand-dark-lighter">
            Passez du test à l’usage quotidien sans surprise budgétaire. Chaque plan respecte la limite de 100 pages par document.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative overflow-hidden rounded-3xl border p-6 shadow-[0_25px_80px_-30px_rgba(51,51,51,0.55)] backdrop-blur-3xl transition-all duration-300 hover:-translate-y-2 ${
                plan.popular
                  ? 'border-white/70 bg-white/45 hover:border-white/80 hover:bg-white/55 md:scale-[1.03]'
                  : 'border-white/45 bg-white/30 hover:border-white/60 hover:bg-white/40'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-dark shadow-[0_18px_48px_-26px_rgba(251,191,29,0.85)]">
                  Recommandé
                </div>
              )}
              <div className="text-center md:mb-8">
                <h3 className="mb-3 text-xl font-bold text-brand-dark md:text-2xl">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-brand-dark md:text-4xl">{plan.price}</span>
                  {plan.period && <span className="text-sm text-brand-dark-lighter md:text-base">{plan.period}</span>}
                </div>
                <p className="mt-3 text-sm text-brand-dark-lighter md:text-base">{plan.description}</p>
              </div>
              <ul className="mb-8 space-y-3 text-left">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-brand-dark-lighter md:text-base">
                    <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-teal/80 to-brand-yellow/80 text-xs font-bold text-white shadow-[0_10px_25px_-18px_rgba(69,191,154,0.9)]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={
                  plan.name === 'Pass Partiel'
                    ? '/signup?plan=partial'
                    : plan.name === 'Passe Sérénité'
                    ? '/signup?plan=serenite'
                    : '/signup'
                }
                className="group flex min-h-[48px] w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-yellow via-brand-yellow-dark to-brand-teal px-6 py-3 text-sm font-semibold text-brand-dark shadow-[0_20px_42px_-20px_rgba(251,191,29,0.75)] transition duration-300 hover:scale-[1.02] hover:shadow-[0_30px_60px_-24px_rgba(45,143,111,0.55)] md:min-h-[56px] md:text-base"
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xs uppercase tracking-[0.25em] text-brand-dark-lighter md:mt-14 md:text-sm">
          Quotas remis à zéro chaque semaine • Changement de plan à la demande
        </p>
      </div>
    </section>
  );
}

