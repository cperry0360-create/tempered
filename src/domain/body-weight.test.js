/**
 * Required by docs/07-build-plan.md and docs/02-data-model.md:
 * the body weight VALUE must never affect XP in any direction.
 *
 * Only the act of logging is scored. This file checks that behaviourally (the
 * same day scores identically at any weight) and structurally (the session input
 * type has no body-weight field for anything to read).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadBalance } from '../../test/helpers/balance.js'
import { makeContext, makeSession } from '../../test/helpers/context.js'
import { awardsForDay, awardsForSession, totalsByAttribute } from './xp-engine.js'

const balance = loadBalance()
const domainDir = fileURLToPath(new URL('./', import.meta.url))

test('REQUIRED: recorded body weight does not change XP, at any value', () => {
  /** @param {number} weight */
  const dayAt = (weight) => awardsForDay({
    date: '2026-09-04',
    sleepHours: 8, waterOz: 90, nutritionLogged: true, bodyMetricsLogged: true,
    bodyMetrics: { weight, bodyFat: weight / 10 },
  }, {}, balance)

  const light = dayAt(120)
  const heavy = dayAt(400)
  assert.deepEqual(light, heavy)
  assert.equal(totalsByAttribute(light).vitality, totalsByAttribute(heavy).vitality)
})

test('REQUIRED: the direction of change does not change XP either', () => {
  /** @param {number} weight */
  const total = (weight) => totalsByAttribute(awardsForDay({
    date: '2026-09-04', bodyMetricsLogged: true, bodyMetrics: { weight },
  }, {}, balance)).vitality

  const losing = [200, 198, 196, 194].map(total)
  const gaining = [194, 196, 198, 200].map(total)
  const flat = [200, 200, 200, 200].map(total)

  assert.deepEqual(losing, gaining, 'losing and gaining must score the same')
  assert.deepEqual(losing, flat, 'and both the same as no change at all')
})

test('REQUIRED: logging with no value recorded scores the same as logging with one', () => {
  const withValue = awardsForDay({ date: 'd', bodyMetricsLogged: true, bodyMetrics: { weight: 210 } }, {}, balance)
  const without = awardsForDay({ date: 'd', bodyMetricsLogged: true }, {}, balance)
  assert.deepEqual(withValue, without)
  assert.equal(totalsByAttribute(withValue).vitality, balance.vitality.bodyMetricsLoggedXp)
})

test('REQUIRED: body weight bolted onto a session input is ignored entirely', () => {
  const sets = [{ exerciseId: 'squat_bb', weight: 145, reps: 8 }]
  const clean = makeSession({ sets })
  // A caller wrongly passing body weight through must not be able to move XP.
  const contaminated = { ...makeSession({ sets }), bodyWeight: 250, userWeightLbs: 250 }

  const context = makeContext()
  assert.deepEqual(
    awardsForSession(clean, context, balance),
    awardsForSession(/** @type {any} */ (contaminated), context, balance),
  )
})

test('REQUIRED: bodyweight exercises score a fixed constant, not the user\'s weight', () => {
  // A pull-up scores at the exercise's notionalLoad from data/exercises.json.
  // That constant is the same for every user, so a heavier lifter earns no more
  // Might than a lighter one and losing weight costs nothing.
  const context = makeContext()
  const notional = context.exercises.get('pullup').notionalLoad
  const session = makeSession({ sets: [{ exerciseId: 'pullup', weight: null, reps: 12 }] })

  const might = totalsByAttribute(awardsForSession(session, context, balance)).might
  assert.ok(might > 0, 'a pull-up must earn Might')

  // Exactly notionalLoad x reps at the compound rate, and nothing else.
  const expected = ((notional * 12) / 1000) * balance.might.xpPerThousandLbsVolume
  assert.ok(Math.abs(might - expected) < 1e-9, `${might} should be ${expected}`)
})

test('REQUIRED: the SessionInput type declares no body-weight field', () => {
  const types = readFileSync(new URL('./types.js', import.meta.url), 'utf8')
  const block = types.slice(types.indexOf('@typedef {object} SessionInput'))
  const sessionInput = block.slice(0, block.indexOf('*/'))
  assert.ok(!/bodyweight|body_weight|bodyWeight/i.test(sessionInput),
    'SessionInput must not carry body weight in any spelling')
})

test('REQUIRED: no domain module reads a recorded body-metric value', () => {
  const offenders = []
  for (const file of readdirSync(domainDir)) {
    if (!file.endsWith('.js') || file.endsWith('.test.js')) continue
    const source = readFileSync(domainDir + file, 'utf8')
    // Reading `bodyMetrics.weight` / `bodyMetrics?.bodyFat` etc. is the thing
    // that must never appear. The `bodyMetricsLogged` boolean is fine.
    if (/bodyMetrics\s*[?.]*\s*\.\s*\w+/.test(source)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'these modules read a body-metric value')
})
