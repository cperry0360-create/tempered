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
