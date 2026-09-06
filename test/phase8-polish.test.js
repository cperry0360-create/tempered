import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createDailyService } from '../src/app/daily.js'
import { ensureProfile } from '../src/app/seed.js'
import { loadBalance } from './helpers/balance.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('src/polish.css')
const app = read('src/ui/app.js')
const states = read('src/ui/states.js')
const index = read('index.html')
const sw = read('sw.js')
const history = read('src/ui/screens/history.js')
const main = read('src/main.js')
const catalogue = JSON.parse(read('data/activities.json'))
const balance = loadBalance()

async function dailyHarness(at = '2026-09-07T12:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await ensureProfile(storage, clock)
  const daily = createDailyService({ storage, clock, balance, catalogue })
  return { storage, clock, daily }
}

test('PHASE 8: type scale respects user text sizing instead of pinning pixels', () => {
  for (const token of ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    assert.match(css, new RegExp(`--text-${token}:\\s*[0-9.]+rem`))
  }
  assert.match(css, /-webkit-text-size-adjust:\s*100%/)
})

test('PHASE 8: keyboard focus is high contrast and cannot disappear into the art', () => {
  assert.match(css, /:focus-visible\s*\{/)
  assert.match(css, /outline:\s*3px solid var\(--acid\)/)
  assert.match(css, /outline-offset:\s*3px/)
})

test('PHASE 8: formerly-small controls have 44px touch targets', () => {
  assert.match(css, /\.quick__add,[\s\S]*\.iconbutton,[\s\S]*\.worked__toggle[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/)
})

test('PHASE 8: iOS text entry cannot trigger the sub-16px auto zoom', () => {
  assert.match(css, /input, select, textarea\)\s*\{\s*font-size:\s*max\(1rem,/)
})

test('PHASE 8: motion has an explicit reduced-motion escape hatch', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.screen \{ animation: none !important; \}/)
  assert.match(css, /html \{ scroll-behavior: auto; \}/)
})

test('PHASE 8: contrast, forced-colour and reduced-transparency OS modes are handled', () => {
  assert.match(css, /@media \(prefers-contrast: more\)/)
  assert.match(css, /@media \(forced-colors: active\)/)
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/)
})

test('PHASE 8: empty and error states carry assistive semantics and recovery actions', () => {
  assert.match(states, /role: 'status'/)
  assert.match(states, /role: 'alert'/)
  assert.match(states, /'aria-live': 'assertive'/)
  assert.match(states, /data.*action: 'retry'/s)
  assert.match(states, /data.*action: 'back'/s)
})

test('PHASE 8: screen changes have a polite live region', () => {
  assert.match(states, /'aria-live': 'polite'/)
  assert.match(app, /const announcer = liveRegion\(\)/)
  assert.match(app, /announce\(`\$\{tabLabel\(target\).*screen`\)/s)
})

test('PHASE 8: asynchronous screen, workout and battle failures are recoverable', () => {
  assert.match(app, /failed to load/)
  assert.match(app, /session failed to start/)
  assert.match(app, /battle failed to start/)
  assert.match(app, /onRetry:/)
  assert.match(app, /onBack:/)
  assert.match(app, /aria-busy/)
})

