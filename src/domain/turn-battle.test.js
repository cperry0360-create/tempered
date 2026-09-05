import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { loadBalance } from '../../test/helpers/balance.js'
import { generateBattle } from './battle.js'
import { createTurnBattle, takeTurn, autoTurnBattle, skipTurnBattle } from './turn-battle.js'

const balance = loadBalance()
const R = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const roster = R('../../data/enemies.json').enemies
const items = R('../../data/items.json').items

const record = generateBattle({
  profileId: 'cory',
  date: '2026-09-05',
  levels: { might: 8, wind: 8, grit: 8, vitality: 8, mind: 8 },
  roster,
  items,
  balance,
  rank: 'C',
})

test('turn battle starts at full health and full focus against the first enemy', () => {
  const state = createTurnBattle(record, balance)
  assert.equal(state.heroHp, record.hero.health)
  assert.equal(state.focus, balance.battle.turnFocus)
  assert.equal(state.enemyIndex, 0)
  assert.equal(state.enemyHp, record.gauntlet[0].hp)
  assert.equal(state.status, 'active')
})

test('ATTACK is deterministic for the same state and day', () => {
  const state = createTurnBattle(record, balance)
  assert.deepEqual(
    takeTurn(state, 'attack', record, balance),
    takeTurn(state, 'attack', record, balance),
  )
})

test('SKILL spends one focus and deals more opening damage than ATTACK when neither crits', () => {
  const noCritRecord = { ...record, hero: { ...record.hero, crit: 0 } }
  const state = createTurnBattle(noCritRecord, balance)
  const attack = takeTurn(state, 'attack', noCritRecord, balance)
  const skill = takeTurn(state, 'skill', noCritRecord, balance)
  const attackHit = attack.log.find((event) => event.kind === 'attack')
  const skillHit = skill.log.find((event) => event.kind === 'skill')
  assert.equal(skill.focus, state.focus - 1)
  assert.ok(skillHit.damage > attackHit.damage, `${skillHit.damage} was not > ${attackHit.damage}`)
})

test('SKILL with no focus does nothing', () => {
  const state = { ...createTurnBattle(record, balance), focus: 0 }
  assert.deepEqual(takeTurn(state, 'skill', record, balance), state)
})

test('GUARD restores focus and marks any enemy hit as guarded', () => {
  const state = { ...createTurnBattle(record, balance), focus: 0 }
  const guarded = takeTurn(state, 'guard', record, balance)
  assert.equal(guarded.focus, 1)
  assert.ok(guarded.heroHp <= state.heroHp)
  const hit = guarded.log.findLast((event) => event.kind === 'enemyHit')
  if (hit) assert.equal(hit.guarded, true)
})

test('AUTO always terminates without changing the generated rewards', () => {
  const state = createTurnBattle(record, balance)
  const auto = autoTurnBattle(state, record, balance)
  assert.equal(auto.status, 'finished')
  assert.ok(typeof auto.won === 'boolean')
  assert.equal(record.rewards.xp, 0)
})

test('SKIP uses the canonical daily result', () => {
  const state = createTurnBattle(record, balance)
  const skipped = skipTurnBattle(state, record)
  assert.equal(skipped.status, 'finished')
  assert.equal(skipped.won, record.won)
  assert.equal(skipped.defeated, record.defeated)
  assert.equal(skipped.heroHp, record.remainingHealth)
})

test('turn play cannot manufacture rewards or character XP', () => {
  let state = createTurnBattle(record, balance)
  state = takeTurn(state, 'attack', record, balance)
  state = takeTurn(state, state.focus > 0 ? 'skill' : 'attack', record, balance)
  assert.equal('rewards' in state, false)
  assert.equal('xp' in state, false)
  assert.equal(record.rewards.xp, 0)
})
