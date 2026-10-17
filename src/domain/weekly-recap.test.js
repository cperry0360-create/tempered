import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weeklyRecap, previousWeek } from './weekly-recap.js'
import { trainingScore } from './training-score.js'

const input = {
  today: '2026-10-12', trackingStartedOn: '2026-10-01',
  sessions: [{ id: 's', date: '2026-10-05', endedAt: 'done', durationMinutes: 32 }, { id: 'open', date: '2026-10-06' }, { id: 'new', date: '2026-10-12', endedAt: 'done' }],
  setLogs: [{ sessionId: 's', exerciseId: 'x', weight: 100, reps: 8 }, { sessionId: 's', isWarmup: true, weight: 50, reps: 8 }, { sessionId: 'open', weight: 100, reps: 8 }, { sessionId: 'new', weight: 100, reps: 8 }],
  dayLogs: [{ date: '2026-10-05', sleepHours: 8, steps: 6000, proteinGrams: 120, calories: 2000, waterOz: 64, restDay: true }, { date: '2026-10-06', sleepHours: 6, steps: 0 }, { date: '2026-10-12', sleepHours: 2, steps: 100 }],
}
test('weekly window follows local Monday reset, including Sunday and year boundaries', () => {
  assert.deepEqual(previousWeek('2026-10-12'), { start: '2026-10-05', end: '2026-10-11', reset: '2026-10-12' })
  assert.equal(previousWeek('2026-10-18').start, '2026-10-05')
  assert.deepEqual(previousWeek('2026-01-01'), { start: '2025-12-22', end: '2025-12-28', reset: '2025-12-29' })
})
test('only finished prior-week work contributes, never warmups or the current week', () => {
  const report = weeklyRecap(input)
  assert.deepEqual(report.training, { sessions: 1, days: 1, sets: 1, minutes: 32, volume: 800 })
})
test('partial health and nutrition coverage preserves zero and reports sample days', () => {
  const report = weeklyRecap(input)
  assert.deepEqual(report.signals.steps, { total: 6000, average: 3000, days: 2 })
  assert.deepEqual(report.signals.sleepHours, { total: 14, average: 7, days: 2 })
  assert.equal(report.signals.calories.average, 2000)
  assert.equal(report.signals.calories.days, 1)
  assert.equal(report.signals.waterOz.average, 64)
  assert.equal(report.restDays, 1)
  assert.equal(report.signals.hrvMs, undefined)
})
test('weekly score is exactly the corresponding Progress week and is never borrowed from an older headline', () => {
  const scored = { ...input, programs: [{ id: 'p', weeks: 8, days: [{ id: 'monday', exercises: [{ exerciseId: 'x', sets: 1, repMin: 8 }] }] }], programStates: [{ programId: 'p', startedOn: '2026-09-28', active: true }] }
  const report = weeklyRecap(scored)
  const week = trainingScore(scored).weeks.find((week) => week.week === report.start)
  assert.equal(report.score.score, week.score)
  assert.deepEqual(report.score.components, week.components)
  const away = weeklyRecap({ ...scored, awayPeriods: [{ start: '2026-10-05', end: '2026-10-11' }] })
  assert.equal(away.score.score, null)
  assert.equal(away.score.away, true)
  assert.match(away.explanation.join(' '), /away/i)
})
test('new users have no automatic recap; existing quiet weeks remain honest', () => {
  const fresh = weeklyRecap({ today: '2026-10-12', trackingStartedOn: '2026-10-12' })
  assert.equal(fresh.eligible, false)
  const quiet = weeklyRecap({ today: '2026-10-12', trackingStartedOn: '2026-09-01' })
  assert.equal(quiet.eligible, true)
  assert.equal(quiet.training.sessions, 0)
  assert.deepEqual(quiet.signals, {})
  assert.equal(quiet.score.score, null)
})
test('acknowledgment suppresses repeats and clock rollback; next reset permits the next recap', () => {
  assert.equal(weeklyRecap({ ...input, lastSeenWeek: '2026-10-05' }).eligible, false)
  assert.equal(weeklyRecap({ ...input, lastSeenWeek: '2026-10-12' }).eligible, false)
  assert.equal(weeklyRecap({ ...input, today: '2026-10-19', lastSeenWeek: '2026-10-05' }).eligible, true)
})

test('recorded cardio totals minutes and miles without inferring either from the other', () => {
  const report = weeklyRecap({ ...input, dayLogs: [{ date: '2026-10-05', cardio: [{ minutes: 30, distanceMiles: 3 }, { distanceMiles: 1 }] }] })
  assert.equal(report.signals.cardioMinutes.total, 30)
  assert.equal(report.signals.cardioMiles.total, 4)
})

test('empty Fuel placeholders are not a logged nutrition day, while an explicitly logged zero is', () => {
  const report = weeklyRecap({ ...input, dayLogs: [{ date: '2026-10-05', calories: 0, proteinGrams: 0 }, { date: '2026-10-06', calories: 0, proteinGrams: 0, nutritionLogged: true }] })
  assert.deepEqual(report.signals.calories, { total: 0, average: 0, days: 1 })
  assert.equal(report.signals.proteinGrams.days, 1)
})
