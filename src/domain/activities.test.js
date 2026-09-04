/**
 * The activity model — Phase 4.
 *
 * Written before `activities.js`. The rules under test come from
 * `docs/01-attributes-and-xp.md` and `docs/03-screens.md`:
 *
 *   - if an activity can be measured, it must not be a checkbox
 *   - a body metric's VALUE is never scored, in any direction, ever
 *   - rest is a rewarded action, not an absence
 *   - outstanding is sorted by what is likely next, never alphabetically
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import {
  ACTIVITY_FIELDS, applyActivity, activityValue, isLogged, splitActivities, sortActivities,
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
  // Guards the other direction: a mapping typo would silently score nothing.
  const engineFields = new Set([
    'sleepHours', 'waterOz', 'steps', 'mobilityMinutes', 'readingMinutes', 'studyMinutes',
    'meditationMinutes', 'instrumentMinutes', 'journalLogged', 'nutritionLogged',
    'proteinTargetMet', 'restDay', 'bodyMetricsLogged',
  ])
  for (const [id, spec] of Object.entries(ACTIVITY_FIELDS)) {
    assert.ok(engineFields.has(spec.field), `${id} writes ${spec.field}, which nothing scores`)
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
  // Water arrives a glass at a time. Typing the running total by hand is not
  // logging, it is arithmetic.
  let day = applyActivity({ date: '2026-09-04' }, 'water', 16)
  day = applyActivity(day, 'water', 16)
  assert.equal(day.waterOz, 32)

  let minutes = applyActivity({ date: '2026-09-04' }, 'read', 20)
  minutes = applyActivity(minutes, 'read', 10)
  assert.equal(minutes.readingMinutes, 30)
})

test('a value that describes a state replaces it', () => {
  // You do not sleep 7 hours and then a further 8.
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

  // The value is kept, for the app layer to show back to the user. Reading it
  // is not this layer's job — see body-weight.test.js.
  assert.equal(light.bodyMetrics.weight, 150)
  assert.equal(heavy.bodyMetrics.weight, 250)
  assert.equal(activityValue(byId('body_metrics'), heavy), true,
    'the domain sees the act of logging, and not the reading')

  // And it changes nothing about what the day is worth.
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

  // Rest is never buried: docs/03 requires it always available and explicit.
  assert.equal(order[0], 'rest_day')
  // A day starts with the night before it.
  assert.ok(order.indexOf('sleep') < order.indexOf('journal'))
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
    assert.ok(spec.entry === 'mark' || spec.entry === 'number',
      `${activity.id} has no entry mode`)
    if (spec.entry === 'number') {
      assert.ok(spec.mode === 'add' || spec.mode === 'replace', `${activity.id} has no update mode`)
    }
  }
})
