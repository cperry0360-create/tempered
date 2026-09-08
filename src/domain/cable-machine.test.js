import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INSPIRE_FTX_PROFILE,
  cableLoadForPeg,
  cablePegEnabledForExercise,
  cableStacksForExercise,
  migrateLegacyCableFlySet,
  normalizeCableMachineProfile,
  pegForCableLoad,
  withCableExerciseSetting,
} from './cable-machine.js'

test('ACCEPTANCE: FTX peg 6 is 37.5 lb nominal per handle and 75 lb for a two-stack fly', () => {
  const load = cableLoadForPeg(6, { profile: INSPIRE_FTX_PROFILE, stacks: 2 })
  assert.equal(load.stackWeight, 75)
  assert.equal(load.perHandle, 37.5)
  assert.equal(load.total, 75)
})

test('FTX peg 15 matches the manufacturer 82.5 lb per-pulley maximum', () => {
  const load = cableLoadForPeg(15, { profile: INSPIRE_FTX_PROFILE, stacks: 1 })
  assert.equal(load.stackWeight, 165)
  assert.equal(load.perHandle, 82.5)
  assert.equal(load.total, 82.5)
})

test('the optional 5 lb add-on raises the nominal per-pulley maximum to 85 lb', () => {
  const profile = normalizeCableMachineProfile({ ...INSPIRE_FTX_PROFILE, addOnEnabled: true })
  const load = cableLoadForPeg(15, { profile, stacks: 1 })
  assert.equal(load.stackWeight, 170)
  assert.equal(load.perHandle, 85)
})

test('Cable Fly starts in peg mode on both stacks while other cable movements remain opt-in', () => {
  assert.equal(cablePegEnabledForExercise('cable_fly'), true)
  assert.equal(cableStacksForExercise('cable_fly'), 2)
  assert.equal(cablePegEnabledForExercise('tricep_push'), false)
  assert.equal(cableStacksForExercise('tricep_push'), 1)
})

test('each cable exercise can independently enable peg mode and choose one or two stacks', () => {
  const profile = withCableExerciseSetting(INSPIRE_FTX_PROFILE, 'tricep_push', { enabled: true, stacks: 2 })
  assert.equal(cablePegEnabledForExercise('tricep_push', profile), true)
  assert.equal(cableStacksForExercise('tricep_push', profile), 2)
  assert.equal(cableStacksForExercise('cable_fly', profile), 2)
})

test('effective cable load reverses to the original peg exactly', () => {
  for (const peg of [1, 6, 10, 15]) {
    const load = cableLoadForPeg(peg, { stacks: 2 })
    assert.equal(pegForCableLoad(load.total, { stacks: 2 }), peg)
  }
})

test('loads that do not land exactly on a selector position are not guessed', () => {
  assert.equal(pegForCableLoad(15.5, { stacks: 2 }), null)
  assert.equal(cableLoadForPeg(0), null)
  assert.equal(cableLoadForPeg(16), null)
  assert.equal(cableLoadForPeg(6.5), null)
})

test('the mistaken FT1 persisted identity migrates to FTX / Centr 2 without losing settings', () => {
  const profile = normalizeCableMachineProfile({ id: 'inspire_ft1', name: 'Inspire FT1', ratio: 2.5, plateIncrement: 12.5 })
  assert.equal(profile.id, 'inspire_ftx_centr2')
  assert.equal(profile.name, 'Inspire FTX / Centr 2')
  assert.equal(profile.ratio, 2.5)
  assert.equal(profile.plateIncrement, 12.5)
})

test('legacy Cable Fly peg numbers are migrated to nominal effective resistance and metadata', () => {
  const legacy = { id: 'old', exerciseId: 'cable_fly', weight: 7, reps: 12 }
  const migrated = migrateLegacyCableFlySet(legacy)
  assert.equal(migrated.weight, 85)
  assert.equal(migrated.cablePeg, 7)
  assert.equal(migrated.cablePerHandle, 42.5)
  assert.equal(migrated.cableStacks, 2)
  assert.equal(migrated.cableLegacyMigrated, true)
})

test('legacy migration is intentionally narrow and never reinterprets other cable weights', () => {
  const pulldown = { exerciseId: 'lat_pulldown', weight: 7, reps: 12 }
  assert.equal(migrateLegacyCableFlySet(pulldown), pulldown)
  const alreadyMigrated = { exerciseId: 'cable_fly', weight: 75, reps: 12, cablePeg: 6 }
  assert.equal(migrateLegacyCableFlySet(alreadyMigrated), alreadyMigrated)
})

test('persisted cable settings are bounded and missing settings keep FTX defaults', () => {
  const profile = normalizeCableMachineProfile({ ratio: 0, selectorPositions: 999, plateIncrement: 12.5 })
  assert.equal(profile.ratio, 2)
  assert.equal(profile.selectorPositions, 15)
  assert.equal(profile.plateIncrement, 12.5)
  assert.equal(profile.enabled, true)
})
