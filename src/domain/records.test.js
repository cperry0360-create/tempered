import { test } from 'node:test'
import assert from 'node:assert/strict'
import { volumeByExercise, heaviestByExercise, detectRecords, applyRecords, workingSets } from './records.js'

/** @param {object} over */
const set = (over) => ({ exerciseId: 'squat_bb', weight: 145, reps: 8, ...over })

test('warmup sets are excluded from working sets', () => {
  const sets = [set({}), set({ isWarmup: true, weight: 95 })]
  assert.equal(workingSets(sets).length, 1)
})

test('volume is weight x reps summed per exercise', () => {
  const sets = [set({ weight: 145, reps: 8 }), set({ weight: 145, reps: 8 })]
  assert.equal(volumeByExercise(sets).get('squat_bb'), 145 * 8 * 2)
})

test('warmups add no volume', () => {
  const sets = [set({ weight: 145, reps: 8 }), set({ weight: 95, reps: 10, isWarmup: true })]
  assert.equal(volumeByExercise(sets).get('squat_bb'), 145 * 8)
})

test('bodyweight sets contribute no volume, and never NaN', () => {
  const volumes = volumeByExercise([set({ exerciseId: 'pullup', weight: null, reps: 10 })])
  assert.equal(volumes.get('pullup'), undefined)
  assert.equal(volumes.size, 0)
})

test('heaviest set per exercise is tracked with its reps', () => {
  const sets = [set({ weight: 135, reps: 10 }), set({ weight: 185, reps: 3 }), set({ weight: 155, reps: 8 })]
  assert.deepEqual(heaviestByExercise(sets).get('squat_bb'), { weight: 185, reps: 3 })
})

test('a first-ever performance sets the baseline but is not a PR', () => {
  const detected = detectRecords([set({ weight: 200, reps: 5 })], new Map())
  assert.equal(detected.weightPrs.length, 0)
  assert.equal(detected.volumePrs.length, 0)
  assert.equal(detected.e1rmGains.length, 0)
})

test('beating a standing weight record is a weight PR', () => {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 185, reps: 5, date: '2026-01-01' },
    bestVolume: { volume: 9999999, date: '2026-01-01' },
    bestE1RM: { value: 9999, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const detected = detectRecords([set({ weight: 195, reps: 5 })], records)
  assert.equal(detected.weightPrs.length, 1)
  assert.equal(detected.weightPrs[0].weight, 195)
  assert.equal(detected.weightPrs[0].previous, 185)
})

test('equalling a record is not beating it', () => {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 185, reps: 5, date: '2026-01-01' },
    bestVolume: { volume: 185 * 5, date: '2026-01-01' },
    bestE1RM: { value: 185 * (1 + 5 / 30), date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const detected = detectRecords([set({ weight: 185, reps: 5 })], records)
  assert.equal(detected.weightPrs.length, 0)
  assert.equal(detected.volumePrs.length, 0)
  assert.equal(detected.e1rmGains.length, 0)
})

test('beating a standing volume record is a volume PR', () => {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 999, reps: 1, date: '2026-01-01' },
    bestVolume: { volume: 1000, date: '2026-01-01' },
    bestE1RM: { value: 9999, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const detected = detectRecords([set({ weight: 145, reps: 8 }), set({ weight: 145, reps: 8 })], records)
  assert.equal(detected.volumePrs.length, 1)
  assert.equal(detected.volumePrs[0].volume, 2320)
})

test('an e1RM gain reports the pounds gained', () => {
  const previous = 200
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 9999, reps: 1, date: '2026-01-01' },
    bestVolume: { volume: 9999999, date: '2026-01-01' },
    bestE1RM: { value: previous, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const detected = detectRecords([set({ weight: 200, reps: 5 })], records)
  const expected = 200 * (1 + 5 / 30)
  assert.equal(detected.e1rmGains.length, 1)
  assert.ok(Math.abs(detected.e1rmGains[0].gainLbs - (expected - previous)) < 1e-9)
})

test('applyRecords does not mutate the map it was given', () => {
  const records = new Map()
  const updated = applyRecords(records, [set({ weight: 145, reps: 8 })], '2026-09-04')
  assert.equal(records.size, 0)
  assert.equal(updated.size, 1)
  assert.equal(updated.get('squat_bb').bestWeight.weight, 145)
})

test('applyRecords keeps the better of old and new', () => {
  let records = applyRecords(new Map(), [set({ weight: 200, reps: 5 })], '2026-09-01')
  records = applyRecords(records, [set({ weight: 150, reps: 5 })], '2026-09-04')
  assert.equal(records.get('squat_bb').bestWeight.weight, 200)
  assert.equal(records.get('squat_bb').lastPerformance.weight, 150)
})
