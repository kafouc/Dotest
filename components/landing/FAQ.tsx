'use client';

import { useState } from 'react';
import { FAQS as faqs } from '@/lib/faqData';

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

