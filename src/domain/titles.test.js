/**
 * Titles — Phase 5.
 *
 * Written before `titles.js`. `docs/01-attributes-and-xp.md`: permanent awards
 * for crossing thresholds, flavour only, no mechanical effect. The catalogue is
 * `data/titles.json` and the conditions are written in English there, so the
 * risk this file exists to catch is a condition drifting away from the code
 * that is supposed to implement it — a title that can never be earned, or one
 * awarded for something other than what it says.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { earnedTitles, TITLE_RULES } from './titles.js'

const catalogue = JSON.parse(readFileSync(new URL('../../data/titles.json', import.meta.url), 'utf8')).titles

/** A character who has done nothing at all. */
const nothing = {
  levels: { might: 0, wind: 0, grit: 0, vitality: 0, mind: 0 },
  sessionCount: 0,
  trainingHours: 0,
  milesCovered: 0,
  inBandSleeps: 0,
  bestDeadliftLbs: 0,
  bestCarryLoadLbs: 0,
  daysSinceFirstSession: 0,
  restAfterThreeTrainingDays: false,
  returnedAfterGap: false,
}

const facts = (over = {}) => ({ ...nothing, ...over })
const idsFor = (over) => earnedTitles(facts(over), catalogue).map((title) => title.id)

test('every title in the catalogue has a rule, or it can never be earned', () => {
  const unruled = catalogue.filter((title) => !TITLE_RULES[title.id]).map((title) => title.id)
  assert.deepEqual(unruled, [], 'these are displayed as earnable and are not')
})

test('every rule names a title that exists', () => {
  const ids = new Set(catalogue.map((title) => title.id))
  const orphans = Object.keys(TITLE_RULES).filter((id) => !ids.has(id))
  assert.deepEqual(orphans, [], 'these award a title the catalogue does not have')
})

test('a character who has done nothing has earned nothing, and is not told off', () => {
  assert.deepEqual(earnedTitles(facts(), catalogue), [])
})

test('the first session earns the first title', () => {
  assert.deepEqual(idsFor({ sessionCount: 1 }), ['first_load'])
})

test('level thresholds award exactly at the level, never before', () => {
  assert.ok(!idsFor({ levels: { ...nothing.levels, might: 5 } }).includes('heavy_resistance'))
  assert.ok(idsFor({ levels: { ...nothing.levels, might: 6 } }).includes('heavy_resistance'))
  assert.ok(idsFor({ levels: { ...nothing.levels, might: 9 } }).includes('heavy_resistance'),
    'and it stays earned past the threshold')

  assert.ok(idsFor({ levels: { ...nothing.levels, mind: 5 } }).includes('quiet_mind'))
  assert.ok(idsFor({ levels: { ...nothing.levels, grit: 7 } }).includes('ironclad'))
})

test('Well-Tempered needs all five, not four and a bit', () => {
  const four = { might: 4, wind: 4, grit: 4, vitality: 4, mind: 3 }
  assert.ok(!idsFor({ levels: four }).includes('balanced'))
  assert.ok(idsFor({ levels: { ...four, mind: 4 } }).includes('balanced'))
})

test('accumulating thresholds award at the number the catalogue states', () => {
  assert.ok(!idsFor({ milesCovered: 99.9 }).includes('long_road'))
  assert.ok(idsFor({ milesCovered: 100 }).includes('long_road'))

  assert.ok(!idsFor({ trainingHours: 99 }).includes('hundred_hours'))
  assert.ok(idsFor({ trainingHours: 100 }).includes('hundred_hours'))

  assert.ok(!idsFor({ inBandSleeps: 19 }).includes('unhurried'))
  assert.ok(idsFor({ inBandSleeps: 20 }).includes('unhurried'))

  assert.ok(!idsFor({ daysSinceFirstSession: 364 }).includes('one_year'))
  assert.ok(idsFor({ daysSinceFirstSession: 365 }).includes('one_year'))
})

test('lift thresholds are the weight the catalogue names', () => {
  assert.ok(!idsFor({ bestDeadliftLbs: 314 }).includes('three_plates'))
  assert.ok(idsFor({ bestDeadliftLbs: 315 }).includes('three_plates'))
  assert.ok(!idsFor({ bestCarryLoadLbs: 199 }).includes('carried'))
  assert.ok(idsFor({ bestCarryLoadLbs: 200 }).includes('carried'))
})

test('the two behavioural titles are earned by the behaviour, not by a number', () => {
  assert.ok(idsFor({ restAfterThreeTrainingDays: true }).includes('tempered'))
  assert.ok(idsFor({ returnedAfterGap: true }).includes('returned'))
})

test('REST IS REWARDED: the title named after the app is earned by resting', () => {
  // Not by training through. If this ever inverts, the app has lost the plot.
  const title = catalogue.find((t) => t.id === 'tempered')
  assert.match(title.condition, /rest/i)
  assert.ok(!idsFor({ sessionCount: 50, trainingHours: 90 }).includes('tempered'),
    'training hard is not what earns it')
  assert.ok(idsFor({ restAfterThreeTrainingDays: true }).includes('tempered'))
})

test('a title carries what earned it, so the screen never has to guess', () => {
  const [title] = earnedTitles(facts({ sessionCount: 1 }), catalogue)
  assert.equal(title.name, 'First Load')
  assert.equal(title.condition, catalogue.find((t) => t.id === 'first_load').condition)
})

test('titles come back in catalogue order, so the list is stable as it grows', () => {
  const many = earnedTitles(facts({
    sessionCount: 1, levels: { might: 6, wind: 0, grit: 7, vitality: 0, mind: 5 },
  }), catalogue)
  const order = catalogue.map((t) => t.id)
  const positions = many.map((t) => order.indexOf(t.id))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

test('nothing is ever taken away once the facts say it was earned', () => {
  // A title is a record of something that happened. There is no un-earning it,
  // which is why the app stores an earned date rather than recomputing display.
  const earned = idsFor({ trainingHours: 100 })
  assert.ok(earned.includes('hundred_hours'))
  // The rule is a floor, not a window: more hours never removes it.
  assert.ok(idsFor({ trainingHours: 5000 }).includes('hundred_hours'))
})

test('missing facts are treated as "not yet", never as an error', () => {
  assert.deepEqual(earnedTitles({}, catalogue), [])
  assert.deepEqual(earnedTitles(undefined, catalogue), [])
  assert.deepEqual(earnedTitles(facts(), []), [])
})
