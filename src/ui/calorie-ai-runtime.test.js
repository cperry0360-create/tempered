import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CALORIE_PHOTO_PROMPT,
  NUTRITION_PHOTO_PROMPT,
  parseTemperedCalories,
  parseTemperedNutrition,
} from './calorie-ai-runtime.js'

test('nutrition photo prompt asks for a copy-button code block with both values', () => {
  assert.equal(CALORIE_PHOTO_PROMPT, NUTRITION_PHOTO_PROMPT)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_CALORIES=<whole-number calories>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_PROTEIN=<whole-number grams of protein>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /exactly ONE fenced code block/i)
})

test('parses calories and protein from a fenced or plain AI result', () => {
  assert.deepEqual(
    parseTemperedNutrition('```text\nTEMPERED_CALORIES=642\nTEMPERED_PROTEIN=42\n```'),
    { calories: 642, protein: 42 },
  )
  assert.deepEqual(
    parseTemperedNutrition('TEMPERED_PROTEIN: 31\nTEMPERED_CALORIES: 510'),
    { calories: 510, protein: 31 },
  )
})

test('keeps calorie-only backwards compatibility', () => {
  assert.equal(parseTemperedCalories('TEMPERED_CALORIES=642'), 642)
  assert.equal(parseTemperedCalories('725'), 725)
  assert.equal(parseTemperedCalories('725 kcal'), 725)
  assert.equal(parseTemperedCalories('about 725 calories'), null)
  assert.equal(parseTemperedCalories('600-800'), null)
})
