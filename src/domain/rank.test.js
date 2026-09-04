import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { rankFromLevels, totalLevels } from './rank.js'

const balance = loadBalance()

/** @param {number} n */
const allAt = (n) => ({ might: n, wind: n, grit: n, vitality: n, mind: n })

test('a brand new character is rank F', () => {
  assert.equal(rankFromLevels(allAt(0), balance), 'F')
})

test('rank is derived from the total of the five levels', () => {
  assert.equal(totalLevels({ might: 3, wind: 2, grit: 4, vitality: 1, mind: 0 }), 10)
})

test('each threshold in balance.json produces its letter', () => {
  for (const [letter, threshold] of Object.entries(balance.rank.thresholds)) {
    const levels = { might: threshold, wind: 0, grit: 0, vitality: 0, mind: 0 }
    assert.equal(rankFromLevels(levels, balance), letter, `total ${threshold} should be ${letter}`)
  }
})

test('one below a threshold does not promote', () => {
  const dThreshold = balance.rank.thresholds.D
  const levels = { might: dThreshold - 1, wind: 0, grit: 0, vitality: 0, mind: 0 }
  assert.equal(rankFromLevels(levels, balance), 'E')
})

test('a maxed character reaches S', () => {
  assert.equal(rankFromLevels(allAt(balance.levelCurve.maxLevel), balance), 'S')
})
