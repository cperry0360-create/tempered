/**
 * Maintenance — reset, and the update check.
 *
 * Both are destructive or disruptive, so what matters is what they refuse to do
 * as much as what they do. The platform is faked here, which is the point of
 * injecting it: a test that actually deleted the database would prove the API
 * works and nothing about this code.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createMaintenanceService, RESET_PHRASE } from './maintenance.js'
import { DATABASE_NAME } from '../adapters/storage/stores.js'

/** A browser that records what was asked of it. */
function fakePlatform(over = {}) {
  const log = { unregistered: 0, deleted: [], databases: [], reloads: 0 }
  const session = new Map()
  return {
    log,
    session: {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => session.set(k, String(v)),
      removeItem: (k) => session.delete(k),
    },
    async serviceWorkers() {
      return [{ unregister: async () => { log.unregistered += 1; return true } }]
    },
    async cacheKeys() { return ['tempered-0.7.0', 'tempered-0.8.0'] },
    async deleteCache(key) { log.deleted.push(key); return true },
    async deleteDatabase(name) { log.databases.push(name) },
    reload() { log.reloads += 1 },
    ...over,
  }
}

async function service(over = {}, version = '0.8.0 (6)') {
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('profile', { id: 'profile', name: 'Cory' })
  await storage.putAll('sessions', [{ id: 's1', routineId: 'lower', date: '2026-09-05' }])
  const platform = fakePlatform(over)
  const clock = fixedClock('2026-09-05T09:00:00.000Z')
  return {
    storage, platform,
    maintenance: createMaintenanceService({ storage, clock, platform, version }),
  }
}

// --- reset -----------------------------------------------------------------

test('reset refuses without the typed phrase', async () => {
  const { maintenance, platform } = await service()
  for (const attempt of [undefined, '', 'yes', 'ok', 'delete', 'RESE']) {
    const result = await maintenance.resetEverything({ confirmation: attempt })
    assert.equal(result.ok, false, `"${attempt}" was accepted`)
  }
  assert.equal(platform.log.databases.length, 0, 'a refused reset still touched the database')
  assert.equal(platform.log.reloads, 0, 'a refused reset still reloaded')
})

test('a tap alone can never do it — the check is in the service, not the screen', async () => {
  const { maintenance } = await service()
  assert.equal((await maintenance.resetEverything()).ok, false)
})

test('reset accepts the phrase however it is cased or spaced', async () => {
  for (const typed of [RESET_PHRASE, 'reset', '  Reset  ']) {
    const { maintenance } = await service()
    assert.equal((await maintenance.resetEverything({ confirmation: typed })).ok, true, typed)
  }
})

test('reset deletes the database, the workers and the caches, then reloads', async () => {
  const { maintenance, platform } = await service()
  const result = await maintenance.resetEverything({ confirmation: RESET_PHRASE })

  assert.equal(result.ok, true)
  assert.deepEqual(platform.log.databases, [DATABASE_NAME])
  assert.equal(platform.log.unregistered, 1)
  assert.deepEqual(platform.log.deleted, ['tempered-0.7.0', 'tempered-0.8.0'])
  assert.equal(platform.log.reloads, 1)
  assert.deepEqual(result.cleared, { workers: 1, caches: 2 })
})

test('reset closes the database before deleting it', async () => {
  // An open connection blocks deleteDatabase indefinitely, and the symptom is a
  // button that appears to do nothing at all.
  const order = []
  const storage = createMemoryStorage()
  await storage.open()
  const wrapped = { ...storage, close: async () => { order.push('close') } }
  const platform = fakePlatform({ async deleteDatabase(name) { order.push('delete') } })
  const maintenance = createMaintenanceService({
    storage: wrapped, clock: fixedClock('2026-09-05T09:00:00.000Z'), platform,
  })
  await maintenance.resetEverything({ confirmation: RESET_PHRASE })
  assert.deepEqual(order, ['close', 'delete'])
})

