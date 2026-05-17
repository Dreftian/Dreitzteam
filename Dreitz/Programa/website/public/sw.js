/**
 * Service Worker del landing público de Dreitz.
 *
 * Estrategia:
 *  - Precache de los assets críticos al instalar (HTML + assets/* del manifest).
 *  - Network-first para HTML (siempre buscamos la última versión deployada).
 *  - Cache-first para /assets/* (immutable, cache busting por hash en filename).
 *  - Cache-first para fuentes (Google Fonts via stale-while-revalidate).
 *
 * Resultado: el landing carga instantáneo desde caché incluso offline, pero el
 * usuario nunca ve una versión vieja del HTML/UI cuando hay internet.
 */
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `dreitz-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `dreitz-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/tian.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo cacheamos GETs same-origin + Google Fonts
  if (event.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  const isFonts = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (!sameOrigin && !isFonts) return;

  // Assets con hash → cache-first (immutable)
  if (sameOrigin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
    return;
  }

  // HTML / navegación → network-first
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE));
    return;
  }

  // Fuentes → stale-while-revalidate
  if (isFonts) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }

  // Resto same-origin (favicons, etc) → cache-first con fallback a network
  event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || cache.match('/index.html') || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((fresh) => {
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => cached);
  return cached || fetchPromise;
}
