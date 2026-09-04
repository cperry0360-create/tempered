/**
 * Tempered service worker — offline support for the installed app.
 *
 * A MODULE worker, so the cache key can be derived from src/version.js rather
 * than duplicated here and left to drift.
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

// Single source of truth: bumping src/version.js sweeps every old cache. This
// worker is registered with { type: 'module' } so it can import it — see
// src/pwa/register.js, which falls back to running without offline support if a
// browser cannot load a module worker.
import { VERSION } from './src/version.js'

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
  './src/version.js',
  './icons/icon-180.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',

  // The app itself. Hand-maintained, because there is no build step to derive
  // it from — if you add a module, add it here or the app breaks offline.
  './data/balance.json',
  './data/exercises.json',
  './data/programs.json',
  './src/app/bootstrap.js',
  './src/app/seed.js',
  './src/app/workout.js',
  './src/adapters/clock/clock.js',
  './src/adapters/storage/indexeddb-storage.js',
  './src/adapters/storage/memory-storage.js',
  './src/adapters/storage/stores.js',
  './src/domain/curves.js',
  './src/domain/directive.js',
  './src/domain/e1rm.js',
  './src/domain/grit.js',
  './src/domain/levels.js',
  './src/domain/might.js',
  './src/domain/mind.js',
  './src/domain/plates.js',
  './src/domain/programs.js',
  './src/domain/progression.js',
  './src/domain/rank.js',
  './src/domain/records.js',
  './src/domain/tasks.js',
  './src/domain/tiers.js',
  './src/domain/vitality.js',
  './src/domain/wind.js',
  './src/domain/xp-engine.js',
  './src/ui/app.js',
  './src/ui/dom.js',
  './src/ui/format.js',
  './src/ui/icons.js',
  './src/ui/screens/history.js',
  './src/ui/screens/session.js',
  './src/ui/screens/summary.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/today.js',
  './src/ui/screens/train.js',
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
