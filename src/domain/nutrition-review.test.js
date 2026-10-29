import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayBefore, nutritionDayStatus, openNutritionDates } from './nutrition-review.js'

test('reviewing a diary is independent of hitting a calorie target', () => {
  const today = '2026-10-29'
  assert.equal(nutritionDayStatus({ calories: 2500, nutritionStatus: 'complete' },
    '2026-10-28', '2026-10-26', today), 'closed')
  assert.equal(nutritionDayStatus({ calories: 1400 }, '2026-10-28', '2026-10-26', today), 'open')
  assert.equal(nutritionDayStatus({ calories: 0 }, '2026-10-28', '2026-10-26', today), 'open')
  assert.equal(nutritionDayStatus({}, '2026-10-28', '2026-10-26', today), 'unlogged')
  assert.equal(nutritionDayStatus({}, '2026-10-25', '2026-10-26', today), 'outside')
  assert.equal(nutritionDayStatus({}, today, '2026-10-26', today), 'unlogged')
  assert.equal(nutritionDayStatus({}, '2026-10-30', '2026-10-26', today), 'outside')
})

test('open backlog persists until each day is explicitly closed', () => {
  const days = [
    { date: '2026-10-26', nutritionStatus: 'complete', calories: 2600 },
    { date: '2026-10-27', nutritionEntries: [{ id: 'a' }], calories: 1300 },
  ]
  const review = openNutritionDates(days, '2026-10-29', '2026-10-26')
  assert.deepEqual(review.map((day) => day.date), ['2026-10-28', '2026-10-27'])
  assert.equal(review[0].status, 'unlogged')
  assert.equal(review[1].status, 'open')
  days.push({ date: '2026-10-28', nutritionStatus: 'complete' })
  days[1].nutritionStatus = 'complete'
  assert.deepEqual(openNutritionDates(days, '2026-10-29', '2026-10-26'), [])
})

test('old unclosed food entries remain reviewable without retroactively flagging empty historical days', () => {
  const backlog = openNutritionDates([
    { date: '2026-09-01', calories: 800 },
    { date: '2026-10-28', nutritionStatus: 'complete' },
  ], '2026-10-29', '2026-10-28')
  assert.deepEqual(backlog.map((x) => x.date), ['2026-09-01'])
  assert.equal(dayBefore('2026-03-01'), '2026-02-28')
})
