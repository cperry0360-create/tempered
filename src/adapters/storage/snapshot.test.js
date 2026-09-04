import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from './memory-storage.js'
import { readSnapshot, exportSnapshot, applyImportPlan } from './snapshot.js'
import { prepareImport, APP_ID } from '../../domain/transfer.js'
import { fixedClock } from '../clock/clock.js'

const clock = fixedClock('2026-09-04T18:00:00.000Z')

async function populated() {
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('profile', { id: 'profile', name: 'Cory', planTargetSessionsPerWeek: 4 })
  await storage.putAll('sessions', [{ id: 's1', routineId: 'lower' }, { id: 's2', routineId: 'upper' }])
  await storage.putAll('setLogs', [
    { id: 'sl1', sessionId: 's1', exerciseId: 'squat_bb', weight: 145, reps: 8 },
    { id: 'sl2', sessionId: 's1', exerciseId: 'deadlift_bb', weight: 160, reps: 8 },
  ])
  await storage.putAll('dayLogs', [{ date: '2026-09-04', steps: 8200, sleepHours: 7.8 }])
  await storage.putAll('attributeState', [{ attribute: 'might', xp: 1240, level: 1, lifetimeSources: { 'might.volume': 1240 } }])
  await storage.putAll('records', [{ exerciseId: 'squat_bb', bestWeight: { weight: 145, reps: 8, date: '2026-09-04' } }])
  await storage.putAll('titles', [{ id: 'first_load', earnedAt: '2026-09-04' }])
  return storage
}

test('a snapshot reads every store', async () => {
  const snapshot = await readSnapshot(await populated())
  assert.equal(snapshot.profile.name, 'Cory')
  assert.equal(snapshot.sessions.length, 2)
  assert.equal(snapshot.setLogs.length, 2)
  assert.equal(snapshot.directive, null)
})

test('export produces a complete, valid document', async () => {
  const doc = await exportSnapshot(await populated(), clock)
  assert.equal(doc.app, APP_ID)
  assert.equal(doc.exportedAt, '2026-09-04T18:00:00.000Z')
  const plan = prepareImport(JSON.stringify(doc))
  assert.equal(plan.ok, true)
})

test('ACCEPTANCE: export then import restores the data exactly', async () => {
  const source = await populated()
  const doc = await exportSnapshot(source, clock)

  const destination = createMemoryStorage()
  await destination.open()
  const plan = prepareImport(JSON.stringify(doc))
  await applyImportPlan(destination, plan, { confirm: 'replace' })

  assert.deepEqual(await readSnapshot(destination), await readSnapshot(source))
})

test('ACCEPTANCE: import never silently overwrites — it refuses without confirmation', async () => {
  const storage = await populated()
  const plan = prepareImport(JSON.stringify(await exportSnapshot(await populated(), clock)))

  await assert.rejects(() => applyImportPlan(storage, plan), /without confirmation/)
  await assert.rejects(() => applyImportPlan(storage, plan, {}), /without confirmation/)
  await assert.rejects(() => applyImportPlan(storage, plan, { confirm: true }), /without confirmation/)
  await assert.rejects(() => applyImportPlan(storage, plan, { confirm: 'yes' }), /without confirmation/)

  // And the refusal really is a refusal: the data is untouched.
  assert.equal(await storage.count('sessions'), 2)
})

test('a refused plan can never be applied, confirmed or not', async () => {
  const storage = await populated()
  const refusal = prepareImport({ app: 'somethingElse', schemaVersion: 1, data: {} })
  await assert.rejects(() => applyImportPlan(storage, refusal, { confirm: 'replace' }), /no valid plan/)
  assert.equal(await storage.count('sessions'), 2)
})

test('import replaces rather than merges', async () => {
  const storage = await populated()

  const incoming = createMemoryStorage()
  await incoming.open()
  await incoming.put('profile', { id: 'profile', name: 'Restored' })
  await incoming.putAll('sessions', [{ id: 'other', routineId: 'cardio' }])
  const plan = prepareImport(JSON.stringify(await exportSnapshot(incoming, clock)))

  await applyImportPlan(storage, plan, { confirm: 'replace' })

  // The two original sessions are gone, not merged with the incoming one.
  const sessions = await storage.getAll('sessions')
  assert.deepEqual(sessions.map((s) => s.id), ['other'])
  assert.equal((await storage.get('profile', 'profile')).name, 'Restored')
  assert.equal(await storage.count('setLogs'), 0, 'stores absent from the backup are cleared too')
})

test('applyImportPlan reports what it wrote', async () => {
  const destination = createMemoryStorage()
  await destination.open()
  const plan = prepareImport(JSON.stringify(await exportSnapshot(await populated(), clock)))
  const written = await applyImportPlan(destination, plan, { confirm: 'replace' })
  assert.equal(written.sessions, 2)
  assert.equal(written.setLogs, 2)
  assert.equal(written.profile, 1)
})

test('a round trip through a real JSON string survives intact', async () => {
  const source = await populated()
  // Exactly what a file on disk does to the data.
  const onDisk = JSON.stringify(await exportSnapshot(source, clock), null, 2)
  const destination = createMemoryStorage()
  await destination.open()
  await applyImportPlan(destination, prepareImport(onDisk), { confirm: 'replace' })
  assert.deepEqual(await readSnapshot(destination), await readSnapshot(source))
})
