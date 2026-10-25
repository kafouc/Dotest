import type { Metadata, Viewport } from 'next';
import AnalyticsGate from '@/components/consent/AnalyticsGate';
import ConsentBanner from '@/components/consent/ConsentBanner';
import { Unbounded, Questrial } from 'next/font/google';
import { jsonLdString, organizationJsonLd, SITE_DESCRIPTION, SITE_NAME, SITE_URL, websiteJsonLd } from '@/lib/seo';
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
  metadataBase: new URL(SITE_URL),
  title: { default: 'Sheet of Paper - Quiz IA et fiches de révision', template: '%s | Sheet of Paper' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Sheet of Paper',
    'quiz IA',
    'quiz à partir d’un PDF',
    'fiche de révision',
    'flashcards',
    'révision espacée',
    'quiz en direct QR code',
    'outil pour enseignants',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  category: 'education',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    title: 'Sheet of Paper - Quiz IA et fiches de révision',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: 'website',
    siteName: SITE_NAME,
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sheet of Paper - Quiz IA et fiches de révision',
    description: SITE_DESCRIPTION,
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
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#fbbf1d" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd) }} />
      </head>
      <body
        className={`${questrial.variable} ${unbounded.variable} font-body
                       bg-white
                       min-h-screen text-brand-dark`}
      >
        {children}
        <AnalyticsGate />
        <ConsentBanner />
      </body>
    </html>
  );
}
