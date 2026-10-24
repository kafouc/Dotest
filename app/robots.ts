import type { MetadataRoute } from 'next';

const SITE_URL = 'https://sheetofpaper.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/app/',
          '/live-dashboard/',
          '/api/',
          '/flashcards/',
          '/review/',
          '/classes/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
