import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

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
          '/settings',
          '/challenge/',
          '/auth/',
          '/compte-supprime',
          '/join/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
