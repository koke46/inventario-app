// Service Worker — Inventario Fresco
// Estrategia: red primero, caché como fallback (offline)
const CACHE = 'inventario-v2';

self.addEventListener('install', e => {
  // Pre-cachea ambas apps al instalar el SW
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      'inventario-fresco.html',
      'inventario-tienda.html',
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Borra cachés viejas al actualizar
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.pathname.endsWith('.html')) return; // solo intercepta HTML
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Clona síncronamente antes de cualquier gap async
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone));
        return res;
      })
      .catch(() =>
        // Sin internet: sirve desde caché (con o sin query params)
        caches.match(e.request) ||
        caches.match(url.origin + url.pathname)
      )
  );
});
