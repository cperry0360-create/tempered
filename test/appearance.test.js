import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { ensureProfile } from '../src/app/seed.js'
import { createAppearanceService } from '../src/app/appearance.js'

function fakePlatform(initiallyDark = false) {
  const listeners = new Set()
  const media = {
    matches: initiallyDark,
    addEventListener(_type, listener) { listeners.add(listener) },
    removeEventListener(_type, listener) { listeners.delete(listener) },
    change(matches) {
      this.matches = matches
      for (const listener of listeners) listener({ matches })
    },
  }
  const root = { dataset: {} }
  const themeColor = { content: '' }
  return {
    media,
    root,
    themeColor,
    windowRef: { matchMedia: () => media },
    documentRef: {
      documentElement: root,
      querySelector: (selector) => selector === 'meta[name="theme-color"]' ? themeColor : null,
    },
  }
}

test('Appearance defaults to System, persists across app restart, and tracks system changes', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  await ensureProfile(storage, fixedClock('2026-09-30T12:00:00.000Z'), { setupComplete: true })
  const platform = fakePlatform(false)

  const firstLaunch = createAppearanceService({ storage, ...platform })
  assert.equal(await firstLaunch.initialize(), 'system')
  assert.equal(platform.root.dataset.theme, 'light')
  assert.equal(platform.themeColor.content, '#F3F5F8')

  await firstLaunch.setPreference('dark')
  assert.equal((await storage.get('profile', 'profile')).appearance, 'dark')
  assert.equal(platform.root.dataset.theme, 'dark')
  firstLaunch.dispose()

  const nextLaunch = createAppearanceService({ storage, ...platform })
  assert.equal(await nextLaunch.initialize(), 'dark')
  assert.equal(platform.root.dataset.theme, 'dark')
  assert.equal(platform.themeColor.content, '#1B222C')

  await nextLaunch.setPreference('system')
  platform.media.change(true)
  assert.equal(platform.root.dataset.theme, 'dark')
  platform.media.change(false)
  assert.equal(platform.root.dataset.theme, 'light')
  assert.equal(platform.themeColor.content, '#F3F5F8')
  nextLaunch.dispose()
})
