import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadedBarWeight } from './plates.js'

test('reverse calculator counts each selected plate on both sides', () => {
  assert.equal(loadedBarWeight([45, 5]), 145)
  assert.equal(loadedBarWeight([45, 45, 2.5, 1.25]), 232.5)
})
test('empty and custom bars, including zero, are supported', () => {
  assert.equal(loadedBarWeight([]), 45)
  assert.equal(loadedBarWeight([25, 10], 35), 105)
  assert.equal(loadedBarWeight([25], 0), 50)
})
test('invalid plate or bar weights cannot produce a misleading total', () => {
  for (const plates of [[-5], [0], [NaN], [Infinity], ['45']]) assert.throws(() => loadedBarWeight(plates))
  for (const bar of [-1, NaN, Infinity, '45']) assert.throws(() => loadedBarWeight([], bar))
})
