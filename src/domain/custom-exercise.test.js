import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customExercise } from './custom-exercise.js'

test('custom exercises normalize names without inventing load or muscle activation', () => {
  const exercise = customExercise({ name: '  My press  ', group: 'chest', variant: 'Machine', class: 'compound', tracking: 'reps' }, 'custom-1')
  assert.equal(exercise.name, 'My press')
  assert.equal(exercise.unit, 'lbs')
  assert.equal(exercise.source, 'user')
  assert.deepEqual(exercise.activation, {})
  assert.equal(exercise.notionalLoad, undefined)
})
test('custom tracking modes use the existing logger schema', () => {
  assert.equal(customExercise({ name: 'Hold', tracking: 'time' }, '1').unit, 'time')
  assert.equal(customExercise({ name: 'Hold', tracking: 'time' }, '1').progression, 'time')
  assert.equal(customExercise({ name: 'Carry', tracking: 'distance' }, '2').metric, 'distance')
  assert.equal(customExercise({ name: 'Carry', tracking: 'distance' }, '2').progression, 'load')
  assert.equal(customExercise({ name: 'Pull up', tracking: 'bodyweight' }, '3').unit, 'bodyweight')
  assert.equal(customExercise({ name: 'Pull up', tracking: 'bodyweight' }, '3').progression, 'reps')
})
test('invalid names and metadata cannot create unusable exercises', () => {
  for (const input of [{ name: ' ' }, { name: 'x'.repeat(81) }, { name: 'Test', tracking: 'bogus' }, { name: 'Test', class: 'bogus' }]) {
    assert.throws(() => customExercise(input, '1'))
  }
})
