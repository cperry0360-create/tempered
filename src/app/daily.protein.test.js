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
  const daily = createDailyService({ storage, clock, balance, catalogue })
  return { storage, clock, daily }
}

function proteinRow(today) {
  return [...today.outstanding, ...today.logged].find((row) => row.id === 'protein_target')
}

test('protein goal derives from the latest body weight and pays only at the finish line', async () => {
  const { storage, daily } = await fresh()
  await daily.log('body_metrics', 164)

  let protein = proteinRow(await daily.today())
  assert.equal(protein.dailyCap, 132, '164 lb × 0.8 rounds up to a 132 g goal')

  let result = await daily.log('protein_target', 131)
  assert.equal(result.day.proteinGrams, 131)
  assert.equal(result.day.proteinTargetMet, false)
  assert.equal(result.xpBySource['vitality.protein'] ?? 0, 0)

  result = await daily.log('protein_target', 132)
  assert.equal(result.day.proteinTargetMet, true)
  assert.equal(result.xpBySource['vitality.protein'], balance.vitality.proteinTargetBonus)

  const stored = await storage.get('dayLogs', '2026-09-05')
  assert.equal(stored.proteinGoalGrams, 132)
})

test('protein goal carries the latest recorded body weight into the next day', async () => {
  const { clock, daily } = await fresh()
  await daily.log('body_metrics', 164)
  clock.advanceDays(1)
  assert.equal(proteinRow(await daily.today()).dailyCap, 132)
})

test('metric body weights convert to pounds before the 0.8 g/lb rule', async () => {
  const { storage, daily } = await fresh()
  const profile = await storage.get('profile', 'profile')
  await storage.put('profile', { ...profile, units: 'metric' })
  await daily.log('body_metrics', 75)
  assert.equal(proteinRow(await daily.today()).dailyCap, 133)
})
