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
  metadataBase: new URL('https://sheetofpaper.app'),
  title: 'Sheet of Paper - Quiz IA',
  description: 'Générez des quiz intelligents à partir de vos documents avec l\'IA',
  keywords: [
    'Sheet of Paper',
    'sheetofpaper',
    'quiz IA',
    'fiche de revision',
    'révision intelligente',
    'quiz interactif',
    'flashcards',
  ],
  alternates: {
    canonical: 'https://sheetofpaper.app',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sheet of Paper',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Sheet of Paper - Quiz IA',
    description: 'Générez des quiz intelligents à partir de vos documents avec l\'IA',
    url: 'https://sheetofpaper.app',
    type: 'website',
    siteName: 'Sheet of Paper',
    images: [
      {
        url: 'https://sheetofpaper.app/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Logo Sheet of Paper',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sheet of Paper - Quiz IA et fiches de révision',
    description: 'Créez des quiz IA, fiches de révision et flashcards à partir de vos documents.',
    images: ['https://sheetofpaper.app/icons/icon-512x512.png'],
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
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sheet of Paper',
    url: 'https://sheetofpaper.app',
    logo: 'https://sheetofpaper.app/icons/icon-512x512.png',
    sameAs: [
      'https://sheetofpaper.app',
    ],
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Sheet of Paper',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: 'https://sheetofpaper.app',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    description: "Application web pour créer des quiz IA, fiches de révision et flashcards à partir de documents.",
    image: 'https://sheetofpaper.app/icons/icon-512x512.png',
  };

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
        <meta name="keywords" content="Sheet of Paper, sheetofpaper, quiz IA, fiche de revision, quiz interactif, flashcards" />
        
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Sheet of Paper - Quiz IA" />
        <meta property="og:description" content="Générez des quiz intelligents, fiches de révision et flashcards à partir de vos documents." />
        <meta property="og:site_name" content="Sheet of Paper" />
        <meta property="og:url" content="https://sheetofpaper.app" />
        <meta property="og:image" content="https://sheetofpaper.app/icons/icon-512x512.png" />
        <meta property="og:image:alt" content="Logo Sheet of Paper" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Sheet of Paper - Quiz IA et fiches de révision" />
        <meta name="twitter:description" content="Créez des quiz IA, fiches de révision et flashcards à partir de vos documents." />
        <meta name="twitter:image" content="https://sheetofpaper.app/icons/icon-512x512.png" />
        <meta name="twitter:image:alt" content="Logo Sheet of Paper" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
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
