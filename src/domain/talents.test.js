import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTalentsToHero, earnedTalentPoints, talentState } from './talents.js'

const balance = {
  battle: { critCap: 0.5 },
  talents: {
    pointEveryTotalLevels: 3,
    maxRankPerTalent: 3,
    damagePerRank: 0.05,
    healthPerRank: 0.05,
    defencePerRank: 1,
    speedPerRank: 0.04,
    critChancePerRank: 0.02,
  },
}

test('real-world attribute levels derive permanent talent points', () => {
  assert.equal(earnedTalentPoints({ might: 2, wind: 2, grit: 1, vitality: 1, mind: 0 }, balance), 2)
  assert.equal(earnedTalentPoints({ might: 10, wind: 10, grit: 10, vitality: 10, mind: 10 }, balance), 16)
})

test('spent ranks cannot create negative available points', () => {
  const state = talentState(
    { might: 1, wind: 1, grit: 1, vitality: 0, mind: 0 },
    { edge: 3, fortitude: 3 },
    balance,
  )
  assert.equal(state.earned, 1)
  assert.equal(state.spent, 6)
  assert.equal(state.available, 0)
})

test('talents change combat stats without touching attribute levels or XP', () => {
  const base = { health: 100, damage: 20, defence: 4, attackSpeed: 1.25, crit: 0.1 }
  const boosted = applyTalentsToHero(base, {
    edge: 2,
    fortitude: 1,
    bulwark: 3,
    quickstep: 1,
    keen_eye: 2,
  }, balance)

  assert.equal(boosted.damage, 22)
  assert.equal(boosted.health, 105)
  assert.equal(boosted.defence, 7)
  assert.equal(boosted.attackSpeed, 1.3)
  assert.equal(boosted.crit, 0.14)
  assert.deepEqual(base, { health: 100, damage: 20, defence: 4, attackSpeed: 1.25, crit: 0.1 })
})
