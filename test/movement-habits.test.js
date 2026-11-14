import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { createDailyService } from '../src/app/daily.js'
import { loadBalance } from './helpers/balance.js'

test('movement habits preserve actual reps and count weekly targets on distinct days', async () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/activities.json', import.meta.url), 'utf8'))
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('profile', { id: 'profile', dailyActivityIds: ['sleep'] })
  const daily = createDailyService({ catalogue, storage, balance: loadBalance(), clock: fixedClock(new Date(2026, 10, 15, 12)) })
  const schedule = await daily.activitySchedule()
  assert.equal(schedule.pull_ups.cadence, 'daily')
  assert.deepEqual(schedule.dead_hang, { cadence: 'weekly', target: 2 })
  assert.deepEqual(schedule.dead_bug, { cadence: 'weekly', target: 2 })
  await daily.log('pull_ups', 2)
  await daily.log('pull_ups', 3)
  assert.equal((await daily.today()).day.pullUpReps, 5)
  await daily.log('dead_hang', 45)
  await daily.log('dead_hang', 35)
  assert.equal((await daily.today()).day.deadHangSeconds, 45)
  const weekly = async (id) => (await daily.week()).activities.find((row) => row.id === id)
  assert.equal((await weekly('dead_hang')).weeklyDone, 0)
  await daily.log('dead_hang', 60)
  await daily.log('dead_hang', 50)
  assert.equal((await daily.today()).day.deadHangSeconds, 60)
  assert.equal((await weekly('dead_hang')).weeklyDone, 1)
  await daily.logAt('2026-11-14', 'dead_hang', 60)
  assert.equal((await weekly('dead_hang')).complete, true)
  await daily.log('dead_bug', 5)
  assert.equal((await weekly('dead_bug')).weeklyDone, 1)
  assert.deepEqual(await storage.getAll('sessions'), [])
})
