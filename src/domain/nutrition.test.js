import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addNutritionEntry, nutritionLedger, nutritionSuggestions, removeNutritionEntry, restoreNutritionEntry,
} from './nutrition.js'

const meal = {
  description: 'Chicken rice bowl', calories: 642, protein: 42, carbs: 61, fat: 24, fiber: 9,
}
const meta = { id: 'meal-1', loggedAt: '2026-09-09T17:43:00.000Z', source: 'ai' }

test('the first itemized meal preserves legacy calorie and protein totals as carryover', () => {
  const day = addNutritionEntry({
    date: '2026-09-09', calories: 400, proteinGrams: 30,
    caloriesLogged: true, nutritionLogged: true,
  }, meal, meta)

  assert.deepEqual(day.nutritionCarryover, {
    calories: 400, proteinGrams: 30, logged: true, caloriesTracked: true,
  })
  assert.equal(day.calories, 1042)
  assert.equal(day.proteinGrams, 72)
  assert.equal(day.carbsGrams, 61)
  assert.equal(day.fatGrams, 24)
  assert.equal(day.fiberGrams, 9)
  assert.equal(day.nutritionEntries[0].source, 'ai')
  assert.equal(day.nutritionEntries[0].description, 'Chicken rice bowl')
})

test('itemized totals do not double-count their aggregate mirrors on the next meal', () => {
  const first = addNutritionEntry({ date: '2026-09-09' }, meal, meta)
  const second = addNutritionEntry(first, { calories: 300, protein: 20 }, {
    id: 'meal-2', loggedAt: '2026-09-09T20:00:00.000Z', source: 'manual',
  })
  const ledger = nutritionLedger(second)
  assert.equal(ledger.entries.length, 2)
  assert.equal(ledger.totals.calories, 942)
  assert.equal(ledger.totals.protein, 62)
})

test('removing and restoring a meal recalculates totals without discarding its timestamp', () => {
  const logged = addNutritionEntry({ date: '2026-09-09', calories: 100 }, meal, meta)
  const removed = removeNutritionEntry(logged, 'meal-1')
  assert.equal(removed.calories, 100)
  assert.equal(removed.proteinGrams, undefined)
  assert.equal(removed.nutritionEntries.length, 0)

  const restored = restoreNutritionEntry(removed, logged.nutritionEntries[0], 0)
  assert.equal(restored.calories, 742)
  assert.equal(restored.proteinGrams, 42)
  assert.equal(restored.nutritionEntries[0].loggedAt, meta.loggedAt)
})

test('a meal needs at least one positive nutrient value', () => {
  assert.throws(() => addNutritionEntry({ date: '2026-09-09' }, {
    calories: '', protein: 0, carbs: -1,
  }, meta), /at least one nutrition value/)
})

test('quick-log suggestions rank repeated meals before merely recent meals', () => {
  const first = addNutritionEntry({ date: '2026-09-08' }, meal, meta)
  const second = addNutritionEntry({ date: '2026-09-09' }, meal, {
    id: 'meal-2', loggedAt: '2026-09-09T08:00:00.000Z', source: 'manual',
  })
  const recent = addNutritionEntry({ date: '2026-09-10' }, {
    description: 'Greek yogurt', calories: 180, protein: 20,
  }, { id: 'meal-3', loggedAt: '2026-09-10T09:00:00.000Z', source: 'manual' })
  const suggestions = nutritionSuggestions([first, second, recent])
  assert.equal(suggestions[0].description, 'Chicken rice bowl')
  assert.equal(suggestions[0].count, 2)
  assert.equal(suggestions[1].description, 'Greek yogurt')
})
