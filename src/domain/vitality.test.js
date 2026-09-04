import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { vitalityAwards, sleepXp } from './vitality.js'
import { totalsBySource } from './xp-engine.js'

const balance = loadBalance()
const src = (awards) => totalsBySource(awards)

test('SOURCE: sleep peaks inside the band, and more is not better', () => {
  const [low, high] = balance.vitality.sleepBandHours
  assert.equal(sleepXp(low, balance), balance.vitality.sleepXpInBand)
  assert.equal(sleepXp(high, balance), balance.vitality.sleepXpInBand)
  assert.equal(sleepXp(8, balance), balance.vitality.sleepXpInBand)

  // Eleven hours is not better than eight.
  assert.ok(sleepXp(11, balance) < sleepXp(8, balance))
  assert.equal(sleepXp(high + 0.5, balance), balance.vitality.sleepXpNearBand)
  assert.equal(sleepXp(4, balance), balance.vitality.sleepXpOutOfBand)
})

test('short sleep still earns something — nothing is punished', () => {
  assert.ok(sleepXp(3, balance) > 0)
})

test('SOURCE: hydration pays per ounce up to the daily cap', () => {
  const cap = balance.vitality.waterDailyCapOz
  assert.equal(src(vitalityAwards({ date: 'd', waterOz: 64 }, balance))['vitality.water'],
    64 * balance.vitality.xpPerOunceWater)
  assert.equal(src(vitalityAwards({ date: 'd', waterOz: cap * 3 }, balance))['vitality.water'],
    cap * balance.vitality.xpPerOunceWater)
})

test('SOURCE: protein target met pays its bonus', () => {
  assert.equal(src(vitalityAwards({ date: 'd', proteinTargetMet: true }, balance))['vitality.protein'],
    balance.vitality.proteinTargetBonus)
})

test('SOURCE: logging nutrition is a marked award', () => {
  assert.equal(src(vitalityAwards({ date: 'd', nutritionLogged: true }, balance))['vitality.nutrition'],
    balance.vitality.nutritionLoggedXp)
})

test('SOURCE: a rest day is a rewarded action, not an absence', () => {
  const xp = src(vitalityAwards({ date: 'd', restDay: true }, balance))['vitality.rest']
  assert.equal(xp, balance.vitality.restDayXp)
  assert.ok(xp > 0, 'rest must pay')
})

test('SOURCE: logging body metrics pays for the habit', () => {
  assert.equal(src(vitalityAwards({ date: 'd', bodyMetricsLogged: true }, balance))['vitality.bodyMetrics'],
    balance.vitality.bodyMetricsLoggedXp)
})

test('an empty day earns nothing, and never negative', () => {
  assert.deepEqual(vitalityAwards({ date: 'd' }, balance), [])
})
