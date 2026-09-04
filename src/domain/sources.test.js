/**
 * What feeds an attribute, and what each thing is worth — Phase 5.
 *
 * Written before `sources.js`. This is the module behind the one Phase 5
 * acceptance criterion that `docs/03-screens.md` calls mandatory: tap an
 * attribute and see exactly which activities feed it and what each is worth.
 *
 * The load-bearing test is the one that walks the XP engine and checks the
 * explanation covers every source the engine can actually emit. A hand-written
 * list of "things that give you Might" is exactly the kind of thing that is
 * true the day it is written and quietly wrong six weeks later, and the failure
 * mode is the worst kind: the app confidently explaining itself incorrectly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance, loadExercises } from '../../test/helpers/balance.js'
import { explainSources, topContributors, SOURCE_LABELS } from './sources.js'
import { awardsForSession, awardsForDay } from './xp-engine.js'
import { ATTRIBUTE_IDS } from './tiers.js'

const balance = loadBalance()

/**
 * Every source id the engine can emit, found by driving it rather than by
 * reading it. A day and a session that between them trigger everything.
 */
function everySourceTheEngineEmits() {
  const day = {
    date: '2026-09-04',
    sleepHours: 8, waterOz: 64, steps: 9000, mobilityMinutes: 20,
    readingMinutes: 20, studyMinutes: 20, meditationMinutes: 10, instrumentMinutes: 15,
    journalLogged: true, nutritionLogged: true, proteinTargetMet: true,
    restDay: true, bodyMetricsLogged: true,
    cardio: [{ activityId: 'run', distanceMiles: 3, minutes: 27 }],
  }
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
    daysSinceLastSession: 9,          // fires the return bonus
    sessionsThisWeekBefore: 3,        // this session is the 4th, meeting the plan
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
  assert.ok(emitted.size >= 20, `only ${emitted.size} sources emitted — the probe is too thin`)
  for (const id of ['might.volume', 'might.weightPr', 'might.e1rm', 'grit.return',
    'wind.pace', 'vitality.rest', 'mind.journal', 'grit.weekPlan']) {
    assert.ok(emitted.has(id), `${id} was not emitted, so the probe is not exercising it`)
  }
})

test('MANDATORY: every source the engine can emit is explained', () => {
  const explained = new Set(ATTRIBUTE_IDS.flatMap(
    (attribute) => explainSources(attribute, balance).map((entry) => entry.source)))
  const missing = [...emitted].filter((source) => !explained.has(source)).sort()
  assert.deepEqual(missing, [],
    'these can raise an attribute with the app unable to say why')
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
      assert.ok(entry.source.startsWith(`${attribute}.`),
        `${entry.source} is listed under ${attribute}`)
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
  const rest = vitality.find((entry) => entry.source === 'vitality.rest')
  assert.ok(rest.worth.includes(String(balance.vitality.restDayXp)),
    `"${rest.worth}" does not quote ${balance.vitality.restDayXp}`)
})

test('retuning balance retunes what the app says, with no code change', () => {
  const retuned = JSON.parse(JSON.stringify(balance))
  retuned.vitality.restDayXp = 999
  const rest = explainSources('vitality', retuned).find((e) => e.source === 'vitality.rest')
  assert.ok(rest.worth.includes('999'), `"${rest.worth}" ignored the retune`)
})

test('the labels match the ones the engine puts on its own awards', () => {
  // The breakdown after a session and the explanation on the Character screen
  // must call the same thing by the same name.
  const day = { date: 'd', restDay: true, sleepHours: 8, journalLogged: true }
  for (const award of awardsForDay(day, {}, balance)) {
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
  // A source retired from the engine but still in someone's lifetime totals.
  const top = topContributors('might', { 'might.ancientBonus': 500 }, 5)
  assert.equal(top.length, 1)
  assert.ok(top[0].label.length > 0, 'it still needs something to call it')
})
