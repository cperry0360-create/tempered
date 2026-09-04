/**
 * The levelling curve. Every constant comes from `data/balance.json` — this
 * module contains no numbers of its own.
 *
 * `xpForLevel(n)` is the *cumulative* XP needed to stand at level n, not the
 * incremental cost of that level. Because the exponent is above 1, each
 * successive level still costs more than the last.
 */

/**
 * Cumulative XP required to reach a level.
 *
 * @param {number} level
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
export function xpForLevel(level, balance) {
  if (level <= 0) return 0
  const { base, exponent } = balance.levelCurve
  return base * Math.pow(level, exponent)
}

/**
 * The level a given XP total resolves to, capped at `maxLevel`.
 *
 * @param {number} xp
 * @param {import('./types.js').Balance} balance
 * @returns {number}
 */
export function levelFromXp(xp, balance) {
  const { maxLevel } = balance.levelCurve
  let level = 0
  for (let n = 1; n <= maxLevel; n++) {
    if (xp < xpForLevel(n, balance)) break
    level = n
  }
  return level
}

/**
 * Where an XP total sits within its current level, for progress bars and
 * directives.
 *
 * @param {number} xp
 * @param {import('./types.js').Balance} balance
 * @returns {{level: number, xpIntoLevel: number, xpToNextLevel: number,
 *            fraction: number, isMax: boolean}}
 */
export function levelProgress(xp, balance) {
  const level = levelFromXp(xp, balance)
  const isMax = level >= balance.levelCurve.maxLevel

  if (isMax) {
    return { level, xpIntoLevel: 0, xpToNextLevel: 0, fraction: 1, isMax: true }
  }

  const floor = xpForLevel(level, balance)
  const ceiling = xpForLevel(level + 1, balance)
  const span = ceiling - floor
  const xpIntoLevel = xp - floor

  return {
    level,
    xpIntoLevel,
    xpToNextLevel: ceiling - xp,
    fraction: span > 0 ? xpIntoLevel / span : 0,
    isMax: false,
  }
}
