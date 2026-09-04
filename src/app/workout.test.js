import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createWorkoutService } from './workout.js'
import { seedLibrary, ensureProfile, seedPrograms } from './seed.js'
import { awardsForSession, totalsByAttribute } from '../domain/xp-engine.js'

const balance = loadBalance()
const library = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))
const catalogue = JSON.parse(readFileSync(new URL('../../data/programs.json', import.meta.url), 'utf8'))

async function freshApp(at = '2026-09-04T18:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await seedLibrary(storage, library)
  await seedPrograms(storage, catalogue, clock)
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

// --- docs/10: the unit is the slot ----------------------------------------

test('ACCEPTANCE: a slot can be completed without starting a session', async () => {
  const { workout, storage } = await freshApp()
  const summary = await workout.completeSlot(
    { dayId: 'monday', slotIndex: 3, exerciseId: 'lateral_raise_db' },
    [{ weight: 20, reps: 15 }, { weight: 20, reps: 15 }, { weight: 20, reps: 14 }, { weight: 20, reps: 12 }],
  )
  assert.ok(summary.xpByAttribute.might > 0, 'a slot on its own still scores')
  assert.ok(summary.xpByAttribute.grit > 0, 'and still counts as showing up')

  const tasks = await workout.todayTasks()
  const done = tasks.tasks.find((task) => task.index === 3)
  assert.equal(done.done, true, 'the slot is marked complete')
  assert.equal(await storage.count('sessions'), 1, 'exactly one session record, not none and not many')
})

test('ACCEPTANCE: a day of micro sets accrues Grit exactly once for showing up', async () => {
  const { workout, balance: _ } = await freshApp()
  const first = await workout.completeSlot(
    { dayId: 'monday', slotIndex: 3, exerciseId: 'lateral_raise_db' }, [{ weight: 20, reps: 15 }])
  const second = await workout.completeSlot(
    { dayId: 'monday', slotIndex: 4, exerciseId: 'cable_fly' }, [{ weight: 30, reps: 15 }])

  assert.ok(first.xpBySource['grit.session'] > 0, 'the first slot pays for showing up')
  assert.equal(second.xpBySource['grit.session'], undefined, 'the second does not pay again')
  assert.ok(second.xpBySource['grit.hours'] > 0, 'but its time under load still counts')
  assert.ok(second.xpByAttribute.grit > 0, 'so a later slot is never worth zero Grit')
})

test('settling a day twice does not re-award the first slot', async () => {
  const { workout, storage } = await freshApp()
  await workout.completeSlot({ dayId: 'monday', slotIndex: 3, exerciseId: 'lateral_raise_db' },
    [{ weight: 20, reps: 15 }])
  const afterFirst = (await storage.getAll('attributeState')).find((r) => r.attribute === 'might').xp

  const second = await workout.completeSlot({ dayId: 'monday', slotIndex: 4, exerciseId: 'cable_fly' },
    [{ weight: 30, reps: 15 }])
  const afterSecond = (await storage.getAll('attributeState')).find((r) => r.attribute === 'might').xp

  assert.equal(afterSecond - afterFirst, Math.round(second.xpByAttribute.might),
    'the second settle must add only the second slot')
})

test('ACCEPTANCE: XP is identical whether a slot is done alone or inside a block', async () => {
  const alone = await freshApp()
  const soloSummary = await alone.workout.completeSlot(
    { dayId: 'monday', slotIndex: 4, exerciseId: 'cable_fly' },
    [{ weight: 30, reps: 15 }, { weight: 30, reps: 15 }, { weight: 30, reps: 15 }])

  const block = await freshApp()
  const session = await block.workout.startSession(null)
  for (const set of [{ reps: 15 }, { reps: 15 }, { reps: 15 }]) {
    await block.workout.logSet(session, { exerciseId: 'cable_fly', weight: 30, reps: set.reps })
  }
  const blockSummary = await block.workout.finishSession(session, { durationMinutes: 6 })

  assert.equal(Math.round(soloSummary.xpByAttribute.might), Math.round(blockSummary.xpByAttribute.might),
    'volume is volume; the path does not change the reward')
})

test('ACCEPTANCE: an unfinished Monday slot is completable on Thursday of the same week', async () => {
  const { workout, clock } = await freshApp('2026-09-07T09:00:00.000Z') // a Monday
  await workout.completeSlot({ dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }])   // 2 of 4: outstanding

  clock.advanceDays(3) // Thursday, same program week
  const before = await workout.weekStatus()
  const mondayBefore = before.week.days.find((d) => d.day.id === 'monday')
  assert.equal(mondayBefore.tasks[0].done, false, 'still outstanding, not expired')
  assert.equal(mondayBefore.tasks[0].started, true, 'and its partial work is remembered')

  await workout.completeSlot({ dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }])
  const after = await workout.weekStatus()
  assert.equal(after.week.days.find((d) => d.day.id === 'monday').tasks[0].done, true,
    "Monday's slot finished on Thursday")
})

