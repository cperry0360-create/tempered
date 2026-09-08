import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyExpeditionUpgrades,
  expeditionChoices,
  splitGauntlet,
} from './expedition.js'

const hero = { health: 100, damage: 20, defence: 4, attackSpeed: 1, crit: 0.1 }

test('ACCEPTANCE: each encounter offers three deterministic upgrades', () => {
  const first = expeditionChoices(12345, 0).map((choice) => choice.id)
  const repeat = expeditionChoices(12345, 0).map((choice) => choice.id)
  assert.equal(first.length, 3)
  assert.deepEqual(first, repeat)
  assert.equal(new Set(first).size, 3)
})

test('owned upgrades are avoided while enough alternatives remain', () => {
  const choices = expeditionChoices(12345, 1, ['tempered_edge', 'iron_skin']).map((choice) => choice.id)
  assert.equal(choices.includes('tempered_edge'), false)
  assert.equal(choices.includes('iron_skin'), false)
})

test('temporary upgrades materially change the battle build', () => {
  const result = applyExpeditionUpgrades(hero, ['tempered_edge', 'iron_skin', 'deep_focus'])
  assert.equal(result.hero.damage > hero.damage, true)
  assert.equal(result.hero.health > hero.health, true)
  assert.equal(result.hero.defence, 6)
  assert.equal(result.focusBonus, 2)
})

test('Field Rations creates between-encounter recovery without changing permanent stats', () => {
  const result = applyExpeditionUpgrades(hero, ['field_rations'])
  assert.equal(result.healFraction, 0.25)
  assert.equal(result.hero.damage, hero.damage)
})

test('a six-enemy gauntlet becomes three two-enemy encounters', () => {
  const groups = splitGauntlet([1, 2, 3, 4, 5, 6], 3)
  assert.deepEqual(groups, [[1, 2], [3, 4], [5, 6]])
})
