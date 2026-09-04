/**
 * The character service — everything the Character surface shows.
 *
 * Wiring: it reads the stored attribute state, derives the facts titles are
 * awarded from, and joins both to the pure modules that know what they mean.
 * Nothing here decides what anything is worth.
 *
 * The one piece of state it writes is the `titles` store. A title is a record
 * of something that happened, so it is stamped with the day it was earned and
 * never recomputed for display — retuning a threshold later must not quietly
 * un-award something somebody already has.
 */

import { ATTRIBUTE_IDS, tierName } from '../domain/tiers.js'
import { levelProgress } from '../domain/levels.js'
import { rankFromLevels, totalLevels } from '../domain/rank.js'
import { generateDirective } from '../domain/directive.js'
import { explainSources, topContributors } from '../domain/sources.js'
import { earnedTitles } from '../domain/titles.js'
import { createInitialState } from '../domain/xp-engine.js'
import { daysBetween } from '../adapters/clock/clock.js'

const ATTRIBUTE_NAMES = {
  might: 'Might', wind: 'Wind', grit: 'Grit', vitality: 'Vitality', mind: 'Mind',
}

/** The calendar day before an ISO date. UTC purely as a stable arithmetic frame. */
function previousDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d - 1))
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(at.getUTCDate()).padStart(2, '0')}`
}

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {import('../domain/types.js').Balance} deps.balance
 * @param {{titles: any[]}} deps.catalogue  data/titles.json
 */
export function createCharacterService({ storage, clock, balance, catalogue }) {
  const titleCatalogue = catalogue?.titles ?? []

  async function loadState() {
    const stored = await storage.getAll('attributeState')
    const state = createInitialState()
    for (const row of stored) {
      if (state[row.attribute]) {
        state[row.attribute] = { xp: row.xp, level: row.level, lifetimeSources: { ...row.lifetimeSources } }
      }
    }
    return state
  }

  /**
   * The facts titles are awarded from, derived from what is actually logged.
   *
   * Nothing here is stored as a counter that could drift; every number is
   * recomputed from the records that produced it, which is the same reason
   * `docs/10` derives slot completion rather than storing it.
   */
  async function titleFacts(state) {
    const sessions = (await storage.getAll('sessions')).filter((session) => session.endedAt)
    const days = await storage.getAll('dayLogs')
    const records = await storage.getAll('records')
    const today = clock.today()

    const trainingDates = new Set(sessions.map((session) => session.date))
    const dates = [...trainingDates].sort()
    const [low, high] = balance.vitality.sleepBandHours

    const restAfterThreeTrainingDays = days.some((day) => {
      if (day.restDay !== true) return false
      let cursor = day.date
      for (let i = 0; i < 3; i += 1) {
        cursor = previousDate(cursor)
        if (!trainingDates.has(cursor)) return false
      }
      return true
    })

    const best = (exerciseId) => records
      .find((record) => record.exerciseId === exerciseId)?.bestWeight?.weight ?? 0

    return {
      levels: Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].level])),
      sessionCount: sessions.length,
      trainingHours: sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) / 60,
      milesCovered: days.reduce((sum, day) => sum
        + (day.cardio ?? []).reduce((miles, entry) => miles + (entry.distanceMiles ?? 0), 0), 0),
      inBandSleeps: days.filter((day) => typeof day.sleepHours === 'number'
        && day.sleepHours >= low && day.sleepHours <= high).length,
      bestDeadliftLbs: best('deadlift_bb'),
      bestCarryLoadLbs: best('farmers_carry'),
      daysSinceFirstSession: dates.length ? daysBetween(dates[0], today) : 0,
      // The engine already recorded that this happened, and it is the only
      // place that knows the gap rule was met on the day it was met.
      returnedAfterGap: (state.grit.lifetimeSources['grit.return'] ?? 0) > 0,
      restAfterThreeTrainingDays,
    }
  }

  /**
   * Awards anything newly earned, stamped with today. Never removes anything:
   * a stored title stays stored whatever the facts say later.
   */
  async function awardTitles(facts) {
    const held = new Map((await storage.getAll('titles')).map((row) => [row.id, row]))
    const fresh = earnedTitles(facts, titleCatalogue)
      .filter((title) => !held.has(title.id))
      .map((title) => ({ id: title.id, earnedOn: clock.today() }))
    if (fresh.length > 0) await storage.putAll('titles', fresh)
    return [...held.values(), ...fresh]
  }

  /** Rough recent rate per attribute, so the directive can estimate days. */
  function dailyRates(state) {
    return Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, Math.max(1, state[id].xp / 30)]))
  }

  /**
   * The whole Character screen, as one value.
   *
   * `sources` and `contributors` are on every attribute rather than fetched on
   * tap: the expanded view is `docs/03`'s mandatory one, and a screen that has
   * to go and ask before it can answer "why did that go up" answers it late.
   */
  async function view() {
    const state = await loadState()
    const facts = await titleFacts(state)
    const held = await awardTitles(facts)
    const heldById = new Map(held.map((row) => [row.id, row]))

    const levels = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].level]))
    const profile = await storage.get('profile', 'profile')

    return {
      name: profile?.name ?? '',
      rank: rankFromLevels(levels, balance),
      totalLevels: totalLevels(levels),
      levels,

      attributes: ATTRIBUTE_IDS.map((id) => ({
        id,
        name: ATTRIBUTE_NAMES[id],
        xp: state[id].xp,
        level: state[id].level,
        tier: tierName(id, state[id].level),
        progress: levelProgress(state[id].xp, balance),
        sources: explainSources(id, balance),
        contributors: topContributors(id, state[id].lifetimeSources, 4),
      })),

      directive: generateDirective(state, dailyRates(state), balance),

      titles: {
        earned: titleCatalogue
          .filter((title) => heldById.has(title.id))
          .map((title) => ({ ...title, earnedOn: heldById.get(title.id).earnedOn })),
        // The rest, so the screen can say what there is to earn rather than
        // showing an empty list to someone who has not earned one yet.
        available: titleCatalogue.filter((title) => !heldById.has(title.id)),
      },

      facts,
    }
  }

  return { view, titleFacts, awardTitles, titles: titleCatalogue }
}
