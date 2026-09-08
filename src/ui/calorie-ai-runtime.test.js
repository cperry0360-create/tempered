import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALORIE_PHOTO_PROMPT, parseTemperedCalories } from './calorie-ai-runtime.js'

test('calorie photo prompt demands a one-click-copy machine-readable result', () => {
  assert.match(CALORIE_PHOTO_PROMPT, /TEMPERED_CALORIES=<whole-number calories>/)
  assert.match(CALORIE_PHOTO_PROMPT, /Markdown fenced code block/i)
  assert.match(CALORIE_PHOTO_PROMPT, /one-tap Copy button/i)
})

test('parses tagged and fenced AI results', () => {
  assert.equal(parseTemperedCalories('TEMPERED_CALORIES=642'), 642)
  assert.equal(parseTemperedCalories('tempered_calories: 1100'), 1100)
  assert.equal(parseTemperedCalories('```\nTEMPERED_CALORIES=642\n```'), 642)
  assert.equal(parseTemperedCalories('```\nTEMPERED_CALORIES=0\n```'), 0)
})

test('accepts a bare calorie number but rejects prose and ranges', () => {
  assert.equal(parseTemperedCalories('725'), 725)
  assert.equal(parseTemperedCalories('725 kcal'), 725)
  assert.equal(parseTemperedCalories('about 725 calories'), null)
  assert.equal(parseTemperedCalories('600-800'), null)
})
