import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INSPIRE_FT1_PROFILE,
  cableLoadForPeg,
  cableStacksForExercise,
  normalizeCableMachineProfile,
  pegForCableLoad,
} from './cable-machine.js'

test('ACCEPTANCE: FT1 peg 6 is 37.5 lb per handle and 75 lb for a two-stack fly', () => {
  const load = cableLoadForPeg(6, { profile: INSPIRE_FT1_PROFILE, stacks: 2 })
  assert.equal(load.stackWeight, 75)
  assert.equal(load.perHandle, 37.5)
  assert.equal(load.total, 75)
})

test('FT1 peg 15 matches the manufacturer 82.5 lb per-pulley maximum', () => {
  const load = cableLoadForPeg(15, { profile: INSPIRE_FT1_PROFILE, stacks: 1 })
  assert.equal(load.stackWeight, 165)
  assert.equal(load.perHandle, 82.5)
  assert.equal(load.total, 82.5)
})

test('the 5 lb FT1 add-on raises the per-pulley maximum to 85 lb', () => {
  const profile = normalizeCableMachineProfile({ ...INSPIRE_FT1_PROFILE, addOnEnabled: true })
  const load = cableLoadForPeg(15, { profile, stacks: 1 })
  assert.equal(load.stackWeight, 170)
  assert.equal(load.perHandle, 85)
})

test('Cable Fly defaults to both stacks while another cable movement defaults to one', () => {
  assert.equal(cableStacksForExercise('cable_fly'), 2)
  assert.equal(cableStacksForExercise('tricep_push'), 1)
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

test('persisted cable settings are bounded and missing settings keep FT1 defaults', () => {
  const profile = normalizeCableMachineProfile({ ratio: 0, selectorPositions: 999, plateIncrement: 12.5 })
  assert.equal(profile.ratio, 2)
  assert.equal(profile.selectorPositions, 15)
  assert.equal(profile.plateIncrement, 12.5)
  assert.equal(profile.enabled, true)
})
