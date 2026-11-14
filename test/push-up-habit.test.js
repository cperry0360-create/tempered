import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixedClock } from '../src/adapters/clock/clock.js'
import { createMemoryStorage } from '../src/adapters/storage/memory-storage.js'
import { createDailyService } from '../src/app/daily.js'
import { dailyHabitProgress } from '../src/ui/screens/today.js'
import { defaultSchedule } from '../src/ui/screens/setup.js'
import { loadBalance } from './helpers/balance.js'

const catalogue = JSON.parse(readFileSync(new URL('../data/activities.json', import.meta.url), 'utf8'))
const clock = fixedClock(new Date(2026, 10, 15, 12))
const buildDaily = (storage) => createDailyService({ storage, clock, balance: loadBalance(), catalogue })
const activitiesOn = (day) => [...day.outstanding, ...day.logged]
const pushUpsOn = (day) => activitiesOn(day).filter((activity) => activity.id === 'push_ups')

test('push-ups start as a daily goal for existing profiles and complete at 30 reps', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const profile = { id: 'profile', setupComplete: true, dailyActivityIds: ['steps'] }
  await storage.put('profile', profile)
  await storage.put('dayLogs', { date: '2026-11-15', steps: 7000 })
  const daily = buildDaily(storage)

  assert.equal(defaultSchedule(catalogue.activities, profile).push_ups.cadence, 'daily')
  assert.equal(pushUpsOn(await daily.today())[0].cadence, 'daily')
  assert.deepEqual(dailyHabitProgress(pushUpsOn(await daily.today())), { done: 0, total: 1 })
  assert.deepEqual(dailyHabitProgress(pushUpsOn(await daily.forDate('2026-11-13'))), { done: 0, total: 0 })
  await daily.log('push_ups', 15)
  assert.equal(pushUpsOn(await daily.today())[0].value, 15)
  assert.deepEqual(dailyHabitProgress(pushUpsOn(await daily.today())), { done: 0, total: 1 })
  await daily.log('push_ups', 15)

  const reloaded = buildDaily(storage)
  assert.deepEqual(dailyHabitProgress(pushUpsOn(await reloaded.today())), { done: 1, total: 1 })
  assert.deepEqual(await reloaded.dayLog('2026-11-15'), { date: '2026-11-15', pushUpReps: 30, steps: 7000 })
  assert.equal(pushUpsOn(await reloaded.forDate('2026-11-14'))[0].value, null)
  assert.deepEqual(await storage.getAll('sessions'), [])
  assert.deepEqual(await storage.get('profile', 'profile'), profile)

  await reloaded.setCadence('push_ups', 'weekly', 2)
  await reloaded.logAt('2026-11-14', 'push_ups', 15)
  assert.equal((await reloaded.week()).activities.find((activity) => activity.id === 'push_ups').weeklyDone, 1)
  await reloaded.setCadence('push_ups', 'off')
  assert.equal(pushUpsOn(await reloaded.today())[0].cadence, 'off')
})

test('concurrent rep additions preserve both sets and invalid entries write nothing', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const daily = buildDaily(storage)
  await Promise.all([daily.log('push_ups', 15), daily.log('push_ups', 20)])
  assert.equal((await daily.today()).day.pushUpReps, 35)
  await daily.logAt('2026-11-14', 'push_ups', '2.5')
  await daily.logAt('2026-11-16', 'push_ups', 30)
  assert.deepEqual(await storage.getAll('dayLogs'), [{ date: '2026-11-15', pushUpReps: 35 }])
})
