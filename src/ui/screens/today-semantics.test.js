import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dailyGoalComplete, staysEditableAfterComplete } from './today.js'

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
