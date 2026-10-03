import test from 'node:test'
import assert from 'node:assert/strict'

import { trainingReadiness } from './readiness.js'

test('trainingReadiness combines today sleep with HRV and resting-HR baselines', () => {
  const days = [
    { date: '2026-09-10', healthMetrics: { hrvMs: 50, restingHr: 58 } },
    { date: '2026-09-11', healthMetrics: { hrvMs: 52, restingHr: 57 } },
    { date: '2026-09-12', healthMetrics: { hrvMs: 48, restingHr: 59 } },
    { date: '2026-09-13', sleepHours: 8, healthMetrics: { hrvMs: 55, restingHr: 56 } },
  ]

  const result = trainingReadiness(days, '2026-09-13')
  assert.equal(result.score, 89)
  assert.equal(result.label, 'Ready')
  assert.deepEqual(result.signals.map((signal) => signal.key), ['sleep', 'hrv', 'restingHr'])
})

test('trainingReadiness does not invent a score without a usable recovery signal', () => {
  const result = trainingReadiness([{ date: '2026-09-13', steps: 9000 }], '2026-09-13')
  assert.equal(result.score, null)
  assert.equal(result.label, 'Import recovery data')
  assert.deepEqual(result.signals, [])
})

test('trainingReadiness can use sleep alone and labels limited coverage', () => {
  const result = trainingReadiness([{ date: '2026-09-13', sleepHours: 6 }], '2026-09-13')
  assert.equal(result.score, 85)
  assert.equal(result.label, 'Steady')
  assert.equal(result.coverage, 'limited')
})

const history = (hrv, resting, count = 7) => Array.from({ length: count }, (_, index) => ({
  date: `2026-09-0${index + 1}`, healthMetrics: { hrvMs: hrv, restingHr: resting },
}))

test('each signal carries a plain-word status and tone', () => {
  const days = [...history(40, 60), { date: '2026-09-08', sleepHours: 8, healthMetrics: { hrvMs: 40, restingHr: 60 } }]
  const byKey = Object.fromEntries(trainingReadiness(days, '2026-09-08').signals.map((s) => [s.key, s.status]))
  assert.deepEqual(byKey.sleep, { text: 'On target', tone: 'good' })
  assert.deepEqual(byKey.hrv, { text: 'Normal', tone: 'usual' })
  assert.deepEqual(byKey.restingHr, { text: 'Normal', tone: 'usual' })
})

test('statuses flag the direction that matters for each metric', () => {
  const low = trainingReadiness([...history(40, 60), { date: '2026-09-08', sleepHours: 6, healthMetrics: { hrvMs: 30, restingHr: 64 } }], '2026-09-08')
  const lowBy = Object.fromEntries(low.signals.map((s) => [s.key, s.status]))
  assert.deepEqual(lowBy.sleep, { text: 'Short', tone: 'low' })
  assert.deepEqual(lowBy.hrv, { text: 'Below normal', tone: 'low' })
  assert.deepEqual(lowBy.restingHr, { text: 'Elevated', tone: 'low' })

  const high = trainingReadiness([...history(40, 60), { date: '2026-09-08', sleepHours: 9.5, healthMetrics: { hrvMs: 46, restingHr: 57 } }], '2026-09-08')
  const highBy = Object.fromEntries(high.signals.map((s) => [s.key, s.status]))
  assert.deepEqual(highBy.sleep, { text: 'Long', tone: 'usual' })
  assert.deepEqual(highBy.hrv, { text: 'Above normal', tone: 'good' })
  assert.deepEqual(highBy.restingHr, { text: 'Lower', tone: 'good' })
})

test('the reason names what is pulling readiness down, in one sentence', () => {
  // The reported case: good sleep, resting HR about normal, HRV well below normal.
  const days = [...history(41, 61), { date: '2026-09-08', sleepHours: 8, healthMetrics: { hrvMs: 29.3, restingHr: 62 } }]
  const result = trainingReadiness(days, '2026-09-08')
  assert.equal(result.label, 'Steady')
  assert.equal(result.reason, 'HRV is below your normal; sleep and resting HR look fine.')

  const both = trainingReadiness([...history(40, 60), { date: '2026-09-08', sleepHours: 5, healthMetrics: { hrvMs: 30, restingHr: 65 } }], '2026-09-08')
  assert.equal(both.label, 'Recover')
  assert.equal(both.reason, 'Sleep was short, HRV is below your normal and resting HR is elevated.')

  const ready = trainingReadiness([...history(40, 60), { date: '2026-09-08', sleepHours: 8, healthMetrics: { hrvMs: 44, restingHr: 58 } }], '2026-09-08')
  assert.equal(ready.label, 'Ready')
  assert.equal(ready.reason, 'Sleep, HRV and resting HR are all at or better than your normal.')
})

test('the reason says when only sleep is available', () => {
  const result = trainingReadiness([{ date: '2026-09-13', sleepHours: 8 }], '2026-09-13')
  assert.equal(result.reason, 'Sleep is on target. HRV and resting HR need a few days of history first.')
})

test('readiness copy never frames recovery as failure', () => {
  const recover = trainingReadiness([...history(40, 60), { date: '2026-09-08', sleepHours: 5, healthMetrics: { hrvMs: 30, restingHr: 65 } }], '2026-09-08')
  assert.match(recover.action, /recovery/i)
  assert.doesNotMatch(`${recover.action} ${recover.reason}`, /fail|bad|poor|lost/i)
})