test('PHASE 8: a startup failure is a real recovery surface, not dead text', () => {
  assert.match(main, /errorState\(/)
  assert.match(main, /window\.location\.reload\(\)/)
  assert.doesNotMatch(main, /app\.textContent = 'Tempered could not start/)
})

test('PHASE 8: Progress has meaningful empty states and pressed-state semantics', () => {
  assert.match(history, /No training in this range/)
  assert.match(history, /No lifting progress yet/)
  assert.match(history, /'aria-pressed': String\(view === name\)/)
})

test('PHASE 8: utility uplift loads after core polish and browser chrome matches the brighter forest palette', () => {
  const style = index.indexOf('./src/style.css')
  const setup = index.indexOf('./src/setup.css')
  const cadence = index.indexOf('./src/cadence.css')
  const polish = index.indexOf('./src/polish.css')
  const calm = index.indexOf('./src/calm.css')
  const uplift = index.indexOf('./src/uplift.css')
  const progress = index.indexOf('./src/progress.css')
  const battleFidelity = index.indexOf('./src/battle-fidelity.css')
  assert.ok(style < setup && setup < cadence && cadence < polish)
  assert.ok(polish < calm && calm < uplift && uplift < progress && progress < battleFidelity)
  assert.match(index, /name="theme-color" content="#16495f"/)
})

test('PHASE 8: new runtime files are available offline', () => {
  for (const path of [
    './src/polish.css', './src/ui/states.js', './src/uplift.css', './src/progress.css', './src/app/planner.js',
  ]) assert.ok(sw.includes(`'${path}'`), `${path} not precached`)
})

test('PHASE 8: polish adds no CDN or remote runtime dependency', () => {
  const runtime = `${index}\n${css}\n${states}\n${app}`
  assert.doesNotMatch(runtime, /https?:\/\//)
  assert.doesNotMatch(runtime, /fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg|jsdelivr/i)
})

test('STRESS: cadence target inputs are clamped across every activity', async () => {
  const { daily } = await dailyHarness()
  for (const activity of catalogue.activities) {
    await daily.setCadence(activity.id, 'weekly', -100)
    assert.equal((await daily.activitySchedule())[activity.id].target, 1)
    await daily.setCadence(activity.id, 'weekly', 999)
    assert.equal((await daily.activitySchedule())[activity.id].target, 7)
    await daily.setCadence(activity.id, 'off')
    assert.equal((await daily.activitySchedule())[activity.id].cadence, 'off')
  }
})

test('STRESS: eight calendar weeks reset cleanly and a 3x target counts days, never taps', async () => {
  const { daily, clock } = await dailyHarness('2026-09-07T12:00:00.000Z') // Monday
  await daily.setCadence('sauna', 'weekly', 3)

  for (let week = 0; week < 8; week += 1) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      if ([0, 2, 4].includes(dayIndex)) {
        await daily.log('sauna')
        await daily.log('sauna') // repeated tap must still be one day
      }
      const row = (await daily.week()).activities.find((activity) => activity.id === 'sauna')
      const expected = [0, 2, 4].filter((d) => d <= dayIndex).length
      assert.equal(row.weeklyDone, expected, `week ${week + 1}, day ${dayIndex + 1}`)
      assert.equal(row.complete, expected >= 3)
      clock.advanceDays(1)
    }
  }
})

test('STRESS: 180 days of mixed logging never decreases any attribute XP', async () => {
  const { daily, clock, storage } = await dailyHarness('2026-01-05T12:00:00.000Z')
  await daily.setCadence('sleep', 'daily')
  await daily.setCadence('steps', 'daily')
  await daily.setCadence('read', 'weekly', 5)
  await daily.setCadence('sauna', 'weekly', 3)

  let previous = Object.fromEntries(['might', 'wind', 'grit', 'vitality', 'mind'].map((id) => [id, 0]))
  for (let dayIndex = 0; dayIndex < 180; dayIndex += 1) {
    await daily.log('sleep', 7 + (dayIndex % 3) * 0.5)
    await daily.log('steps', 5000 + (dayIndex % 8) * 1000)
    if (dayIndex % 2 === 0) await daily.log('read', 20)
    if (dayIndex % 3 === 0) await daily.log('sauna')
    if (dayIndex % 5 === 0) await daily.log('journal')

    for (const id of Object.keys(previous)) {
      const current = (await storage.get('attributeState', id))?.xp ?? 0
      assert.ok(current >= previous[id], `${id} XP fell on day ${dayIndex + 1}`)
      previous[id] = current
    }
    clock.advanceDays(1)
  }
})
