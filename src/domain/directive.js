/**
 * Directives — the single short-term goal shown after a workout.
 *
 * Chosen as whichever attribute is nearest its next threshold, measured in days
 * at the user's own recent rate rather than in raw XP, so the goal that surfaces
 * is the one actually closest to being reached.
 *
 * A directive is always a *threshold*, never a streak: it asks you to reach a
 * level, not to train on consecutive days. `balance.directive
 * .neverRequireConsecutiveDays` records that this is deliberate, and
 * `directive.test.js` asserts it.
 */

import { levelProgress } from './levels.js'
import { tierName, ATTRIBUTE_IDS } from './tiers.js'

/**
 * @typedef {object} Directive
 * @property {import('./types.js').AttributeId} attribute
 * @property {number} targetLevel
 * @property {string} targetTier
 * @property {number} xpRemaining
 * @property {number} estimatedDays  Infinity when there is no recent rate.
 * @property {boolean} withinTarget  Reachable inside the configured window.
 * @property {string} headline
 * @property {string} detail
 */

/**
 * @param {ReturnType<import('./xp-engine.js').createInitialState>} state
 * @param {Partial<Record<import('./types.js').AttributeId, number>>} dailyRates
 *        Recent average XP per day per attribute.
 * @param {import('./types.js').Balance} balance
 * @returns {Directive|null} null only when every attribute is maxed.
 */
export function generateDirective(state, dailyRates, balance) {
  /** @type {Directive|null} */
  let best = null
  let bestDays = Infinity
  let bestRemaining = Infinity

  for (const attribute of ATTRIBUTE_IDS) {
    const progress = levelProgress(state[attribute].xp, balance)
    if (progress.isMax) continue

    const rate = dailyRates[attribute] ?? 0
    const remaining = progress.xpToNextLevel
    const days = rate > 0 ? remaining / rate : Infinity

    // Nearest in time; raw XP breaks ties so a directive still appears for a
    // brand new character with no history to rate.
    const better = days < bestDays || (days === bestDays && remaining < bestRemaining)
    if (!better) continue

    bestDays = days
    bestRemaining = remaining
    const targetLevel = progress.level + 1
    const targetTier = tierName(attribute, targetLevel)
    const name = attribute[0].toUpperCase() + attribute.slice(1)

    best = {
      attribute,
      targetLevel,
      targetTier,
      xpRemaining: Math.ceil(remaining),
      estimatedDays: days,
      withinTarget: days <= balance.directive.targetDaysToComplete,
      headline: `Reach ${name} level ${targetLevel}`,
      detail: Number.isFinite(days)
        ? `${Math.max(1, Math.ceil(days))} days at your current rate. ${targetTier} awaits.`
        : `${Math.ceil(remaining)} XP remaining. ${targetTier} awaits.`,
    }
  }

  return best
}
