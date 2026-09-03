/**
 * Tempered service worker — offline support for the installed app.
 *
 * There is no build step, so filenames are stable and the precache list below is
 * written by hand. Keep it in step with the shell.
 *
 * Caching strategy:
 *   - navigations           network first, cached shell when offline
 *   - everything same-origin stale-while-revalidate
 *
 * Stale-while-revalidate is deliberate. Without content-hashed filenames, a
 * cache-first worker would pin users to old code until VERSION was bumped, and
 * forgetting that bump is the obvious failure. Serving from cache while fetching
 * in the background means a missed bump costs one stale load, not a stuck app.
 * Bumping VERSION still forces an immediate clean sweep of every old cache.
 */

const VERSION = '0.1.0'
const CACHE = `tempered-${VERSION}`

// Resolved against this file's own URL, so the app works at any base path —
// a project page under /tempered/, a custom domain at /, or localhost.
const SHELL = new URL('./', self.location.href).href

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/style.css',
  './src/pwa/register.js',
  './icons/icon-180.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  // Started synchronously so waitUntil can be registered while the event is
  // still active; that keeps the worker alive long enough to finish writing
  // the revalidated response to the cache.
  const network = fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  })
  event.waitUntil(network.catch(() => undefined))

  if (request.mode === 'navigate') {
    event.respondWith(
      network.catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? network.catch(() => Response.error())),
  )
})
