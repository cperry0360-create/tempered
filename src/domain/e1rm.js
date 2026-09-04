/**
 * Estimated one-rep max, via the Epley formula from `docs/01-attributes-and-xp.md`:
 *
 *   e1RM = weight * (1 + reps / 30)
 *
 * This is what lets Might reward intensity over junk volume: five hard reps
 * estimate a higher max than fifteen easy ones at a lighter load.
 */

/**
 * @param {number|null|undefined} weight
 * @param {number|null|undefined} reps
 * @returns {number} 0 when either input is missing or non-positive.
 */
export function estimateOneRepMax(weight, reps) {
  if (typeof weight !== 'number' || typeof reps !== 'number') return 0
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}
