/** Tempered service worker — offline support with atomic version handoff. */
import { VERSION } from './src/version.js'

const CACHE = `tempered-${VERSION}`
const SHELL = new URL('./', self.location.href).href

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/style.css',
  './src/setup.css',
  './src/cadence.css',
  './src/polish.css',
  './src/battle.css',
  './src/calm.css',
  './src/uplift.css',
  './src/progress.css',
  './src/pwa/register.js',
  './src/version.js',
  './icons/icon-180.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './data/activities.json',
  './data/titles.json',
  './data/balance.json',
  './data/enemies.json',
  './data/items.json',
  './data/exercises.json',
  './data/programs.json',
  './src/app/battle.js',
  './src/app/maintenance.js',
  './src/app/bootstrap.js',
  './src/app/character.js',
  './src/app/daily.js',
  './src/app/planner.js',
  './src/app/seed.js',
  './src/app/workout.js',
  './src/adapters/clock/clock.js',
  './src/adapters/health/manual-health.js',
  './src/adapters/storage/indexeddb-storage.js',
  './src/adapters/storage/memory-storage.js',
  './src/adapters/storage/snapshot.js',
  './src/adapters/storage/stores.js',
  './src/domain/activities.js',
  './src/domain/curves.js',
  './src/domain/directive.js',
  './src/domain/battle.js',
  './src/domain/turn-battle.js',
  './src/domain/duration.js',
  './src/domain/e1rm.js',
  './src/domain/grit.js',
  './src/domain/levels.js',
  './src/domain/might.js',
  './src/domain/mind.js',
  './src/domain/migrations/index.js',
  './src/domain/plates.js',
  './src/domain/protein.js',
  './src/domain/programs.js',
  './src/domain/progression.js',
  './src/domain/rank.js',
  './src/domain/records.js',
  './src/domain/sources.js',
  './src/domain/tasks.js',
  './src/domain/tiers.js',
  './src/domain/transfer.js',
  './src/domain/titles.js',
  './src/domain/vitality.js',
  './src/domain/wind.js',
  './src/domain/xp-engine.js',
  './src/ui/app.js',
  './src/ui/battle-art.js',
  './src/ui/dom.js',
  './src/ui/format.js',
  './src/ui/icons.js',
  './src/ui/states.js',
  './src/ui/session-guard.js',
  './src/ui/session-draft.js',
  './src/ui/today-workout.js',
  './src/ui/screens/character.js',
  './src/ui/screens/battle.js',
  './src/ui/screens/history.js',
  './src/ui/screens/session.js',
  './src/ui/screens/setup.js',
  './src/ui/screens/summary.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/today.js',
  './src/ui/screens/train.js',
  './art/dist/bg-night-forest.jpg',
  './art/battle/battlefield.png',
  './art/battle/hero.png',
  './art/battle/enemies/slime.png',
  './art/battle/enemies/rat.png',
  './art/battle/enemies/mushroom.png',
  './art/battle/enemies/orc.png',
  './art/battle/enemies/wight.png',
  './art/battle/enemies/golem.png',
  './art/battle/enemies/rhino.png',
  './art/battle/enemies/wyrm.png',
  './art/battle/items/ember_token.png',
  './art/battle/items/wyrm_scale.png',
  './art/battle/items/lantern_glass.png',
  './art/battle/items/quiet_stone.png',
  './art/battle/items/moss_charm.png',
  './art/battle/items/cinder_nail.png',
  './art/battle/items/owl_feather.png',
  './art/battle/items/iron_ration.png',
  './art/battle/items/cap_spore.png',
  './art/battle/items/old_signet.png',
  './art/exercises/cable_fly.jpg',
  './art/exercises/close_grip_bench_bb.jpg',
  './art/exercises/crunch.jpg',
  './art/exercises/flat_bench_db.jpg',
  './art/exercises/front_squat.jpg',
  './art/exercises/hammer_curl_db.jpg',
  './art/exercises/incline_bench_bb.jpg',
  './art/exercises/incline_bench_db.jpg',
  './art/exercises/incline_curl_db.jpg',
  './art/exercises/lat_pulldown.jpg',
  './art/exercises/lateral_raise_db.jpg',
  './art/exercises/one_arm_row_db.jpg',
  './art/exercises/rdl.jpg',
  './art/exercises/rear_delt_fly_db.jpg',
  './art/exercises/seated_row_close.jpg',
  './art/exercises/shoulder_press_db.jpg',
  './art/exercises/tricep_push.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    const oldTemperedCaches = keys.filter((key) => key.startsWith('tempered-') && key !== CACHE)

    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()

    if (oldTemperedCaches.length > 0) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.allSettled(windows.map((client) => client.navigate(client.url)))
    }
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE)
      await cache.put(request, response.clone())
    }
    return response
  })

  if (request.mode === 'navigate') {
    event.respondWith(
      network.catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(
    network.catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  )
})
