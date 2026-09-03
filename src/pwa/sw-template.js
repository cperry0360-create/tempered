// Service worker source. Edit this file — never dist/sw.js, which is generated
// from it at build time by the tempered-service-worker plugin in vite.config.ts.
// That plugin fills in the three build-time constants below with the real build
// output, because Vite content-hashes asset filenames.
//
// Keep the placeholder tokens out of comments: they are substituted everywhere
// they appear, and a multi-line JSON array spliced into a // comment does not
// stay commented out.

const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
const SHELL = '__SHELL__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations go to the network first so a new build is picked up promptly,
  // and fall back to the precached shell when there is no network at all.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Everything else is content-hashed, so a cache hit can never be stale.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
