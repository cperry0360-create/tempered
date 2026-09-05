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

async function fresh(at = '2026-09-07T09:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await ensureProfile(storage, clock)
  return {
    storage,
    clock,
    daily: createDailyService({ storage, clock, balance, catalogue }),
  }
}

test('cadence supports off, daily, and a weekly target', async () => {
  const { daily } = await fresh()
  await daily.setCadence('steps', 'daily')
  await daily.setCadence('sauna', 'weekly', 3)
  await daily.setCadence('water', 'off')

  const schedule = await daily.activitySchedule()
  assert.deepEqual(schedule.steps, { cadence: 'daily', target: 1 })
  assert.deepEqual(schedule.sauna, { cadence: 'weekly', target: 3 })
  assert.deepEqual(schedule.water, { cadence: 'off', target: 1 })
})

test('weekly frequency counts days, not repeated taps on one day', async () => {
  const { daily, clock } = await fresh()
  await daily.setCadence('sauna', 'weekly', 3)

  await daily.log('sauna')
  await daily.log('sauna')
  let week = await daily.week()
  assert.equal(week.activities.find((a) => a.id === 'sauna').weeklyDone, 1)

  clock.advanceDays(1)
  await daily.log('sauna')
  week = await daily.week()
  assert.equal(week.activities.find((a) => a.id === 'sauna').weeklyDone, 2)
  assert.equal(week.activities.find((a) => a.id === 'sauna').complete, false)

  clock.advanceDays(1)
  await daily.log('sauna')
  week = await daily.week()
  assert.equal(week.activities.find((a) => a.id === 'sauna').weeklyDone, 3)
  assert.equal(week.activities.find((a) => a.id === 'sauna').complete, true)
})

test('daily ids are a backwards-compatible mirror of the cadence schedule', async () => {
  const { daily, storage } = await fresh()
  await daily.setCadence('sleep', 'daily')
  await daily.setCadence('steps', 'weekly', 5)

  const profile = await storage.get('profile', 'profile')
  assert.ok(profile.dailyActivityIds.includes('sleep'))
  assert.equal(profile.dailyActivityIds.includes('steps'), false)
  assert.deepEqual(profile.activitySchedule.steps, { cadence: 'weekly', target: 5 })
})

test('restored lifestyle trackers are available and score only when logged', async () => {
  const { daily } = await fresh()
  for (const id of ['calories_logged', 'alcohol_free', 'sauna']) {
    assert.ok(daily.activities.some((a) => a.id === id), `${id} is missing from the catalogue`)
  }

  const calories = await daily.log('calories_logged')
  assert.equal(calories.xpByAttribute.vitality, balance.vitality.caloriesLoggedXp)
  const alcohol = await daily.log('alcohol_free')
  assert.equal(alcohol.xpByAttribute.vitality, balance.vitality.alcoholFreeXp)
  const sauna = await daily.log('sauna')
  assert.equal(sauna.xpByAttribute.vitality, balance.vitality.saunaXp)
})
