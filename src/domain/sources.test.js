/**
 * What feeds an attribute, and what each thing is worth — Phase 5.
 *
 * Written before `sources.js`. This is the module behind the one Phase 5
 * acceptance criterion that `docs/03-screens.md` calls mandatory: tap an
 * attribute and see exactly which activities feed it and what each is worth.
 *
 * The load-bearing test walks the XP engine and checks this list against every
 * source it can actually emit. The day half of that probe is derived from the
 * activity registry so adding a new trackable activity cannot quietly leave the
 * Character explanation behind.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance, loadExercises } from '../../test/helpers/balance.js'
import { explainSources, topContributors, SOURCE_LABELS } from './sources.js'
import { awardsForSession, awardsForDay } from './xp-engine.js'
import { ATTRIBUTE_IDS } from './tiers.js'
import { ACTIVITY_FIELDS, applyActivity } from './activities.js'

const balance = loadBalance()

/** Meaningful values for numeric activities. Mark activities need no value. */
const ACTIVITY_PROBE_VALUES = Object.freeze({
  sleep: 8,
  water: 64,
  steps: 9000,
  body_metrics: 184,
  mobility: 20,
  read: 20,
  study: 20,
  meditate: 10,
  instrument: 15,
})

/**
 * Build the day by walking the actual activity registry. If a future activity
 * gets a day-log field, this probe exercises it automatically instead of
 * depending on somebody remembering to update a hand-written literal.
 */
function activityProbeDay() {
  let day = { date: '2026-09-04' }
  for (const [activityId, spec] of Object.entries(ACTIVITY_FIELDS)) {
    const value = spec.entry === 'number' ? (ACTIVITY_PROBE_VALUES[activityId] ?? 1) : null
    day = applyActivity(day, activityId, value)
    if (spec.scoredField) day = { ...day, [spec.scoredField]: true }
  }
  return {
    ...day,
    cardio: [{ activityId: 'run', distanceMiles: 3, minutes: 27 }],
  }
}

/**
 * Every source id the engine can emit, found by driving it rather than by
 * reading it. A registry-derived day and a session between them trigger all
 * currently reachable sources.
 */
function everySourceTheEngineEmits() {
  const day = activityProbeDay()
  const session = {
    id: 's1', routineId: 'lower', durationMinutes: 75,
    sets: [
      { exerciseId: 'deadlift_bb', weight: 315, reps: 5 },
      { exerciseId: 'farmers_carry', weight: 200, reps: null, distance: 100 },
    ],
  }
  // A previous best, so the PR and estimated-1RM sources fire rather than
  // silently sitting out the probe.
  const records = new Map([['deadlift_bb', {
    exerciseId: 'deadlift_bb',
    bestWeight: { weight: 275, reps: 5, date: '2026-08-01' },
    bestVolume: { volume: 1000, date: '2026-08-01' },
    bestE1RM: { value: 300, date: '2026-08-01' },
    lastPerformance: { weight: 275, reps: 5, date: '2026-08-01' },
  }]])
  const context = {
    date: '2026-09-04',
    exercises: loadExercises(),
    records,
    daysSinceLastSession: 9,
    sessionsThisWeekBefore: 3,
    planTargetSessionsPerWeek: 4,
    isFirstOfDay: true,
  }
  return new Set([
    ...awardsForDay(day, { paceBaselineMinPerMile: 12 }, balance).map((a) => a.source),
    ...awardsForSession(session, context, balance).map((a) => a.source),
  ])
}

const emitted = everySourceTheEngineEmits()

test('the probe actually reaches the engine, or this file proves nothing', () => {
  assert.ok(emitted.size >= 27, `only ${emitted.size} sources emitted — the probe is too thin`)
  for (const id of [
    'might.volume', 'might.weightPr', 'might.e1rm', 'grit.return', 'wind.pace',
    'vitality.rest', 'vitality.calories', 'vitality.alcoholFree', 'vitality.sauna',
    'mind.journal', 'grit.weekPlan',
  ]) {
    assert.ok(emitted.has(id), `${id} was not emitted, so the probe is not exercising it`)
  }
})

test('MANDATORY: every source the engine can emit is explained', () => {
  const explained = new Set(ATTRIBUTE_IDS.flatMap(
    (attribute) => explainSources(attribute, balance).map((entry) => entry.source)))
  const missing = [...emitted].filter((source) => !explained.has(source)).sort()
  assert.deepEqual(missing, [], 'these can raise an attribute with the app unable to say why')
})

