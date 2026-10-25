import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tutoriel : découvrir l’application en 2 minutes',
  description: 'Découvrez Sheet of Paper en 2 minutes : importer un cours, générer un quiz sourcé, réviser au bon moment, animer une séance en direct. Sans inscription.',
  alternates: { canonical: '/demo' },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
