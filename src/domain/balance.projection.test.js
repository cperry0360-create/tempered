/**
 * The balance projection, run as a test rather than a script — as
 * docs/BALANCE-PROJECTION.md requires. If a change to data/balance.json breaks
 * any of the three checks, this fails.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { simulateYear, CHECKPOINTS } from './balance-projection.js'
import { awardsForSession, totalsByAttribute } from './xp-engine.js'
import { ATTRIBUTE_IDS } from './tiers.js'
import { levelFromXp } from './levels.js'

const balance = loadBalance()
const library = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))
const projection = simulateYear(balance, library)

test('CHECK 1: every attribute reaches level 3 by day 60', () => {
  const atSixty = projection.milestones[60].levels
  for (const attribute of ATTRIBUTE_IDS) {
    assert.ok(atSixty[attribute] >= 3,
      `${attribute} is only level ${atSixty[attribute]} at day 60`)
  }
})

test('CHECK 2: nothing reaches the level cap within a year', () => {
  for (const attribute of ATTRIBUTE_IDS) {
    assert.ok(projection.finalLevels[attribute] < balance.levelCurve.maxLevel,
      `${attribute} maxed out inside the year`)
  }
})

test('CHECK 3: the spread at 365 days is at most 3 levels', () => {
  const levels = ATTRIBUTE_IDS.map((a) => projection.finalLevels[a])
  const spread = Math.max(...levels) - Math.min(...levels)
  assert.ok(spread <= 3, `spread is ${spread} levels: ${JSON.stringify(projection.finalLevels)}`)
})

test('docs/01: level 1 is reachable inside the first session', () => {
  const exercises = new Map(library.exercises.map((e) => [e.id, e]))
  const lower = library.routines.find((r) => r.id === 'lower')
  const startWeights = { rdl: 115, split_squat: 40, farmers_carry: 100 }

  /** @type {import('./types.js').SetInput[]} */
  const sets = []
  for (const entry of lower.exercises) {
    const weight = entry.weight ?? startWeights[entry.id] ?? null
    for (let i = 0; i < entry.sets; i++) {
      sets.push({ exerciseId: entry.id, weight, reps: entry.reps ?? null, distance: entry.distance ?? null })
    }
  }

  const totals = totalsByAttribute(awardsForSession(
    { id: 'first', routineId: 'lower', durationMinutes: 65, sets },
    {
      date: 'd1', exercises, records: new Map(), daysSinceLastSession: Infinity,
      sessionsThisWeekBefore: 0, planTargetSessionsPerWeek: 4,
    },
    balance))

  const best = Math.max(...ATTRIBUTE_IDS.map((a) => levelFromXp(totals[a], balance)))
  assert.ok(best >= 1, 'one honest session must produce a visible level')
})

test('docs/01: Might leads, as befits a training app', () => {
  const { might, wind, grit, vitality, mind } = projection.finalLevels
  assert.ok(might >= Math.max(wind, grit, vitality, mind), 'Might must not be the slowest thing in the app')
})

test('the simulation is deterministic — the table is reproducible', () => {
  const again = simulateYear(balance, library)
  assert.deepEqual(again.finalLevels, projection.finalLevels)
  assert.deepEqual(again.milestones, projection.milestones)
})

test('the committed projection table matches a fresh simulation', () => {
  const doc = readFileSync(new URL('../../docs/BALANCE-PROJECTION.md', import.meta.url), 'utf8')
  const attributes = ['might', 'wind', 'grit', 'vitality', 'mind']

  for (const day of CHECKPOINTS) {
    const levels = projection.milestones[day].levels
    const expected = `| ${day} | ${attributes.map((a) => levels[a]).join(' | ')} |`
    assert.ok(doc.includes(expected),
      `docs/BALANCE-PROJECTION.md is stale for day ${day}.\n` +
      `Expected row: ${expected}\nRun: node tools/regenerate-projection.js`)
  }

  assert.ok(doc.includes(`Year-end rank **${projection.rank}**, ${projection.totalLevels} total`),
    'the doc\'s rank line is stale — run node tools/regenerate-projection.js')
})
