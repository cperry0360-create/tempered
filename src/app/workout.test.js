import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createWorkoutService } from './workout.js'
import { seedLibrary, ensureProfile } from './seed.js'
import { awardsForSession, totalsByAttribute } from '../domain/xp-engine.js'

const balance = loadBalance()
const library = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))

async function freshApp(at = '2026-09-04T18:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await seedLibrary(storage, library)
  await ensureProfile(storage, clock)
  return { storage, clock, workout: createWorkoutService({ storage, clock, balance }) }
}

test('the library seeds on first run and is not duplicated on the second', async () => {
  const { storage } = await freshApp()
  const first = await storage.count('exercises')
  assert.ok(first > 20)
  const added = await seedLibrary(storage, library)
  assert.deepEqual(added, { exercises: 0, routines: 0 })
  assert.equal(await storage.count('exercises'), first)
})

test('a user-added exercise survives reseeding', async () => {
  const { storage } = await freshApp()
  await storage.put('exercises', { id: 'zercher_squat', name: 'Zercher Squat', class: 'compound', group: 'legs' })
  await seedLibrary(storage, library)
  assert.ok(await storage.get('exercises', 'zercher_squat'), 'user exercise was wiped')
})

test('ACCEPTANCE: finishing a session produces exactly the Phase 1 XP', async () => {
  const { storage, clock, workout } = await freshApp()
  const session = await workout.startSession('lower')

  /** @type {{exerciseId: string, weight: number|null, reps: number|null}[]} */
  const logged = [
    { exerciseId: 'deadlift_bb', weight: 160, reps: 8 },
    { exerciseId: 'deadlift_bb', weight: 160, reps: 8 },
    { exerciseId: 'squat_bb', weight: 145, reps: 8 },
    { exerciseId: 'squat_bb', weight: 145, reps: 8 },
    { exerciseId: 'calf_raise', weight: 130, reps: 8 },
    { exerciseId: 'pullup', weight: null, reps: 10 },
  ]
  for (const set of logged) await workout.logSet(session, set)

  const summary = await workout.finishSession(session, { durationMinutes: 62 })

  // Recompute independently, straight from the domain, and demand a match.
  const exercises = await workout.exerciseMap()
  const expected = totalsByAttribute(awardsForSession(
    { id: session.id, routineId: 'lower', durationMinutes: 62, sets: logged },
    {
      date: '2026-09-04', exercises, records: new Map(),
      daysSinceLastSession: Infinity, sessionsThisWeekBefore: 0, planTargetSessionsPerWeek: 4,
    },
    balance,
  ))

  assert.deepEqual(summary.xpByAttribute, expected)
  assert.ok(summary.xpByAttribute.might > 0, 'the session moved Might')
  assert.ok(summary.xpByAttribute.grit > 0, 'the session moved Grit')

  // And the persisted state agrees with the summary the user was shown.
  const stored = await storage.getAll('attributeState')
  for (const [attribute, xp] of Object.entries(summary.xpByAttribute)) {
    const row = stored.find((r) => r.attribute === attribute)
    assert.equal(row.xp, Math.round(xp), `${attribute} persisted differently from what was shown`)
  }
  assert.equal(clock.today(), '2026-09-04')
})

test('records are updated by finishing, so the next session sees them', async () => {
  const { workout } = await freshApp()
  const first = await workout.startSession('lower')
  await workout.logSet(first, { exerciseId: 'squat_bb', weight: 145, reps: 8 })
  await workout.finishSession(first, { durationMinutes: 45 })

  const prepared = await workout.prepareExercise('squat_bb', { sets: 3, reps: 8, weight: 145 })
  assert.equal(prepared.record.bestWeight.weight, 145)
  assert.equal(prepared.last.sets[0].weight, 145)
})

test('ACCEPTANCE: last performance and PR are available before any set is entered', async () => {
  const { workout } = await freshApp()
  const first = await workout.startSession('lower')
  await workout.logSet(first, { exerciseId: 'squat_bb', weight: 145, reps: 8 })
  await workout.finishSession(first, { durationMinutes: 45 })

  // A later session, before logging anything.
  await workout.startSession('lower')
  const prepared = await workout.prepareExercise('squat_bb', { sets: 3, reps: 8, weight: 145 })
  assert.ok(prepared.last, 'last performance must be known up front')
  assert.ok(prepared.record, 'the PR must be known up front')
  assert.ok(prepared.proposal.sets.length > 0, 'and today must already be prefilled')
})

test('a second session sees the first as history, not as a fresh start', async () => {
  const { clock, workout } = await freshApp()
  const first = await workout.startSession('lower')
  await workout.logSet(first, { exerciseId: 'squat_bb', weight: 145, reps: 8 })
  await workout.finishSession(first, { durationMinutes: 45 })

  clock.advanceDays(2)
  const second = await workout.startSession('lower')
  await workout.logSet(second, { exerciseId: 'squat_bb', weight: 155, reps: 8 })
  const summary = await workout.finishSession(second, { durationMinutes: 45 })

  assert.equal(summary.records.weightPrs.length, 1, 'beating 145 with 155 is a PR')
  assert.equal(summary.records.weightPrs[0].weight, 155)
})

test('an ad-hoc session has no routine and still scores', async () => {
  const { workout } = await freshApp()
  const session = await workout.startSession(null)
  await workout.logSet(session, { exerciseId: 'curl_db', weight: 30, reps: 12 })
  const summary = await workout.finishSession(session, { durationMinutes: 6 })
  assert.equal(summary.session.routineId, null)
  assert.ok(summary.xpByAttribute.grit > 0, 'showing up counts, whatever the shape')
  assert.ok(summary.xpByAttribute.might > 0)
})

test('the summary carries everything the one post-session screen needs', async () => {
  const { workout } = await freshApp()
  const session = await workout.startSession('lower')
  await workout.logSet(session, { exerciseId: 'squat_bb', weight: 145, reps: 8 })
  const summary = await workout.finishSession(session, { durationMinutes: 50 })

  // docs/05: what you did, what broke, what grew, what levelled, what's next.
  for (const key of ['durationMinutes', 'setsCompleted', 'totalVolume', 'records',
    'xpByAttribute', 'levelledUp', 'directive', 'rank']) {
    assert.ok(key in summary, `the summary is missing ${key}`)
  }
  assert.equal(summary.setsCompleted, 1)
  assert.equal(summary.totalVolume, 145 * 8)
})

test('warmup sets are logged but do not score', async () => {
  const { workout } = await freshApp()
  const session = await workout.startSession('lower')
  await workout.logSet(session, { exerciseId: 'squat_bb', weight: 95, reps: 10, isWarmup: true })
  const summary = await workout.finishSession(session, { durationMinutes: 30 })
  assert.equal(summary.setsCompleted, 0)
  assert.equal(summary.totalVolume, 0)
  assert.equal(summary.xpByAttribute.might, 0)
  assert.ok(summary.xpByAttribute.grit > 0, 'but showing up still counts')
})
