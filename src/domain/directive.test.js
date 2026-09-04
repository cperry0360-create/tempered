import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { createInitialState } from './xp-engine.js'
import { generateDirective } from './directive.js'
import { xpForLevel } from './levels.js'

const balance = loadBalance()

test('a directive targets the attribute nearest its next threshold', () => {
  const state = createInitialState()
  state.might.xp = xpForLevel(1, balance) - 10   // 10 XP away
  state.wind.xp = xpForLevel(1, balance) - 200   // much further
  const rates = { might: 100, wind: 100, grit: 100, vitality: 100, mind: 100 }

  const directive = generateDirective(state, rates, balance)
  assert.equal(directive.attribute, 'might')
  assert.equal(directive.targetLevel, 1)
})

test('nearness is measured in days at the user\'s own rate, not raw XP', () => {
  const state = createInitialState()
  // Mind needs more XP, but earns far faster, so it is nearer in time.
  state.mind.xp = xpForLevel(1, balance) - 400
  state.grit.xp = xpForLevel(1, balance) - 100
  const directive = generateDirective(state, { mind: 200, grit: 5 }, balance)
  assert.equal(directive.attribute, 'mind')
})

test('the directive names the tier it unlocks', () => {
  const state = createInitialState()
  state.grit.xp = xpForLevel(3, balance)
  const directive = generateDirective(state, { grit: 100 }, balance)
  assert.equal(directive.targetLevel, 4)
  assert.equal(directive.targetTier, 'Disciplined')
  assert.match(directive.headline, /Reach Grit level 4/)
})

test('only one directive is active at a time', () => {
  const directive = generateDirective(createInitialState(), { might: 50 }, balance)
  assert.equal(balance.directive.maxActive, 1)
  assert.ok(directive && !Array.isArray(directive))
})

test('a directive never requires consecutive days', () => {
  assert.equal(balance.directive.neverRequireConsecutiveDays, true)
  const directive = generateDirective(createInitialState(), { might: 50 }, balance)
  const text = `${directive.headline} ${directive.detail}`
  assert.ok(!/streak|consecutive|in a row|every day/i.test(text), text)
})

test('a brand new character with no history still gets a directive', () => {
  const directive = generateDirective(createInitialState(), {}, balance)
  assert.ok(directive)
  assert.equal(directive.targetLevel, 1)
  assert.equal(directive.estimatedDays, Infinity)
  assert.match(directive.detail, /XP remaining/)
})

test('a fully maxed character has nothing left to be directed toward', () => {
  const state = createInitialState()
  const maxXp = xpForLevel(balance.levelCurve.maxLevel, balance)
  for (const id of ['might', 'wind', 'grit', 'vitality', 'mind']) state[id].xp = maxXp
  assert.equal(generateDirective(state, { might: 100 }, balance), null)
})

test('withinTarget reflects the configured two-week window', () => {
  const state = createInitialState()
  state.might.xp = 0
  const needed = xpForLevel(1, balance)
  const fast = generateDirective(state, { might: needed }, balance)          // 1 day
  const slow = generateDirective(state, { might: needed / 400 }, balance)    // 400 days
  assert.equal(fast.withinTarget, true)
  assert.equal(slow.withinTarget, false)
})
