import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CALORIE_PHOTO_PROMPT,
  NUTRITION_PHOTO_PROMPT,
  parseTemperedCalories,
  parseTemperedNutrition,
} from './calorie-ai-runtime.js'

test('nutrition photo prompt asks for a copy-button code block with calories and macros', () => {
  assert.equal(CALORIE_PHOTO_PROMPT, NUTRITION_PHOTO_PROMPT)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_DESCRIPTION=<brief plain-language meal description>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_CALORIES=<whole-number calories>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_PROTEIN=<grams of protein>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_CARBS=<grams of carbohydrates>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_FAT=<grams of fat>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /TEMPERED_FIBER=<grams of fiber>/)
  assert.match(NUTRITION_PHOTO_PROMPT, /exactly ONE fenced code block/i)
})

test('parses calories and macros from a fenced or plain AI result', () => {
  assert.deepEqual(
    parseTemperedNutrition('```text\nTEMPERED_DESCRIPTION=Chicken rice bowl with avocado\nTEMPERED_CALORIES=642\nTEMPERED_PROTEIN=42\nTEMPERED_CARBS=61\nTEMPERED_FAT=24\nTEMPERED_FIBER=9\n```'),
    { description: 'Chicken rice bowl with avocado', calories: 642, protein: 42, carbs: 61, fat: 24, fiber: 9 },
  )
  assert.deepEqual(
    parseTemperedNutrition('TEMPERED_PROTEIN: 31\nTEMPERED_CALORIES: 510'),
    { description: null, calories: 510, protein: 31, carbs: null, fat: null, fiber: null },
  )
})

test('keeps calorie-only backwards compatibility', () => {
  assert.equal(parseTemperedCalories('TEMPERED_CALORIES=642'), 642)
  assert.equal(parseTemperedCalories('725'), 725)
  assert.equal(parseTemperedCalories('725 kcal'), 725)
  assert.equal(parseTemperedCalories('about 725 calories'), null)
  assert.equal(parseTemperedCalories('600-800'), null)
})
