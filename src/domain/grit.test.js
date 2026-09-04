import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { makeContext, makeSession } from '../../test/helpers/context.js'
import { gritAwards } from './grit.js'
import { totalsBySource, totalsByAttribute } from './xp-engine.js'

const balance = loadBalance()
const src = (awards) => totalsBySource(awards)

test('SOURCE: completing a session pays a flat amount, any training type', () => {
  const lifting = gritAwards(makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 145, reps: 8 }] }), makeContext(), balance)
  // A cardio session is still a session and pays the same flat amount: "any
  // training type" fixes the rate, it does not excuse logging nothing. What
  // cardio logs is a timed entry rather than a load.
  const cardio = gritAwards(
    makeSession({ routineId: 'cardio', sets: [{ exerciseId: 'row_erg', timeSec: 1200 }] }),
    makeContext(), balance)
  assert.equal(src(lifting)['grit.session'], balance.grit.xpPerSession)
  assert.equal(src(cardio)['grit.session'], balance.grit.xpPerSession)
})

test('SOURCE: training hours accumulate at the configured rate', () => {
  const awards = gritAwards(makeSession({ durationMinutes: 90 }), makeContext(), balance)
  assert.equal(src(awards)['grit.hours'], 1.5 * balance.grit.xpPerTrainingHour)
})

test('SOURCE: returning after a gap pays a bonus', () => {
  const gap = balance.grit.returnGapDaysThreshold
  const awards = gritAwards(makeSession(), makeContext({ daysSinceLastSession: gap }), balance)
  assert.equal(src(awards)['grit.return'], balance.grit.returnAfterGapBonus)
})

test('the gap bonus rewards coming back; the absence itself costs nothing', () => {
  const short = gritAwards(makeSession(), makeContext({ daysSinceLastSession: 1 }), balance)
  const long = gritAwards(makeSession(), makeContext({ daysSinceLastSession: 30 }), balance)
  assert.equal(src(short)['grit.return'], undefined)
  assert.ok(totalsByAttribute(long).grit > totalsByAttribute(short).grit)
  for (const award of short) assert.ok(award.xp >= 0)
})

test('SOURCE: meeting the weekly plan target pays a bonus, once', () => {
  const target = 4
  /** @param {number} before */
  const week = (before) => src(gritAwards(makeSession(),
    makeContext({ sessionsThisWeekBefore: before, planTargetSessionsPerWeek: target }), balance))['grit.weekPlan']

  assert.equal(week(target - 1), balance.grit.weekMetPlanBonus, 'the session that meets the target pays')
  assert.equal(week(0), undefined, 'earlier sessions in the week do not')
  assert.equal(week(target), undefined, 'nor does a fifth session pay it again')
})

// ---------------------------------------------------------------------------
// Required by docs/07-build-plan.md: Grit has no streak multiplier.
// ---------------------------------------------------------------------------

test('REQUIRED: Grit has no streak multiplier — 100 consecutive days never escalate', () => {
  const session = makeSession({ durationMinutes: 60 })
  // Same session, same context, on day 1 and after 99 consecutive days of training.
  const context = makeContext({ daysSinceLastSession: 1, sessionsThisWeekBefore: 0 })

  const first = totalsByAttribute(gritAwards(session, context, balance)).grit
  for (let day = 2; day <= 100; day++) {
    const today = totalsByAttribute(gritAwards(session, context, balance)).grit
    assert.equal(today, first, `day ${day} paid differently from day 1`)
  }
})

test('REQUIRED: no Grit source is derived from a streak', () => {
  const awards = gritAwards(makeSession(), makeContext({ daysSinceLastSession: 10 }), balance)
  for (const award of awards) {
    assert.ok(!/streak/i.test(award.source), `${award.source} looks streak-derived`)
    assert.ok(!/streak/i.test(award.label), `${award.label} looks streak-derived`)
  }
})

test('REQUIRED: an unbroken month and a broken month pay the same per session', () => {
  const session = makeSession({ durationMinutes: 60 })

  // Unbroken: trained yesterday, every time.
  let unbroken = 0
  for (let i = 0; i < 20; i++) {
    unbroken += totalsByAttribute(gritAwards(session,
      makeContext({ daysSinceLastSession: 1, sessionsThisWeekBefore: 0 }), balance)).grit
  }

  // Broken: same 20 sessions, but each follows a two-day gap. Below the
  // return-bonus threshold, so this isolates the streak question alone.
  let broken = 0
  for (let i = 0; i < 20; i++) {
    broken += totalsByAttribute(gritAwards(session,
      makeContext({ daysSinceLastSession: 2, sessionsThisWeekBefore: 0 }), balance)).grit
  }

  assert.equal(unbroken, broken, 'consecutive days must confer no advantage')
})

test('missing a day produces no gain, never a loss', () => {
  const awards = gritAwards(makeSession(), makeContext({ daysSinceLastSession: 9 }), balance)
  const total = totalsByAttribute(awards).grit
  assert.ok(total > 0)
  for (const award of awards) assert.ok(award.xp >= 0, 'no negative XP anywhere')
})

