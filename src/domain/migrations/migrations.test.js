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

test('schema 1 is the current version and needs no migrations yet', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 1)
  assert.deepEqual(Object.keys(MIGRATIONS), [])
})

test('migrating to the same version is a no-op', () => {
  assert.equal(migrate(v1Fixture, 1, 1), v1Fixture)
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
