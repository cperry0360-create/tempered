/**
 * notionalLoad: the fixed load credited to a bodyweight rep.
 *
 * The whole point of the constant is that it is a property of the EXERCISE, not
 * of the person doing it. These tests pin that down from both directions: the
 * value comes out of data/exercises.json unchanged, and nothing about the user
 * can move it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadBalance, loadExercises } from '../../test/helpers/balance.js'
import { makeContext, makeSession } from '../../test/helpers/context.js'
import { effectiveLoad, volumeByExercise, heaviestByExercise } from './records.js'
import { awardsForSession, totalsByAttribute } from './xp-engine.js'

const balance = loadBalance()
const exercises = loadExercises()
const domainDir = fileURLToPath(new URL('./', import.meta.url))

test('the seed library carries the agreed constants', () => {
  assert.equal(exercises.get('pullup').notionalLoad, 120)
  assert.equal(exercises.get('dip').notionalLoad, 100)
  assert.equal(exercises.get('hanging_leg_raise').notionalLoad, 60)
  assert.equal(exercises.get('calf_raise_single').notionalLoad, 40)
})

test('the plank is scored by time, not load, so it carries no notionalLoad', () => {
  const plank = exercises.get('plank')
  assert.equal(plank.notionalLoad, undefined)
  assert.equal(plank.unit, 'time')
})

test('a bodyweight set scores notionalLoad x reps', () => {
  const volume = volumeByExercise([{ exerciseId: 'pullup', weight: null, reps: 8 }], exercises)
  assert.equal(volume.get('pullup'), 120 * 8)
})

test('a weighted variant scores (notionalLoad + addedWeight) x reps', () => {
  const volume = volumeByExercise([{ exerciseId: 'pullup', weight: 25, reps: 5 }], exercises)
  assert.equal(volume.get('pullup'), (120 + 25) * 5)
})

test('a barbell lift is unaffected — no notionalLoad, load is the logged weight', () => {
  const volume = volumeByExercise([{ exerciseId: 'squat_bb', weight: 145, reps: 8 }], exercises)
  assert.equal(volume.get('squat_bb'), 145 * 8)
})

test('adding weight to a bodyweight movement sets a PR against the plain variant', () => {
  const heaviest = heaviestByExercise([
    { exerciseId: 'pullup', weight: null, reps: 8 },
    { exerciseId: 'pullup', weight: 45, reps: 3 },
  ], exercises)
  assert.equal(heaviest.get('pullup').weight, 165)
})

// ---------------------------------------------------------------------------
// The constant is a property of the exercise, never of the person.
// ---------------------------------------------------------------------------

test('REQUIRED: notionalLoad is fixed per exercise and never derived from body weight', () => {
  const set = { exerciseId: 'pullup', weight: null, reps: 10 }

  // Whatever the user weighs, the same rep is worth the same.
  for (const bodyWeight of [95, 140, 185, 240, 320, 400]) {
    const context = makeContext()
    // Contaminate every plausible route a body weight could arrive by.
    context.bodyWeight = bodyWeight
    context.profile = { weight: bodyWeight, bodyFat: 22 }
    const session = { ...makeSession({ sets: [set] }), bodyWeight, userWeightLbs: bodyWeight }

    assert.equal(effectiveLoad(set, exercises), 120, 'load moved with body weight')
    assert.equal(
      totalsByAttribute(awardsForSession(/** @type {any} */ (session), context, balance)).might,
      totalsByAttribute(awardsForSession(makeSession({ sets: [set] }), makeContext(), balance)).might,
      `Might moved when body weight was ${bodyWeight}`,
    )
  }
})

test('REQUIRED: every notionalLoad in the library is a literal constant', () => {
  const raw = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))
  for (const exercise of raw.exercises) {
    if (!('notionalLoad' in exercise)) continue
    assert.equal(typeof exercise.notionalLoad, 'number', `${exercise.id} must be a number`)
    assert.ok(exercise.notionalLoad > 0, `${exercise.id} must be positive`)
    assert.ok(Number.isFinite(exercise.notionalLoad), `${exercise.id} must be finite`)
  }
})

test('REQUIRED: no domain module computes a notional load — it is only ever read', () => {
  const offenders = []
  for (const file of readdirSync(domainDir)) {
    if (!file.endsWith('.js') || file.endsWith('.test.js')) continue
    const source = readFileSync(domainDir + file, 'utf8')
    // Reading `.notionalLoad` is correct. Assigning one, or arithmetic that
    // derives one, is not.
    if (/notionalLoad\s*[-+*/]?=[^=]/.test(source)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'these modules assign or derive a notional load')
})

test('two lifters of different size doing identical work earn identical Might', () => {
  const sets = [
    { exerciseId: 'pullup', weight: null, reps: 10 },
    { exerciseId: 'dip', weight: null, reps: 12 },
    { exerciseId: 'hanging_leg_raise', weight: null, reps: 15 },
  ]
  const small = awardsForSession(makeSession({ sets }), makeContext(), balance)
  const large = awardsForSession(makeSession({ sets }), makeContext(), balance)
  assert.deepEqual(small, large)
  assert.ok(totalsByAttribute(small).might > 0)
})
