import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
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
  title: 'Sheet of Paper - Quiz IA',
  description: 'Générez des quiz intelligents à partir de vos documents avec l\'IA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sheet of Paper',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#fbbf1d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Sheet of Paper" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sheet of Paper" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#fbbf1d" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Sheet of Paper" />
        <meta property="og:description" content="Générez des quiz intelligents à partir de vos documents" />
        <meta property="og:site_name" content="Sheet of Paper" />
        <meta property="og:image" content="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${questrial.variable} ${unbounded.variable} font-body
                       bg-white
                       min-h-screen text-brand-dark`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
