import test from 'node:test'
import assert from 'node:assert/strict'
import { companionCarePoints, companionLifestyleSignals } from './companion-care.js'

test('companion care has one shared formula for training and lifestyle progress', () => {
  const day = {
    sleepHours: 8,
    steps: 8000,
    waterOz: 80,
    nutritionLogged: true,
    alcoholFree: true,
  }
  assert.equal(companionLifestyleSignals(day), 5)
  assert.equal(companionCarePoints({
    sessions: [{ endedAt: '2026-09-10T12:00:00Z' }, { endedAt: null }],
    setLogs: [{ reps: 8 }, { reps: 10 }, { reps: 5, isWarmup: true }],
    days: [day],
  }), 22)
})
