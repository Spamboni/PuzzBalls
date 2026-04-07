// Service worker — network only, no caching at all
// Forces fresh fetch every time
self.addEventListener('install', function(e) {
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  // Clear ALL caches on activate
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(e) {
  // Always go to network, never cache
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
