import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createDailyService } from '../src/app/daily.js'
import { ensureProfile } from '../src/app/seed.js'
import { hasDailyGoal, dailyGoalComplete } from '../src/ui/screens/today.js'
import { loadBalance } from './helpers/balance.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const catalogue = JSON.parse(read('data/activities.json'))
const balance = loadBalance()

async function harness() {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-05T12:00:00.000Z')
  await ensureProfile(storage, clock)
  const daily = createDailyService({ storage, clock, balance, catalogue })
  return { storage, daily }
}

test('REGRESSION: a partial daily goal is progress, not completion', () => {
  const water = { id: 'water', dailyCap: 120, value: 8, logged: true }
  assert.equal(hasDailyGoal(water), true)
  assert.equal(dailyGoalComplete(water), false)
  assert.equal(dailyGoalComplete({ ...water, value: 119 }), false)
  assert.equal(dailyGoalComplete({ ...water, value: 120 }), true)
  assert.equal(dailyGoalComplete({ id: 'journal', logged: true }), true)
})

test('REGRESSION: water accumulates across separate drinks and only finishes at the cap', async () => {
  const { daily } = await harness()
  await daily.setCadence('water', 'daily')

  await daily.log('water', 8)
  let water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 8)
  assert.equal(dailyGoalComplete(water), false)

  await daily.log('water', 10)
  water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 18, 'the second drink adds to the first rather than replacing it')
  assert.equal(dailyGoalComplete(water), false)

  await daily.log('water', 102)
  water = (await daily.today()).logged.find((activity) => activity.id === 'water')
  assert.equal(water.value, 120)
  assert.equal(dailyGoalComplete(water), true)
})

test('REGRESSION: Today no longer overrides additive entries into set mode', () => {
  const today = read('src/ui/screens/today.js')
  assert.doesNotMatch(today, /entryMode/)
  assert.doesNotMatch(today, /mode:\s*['"]set['"]/)
  assert.match(today, /dailyGoalComplete/)
  assert.match(today, /dailyGoalLabel/)
  assert.match(today, /icon\(goal \? 'plus' : 'check'\)/)
})

test('REGRESSION: cancel exercise uses Tempered UI, not a browser confirm', () => {
  const guard = read('src/ui/session-guard.js')
  const index = read('index.html')
  assert.doesNotMatch(guard, /window\.confirm|globalThis\.confirm/)
  assert.match(guard, /confirmDiscardExercise/)
  assert.match(guard, /aria-modal/)
  assert.match(guard, /DISCARD EXERCISE\?/)
  assert.match(index, /\.confirm-overlay/)
  assert.match(index, /\.confirm-sheet/)
})

test('REGRESSION: every screen gets extra top breathing room', () => {
  const index = read('index.html')
  assert.match(index, /\.app__body\s*\{[\s\S]*padding-top:\s*calc\(max\(var\(--s4\), env\(safe-area-inset-top\)\) \+ var\(--s5\)\)/)
})

test('REGRESSION: Character no longer carries a duplicate Settings button', () => {
  const character = read('src/ui/screens/character.js')
  assert.doesNotMatch(character, /\['SETTINGS'\]/)
  assert.doesNotMatch(character, /dataset:\s*\{\s*tab:\s*'settings'/)
})
