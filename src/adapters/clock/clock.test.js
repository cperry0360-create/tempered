import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toLocalDate, daysBetween, fixedClock, systemClock } from './clock.js'

test('a workout at 11pm belongs to that day, not the next', () => {
  // docs/02: dates are calendar-local, never UTC. toISOString() would report
  // the 5th for this instant in any negative UTC offset.
  const lateNight = new Date(2026, 8, 4, 23, 30, 0)
  assert.equal(toLocalDate(lateNight), '2026-09-04')
})

test('a workout just after midnight belongs to the new day', () => {
  assert.equal(toLocalDate(new Date(2026, 8, 5, 0, 15, 0)), '2026-09-05')
})

test('local dates are zero-padded', () => {
  assert.equal(toLocalDate(new Date(2026, 0, 5)), '2026-01-05')
})

test('daysBetween counts calendar days', () => {
  assert.equal(daysBetween('2026-09-04', '2026-09-04'), 0)
  assert.equal(daysBetween('2026-09-04', '2026-09-05'), 1)
  assert.equal(daysBetween('2026-09-01', '2026-09-08'), 7)
})

test('daysBetween crosses months and years', () => {
  assert.equal(daysBetween('2026-08-31', '2026-09-01'), 1)
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1)
})

test('daysBetween is unaffected by daylight saving', () => {
  // A 23-hour and a 25-hour day must both count as one day.
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2)
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2)
})

test('a fixed clock does not move on its own', () => {
  const clock = fixedClock('2026-09-04T18:00:00Z')
  const first = clock.now()
  assert.equal(clock.now(), first)
  assert.equal(clock.today(), clock.today())
})

test('a fixed clock can be advanced by whole days', () => {
  const clock = fixedClock(new Date(2026, 8, 4, 12, 0, 0))
  assert.equal(clock.today(), '2026-09-04')
  clock.advanceDays(5)
  assert.equal(clock.today(), '2026-09-09')
})

test('the system clock reports a well-formed local date', () => {
  assert.match(systemClock().today(), /^\d{4}-\d{2}-\d{2}$/)
})