test('a browser missing caches or workers is still resettable', async () => {
  // The button exists to get out of a bad state, so it must not require a good
  // one. Everything the platform offers is allowed to be absent.
  const { maintenance, platform } = await service({
    async serviceWorkers() { throw new Error('no service worker here') },
    async cacheKeys() { throw new Error('no cache storage here') },
  })
  const result = await maintenance.resetEverything({ confirmation: RESET_PHRASE })
  assert.equal(result.ok, true, 'a browser without caches could not reset')
  assert.equal(platform.log.reloads, 1)
})

// --- the backup ------------------------------------------------------------

test('a backup can be taken before the reset, in the documented format', async () => {
  const { maintenance } = await service()
  const { filename, json, document } = await maintenance.backup()
  assert.match(filename, /^tempered-backup-2026-09-05\.json$/)
  assert.equal(document.app, 'tempered')
  const parsed = JSON.parse(json)
  assert.equal(parsed.data.sessions.length, 1, 'the backup did not carry the data')
})

// --- the update check ------------------------------------------------------

test('checking for updates drops the shell and reloads', async () => {
  const { maintenance, platform } = await service()
  const result = await maintenance.checkForUpdates()
  assert.equal(result.ok, true)
  assert.equal(platform.log.unregistered, 1)
  assert.equal(platform.log.deleted.length, 2)
  assert.equal(platform.log.reloads, 1)
  assert.equal(platform.log.databases.length, 0, 'an update check must not touch the data')
})

test('the version is reported on both sides of the reload', async () => {
  const { maintenance, platform } = await service({}, '0.8.0 (6)')
  await maintenance.checkForUpdates()

  // The reload: a new service reading the same session, on a newer build.
  const after = createMaintenanceService({
    storage: createMemoryStorage(), clock: fixedClock('2026-09-05T09:00:00.000Z'),
    platform, version: '0.9.0 (7)',
  })
  assert.deepEqual(after.updateResult(), { before: '0.8.0 (6)', after: '0.9.0 (7)', changed: true })
})

test('an unchanged build says so, rather than nothing', async () => {
  // The whole point: telling a build that failed to deploy from one that
  // deployed and did not fix the problem.
  const { maintenance, platform } = await service({}, '0.8.0 (6)')
  await maintenance.checkForUpdates()
  const after = createMaintenanceService({
    storage: createMemoryStorage(), clock: fixedClock('2026-09-05T09:00:00.000Z'),
    platform, version: '0.8.0 (6)',
  })
  assert.deepEqual(after.updateResult(), { before: '0.8.0 (6)', after: '0.8.0 (6)', changed: false })
})

test('the result is reported once and then forgotten', async () => {
  const { maintenance, platform } = await service()
  await maintenance.checkForUpdates()
  const after = createMaintenanceService({
    storage: createMemoryStorage(), clock: fixedClock('2026-09-05T09:00:00.000Z'),
    platform, version: '0.8.0 (6)',
  })
  assert.ok(after.updateResult())
  assert.equal(after.updateResult(), null, 'the notice stayed on screen after being read')
})

test('there is no notice when no check was asked for', async () => {
  const { maintenance } = await service()
  assert.equal(maintenance.updateResult(), null)
})

test('a reset leaves no update notice behind', async () => {
  const { maintenance, platform } = await service()
  await maintenance.checkForUpdates()
  await maintenance.resetEverything({ confirmation: RESET_PHRASE })
  const after = createMaintenanceService({
    storage: createMemoryStorage(), clock: fixedClock('2026-09-05T09:00:00.000Z'),
    platform, version: '0.8.0 (6)',
  })
  assert.equal(after.updateResult(), null, 'a fresh install was told about an old update check')
})

test('a browser that refuses session storage still checks for updates', async () => {
  const { maintenance, platform } = await service({ session: null })
  const result = await maintenance.checkForUpdates()
  assert.equal(result.ok, true)
  assert.equal(platform.log.reloads, 1)
  assert.equal(maintenance.updateResult(), null, 'nothing to report, and no throw')
})
