import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dailyHabitProgress, weeklyHabitActionable,
} from '../src/ui/screens/today.js'

test('daily progress excludes unfinished and completed weekly/biweekly activities', () => {
  const daily = [
    { id: 'sleep', cadence: 'daily', logged: true, value: 8, dailyCap: 7 },
    { id: 'steps', cadence: 'daily', logged: false, value: 1500, dailyCap: 8000 },
    { id: 'sauna', cadence: 'weekly', logged: false, complete: false, weeklyDone: 0, weeklyTarget: 1 },
    { id: 'journal', cadence: 'weekly', logged: true, complete: true, weeklyDone: 2, weeklyTarget: 2 },
    { id: 'waist_measurement', cadence: 'biweekly', logged: false, complete: false },
    { id: 'calories_logged', cadence: 'daily', logged: false, dailyCap: 2000 },
    { id: 'protein_target', cadence: 'daily', logged: false, dailyCap: 120 },
    { id: 'mobility', cadence: 'off', logged: false },
  ]
  assert.deepEqual(dailyHabitProgress(daily), { done: 1, total: 2 })
  assert.deepEqual(dailyHabitProgress(daily.map(a =>
    a.id === 'steps' ? { ...a, logged: true, value: 9000 } : a)), { done: 2, total: 2 })
  assert.deepEqual(dailyHabitProgress([]), { done: 0, total: 0 })
})

test('weekly one-of-one vanishes after logging and stays retired for that period', () => {
  const pending = { cadence: 'weekly', weeklyTarget: 1, weeklyDone: 0, complete: false, loggedToday: false }
  assert.equal(weeklyHabitActionable(pending), true)
  assert.equal(weeklyHabitActionable({ ...pending, weeklyDone: 1, complete: true, loggedToday: true }), false)
  assert.equal(weeklyHabitActionable({ ...pending, weeklyDone: 1, complete: true, loggedToday: false }), false)
  // A fresh Monday has a new period and reopens the goal.
  assert.equal(weeklyHabitActionable({ ...pending }), true)
})

test('weekly two-of-two requires two distinct days, never duplicate taps today', () => {
  const pending = { cadence: 'weekly', weeklyTarget: 2, weeklyDone: 0, complete: false, loggedToday: false }
  assert.equal(weeklyHabitActionable(pending), true)
  assert.equal(weeklyHabitActionable({ ...pending, weeklyDone: 1, loggedToday: true }), false)
  assert.equal(weeklyHabitActionable({ ...pending, weeklyDone: 1, loggedToday: false }), true)
  assert.equal(weeklyHabitActionable({ ...pending, weeklyDone: 2, complete: true }), false)
})

test('biweekly measurements also retire until their tracking period renews', () => {
  assert.equal(weeklyHabitActionable({ cadence: 'biweekly', weeklyDone: 0, complete: false, loggedToday: false }), true)
  assert.equal(weeklyHabitActionable({ cadence: 'biweekly', weeklyDone: 1, complete: true, loggedToday: false }), false)
  assert.equal(weeklyHabitActionable({ cadence: 'daily', complete: false, loggedToday: false }), false)
  assert.equal(weeklyHabitActionable(null), false)
})
