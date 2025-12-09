'use client';

import Link from 'next/link';

const plans = [
  {
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    description: 'Parfait pour essayer la plateforme',
    features: [
      'Jusqu\'à 5 documents par mois',
      'Quiz illimités',
      'Jusqu\'à 20 participants par session',
      'Flashcards basiques',
      'Support communautaire',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pro',
    price: '19€',
    period: '/mois',
    description: 'Pour les enseignants et formateurs actifs',
    features: [
      'Documents illimités',
      'Quiz illimités',
      'Participants illimités',
      'Flashcards avancées',
      'Révision espacée (SM-2)',
      'Support prioritaire',
      'Statistiques détaillées',
    ],
    cta: 'Essayer Pro',
    popular: true,
  },
  {
    name: 'Établissement',
    price: 'Sur mesure',
    period: '',
    description: 'Pour les écoles et organisations',
    features: [
      'Tout de Pro',
      'Gestion multi-utilisateurs',
      'API personnalisée',
      'Formation dédiée',
      'Support dédié',
      'Personnalisation de marque',
    ],
    cta: 'Nous contacter',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-12 md:py-20 bg-gradient-to-br from-gray-50 to-brand-teal-light">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-brand-dark mb-3 md:mb-4">
            Tarifs simples et transparents
          </h2>
          <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Choisissez le plan qui correspond à vos besoins
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-6 md:p-8 rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-2 ${
                plan.popular
                  ? 'bg-white border-4 border-brand-yellow md:scale-105'
                  : 'bg-white border-2 border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-yellow text-brand-dark px-4 py-1 rounded-full text-sm font-semibold">
                  Populaire
                </div>
              )}
              <div className="text-center mb-5 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-brand-dark mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl md:text-4xl font-bold text-brand-dark">{plan.price}</span>
                  {plan.period && <span className="text-gray-600 text-sm md:text-base">{plan.period}</span>}
                </div>
                <p className="text-sm md:text-base text-gray-600 mt-2">{plan.description}</p>
              </div>
              <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-brand-teal text-lg md:text-xl flex-shrink-0">✓</span>
                    <span className="text-sm md:text-base text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.name === 'Établissement' ? 'mailto:kafoumathieu.coulibaly@gmail.com' : '/app'}
                className="block w-full text-center py-3 rounded-full font-semibold transition-all duration-200 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark text-sm md:text-base min-h-[44px] flex items-center justify-center"
                style={{ backgroundColor: '#fbbf1d' }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

