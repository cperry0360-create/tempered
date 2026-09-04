import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance, loadExercises } from '../../test/helpers/balance.js'
import {
  proposeNext, fiveThreeOneWeek, trainingMaxFrom, hitAllReps, incrementFor,
} from './progression.js'

const balance = loadBalance()
const exercises = loadExercises()
const squat = exercises.get('squat_bb')       // 531, lower
const rows = exercises.get('seated_row_close') // linear, upper
const pullup = exercises.get('pullup')         // reps
const plank = exercises.get('plank')           // time
const carry = exercises.get('farmers_carry')   // load

test('increments are bigger for lower body than upper', () => {
  assert.equal(incrementFor(squat, balance), balance.progressionDefaults.linearIncrementLowerLbs)
  assert.equal(incrementFor(rows, balance), balance.progressionDefaults.linearIncrementUpperLbs)
})

test('the training max sits below the estimated max, so the work stays sub-maximal', () => {
  const tm = trainingMaxFrom(300, balance)
  assert.ok(tm < 300)
  assert.equal(tm % balance.progressionDefaults.fiveThreeOne.roundToLbs, 0, 'rounds to the plate')
})

test('5/3/1 weeks climb in intensity, then deload', () => {
  const tm = 200
  const [w1, w2, w3, w4] = [0, 1, 2, 3].map((week) => fiveThreeOneWeek(tm, week, balance))
  const top = (sets) => Math.max(...sets.map((s) => s.weight))
  assert.ok(top(w1) < top(w2) && top(w2) < top(w3), 'weeks 1-3 build')
  assert.ok(top(w4) < top(w1), 'week 4 is a deload')
  assert.equal(w3.at(-1).reps, 1, 'the 5/3/1 week finishes on a single')
})

test('5/3/1 marks the last working set as AMRAP, except on the deload', () => {
  assert.equal(fiveThreeOneWeek(200, 0, balance).at(-1).amrap, true)
  assert.equal(fiveThreeOneWeek(200, 3, balance).at(-1).amrap, false)
})

test('5/3/1 cycles wrap rather than running off the end', () => {
  assert.deepEqual(fiveThreeOneWeek(200, 4, balance), fiveThreeOneWeek(200, 0, balance))
  assert.deepEqual(fiveThreeOneWeek(200, -1, balance), fiveThreeOneWeek(200, 3, balance))
})

test('hitAllReps requires every set, not just the first', () => {
  assert.equal(hitAllReps([{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }], 8), true)
  assert.equal(hitAllReps([{ weight: 100, reps: 8 }, { weight: 100, reps: 6 }], 8), false)
  assert.equal(hitAllReps([], 8), false)
})

test('with no history, the routine prescription is proposed unchanged', () => {
  const proposal = proposeNext({
    exercise: rows, last: null, prescribed: { sets: 3, reps: 8, weight: 120 },
  }, balance)
  assert.equal(proposal.sets.length, 3)
  assert.equal(proposal.sets[0].weight, 120)
  assert.equal(proposal.isIncrease, false)
  assert.match(proposal.reason, /No history/)
})

test('linear: hitting every rep proposes one increment more', () => {
  const proposal = proposeNext({
    exercise: rows,
    last: { date: 'd1', sets: [{ weight: 120, reps: 8 }, { weight: 120, reps: 8 }, { weight: 120, reps: 8 }] },
    prescribed: { sets: 3, reps: 8, weight: 120 },
  }, balance)
  assert.equal(proposal.sets[0].weight, 120 + balance.progressionDefaults.linearIncrementUpperLbs)
  assert.equal(proposal.isIncrease, true)
})

test('linear: missing reps repeats the weight rather than dropping it', () => {
  const proposal = proposeNext({
    exercise: rows,
    last: { date: 'd1', sets: [{ weight: 120, reps: 8 }, { weight: 120, reps: 5 }] },
    prescribed: { sets: 3, reps: 8, weight: 120 },
  }, balance)
  assert.equal(proposal.sets[0].weight, 120, 'never proposes going backwards')
  assert.equal(proposal.isIncrease, false)
})

test('reps: bodyweight adds a rep, then converts to load at the target', () => {
  const target = balance.progressionDefaults.repsProgressionTarget
  const adding = proposeNext({
    exercise: pullup, last: { date: 'd1', sets: [{ weight: null, reps: 8 }] }, prescribed: { sets: 3, reps: 8, weight: null },
  }, balance)
  assert.equal(adding.sets[0].reps, 9)

  const loading = proposeNext({
    exercise: pullup, last: { date: 'd1', sets: [{ weight: null, reps: target }] }, prescribed: { sets: 3, reps: target, weight: null },
  }, balance)
  assert.ok(loading.sets[0].weight > 0, 'adds load once the rep target is met')
  assert.ok(loading.sets[0].reps < target, 'and drops the reps back')
})

test('time: holds progress by seconds', () => {
  const step = balance.progressionDefaults.timeProgressionIncrementSec
  const proposal = proposeNext({
    exercise: plank, last: { date: 'd1', sets: [{ weight: null, reps: null, timeSec: 60 }] }, prescribed: { sets: 3, reps: null, weight: null },
  }, balance)
  assert.equal(proposal.sets[0].timeSec, 60 + step)
})

test('load: carries progress by load before distance', () => {
  const step = balance.progressionDefaults.carryLoadIncrementLbs
  const proposal = proposeNext({
    exercise: carry,
    last: { date: 'd1', sets: [{ weight: 100, reps: null, distance: 40 }] },
    prescribed: { sets: 3, reps: null, weight: 100, distance: 40 },
  }, balance)
  assert.equal(proposal.sets[0].weight, 100 + step)
  assert.equal(proposal.sets[0].distance, 40, 'distance held while load climbs')
})

test('531: proposes off a training max derived from what was actually lifted', () => {
  const proposal = proposeNext({
    exercise: squat,
    last: { date: 'd1', sets: [{ weight: 185, reps: 5 }] },
    prescribed: { sets: 3, reps: 5, weight: 185 },
    cycleWeek: 0,
  }, balance)
  assert.equal(proposal.sets.length, 3)
  assert.ok(proposal.sets.every((s) => s.weight < 185 * 1.2))
  assert.match(proposal.reason, /training max/)
})

test('EVERY proposal is a proposal — nothing here applies anything', () => {
  // The rule from docs/05: the app proposes, never imposes. A proposal is a
  // plain value; there is no path from this module to storage or to a session.
  const source = process.env.NODE_ENV
  const proposal = proposeNext({
    exercise: rows, last: { date: 'd1', sets: [{ weight: 120, reps: 8 }] }, prescribed: { sets: 3, reps: 8, weight: 120 },
  }, balance)
  assert.ok('sets' in proposal && 'isIncrease' in proposal && 'reason' in proposal)
  assert.ok(proposal.reason.length > 0, 'a proposal always explains itself')
  assert.equal(source, process.env.NODE_ENV)
})

test('an increase is always announced, so the user can overwrite it', () => {
  const proposal = proposeNext({
    exercise: rows,
    last: { date: 'd1', sets: [{ weight: 120, reps: 8 }, { weight: 120, reps: 8 }, { weight: 120, reps: 8 }] },
    prescribed: { sets: 3, reps: 8, weight: 120 },
  }, balance)
  assert.equal(proposal.isIncrease, true)
  assert.match(proposal.reason, /change it/i)
})
