import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrate, canMigrate, CURRENT_SCHEMA_VERSION, MIGRATIONS } from './index.js'

// A fixture of a "previous version", per docs/02: migrations are tested against
// the shape they upgrade from. The real registry is empty at schema 1, so the
// machinery is proven with an injected registry rather than an invented version.
const v1Fixture = Object.freeze({
  profile: { id: 'profile', name: 'Cory' },
  sessions: [{ id: 's1' }],
})

test('schema 2 is current, and every step from 1 exists', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 2)
  for (let version = 1; version < CURRENT_SCHEMA_VERSION; version++) {
    assert.equal(typeof MIGRATIONS[version], 'function', `no migration from ${version}`)
  }
})

test('migrating to the same version is a no-op', () => {
  assert.equal(migrate(v1Fixture, 1, 1), v1Fixture)
})

// docs/02 requires each migration to be tested against a fixture of the version
// it upgrades FROM. This is that fixture: a version 1 backup, from before
// programs existed.
const V1_BACKUP = Object.freeze({
  profile: { id: 'profile', name: 'Cory', units: 'imperial', planTargetSessionsPerWeek: 4 },
  sessions: [{ id: 's1', routineId: 'lower', date: '2026-09-04', endedAt: '2026-09-04T19:00:00.000Z' }],
  setLogs: [{ id: 'sl1', sessionId: 's1', exerciseId: 'squat_bb', weight: 145, reps: 8 }],
  dayLogs: [{ date: '2026-09-04', steps: 8200 }],
  attributeState: [{ attribute: 'might', xp: 1240, level: 2, lifetimeSources: { 'might.volume': 1240 } }],
  records: [{ exerciseId: 'squat_bb', bestWeight: { weight: 145, reps: 8, date: '2026-09-04' } }],
  titles: [{ id: 'first_load' }],
  battles: [],
  exercises: [],
  routines: [{ id: 'lower', name: 'Lower Body' }],
  directive: null,
})

test('1 -> 2 upgrades a real version 1 backup', () => {
  const upgraded = migrate(structuredClone(V1_BACKUP), 1, 2)
  assert.deepEqual(upgraded.programs, [], 'a v1 backup has no programs, so it gains an empty list')
  assert.deepEqual(upgraded.programState, [])
})

test('1 -> 2 changes nothing that already existed', () => {
  const upgraded = migrate(structuredClone(V1_BACKUP), 1, 2)
  for (const key of Object.keys(V1_BACKUP)) {
    assert.deepEqual(upgraded[key], V1_BACKUP[key], `${key} was altered by the migration`)
  }
})

test('1 -> 2 does not mutate the backup it was given', () => {
  const input = structuredClone(V1_BACKUP)
  const before = JSON.stringify(input)
  migrate(input, 1, 2)
  assert.equal(JSON.stringify(input), before)
})

test('a v1 backup that somehow already has programs keeps them', () => {
  const odd = { ...structuredClone(V1_BACKUP), programs: [{ id: 'x' }] }
  assert.deepEqual(migrate(odd, 1, 2).programs, [{ id: 'x' }])
})

test('migrations compose in order across several versions', () => {
  const registry = {
    1: (d) => ({ ...d, steps: [...(d.steps ?? []), 'one-to-two'] }),
    2: (d) => ({ ...d, steps: [...d.steps, 'two-to-three'] }),
  }
  const out = migrate({ ...v1Fixture }, 1, 3, registry)
  assert.deepEqual(out.steps, ['one-to-two', 'two-to-three'])
  assert.equal(out.profile.name, 'Cory')
})

test('a migration must not mutate its input', () => {
  const registry = { 1: (d) => ({ ...d, added: true }) }
  const input = { ...v1Fixture }
  const before = JSON.stringify(input)
  migrate(input, 1, 2, registry)
  assert.equal(JSON.stringify(input), before)
})

test('a downgrade is refused with a message that names the fix', () => {
  assert.throws(() => migrate({}, 5, 1), /newer version of Tempered/)
})

test('a missing step is refused rather than skipped', () => {
  assert.throws(() => migrate({}, 1, 3, { 1: (d) => d }), /No migration from schema version 2/)
})

test('canMigrate reports whether a path exists before anything is attempted', () => {
  assert.equal(canMigrate(1, 1), true)
  assert.equal(canMigrate(1, 3, { 1: (d) => d, 2: (d) => d }), true)
  assert.equal(canMigrate(1, 3, { 1: (d) => d }), false)
  assert.equal(canMigrate(5, 1), false)
})

test('non-integer versions are refused', () => {
  assert.throws(() => migrate({}, 1.5, 2), /must be integers/)
})
