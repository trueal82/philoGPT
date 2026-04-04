const CACHE_NAME = 'philogpt-v1';
const PRECACHE = [
  '/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET, socket, and API requests
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.url.includes('/socket.io/') ||
    request.url.includes('/config.js')
  ) {
    return;
  }

  // Network-first for navigation (SPA), cache-first for assets
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((cached) => cached || fetch(request))
      )
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
