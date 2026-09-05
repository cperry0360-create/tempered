import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { makeContext, makeSession } from '../../test/helpers/context.js'
import {
  awardsForSession, awardsForDay, totalsByAttribute, totalsBySource,
  createInitialState, applyAwards, levelsOf,
} from './xp-engine.js'

const balance = loadBalance()

/** A session and day that between them trigger every XP source in the engine. */
function everySource() {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 140, reps: 8, date: '2026-01-01' },
    bestVolume: { volume: 100, date: '2026-01-01' },
    bestE1RM: { value: 150, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const session = makeSession({
    durationMinutes: 75,
    sets: [
      { exerciseId: 'squat_bb', weight: 150, reps: 8 },
      { exerciseId: 'farmers_carry', weight: 100, reps: null, distance: 150 },
    ],
  })
  const context = makeContext({
    records,
    daysSinceLastSession: balance.grit.returnGapDaysThreshold,
    sessionsThisWeekBefore: 3,
    planTargetSessionsPerWeek: 4,
  })
  const day = {
    date: '2026-09-04',
    cardio: [{ activityId: 'run', distanceMiles: 3, minutes: 24 }, { activityId: 'heavy_bag', minutes: 15 }],
    steps: 9000, mobilityMinutes: 10,
    sleepHours: 8, waterOz: 80, proteinTargetMet: true, nutritionLogged: true,
    restDay: true, bodyMetricsLogged: true,
    readingMinutes: 20, studyMinutes: 15, meditationMinutes: 10, instrumentMinutes: 10,
    journalLogged: true,
  }
  return { session, context, day }
}

test('the complete XP source inventory is accounted for', () => {
  const { session, context, day } = everySource()
  const sources = [
    ...Object.keys(totalsBySource(awardsForSession(session, context, balance))),
    ...Object.keys(totalsBySource(awardsForDay(day, { paceBaselineMinPerMile: 9 }, balance))),
  ].sort()

  // If a new source is added, this fails until it is covered by a test above.
  assert.deepEqual(sources, [
    'grit.hours', 'grit.return', 'grit.session', 'grit.weekPlan',
    'might.carry', 'might.e1rm', 'might.volume', 'might.volumePr', 'might.weightPr',
    'mind.instrument', 'mind.journal', 'mind.meditation', 'mind.reading', 'mind.study',
    'vitality.bodyMetrics', 'vitality.nutrition', 'vitality.protein', 'vitality.rest',
    'vitality.sleep', 'vitality.water',
    'wind.distance', 'wind.minutes', 'wind.pace', 'wind.steps',
  ])
})

test('a session feeds Might and Grit; a day feeds Wind, Vitality and Mind', () => {
  const { session, context, day } = everySource()
  const fromSession = totalsByAttribute(awardsForSession(session, context, balance))
  const fromDay = totalsByAttribute(awardsForDay(day, {}, balance))

  assert.ok(fromSession.might > 0 && fromSession.grit > 0)
  assert.equal(fromSession.wind + fromSession.vitality + fromSession.mind, 0)
  assert.ok(fromDay.wind > 0 && fromDay.vitality > 0 && fromDay.mind > 0)
  assert.equal(fromDay.might + fromDay.grit, 0)
})

test('no XP source is ever negative', () => {
  const { session, context, day } = everySource()
  for (const award of [...awardsForSession(session, context, balance), ...awardsForDay(day, {}, balance)]) {
    assert.ok(award.xp >= 0, `${award.source} paid ${award.xp}`)
  }
})

test('applyAwards accumulates XP and resolves levels', () => {
  const { session, context } = everySource()
  const state = applyAwards(createInitialState(), awardsForSession(session, context, balance), balance)
  assert.ok(state.might.xp > 0)
  // docs/01 requires level 1 to be *reachable* in one session, not capped at it.
  assert.ok(state.might.level >= 1, 'level 1 must be reachable inside the first session')
})

test('lifetimeSources always sums exactly to the attribute total', () => {
  const { session, context, day } = everySource()
  let state = createInitialState()
  state = applyAwards(state, awardsForSession(session, context, balance), balance)
  state = applyAwards(state, awardsForDay(day, {}, balance), balance)

  for (const [attribute, entry] of Object.entries(state)) {
    const summed = Object.values(entry.lifetimeSources).reduce((a, b) => a + b, 0)
    assert.equal(summed, entry.xp, `${attribute} breakdown does not explain its total`)
  }
})

test('applyAwards does not mutate the state it was given', () => {
  const { session, context } = everySource()
  const before = createInitialState()
  applyAwards(before, awardsForSession(session, context, balance), balance)
  assert.equal(before.might.xp, 0)
})

test('the engine is deterministic: same input, same output', () => {
  const { session, context, day } = everySource()
  assert.deepEqual(awardsForSession(session, context, balance), awardsForSession(session, context, balance))
  assert.deepEqual(awardsForDay(day, {}, balance), awardsForDay(day, {}, balance))
})

test('levelsOf reports all five attributes', () => {
  assert.deepEqual(levelsOf(createInitialState()), { might: 0, wind: 0, grit: 0, vitality: 0, mind: 0 })
})

test('an empty day and an empty session award nothing', () => {
  assert.deepEqual(awardsForDay({ date: 'd' }, {}, balance), [])
  // A session that logged nothing is not a training session: it earns nothing
  // from Might, which was never in doubt, and nothing from Grit either.
  const bare = awardsForSession(
    makeSession({ sets: [], durationMinutes: 0 }), makeContext({ daysSinceLastSession: 1 }), balance)
  assert.deepEqual(bare, [], 'an empty session is not a training session')
})
