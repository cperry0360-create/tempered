/**
 * The XP engine: turns logged performance into attribute awards.
 *
 * Each attribute is fed from exactly one place, which keeps the mapping legible:
 *
 *   a session  ->  Might, Grit
 *   a day      ->  Wind, Vitality, Mind
 *
 * A cardio session is still a session — it earns Grit for showing up — while the
 * distance or time it covered is logged against the day and earns Wind there.
 * Nothing is scored twice.
 *
 * Every function here is pure. Balance is always passed in; nothing is read from
 * disk, the network, the DOM, or the clock.
 */

import { mightAwards } from './might.js'
import { gritAwards } from './grit.js'
import { windAwards } from './wind.js'
import { vitalityAwards } from './vitality.js'
import { mindAwards } from './mind.js'
import { levelFromXp } from './levels.js'
import { ATTRIBUTE_IDS } from './tiers.js'

/**
 * @param {import('./types.js').SessionInput} session
 * @param {import('./types.js').SessionContext} context
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function awardsForSession(session, context, balance) {
  return [...mightAwards(session, context, balance), ...gritAwards(session, context, balance)]
}

/**
 * @param {import('./types.js').DayInput} day
 * @param {{paceBaselineMinPerMile?: number|null}} context
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function awardsForDay(day, context, balance) {
  return [
    ...windAwards(day.cardio ?? [], day.steps, day.mobilityMinutes, context?.paceBaselineMinPerMile, balance),
    ...vitalityAwards(day, balance),
    ...mindAwards(day, balance),
  ]
}

/**
 * @param {import('./types.js').Award[]} awards
 * @returns {Record<import('./types.js').AttributeId, number>}
 */
export function totalsByAttribute(awards) {
  /** @type {Record<string, number>} */
  const totals = {}
  for (const id of ATTRIBUTE_IDS) totals[id] = 0
  for (const award of awards) totals[award.attribute] += award.xp
  return /** @type {Record<import('./types.js').AttributeId, number>} */ (totals)
}

/**
 * @param {import('./types.js').Award[]} awards
 * @returns {import('./types.js').XpBySource}
 */
export function totalsBySource(awards) {
  /** @type {import('./types.js').XpBySource} */
  const totals = {}
  for (const award of awards) totals[award.source] = (totals[award.source] ?? 0) + award.xp
  return totals
}

/**
 * The per-attribute totals implied by a stored `xpBySource`.
 *
 * Every source id is `<attribute>.<what>` — `might.volume`, `vitality.sleep` —
 * so what an award fed is recoverable from the record of what was paid, without
 * re-running the engine over history that may since have changed. That is what
 * makes "what moved today" answerable from storage rather than by simulation.
 *
 * @param {import('./types.js').XpBySource} sources
 * @returns {Record<import('./types.js').AttributeId, number>}
 */
export function totalsByAttributeFromSources(sources) {
  /** @type {Record<string, number>} */
  const totals = {}
  for (const id of ATTRIBUTE_IDS) totals[id] = 0
  for (const [source, xp] of Object.entries(sources ?? {})) {
    const attribute = source.split('.')[0]
    if (attribute in totals) totals[attribute] += xp ?? 0
  }
  return /** @type {Record<import('./types.js').AttributeId, number>} */ (totals)
}

/**
 * A fresh character: every attribute at zero.
 * @returns {Record<import('./types.js').AttributeId, {xp: number, level: number, lifetimeSources: import('./types.js').XpBySource}>}
 */
export function createInitialState() {
  /** @type {Record<string, {xp: number, level: number, lifetimeSources: import('./types.js').XpBySource}>} */
  const state = {}
  for (const id of ATTRIBUTE_IDS) state[id] = { xp: 0, level: 0, lifetimeSources: {} }
  return /** @type {any} */ (state)
}

/**
 * Folds awards into character state, returning new state. Pure: the input is not
 * modified.
 *
 * XP is rounded to whole numbers per award, so `lifetimeSources` always sums
 * exactly to `xp` and the "why did this grow" view can never disagree with the
 * total it explains.
 *
 * @param {ReturnType<typeof createInitialState>} state
 * @param {import('./types.js').Award[]} awards
 * @param {import('./types.js').Balance} balance
 * @returns {ReturnType<typeof createInitialState>}
 */
export function applyAwards(state, awards, balance) {
  const next = createInitialState()
  for (const id of ATTRIBUTE_IDS) {
    next[id] = {
      xp: state[id].xp,
      level: state[id].level,
      lifetimeSources: { ...state[id].lifetimeSources },
    }
  }

  for (const award of awards) {
    const xp = Math.round(award.xp)
    if (xp <= 0) continue
    const entry = next[award.attribute]
    entry.xp += xp
    entry.lifetimeSources[award.source] = (entry.lifetimeSources[award.source] ?? 0) + xp
  }

  for (const id of ATTRIBUTE_IDS) next[id].level = levelFromXp(next[id].xp, balance)
  return next
}

/**
 * @param {ReturnType<typeof createInitialState>} state
 * @returns {Record<import('./types.js').AttributeId, number>}
 */
export function levelsOf(state) {
  /** @type {Record<string, number>} */
  const levels = {}
  for (const id of ATTRIBUTE_IDS) levels[id] = state[id].level
  return /** @type {Record<import('./types.js').AttributeId, number>} */ (levels)
}
