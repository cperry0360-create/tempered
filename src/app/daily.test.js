/**
 * The daily service — Phase 4.
 *
 * The interesting risk here is not scoring, which the domain already does and
 * Phase 1 already tested. It is settlement: a day is logged a piece at a time,
 * and the XP for a piece must be paid exactly once however many times the day is
 * re-scored around it. Logging water four times must not pay for the morning's
 * sleep four times over.
 *
 * The rest is the two hard rules, checked at the level a user would meet them:
 * rest earns, and a body weight never does.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { createManualHealth } from '../adapters/health/manual-health.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createDailyService } from './daily.js'
import { ensureProfile } from './seed.js'

const balance = loadBalance()
const seed = JSON.parse(readFileSync(new URL('../../data/activities.json', import.meta.url), 'utf8'))

async function freshDay(at = '2026-09-04T09:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await ensureProfile(storage, clock)
  const health = createManualHealth(storage)
  return {
    storage, clock, health,
    daily: createDailyService({ storage, clock, health, balance, catalogue: seed }),
  }
}

const vitalityXp = async (storage) => (await storage.get('attributeState', 'vitality'))?.xp ?? 0
const mindXp = async (storage) => (await storage.get('attributeState', 'mind'))?.xp ?? 0
/** XP is banked in whole points — see applyAwards. Awards are exact; the ledger rounds. */
const banked = (xp) => Math.round(xp)

test('a fresh day is entirely outstanding, and nothing about that is a failure', async () => {
  const { daily } = await freshDay()
  const today = await daily.today()
  assert.equal(today.logged.length, 0)
  assert.equal(today.outstanding.length, seed.activities.length)
  assert.equal(today.date, '2026-09-04')
})

test('one tap logs a marked activity and pays it once', async () => {
  const { daily, storage } = await freshDay()
  const result = await daily.log('journal')
  assert.equal(result.xpByAttribute.mind, balance.mind.journalXp)
  assert.equal(await mindXp(storage), balance.mind.journalXp)

  const today = await daily.today()
  assert.deepEqual(today.logged.map((a) => a.id), ['journal'])
})

test('SETTLEMENT: logging a second activity does not re-pay the first', async () => {
  const { daily, storage } = await freshDay()
  await daily.log('sleep', 8)
  const afterSleep = await vitalityXp(storage)
  assert.equal(afterSleep, balance.vitality.sleepXpInBand)

  const water = await daily.log('water', 32)
  assert.equal(water.xpByAttribute.vitality, 32 * balance.vitality.xpPerOunceWater,
    'the award reported is the water alone, not the day so far')
  assert.equal(await vitalityXp(storage), afterSleep + banked(32 * balance.vitality.xpPerOunceWater))
})

test('SETTLEMENT: adding to a running total pays only for what was added', async () => {
  const { daily, storage } = await freshDay()
  await daily.log('water', 16)
  const first = await vitalityXp(storage)
  await daily.log('water', 16)
  const second = await vitalityXp(storage)
  assert.equal(second - first, banked(16 * balance.vitality.xpPerOunceWater))
  assert.equal(second, 2 * banked(16 * balance.vitality.xpPerOunceWater))
})

test('SETTLEMENT: correcting a value downwards never takes XP back', async () => {
  // Nothing in this app subtracts. A mistyped 12,000 corrected to 4,000 leaves
  // the XP where it was rather than clawing any of it back.
  const { daily, storage } = await freshDay()
  await daily.log('steps', 12000)
  const paid = (await storage.get('attributeState', 'wind')).xp
  assert.ok(paid > 0)
  await daily.log('steps', 4000)
  assert.equal((await storage.get('attributeState', 'wind')).xp, paid,
    'a correction downward is not a punishment')
})

test('SETTLEMENT: re-raising a corrected value does not pay twice', async () => {
  const { daily, storage } = await freshDay()
  await daily.log('steps', 10000)
  const paid = (await storage.get('attributeState', 'wind')).xp
  await daily.log('steps', 2000)
  await daily.log('steps', 10000)
  assert.equal((await storage.get('attributeState', 'wind')).xp, paid,
    'the day has already been paid up to 10,000 steps')
})

