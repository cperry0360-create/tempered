import test from 'node:test'
import assert from 'node:assert/strict'
import { calorieLogQuality, calorieQualitySummary } from './nutrition-quality.js'

test('excludes current, explicitly partial, and implausibly low calorie days', () => {
  const options = { today: '2026-09-14', goal: 2100 }
  assert.equal(calorieLogQuality({ date: '2026-09-14', calories: 1900 }, options).state, 'in-progress')
  assert.equal(calorieLogQuality({ date: '2026-09-13', calories: 1900, nutritionStatus: 'partial' }, options).include, false)
  assert.equal(calorieLogQuality({ date: '2026-09-12', calories: 400 }, options).state, 'review')
})

test('includes complete and credible legacy days', () => {
  const result = calorieQualitySummary([
    { date: '2026-09-12', calories: 1800 },
    { date: '2026-09-13', calories: 300, nutritionStatus: 'complete' },
  ], { today: '2026-09-14', goal: 2100 })
  assert.equal(result.included.length, 2)
})
