import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createDailyService } from './daily.js'
import { ensureProfile } from './seed.js'

const balance = loadBalance()
const catalogue = JSON.parse(readFileSync(new URL('../../data/activities.json', import.meta.url), 'utf8'))

async function fresh() {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-05T09:00:00.000Z')
  await ensureProfile(storage, clock)
  return { storage, daily: createDailyService({ storage, clock, balance, catalogue }) }
}

const row = (today) => [...today.outstanding, ...today.logged].find((item) => item.id === 'calories_logged')

test('calories are numeric, additive, and use a configurable target without scoring the number', async () => {
  const { daily } = await fresh()
  await daily.setCalorieTarget(2200)
  assert.equal(row(await daily.today()).dailyCap, 2200)

  let result = await daily.log('calories_logged', 500)
  assert.equal(result.day.calories, 500)
  assert.equal(result.day.caloriesLogged, true)
  const firstXp = result.xpBySource['vitality.calories']
  assert.ok(firstXp > 0)

  result = await daily.log('calories_logged', 700)
  assert.equal(result.day.calories, 1200)
  assert.equal(result.xpBySource['vitality.calories'] ?? 0, 0, 'more calories do not mint more tracking XP')

  result = await daily.log('calories_logged', 1800, { mode: 'replace' })
  assert.equal(result.day.calories, 1800, 'manual correction can set the running total')
})
