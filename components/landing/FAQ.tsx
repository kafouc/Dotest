'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'Comment créer un quiz à partir d\'un PDF ?',
    answer:
      'Importez votre PDF et validez. Le quiz est généré automatiquement en quelques secondes, prêt à être partagé en classe.',
  },
  {
    question: 'Faut-il un compte pour les élèves ?',
    answer:
      'Non. Les élèves rejoignent via QR code ou code de session et saisissent un simple pseudo pour répondre.',
  },
  {
    question: 'Puis-je corriger en direct et afficher la bonne réponse ?',
    answer:
      'Oui. Le tableau de bord professeur affiche les réponses en temps réel et permet de révéler la bonne réponse avec un commentaire.',
  },
  {
    question: 'La révision espacée est-elle incluse ?',
    answer:
      'Oui. Convertissez les notions clés en flashcards et planifiez des révisions avec l\'algorithme SM‑2.',
  },
  {
    question: 'Quels formats de PDF sont supportés ?',
    answer:
      'Nous supportons tous les PDFs standards. La limite est de 2 Mo et 20 pages par document pour garantir une génération rapide.',
  },
  {
    question: 'Puis-je utiliser Sheet of Paper hors ligne ?',
    answer:
      'Non, Sheet of Paper nécessite une connexion internet pour la génération de quiz et la synchronisation en temps réel.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Données structurées FAQ (JSON-LD)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section id="faq" className="relative py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-brand-dark mb-4 md:mb-6">
            Questions fréquentes
          </h2>
          <p className="text-base md:text-xl text-brand-dark-lighter">
            Tout ce que vous devez savoir sur Sheet of Paper
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-4 md:space-y-5">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-white/45 bg-white/25 shadow-[0_20px_70px_-30px_rgba(51,51,51,0.45)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-white/70 hover:bg-white/35"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-brand-dark transition duration-200 md:px-7 md:py-5 md:text-base"
              >
                <span className="pr-2">{faq.question}</span>
                <span className={`text-lg transition-transform duration-200 md:text-xl ${openIndex === index ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5 text-sm leading-relaxed text-brand-dark-lighter md:px-7 md:text-base">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </div>
    </section>
  );
}

