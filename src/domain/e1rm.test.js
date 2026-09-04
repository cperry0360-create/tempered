import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateOneRepMax } from './e1rm.js'

test('Epley: a single rep estimates the lifted weight', () => {
  assert.equal(estimateOneRepMax(225, 1), 225 * (1 + 1 / 30))
})

test('Epley matches the formula in docs/01', () => {
  assert.equal(estimateOneRepMax(160, 8), 160 * (1 + 8 / 30))
})

test('more reps at the same load estimates a higher max', () => {
  assert.ok(estimateOneRepMax(160, 10) > estimateOneRepMax(160, 5))
})

test('intensity beats junk volume: heavy triples out-estimate light fifteens', () => {
  const heavyTriple = estimateOneRepMax(275, 3)
  const lightFifteen = estimateOneRepMax(135, 15)
  assert.ok(heavyTriple > lightFifteen)
})

test('missing or non-positive inputs estimate nothing, never NaN', () => {
  for (const [weight, reps] of [[null, 5], [225, null], [0, 5], [225, 0], [-100, 5]]) {
    const result = estimateOneRepMax(weight, reps)
    assert.equal(result, 0)
    assert.ok(!Number.isNaN(result))
  }
})
