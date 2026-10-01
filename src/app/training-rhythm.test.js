import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mondayOf, trainingRhythm } from './training-rhythm.js'

const week = (monday, days = 4) => Object.fromEntries(Array.from({ length: days }, (_, index) => {
  const at = new Date(`${monday}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + index)
  return [at.toISOString().slice(0, 10), 30]
}))

test('weeks begin on Monday and cross month boundaries safely', () => {
  assert.equal(mondayOf('2026-09-10'), '2026-09-07')
  assert.equal(mondayOf('2026-10-01'), '2026-09-28')
})

test('three distinct 30-minute days keep one positive rhythm week', () => {
  const result = trainingRhythm(week('2026-09-07', 3), '2026-09-13')
  assert.equal(result.weeklyDays, 3)
  assert.equal(result.strongWeekDays, 4)
  assert.equal(result.currentWeekDays, 3)
  assert.equal(result.streakWeeks, 1)
  assert.equal(result.keeperProgress, 0)
})

test('four distinct 30-minute days make a strong week and advance the keeper', () => {
  const result = trainingRhythm(week('2026-09-07'), '2026-09-13')
  assert.equal(result.currentWeekDays, 4)
  assert.equal(result.streakWeeks, 1)
  assert.equal(result.keeperProgress, 1)
})

test('short sessions remain visible without counting as a qualifying day', () => {
  const result = trainingRhythm({ '2026-09-07': 29, '2026-09-08': 31 }, '2026-09-09')
  assert.deepEqual(result.trainedDates, ['2026-09-07', '2026-09-08'])
  assert.deepEqual(result.qualifyingDates, ['2026-09-08'])
  assert.equal(result.currentWeekDays, 1)
})

test('three-day weeks preserve keeper progress without advancing it', () => {
  const minutes = {
    ...week('2026-08-03'),
    ...week('2026-08-10', 3),
    ...week('2026-08-17'),
  }
  const result = trainingRhythm(minutes, '2026-08-23')
  assert.equal(result.streakWeeks, 3)
  assert.equal(result.keeperProgress, 2)
})

test('five strong weeks bank a keeper', () => {
  const minutes = {
    ...week('2026-08-03'), ...week('2026-08-10'), ...week('2026-08-17'),
    ...week('2026-08-24'), ...week('2026-08-31'),
  }
  const result = trainingRhythm(minutes, '2026-09-06')
  assert.equal(result.streakWeeks, 5)
  assert.equal(result.keepers, 1)
  assert.equal(result.keeperProgress, 0)
})

test('a banked keeper protects one quiet completed week without rewarding it as training', () => {
  const minutes = {
    ...week('2026-07-27'), ...week('2026-08-03'), ...week('2026-08-10'),
    ...week('2026-08-17'), ...week('2026-08-24'),
    // 31 Aug is the protected vacation week.
    ...week('2026-09-07'),
  }
  const result = trainingRhythm(minutes, '2026-09-13')
  assert.equal(result.streakWeeks, 7)
  assert.equal(result.keepers, 0)
  assert.deepEqual(result.protectedWeeks, ['2026-08-31'])
  assert.equal(result.keeperProgress, 1)
})

test('an unfinished current week never consumes a keeper', () => {
  const minutes = {
    ...week('2026-08-03'), ...week('2026-08-10'), ...week('2026-08-17'),
    ...week('2026-08-24'), ...week('2026-08-31'),
  }
  const result = trainingRhythm(minutes, '2026-09-09')
  assert.equal(result.streakWeeks, 5)
  assert.equal(result.keepers, 1)
})


test('an away week protects an existing rhythm without earning keeper progress', () => {
  const minutes = {
    ...week('2026-08-03'),
    ...week('2026-08-17'),
  }
  const result = trainingRhythm(minutes, '2026-08-23', {
    awayPeriods: [{ start: '2026-08-11', end: '2026-08-13' }],
  })
  assert.equal(result.streakWeeks, 3)
  assert.equal(result.keeperProgress, 2)
  assert.equal(result.keepers, 0)
  assert.deepEqual(result.awayProtectedWeeks, ['2026-08-10'])
})

test('training four qualifying days still makes an away week strong', () => {
  const result = trainingRhythm({
    ...week('2026-08-03'),
    ...week('2026-08-10'),
  }, '2026-08-16', {
    awayPeriods: [{ start: '2026-08-11', end: '2026-08-13' }],
  })
  assert.equal(result.streakWeeks, 2)
  assert.equal(result.keeperProgress, 2)
  assert.deepEqual(result.awayProtectedWeeks, [])
})

test('away time never invents a streak or a qualifying workout day', () => {
  const result = trainingRhythm({}, '2026-08-16', {
    awayPeriods: [{ start: '2026-08-10', end: '2026-08-16' }],
  })
  assert.equal(result.streakWeeks, 0)
  assert.deepEqual(result.qualifyingDates, [])
  assert.deepEqual(result.trainedDates, [])
})

test('R11.1: six working sets qualify a short micro-set day', () => {
  const rhythm = trainingRhythm({ '2026-09-21': 8, '2026-09-22': 12, '2026-09-23': 40 }, '2026-09-24', {
    setsByDate: { '2026-09-21': 20, '2026-09-22': 4, '2026-09-23': 9 },
  })
  assert.deepEqual(rhythm.qualifyingDates, ['2026-09-21', '2026-09-23'])
  assert.equal(rhythm.minimumSets, 6)
})
