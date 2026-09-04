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
  const cardio = gritAwards(makeSession({ routineId: 'cardio', sets: [] }), makeContext(), balance)
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
