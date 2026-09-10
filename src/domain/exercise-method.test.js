import { test } from 'node:test'
import assert from 'node:assert/strict'
import { methodForExercise, methodsForExercise, methodForSet, setUsesMethod } from './exercise-method.js'

const exercise = {
  id: 'incline_bench_db',
  variant: 'Dumbbell',
  methods: ['Dumbbell', 'Barbell', 'Cable', 'Machine'],
}

test('an exercise exposes only unique curated methods with its default first', () => {
  assert.deepEqual(methodsForExercise({ ...exercise, methods: ['Cable', 'Dumbbell', 'Cable'] }),
    ['Dumbbell', 'Cable'])
})

test('an invalid saved choice safely falls back to the shipped method', () => {
  assert.equal(methodForExercise(exercise, 'Kettlebell'), 'Dumbbell')
  assert.equal(methodForExercise(exercise, 'Cable'), 'Cable')
})

test('legacy sets inherit the exercise default while new sets keep their method', () => {
  assert.equal(methodForSet({ weight: 45 }, exercise), 'Dumbbell')
  assert.equal(methodForSet({ weight: 70, method: 'Cable' }, exercise), 'Cable')
  assert.equal(setUsesMethod({ weight: 45 }, exercise, 'Dumbbell'), true)
  assert.equal(setUsesMethod({ weight: 45 }, exercise, 'Cable'), false)
})
