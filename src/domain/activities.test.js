/**
 * The activity model — Phase 4 plus the cadence correction.
 *
 * Rules under test:
 *   - if an activity can be measured, it must not be a checkbox
 *   - a body metric's VALUE is never scored, in any direction, ever
 *   - rest is a rewarded action, not an absence
 *   - outstanding is sorted by what is likely next, never alphabetically
 *   - seed defaults are only a starting cadence; the user's schedule owns Today
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import {
  ACTIVITY_FIELDS, applyActivity, activityValue, isLogged, splitActivities, sortActivities,
  defaultDailyIds, partitionByDaily,
} from './activities.js'
import { awardsForDay, totalsByAttribute } from './xp-engine.js'

const balance = loadBalance()
const seed = JSON.parse(readFileSync(new URL('../../data/activities.json', import.meta.url), 'utf8'))
const ACTIVITIES = seed.activities
const byId = (id) => ACTIVITIES.find((activity) => activity.id === id)

test('every seeded activity is mapped to a day-log field', () => {
  const unmapped = ACTIVITIES.filter((activity) => !ACTIVITY_FIELDS[activity.id])
  assert.deepEqual(unmapped.map((a) => a.id), [],
    'an activity the user can see but the engine cannot score is a dead control')
})

test('every mapped field is one the XP engine actually reads', () => {
  const engineFields = new Set([
    'sleepHours', 'waterOz', 'steps', 'microCardioMinutes', 'mobilityMinutes', 'readingMinutes', 'studyMinutes',
    'meditationMinutes', 'instrumentMinutes', 'journalLogged', 'nutritionLogged',
    'caloriesLogged', 'alcoholFree', 'saunaLogged', 'proteinTargetMet', 'restDay',
    'bodyMetricsLogged',
  ])
  for (const [id, spec] of Object.entries(ACTIVITY_FIELDS)) {
    const scoredField = spec.scoredField ?? spec.trackedField ?? spec.field
    assert.ok(engineFields.has(scoredField),
      `${id} resolves to ${scoredField}, which nothing scores`)
  }
})

test('a marked activity logs with no value at all', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'rest_day', null)
  assert.equal(day.restDay, true)
  assert.equal(isLogged(byId('rest_day'), day), true)
})

test('REST IS REWARDED: a rest day on its own earns Vitality', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'rest_day', null)
  const totals = totalsByAttribute(awardsForDay(day, {}, balance))
  assert.equal(totals.vitality, balance.vitality.restDayXp)
  assert.ok(totals.vitality > 0, 'rest is an action, not an absence')
})

test('a measured activity stores the number it was given', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'sleep', 8)
  assert.equal(day.sleepHours, 8)
  assert.equal(activityValue(byId('sleep'), day), 8)
})

test('a value that accumulates adds to the day rather than replacing it', () => {
  let day = applyActivity({ date: '2026-09-04' }, 'water', 16)
  day = applyActivity(day, 'water', 16)
  assert.equal(day.waterOz, 32)

  let minutes = applyActivity({ date: '2026-09-04' }, 'read', 20)
  minutes = applyActivity(minutes, 'read', 10)
  assert.equal(minutes.readingMinutes, 30)
})

test('micro cardio accumulates and earns Wind without creating a workout session', () => {
  let day = applyActivity({ date: '2026-09-04' }, 'micro_cardio', 2)
  day = applyActivity(day, 'micro_cardio', 2)
  assert.equal(day.microCardioMinutes, 4)
  const totals = totalsByAttribute(awardsForDay(day, {}, balance))
  assert.ok(totals.wind > 0)
  assert.equal(totals.grit, 0)
})

test('a value that describes a state replaces it', () => {
  let day = applyActivity({ date: '2026-09-04' }, 'sleep', 7)
  day = applyActivity(day, 'sleep', 8)
  assert.equal(day.sleepHours, 8)

  let steps = applyActivity({ date: '2026-09-04' }, 'steps', 4000)
  steps = applyActivity(steps, 'steps', 9000)
  assert.equal(steps.steps, 9000, 'a step count is a total already, not an increment')
})

test('applying an activity never mutates the day it was given', () => {
  const before = { date: '2026-09-04', waterOz: 16 }
  const after = applyActivity(before, 'water', 16)
  assert.equal(before.waterOz, 16)
  assert.equal(after.waterOz, 32)
  assert.notEqual(before, after)
})

test('a non-numeric or negative entry does not corrupt the day', () => {
  const day = applyActivity({ date: '2026-09-04', sleepHours: 8 }, 'sleep', Number.NaN)
  assert.equal(day.sleepHours, 8, 'garbage in leaves the last good value alone')
  const negative = applyActivity({ date: '2026-09-04' }, 'water', -20)
  assert.ok((negative.waterOz ?? 0) >= 0, 'nothing in this app subtracts')
})

// --- the hard rule ---------------------------------------------------------

test('HARD RULE: a body metric records the number and scores only the act', () => {
  const light = applyActivity({ date: '2026-09-04' }, 'body_metrics', 150)
  const heavy = applyActivity({ date: '2026-09-04' }, 'body_metrics', 250)

  assert.equal(light.bodyMetrics.weight, 150)
  assert.equal(heavy.bodyMetrics.weight, 250)
  assert.equal(activityValue(byId('body_metrics'), heavy), true,
    'the domain sees the act of logging, and not the reading')

  assert.equal(light.bodyMetricsLogged, true)
  const lightXp = totalsByAttribute(awardsForDay(light, {}, balance))
  const heavyXp = totalsByAttribute(awardsForDay(heavy, {}, balance))
  assert.deepEqual(lightXp, heavyXp, 'the weight value must never move XP in any direction')
  assert.equal(lightXp.vitality, balance.vitality.bodyMetricsLoggedXp)
})

test('HARD RULE: a body metric writes nothing else the engine can read', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'body_metrics', 184.2)
  const scoring = Object.keys(day).filter((key) => key !== 'date' && key !== 'bodyMetrics')
  assert.deepEqual(scoring, ['bodyMetricsLogged'],
    'the only scoring field a body metric may touch is the boolean act of logging')
})

test('HARD RULE: losing weight and gaining weight are worth exactly the same', () => {
  const down = applyActivity({ date: '2026-09-04', bodyMetrics: { weight: 200 } }, 'body_metrics', 190)
  const up = applyActivity({ date: '2026-09-04', bodyMetrics: { weight: 200 } }, 'body_metrics', 210)
  assert.deepEqual(
    totalsByAttribute(awardsForDay(down, {}, balance)),
    totalsByAttribute(awardsForDay(up, {}, balance)),
    'direction is not scored either',
  )
})

// --- the outstanding list --------------------------------------------------

test('an activity moves from outstanding to logged once it carries a value', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'sleep', 8)
  const { outstanding, logged } = splitActivities(ACTIVITIES, day)
  assert.equal(logged.length, 1)
  assert.equal(logged[0].id, 'sleep')
  assert.equal(outstanding.length, ACTIVITIES.length - 1)
  assert.ok(!outstanding.some((a) => a.id === 'sleep'))
})

test('a zero is a logged value, not an empty one', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'steps', 0)
  assert.equal(isLogged(byId('steps'), day), true, '0 steps is a thing you told the app')
})

test('outstanding is sorted by what is likely next, never alphabetically', () => {
  const order = sortActivities(ACTIVITIES).map((a) => a.id)
  const alphabetical = [...ACTIVITIES].map((a) => a.name).sort()
  assert.notDeepEqual(sortActivities(ACTIVITIES).map((a) => a.name), alphabetical)
  assert.equal(order[0], 'sleep', 'a day starts with the night before it')
  assert.ok(order.indexOf('rest_day') < order.indexOf('journal'), 'rest remains easy to find')
})

test('sorting is stable across calls and does not mutate its input', () => {
  const input = [...ACTIVITIES]
  const first = sortActivities(input).map((a) => a.id)
  const second = sortActivities(input).map((a) => a.id)
  assert.deepEqual(first, second)
  assert.deepEqual(input.map((a) => a.id), ACTIVITIES.map((a) => a.id))
})

test('every activity states how it is entered, so no screen has to guess', () => {
  for (const activity of ACTIVITIES) {
    const spec = ACTIVITY_FIELDS[activity.id]
    assert.ok(spec.entry === 'mark' || spec.entry === 'number', `${activity.id} has no entry mode`)
    if (spec.entry === 'number') {
      assert.ok(spec.mode === 'add' || spec.mode === 'replace', `${activity.id} has no update mode`)
    }
  }
})

// --- the seed daily list ---------------------------------------------------
// The seed is only a starting point. Phase 7 persists the user's actual cadence
// as OFF / DAILY / WEEKLY, and Today obeys that schedule.

test('the seed starts with the intended core daily habits', () => {
  const defaults = defaultDailyIds(ACTIVITIES)
  assert.deepEqual([...defaults].sort(),
    ['sleep', 'steps', 'micro_cardio', 'nutrition_logged', 'calories_logged', 'alcohol_free', 'body_metrics'].sort(),
    'the first-run daily set should match the intended core habits')
})

test('the defaults are a minority of the catalogue, or the flag buys nothing', () => {
  assert.ok(defaultDailyIds(ACTIVITIES).length < ACTIVITIES.length / 2)
})

test('rest day is available but not forced into every day', () => {
  assert.equal(defaultDailyIds(ACTIVITIES).includes('rest_day'), false)
  assert.ok(byId('rest_day'))
})

test('the daily list partitions the catalogue, losing nothing', () => {
  const { daily, other } = partitionByDaily(ACTIVITIES, defaultDailyIds(ACTIVITIES))
  assert.equal(daily.length + other.length, ACTIVITIES.length)
  assert.deepEqual(
    [...daily, ...other].map((a) => a.id).sort(),
    ACTIVITIES.map((a) => a.id).sort(),
    'everything is still reachable, just not all in the same place',
  )
})

test('both halves keep the likely-next order', () => {
  const { daily, other } = partitionByDaily(ACTIVITIES, defaultDailyIds(ACTIVITIES))
  assert.equal(daily[0].id, 'sleep')
  assert.ok(other.map((a) => a.id).indexOf('rest_day') < other.map((a) => a.id).indexOf('journal'))
})

test('the list is the user\'s, not the seed\'s', () => {
  const { daily } = partitionByDaily(ACTIVITIES, ['read'])
  assert.deepEqual(daily.map((a) => a.id), ['read'])
})

test('an empty daily list is allowed and is not an error state', () => {
  const { daily, other } = partitionByDaily(ACTIVITIES, [])
  assert.equal(daily.length, 0)
  assert.equal(other.length, ACTIVITIES.length)
})

test('an unknown id in the list is ignored rather than inventing an activity', () => {
  const { daily } = partitionByDaily(ACTIVITIES, ['sleep', 'astral_projection'])
  assert.deepEqual(daily.map((a) => a.id), ['sleep'])
})

test('the daily flag has nothing to do with what anything is worth', () => {
  const day = applyActivity({ date: '2026-09-04' }, 'read', 30)
  const totals = totalsByAttribute(awardsForDay(day, {}, balance))
  assert.ok(totals.mind > 0, 'an activity off the daily list still earns exactly the same')
})

// --- correction semantics --------------------------------------------------

test('an explicit entry can replace an add-mode total rather than appending', () => {
  const day = applyActivity({ date: 'd' }, 'water', 8)
  const corrected = applyActivity(day, 'water', 40, { mode: 'set' })
  assert.equal(corrected.waterOz, 40, 'the correction was appended instead of applied')
})

test('without the override an add-mode activity still accumulates', () => {
  let day = applyActivity({ date: 'd' }, 'water', 8)
  day = applyActivity(day, 'water', 8)
  assert.equal(day.waterOz, 16)
})

test('a correction can lower a total, which is the case add-only could not reach', () => {
  const day = applyActivity({ date: 'd' }, 'water', 400)
  assert.equal(applyActivity(day, 'water', 40, { mode: 'set' }).waterOz, 40)
})

test('the override applies to every add-mode activity, not just water', () => {
  for (const [id, field] of [['read', 'readingMinutes'], ['study', 'studyMinutes'],
    ['meditate', 'meditationMinutes'], ['instrument', 'instrumentMinutes'],
    ['mobility', 'mobilityMinutes']]) {
    const day = applyActivity({ date: 'd' }, id, 90)
    assert.equal(applyActivity(day, id, 20, { mode: 'set' })[field], 20, `${id} did not correct`)
  }
})

test('the override cannot turn a mark into a number', () => {
  const day = applyActivity({ date: 'd' }, 'rest_day', null, { mode: 'set' })
  assert.equal(day.restDay, true)
})

test('a replace-mode activity is unaffected by the override', () => {
  const day = applyActivity({ date: 'd' }, 'sleep', 8, { mode: 'set' })
  assert.equal(day.sleepHours, 8)
  assert.equal(applyActivity(day, 'sleep', 7, { mode: 'set' }).sleepHours, 7)
})

test('a correction to zero is honoured, not read as no value', () => {
  const day = applyActivity({ date: 'd' }, 'water', 40)
  assert.equal(applyActivity(day, 'water', 0, { mode: 'set' }).waterOz, 0)
})

test('rubbish in a correction leaves the last good value alone', () => {
  const day = applyActivity({ date: 'd' }, 'water', 40)
  assert.equal(applyActivity(day, 'water', 'abc', { mode: 'set' }).waterOz, 40)
})