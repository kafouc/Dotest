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
    <section id="faq" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-brand-dark mb-4">
            Questions fréquentes
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Tout ce que vous devez savoir sur Sheet of Paper
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="mb-4 border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-brand-dark">{faq.question}</span>
                <span className={`text-2xl transition-transform duration-200 ${openIndex === index ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-white text-gray-700 leading-relaxed animate-in slide-in-from-top-2">
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

