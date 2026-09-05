import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { hasMeaningfulSetValues, discardSessionWork } from './session-guard.js'

test('blank or weight-only sets are not meaningful work', () => {
  assert.equal(hasMeaningfulSetValues({}), false)
  assert.equal(hasMeaningfulSetValues({ weight: 135, reps: '' }), false)
  assert.equal(hasMeaningfulSetValues({ weight: 135, reps: 0 }), false)
})

test('reps, time, or distance make a set meaningful', () => {
  assert.equal(hasMeaningfulSetValues({ reps: 8 }), true)
  assert.equal(hasMeaningfulSetValues({ timeSec: 30 }), true)
  assert.equal(hasMeaningfulSetValues({ distance: 40 }), true)
})

test('cancel discards this attempt and removes an empty session', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const session = { id: 's1', date: '2026-09-04', endedAt: null }
  await storage.put('sessions', session)
  await storage.put('setLogs', { id: 'new1', sessionId: 's1', exerciseId: 'curl_db' })
  await storage.put('setLogs', { id: 'new2', sessionId: 's1', exerciseId: 'curl_db' })

  const result = await discardSessionWork({ storage, session, logIds: ['new1', 'new2'] })
  assert.deepEqual(result, { discardedSets: 2, deletedSession: true })
  assert.equal(await storage.get('sessions', 's1'), undefined)
  assert.equal((await storage.getAll('setLogs')).length, 0)
})

test('canceling a Today slot preserves earlier work in the shared day session', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const session = { id: 'day1', date: '2026-09-04', endedAt: '2026-09-04T12:00:00.000Z' }
  await storage.put('sessions', session)
  await storage.put('setLogs', { id: 'old', sessionId: 'day1', exerciseId: 'bench' })
  await storage.put('setLogs', { id: 'new', sessionId: 'day1', exerciseId: 'curl_db' })

  const result = await discardSessionWork({ storage, session, logIds: ['new'] })
  assert.deepEqual(result, { discardedSets: 1, deletedSession: false })
  assert.ok(await storage.get('sessions', 'day1'))
  assert.ok(await storage.get('setLogs', 'old'))
  assert.equal(await storage.get('setLogs', 'new'), undefined)
})
