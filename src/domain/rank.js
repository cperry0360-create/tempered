/**
 * Character rank: a summary of the five attribute levels, never a currency and
 * never tracked separately. Thresholds come from `data/balance.json`.
 */

import { ATTRIBUTE_IDS } from './tiers.js'

/**
 * @param {Record<import('./types.js').AttributeId, number>} levels
 * @returns {number}
 */
export function totalLevels(levels) {
  return ATTRIBUTE_IDS.reduce((sum, id) => sum + (levels[id] ?? 0), 0)
}

/**
 * The rank letter for a set of attribute levels.
 *
 * @param {Record<import('./types.js').AttributeId, number>} levels
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Rank}
 */
export function rankFromLevels(levels, balance) {
  const total = totalLevels(levels)

  // Highest threshold the total clears. Sorted ascending so the last win holds.
  let rank = /** @type {import('./types.js').Rank} */ ('F')
  const entries = Object.entries(balance.rank.thresholds).sort((a, b) => a[1] - b[1])
  for (const [letter, threshold] of entries) {
    if (total >= threshold) rank = /** @type {import('./types.js').Rank} */ (letter)
  }
  return rank
}
