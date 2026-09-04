import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solvePlates } from './plates.js'

test('ACCEPTANCE: 185 lb on a 45 lb bar is 45 + 25 per side', () => {
  const solution = solvePlates(185, { bar: 45 })
  assert.deepEqual(solution.perSide, [45, 25])
  assert.equal(solution.exact, true)
  assert.equal(solution.achieved, 185)
})

test('ACCEPTANCE: an impossible target reports the closest achievable weight', () => {
  // 46 lb on a 45 lb bar needs 0.5 per side; the smallest plate is 1.25.
  const solution = solvePlates(46, { bar: 45 })
  assert.equal(solution.exact, false)
  assert.ok(Number.isFinite(solution.achieved))
  assert.match(solution.note, /Closest is/)
  assert.notEqual(solution.achieved, 46)
})

test('the closest achievable weight is genuinely the closest', () => {
  const solution = solvePlates(46, { bar: 45, plates: [45, 25, 10, 5, 2.5] })
  // Reachable neighbours are 45 (nothing) and 50 (2.5 a side). 45 is closer.
  assert.equal(solution.achieved, 45)
})

test('an empty bar is a valid answer, not an error', () => {
  const solution = solvePlates(45, { bar: 45 })
  assert.deepEqual(solution.perSide, [])
  assert.equal(solution.exact, true)
})

test('below the bar there is nothing to solve', () => {
  assert.equal(solvePlates(30, { bar: 45 }), null)
  assert.equal(solvePlates(Number.NaN, { bar: 45 }), null)
})

test('the solution uses the fewest plates', () => {
  // 135 needs 45 a side: one plate, not 25+10+10.
  assert.deepEqual(solvePlates(135, { bar: 45 }).perSide, [45])
  assert.equal(solvePlates(135, { bar: 45 }).plateCount, 1)
})

test('ties are broken toward heavier plates', () => {
  // 70 a side is 45+25 (two plates) — not 35+35, also two plates.
  const solution = solvePlates(185, { bar: 45, plates: [45, 35, 25, 10, 5] })
  assert.equal(solution.perSide[0], 45)
})

test('the bar weight is configurable', () => {
  const solution = solvePlates(135, { bar: 35 })
  assert.equal(solution.exact, true)
  assert.equal(solution.perSide.reduce((a, b) => a + b, 0) * 2 + 35, 135)
})

test('the available plates are configurable', () => {
  const solution = solvePlates(185, { bar: 45, plates: [25, 10, 5] })
  assert.equal(solution.exact, true)
  assert.deepEqual(solution.perSide, [25, 25, 10, 10])
})

test('fractional plates do not drift', () => {
  const solution = solvePlates(137.5, { bar: 45 })
  assert.equal(solution.exact, true)
  assert.equal(solution.perSide.reduce((a, b) => a + b, 0), 46.25)
  assert.equal(solution.achieved, 137.5)
})

test('a limited plate inventory is respected', () => {
  // Only one 45 per side available, so 225 must be built another way.
  const solution = solvePlates(225, { bar: 45, plates: [45, 25, 10, 5], pairsPerPlate: 1 })
  assert.equal(solution.perSide.filter((p) => p === 45).length <= 1, true)
  assert.equal(solution.perSide.reduce((a, b) => a + b, 0) * 2 + 45, solution.achieved)
})

test('no plates at all is reported, not crashed', () => {
  const solution = solvePlates(185, { bar: 45, plates: [] })
  assert.deepEqual(solution.perSide, [])
  assert.match(solution.note, /No plates/)
})

test('common gym weights all solve exactly on a standard rack', () => {
  for (const weight of [95, 115, 135, 155, 175, 185, 205, 225, 245, 275, 315]) {
    const solution = solvePlates(weight, { bar: 45 })
    assert.equal(solution.exact, true, `${weight} did not solve`)
    assert.equal(solution.perSide.reduce((a, b) => a + b, 0) * 2 + 45, weight)
  }
})
