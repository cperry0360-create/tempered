import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proteinGoalGrams, proteinGoalMet } from './protein.js'

test('protein target is at least 0.8 grams per pound', () => {
  assert.equal(proteinGoalGrams(164, 'imperial'), 132)
  assert.equal(proteinGoalGrams(200, 'imperial'), 160)
})

test('metric body weight converts to pounds before applying the target', () => {
  assert.equal(proteinGoalGrams(75, 'metric'), 133)
})

test('protein target rounds upward so whole-gram display never undershoots 0.8 g/lb', () => {
  assert.equal(proteinGoalGrams(163, 'imperial'), 131)
})

test('no usable body weight means no invented protein goal', () => {
  assert.equal(proteinGoalGrams(null, 'imperial'), null)
  assert.equal(proteinGoalGrams(0, 'imperial'), null)
})

test('protein completion is based on reaching the calculated goal', () => {
  assert.equal(proteinGoalMet(131, 132), false)
  assert.equal(proteinGoalMet(132, 132), true)
  assert.equal(proteinGoalMet(160, 132), true)
})
