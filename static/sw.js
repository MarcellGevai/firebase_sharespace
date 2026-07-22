const CACHE_NAME = 'sharespace-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through to satisfy PWA criteria. 
  // We can add offline caching later if needed.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Hálózati hiba. Kérlek ellenőrizd az internetkapcsolatodat.', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    })
  );
});
