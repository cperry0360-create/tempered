import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { makeContext, makeSession, unbeatableRecords } from '../../test/helpers/context.js'
import { mightAwards } from './might.js'
import { totalsBySource } from './xp-engine.js'

const balance = loadBalance()

/** @param {import('./types.js').Award[]} awards */
const bySource = (awards) => totalsBySource(awards)

test('SOURCE: working volume pays at the configured rate per thousand pounds', () => {
  // 145 x 8 x 3 = 3480 lbs of compound volume, below the soft cap.
  const session = makeSession({
    sets: Array.from({ length: 3 }, () => ({ exerciseId: 'squat_bb', weight: 145, reps: 8 })),
  })
  const context = makeContext({ records: unbeatableRecords(['squat_bb']) })
  const xp = bySource(mightAwards(session, context, balance))['might.volume']
  assert.equal(xp, (3480 / 1000) * balance.might.xpPerThousandLbsVolume)
})

test('isolation work counts at the reduced rate from balance.json', () => {
  const compound = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 100, reps: 10 }] })
  const isolation = makeSession({ sets: [{ exerciseId: 'leg_extension', weight: 100, reps: 10 }] })
  const context = makeContext({ records: unbeatableRecords(['squat_bb', 'leg_extension']) })

  const compoundXp = bySource(mightAwards(compound, context, balance))['might.volume']
  const isolationXp = bySource(mightAwards(isolation, context, balance))['might.volume']
  assert.equal(isolationXp, compoundXp * balance.might.isolationMultiplier)
})

test('the volume soft cap stops junk volume outscoring hard work', () => {
  const cap = balance.might.volumeSoftCapLbs
  const context = makeContext({ records: unbeatableRecords(['squat_bb']) })

  /** @param {number} volume */
  const xpFor = (volume) => {
    const session = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 100, reps: volume / 100 }] })
    return bySource(mightAwards(session, context, balance))['might.volume']
  }

  const atCap = xpFor(cap)
  const doubleCap = xpFor(cap * 2)
  assert.ok(doubleCap > atCap, 'more volume still earns more')
  assert.ok(doubleCap < atCap * 2, 'but doubling volume does not double XP')
})

test('SOURCE: a weight PR pays its bonus', () => {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 140, reps: 8, date: '2026-01-01' },
    bestVolume: { volume: 1e9, date: '2026-01-01' },
    bestE1RM: { value: 1e9, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const session = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 150, reps: 8 }] })
  const xp = bySource(mightAwards(session, makeContext({ records }), balance))['might.weightPr']
  assert.equal(xp, balance.might.weightPrBonus)
})

test('SOURCE: a volume PR pays its bonus', () => {
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 1e9, reps: 1, date: '2026-01-01' },
    bestVolume: { volume: 1000, date: '2026-01-01' },
    bestE1RM: { value: 1e9, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const session = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 145, reps: 8 }] })
  const xp = bySource(mightAwards(session, makeContext({ records }), balance))['might.volumePr']
  assert.equal(xp, balance.might.volumePrBonus)
})

test('SOURCE: an estimated 1RM gain pays per pound gained', () => {
  const previous = 180
  const records = new Map([['squat_bb', {
    exerciseId: 'squat_bb',
    bestWeight: { weight: 1e9, reps: 1, date: '2026-01-01' },
    bestVolume: { volume: 1e9, date: '2026-01-01' },
    bestE1RM: { value: previous, date: '2026-01-01' },
    lastPerformance: null,
  }]])
  const session = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 180, reps: 5 }] })
  const gain = 180 * (1 + 5 / 30) - previous
  const xp = bySource(mightAwards(session, makeContext({ records }), balance))['might.e1rm']
  assert.ok(Math.abs(xp - gain * balance.might.e1rmGainXpPerLb) < 1e-6)
})

test('SOURCE: loaded carries pay on load over distance', () => {
  const session = makeSession({
    sets: [{ exerciseId: 'farmers_carry', weight: 100, reps: null, distance: 200 }],
  })
  const context = makeContext({ records: unbeatableRecords(['farmers_carry']) })
  const xp = bySource(mightAwards(session, context, balance))['might.carry']
  assert.equal(xp, 100 * 2 * balance.might.carryXpPerLbPerHundredFeet)
})

test('Might is derived only: attendance with no load earns nothing', () => {
  const session = makeSession({ sets: [], durationMinutes: 90 })
  assert.equal(mightAwards(session, makeContext(), balance).length, 0)
})

test('warmup sets earn no Might', () => {
  const session = makeSession({
    sets: [{ exerciseId: 'squat_bb', weight: 145, reps: 8, isWarmup: true }],
  })
  assert.equal(mightAwards(session, makeContext(), balance).length, 0)
})

test('every Might award is non-negative — nothing subtracts XP', () => {
  const session = makeSession({ sets: [{ exerciseId: 'squat_bb', weight: 145, reps: 8 }] })
  for (const award of mightAwards(session, makeContext(), balance)) assert.ok(award.xp >= 0)
})
