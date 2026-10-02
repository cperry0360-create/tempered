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

test('food library: every distinct food, top three by count, the rest most recent first', async () => {
  const { foodLibrary } = await import('./nutrition.js')
  let days = []
  const log = (date, description, calories, protein, n = 1) => {
    for (let i = 0; i < n; i += 1) {
      const day = days.find((d) => d.date === date) ?? { date }
      days = days.filter((d) => d.date !== date)
      days.push(addNutritionEntry(day, { description, calories, protein }, {
        id: `${description}-${date}-${i}`, loggedAt: `${date}T0${i}:00:00.000Z`, source: 'manual' }))
    }
  }
  log('2026-09-01', 'Protein shake', 150, 30, 3)
  log('2026-09-02', 'Chicken rice bowl', 640, 42, 2)
  log('2026-09-03', 'Greek yogurt', 180, 20, 2)
  log('2026-09-04', 'Whiskey shot', 100, 0, 1)
  log('2026-09-05', 'Turkey sandwich', 740, 38, 1)
  const library = foodLibrary(days)
  assert.deepEqual(library.top.map((f) => f.description), ['Protein shake', 'Greek yogurt', 'Chicken rice bowl'])
  assert.deepEqual(library.rest.map((f) => f.description), ['Turkey sandwich', 'Whiskey shot'])
  assert.equal(library.all.length, 5)
})

test('food search matches every word, any order, ignoring case', async () => {
  const { searchFoods } = await import('./nutrition.js')
  const foods = [
    { description: 'fairlife Core Power chocolate protein shake', count: 10 },
    { description: 'Chicken rice bowl', count: 2 },
    { description: 'Protein bar, chocolate peanut', count: 4 },
  ]
  assert.deepEqual(searchFoods(foods, 'choc protein').map((f) => f.count), [10, 4])
  assert.deepEqual(searchFoods(foods, 'BOWL').map((f) => f.description), ['Chicken rice bowl'])
  assert.equal(searchFoods(foods, '  ').length, 3)
  assert.equal(searchFoods(foods, 'pizza').length, 0)
})

test('a portion scales the saved food and is remembered on the entry', () => {
  const day = addNutritionEntry({ date: '2026-10-02' }, { description: 'Protein shake', calories: 150, protein: 30, portion: 2 },
    { id: 'p2', loggedAt: '2026-10-02T10:00:00.000Z', source: 'manual' })
  const [entry] = nutritionLedger(day).entries
  assert.equal(entry.calories, 300); assert.equal(entry.proteinGrams, 60); assert.equal(entry.portion, 2)
  assert.equal(day.calories, 300)
  const half = addNutritionEntry({ date: '2026-10-02' }, { description: 'Chicken rice bowl', calories: 640, protein: 42, portion: 0.5 },
    { id: 'h', loggedAt: '2026-10-02T12:00:00.000Z', source: 'manual' })
  assert.equal(nutritionLedger(half).entries[0].calories, 320)
  const plain = addNutritionEntry({ date: '2026-10-02' }, { description: 'Greek yogurt', calories: 180 }, { id: 'g', loggedAt: '2026-10-02T09:00:00.000Z', source: 'manual' })
  assert.equal('portion' in nutritionLedger(plain).entries[0], false)
})

test('portions group with the single-serving food in suggestions', () => {
  const one = addNutritionEntry({ date: '2026-10-01' }, { description: 'Protein shake', calories: 150, protein: 30 },
    { id: 'a', loggedAt: '2026-10-01T10:00:00.000Z', source: 'manual' })
  const two = addNutritionEntry({ date: '2026-10-02' }, { description: 'Protein shake', calories: 150, protein: 30, portion: 2 },
    { id: 'b', loggedAt: '2026-10-02T10:00:00.000Z', source: 'manual' })
  const [food] = nutritionSuggestions([one, two])
  assert.equal(food.count, 2); assert.equal(food.calories, 150); assert.equal(food.proteinGrams, 30)
})