test('the first session ever is a beginning, not a return after a gap', () => {
  const first = gritAwards(makeSession(), makeContext({ daysSinceLastSession: Infinity }), balance)
  assert.equal(src(first)['grit.return'], undefined, 'nothing to return from yet')

  const genuine = gritAwards(makeSession(), makeContext({ daysSinceLastSession: 6 }), balance)
  assert.equal(src(genuine)['grit.return'], balance.grit.returnAfterGapBonus)
})

// --- docs/10: the unit is the slot, not the session ------------------------

test('a day of micro sets still counts as a training day', () => {
  const first = gritAwards(makeSession({ durationMinutes: 8 }),
    makeContext({ daysSinceLastSession: 2 }), balance)
  assert.equal(src(first)['grit.session'], balance.grit.xpPerSession,
    'the first slot of the day must pay for showing up')
  assert.ok(totalsByAttribute(first).grit > 0)
})

test('later slots the same day add time under load but not a second showing-up', () => {
  const later = gritAwards(makeSession({ durationMinutes: 8 }),
    makeContext({ daysSinceLastSession: 2, isFirstOfDay: false }), balance)
  assert.equal(src(later)['grit.session'], undefined, 'showing up is once a day')
  assert.equal(src(later)['grit.hours'], (8 / 60) * balance.grit.xpPerTrainingHour,
    'but the time is real and still counts')
})

test('five micro slots pay one showing-up, not five', () => {
  const one = totalsByAttribute(gritAwards(makeSession({ durationMinutes: 10 }),
    makeContext({ daysSinceLastSession: 2 }), balance)).grit
  let total = one
  for (let i = 0; i < 4; i++) {
    total += totalsByAttribute(gritAwards(makeSession({ durationMinutes: 10 }),
      makeContext({ daysSinceLastSession: 2, isFirstOfDay: false }), balance)).grit
  }
  const sessionBonus = balance.grit.xpPerSession
  const hours = (10 / 60) * balance.grit.xpPerTrainingHour
  assert.ok(Math.abs(total - (sessionBonus + hours * 5)) < 1e-9,
    `five micro slots should pay one session bonus plus five stints of time, got ${total}`)
})

test('the return bonus is a day-level award too, paid once', () => {
  const context = { daysSinceLastSession: 9 }
  const first = gritAwards(makeSession(), makeContext(context), balance)
  const second = gritAwards(makeSession(), makeContext({ ...context, isFirstOfDay: false }), balance)
  assert.equal(src(first)['grit.return'], balance.grit.returnAfterGapBonus)
  assert.equal(src(second)['grit.return'], undefined, 'you only come back once')
})

test('a normal session is unaffected — isFirstOfDay defaults to true', () => {
  const explicit = gritAwards(makeSession(), makeContext({ isFirstOfDay: true }), balance)
  const implied = gritAwards(makeSession(), makeContext(), balance)
  assert.deepEqual(explicit, implied)
})

// --- an empty session is not a training session ---------------------------
// docs/01: "Session completed" counts only when at least one set was logged.
// Opening a session and logging nothing used to pay the full day-level award —
// 140 flat plus the forced one-minute duration — for zero work.

test('SOURCE: a session with no logged sets earns no Grit at all', () => {
  const awards = gritAwards(makeSession({ sets: [], durationMinutes: 60 }), makeContext(), balance)
  assert.deepEqual(awards, [], 'nothing was logged, so nothing counts as showing up')
})

test('one logged set is enough — there is no volume threshold', () => {
  // Three sets of laterals is showing up. The rule is "something", not "enough".
  const oneSet = makeSession({ sets: [{ exerciseId: 'lateral_raise_db', weight: 10, reps: 12 }] })
  const awards = gritAwards(oneSet, makeContext(), balance)
  assert.equal(src(awards)['grit.session'], balance.grit.xpPerSession)
})

test('the empty session earns nothing from any Grit source, not just the flat one', () => {
  // Every day-level source rides on the same "this session happened" premise:
  // time under load, the return bonus and the weekly plan bonus included.
  const gap = balance.grit.returnGapDaysThreshold
  const context = makeContext({
    daysSinceLastSession: gap,
    sessionsThisWeekBefore: 3,
    planTargetSessionsPerWeek: 4,
  })
  const empty = gritAwards(makeSession({ sets: [], durationMinutes: 90 }), context, balance)
  assert.equal(totalsByAttribute(empty).grit, 0, `an empty session paid ${totalsByAttribute(empty).grit}`)

  // The same context with one set logged pays all of them, so the guard is
  // what suppressed the awards and not a broken fixture.
  const worked = gritAwards(
    makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 185, reps: 5 }], durationMinutes: 90 }),
    context, balance)
  for (const source of ['grit.session', 'grit.hours', 'grit.return', 'grit.weekPlan']) {
    assert.ok(src(worked)[source] > 0, `${source} should pay when a set was logged`)
  }
})

test('a warm-up-only session still counts as showing up', () => {
  // Judgement call, recorded in DECISIONS.md: the rule is "at least one set was
  // logged", and a warm-up is a logged set. Might still pays nothing for it.
  const warmup = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 45, reps: 5, isWarmup: true }] })
  assert.equal(src(gritAwards(warmup, makeContext(), balance))['grit.session'], balance.grit.xpPerSession)
})
