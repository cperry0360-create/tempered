/**
 * Plate calculator.
 *
 * Answers "what goes on each side" for a target weight, using the fewest plates
 * and preferring heavier plates when two loadings tie. Exact solutions are not
 * always possible, so an unreachable target returns the closest achievable
 * weight rather than nothing — being told 187.5 is the nearest is useful; being
 * told "impossible" is not.
 *
 * Arithmetic runs in quarter-pound units so fractional plates (1.25 lb) cannot
 * accumulate floating-point error across a dynamic-programming table.
 */

const UNITS_PER_LB = 4

/** @param {number} lbs */
const toUnits = (lbs) => Math.round(lbs * UNITS_PER_LB)
/** @param {number} units */
const toLbs = (units) => units / UNITS_PER_LB

/**
 * @typedef {object} PlateSolution
 * @property {number[]} perSide     Plates on one side, heaviest first.
 * @property {number} achieved      The total weight this actually loads.
 * @property {boolean} exact        False when the target could not be hit.
 * @property {number} plateCount    Plates per side.
 * @property {string} note
 */

/**
 * @param {number} target       Total weight wanted, bar included.
 * @param {object} [options]
 * @param {number} [options.bar]        Bar weight. Default 45.
 * @param {number[]} [options.plates]   Plate denominations available, per side.
 * @param {number} [options.pairsPerPlate] How many of each plate you have per side.
 * @returns {PlateSolution|null} null when the target is below the bar itself.
 */
export function solvePlates(target, options = {}) {
  const bar = options.bar ?? 45
  const denominations = [...(options.plates ?? [45, 35, 25, 10, 5, 2.5, 1.25])]
    .filter((plate) => plate > 0)
    .sort((a, b) => b - a)
  const perPlateLimit = options.pairsPerPlate ?? Infinity

  if (!Number.isFinite(target) || target < bar) return null
  if (denominations.length === 0) {
    return { perSide: [], achieved: bar, exact: target === bar, plateCount: 0, note: 'No plates available.' }
  }

  // Everything below is per side: the bar is loaded symmetrically.
  const wantedUnits = Math.round((toUnits(target) - toUnits(bar)) / 2)
  if (wantedUnits === 0) {
    return { perSide: [], achieved: bar, exact: true, plateCount: 0, note: 'Empty bar.' }
  }
  if (wantedUnits < 0) return null

  const plateUnits = denominations.map(toUnits)

  // best[n] = fewest plates summing to exactly n, with the loading that got there.
  /** @type {(null|{count: number, plates: number[]})[]} */
  const best = new Array(wantedUnits + 1).fill(null)
  best[0] = { count: 0, plates: [] }

  for (let sum = 1; sum <= wantedUnits; sum++) {
    // Heaviest first, so a tie on plate count keeps the heavier loading — the
    // one a lifter would actually pick up.
    for (let index = 0; index < plateUnits.length; index++) {
      const plate = plateUnits[index]
      if (plate > sum) continue
      const previous = best[sum - plate]
      if (!previous) continue
      if (previous.plates.filter((p) => p === plate).length >= perPlateLimit) continue
      const candidate = { count: previous.count + 1, plates: [...previous.plates, plate] }
      if (!best[sum] || candidate.count < best[sum].count) best[sum] = candidate
    }
  }

  if (best[wantedUnits]) {
    const perSide = best[wantedUnits].plates.map(toLbs).sort((a, b) => b - a)
    return {
      perSide,
      achieved: target,
      exact: true,
      plateCount: perSide.length,
      note: `${perSide.length} plate${perSide.length === 1 ? '' : 's'} per side.`,
    }
  }

  // No exact loading: take the nearest reachable weight, preferring to go under.
  let nearest = 0
  for (let sum = wantedUnits; sum >= 0; sum--) {
    if (best[sum]) { nearest = sum; break }
  }
  let over = null
  for (let sum = wantedUnits + 1; sum <= wantedUnits + toUnits(50); sum++) {
    const solution = solveExact(sum, plateUnits, perPlateLimit)
    if (solution) { over = { sum, solution }; break }
  }

  const underDistance = wantedUnits - nearest
  const overDistance = over ? over.sum - wantedUnits : Infinity
  const chosenSum = overDistance < underDistance ? over.sum : nearest
  const chosenPlates = overDistance < underDistance ? over.solution.plates : best[nearest].plates
  const perSide = chosenPlates.map(toLbs).sort((a, b) => b - a)
  const achieved = toLbs(toUnits(bar) + chosenSum * 2)

  return {
    perSide,
    achieved,
    exact: false,
    plateCount: perSide.length,
    note: `${target} lb cannot be made with these plates. Closest is ${achieved} lb.`,
  }
}

/** Fewest-plate exact solve for one sum, used only when probing upward. */
function solveExact(targetUnits, plateUnits, perPlateLimit) {
  const best = new Array(targetUnits + 1).fill(null)
  best[0] = { count: 0, plates: [] }
  for (let sum = 1; sum <= targetUnits; sum++) {
    for (const plate of plateUnits) {
      if (plate > sum) continue
      const previous = best[sum - plate]
      if (!previous) continue
      if (previous.plates.filter((p) => p === plate).length >= perPlateLimit) continue
      const candidate = { count: previous.count + 1, plates: [...previous.plates, plate] }
      if (!best[sum] || candidate.count < best[sum].count) best[sum] = candidate
    }
  }
  return best[targetUnits]
}
