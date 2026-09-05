/**
 * Daily protein target.
 *
 * Cory's rule: at least 0.8 grams per pound of body weight. Metric body-weight
 * entries are converted to pounds first. Round upward so the displayed whole-
 * gram target can never fall below 0.8 g/lb.
 */
export const PROTEIN_GRAMS_PER_LB = 0.8
export const LB_PER_KG = 2.2046226218

/**
 * @param {number|null|undefined} weight Recorded body weight in the profile's units.
 * @param {'imperial'|'metric'|string|null|undefined} units
 * @returns {number|null} Whole grams, rounded up, or null when no usable weight exists.
 */
export function proteinGoalGrams(weight, units = 'imperial') {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) return null
  const pounds = units === 'metric' ? weight * LB_PER_KG : weight
  return Math.ceil(pounds * PROTEIN_GRAMS_PER_LB)
}

/**
 * @param {number|null|undefined} grams
 * @param {number|null|undefined} goal
 */
export function proteinGoalMet(grams, goal) {
  return typeof grams === 'number' && Number.isFinite(grams)
    && typeof goal === 'number' && Number.isFinite(goal)
    && goal > 0 && grams >= goal
}
