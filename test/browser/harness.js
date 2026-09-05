/**
 * Shared browser-harness bootstrap.
 *
 * Phase 7 made a genuinely new profile enter setup before the app shell exists.
 * Acceptance harnesses are not onboarding tests, so they must deliberately mark
 * their fresh profile as configured before booting the real app. Keeping that
 * rule here avoids thirteen slightly-different setup workarounds.
 */

import { bootstrap as bootstrapApp } from '../../src/app/bootstrap.js'
import { createIndexedDbStorage } from '../../src/adapters/storage/indexeddb-storage.js'
import { createMemoryStorage } from '../../src/adapters/storage/memory-storage.js'
import { systemClock } from '../../src/adapters/clock/clock.js'
import { ensureProfile } from '../../src/app/seed.js'

/**
 * Mark the harness profile as configured without inventing any other settings.
 * Existing fixtures are preserved; only setupComplete is changed when needed.
 */
export async function bypassSetup({ storage, clock } = {}) {
  const actualClock = clock ?? systemClock()
  const actualStorage = storage
    ?? (globalThis.indexedDB ? createIndexedDbStorage() : createMemoryStorage())

  await actualStorage.open()
  const profile = await actualStorage.get('profile', 'profile')
  if (!profile) {
    await ensureProfile(actualStorage, actualClock, { setupComplete: true })
  } else if (profile.setupComplete === false) {
    await actualStorage.put('profile', { ...profile, setupComplete: true })
  }

  return { storage: actualStorage, clock: actualClock }
}

/**
 * Boot the shipped app after applying the setup prerequisite above. Older
 * acceptance harnesses were authored when Train was the initial surface, so a
 * stable Train start keeps their first selector about the feature under test,
 * not about whichever tab the product currently opens by default. Harnesses
 * that test another screen immediately call app.show(...) themselves.
 */
export async function bootstrapHarness(options = {}) {
  const prepared = await bypassSetup(options)
  const tempered = await bootstrapApp({ ...options, ...prepared })
  await tempered.app.show(options.initialTab ?? 'train')
  return tempered
}
