/**
 * Wiring. The only place that knows which implementation of each adapter the
 * real app uses — everything else takes them as arguments.
 */

import { createIndexedDbStorage } from '../adapters/storage/indexeddb-storage.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { systemClock } from '../adapters/clock/clock.js'
import { createWorkoutService } from './workout.js'
import { seedLibrary, ensureProfile } from './seed.js'
import { createApp } from '../ui/app.js'

/** Relative, so the app runs at the repo root or under /tempered/ alike. */
async function loadJson(path, base) {
  const response = await fetch(new URL(path, base))
  if (!response.ok) throw new Error(`Could not load ${path}`)
  return response.json()
}

/**
 * @param {object} [options]
 * @param {HTMLElement} [options.mount]
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} [options.storage]
 * @param {import('../adapters/clock/clock.js').Clock} [options.clock]
 */
export async function bootstrap(options = {}) {
  const base = new URL('../../', import.meta.url)
  const mount = options.mount ?? document.getElementById('app')
  const clock = options.clock ?? systemClock()

  const storage = options.storage
    ?? (globalThis.indexedDB ? createIndexedDbStorage() : createMemoryStorage())
  await storage.open()

  const [balance, library] = await Promise.all([
    loadJson('data/balance.json', base),
    loadJson('data/exercises.json', base),
  ])

  await seedLibrary(storage, library)
  await ensureProfile(storage, clock)

  const workout = createWorkoutService({ storage, clock, balance })
  const app = createApp({ mount, workout, storage, clock })
  await app.show('train')

  // Exposed for the browser test harnesses, which drive the real app rather
  // than a copy of it. Harmless in production and useful in the console.
  globalThis.tempered = { storage, clock, workout, balance, library, app }
  return globalThis.tempered
}
