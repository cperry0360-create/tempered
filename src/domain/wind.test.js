import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { windAwards } from './wind.js'
import { totalsBySource } from './xp-engine.js'

const balance = loadBalance()
const src = (awards) => totalsBySource(awards)

test('SOURCE: distance pays per mile', () => {
  const xp = src(windAwards([{ activityId: 'run', distanceMiles: 3 }], null, null, null, balance))
  assert.equal(xp['wind.distance'], 3 * balance.wind.xpPerMile)
})

test('distance flattens past the daily threshold', () => {
  const cap = balance.wind.mileSoftCapPerDay
  const atCap = src(windAwards([{ activityId: 'run', distanceMiles: cap }], null, null, null, balance))['wind.distance']
  const double = src(windAwards([{ activityId: 'run', distanceMiles: cap * 2 }], null, null, null, balance))['wind.distance']
  assert.ok(double > atCap && double < atCap * 2)
})

test('SOURCE: cardio minutes pay per minute', () => {
  const xp = src(windAwards([{ activityId: 'heavy_bag', minutes: 20 }], null, null, null, balance))
  assert.equal(xp['wind.minutes'], 20 * balance.wind.xpPerCardioMinute)
})

test('a run logged with both distance and time is not paid twice', () => {
  const awards = windAwards([{ activityId: 'run', distanceMiles: 3, minutes: 27 }], null, null, null, balance)
  const xp = src(awards)
  assert.equal(xp['wind.distance'], 3 * balance.wind.xpPerMile)
  assert.equal(xp['wind.minutes'], undefined)
})

test('SOURCE: steps pay per thousand', () => {
  const xp = src(windAwards([], 8000, null, null, balance))
  assert.equal(xp['wind.steps'], 8 * balance.wind.xpPerThousandSteps)
})

test('steps are capped daily', () => {
  const cap = balance.wind.stepsDailyCap
  const atCap = src(windAwards([], cap, null, null, balance))['wind.steps']
  const wayOver = src(windAwards([], cap * 5, null, null, balance))['wind.steps']
  assert.equal(wayOver, atCap)
})

test('SOURCE: mobility minutes pay at the cardio rate', () => {
  const xp = src(windAwards([], null, 15, null, balance))
  assert.equal(xp['wind.minutes'], 15 * balance.wind.xpPerCardioMinute)
})

test('SOURCE: beating the rolling pace baseline pays a bonus', () => {
  // 3 miles in 24 minutes is 8:00/mile, against a 9:00 baseline.
  const xp = src(windAwards([{ activityId: 'run', distanceMiles: 3, minutes: 24 }], null, null, 9, balance))
  assert.equal(xp['wind.pace'], balance.wind.paceImprovementBonus)
})

test('a slower-than-baseline run is never punished, only unbonused', () => {
  const awards = windAwards([{ activityId: 'run', distanceMiles: 3, minutes: 33 }], null, null, 9, balance)
  assert.equal(src(awards)['wind.pace'], undefined)
  for (const award of awards) assert.ok(award.xp >= 0)
})

test('with no baseline yet, pace simply does not fire', () => {
  const xp = src(windAwards([{ activityId: 'run', distanceMiles: 3, minutes: 15 }], null, null, null, balance))
  assert.equal(xp['wind.pace'], undefined)
})
