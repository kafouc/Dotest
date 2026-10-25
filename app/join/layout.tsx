import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rejoindre un quiz en direct',
  description: 'Saisissez le code de la séance donné par votre enseignant pour répondre au quiz en direct, sans compte.',
  alternates: { canonical: '/join' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
