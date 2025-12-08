import type { Metadata } from 'next';
import { Unbounded, Questrial } from 'next/font/google';
import './globals.css';

// Police pour les titres - Unbounded
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

// Police pour le texte - Questrial
const questrial = Questrial({
  subsets: ['latin'],
  variable: '--font-zalando',
  weight: ['400'],
  display: 'swap',
  style: 'normal',
});

export const metadata: Metadata = {
  title: 'IA Quiz App',
  description: 'Générez des quiz à partir de vos cours',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body
        className={`${questrial.variable} ${unbounded.variable} font-body
                       bg-white
                       min-h-screen text-brand-dark`}
      >
        {children}
      </body>
    </html>
  );
}
