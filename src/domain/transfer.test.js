import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExportDocument, prepareImport, APP_ID, DATA_KEYS } from './transfer.js'
import { CURRENT_SCHEMA_VERSION } from './migrations/index.js'

const sample = {
  profile: { id: 'profile', name: 'Cory', units: 'imperial', planTargetSessionsPerWeek: 4 },
  sessions: [{ id: 's1', routineId: 'lower' }],
  setLogs: [{ id: 'sl1', sessionId: 's1', exerciseId: 'squat_bb', weight: 145, reps: 8 }],
  dayLogs: [{ date: '2026-09-04', steps: 8200 }],
  attributeState: [{ attribute: 'might', xp: 1200, level: 1, lifetimeSources: { 'might.volume': 1200 } }],
  records: [{ exerciseId: 'squat_bb', bestWeight: { weight: 145, reps: 8, date: '2026-09-04' } }],
  titles: [{ id: 'first_load' }],
  battles: [{ date: '2026-09-04', seed: 42 }],
  exercises: [], routines: [], directive: null,
}

test('an export document carries app, schemaVersion and exportedAt', () => {
  const doc = buildExportDocument(sample, { exportedAt: '2026-09-04T18:00:00.000Z' })
  assert.equal(doc.app, APP_ID)
  assert.equal(doc.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(doc.exportedAt, '2026-09-04T18:00:00.000Z')
})

test('an export carries every store, so a round trip is exact', () => {
  const doc = buildExportDocument(sample, { exportedAt: 'now' })
  for (const key of DATA_KEYS) assert.ok(key in doc.data, `export is missing ${key}`)
})

test('missing stores export as empty rather than undefined', () => {
  const doc = buildExportDocument({}, { exportedAt: 'now' })
  assert.equal(doc.data.profile, null)
  assert.deepEqual(doc.data.sessions, [])
})

test('a valid export imports back to exactly what went in', () => {
  const doc = buildExportDocument(sample, { exportedAt: 'now' })
  const plan = prepareImport(JSON.stringify(doc))
  assert.equal(plan.ok, true)
  assert.deepEqual(plan.data, doc.data)
  assert.equal(plan.summary.sessions, 1)
  assert.equal(plan.summary.profile, 1)
})

// --- refusals ---------------------------------------------------------------

test('a mismatched schema version is refused with a clear message', () => {
  const doc = buildExportDocument(sample, { exportedAt: 'now' })
  const plan = prepareImport({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION + 5 })
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'newer-schema')
  assert.match(plan.message, /newer version of Tempered/)
  assert.match(plan.message, /Nothing has been changed/)
})

test('a file from another app is refused before its data is looked at', () => {
  const plan = prepareImport({ app: 'someOtherTracker', schemaVersion: 1, data: { sessions: [] } })
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'not-tempered')
  assert.match(plan.message, /not a Tempered backup/)
})

test('a missing schema version is refused rather than assumed', () => {
  const plan = prepareImport({ app: APP_ID, data: {} })
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'no-version')
})

test('unreadable JSON is refused without throwing', () => {
  const plan = prepareImport('{ this is not json')
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'unreadable')
})

test('a backup with no data is refused', () => {
  const plan = prepareImport({ app: APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION })
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'no-data')
})

test('a malformed collection is refused rather than half-imported', () => {
  const plan = prepareImport({
    app: APP_ID, schemaVersion: CURRENT_SCHEMA_VERSION,
    data: { ...sample, sessions: 'not a list' },
  })
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'malformed')
})

test('every refusal says nothing was changed, and none blames the user', () => {
  const refusals = [
    prepareImport('nonsense'),
    prepareImport({ app: 'other', schemaVersion: 1, data: {} }),
    prepareImport({ app: APP_ID, data: {} }),
    prepareImport({ app: APP_ID, schemaVersion: 99, data: {} }),
  ]
  for (const refusal of refusals) {
    assert.equal(refusal.ok, false)
    assert.ok(refusal.message.length > 20, 'a refusal must explain itself')
    assert.ok(!/fail|invalid|error|corrupt/i.test(refusal.message),
      `refusal reads as blame: ${refusal.message}`)
  }
})

// --- confirmation -----------------------------------------------------------

test('a successful plan always demands confirmation', () => {
  const doc = buildExportDocument(sample, { exportedAt: 'now' })
  const plan = prepareImport(doc)
  assert.equal(plan.requiresConfirmation, true)
})

test('preparing an import changes nothing — a plan is a proposal', () => {
  const doc = buildExportDocument(sample, { exportedAt: 'now' })
  const before = JSON.stringify(doc)
  prepareImport(doc)
  assert.equal(JSON.stringify(doc), before)
})

// --- migration --------------------------------------------------------------

test('an older backup is migrated forward, and says where it came from', () => {
  const registry = { 1: (data) => ({ ...data, migrated: true }) }
  const plan = prepareImport(
    { app: APP_ID, schemaVersion: 1, data: { ...sample } },
    { schemaVersion: 2, registry },
  )
  assert.equal(plan.ok, true)
  assert.equal(plan.migratedFrom, 1)
  assert.equal(plan.schemaVersion, 2)
  assert.equal(plan.data.migrated, true)
})

test('an older backup with no migration path is refused, not guessed at', () => {
  const plan = prepareImport(
    { app: APP_ID, schemaVersion: 1, data: {} },
    { schemaVersion: 3, registry: {} },
  )
  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'unmigratable')
})
