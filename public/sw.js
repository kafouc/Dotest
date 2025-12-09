const CACHE_NAME = 'sheet-of-paper-v3';
const urlsToCache = [
  '/',
  '/app',
  '/settings',
  '/manifest.json',
  '/offline.html',
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégies de cache différenciées
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) Navigations (HTML): Network-first, fallback offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Mémoriser une copie en cache (seulement GET)
          if (req.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (err) {
          // Offline → essayer le cache, sinon offline.html
          const cached = await caches.match(req);
          return (
            cached ||
            (await caches.match('/offline.html'))
          );
        }
      })()
    );
    return;
  }

  // 2) Assets statiques: Cache-first avec mise à jour en arrière-plan
  const url = new URL(req.url);
  const isAsset = (
    req.destination === 'style' ||
    req.destination === 'script' ||
    req.destination === 'image' ||
    req.destination === 'font' ||
    url.pathname.startsWith('/icons/')
  );

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then((res) => {
            cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        // Retourne d'abord le cache si présent, sinon le réseau
        return cached || (await networkFetch) || cached;
      })()
    );
    return;
  }

  // 3) Par défaut: Network-first, fallback cache (uniquement GET)
  event.respondWith(
    (async () => {
      // Ne pas mettre en cache les POST/PUT/DELETE
      if (req.method !== 'GET') {
        return fetch(req);
      }
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || new Response('Offline', { status: 503 });
      }
    })()
  );
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
