import type { Metadata } from 'next';
import HomePage from '@/components/landing/HomePage';
import { faqJsonLd, jsonLdString, SITE_DESCRIPTION, softwareJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Sheet of Paper : quiz et fiches de révision par IA à partir de vos PDF' },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Sheet of Paper : quiz et fiches de révision par IA à partir de vos PDF',
    description: SITE_DESCRIPTION,
    url: '/',
  },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }} />
      <HomePage />
    </>
  );
}
