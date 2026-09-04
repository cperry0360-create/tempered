/**
 * The character service — Phase 5.
 *
 * The domain modules are tested on their own; what is worth testing here is the
 * fact-gathering, because that is where a title silently never fires. Every
 * fact is derived from logged records rather than kept as a counter, so each
 * one has a way of being wrong that a unit test of the predicate cannot see.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createCharacterService } from './character.js'
import { ensureProfile } from './seed.js'

const balance = loadBalance()
const catalogue = JSON.parse(readFileSync(new URL('../../data/titles.json', import.meta.url), 'utf8'))

async function freshCharacter(at = '2026-09-04T18:00:00.000Z') {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock(at)
  await ensureProfile(storage, clock)
  return { storage, clock, character: createCharacterService({ storage, clock, balance, catalogue }) }
}

/** Sets an attribute's stored state directly, standing in for months of use. */
async function setAttribute(storage, attribute, { xp = 0, level = 0, lifetimeSources = {} } = {}) {
  await storage.put('attributeState', { attribute, xp, level, lifetimeSources })
}

test('a brand new character is coherent rather than empty', async () => {
  const { character } = await freshCharacter()
  const view = await character.view()
  assert.equal(view.attributes.length, 5)
  assert.equal(view.totalLevels, 0)
  assert.equal(typeof view.rank, 'string')
  assert.deepEqual(view.titles.earned, [])
  assert.equal(view.titles.available.length, catalogue.titles.length,
    'and it can say what there is to earn')
})

test('MANDATORY: every attribute carries what feeds it and what each is worth', async () => {
  const { character } = await freshCharacter()
  for (const attribute of (await character.view()).attributes) {
    assert.ok(attribute.sources.length > 0, `nothing explains ${attribute.id}`)
    for (const source of attribute.sources) {
      assert.ok(source.label.length > 0 && /\d/.test(source.worth), source.source)
    }
  }
})

test('an attribute shows what actually fed it, biggest first', async () => {
  const { storage, character } = await freshCharacter()
  await setAttribute(storage, 'might', {
    xp: 5000, level: 3,
    lifetimeSources: { 'might.volume': 4000, 'might.weightPr': 900, 'might.carry': 100 },
  })
  const might = (await character.view()).attributes.find((a) => a.id === 'might')
  assert.deepEqual(might.contributors.map((c) => c.source),
    ['might.volume', 'might.weightPr', 'might.carry'])
  assert.equal(might.level, 3)
  assert.equal(might.tier.length > 0, true)
})

test('progress is where the XP actually sits in the level', async () => {
  const { storage, character } = await freshCharacter()
  await setAttribute(storage, 'grit', { xp: 700, level: 1 })
  const grit = (await character.view()).attributes.find((a) => a.id === 'grit')
  assert.ok(grit.progress.fraction >= 0 && grit.progress.fraction <= 1)
  assert.ok(grit.progress.xpToNextLevel > 0)
})

// --- the facts titles are awarded from --------------------------------------

test('sessions give the session count, the hours and the span', async () => {
  const { storage, character } = await freshCharacter()
  await storage.putAll('sessions', [
    { id: 'a', date: '2025-09-04', durationMinutes: 60, endedAt: '2025-09-04T19:00:00Z' },
    { id: 'b', date: '2026-09-04', durationMinutes: 90, endedAt: '2026-09-04T19:00:00Z' },
    { id: 'c', date: '2026-09-04', durationMinutes: 30 },
  ])
  const facts = await character.titleFacts({
    might: { xp: 0, level: 0, lifetimeSources: {} }, wind: { xp: 0, level: 0, lifetimeSources: {} },
    grit: { xp: 0, level: 0, lifetimeSources: {} }, vitality: { xp: 0, level: 0, lifetimeSources: {} },
    mind: { xp: 0, level: 0, lifetimeSources: {} },
  })
  assert.equal(facts.sessionCount, 2, 'an unfinished session is not a session')
  assert.equal(facts.trainingHours, 2.5)
  assert.equal(facts.daysSinceFirstSession, 365)
})

