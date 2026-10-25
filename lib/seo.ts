import { FAQS } from '@/lib/faqData';

export const SITE_URL = 'https://sheetofpaper.app';
export const SITE_NAME = 'Sheet of Paper';
export const SITE_DESCRIPTION =
  'Transformez vos PDF, cours Word et PowerPoint en quiz, fiches de révision et flashcards avec l’IA. Séances en direct par QR code, révision espacée, notifications. Gratuit pour commencer.';

/** Données structurées globales (toutes les pages) : l'éditeur et le site. */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512x512.png`,
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'fr',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

/** Page d'accueil : l'application et ses forfaits (prix identiques à components/landing/Pricing.tsx). */
export const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web, iOS, Android',
  url: SITE_URL,
  inLanguage: 'fr',
  description: SITE_DESCRIPTION,
  image: `${SITE_URL}/icons/icon-512x512.png`,
  offers: [
    { '@type': 'Offer', name: 'Découverte', price: '0', priceCurrency: 'EUR' },
    { '@type': 'Offer', name: 'Pass Partiel (7 jours)', price: '2.99', priceCurrency: 'EUR' },
    { '@type': 'Offer', name: 'Passe Sérénité (mensuel)', price: '4.99', priceCurrency: 'EUR' },
  ],
};

export const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

/** `<` échappé : une donnée structurée ne peut pas fermer la balise script. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
