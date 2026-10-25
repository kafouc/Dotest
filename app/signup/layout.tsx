import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description: 'Créez votre compte Sheet of Paper et transformez vos cours en quiz, fiches de révision et flashcards. Gratuit, sans carte bancaire.',
  alternates: { canonical: '/signup' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
