import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROGRAM_SCHEMA_VERSION,
  applyProgramRevision,
  createProgramRevision,
  migrateProgramRecord,
  prescriptionSnapshot,
  revisionIdFor,
  validateProgram,
} from './program-schema.js'

const program = {
  id: 'custom',
  name: 'A Small Custom Plan',
  weeks: 4,
  note: 'Do the useful work.',
  status: 'active',
  source: 'user',
  days: [{
    id: 'monday',
    name: 'Full body',
    weekday: 'Monday',
    exercises: [{
      exerciseId: 'goblet_squat',
      sets: 3,
      repMin: 6,
      repMax: 10,
      restSec: [90, 120],
    }],
  }],
}

test('program records migrate into a versioned ownership envelope without mutation', () => {
  const legacy = { id: 'legacy', name: 'Legacy', weeks: 8, days: [] }
  const before = JSON.stringify(legacy)
  const migrated = migrateProgramRecord(legacy, { status: 'active', source: 'seed' })

  assert.equal(migrated.programSchemaVersion, PROGRAM_SCHEMA_VERSION)
  assert.equal(migrated.source, 'seed')
  assert.equal(migrated.status, 'active')
  assert.equal(migrated.revisionNumber, 1)
  assert.equal(migrated.currentRevisionId, 'legacy:r1')
  assert.equal(JSON.stringify(legacy), before)
})

test('revision ids are stable and revisions contain a complete prescription snapshot', () => {
  assert.equal(revisionIdFor('custom', 3), 'custom:r3')
  const revision = createProgramRevision(program, { version: 2, createdAt: '2026-09-16T12:00:00.000Z' })

  assert.equal(revision.id, 'custom:r2')
  assert.equal(revision.programId, 'custom')
  assert.equal(revision.version, 2)
  assert.equal(revision.createdAt, '2026-09-16T12:00:00.000Z')
  assert.deepEqual(revision.snapshot.days, program.days)
  assert.equal(revision.snapshot.status, undefined)
  assert.equal(revision.snapshot.source, undefined)
})

test('applying a revision changes prescription only and keeps lifecycle metadata', () => {
  const envelope = migrateProgramRecord(program)
  const next = { ...program, name: 'A Revised Plan', days: [] }
  const revision = createProgramRevision(next, { version: 2 })
  const applied = applyProgramRevision(envelope, revision)

  assert.equal(applied.id, 'custom')
  assert.equal(applied.name, 'A Revised Plan')
  assert.deepEqual(applied.days, [])
  assert.equal(applied.status, 'active')
  assert.equal(applied.currentRevisionId, 'custom:r2')
  assert.equal(applied.revisionNumber, 2)
})

test('complete programs validate, while a blank custom draft may remain incomplete', () => {
  assert.deepEqual(validateProgram(program), { ok: true, errors: [] })
  const blank = migrateProgramRecord({ id: 'blank', name: 'Blank Custom', weeks: 1, days: [] })
  assert.deepEqual(validateProgram(blank, { allowIncomplete: true }), { ok: true, errors: [] })
  assert.equal(validateProgram({ ...program, days: [{ ...program.days[0], exercises: [{ sets: 0 }] }] }).ok, false)
})

test('prescription snapshots are detached copies', () => {
  const snapshot = prescriptionSnapshot(program)
  snapshot.days[0].exercises[0].sets = 99
  assert.equal(program.days[0].exercises[0].sets, 3)
})
