import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { xpForLevel, levelFromXp, levelProgress } from './levels.js'

const balance = loadBalance()

test('xpForLevel follows base * n^exponent from balance.json', () => {
  const { base, exponent } = balance.levelCurve
  assert.equal(xpForLevel(1, balance), base)
  assert.equal(xpForLevel(4, balance), base * Math.pow(4, exponent))
})

test('level 0 costs nothing', () => {
  assert.equal(xpForLevel(0, balance), 0)
})

test('the curve is superlinear: each level costs more than the one before', () => {
  for (let n = 2; n <= balance.levelCurve.maxLevel; n++) {
    const thisStep = xpForLevel(n, balance) - xpForLevel(n - 1, balance)
    const prevStep = xpForLevel(n - 1, balance) - xpForLevel(n - 2, balance)
    assert.ok(thisStep > prevStep, `level ${n} should cost more than level ${n - 1}`)
  }
})

test('levelFromXp returns the highest level whose threshold is met', () => {
  assert.equal(levelFromXp(0, balance), 0)
  assert.equal(levelFromXp(xpForLevel(1, balance) - 1, balance), 0)
  assert.equal(levelFromXp(xpForLevel(1, balance), balance), 1)
  assert.equal(levelFromXp(xpForLevel(5, balance), balance), 5)
  assert.equal(levelFromXp(xpForLevel(5, balance) - 1, balance), 4)
})

test('level is capped at maxLevel however much XP is thrown at it', () => {
  const max = balance.levelCurve.maxLevel
  assert.equal(levelFromXp(Number.MAX_SAFE_INTEGER, balance), max)
})

test('levelProgress reports position within the current level', () => {
  const atThree = xpForLevel(3, balance)
  const progress = levelProgress(atThree, balance)
  assert.equal(progress.level, 3)
  assert.equal(progress.xpIntoLevel, 0)
  assert.equal(progress.xpToNextLevel, xpForLevel(4, balance) - atThree)
  assert.equal(progress.fraction, 0)
  assert.equal(progress.isMax, false)
})

test('levelProgress at the cap reports isMax and no next level', () => {
  const progress = levelProgress(xpForLevel(balance.levelCurve.maxLevel, balance), balance)
  assert.equal(progress.isMax, true)
  assert.equal(progress.xpToNextLevel, 0)
  assert.equal(progress.fraction, 1)
})

test('fraction moves monotonically through a level', () => {
  const start = xpForLevel(2, balance)
  const span = xpForLevel(3, balance) - start
  assert.ok(levelProgress(start + span * 0.25, balance).fraction < 0.3)
  assert.ok(levelProgress(start + span * 0.75, balance).fraction > 0.7)
})
