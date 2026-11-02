import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOBILITY_ROUTINES, dailyGoalComplete, averageSleepForWeek, staysEditableAfterComplete } from './today.js'

test('calories complete on logging, not on reaching the calorie target', () => {
  assert.equal(dailyGoalComplete({ id: 'calories_logged', logged: false, value: 0, dailyCap: 2200 }), false)
  assert.equal(dailyGoalComplete({ id: 'calories_logged', logged: true, value: 500, dailyCap: 2200 }), true)
  assert.equal(dailyGoalComplete({ id: 'calories_logged', logged: true, value: 2600, dailyCap: 2200 }), true)
})

test('true goal trackers still complete only at their goal', () => {
  assert.equal(dailyGoalComplete({ id: 'water', logged: true, value: 8, dailyCap: 120 }), false)
  assert.equal(dailyGoalComplete({ id: 'water', logged: true, value: 120, dailyCap: 120 }), true)
})

test('additive numeric trackers stay editable after completion', () => {
  assert.equal(staysEditableAfterComplete({ spec: { entry: 'number', mode: 'add' } }), true)
  assert.equal(staysEditableAfterComplete({ spec: { entry: 'number', mode: 'replace' } }), false)
  assert.equal(staysEditableAfterComplete({ spec: { entry: 'mark' } }), false)
})

test('mobility offers four short, distinct routines with a usable flow', () => {
  assert.equal(MOBILITY_ROUTINES.length, 4)
  assert.deepEqual(MOBILITY_ROUTINES.map((routine) => routine.minutes), [5, 8, 10, 12])
  assert.ok(MOBILITY_ROUTINES.every((routine) => routine.moves.length === 3))
})

test('weekly sleep average excludes empty, zero, out-of-week and invalid readings', () => {
  const logs = [
    { date: '2026-11-02', sleepHours: 8.1 },
    { date: '2026-11-03', sleepHours: 7.7 },
    { date: '2026-11-04', sleepHours: 0 },
    { date: '2026-11-05' },
    { date: '2026-10-31', sleepHours: 3 },
    { date: '2026-11-06', sleepHours: 27 },
  ]
  assert.deepEqual(averageSleepForWeek(logs, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']),
    { average: 7.9, nights: 2 })
  assert.deepEqual(averageSleepForWeek(logs, ['2026-11-07']), { average: null, nights: 0 })
})
