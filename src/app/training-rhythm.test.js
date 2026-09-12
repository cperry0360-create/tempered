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

test('four distinct 30-minute days make one positive rhythm week', () => {
  const result = trainingRhythm(week('2026-09-07'), '2026-09-13')
  assert.equal(result.currentWeekDays, 4)
  assert.equal(result.streakWeeks, 1)
  assert.equal(result.keeperProgress, 1)
})

test('short sessions show on totals but do not light a qualifying day', () => {
  const result = trainingRhythm({ '2026-09-07': 29, '2026-09-08': 31 }, '2026-09-09')
  assert.deepEqual(result.qualifyingDates, ['2026-09-08'])
  assert.equal(result.currentWeekDays, 1)
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
