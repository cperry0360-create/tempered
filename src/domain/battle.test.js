/**
 * The daily battle — `docs/06-battle.md`, Phase 6.
 *
 * Three properties carry this whole feature, and they are what these tests are
 * mostly about:
 *
 *   - **Determinism.** The same seed must give the identical battle, forever.
 *     Loot that can be rerolled by replaying is loot that rewards fiddling with
 *     the app instead of training, which is the one thing this product exists
 *     not to do.
 *   - **Skipping costs nothing.** Rewards belong to the generated battle, not to
 *     watching it. A person who never opens the screen is not behind.
 *   - **Items cannot touch the character.** V1 items are flavour. An item that
 *     raised Might would break the premise that attributes reflect real work.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { battleSeed, heroFor, gauntletFor, resolveBattle, generateBattle } from './battle.js'

const balance = loadBalance()
const roster = JSON.parse(readFileSync(new URL('../../data/enemies.json', import.meta.url), 'utf8')).enemies
const items = JSON.parse(readFileSync(new URL('../../data/items.json', import.meta.url), 'utf8')).items

/** A character at a given level in every attribute. */
const levels = (n) => ({ might: n, wind: n, grit: n, vitality: n, mind: n })

// --- the seed --------------------------------------------------------------

test('the seed is a pure function of profile and date', () => {
  assert.equal(battleSeed('cory', '2026-09-05'), battleSeed('cory', '2026-09-05'))
})

test('a different day is a different battle', () => {
  assert.notEqual(battleSeed('cory', '2026-09-05'), battleSeed('cory', '2026-09-06'))
})

test('a different profile is a different battle on the same day', () => {
  assert.notEqual(battleSeed('cory', '2026-09-05'), battleSeed('someone-else', '2026-09-05'))
})

test('the seed is a finite integer, whatever it is handed', () => {
  for (const args of [['', ''], ['cory', '2026-09-05'], ['x'.repeat(500), '2026-01-01']]) {
    const seed = battleSeed(...args)
    assert.ok(Number.isInteger(seed) && Number.isFinite(seed), `${seed} from ${args}`)
  }
})

// --- hero stats ------------------------------------------------------------

test('hero stats derive from attributes, by the coefficients in balance', () => {
  const hero = heroFor(levels(10), balance)
  const b = balance.battle
  assert.equal(hero.health, b.healthBase + 10 * b.healthFromVitality + 10 * b.healthFromGrit)
  assert.equal(hero.damage, b.damageBase + 10 * b.damageFromMight)
  assert.equal(hero.attackSpeed, b.attackSpeedBase + 10 * b.attackSpeedFromWind)
  assert.equal(hero.defence, 10 * b.defenceFromGrit)
})

test('a level 0 character still has a hero, not a corpse', () => {
  const hero = heroFor(levels(0), balance)
  assert.ok(hero.health > 0 && hero.damage > 0 && hero.attackSpeed > 0)
})

test('training makes the hero stronger — that is the entire point', () => {
  const weak = heroFor(levels(1), balance)
  const strong = heroFor(levels(12), balance)
  for (const stat of ['health', 'damage', 'attackSpeed', 'crit', 'defence']) {
    assert.ok(strong[stat] > weak[stat], `${stat} did not grow with the character`)
  }
})

test('crit is a probability, never a number of percent', () => {
  assert.ok(heroFor(levels(0), balance).crit >= 0)
  assert.ok(heroFor(levels(99), balance).crit <= 1, 'crit must be capped at certainty')
})

// --- the gauntlet ----------------------------------------------------------

test('the gauntlet is the configured length and ends with the tougher enemy', () => {
  const gauntlet = gauntletFor(battleSeed('cory', '2026-09-05'), 'C', roster, balance)
  assert.equal(gauntlet.length, balance.battle.enemiesPerGauntlet)
  const last = gauntlet.at(-1)
  const others = gauntlet.slice(0, -1)
  assert.ok(others.every((e) => last.hp >= e.hp), 'the last enemy must be the hardest')
})

test('the same seed builds the same gauntlet', () => {
  const seed = battleSeed('cory', '2026-09-05')
  assert.deepEqual(
    gauntletFor(seed, 'C', roster, balance),
    gauntletFor(seed, 'C', roster, balance))
})

test('a higher rank meets harder enemies', () => {
  const seed = battleSeed('cory', '2026-09-05')
  const total = (rank) => gauntletFor(seed, rank, roster, balance)
    .reduce((sum, e) => sum + e.hp + e.damage, 0)
  assert.ok(total('S') > total('F'), 'rank S met no harder a gauntlet than rank F')
})

// --- resolution ------------------------------------------------------------

const battleAt = (level, date = '2026-09-05') => generateBattle({
  profileId: 'cory', date, levels: levels(level), roster, items, balance,
})

test('ACCEPTANCE: the same day resolves identically on every replay', () => {
  const a = battleAt(8)
  const b = battleAt(8)
  assert.deepEqual(a, b, 'a replayed battle differed from the first resolution')
})

test('ACCEPTANCE: loot cannot be rerolled by resolving again', () => {
  const runs = Array.from({ length: 25 }, () => battleAt(8))
  const first = JSON.stringify(runs[0].rewards)
  assert.ok(runs.every((r) => JSON.stringify(r.rewards) === first),
    'twenty-five resolutions produced more than one reward set')
})