test('SETTLEMENT: what has been paid is recorded on the day itself', async () => {
  const { daily, storage } = await freshDay()
  await daily.log('journal')
  const day = await storage.get('dayLogs', '2026-09-04')
  assert.equal(day.awarded['mind.journal'], balance.mind.journalXp)
})

test('a new day starts its own settlement', async () => {
  const { daily, storage, clock } = await freshDay()
  await daily.log('sleep', 8)
  clock.advanceDays(1)
  const today = await daily.today()
  assert.equal(today.date, '2026-09-05')
  assert.equal(today.logged.length, 0, 'yesterday is not today')

  const before = await vitalityXp(storage)
  await daily.log('sleep', 8)
  assert.equal(await vitalityXp(storage), before + balance.vitality.sleepXpInBand)
})

test('ACCEPTANCE: rest day is a first-class rewarded action', async () => {
  const { daily, storage } = await freshDay()
  const result = await daily.log('rest_day')
  assert.equal(result.xpByAttribute.vitality, balance.vitality.restDayXp)
  assert.ok(await vitalityXp(storage) > 0)
  // And it is worth more than a shrug: recovery is half the process.
  assert.ok(balance.vitality.restDayXp > balance.vitality.nutritionLoggedXp)
})

test('ACCEPTANCE: a body metric shows the number back and scores only the act', async () => {
  const { daily, storage } = await freshDay()
  const light = await daily.log('body_metrics', 150)
  assert.equal(light.xpByAttribute.vitality, balance.vitality.bodyMetricsLoggedXp)

  const today = await daily.today()
  const entry = today.logged.find((a) => a.id === 'body_metrics')
  assert.equal(entry.value, 150, 'the number is kept, to be shown back')

  // Re-weighing changes the number shown and nothing about what the day earned.
  const paid = await vitalityXp(storage)
  await daily.log('body_metrics', 250)
  assert.equal(await vitalityXp(storage), paid, 'a heavier reading pays nothing more')
  assert.equal((await daily.today()).logged.find((a) => a.id === 'body_metrics').value, 250)
})

test('the health adapter and the day log are the same day', async () => {
  const { daily, health } = await freshDay()
  await daily.log('steps', 8000)
  const sample = await health.read('2026-09-04')
  assert.equal(sample.steps, 8000)

  // And a device writing through the adapter is visible to the screen.
  await health.write('2026-09-04', { sleepHours: 7.5 })
  const today = await daily.today()
  assert.equal(today.logged.find((a) => a.id === 'sleep').value, 7.5)
})

test('XP owed for a value written straight to the adapter is settled on next log', async () => {
  // A device sample arrives without going through log(). The day must still pay
  // for it, and pay for it once.
  const { daily, health, storage } = await freshDay()
  await health.write('2026-09-04', { sleepHours: 8 })
  await daily.settle()
  assert.equal(await vitalityXp(storage), balance.vitality.sleepXpInBand)
  await daily.settle()
  assert.equal(await vitalityXp(storage), balance.vitality.sleepXpInBand, 'settled twice, paid once')
})

test('an unknown activity is ignored rather than throwing at the user', async () => {
  const { daily, storage } = await freshDay()
  const result = await daily.log('interpretive_dance', 3)
  assert.equal(result.awards.length, 0)
  assert.equal(await vitalityXp(storage), 0)
})

test('levels and rank come back, so the surface can say what changed', async () => {
  const { daily } = await freshDay()
  const result = await daily.log('rest_day')
  assert.ok(Array.isArray(result.levelledUp))
  assert.deepEqual(Object.keys(result.levels).sort(), ['grit', 'might', 'mind', 'vitality', 'wind'])
  assert.equal(typeof result.rank, 'string')
})

test('a day of honest logging levels Vitality, and says so once', async () => {
  const { daily } = await freshDay()
  await daily.log('sleep', 8)
  await daily.log('water', 100)
  await daily.log('nutrition_logged')
  await daily.log('protein_target')
  await daily.log('body_metrics', 184)
  const rest = await daily.log('rest_day')
  assert.deepEqual(rest.levelledUp.map((up) => up.attribute), ['vitality'],
    'the level-up is announced by the entry that caused it, and not again after')
  assert.equal(rest.levels.vitality, 1)

  const again = await daily.log('journal')
  assert.deepEqual(again.levelledUp, [], 'and never a second time for the same level')
})
