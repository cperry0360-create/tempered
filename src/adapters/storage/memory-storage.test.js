import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from './memory-storage.js'
import { STORE_NAMES } from './stores.js'

async function opened() {
  const storage = createMemoryStorage()
  await storage.open()
  return storage
}

test('every store from docs/02 exists', () => {
  for (const name of ['profile', 'sessions', 'setLogs', 'dayLogs', 'exercises', 'routines',
    'attributeState', 'records', 'titles', 'battles', 'directive']) {
    assert.ok(STORE_NAMES.includes(name), `missing store: ${name}`)
  }
})

test('put and get round-trip a record', async () => {
  const storage = await opened()
  await storage.put('sessions', { id: 's1', routineId: 'lower' })
  assert.deepEqual(await storage.get('sessions', 's1'), { id: 's1', routineId: 'lower' })
})

test('stored records are copies — a caller cannot mutate the store by reference', async () => {
  const storage = await opened()
  const session = { id: 's1', notes: 'felt strong' }
  await storage.put('sessions', session)
  session.notes = 'mutated after storing'
  assert.equal((await storage.get('sessions', 's1')).notes, 'felt strong')

  const read = await storage.get('sessions', 's1')
  read.notes = 'mutated after reading'
  assert.equal((await storage.get('sessions', 's1')).notes, 'felt strong')
})

test('put replaces by key rather than duplicating', async () => {
  const storage = await opened()
  await storage.put('dayLogs', { date: '2026-09-04', steps: 8000 })
  await storage.put('dayLogs', { date: '2026-09-04', steps: 9500 })
  assert.equal(await storage.count('dayLogs'), 1)
  assert.equal((await storage.get('dayLogs', '2026-09-04')).steps, 9500)
})

test('a record with no key is refused rather than silently dropped', async () => {
  const storage = await opened()
  await assert.rejects(() => storage.put('sessions', { routineId: 'lower' }), /no id/)
})

test('an unknown store is an error, not a silent no-op', async () => {
  const storage = await opened()
  await assert.rejects(() => storage.put('nonsense', { id: 'x' }), /Unknown store/)
  await assert.rejects(() => storage.getAll('nonsense'), /Unknown store/)
})

test('indexes query by field', async () => {
  const storage = await opened()
  await storage.putAll('setLogs', [
    { id: '1', sessionId: 's1', exerciseId: 'squat_bb' },
    { id: '2', sessionId: 's1', exerciseId: 'deadlift_bb' },
    { id: '3', sessionId: 's2', exerciseId: 'squat_bb' },
  ])
  assert.equal((await storage.getAllByIndex('setLogs', 'sessionId', 's1')).length, 2)
  assert.equal((await storage.getAllByIndex('setLogs', 'exerciseId', 'squat_bb')).length, 2)
})

test('an unknown index is an error', async () => {
  const storage = await opened()
  await assert.rejects(() => storage.getAllByIndex('setLogs', 'nope', 'x'), /no index/)
})

test('clear empties one store and leaves the others', async () => {
  const storage = await opened()
  await storage.put('sessions', { id: 's1' })
  await storage.put('dayLogs', { date: '2026-09-04' })
  await storage.clear('sessions')
  assert.equal(await storage.count('sessions'), 0)
  assert.equal(await storage.count('dayLogs'), 1)
})
