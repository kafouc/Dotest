import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Police système corps de texte
const inter = Inter({ subsets: ['latin'] });

// Police variable display (Geist)
const geist = localFont({
  src: [
    { path: './fonts/GeistVF.woff', style: 'normal' },
    { path: './fonts/GeistMonoVF.woff', style: 'normal' }
  ],
  variable: '--font-display'
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
        className={`${inter.className} ${geist.variable} 
                       bg-gradient-to-r from-gradient-start via-gradient-middle to-gradient-end 
                       bg-[length:200%_200%] bg-no-repeat bg-cover bg-fixed animate-gradient-background
                       min-h-screen text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
