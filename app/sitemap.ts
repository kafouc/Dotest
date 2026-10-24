import type { MetadataRoute } from 'next';

const SITE_URL = 'https://sheetofpaper.app';

const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/confidentialite', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/essai', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/vitrine', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/login', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/signup', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