test('ACCEPTANCE: at the week boundary outstanding slots clear rather than carry', async () => {
  const { workout, clock } = await freshApp('2026-09-07T09:00:00.000Z')
  await workout.completeSlot({ dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }])
  assert.equal((await workout.weekStatus()).week.done, 1)

  clock.advanceDays(7) // the next program week
  const fresh = await workout.weekStatus()
  assert.equal(fresh.week.done, 0, 'the new week starts clear')
  assert.equal(fresh.week.total, 30, 'and is prescribed in full again')
  const monday = fresh.week.days.find((d) => d.day.id === 'monday')
  assert.equal(monday.tasks.every((task) => !task.done && !task.started), true,
    'nothing carried over as debt')
})

test('ACCEPTANCE: the weekly view derives hard sets from logged data', async () => {
  const { workout } = await freshApp('2026-09-07T09:00:00.000Z')
  await workout.completeSlot({ dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }])

  const status = await workout.weekStatus()
  const chest = status.hardSets.find((row) => row.group === 'chest')
  assert.equal(chest.sets, 4, 'counted from what was logged')
  assert.deepEqual(chest.target, [12, 16], 'against the program target')
  assert.equal(chest.short, 8)
  assert.ok(status.hardSets.every((row) => row.short >= 0), 'never a negative, never a debt')
})

// --- an empty session is not a training session ---------------------------
// `grit.test.js` proves the domain refuses to pay for a session with no sets.
// That is necessary and not sufficient: the bug Cory saw was a whole flow —
// open a session, log nothing, press finish, watch +142 land and a summary
// appear. What made it wrong lives here: what gets stored, and what the finish
// hands back for the screen to show.

test('finishing a session with nothing logged earns no XP at all', async () => {
  const { storage, workout } = await freshApp()
  const session = await workout.startSession('lower')

  const summary = await workout.finishSession(session, { durationMinutes: 40 })

  assert.equal(summary, null, 'there is nothing to summarise')
  const stored = await storage.getAll('attributeState')
  for (const row of stored) assert.equal(row.xp, 0, `${row.attribute} earned XP for an empty session`)
})

test('the empty session leaves no completed session behind', async () => {
  // A stored empty session is not inert: it counts toward the week's sessions
  // and resets the days-since-last-session clock.
  const { storage, workout } = await freshApp()
  const session = await workout.startSession('lower')
  await workout.finishSession(session)

  assert.deepEqual(await storage.getAll('sessions'), [], 'the empty session was kept')
})

test('one logged set is enough to count — there is no volume threshold', async () => {
  // Three sets of laterals is showing up. One is too.
  const { storage, workout } = await freshApp()
  const session = await workout.startSession('lower')
  await workout.logSet(session, { exerciseId: 'lateral_raise_db', weight: 15, reps: 12 })

  const summary = await workout.finishSession(session, { durationMinutes: 8 })

  assert.ok(summary, 'a session with work in it must summarise')
  assert.equal(summary.setsCompleted, 1)
  assert.equal(summary.xpBySource['grit.session'], balance.grit.xpPerSession)
  assert.equal((await storage.getAll('sessions')).length, 1, 'a real session must be kept')
})

test('an abandoned session does not consume the return-after-a-gap bonus', async () => {
  // The sharpest consequence of storing empty sessions. Come back after a gap,
  // open a session, log nothing, close it — then actually train. Before the fix
  // the empty session had already reset the clock and the bonus was gone.
  const { clock, workout } = await freshApp()
  const first = await workout.startSession('lower')
  await workout.logSet(first, { exerciseId: 'squat_bb', weight: 185, reps: 5 })
  await workout.finishSession(first, { durationMinutes: 45 })

  clock.advanceDays(balance.grit.returnGapDaysThreshold + 2)

  const abandoned = await workout.startSession('lower')
  assert.equal(await workout.finishSession(abandoned), null)

  const real = await workout.startSession('lower')
  await workout.logSet(real, { exerciseId: 'squat_bb', weight: 185, reps: 5 })
  const summary = await workout.finishSession(real, { durationMinutes: 45 })

  assert.equal(summary.xpBySource['grit.return'], balance.grit.returnAfterGapBonus,
    'the abandoned session swallowed the return bonus')
})

test('abandoning one slot never destroys the day the other slots built', async () => {
  // In slot mode the record is the DAY's session and may already carry work.
  // Discarding it because this slot logged nothing would delete real training.
  const { storage, workout } = await freshApp()
  const done = await workout.completeSlot(
    { dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 135, reps: 8 }])
  assert.ok(done, 'the first slot must count')

  const { session } = await workout.openDaySession()
  const abandoned = await workout.finishSession(session, { onlySets: [], isFirstOfDay: false })

  assert.equal(abandoned, null, 'a slot that logged nothing summarises nothing')
  assert.equal((await storage.getAll('sessions')).length, 1, 'the day was deleted')
  assert.equal((await storage.getAll('setLogs')).length, 1, 'the day lost its logged work')
})
