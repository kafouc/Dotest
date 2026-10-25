import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre compte Sheet of Paper pour retrouver vos documents, quiz et révisions.',
  alternates: { canonical: '/login' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
