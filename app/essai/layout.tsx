import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Essayer gratuitement un quiz IA sans compte',
  description:
    'Collez un extrait de cours et obtenez un mini-quiz en quelques secondes, avec la source de chaque question. Sans compte, sans carte bancaire.',
  alternates: { canonical: '/essai' },
};

export default function EssaiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