test('the log is a sequence of events, not just a verdict', () => {
  const battle = battleAt(8)
  assert.ok(battle.events.length > 3, `only ${battle.events.length} events`)
  for (const event of battle.events) {
    assert.ok(typeof event.at === 'number' && Number.isFinite(event.at), 'every event is placed in time')
    assert.ok(typeof event.kind === 'string' && event.kind.length > 0)
  }
  const times = battle.events.map((e) => e.at)
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'events must be in time order')
})

test('the battle always ends, however lopsided', () => {
  // A level 0 character against rank S enemies must not loop forever.
  for (const level of [0, 1, 40]) {
    const battle = battleAt(level)
    assert.ok(battle.events.length < 6000, `${level} produced ${battle.events.length} events`)
    assert.ok(typeof battle.won === 'boolean')
  }
})

test('a stronger character meets harder enemies, not an easier day', () => {
  // Written the other way round first — "clears more of the gauntlet" — which
  // this design deliberately makes false. docs/06 asks for ~80% at EVERY rank,
  // so difficulty tracks the character and the clear rate stays put. What
  // actually grows is what you are fighting.
  const weak = battleAt(1)
  const strong = battleAt(20)
  const weight = (b) => b.gauntlet.reduce((sum, e) => sum + e.hp + e.damage, 0)
  assert.ok(weight(strong) > weight(weak),
    `level 20 met ${weight(strong)} of enemy against level 1's ${weight(weak)}`)
})

test('ACCEPTANCE: the gauntlet is winnable but not trivially so, at every rank', () => {
  // docs/06: "target roughly an 80% clear rate". The whole difficulty design
  // exists to hold this, so it is asserted rather than assumed — the first two
  // attempts read 0% from rank D upward, and then 100% everywhere.
  const target = balance.battle.clearRateTarget * 100
  for (const level of [0, 1, 3, 5, 8, 12, 20]) {
    let won = 0
    const days = 60
    for (let d = 1; d <= days; d += 1) {
      const date = `2026-${String((d % 12) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`
      if (battleAt(level, date).won) won += 1
    }
    const rate = (won / days) * 100
    assert.ok(Math.abs(rate - target) <= 18,
      `level ${level} cleared ${Math.round(rate)}% against a target of ${target}%`)
  }
})

// --- rewards ---------------------------------------------------------------

test('ACCEPTANCE: rewards come from generating the battle, not from watching it', () => {
  // There is no "watch" input at all — the rewards are on the record already.
  const battle = battleAt(8)
  assert.ok(battle.rewards, 'a generated battle carries its rewards')
  assert.ok(Object.keys(battle.rewards).length > 0)
})

test('losing still pays for the enemies that fell — nothing is confiscated', () => {
  // No punishment, non-negotiable 4. A loss is a smaller reward, never a debt.
  const lost = Array.from({ length: 40 }, (_, i) => battleAt(0, `2026-09-${String(i + 1).padStart(2, '0')}`))
    .find((b) => !b.won)
  assert.ok(lost, 'expected a level 0 character to lose at least one of forty days')
  assert.ok(lost.rewards.gold >= 0, 'gold went negative on a loss')
})

test('gold is paid per enemy defeated, at the configured rate', () => {
  const battle = battleAt(12)
  assert.equal(battle.rewards.gold, battle.defeated * balance.battle.goldPerEnemy)
})

test('no reward can ever be negative', () => {
  for (let day = 1; day <= 28; day += 1) {
    const battle = battleAt(3, `2026-09-${String(day).padStart(2, '0')}`)
    for (const [key, value] of Object.entries(battle.rewards)) {
      if (typeof value === 'number') assert.ok(value >= 0, `${key} was ${value}`)
    }
  }
})

test('ACCEPTANCE: items are flavour and cannot touch a combat stat or an attribute', () => {
  const forbidden = ['might', 'wind', 'grit', 'vitality', 'mind',
    'health', 'damage', 'attackSpeed', 'crit', 'defence', 'xp', 'bonus', 'modifier']
  for (const item of items) {
    for (const key of Object.keys(item)) {
      assert.ok(!forbidden.includes(key), `item ${item.id} carries "${key}"`)
    }
  }
  const dropped = Array.from({ length: 60 }, (_, i) =>
    battleAt(10, `2026-10-${String((i % 28) + 1).padStart(2, '0')}`).rewards.item).filter(Boolean)
  for (const item of dropped) {
    for (const key of Object.keys(item)) assert.ok(!forbidden.includes(key), `dropped item carries "${key}"`)
  }
})

test('the battle awards no attribute XP while the balance says zero', () => {
  // docs/06 lists "a small XP contribution"; CLAUDE.md says attributes grow from
  // measured performance. The mechanism exists and the value is config, so this
  // asserts what is SHIPPED rather than what is possible. See DECISIONS.md.
  assert.equal(balance.battle.xpPerEnemy, 0, 'balance turned battle XP on — is that intended?')
  assert.equal(battleAt(12).rewards.xp, 0)
})

test('turning battle XP on in config alone would pay it, with no code change', () => {
  // Non-negotiable 7: balance lives in config. Proves the switch is real rather
  // than decorative, so the decision stays Cory's.
  const tuned = { ...balance, battle: { ...balance.battle, xpPerEnemy: 3 } }
  const battle = generateBattle({
    profileId: 'cory', date: '2026-09-05', levels: levels(12), roster, items, balance: tuned,
  })
  assert.equal(battle.rewards.xp, battle.defeated * 3)
})
