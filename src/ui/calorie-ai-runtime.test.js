import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALORIE_PHOTO_PROMPT, parseTemperedCalories } from './calorie-ai-runtime.js'

test('calorie photo prompt demands a single machine-readable result', () => {
  assert.match(CALORIE_PHOTO_PROMPT, /TEMPERED_CALORIES=<whole-number calories>/)
  assert.match(CALORIE_PHOTO_PROMPT, /Return exactly one line/)
})

test('parses the tagged AI result', () => {
  assert.equal(parseTemperedCalories('TEMPERED_CALORIES=642'), 642)
  assert.equal(parseTemperedCalories('tempered_calories: 1100'), 1100)
})

test('accepts a bare calorie number but rejects prose and ranges', () => {
  assert.equal(parseTemperedCalories('725'), 725)
  assert.equal(parseTemperedCalories('725 kcal'), 725)
  assert.equal(parseTemperedCalories('about 725 calories'), null)
  assert.equal(parseTemperedCalories('600-800'), null)
})
