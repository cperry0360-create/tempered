import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { ensureProfile } from './seed.js'

test('schema 1 profiles migrate body metrics to daily exactly once', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-05T09:00:00.000Z')
  await storage.put('profile', {
    id: 'profile',
    schemaVersion: 1,
    dailyActivityIds: ['sleep', 'steps'],
    activitySchedule: {
      sleep: { cadence: 'daily', target: 1 },
      body_metrics: { cadence: 'off', target: 1 },
    },
  })

  const migrated = await ensureProfile(storage, clock)
  assert.equal(migrated.schemaVersion, 2)
  assert.deepEqual(migrated.activitySchedule.body_metrics, { cadence: 'daily', target: 1 })
  assert.ok(migrated.dailyActivityIds.includes('body_metrics'))

  const userChanged = {
    ...migrated,
    activitySchedule: { ...migrated.activitySchedule, body_metrics: { cadence: 'off', target: 1 } },
    dailyActivityIds: migrated.dailyActivityIds.filter((id) => id !== 'body_metrics'),
  }
  await storage.put('profile', userChanged)
  const again = await ensureProfile(storage, clock)
  assert.deepEqual(again.activitySchedule.body_metrics, { cadence: 'off', target: 1 },
    'schema 2 must respect a later user choice')
})
