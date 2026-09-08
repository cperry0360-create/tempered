import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createDailyService } from './daily.js'
import { createHealthSyncService } from './health-sync.js'
import { ensureProfile } from './seed.js'

const balance = loadBalance()
const catalogue = JSON.parse(readFileSync(new URL('../../data/activities.json', import.meta.url), 'utf8'))

async function fixture(sample) {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-08T11:00:00.000Z')
  await ensureProfile(storage, clock)
  let authorizations = 0
  let reads = 0
  const health = {
    kind: 'apple-health',
    async isAvailable() { return true },
    async requestAuthorization() { authorizations += 1; return { authorized: true } },
    async read(date) { reads += 1; return { date, waterOz: null, source: 'device', ...sample } },
    async write() { throw new Error('read-only') },
  }
  const daily = createDailyService({ storage, clock, health, balance, catalogue })
  const sync = createHealthSyncService({ storage, health, daily, clock })
  return { storage, clock, daily, sync, counts: () => ({ authorizations, reads }) }
}

test('Apple Health imports steps and partial-hour sleep into the canonical day log', async () => {
  const { storage, daily, sync } = await fixture({ steps: 12345, sleepHours: 7.75 })
  const result = await sync.syncToday()
  assert.equal(result.ok, true)

  const day = await storage.get('dayLogs', '2026-09-08')
  assert.equal(day.steps, 12345)
  assert.equal(day.sleepHours, 7.75)
  assert.equal(day.healthSources.steps, 'apple-health')
  assert.equal(day.healthSources.sleep, 'apple-health')
  assert.ok(day.healthSyncedAt)

  const today = await daily.today()
  assert.equal(today.logged.find((row) => row.id === 'steps').value, 12345)
  assert.equal(today.logged.find((row) => row.id === 'sleep').value, 7.75)
})

test('re-syncing the same HealthKit values never awards XP twice', async () => {
  const { storage, sync, counts } = await fixture({ steps: 10000, sleepHours: 8 })
  await sync.syncToday()
  const wind = (await storage.get('attributeState', 'wind'))?.xp ?? 0
  const vitality = (await storage.get('attributeState', 'vitality'))?.xp ?? 0

  await sync.syncToday()
  assert.equal((await storage.get('attributeState', 'wind'))?.xp ?? 0, wind)
  assert.equal((await storage.get('attributeState', 'vitality'))?.xp ?? 0, vitality)
  assert.deepEqual(counts(), { authorizations: 1, reads: 2 }, 'authorization is requested once per app session')
})

test('later step samples pay only the newly earned amount', async () => {
  let steps = 3000
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-08T11:00:00.000Z')
  await ensureProfile(storage, clock)
  const health = {
    kind: 'apple-health',
    async isAvailable() { return true },
    async requestAuthorization() {},
    async read(date) { return { date, steps, sleepHours: null, waterOz: null, source: 'device' } },
    async write() {},
  }
  const daily = createDailyService({ storage, clock, health, balance, catalogue })
  const sync = createHealthSyncService({ storage, health, daily, clock })

  await sync.syncToday()
  const first = (await storage.get('attributeState', 'wind'))?.xp ?? 0
  steps = 9000
  await sync.syncToday()
  const second = (await storage.get('attributeState', 'wind'))?.xp ?? 0

  assert.ok(second > first)
  assert.equal((await storage.get('dayLogs', '2026-09-08')).steps, 9000)
})

test('missing HealthKit types leave existing manual values intact', async () => {
  const { storage, daily, sync } = await fixture({ steps: null, sleepHours: null })
  await daily.log('sleep', 7.5)
  await daily.log('steps', 5000)
  await sync.syncToday()
  const day = await storage.get('dayLogs', '2026-09-08')
  assert.equal(day.sleepHours, 7.5)
  assert.equal(day.steps, 5000)
})
