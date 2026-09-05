/**
 * The battle service — Phase 6.
 *
 * `battle.test.js` in the domain proves the resolution is deterministic. This
 * proves the things that only exist once storage is involved: that a day is
 * generated once, that rewards land at generation, and that watching cannot
 * change any of it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createBattleService } from './battle.js'

const balance = loadBalance()
const R = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const roster = R('../../data/enemies.json').enemies
const items = R('../../data/items.json').items

async function app(at = '2026-09-05T07:00:00.000Z', levels = 8, useBalance = balance) {
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('profile', { id: 'profile', name: 'Cory' })
  await storage.putAll('attributeState', ['might', 'wind', 'grit', 'vitality', 'mind']
    .map((attribute) => ({ attribute, xp: 1000, level: levels, lifetimeSources: {} })))
  const clock = fixedClock(at)
  return { storage, clock, battle: createBattleService({ storage, clock, balance: useBalance, roster, items }) }
}

test('a day generates exactly one battle, however often it is asked for', async () => {
  const { storage, battle } = await app()
  const first = await battle.forDate()
  const second = await battle.forDate()
  assert.deepEqual(second, first)
  assert.equal((await storage.getAll('battles')).length, 1)
})

test('asking for the same day again never pays again', async () => {
  const { storage, battle } = await app()
  const record = await battle.forDate()
  for (let i = 0; i < 5; i += 1) await battle.forDate()
  assert.equal((await storage.get('profile', 'profile')).gold, record.rewards.gold,
    'the day was paid for more than once')
})

test('nor does it collect the loot twice', async () => {
  const { battle } = await app()
  await battle.forDate()
  const after = (await battle.purse()).loot.length
  for (let i = 0; i < 5; i += 1) await battle.forDate()
  assert.equal((await battle.purse()).loot.length, after)
})

test('ACCEPTANCE: rewards are granted on generation, not on watching', async () => {
  const { storage, battle } = await app()
  const record = await battle.forDate()
  const afterGenerate = (await storage.get('profile', 'profile')).gold
  assert.equal(afterGenerate, record.rewards.gold, 'gold was not paid when the battle was made')

  await battle.markWatched()
  assert.equal((await storage.get('profile', 'profile')).gold, afterGenerate,
    'watching changed the reward')
})

test('ACCEPTANCE: never opening the screen costs no progression', async () => {
  const watcher = await app()
  const ignorer = await app()
  await watcher.battle.forDate()
  await watcher.battle.markWatched()
  await ignorer.battle.forDate()

  const purse = async (a) => JSON.stringify(await a.battle.purse())
  assert.equal(await purse(watcher), await purse(ignorer))
})

test('re-asking never re-rolls the loot', async () => {
  const { battle } = await app()
  const first = await battle.forDate()
  for (let i = 0; i < 10; i += 1) {
    assert.deepEqual((await battle.forDate()).rewards, first.rewards)
  }
})

test('watching twice does not pay twice', async () => {
  const { storage, battle } = await app()
  const record = await battle.forDate()
  await battle.markWatched()
  await battle.markWatched()
  assert.equal((await storage.get('profile', 'profile')).gold, record.rewards.gold)
})

test('a different day is a different battle, and both are kept', async () => {
  const { storage, clock, battle } = await app()
  const monday = await battle.forDate()
  clock.advanceDays(1)
  const tuesday = await battle.forDate()
  assert.notEqual(tuesday.seed, monday.seed)
  assert.equal((await storage.getAll('battles')).length, 2)
})

test('gold accumulates across days rather than replacing', async () => {
  const { storage, clock, battle } = await app()
  const monday = await battle.forDate()
  clock.advanceDays(1)
  const tuesday = await battle.forDate()
  assert.equal((await storage.get('profile', 'profile')).gold,
    monday.rewards.gold + tuesday.rewards.gold)
})

test('battle defeats never award attribute XP, even if balance tries to enable it', async () => {
  const impossibleToEnable = {
    ...balance,
    battle: { ...balance.battle, xpPerEnemy: 9999, xpAttribute: 'might' },
  }
  const { storage, battle } = await app('2026-09-05T07:00:00.000Z', 8, impossibleToEnable)
  const before = (await storage.getAll('attributeState')).map((r) => ({ ...r }))
  await battle.forDate()
  assert.deepEqual(await storage.getAll('attributeState'), before)
})

test('a character who has never trained still gets a battle', async () => {
  const { battle } = await app('2026-09-05T07:00:00.000Z', 0)
  const record = await battle.forDate()
  assert.ok(record.gauntlet.length > 0)
  assert.ok(record.rewards.gold >= 0)
})

test('loot is kept on the profile with the day it was won', async () => {
  const { storage, clock, battle } = await app()
  for (let i = 0; i < 20; i += 1) {
    await battle.forDate()
    clock.advanceDays(1)
  }
  const { loot } = await battle.purse()
  assert.ok(loot.length > 0, 'twenty days produced no loot at all')
  for (const item of loot) {
    assert.ok(item.wonOn, 'an item arrived without the day it was won')
    assert.ok(item.name)
  }
})