test('and nothing is explained that the engine cannot emit', () => {
  const explained = ATTRIBUTE_IDS.flatMap(
    (attribute) => explainSources(attribute, balance).map((entry) => entry.source))
  const invented = explained.filter((source) => !emitted.has(source)).sort()
  assert.deepEqual(invented, [], 'these promise XP that nothing awards')
})

test('every source is filed under the attribute it actually raises', () => {
  for (const attribute of ATTRIBUTE_IDS) {
    for (const entry of explainSources(attribute, balance)) {
      assert.ok(entry.source.startsWith(`${attribute}.`), `${entry.source} is listed under ${attribute}`)
    }
  }
})

test('every attribute has something that feeds it', () => {
  for (const attribute of ATTRIBUTE_IDS) {
    assert.ok(explainSources(attribute, balance).length > 0, `nothing feeds ${attribute}`)
  }
})

test('MANDATORY: each one says what it is worth, from balance and not from memory', () => {
  for (const attribute of ATTRIBUTE_IDS) {
    for (const entry of explainSources(attribute, balance)) {
      assert.ok(entry.label && entry.label.length > 2, `${entry.source} has no label`)
      assert.ok(entry.worth && entry.worth.length > 2, `${entry.source} does not say what it is worth`)
      assert.ok(/\d/.test(entry.worth), `${entry.source} worth has no number in it: "${entry.worth}"`)
    }
  }
})

test('the worth quoted is the number in balance.json, not a copy of it', () => {
  const might = explainSources('might', balance)
  const volume = might.find((entry) => entry.source === 'might.volume')
  assert.ok(volume.worth.includes(String(balance.might.xpPerThousandLbsVolume)),
    `"${volume.worth}" does not quote ${balance.might.xpPerThousandLbsVolume}`)

  const vitality = explainSources('vitality', balance)
  for (const [source, amount] of [
    ['vitality.rest', balance.vitality.restDayXp],
    ['vitality.calories', balance.vitality.caloriesLoggedXp],
    ['vitality.alcoholFree', balance.vitality.alcoholFreeXp],
    ['vitality.sauna', balance.vitality.saunaXp],
  ]) {
    const entry = vitality.find((item) => item.source === source)
    assert.ok(entry.worth.includes(String(amount)), `"${entry.worth}" does not quote ${amount}`)
  }
})

test('retuning balance retunes what the app says, with no code change', () => {
  const retuned = JSON.parse(JSON.stringify(balance))
  retuned.vitality.restDayXp = 999
  const rest = explainSources('vitality', retuned).find((e) => e.source === 'vitality.rest')
  assert.ok(rest.worth.includes('999'), `"${rest.worth}" ignored the retune`)
})

test('the labels match the ones the engine puts on its own awards', () => {
  for (const award of awardsForDay(activityProbeDay(), { paceBaselineMinPerMile: 12 }, balance)) {
    assert.equal(SOURCE_LABELS[award.source], award.label,
      `the engine calls ${award.source} "${award.label}"`)
  }
})

// --- what actually fed it ---------------------------------------------------

test('largest contributors come back biggest first, with their labels', () => {
  const lifetime = { 'might.volume': 4000, 'might.weightPr': 900, 'might.carry': 120 }
  const top = topContributors('might', lifetime, 2)
  assert.deepEqual(top.map((entry) => entry.source), ['might.volume', 'might.weightPr'])
  assert.equal(top[0].xp, 4000)
  assert.equal(top[0].label, SOURCE_LABELS['might.volume'])
})

test('contributors are scoped to their own attribute', () => {
  const lifetime = { 'might.volume': 10, 'grit.session': 5000 }
  assert.deepEqual(topContributors('might', lifetime, 5).map((e) => e.source), ['might.volume'])
})

test('a share is given, so "what fed this" is answerable at a glance', () => {
  const top = topContributors('might', { 'might.volume': 750, 'might.weightPr': 250 }, 5)
  assert.equal(top[0].share, 0.75)
  assert.equal(top[1].share, 0.25)
})

test('an attribute with no history yet returns nothing, and does not divide by zero', () => {
  assert.deepEqual(topContributors('mind', {}, 5), [])
  assert.deepEqual(topContributors('mind', undefined, 5), [])
  assert.deepEqual(topContributors('mind', { 'mind.journal': 0 }, 5), [],
    'a source worth nothing yet is not a contributor')
})

test('an unknown source in stored history is shown, not swallowed', () => {
  const top = topContributors('might', { 'might.ancientBonus': 500 }, 5)
  assert.equal(top.length, 1)
  assert.ok(top[0].label.length > 0, 'it still needs something to call it')
})
