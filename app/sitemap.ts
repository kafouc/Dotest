import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Date de dernière modification réelle des pages publiques : à mettre à jour quand leur contenu change
// (une date « maintenant » à chaque exploration ne renseigne pas les moteurs de recherche).
const LAST_MODIFIED = new Date('2026-10-25');

const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/essai', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/demo', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/vitrine', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/signup', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/confidentialite', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency,
    priority,
  }));
}
