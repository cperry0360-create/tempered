import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createWeeklyRecapService } from './weekly-recap.js'

test('acknowledgment persists across service instances and preserves profile preferences', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-10-12T12:00:00Z')
  await storage.put('profile', { id: 'profile', createdAt: '2026-09-01T12:00:00Z', appearance: 'dark' })
  const service = createWeeklyRecapService({ storage, clock })
  assert.equal((await service.report()).eligible, true)
  await service.acknowledge('2026-10-05')
  assert.equal((await createWeeklyRecapService({ storage, clock }).report()).eligible, false)
  await service.acknowledge('2026-09-28')
  assert.deepEqual(await storage.get('profile', 'profile'), { id: 'profile', createdAt: '2026-09-01T12:00:00Z', appearance: 'dark', weeklyRecapLastSeenWeek: '2026-10-05' })
  clock.advanceDays(7)
  assert.equal((await service.report()).eligible, true)
})

test('weight is a neutral read-only summary and never changes the score or logs', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const service = createWeeklyRecapService({ storage, clock: fixedClock('2026-10-12T12:00:00Z') })
  const before = (await service.report()).score
  await storage.put('dayLogs', { date: '2026-10-05', bodyMetrics: { weight: 165 } })
  await storage.put('dayLogs', { date: '2026-10-11', bodyMetrics: { weight: 166 } })
  await storage.put('dayLogs', { date: '2026-10-12', bodyMetrics: { weight: 150 } })
  const report = await service.report()
  assert.equal(report.weight.change, 1)
  assert.equal(report.weight.days, 2)
  assert.deepEqual(report.score, before)
  assert.equal((await storage.getAll('dayLogs')).length, 3)
  assert.equal((await storage.getAll('setLogs')).length, 0)
})
