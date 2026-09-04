/**
 * Shared shaping functions. Every threshold and rate is supplied by the caller
 * from `data/balance.json`; nothing is baked in here.
 */

/**
 * Diminishing returns past a threshold. Below the cap the value passes through
 * untouched; above it, each further unit counts at `beyondRate`.
 *
 * This is what stops a two-hour junk session outscoring a hard 45 minutes,
 * without ever making extra work count for nothing.
 *
 * @param {number} value
 * @param {number} cap
 * @param {number} beyondRate
 * @returns {number}
 */
export function softCap(value, cap, beyondRate) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value <= cap) return value
  return cap + (value - cap) * beyondRate
}

/**
 * Scales a set of awards so they sum to at most `cap`, preserving each source's
 * share. Used for daily caps, where the breakdown must still add up to the total
 * the user is shown.
 *
 * @param {import('./types.js').Award[]} awards
 * @param {number} cap
 * @returns {import('./types.js').Award[]}
 */
export function applyDailyCap(awards, cap) {
  const total = awards.reduce((sum, award) => sum + award.xp, 0)
  if (total <= cap || total <= 0) return awards
  const scale = cap / total
  return awards.map((award) => ({ ...award, xp: award.xp * scale }))
}
