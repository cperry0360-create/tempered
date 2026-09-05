import test from 'node:test'
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

async function app() {
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('profile', { id: 'profile', name: 'Cory' })
  await storage.putAll('attributeState', ['might', 'wind', 'grit', 'vitality', 'mind']
    .map((attribute) => ({ attribute, xp: 1000, level: 8, lifetimeSources: {} })))
  const clock = fixedClock('2026-09-05T07:00:00.000Z')
  return { storage, battle: createBattleService({ storage, clock, balance, roster, items }) }
}

test('opening the interactive battle lazily checkpoints turn state', async () => {
  const { storage, battle } = await app()
  const record = await battle.stateForDate()
  assert.equal(record.turnState.status, 'active')
  assert.deepEqual((await storage.get('battles', record.date)).turnState, record.turnState)
})

test('a manual action is persisted and survives a service re-read', async () => {
  const { storage, battle } = await app()
  const before = await battle.stateForDate()
  const after = await battle.act('attack')
  assert.equal(after.turnState.turn, before.turnState.turn + 1)
  assert.deepEqual((await storage.get('battles', after.date)).turnState, after.turnState)
})

test('turn actions never pay the daily reward twice', async () => {
  const { storage, battle } = await app()
  const record = await battle.stateForDate()
  const gold = (await storage.get('profile', 'profile')).gold
  await battle.act('attack')
  await battle.act('guard')
  await battle.auto()
  assert.equal((await storage.get('profile', 'profile')).gold, gold)
  assert.equal(gold, record.rewards.gold)
})

test('SKIP finishes immediately without changing the purse', async () => {
  const { battle } = await app()
  await battle.stateForDate()
  const purse = JSON.stringify(await battle.purse())
  const skipped = await battle.skip()
  assert.equal(skipped.turnState.status, 'finished')
  assert.equal(JSON.stringify(await battle.purse()), purse)
})

test('restarting a finished battle gives a fresh practice state but no new reward', async () => {
  const { battle } = await app()
  await battle.skip()
  const purse = JSON.stringify(await battle.purse())
  const replay = await battle.restart()
  assert.equal(replay.turnState.status, 'active')
  assert.equal(replay.turnState.turn, 0)
  assert.equal(JSON.stringify(await battle.purse()), purse)
})
