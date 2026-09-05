/**
 * Wiring. The only place that knows which implementation of each adapter the
 * real app uses — everything else takes them as arguments.
 */

import { createIndexedDbStorage } from '../adapters/storage/indexeddb-storage.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { systemClock } from '../adapters/clock/clock.js'
import { createManualHealth } from '../adapters/health/manual-health.js'
import { createWorkoutService } from './workout.js'
import { createDailyService } from './daily.js'
import { createCharacterService } from './character.js'
import { createBattleService } from './battle.js'
import { createMaintenanceService } from './maintenance.js'
import { seedLibrary, ensureProfile, seedPrograms } from './seed.js'
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

  const [balance, library, catalogue, activities, titles, enemies, itemRoster] = await Promise.all([
    loadJson('data/balance.json', base),
    loadJson('data/exercises.json', base),
    loadJson('data/programs.json', base),
    loadJson('data/activities.json', base),
    loadJson('data/titles.json', base),
    loadJson('data/enemies.json', base),
    loadJson('data/items.json', base),
  ])

  await seedLibrary(storage, library)
  await seedPrograms(storage, catalogue, clock)
  await ensureProfile(storage, clock)

  const workout = createWorkoutService({ storage, clock, balance })
  const health = createManualHealth(storage)
  const daily = createDailyService({ storage, clock, health, balance, catalogue: activities })
  const character = createCharacterService({ storage, clock, balance, catalogue: titles })
  const battle = createBattleService({
    storage, clock, balance, roster: enemies.enemies, items: itemRoster.items,
  })
  const maintenance = createMaintenanceService({ storage, clock })
  const app = createApp({ mount, workout, daily, character, battle, maintenance, storage, clock })
  await app.show('train')

  // Exposed for the browser test harnesses, which drive the real app rather
  // than a copy of it. Harmless in production and useful in the console.
  globalThis.tempered = {
    storage, clock, workout, daily, character, battle, maintenance, health,
    balance, library, catalogue, activities, titles, enemies, itemRoster, app,
  }
  return globalThis.tempered
}
