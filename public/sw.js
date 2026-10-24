const CACHE_NAME = 'sheet-of-paper-v4';

// On ne précache que des ressources publiques et identiques pour tout le monde.
// Les pages applicatives (/app, /settings) et les réponses d'API sont propres à
// chaque utilisateur : elles ne doivent jamais être stockées sur l'appareil.
const urlsToCache = ['/manifest.json', '/offline.html'];

// Chemins qui ne passent jamais par le cache (données privées, auth, paiement)
const NEVER_CACHE_PREFIXES = ['/api/', '/auth/', '/login', '/signup', '/app', '/settings', '/admin', '/live-dashboard'];

function isCacheableAsset(req, url) {
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) return true;
  return (
    req.destination === 'style' ||
    req.destination === 'script' ||
    req.destination === 'font' ||
    req.destination === 'image'
  );
}

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activation : supprime tous les anciens caches (dont ceux des versions précédentes,
// qui pouvaient contenir des pages et réponses d'API privées)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

// Vidage du cache à la déconnexion
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Seulement les GET de même origine : Supabase, Stripe, etc. ne sont pas interceptés
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) Navigations : toujours le réseau, jamais de HTML en cache.
  //    Hors ligne, on affiche uniquement la page de repli publique.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/offline.html')) || Response.error())
    );
    return;
  }

  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  // 2) Ressources statiques : cache d'abord, mise à jour en arrière-plan
  if (isCacheableAsset(req, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await networkFetch) || Response.error();
      })()
    );
  }
  // Tout le reste : comportement réseau normal, sans cache
});

// Gestion des notifications push
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'Sheet of Paper';
  const body = data.body || 'Rappel de révision';
  const icon = data.icon || '/icons/icon-192x192.png';
  const tag = data.tag || 'sheet-of-paper';
  const url = data.url || '/app';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-72x72.png',
      tag,
      vibrate: [200, 100, 200],
      data: { url },
      actions: [
        { action: 'open', title: 'Ouvrir' },
        { action: 'close', title: 'Fermer' },
      ],
    })
  );
});

// Gestion du clic sur les notifications
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