test('day logs give the miles and the nights inside the sleep band', async () => {
  const { storage, character } = await freshCharacter()
  const [low, high] = balance.vitality.sleepBandHours
  await storage.putAll('dayLogs', [
    { date: '2026-09-01', sleepHours: low, cardio: [{ activityId: 'run', distanceMiles: 3 }] },
    { date: '2026-09-02', sleepHours: high },
    { date: '2026-09-03', sleepHours: high + 2, cardio: [{ activityId: 'cycle', distanceMiles: 10 }] },
  ])
  const state = Object.fromEntries(['might', 'wind', 'grit', 'vitality', 'mind']
    .map((id) => [id, { xp: 0, level: 0, lifetimeSources: {} }]))
  const facts = await character.titleFacts(state)
  assert.equal(facts.milesCovered, 13)
  assert.equal(facts.inBandSleeps, 2, 'a long night is not an in-band one')
})

test('a rest day after three training days is seen; a gap in them is not', async () => {
  const { storage, character } = await freshCharacter()
  const state = Object.fromEntries(['might', 'wind', 'grit', 'vitality', 'mind']
    .map((id) => [id, { xp: 0, level: 0, lifetimeSources: {} }]))

  await storage.putAll('sessions', [
    { id: 'a', date: '2026-09-01', durationMinutes: 60, endedAt: 'x' },
    { id: 'b', date: '2026-09-02', durationMinutes: 60, endedAt: 'x' },
    { id: 'c', date: '2026-09-04', durationMinutes: 60, endedAt: 'x' },
  ])
  await storage.put('dayLogs', { date: '2026-09-05', restDay: true })
  assert.equal((await character.titleFacts(state)).restAfterThreeTrainingDays, false,
    'the 3rd was not a training day, so this is not three consecutive')

  await storage.put('sessions', { id: 'd', date: '2026-09-03', durationMinutes: 60, endedAt: 'x' })
  assert.equal((await character.titleFacts(state)).restAfterThreeTrainingDays, true)
})

test('returning after a gap is read from what the engine recorded at the time', async () => {
  const { storage, character } = await freshCharacter()
  await setAttribute(storage, 'grit', { xp: 500, level: 1, lifetimeSources: { 'grit.return': 290 } })
  const view = await character.view()
  assert.ok(view.titles.earned.some((title) => title.id === 'returned'))
})

// --- awarding ---------------------------------------------------------------

test('a title is stamped with the day it was earned', async () => {
  const { storage, clock, character } = await freshCharacter()
  await storage.put('sessions', { id: 'a', date: '2026-09-04', durationMinutes: 45, endedAt: 'x' })
  const view = await character.view()
  const first = view.titles.earned.find((title) => title.id === 'first_load')
  assert.equal(first.earnedOn, '2026-09-04')
  assert.equal(first.condition, 'Complete your first session')

  // And the date does not drift when the screen is opened again later.
  clock.advanceDays(30)
  const later = await character.view()
  assert.equal(later.titles.earned.find((t) => t.id === 'first_load').earnedOn, '2026-09-04')
})

test('a title already held is never awarded twice', async () => {
  const { storage, character } = await freshCharacter()
  await storage.put('sessions', { id: 'a', date: '2026-09-04', durationMinutes: 45, endedAt: 'x' })
  await character.view()
  await character.view()
  assert.equal(await storage.count('titles'), 1)
})

test('NO PUNISHMENT: nothing un-earns a title, whatever the facts say later', async () => {
  const { storage, character } = await freshCharacter()
  await setAttribute(storage, 'might', { xp: 99999, level: 6 })
  assert.ok((await character.view()).titles.earned.some((t) => t.id === 'heavy_resistance'))

  // An export, an import, a retune — the level is gone and the title is not.
  await setAttribute(storage, 'might', { xp: 0, level: 0 })
  const after = await character.view()
  assert.ok(after.titles.earned.some((t) => t.id === 'heavy_resistance'),
    'a title records something that happened; it cannot stop having happened')
  assert.ok(!after.titles.available.some((t) => t.id === 'heavy_resistance'),
    'and it is not offered again as something to earn')
})

test('the directive points at whatever is nearest', async () => {
  const { storage, character } = await freshCharacter()
  await setAttribute(storage, 'vitality', { xp: 400, level: 0 })
  const view = await character.view()
  assert.ok(view.directive)
  assert.ok(view.directive.headline.length > 0)
  assert.ok(view.directive.xpRemaining > 0)
})
